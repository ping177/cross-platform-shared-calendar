import { createClient } from '@supabase/supabase-js';
import { loadVapidConfig, sendWebPush } from '../_shared/web-push.ts';
import {
  CANDIDATE_PAGE_SIZE,
  handleSendRemindersRequest,
  MAX_RECURRING_EXCEPTIONS,
  runSendReminders,
  type ReminderCandidate,
  type ReminderSubscription,
  type SpaceMembership,
} from './logic.ts';
import type { RecurringReminderSource } from './recurring.ts';
import type { EventOccurrenceException } from '../../../src/types.ts';

const LOOKUP_BATCH_SIZE = 100;
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

function requiredSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required server configuration: ${name}`);
  }
  return value;
}

function configurationErrorResponse() {
  return new Response(JSON.stringify({ status: 'error' }), {
    status: 500,
    headers: jsonHeaders,
  });
}

Deno.serve(async (request) => {
  let expectedSecret: string;
  try {
    expectedSecret = requiredSecret('REMINDER_CRON_SECRET');
  } catch {
    return configurationErrorResponse();
  }

  return handleSendRemindersRequest(request, {
    expectedSecret,
    run: async (context) => {
      const supabaseUrl = requiredSecret('SUPABASE_URL');
      const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY');
      const vapid = loadVapidConfig();
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      return runSendReminders(context, {
        fetchCandidatePage: async ({ afterId, limit }) => {
          let query = adminClient
            .from('events')
            .select('id, space_id, scope, owner_user_id, title, starts_at, all_day, reminder_kind, time_zone, reminder_schedule_changed_at')
            .is('recurrence_rule', null)
            .not('reminder_kind', 'is', null)
            .not('time_zone', 'is', null)
            .order('id', { ascending: true })
            .limit(limit);
          if (afterId !== null) {
            query = query.gt('id', afterId);
          }

          const { data, error } = await query;
          if (error) {
            throw new Error('Reminder candidate scan failed.');
          }
          return (data ?? []) as ReminderCandidate[];
        },
        fetchRecurringCandidatePage: async ({ afterId, limit }) => {
          let query = adminClient
            .from('events')
            .select('id, space_id, created_by, scope, owner_user_id, title, description, starts_at, ends_at, all_day, reminder_kind, time_zone, reminder_schedule_changed_at, recurrence_rule, series_id, parent_event_id, recurrence_until, created_at, updated_at')
            .not('recurrence_rule', 'is', null)
            .not('reminder_kind', 'is', null)
            .not('time_zone', 'is', null)
            .order('id', { ascending: true })
            .limit(limit);
          if (afterId !== null) {
            query = query.gt('id', afterId);
          }

          const { data, error } = await query;
          if (error) {
            throw new Error('Recurring Reminder source scan failed.');
          }
          return (data ?? []) as RecurringReminderSource[];
        },
        fetchRecurringExceptions: async (eventIds) => {
          const exceptions: EventOccurrenceException[] = [];
          let exceptionsScanned = 0;
          for (let index = 0; index < eventIds.length; index += LOOKUP_BATCH_SIZE) {
            const batch = eventIds.slice(index, index + LOOKUP_BATCH_SIZE);
            let afterExceptionId: string | null = null;

            while (true) {
              const remaining = MAX_RECURRING_EXCEPTIONS - exceptions.length;
              const limit = remaining === 0
                ? 1
                : Math.min(CANDIDATE_PAGE_SIZE, remaining);
              let query = adminClient
                .from('event_occurrence_exceptions')
                .select('id, event_id, occurrence_date, exception_type, override_data, created_at, updated_at')
                .in('event_id', batch)
                .order('id', { ascending: true })
                .limit(limit);
              if (afterExceptionId !== null) {
                query = query.gt('id', afterExceptionId);
              }

              const { data, error } = await query;
              if (error) {
                throw new Error('Recurring Reminder exception scan failed.');
              }

              const page = (data ?? []) as EventOccurrenceException[];
              exceptionsScanned += page.length;
              if (remaining === 0 && page.length > 0) {
                return {
                  exceptions,
                  exceptionsScanned,
                  exceptionTruncated: true,
                };
              }
              exceptions.push(...page);
              if (page.length < limit) {
                break;
              }
              afterExceptionId = page.at(-1)?.id ?? afterExceptionId;
            }
          }

          return {
            exceptions,
            exceptionsScanned,
            exceptionTruncated: false,
          };
        },
        fetchMemberships: async (spaceIds) => {
          const memberships: SpaceMembership[] = [];
          for (let index = 0; index < spaceIds.length; index += LOOKUP_BATCH_SIZE) {
            const batch = spaceIds.slice(index, index + LOOKUP_BATCH_SIZE);
            const { data, error } = await adminClient
              .from('space_members')
              .select('space_id, user_id')
              .in('space_id', batch);
            if (error) {
              throw new Error('Reminder membership lookup failed.');
            }
            memberships.push(...((data ?? []) as SpaceMembership[]));
          }
          return memberships;
        },
        fetchSubscriptions: async (userIds) => {
          const subscriptions: ReminderSubscription[] = [];
          for (let index = 0; index < userIds.length; index += LOOKUP_BATCH_SIZE) {
            const batch = userIds.slice(index, index + LOOKUP_BATCH_SIZE);
            const { data, error } = await adminClient
              .from('push_subscriptions')
              .select('id, user_id, installation_id, endpoint, p256dh, auth, expiration_time, disabled_at')
              .in('user_id', batch)
              .is('disabled_at', null);
            if (error) {
              throw new Error('Reminder subscription lookup failed.');
            }
            subscriptions.push(...((data ?? []) as ReminderSubscription[]));
          }
          return subscriptions;
        },
        claim: async (input) => {
          const { data, error } = await adminClient.rpc('claim_reminder_delivery', {
            p_event_id: input.eventId,
            p_recipient_user_id: input.recipientUserId,
            p_subscription_id: input.subscriptionId,
            p_due_at: input.dueAt,
            p_expected_reminder_schedule_changed_at: input.expectedReminderScheduleChangedAt,
          });
          if (error) {
            throw new Error('Reminder claim failed.');
          }
          return data as string | null;
        },
        claimRecurring: async (input) => {
          const { data, error } = await adminClient.rpc('claim_recurring_reminder_delivery', {
            p_source_event_id: input.sourceEventId,
            p_logical_series_id: input.logicalSeriesId,
            p_occurrence_date: input.occurrenceDate,
            p_recipient_user_id: input.recipientUserId,
            p_subscription_id: input.subscriptionId,
            p_due_at: input.dueAt,
            p_expected_source_updated_at: input.expectedSourceUpdatedAt,
            p_expected_reminder_schedule_changed_at: input.expectedReminderScheduleChangedAt,
            p_expected_exception_id: input.expectedExceptionId,
            p_expected_exception_updated_at: input.expectedExceptionUpdatedAt,
            p_expected_exception_type: input.expectedExceptionType,
            p_effective_schedule_changed_at: input.effectiveScheduleChangedAt,
          });
          if (error) {
            throw new Error('Recurring Reminder claim failed.');
          }
          return data as string | null;
        },
        send: (subscription, payload) => sendWebPush({
          subscription,
          payload,
          vapid,
        }),
        disableSubscription: async (subscriptionId) => {
          const { data, error } = await adminClient
            .from('push_subscriptions')
            .update({ disabled_at: context.runNow.toISOString() })
            .eq('id', subscriptionId)
            .is('disabled_at', null)
            .select('id');
          if (error) {
            throw new Error('Gone subscription disable failed.');
          }
          return (data ?? []).length === 1;
        },
        finalize: async (input) => {
          const { data, error } = await adminClient
            .from('reminder_deliveries')
            .update({
              status: input.status,
              result_code: input.resultCode,
              provider_status: input.providerStatus,
            })
            .eq('id', input.deliveryId)
            .eq('status', 'claimed')
            .select('id');
          if (error) {
            throw new Error('Reminder delivery finalize failed.');
          }
          return (data ?? []).length;
        },
      });
    },
  });
});
