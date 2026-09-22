import {
  calculateReminderDue,
  type ReminderKind,
} from '../_shared/reminder-due.ts';
import type {
  StoredPushSubscription,
  WebPushDeliveryResult,
  WebPushPayload,
} from '../_shared/web-push.ts';
import type {
  RecurringReminderSource,
  RecurringReminderCandidate,
  RecurringReminderSnapshot,
} from './recurring.ts';
import { projectRecurringReminderCandidates } from './recurring.ts';
import type { EventOccurrenceException } from '../../../src/types.ts';

export const CANDIDATE_PAGE_SIZE = 100;
export const MAX_CANDIDATES = 1000;
export const MAX_RECURRING_SOURCES = 1000;
export const MAX_RECURRING_EXCEPTIONS = 1000;
export const MAX_DELIVERY_TASKS = 50;
export const PUSH_CONCURRENCY = 5;
export const CLAIM_ACQUISITION_CUTOFF_MS = 95_000;

const GRACE_WINDOW_MS = 10 * 60_000;
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

export type ReminderCandidate = {
  id: string;
  space_id: string;
  scope: 'personal' | 'shared';
  owner_user_id: string | null;
  title: string;
  starts_at: string;
  all_day: boolean;
  reminder_kind: ReminderKind;
  time_zone: string;
  reminder_schedule_changed_at: string;
};

export type ProjectedReminderCandidate = ReminderCandidate | RecurringReminderCandidate;

export type EligibleReminderCandidate = {
  event: ProjectedReminderCandidate;
  dueAt: Date;
  rawReminderScheduleChangedAt: string;
};

export type SpaceMembership = {
  space_id: string;
  user_id: string;
};

export type ReminderSubscription = StoredPushSubscription & {
  disabled_at: string | null;
};

export type DeliveryTask = {
  eventId: string;
  eventTitle: string;
  recipientUserId: string;
  subscription: ReminderSubscription;
  dueAt: Date;
  rawReminderScheduleChangedAt: string;
  recurrence: RecurringReminderSnapshot | null;
};

export type LedgerFinalResult = {
  status: 'sent' | 'failed';
  resultCode: string;
  providerStatus: number | null;
};

export type ClaimReminderInput = {
  eventId: string;
  recipientUserId: string;
  subscriptionId: string;
  dueAt: string;
  expectedReminderScheduleChangedAt: string;
};

export type ClaimRecurringReminderInput = {
  sourceEventId: string;
  logicalSeriesId: string;
  occurrenceDate: string;
  recipientUserId: string;
  subscriptionId: string;
  dueAt: string;
  expectedSourceUpdatedAt: string;
  expectedReminderScheduleChangedAt: string;
  expectedExceptionId: string | null;
  expectedExceptionUpdatedAt: string | null;
  expectedExceptionType: EventOccurrenceException['exception_type'] | null;
  effectiveScheduleChangedAt: string;
};

export type RecurringExceptionScanResult = {
  exceptions: EventOccurrenceException[];
  exceptionsScanned: number;
  exceptionTruncated: boolean;
};

export type FinalizeReminderInput = {
  deliveryId: string;
  status: 'sent' | 'failed';
  resultCode: string;
  providerStatus: number | null;
};

export type RunSendRemindersDependencies = {
  fetchCandidatePage: (request: CandidatePageRequest) => Promise<ReminderCandidate[]>;
  fetchRecurringCandidatePage: (request: CandidatePageRequest) => Promise<RecurringReminderSource[]>;
  fetchRecurringExceptions: (eventIds: string[]) => Promise<RecurringExceptionScanResult>;
  fetchMemberships: (spaceIds: string[]) => Promise<SpaceMembership[]>;
  fetchSubscriptions: (
    userIds: string[],
    runNow: Date,
  ) => Promise<ReminderSubscription[]>;
  claim: (input: ClaimReminderInput) => Promise<string | null>;
  claimRecurring: (input: ClaimRecurringReminderInput) => Promise<string | null>;
  send: (
    subscription: StoredPushSubscription,
    payload: WebPushPayload,
  ) => Promise<WebPushDeliveryResult>;
  disableSubscription: (subscriptionId: string) => Promise<boolean>;
  finalize: (input: FinalizeReminderInput) => Promise<number>;
};

export type SendRemindersDiagnostics = {
  status: 'completed' | 'candidate_limit_exceeded';
  candidates_scanned: number;
  candidate_truncated: boolean;
  due_eligible: number;
  future_skipped: number;
  newly_past_skipped: number;
  grace_expired_skipped: number;
  invalid_skipped: number;
  recipients: number;
  active_subscriptions: number;
  delivery_tasks: number;
  selected_delivery_tasks: number;
  overflow_delivery_tasks: number;
  claim_rejected: number;
  claimed: number;
  sent: number;
  failed: number;
  gone_disabled: number;
  disable_failures: number;
  finalize_failures: number;
  unexpected_task_errors: number;
  runtime_deferred: number;
  runtime_stop_reason: 'claim_acquisition_cutoff' | null;
  elapsed_ms: number;
};

export type RunContext = {
  runNow: Date;
  startedAt: number;
  monotonicNow: () => number;
};

type RequestHandlerOptions = {
  expectedSecret: string;
  run: (context: RunContext) => Promise<SendRemindersDiagnostics>;
  now?: () => Date;
  monotonicNow?: () => number;
};

export type CandidatePageRequest = {
  afterId: string | null;
  limit: number;
};

type CandidateScanResult<T> = {
  candidates: T[];
  candidatesScanned: number;
  candidateTruncated: boolean;
};

type DueClassification = {
  eligible: EligibleReminderCandidate[];
  futureSkipped: number;
  newlyPastSkipped: number;
  graceExpiredSkipped: number;
  invalidSkipped: number;
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function hasValidAuthorization(authorization: string | null, expectedSecret: string) {
  return expectedSecret.length > 0 && authorization === `Bearer ${expectedSecret}`;
}

export async function handleSendRemindersRequest(
  request: Request,
  {
    expectedSecret,
    run,
    now = () => new Date(),
    monotonicNow = () => performance.now(),
  }: RequestHandlerOptions,
) {
  if (!hasValidAuthorization(request.headers.get('Authorization'), expectedSecret)) {
    return jsonResponse({ status: 'unauthorized' }, 401);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ status: 'method_not_allowed' }, 405);
  }

  const runNow = now();
  const startedAt = monotonicNow();

  try {
    const diagnostics = await run({ runNow, startedAt, monotonicNow });
    return jsonResponse(diagnostics, diagnostics.status === 'candidate_limit_exceeded' ? 409 : 200);
  } catch {
    return jsonResponse({ status: 'error' }, 500);
  }
}

function assertStableCandidatePage<T extends { id: string }>(
  page: T[],
  afterId: string | null,
  limit: number,
) {
  if (page.length > limit) {
    throw new Error('Candidate page exceeded the requested limit.');
  }

  let previousId = afterId;
  for (const event of page) {
    if (previousId !== null && event.id <= previousId) {
      throw new Error('Candidate page is not strictly ordered by id.');
    }
    previousId = event.id;
  }
}

export async function scanReminderCandidates<T extends { id: string }>(
  fetchPage: (request: CandidatePageRequest) => Promise<T[]>,
  maximum = MAX_CANDIDATES,
): Promise<CandidateScanResult<T>> {
  const candidates: T[] = [];
  let afterId: string | null = null;

  while (candidates.length < maximum) {
    const limit = Math.min(CANDIDATE_PAGE_SIZE, maximum - candidates.length);
    const page = await fetchPage({ afterId, limit });
    assertStableCandidatePage(page, afterId, limit);
    candidates.push(...page);

    if (page.length < limit) {
      return {
        candidates,
        candidatesScanned: candidates.length,
        candidateTruncated: false,
      };
    }

    afterId = page.at(-1)?.id ?? afterId;
  }

  const probe = await fetchPage({ afterId, limit: 1 });
  assertStableCandidatePage(probe, afterId, 1);
  return {
    candidates,
    candidatesScanned: candidates.length + (probe.length > 0 ? 1 : 0),
    candidateTruncated: probe.length > 0,
  };
}

function markerHasSubMillisecondRemainder(rawMarker: string) {
  const match = rawMarker.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/i);
  return match ? /[1-9]/.test(match[1].slice(3)) : false;
}

function dueIsBeforeMarker(dueAt: Date, rawMarker: string) {
  const markerMilliseconds = Date.parse(rawMarker);
  if (Number.isNaN(markerMilliseconds)) {
    return null;
  }

  if (dueAt.getTime() !== markerMilliseconds) {
    return dueAt.getTime() < markerMilliseconds;
  }

  return markerHasSubMillisecondRemainder(rawMarker);
}

function subMillisecondDigits(rawMarker: string) {
  const match = rawMarker.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/i);
  return (match?.[1] ?? '').padEnd(9, '0').slice(3, 9);
}

function laterRawTimestamp(left: string, right: string) {
  const leftMilliseconds = Date.parse(left);
  const rightMilliseconds = Date.parse(right);
  if (leftMilliseconds !== rightMilliseconds) {
    return leftMilliseconds > rightMilliseconds ? left : right;
  }
  return subMillisecondDigits(left) >= subMillisecondDigits(right) ? left : right;
}

function effectiveScheduleChangedAt(recurrence: RecurringReminderSnapshot) {
  if (!recurrence.exceptionChangesSchedule || recurrence.exceptionUpdatedAt === null) {
    return recurrence.sourceReminderScheduleChangedAt;
  }
  return laterRawTimestamp(
    recurrence.sourceReminderScheduleChangedAt,
    recurrence.exceptionUpdatedAt,
  );
}

export function classifyReminderCandidates(
  candidates: ProjectedReminderCandidate[],
  runNow: Date,
): DueClassification {
  const classification: DueClassification = {
    eligible: [],
    futureSkipped: 0,
    newlyPastSkipped: 0,
    graceExpiredSkipped: 0,
    invalidSkipped: 0,
  };

  for (const event of candidates) {
    const due = calculateReminderDue({
      startsAt: event.starts_at,
      allDay: event.all_day,
      reminderKind: event.reminder_kind,
      timeZone: event.time_zone,
    });
    if (due.status !== 'scheduled') {
      classification.invalidSkipped += 1;
      continue;
    }

    const scheduleMarkers = [event.reminder_schedule_changed_at];
    if (
      'recurrence' in event
      && event.recurrence.exceptionChangesSchedule
      && event.recurrence.exceptionUpdatedAt !== null
    ) {
      scheduleMarkers.push(event.recurrence.exceptionUpdatedAt);
    }
    const markerChecks = scheduleMarkers.map((marker) => dueIsBeforeMarker(due.dueAt, marker));
    if (markerChecks.some((check) => check === null)) {
      classification.invalidSkipped += 1;
      continue;
    }
    if (markerChecks.some(Boolean)) {
      classification.newlyPastSkipped += 1;
      continue;
    }

    if (due.dueAt.getTime() > runNow.getTime()) {
      classification.futureSkipped += 1;
      continue;
    }
    if (runNow.getTime() - due.dueAt.getTime() > GRACE_WINDOW_MS) {
      classification.graceExpiredSkipped += 1;
      continue;
    }

    classification.eligible.push({
      event,
      dueAt: due.dueAt,
      rawReminderScheduleChangedAt: event.reminder_schedule_changed_at,
    });
  }

  return classification;
}

export async function createReminderTag(eventId: string, dueAt: Date, occurrenceDate: string | null = null) {
  const input = occurrenceDate === null
    ? `${eventId}\n${dueAt.toISOString()}`
    : `${eventId}\n${occurrenceDate}\n${dueAt.toISOString()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return `reminder-v1-${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

function activeSubscription(
  subscription: ReminderSubscription,
  runNow: Date,
) {
  if (subscription.disabled_at !== null) {
    return false;
  }
  if (subscription.expiration_time === null) {
    return true;
  }

  const expirationMilliseconds = Date.parse(subscription.expiration_time);
  return !Number.isNaN(expirationMilliseconds) && expirationMilliseconds > runNow.getTime();
}

type RecipientPair = {
  candidate: EligibleReminderCandidate;
  userId: string;
};

function recipientPairsFor(
  eligible: EligibleReminderCandidate[],
  memberships: SpaceMembership[],
) {
  const membersBySpace = new Map<string, Set<string>>();
  for (const membership of memberships) {
    const members = membersBySpace.get(membership.space_id) ?? new Set<string>();
    members.add(membership.user_id);
    membersBySpace.set(membership.space_id, members);
  }

  const recipientPairs: RecipientPair[] = [];
  for (const candidate of eligible) {
    const currentMembers = membersBySpace.get(candidate.event.space_id) ?? new Set<string>();
    if (candidate.event.scope === 'personal') {
      const ownerId = candidate.event.owner_user_id;
      if (ownerId !== null && currentMembers.has(ownerId)) {
        recipientPairs.push({ candidate, userId: ownerId });
      }
      continue;
    }

    for (const userId of currentMembers) {
      recipientPairs.push({ candidate, userId });
    }
  }

  return recipientPairs;
}

export function createDeliveryTasks(
  eligible: EligibleReminderCandidate[],
  memberships: SpaceMembership[],
  subscriptions: ReminderSubscription[],
  runNow: Date,
) {
  const recipientPairs = recipientPairsFor(eligible, memberships);

  const recipientUserIds = new Set(recipientPairs.map((pair) => pair.userId));
  const activeSubscriptionIds = new Set<string>();
  const activeSubscriptions = subscriptions.filter((subscription) => {
    if (
      !recipientUserIds.has(subscription.user_id)
      || !activeSubscription(subscription, runNow)
      || activeSubscriptionIds.has(subscription.id)
    ) {
      return false;
    }
    activeSubscriptionIds.add(subscription.id);
    return true;
  });
  const subscriptionsByUser = new Map<string, ReminderSubscription[]>();
  for (const subscription of activeSubscriptions) {
    const userSubscriptions = subscriptionsByUser.get(subscription.user_id) ?? [];
    userSubscriptions.push(subscription);
    subscriptionsByUser.set(subscription.user_id, userSubscriptions);
  }

  const tasks: DeliveryTask[] = [];
  for (const pair of recipientPairs) {
    for (const subscription of subscriptionsByUser.get(pair.userId) ?? []) {
      tasks.push({
        eventId: pair.candidate.event.id,
        eventTitle: pair.candidate.event.title,
        recipientUserId: pair.userId,
        subscription,
        dueAt: pair.candidate.dueAt,
        rawReminderScheduleChangedAt: pair.candidate.rawReminderScheduleChangedAt,
        recurrence: 'recurrence' in pair.candidate.event ? pair.candidate.event.recurrence : null,
      });
    }
  }

  return {
    recipients: recipientPairs.length,
    activeSubscriptions: activeSubscriptions.length,
    tasks,
  };
}

function compareStrings(left: string, right: string) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareDeliveryTasks(left: DeliveryTask, right: DeliveryTask) {
  return left.dueAt.getTime() - right.dueAt.getTime()
    || compareStrings(left.eventId, right.eventId)
    || compareStrings(left.recurrence?.occurrenceDate ?? '', right.recurrence?.occurrenceDate ?? '')
    || compareStrings(left.recipientUserId, right.recipientUserId)
    || compareStrings(left.subscription.id, right.subscription.id);
}

export function selectDeliveryTasks(tasks: DeliveryTask[]) {
  const ordered = [...tasks].sort(compareDeliveryTasks);
  return {
    selected: ordered.slice(0, MAX_DELIVERY_TASKS),
    overflow: Math.max(0, ordered.length - MAX_DELIVERY_TASKS),
  };
}

export function ledgerResultForSenderResult(
  result: WebPushDeliveryResult,
): LedgerFinalResult {
  switch (result.classification) {
    case 'delivered':
      return { status: 'sent', resultCode: 'delivered', providerStatus: result.status };
    case 'subscription_gone':
      return { status: 'failed', resultCode: 'subscription_gone', providerStatus: result.status };
    case 'provider_rejected':
      return { status: 'failed', resultCode: 'provider_rejected', providerStatus: result.status };
    case 'network_timeout':
      return { status: 'failed', resultCode: 'network_timeout', providerStatus: null };
    case 'network_error':
      return { status: 'failed', resultCode: 'network_error', providerStatus: null };
    case 'invalid_sender_result':
      return {
        status: 'failed',
        resultCode: 'invalid_sender_result',
        providerStatus: result.status ?? null,
      };
  }
}

function emptyDiagnostics(): SendRemindersDiagnostics {
  return {
    status: 'completed',
    candidates_scanned: 0,
    candidate_truncated: false,
    due_eligible: 0,
    future_skipped: 0,
    newly_past_skipped: 0,
    grace_expired_skipped: 0,
    invalid_skipped: 0,
    recipients: 0,
    active_subscriptions: 0,
    delivery_tasks: 0,
    selected_delivery_tasks: 0,
    overflow_delivery_tasks: 0,
    claim_rejected: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    gone_disabled: 0,
    disable_failures: 0,
    finalize_failures: 0,
    unexpected_task_errors: 0,
    runtime_deferred: 0,
    runtime_stop_reason: null,
    elapsed_ms: 0,
  };
}

function finishDiagnostics(
  diagnostics: SendRemindersDiagnostics,
  context: RunContext,
) {
  diagnostics.elapsed_ms = Math.max(0, Math.round(context.monotonicNow() - context.startedAt));
  return diagnostics;
}

async function processDeliveryTask(
  task: DeliveryTask,
  tag: string,
  dependencies: RunSendRemindersDependencies,
  diagnostics: SendRemindersDiagnostics,
) {
  let deliveryId: string | null;
  try {
    deliveryId = task.recurrence === null
      ? await dependencies.claim({
        eventId: task.eventId,
        recipientUserId: task.recipientUserId,
        subscriptionId: task.subscription.id,
        dueAt: task.dueAt.toISOString(),
        expectedReminderScheduleChangedAt: task.rawReminderScheduleChangedAt,
      })
      : await dependencies.claimRecurring({
        sourceEventId: task.eventId,
        logicalSeriesId: task.recurrence.logicalSeriesId,
        occurrenceDate: task.recurrence.occurrenceDate,
        recipientUserId: task.recipientUserId,
        subscriptionId: task.subscription.id,
        dueAt: task.dueAt.toISOString(),
        expectedSourceUpdatedAt: task.recurrence.sourceUpdatedAt,
        expectedReminderScheduleChangedAt: task.recurrence.sourceReminderScheduleChangedAt,
        expectedExceptionId: task.recurrence.exceptionId,
        expectedExceptionUpdatedAt: task.recurrence.exceptionUpdatedAt,
        expectedExceptionType: task.recurrence.exceptionType,
        effectiveScheduleChangedAt: effectiveScheduleChangedAt(task.recurrence),
      });
  } catch {
    diagnostics.unexpected_task_errors += 1;
    return;
  }

  if (deliveryId === null) {
    diagnostics.claim_rejected += 1;
    return;
  }
  diagnostics.claimed += 1;

  let finalResult: LedgerFinalResult;
  try {
    const senderResult = await dependencies.send(task.subscription, {
      title: '共享日历',
      body: task.eventTitle,
      url: '/',
      tag,
    });
    finalResult = ledgerResultForSenderResult(senderResult);

    if (senderResult.classification === 'subscription_gone') {
      try {
        if (await dependencies.disableSubscription(task.subscription.id)) {
          diagnostics.gone_disabled += 1;
        } else {
          diagnostics.disable_failures += 1;
        }
      } catch {
        diagnostics.disable_failures += 1;
      }
    }
  } catch {
    diagnostics.unexpected_task_errors += 1;
    finalResult = {
      status: 'failed',
      resultCode: 'unexpected_task_error',
      providerStatus: null,
    };
  }

  if (finalResult.status === 'sent') {
    diagnostics.sent += 1;
  } else {
    diagnostics.failed += 1;
  }

  try {
    const finalizedRows = await dependencies.finalize({ deliveryId, ...finalResult });
    if (finalizedRows !== 1) {
      diagnostics.finalize_failures += 1;
    }
  } catch {
    diagnostics.finalize_failures += 1;
  }
}

export async function runSendReminders(
  context: RunContext,
  dependencies: RunSendRemindersDependencies,
) {
  const diagnostics = emptyDiagnostics();
  const [scan, recurringSourceScan] = await Promise.all([
    scanReminderCandidates(dependencies.fetchCandidatePage),
    scanReminderCandidates(dependencies.fetchRecurringCandidatePage, MAX_RECURRING_SOURCES),
  ]);
  diagnostics.candidates_scanned = scan.candidatesScanned + recurringSourceScan.candidatesScanned;
  diagnostics.candidate_truncated = scan.candidateTruncated || recurringSourceScan.candidateTruncated;

  if (diagnostics.candidate_truncated) {
    diagnostics.status = 'candidate_limit_exceeded';
    return finishDiagnostics(diagnostics, context);
  }

  let recurringCandidates: RecurringReminderCandidate[] = [];
  if (recurringSourceScan.candidates.length > 0) {
    const exceptionScan = await dependencies.fetchRecurringExceptions(
      recurringSourceScan.candidates.map((source) => source.id),
    );
    if (exceptionScan.exceptionTruncated || exceptionScan.exceptionsScanned > MAX_RECURRING_EXCEPTIONS) {
      diagnostics.status = 'candidate_limit_exceeded';
      diagnostics.candidate_truncated = true;
      return finishDiagnostics(diagnostics, context);
    }

    const recurringProjection = projectRecurringReminderCandidates(
      recurringSourceScan.candidates,
      exceptionScan.exceptions,
      context.runNow,
    );
    if (recurringProjection.errors.length > 0) {
      throw new Error('Recurring Reminder projection failed.');
    }
    recurringCandidates = recurringProjection.candidates;
  }

  const due = classifyReminderCandidates([...scan.candidates, ...recurringCandidates], context.runNow);
  diagnostics.due_eligible = due.eligible.length;
  diagnostics.future_skipped = due.futureSkipped;
  diagnostics.newly_past_skipped = due.newlyPastSkipped;
  diagnostics.grace_expired_skipped = due.graceExpiredSkipped;
  diagnostics.invalid_skipped = due.invalidSkipped;

  if (due.eligible.length === 0) {
    return finishDiagnostics(diagnostics, context);
  }

  const spaceIds = [...new Set(due.eligible.map((candidate) => candidate.event.space_id))];
  const memberships = await dependencies.fetchMemberships(spaceIds);
  const recipientPairs = recipientPairsFor(due.eligible, memberships);
  diagnostics.recipients = recipientPairs.length;

  if (recipientPairs.length === 0) {
    return finishDiagnostics(diagnostics, context);
  }

  const recipientUserIds = [...new Set(recipientPairs.map((pair) => pair.userId))];
  const subscriptions = await dependencies.fetchSubscriptions(recipientUserIds, context.runNow);
  const delivery = createDeliveryTasks(due.eligible, memberships, subscriptions, context.runNow);
  diagnostics.active_subscriptions = delivery.activeSubscriptions;
  diagnostics.delivery_tasks = delivery.tasks.length;

  const selection = selectDeliveryTasks(delivery.tasks);
  diagnostics.selected_delivery_tasks = selection.selected.length;
  diagnostics.overflow_delivery_tasks = selection.overflow;

  let cursor = 0;
  let runtimeStopped = false;
  let reservedDeferred = 0;
  const worker = async () => {
    while (cursor < selection.selected.length && !runtimeStopped) {
      if (context.monotonicNow() - context.startedAt >= CLAIM_ACQUISITION_CUTOFF_MS) {
        runtimeStopped = true;
        break;
      }

      const task = selection.selected[cursor];
      cursor += 1;

      let tag: string;
      try {
        tag = await createReminderTag(
          task.recurrence?.logicalSeriesId ?? task.eventId,
          task.dueAt,
          task.recurrence?.occurrenceDate ?? null,
        );
      } catch {
        diagnostics.unexpected_task_errors += 1;
        continue;
      }

      if (
        runtimeStopped
        || context.monotonicNow() - context.startedAt >= CLAIM_ACQUISITION_CUTOFF_MS
      ) {
        runtimeStopped = true;
        reservedDeferred += 1;
        break;
      }

      await processDeliveryTask(task, tag, dependencies, diagnostics);
    }
  };

  const workerCount = Math.min(PUSH_CONCURRENCY, selection.selected.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (runtimeStopped) {
    diagnostics.runtime_deferred = reservedDeferred + selection.selected.length - cursor;
    diagnostics.runtime_stop_reason = 'claim_acquisition_cutoff';
  }

  return finishDiagnostics(diagnostics, context);
}
