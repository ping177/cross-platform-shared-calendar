# Backlog

## P0 - Blocking Verification or Core Use

- Investigate any Magic Link, RLS, Realtime, or Production deployment regression that blocks the two-person calendar flow.

## Non-Blocking Validation Follow-up

- Complete two-session Email OTP recurrence Realtime and supported-browser DST-zone coverage; this is not a v0.1.8 product-line blocker.

## Next Approved Product Slice

### v0.1.8 — Mobile Push Reminder

Status: Slice 1 implemented in the repository; cloud and real-device validation pending.

In scope:

- One event-level optional reminder stored as nullable `events.reminder_offset_minutes`.
- Preset offsets: `0`, `10`, `30`, `60`, and `1440` minutes; `null` means no reminder.
- Standards-based Web Push system notifications for Desktop and installed iPhone/Android PWAs.
- `push_subscriptions` bound to `user + installation`, with multiple simultaneous device/browser subscriptions and no Space binding.
- `reminder_deliveries` with due-time-aware idempotency and delivery lifecycle state.
- shared event recipients resolved from current active Space membership at send time; personal event recipients limited to `owner_user_id`.
- Supabase Cron every minute, an Edge Function sender, and dynamic ordinary/recurring occurrence projection through the canonical recurrence semantics.
- Push-only Service Worker with no offline cache.
- Best-effort delivery with approximately one-minute normal target precision and a simple configurable late-delivery grace window of roughly ten minutes.

Explicitly out of scope:

- Email reminder delivery, SMS, and Bark.
- Multiple reminders or arbitrary custom-minute offsets.
- Per-user reminder preferences for the same shared event.
- Snooze, sound customization, and notification inbox/history.
- Native AlarmKit, AlarmManager, or other native alarm behavior.
- Queue, message broker, Redis, worker cluster, or another complex scheduler.
- Multi-space implementation.
- Shared Tasks, Shared Lists, Important Dates / Anniversaries, Tags / Color = Who, and UI/UX overhaul.
- Delete Logical Series UI.

Implementation slices:

1. **Push Infrastructure Foundation — IMPLEMENTED / VALIDATION PENDING:** Push-only Service Worker, explicit permission flow, `user + installation` subscription persistence, multi-device lifecycle, logout/invalid-subscription handling, and an authenticated current-installation test-push path are implemented. Supabase patch/secrets/function deployment, Vercel public-key deployment, and Desktop/iPhone/Android acceptance remain manual and pending. This slice does not implement scheduler, event reminder persistence, or recurrence delivery.
2. **Reminder Persistence + Ordinary Event Delivery:** `events.reminder_offset_minutes`, fixed options, current-recipient resolution, Cron + Edge Function sender, delivery ledger, due-time-aware idempotency, and ordinary shared/personal event delivery.
3. **Recurrence Integration:** canonical dynamic occurrence projection, override/delete/split/current-and-future semantics, reminder inheritance, timezone/DST coverage, stale-delivery cancellation, and no-duplicate regression coverage.
4. **Production Validation + Canonical Closeout:** Production Desktop, iPhone installed PWA, and Android installed PWA acceptance; late-delivery and subscription lifecycle evidence; final canonical docs closeout.

Idempotency freeze:

- Recurring: `(logical_series_id, occurrence_key, subscription_id, due_at)`.
- One-off: `(event_id, "once", subscription_id, due_at)`.
- `due_at` is the canonical projected occurrence start minus reminder offset. A changed start or offset may create a new legitimate delivery; unchanged `due_at` must not duplicate, including across a future split.

Future compatibility:

- Push Subscription persistence intentionally does not contain `space_id`. A future user may reuse one device subscription across Family, Travel, Friends, or other Spaces; deliveries continue to resolve recipients from `event.space_id` and current membership at send time.
- v0.1.8 does not implement multi-space.

## Directional Roadmap — Architecture Not Frozen

- v0.1.9 — Shared Tasks.
- v0.1.10 — Shared Lists.
- v0.1.11 — Important Dates / Anniversaries.
- v0.1.12 — Tags / Color = Who.
- UI/UX overhaul remains deferred until a Design System is defined.
- These versions are roadmap directions only. Their product scope and architecture require separate review and approval.

## P1 - Near-Term Product Polish

- Continue event create/edit UX polish after the v0.1.3 default end-time improvement.
- Establish a simple backup and restore flow for Supabase data.
- Occasionally check that Vercel Cron invocations continue to return HTTP 200 and that Supabase remains Active.

## P2 - Product Extensions

- Deferred: do not add a `delete_logical_series` frontend entry point. The permission-checked backend RPC remains available for controlled operational use, but deleting an entire logical lineage is high-impact and needs a separately approved product/UX scope, including explicit copy and safeguards.
- Space member management and invitation experience improvements.
- Evaluate multi-member or multi-space expansion beyond the current two-person v0.1 model; do not bind Push Subscriptions to a Space if this direction is later approved.
- Reconsider `space_members.nickname` only after multi-space support creates a real per-space naming need.
- Add countdowns.

## P3 - Long-Term Directions

- Re-evaluate Supabase Pro if the project becomes a formal service that must stay online long term.
- Native iOS / Android apps.
- App Store / Play Store distribution.
- Paid or account-tier model.
- External calendar import/export.
- External calendar sync options such as Apple Calendar, Google Calendar, or CalDAV.
- `Shared Life Space / 共享生活空间` remains the long-term product vision; the directional roadmap above does not by itself approve implementation.

## Completed and Deferred History

### v0.1.7.3.3.2

- Completed: Production recurrence scope UI supports 「仅修改当前事件 / 修改当前及未来事件 / 仅删除当前事件 / 删除当前及未来事件」.
- Completed: final Production recurrence smoke passed on Desktop and iPhone Standalone PWA.
- Deferred by product decision: `delete_logical_series` remains a backend RPC with no UI entry point, because whole-lineage deletion is high-impact and needs a separately approved safeguard/UX slice.
- Known platform behavior: iOS Standalone PWA cannot actively refresh itself; this iOS system limitation is not a project defect.

### v0.1-smoke-test

- Completed: real Supabase integration testing for the available v0.1 scope.
- Completed: two-user end-to-end flow, RLS/RPC checks, and Realtime checks across browser sessions.
- Completed: authenticated Android CRUD, Realtime, and PWA compatibility testing on Xiaomi 14 / Android 16 / Chrome.

### v0.1.1

- Completed: restrict personal event updates/deletes to `owner_user_id`.
- Completed: show non-owner personal events as read-only details.
- Completed: desktop two-account UI, RLS, direct API, trigger, and Realtime regression tests.
- Completed: deferred Android Magic Link and authenticated CRUD testing in the later Android compatibility smoke pass.

### v0.1.2

- Completed: deploy the current app to a stable Vercel HTTPS Production URL.
- Completed: configure the Production Site URL and allowed Redirect URLs in Supabase Auth.
- Completed: verify desktop User A Magic Link, session restoration, shared/personal CRUD, and same-account two-window Realtime in Production.
- Completed: verify Production manifest/icons and logged-out iPhone Safari add-to-home-screen behavior.
- Completed: verify User B Production Magic Link login.
- Completed: verify two-account Production shared Realtime create/update/delete.
- Completed: verify two-account Production personal-event owner/read-only permissions and Realtime propagation.
- Completed: verify authenticated iPhone User B Production login, mobile layout, shared CRUD, and desktop Realtime propagation.
- Completed: deferred authenticated Android CRUD, Realtime, and PWA compatibility testing in the later Android compatibility smoke pass.

### v0.1.3

- Completed: new event drafts prefill the end time as start time plus 1 hour for shared and personal events.
- Completed: new event end time follows start time changes until the user manually edits the end time.
- Completed: editing existing events preserves the stored end time instead of resetting it to a default.
- Completed: all-day compatibility keeps unedited new all-day event `ends_at` values null while preserving manually edited end values.
- Completed: implemented a minimal Supabase Free keep-alive using daily Vercel Cron and a CRON_SECRET-protected read-only Function.
- Completed: verified the Cron Job registration, unauthorized 401 response, and first scheduled Production invocation returning HTTP 200.

### v0.1.4

- Completed: global `profiles.display_name`, a compact member list, self-service name editing, and concrete personal-event owner labels.
- Completed: Production Supabase patch plus constraint, trigger, and unchanged-RLS verification; local and deployed two-account desktop member/permission/Realtime smoke.
- Completed: Production iPhone Safari browser smoke and Android Chrome/PWA smoke, including member labels, owner permissions, shared/personal CRUD, narrow layout, keyboard behavior, and events Realtime.
- Deferred: safe single-member-space and newly created-account first-login verification.
- Known limitation: iOS standalone PWA Magic Links return to Safari because storage is isolated; Android PWA Magic Links complete from browser Gmail but not from the Gmail native App. This is not addressed by v0.1.4.

### v0.1.5

- Completed repository implementation: Email OTP replaces Magic Link login so users enter an 8-digit code in their current browser or PWA container.
- Completed local acceptance: SMTP/template configuration plus existing-user and new-user OTP login, new-user space creation, member display-name update, and existing-session regression.
- Pending: desktop and mobile browser/PWA manual acceptance.
