# Backlog

## P0 - Blocking Verification or Core Use

- Investigate any Magic Link, RLS, Realtime, or Production deployment regression that blocks the two-person calendar flow.

## Non-Blocking Validation Follow-up

- Complete two-session Email OTP recurrence Realtime and supported-browser DST-zone coverage; this is not a v0.1.8 product-line blocker.

## Latest Completed Product Slice

### v0.1.9 — Shared Tasks MVP

Status: `CLOSED / PASS`. Slice 1/2/3 均 CLOSED / PASS；Production backend applied/postflight verified、Vercel frontend deployed/accepted、Desktop A/B Production acceptance PASS、iPhone Production smoke PASS。v0.1.9 remains a closed historical milestone; later Production state is recorded under v0.1.10 and v0.1.11 below. 详细范围和历史切片见下方 Current Frozen Product Scope。

### v0.1.8 — Mobile Push Reminder

Status: `v0.1.8 — Mobile Push Reminder` is `CLOSED / PASS`. Slice 1, ordinary Reminder Slice A/B/C, Slice 3 Recurrence Reminder Integration, and final cross-platform acceptance are complete. Mac/iPhone Production acceptance passed; Android Studio Emulator subscription, test Push, ordinary automatic Reminder, sound, and notification-shade delivery passed. Physical Android heads-up presentation was not validated and is non-blocking. v0.1.9 is the later accepted Production capability.

In scope:

- One event-level optional reminder stored as nullable `events.reminder_kind`; the earlier `events.reminder_offset_minutes` proposal is superseded.
- Fixed kinds: `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder.
- Nullable canonical IANA `events.time_zone`, automatically detected for new events from the creating browser/PWA and never silently changed merely because a device later changes timezone.
- UI-only new-event defaults: timed `timed_10m_before`; all-day `all_day_same_day_08`. Database default and every historical Event remain `null`; historical ordinary timezone is not guessed or bulk-backfilled.
- Timed previous-day reminders preserve Event-local wall-clock time through the canonical recurrence DST semantics. All-day reminders use effective Event date plus canonical timezone; multi-day reminders anchor only to the start.
- Standards-based Web Push system notifications for Desktop and installed iPhone/Android PWAs.
- `push_subscriptions` bound to `user + installation`, with multiple simultaneous device/browser subscriptions and no Space binding.
- `reminder_deliveries` with due-time-aware idempotency and delivery lifecycle state.
- shared event recipients resolved from current active Space membership at send time; personal event recipients limited to `owner_user_id`.
- Reminder UI copy states that a shared Event reminder notifies current Space members.
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

1. **Push Infrastructure Foundation — CLOSED / PASS:** Push-only Service Worker, explicit permission flow, `user + installation` subscription persistence, multi-device lifecycle, logout/invalid-subscription handling, and an authenticated current-installation test-push path are implemented. Desktop Chrome/macOS and iPhone installed PWA validation passed. Android Studio Emulator permission/subscription and test Push passed; physical-device heads-up presentation was not validated. The initial Desktop subscription was abnormal/stale despite FCM `201`; unsubscribe/resubscribe restored delivery. This slice does not implement scheduler, event reminder persistence, or recurrence delivery.
2. **Reminder Persistence + Ordinary Event Delivery — CLOSED / PASS:** Slice A/B/C, Production foundation, manual E2E, and automatic once-per-minute scheduler E2E are complete.
3. **Recurrence Integration — CLOSED / PASS:** canonical bounded occurrence projection, override/delete/split/current-and-future semantics, Reminder/timezone inheritance, all-day/timezone/DST coverage, stale projection rejection, and recurrence-aware no-duplicate identity are deployed and accepted in Production. The bounded long-duration correction preserved the canonical recurrence engine. Normal recurring delivery, only-this override and delete, this-and-future split, scheduler health, and ordinary Reminder regression all passed without duplicate or stuck claims.
4. **Final Cross-Platform / Android Acceptance — CLOSED / PASS:** Mac and iPhone Production Push / automatic Reminder passed. Android Studio Emulator subscription, `send-test-push`, ordinary automatic Reminder, sound, and notification-shade delivery passed. Heads-up presentation was not observed or validated on physical Android hardware; this is non-blocking. The supplied evidence does not independently establish notification-click PASS, so none is claimed.

Idempotency freeze:

- Recurring: `(logical_series_id, occurrence_date, subscription_id, due_at)`.
- One-off: `(event_id, NULL occurrence_date, subscription_id, due_at)`; `NULLS NOT DISTINCT` preserves the former ordinary identity behavior.
- `due_at` is derived from effective start/date, `reminder_kind`, and canonical Event timezone. A changed effective start/date or preset may create a new legitimate delivery; unchanged `due_at` must not duplicate, including across a future split.

Future compatibility:

- Push Subscription persistence intentionally does not contain `space_id`. A future user may reuse one device subscription across Family, Travel, Friends, or other Spaces; deliveries continue to resolve recipients from `event.space_id` and current membership at send time.
- v0.1.8 does not implement multi-space.

## Current Frozen Product Scope

### v0.1.9 — Shared Tasks MVP

Status: `CLOSED / PASS; SLICE 1/2/3 CLOSED / PASS`. Production backend applied/verified, Vercel frontend deployed/accepted, Desktop A/B Production acceptance PASS, and iPhone Production smoke PASS. v0.1.9 is the latest accepted user-facing Production capability. Canonical Task scope: [v0.1.9 Shared Tasks Spec](./v0.1.9_SHARED_TASKS_SPEC.md); long-term model: [Shared Life Architecture Freeze](./SHARED_LIFE_ARCHITECTURE.md).

In scope:

- One Space-scoped `tasks` product table with creator attribution, same-Space member/shared assignment, title, `open` / `completed`, optional date-only `due_on`, and timestamps.
- Collaborative household permissions: all current Space members can view, edit title/due date, reassign, and delete Tasks. Shared Tasks may be completed/reopened by any current member; assigned Tasks only by the current assignee, enforced by a corrective DB trigger against the old assignment. A takeover requires reassignment and status change in separate UPDATEs.
- Assigned-member departure converts the assignment to shared through the locally verified composite FK with column-specific `ON DELETE SET NULL (assigned_to_user_id)`.
- Existing Supabase/PostgREST CRUD and Space-filtered Realtime patterns.
- A minimum current-Space / Space Hub entry to Tasks, open Tasks and separate Completed history, create/edit/delete confirmation, complete/reopen, assignment, and optional due date. The former top-level `Calendar / Tasks` switch is superseded.
- Decision `MULTISPACE_NOT_REQUIRED_FOR_V019`; explicit `space_id` preserves future compatibility without implementing Multi-space.

Implementation slices:

1. **Task persistence and authorization — PRODUCTION APPLIED / POSTFLIGHT VERIFIED:** schema/incremental patch, constraints, assignment/member-leave semantics, immutable identity, RLS/grants, Realtime/replica identity, and focused database tests. Backend foundation is now present in Production.
2. **Current-Space Tasks CRUD, UI, and Realtime — IMPLEMENTED / MANUAL AUTH ACCEPTANCE PASS:** frontend Task model, bounded Space Hub, CRUD, assignee-owned completion/reopen, assignment, due date, deterministic grouping/order, and user-run two-session validation. The status-ownership corrective backend patch is applied/postflight verified in Production. Calendar header Space-entry discoverability and 320px navigation passed. No Personal Space, Multi-space, module enablement, full navigation, aggregation, or global create.
3. **Production acceptance and closeout — CLOSED / PASS:** the compatible frontend was deployed through Vercel; user-run Desktop A/B and iPhone Production acceptance passed.

Explicitly deferred:

- Task Reminder, recurring Tasks, subtasks, priority, tags, comments, attachments, analytics, custom ordering, Shared Lists semantics, Event generation, Multi-space implementation, and UI/UX overhaul.
- Task Archive and an `archive` status; Completed Tasks remain in a separate history section with reopen and delete.
- `completed_at`, `completed_by`, completion history, description, Task scope, and Task/Event dual persistence.

## v0.1.10 Foundation — CLOSED / PASS

Status: Slice 1 `PRODUCTION BACKEND ROLLOUT PASS`; Slice 2 `CLOSED / PASS`; Slice 3 `CLOSED / PASS`; v0.1.10 `CLOSED / PASS`. User-run authenticated Production acceptance passed for Personal / Shared module toggles, data retention, member refresh behavior, cross-Space isolation, and iPhone/PWA. Canonical scope is in [Shared Life Architecture Freeze](./SHARED_LIFE_ARCHITECTURE.md).

1. **Slice 1 — Data / permission foundation — PRODUCTION BACKEND ROLLOUT PASS:** `spaces.kind`, partial personal-owner uniqueness, sole-owner membership invariant, removal of user-wide membership uniqueness, Shared create/join compatibility and two-member capacity, `space_modules`, owner-only toggle RPC, and database Task mutation guard. Local regression, Production preflight, single patch application, immediate data/catalog/permission postflight, and PostgREST visibility passed. Personal Space count was 0 at postflight; no automatic creation or bulk backfill occurred while the old frontend remains the accepted UI.
2. **Slice 2 — Selected/current Space vertical flow — CLOSED / PASS:** deployed frontend rollout and user-run A/B authenticated Production acceptance passed. The compatible frontend calls idempotent `ensure_personal_space()` per user, lists/switches member Spaces, keeps an explicit membership-validated `selectedSpaceId`, and scopes Event/Task/member data plus Realtime to it. Existing Shared Space remains the first-upgrade default; Personal Space is the fallback when no Shared Space exists. Old requests/subscriptions are guarded during switching. Sheet-open Space switching was N/A because the modal prevents operating the selector; Shared ↔ Shared was N/A because no current acceptance account has two Shared Spaces. Neither is a failure; no extra Space was created.
3. **Slice 3 — Tasks module enablement + UI text closeout — CLOSED / PASS:** user-run authenticated Production acceptance passed. Owners can disable/re-enable Tasks per Space; disabled history is preserved and restored. Members have read-only module state. User-visible `Task / Tasks` wording is Chinese “任务”; internal identifiers remain unchanged. iPhone/PWA acceptance passed.

Known characteristic / future consideration: `space_modules` has no Realtime publication. Already-open Shared member pages may show the previous module state until refresh/re-entry; database policy immediately rejects disabled Task writes. Consider module-state Realtime / immediate cross-client UI refresh only if real usage shows a need. This is not a blocker and does not reopen v0.1.10.

No Event/Task identity, v0.1.9 Task authorization, v0.1.8 Reminder, recurrence, or Production capability is redesigned. Shared Space three-plus-member support, final four-destination navigation, cross-Space aggregation, global `+`, Calendar multi-Space overlay, Lists/Important Dates/Review implementation, External Calendar Sources, UI redesign, and Native App remain deferred to v0.1.11 or later.

## v0.1.11 Navigation + Aggregation Experience — IN PROGRESS / DESIGN FROZEN

Slice 1 Navigation Foundation is `CLOSED / PASS` after automated verification, final review, desktop authenticated acceptance, confirmed Production frontend rollout, and post-deploy iPhone Safari / installed PWA acceptance. The Production frontend shows `日历 / 空间 / 我的`. Slice 2 Aggregate Calendar is `CLOSED / PASS` after local implementation, automated verification, authenticated acceptance and user-run bounded Production smoke. Dedicated Slice 2 iPhone Safari, installed PWA and final 320px checks are `DEFERRED / NOT RUN`; second Shared Space coverage is `N/A / NOT RUN`. Overall v0.1.11 remains `IN PROGRESS`; Slices 3–4 have not started. The canonical scope and acceptance criteria are in [v0.1.11 Navigation + Aggregation Experience Specification](./v0.1.11_NAVIGATION_AGGREGATION_SPEC.md). Home remains reserved for Slice 3 aggregate semantics.

1. **Slice 1 — Navigation Foundation — CLOSED / PASS:** final shell, Space/Hub and My integration; no Event/Task aggregation, global create or user-visible Home until its final aggregate semantics exist.
2. **Slice 2 — Aggregate Calendar — CLOSED / PASS:** membership-visible Events, all/one-Space filter, Space/member attribution, recurrence/exceptions, complete reads, stale guards and bounded active-view Realtime. User-run bounded Production smoke passed for the deployed frontend, all/single create behavior, date navigation, Hub → Calendar filtering, rapid filter switching and A/B Realtime. No backend rollout was required. Dedicated device checks 11–13 are `DEFERRED / NOT RUN`; second Shared Space is `N/A / NOT RUN`.
3. **Slice 3 — Home Aggregation — NOT STARTED:** limited all-Space Event/attention-needed Task summaries, authoritative Tasks-module filtering and canonical item navigation; no dashboard framework.
4. **Slice 4 — Global Create Safety — NOT STARTED:** Event/Task-only `+`, explicit target, second confirmation, membership/module revalidation, zero-valid-Task-target and Personal initialization failure handling; reuse existing Sheets.

Deferred beyond v0.1.11: due Task Calendar projection, multi-select/saved Calendar filters, Shared 3+ members, Lists/Wishlist UI, Important Dates, Review, Memo, external sources/中国节假日, module-state Realtime, generalized device/settings UI, Native App and major redesign.

## Directional Roadmap — Shared Life Architecture Frozen

The long-term relationships and v0.1.10 scope are frozen in [Shared Life Architecture Freeze](./SHARED_LIFE_ARCHITECTURE.md). Later version rows remain directional and require their own scope review.

- v0.1.9 — Shared Tasks; Slice 1/2/3 CLOSED / PASS; Production backend and frontend accepted.
- v0.1.10 — Personal Space + Multi-space + Module Enablement Foundation; Slice 1 `PRODUCTION BACKEND ROLLOUT PASS`, Slice 2/3 and overall `CLOSED / PASS`.
- v0.1.11 — Navigation + Aggregation Experience (`IN PROGRESS / DESIGN FROZEN / SLICE 1 CLOSED / PASS / SLICE 2 CLOSED / PASS / Slices 3–4 NOT STARTED`; next: read-only Slice 3 Home Aggregation repository/design review against the frozen architecture).
- v0.1.12 — Shared Lists.
- v0.1.13 — Important Dates.
- v0.1.14 — Structured Review / Check-in.
- v0.1.15 — Calendar Sources v1.
- Future without a committed version: Memo, Photos / Memories, richer external Calendars, Task Archive, and other validated modules.
- Native: decision gate only; no committed implementation version.

## P1 - Near-Term Product Polish

- Continue event create/edit UX polish after the v0.1.3 default end-time improvement.
- Establish a simple backup and restore flow for Supabase data.
- Occasionally check that Vercel Cron invocations continue to return HTTP 200 and that Supabase remains Active.

## P2 - Product Extensions

- Deferred: do not add a `delete_logical_series` frontend entry point. The permission-checked backend RPC remains available for controlled operational use, but deleting an entire logical lineage is high-impact and needs a separately approved product/UX scope, including explicit copy and safeguards.
- Space member management and invitation experience improvements.
- Multi-space v0.1.10 scope is frozen above; do not bind Push Subscriptions to a Space.
- Reconsider `space_members.nickname` only after multi-space support creates a real per-space naming need.
- Add countdowns.

## P3 - Long-Term Directions

- Re-evaluate Supabase Pro if the project becomes a formal service that must stay online long term.
- Native iOS / Android app feasibility and distribution remain behind a decision gate, without an implementation version.
- Paid or account-tier model.
- External calendar import/export and richer Google, Apple/System, or CalDAV integration follow the Calendar Sources architecture but need separate scope.
- `Shared Life Space / 共享生活空间` is the frozen long-term architecture; the directional roadmap above does not by itself approve implementation.

## Completed and Deferred History

### v0.1.8.1

- Completed: Desktop Chrome/macOS permission, local notification, Service Worker notification, FCM acceptance, and final test push passed.
- Completed: iPhone installed PWA permission, subscription, test push, home-screen/background, and lock-screen delivery passed.
- Recovered browser state: the initial Desktop subscription accepted upstream delivery but did not display; unsubscribe/resubscribe restored delivery. Retry, unsubscribe/resubscribe, and browser/PWA restart are the first-line recovery steps for similar Push symptoms before deeper RCA.
- Deferred by validation strategy: Android installed PWA permission, subscription, foreground/background/closed-app delivery, notification click, and logout lifecycle move to final v0.1.8 cross-platform acceptance and do not block Slice 2.

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
