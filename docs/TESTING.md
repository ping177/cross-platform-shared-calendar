# Testing

## Filesystem Persistence Boundary

- Tests that exercise filesystem persistence must use temporary directories or injected paths.
- Ordinary tests must not write the real `/Users/wp/Projects/_project-data/cross-system-shared-calendar/` root.
- This project currently has no filesystem-level persistent business data; Supabase remains the canonical cloud persistence and is not mirrored locally for filesystem governance.

## Project State Push Gate

运行独立 gate 集成测试：

```bash
node --test tests/project-state-push-gate.test.js
```

测试使用临时 Git repository、bare remote、临时 Git identity 与临时
`GIT_CONFIG_GLOBAL`（并设置 `GIT_CONFIG_NOSYSTEM=1`），只用本地路径且不访问网络。
覆盖 branch 的 `updated` / `verified-current` 分类、PROJECT_STATE 增改删、trailer
边界、首次与 force push、branch/tag 删除、lightweight / annotated / non-commit tag、
多 ref、tip 冲突、remote OID 缺失、真实 bare remote pre-push 接线、安装脚本首次安装/
幂等/冲突拒绝，以及含空格或非 ASCII 的路径。

Gate 实现还包含 forward-only version governance：对 branch push，只检查相对远端新增到
`Current version` 或 `Version Index` 的正式版本 token，并要求其为纯数字 canonical
version（例如 `v0.8`、`v0.8.2`、`v0.6.6.1`）。既有 legacy token 不做回溯验证；tag
不做 PROJECT_STATE tree 或 version-diff 分类。

Gate 语法检查：

```bash
sh -n .githooks/pre-push
sh -n scripts/check-project-state-push.sh
sh -n scripts/install-git-hooks.sh
```

Gate 检查新正式版本 token 的 forward-only canonical 格式，并检查最终 branch tip 的
trailer 是否与 PROJECT_STATE tree diff 一致；tag 只验证目标 commit 的合法 trailer。
`git push --no-verify` 可以绕过本地 hook；gate 不判断状态内容真实性，不会自动 commit
或 push，也不替代用户明确授权。

## v0.1.8 Mobile Push Reminder Acceptance Plan

Status: Slice 1 is `CLOSED / PASS — Android final acceptance deferred`. Automated verification plus real Desktop Chrome/macOS and iPhone installed PWA Push Infrastructure acceptance passed. Slice 2 architecture / semantics are frozen. Slice A and Slice B are closed. Slice C1 completed implementation, verification, human review, and push but is not in Production. Slice C2 Phase 1 shared sender extraction is `CLOSED / PASS`: automated verification plus Desktop Chrome/macOS and iPhone installed PWA real-device regression passed after deploying only `send-test-push`. Repeated Desktop banners are pre-existing fixed-tag behavior and non-blocking. `send-reminders`, candidate scan, Cron, secrets, and Production rollout have not started, and Slice C overall remains open.

### Slice 2C2 Phase 1 — Shared Web Push Sender Extraction

Local implementation verification on 2026-09-21:

- Confirmed RED before production refactoring because `supabase/functions/_shared/web-push.ts` did not exist and the new source-contract assertions could not read it.
- Passed `node --test tests/web-push.test.ts tests/send-test-push.test.ts tests/send-test-push-source.test.ts` (29/29). Coverage includes 2xx, 404, 410, provider rejection, timeout, network failure, invalid sender results, allowed/disallowed endpoints, VAPID loading, TTL 60, timeout 10000 ms, normal urgency, hostname/status-only diagnostics, no sensitive result leakage, shared-module usage, preserved CORS/auth/installation/fixed-payload/disable/response contracts, exact package pinning, and exclusion from the browser tsconfig/root package.
- Passed the complete repository suite: `node --test tests/*.test.ts tests/*.test.js` (123/123).
- Passed `deno check --no-lock --node-modules-dir=none supabase/functions/_shared/web-push.ts` and `deno check --no-lock --node-modules-dir=none --config supabase/functions/send-test-push/deno.json supabase/functions/send-test-push/index.ts`, using the Deno global cache for already-pinned function dependencies and adding no root dependency or lockfile.
- Passed `npm run build` and `git diff --check`.
- Passed required real-device regression after deploying only `send-test-push`: Desktop Chrome/macOS and iPhone installed PWA actual notification, unchanged safe diagnostics, correct title/body, and unchanged notification-click behavior. Desktop repeated-banner behavior was separately classified as pre-existing fixed-tag behavior and is non-blocking.
- Scope audit: no `send-reminders`, candidate scan, delivery ledger/claim, Cron, secret, Vault, database, or Service Worker change. Only `send-test-push` was deployed; commit/push closeout remains separate.

### Slice 2C1 — Minimal Delivery Ledger + Atomic Claim

Local implementation verification on 2026-09-21:

- Confirmed TDD RED from `supabase/tests/2026-09-20-v0.1.8.2-reminder-delivery.test.sql` before implementation because `public.reminder_deliveries` and `claim_reminder_delivery(...)` did not exist.
- Passed the final C1 pgTAP contract 63/63. Coverage includes the exact ledger fields and `smallint` provider status, minimum constraints, no audit foreign keys, RLS/ACL/Realtime/function privileges, first/duplicate claim, all frozen eligibility rejections, exact marker matching, valid grace, and audit survival after Event/subscription deletion or disablement.
- Passed a real local concurrency probe with four PostgreSQL sessions calling the identical claim after the same synchronization delay: exactly one call returned a UUID and the final ledger count was one. The fixed-UUID test fixture was removed afterward. No `dblink`, extension, or dependency was added.
- Passed the complete local database suite: 5 files and 161/161 assertions. Slice B remains 28/28.
- Passed `node --test tests/*.test.ts tests/*.test.js` (114/114), `node --test tests/reminder-due.test.ts` (9/9), `node --test tests/recurrence.test.ts` (25/25), both existing Deno checks, `npm run build`, and `git diff --check`.
- Marker contract: future callers must pass the database `reminder_schedule_changed_at` value without lossy JavaScript formatting or precision truncation. C1 itself is DB-only and has no caller, sender, candidate scan, Cron, secret, provider integration, or Production migration.

### Slice 2A — Timezone Primitives + Reminder Due Calculator

Local verification on 2026-09-20:

- Passed `node --test tests/recurrence.test.ts tests/reminder-due.test.ts` (34/34). Coverage includes null/invalid inputs, all seven frozen reminder kinds, timed/all-day mismatch, real-minute offsets, Event-local previous-day arithmetic, all-day 08:00/previous-day 20:00, DST gap/overlap policy, and the absence of `ends_at` from the calculator contract.
- Passed the full repository Node suite: `node --test tests/*.test.ts tests/*.test.js` (101/101).
- Passed `npm run build`, proving the Vite/browser TypeScript project imports the shared runtime-neutral timezone implementation.
- Node imports passed through both recurrence and Reminder tests. Existing recurrence behavior is locked by new DST characterization tests: a nonexistent wall clock advances to the first instant after the spring gap, while an overlapped wall clock selects the earlier instant.
- Passed with system Deno 2.9.7: `deno check supabase/functions/_shared/time-zone.ts` and `deno check supabase/functions/_shared/reminder-due.ts`. Deno remains a system verification tool rather than a project dependency.
- Scope audit passed: no database/schema/migration, Event UI, sender, Cron, Service Worker, Push Subscription, Supabase/Vercel configuration, dependency, deployment, commit, or push change.

### Slice 2B — Reminder Persistence + Event Mutation/UI

Local implementation verification on 2026-09-20:

- Passed the Slice B schema/migration static contract: 4/4. It covers the exact three columns, five minimum constraints, one validation/marker function + trigger, historical recurring-only timezone backfill, no historical Reminder activation, no legacy offset, and split-child timezone inheritance.
- Passed the complete repository Node suite: `node --test tests/*.test.ts tests/*.test.js` (114/114). New coverage includes timed/all-day defaults and mapping, null preservation, controlled timezone capture failure with no UTC fallback, existing timezone preservation, historical capture boundaries, semantic partial payloads, seconds/milliseconds preservation, and protected identity-field exclusion.
- Passed `deno check supabase/functions/_shared/time-zone.ts`, `deno check supabase/functions/_shared/reminder-due.ts`, `npm run build`, and `git diff --check`.
- Added `supabase/tests/2026-09-20-v0.1.8.2-reminder-persistence.test.sql` with 28 planned assertions for structure, constraints, marker behavior, direct marker mutation defense, and split-child timezone inheritance. Existing recurrence pgTAP fixtures now provide their authoritative Event timezone.
- Passed disposable ordered-upgrade from the committed pre-Slice-B schema with historical ordinary/recurring/personal fixtures. Verified historical-null policy, recurring timezone backfill, marker initialization, constraints/trigger, split-child timezone inheritance, RLS, personal ownership, and Realtime preservation.
- Passed Slice B pgTAP 28/28 and the complete local database regression suite 98/98. The recovered local database initially lacked the existing v0.1.8.1 prerequisite; applying that already-approved additive patch locally restored the expected baseline before the final green run.
- Production preflight, application of only `supabase/patches/2026-09-20-v0.1.8.2-reminder-persistence.sql`, and read-only postflight passed. Historical reminders remained disabled, ordinary timezones remained null, recurring timezones matched their rule, and existing RLS/owner validation/Realtime/Push infrastructure were preserved.
- Production human acceptance completed on 2026-09-20 against the deployed frontend — PASS: new timed defaults to 10 minutes before and new all-day defaults to 08:00; timed/all-day conversions preserve the non-null/null rule; timed 1-hour and all-day previous-day 20:00 presets persist; saved timed and all-day reminders persist after reopen; disabling remains 不提醒 after reopen; recurring Events force 不提醒 and disable the other Reminder options; title-only/description-only edits leave start/end unchanged; ordinary schedule edits reopen correctly without Reminder anomalies; A-created-B-owned personal Events remain read-only to A and editable by B; shared CRUD, own personal CRUD, ordinary Event create/update/delete Realtime, and shared Reminder Realtime all pass.
- Historical ordinary Event browser coverage was N/A because Production had no pre-Slice-B ordinary fixture. This is not a failure: ordered-upgrade and Slice B pgTAP covered `historical reminder_kind = null`, `historical ordinary time_zone = null`, and no historical Reminder auto-enable. Timezone detection failure and seconds/milliseconds preservation remain automated semantic checks; the browser acceptance verified the visible schedule was not rewritten by title/description edits.
- Scope audit: no delivery table, claim function, sender, Cron, retry, recipient resolution, Push delivery, recurring Reminder delivery, dependency, deployment, commit, or push change.

### Slice 1 — Push Infrastructure Foundation

Local automated verification updated on 2026-09-19:

- Passed 29/29 Node tests across `tests/push-notifications.test.ts`, `tests/send-test-push.test.ts`, `tests/send-test-push-source.test.ts`, `tests/service-worker.test.ts`, and `tests/supabase-schema-push.test.ts`; the full repository suite passed 90/90.
- Passed `npm run build` (TypeScript project build plus Vite production bundle).
- Passed an Edge static/type check against the exact `@mmmike/web-push@1.3.0` package declarations. Sender diagnostics cover accepted 2xx, gone 404/410, rejected 401/403/429/5xx, and network/runtime failure while returning only upstream status, provider hostname, delivery flags, and a stable non-sensitive error code.
- Added `supabase/tests/2026-09-18-v0.1.8.1-push-infrastructure.test.sql` with 22 assertions for table/RPC structure, privileges, authenticated registration/upsert, endpoint ownership, current-installation disable, and isolation. Its local run is pending because the local Supabase database was unavailable; Production was not used as a substitute.
- The v0.1.8.1 Push Infrastructure pgTAP suite passed as part of the complete 98/98 local database regression run on 2026-09-20.

Real Push Infrastructure acceptance on 2026-09-19:

- **iPhone installed PWA — PASS:** notification permission, subscription, test push, delivery after returning to the home screen, and lock-screen delivery passed.
- **Desktop Chrome/macOS — PASS:** notification permission, local `Notification`, Service Worker `showNotification`, FCM upstream acceptance, and final test-push display passed. The diagnostic result was `status = 201`, `delivered = true`, `provider = fcm.googleapis.com`, and `gone = false`.
- **Desktop recovery evidence:** the initial browser subscription produced FCM acceptance but no displayed Push. Closing notifications, enabling them again, and creating a fresh subscription restored delivery. No evidence indicates a Push architecture, VAPID, Edge Function, or Service Worker blocker.
- **First-line Push recovery:** retry; unsubscribe/resubscribe; restart the browser/PWA. Escalate to deeper RCA only if these do not restore delivery or safe sender diagnostics show provider rejection.
- **Android deferred by validation strategy:** permission, subscription, foreground delivery, background delivery, closed-app delivery, notification click, and logout lifecycle will be validated together during final v0.1.8 cross-platform acceptance. This is not a blocker for Slice 2.

- Register a root-scope Service Worker that handles Push and notification clicks only; verify that it adds no offline cache or `fetch` caching behavior.
- Request notification permission only after an explicit user action. Cover granted, dismissed/default, denied, unsupported-browser, and iPhone-not-installed guidance.
- Persist subscriptions by `user + installation`, not by Space. Desktop and iPhone used independent installations; final Android multi-device coverage remains part of final v0.1.8 acceptance.
- Verify current-installation logout disables/unsubscribes that installation without disabling another device, and invalid/expired endpoints are retired safely.
- Desktop and iPhone diagnostic system-notification smoke passed. Android system-notification and lifecycle smoke is deferred to final v0.1.8 acceptance and does not block reminder-semantics work.
- Confirm this slice does not add Event reminder persistence, reminder scheduling, recurrence delivery, Email reminder delivery, SQL beyond subscription persistence, or offline caching.

### Slice 2 — Reminder Persistence + Ordinary Event Delivery

- Verify nullable `events.reminder_kind` accepts only `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder. Reject timed kinds on all-day Events and all-day kinds on timed Events after the visible conversion step.
- Verify nullable `events.time_zone` accepts canonical IANA timezone names rather than fixed offsets. New Events capture `Intl.DateTimeFormat().resolvedOptions().timeZone`; later device timezone changes do not silently rewrite existing Events. Recurring Events require equality with `recurrence_rule.time_zone`.
- Verify the database default and every historical Event remain `reminder_kind = null`, with historical ordinary `time_zone = null`; no migration guesses a timezone or enables notifications. Historical recurring sources may initialize `time_zone` only from their existing authoritative `recurrence_rule.time_zone`. Enabling a timezone-dependent reminder on a historical null-timezone Event captures the current device IANA timezone explicitly as part of that mutation.
- Verify new UI-created timed Events default to `timed_10m_before` and new UI-created all-day Events default to `all_day_same_day_08`; these are UI defaults, not database defaults.
- Verify at-start/10m/30m/1h use the effective absolute start and real-minute subtraction. Verify `timed_previous_day_same_time` preserves the same wall-clock time on the prior Event-local calendar day and reuses the existing recurrence gap/overlap policy rather than subtracting 1440 minutes.
- Verify all-day same-day 08:00 and previous-day 20:00 derive one canonical instant from effective Event date plus Event timezone, independent of receiving-device timezone. Confirm the current all-day representation safely supports this calculation before proceeding; do not add date-only storage or exclusive-end behavior in Slice 2.
- Verify timed-to-all-day keeps null or maps any non-null timed reminder to `all_day_same_day_08`; all-day-to-timed keeps null or maps any non-null all-day reminder to `timed_10m_before`. The final option must be visible before save.
- Verify multi-day timed/all-day Events use only their effective range start/first date; `ends_at` never creates daily, end, journey, or intermediate reminders.
- Verify start/date and preset edits update `reminder_schedule_changed_at` and derive a new current due; the old due naturally leaves the candidate path without mutation-time ledger maintenance. Title/description edits keep the marker and due unchanged. An already-sent reminder is not withdrawn, while moving an Event to a future due may create one new legitimate delivery.
- Verify create/edit/enable/preset changes whose newly derived due is past do not immediately Push or compensate. Verify approximately ten-minute grace applies only when an already-valid due was missed by infrastructure: 10:00 → 10:07 may send, while 10:00 → 10:30 skips; apply the same rule to all-day 08:00.
- Verify shared events resolve all current active Space members at send time, personal events resolve only `owner_user_id`, former members receive nothing, and members without active subscriptions naturally receive no device notification.
- Verify Reminder UI copy tells the editor that a shared Event reminder notifies current Space members.
- Verify ordinary one-off uniqueness on `(event_id, subscription_id, due_at)`, atomic current-state revalidation/claim, `reminder_schedule_changed_at` snapshot matching, and approximately one-minute normal scheduler precision. Do not pre-generate pending rows or mutate the ledger when an Event schedule changes.
- Verify Production best-effort delivery on Desktop, iPhone installed PWA, and Android installed PWA, including repeated Cron/Edge Function invocation, multi-device delivery, and no duplicate notification on the same subscription/due time. Provider failures and ambiguous timeouts are terminal failed results in this slice and do not enter an automatic retry framework.
- Confirm Email, SMS, Bark, multiple reminders, arbitrary custom minutes, per-user reminder preferences, snooze, sound customization, notification inbox/history, native alarms, multi-space implementation, and UI overhaul remain outside v0.1.8.

### Slice 3 — Recurrence Reminder Integration

- Verify normal occurrences inherit source `reminder_kind` and canonical timezone; only-this overrides recalculate from effective start/date; only-this deletes send nothing.
- Verify future split children inherit `reminder_kind` and `time_zone`; current-and-future delete suppresses future reminders; all-day recurrence calculates 08:00 / previous-day 20:00 from effective occurrence date.
- Verify recurrence reminder calculation reuses the canonical recurrence timezone/DST implementation and does not introduce a second DST algorithm.
- Verify recurring uniqueness on `(logical_series_id, occurrence_key, subscription_id, due_at)` and no duplicate when a future split leaves logical occurrence and due unchanged.

## v0.1.7.3.3.2 Frontend Scope Integration

Passed locally on 2026-07-19:

- `node --test tests/recurrence.test.ts tests/event-edit-target.test.ts tests/event-edit-draft.test.ts tests/event-edit-mutation.test.ts tests/event-edit-ui.test.ts` (41 tests).
- Coverage includes ordinary-event route regression; occurrence only-this and this-and-future routes; final split/future-delete RPC parameter payloads; source all-day/rule/revision preservation; exactly two occurrence scopes and their copy; and projection of old/child split segments without a duplicate split date.
- The UI helper coverage now asserts save/delete action-chooser copy for both scopes; the sheet no longer renders a persistent scope control.
- `npm run build` and `git diff --check` passed.
- Refresh error propagation is implemented so EventSheet's awaited `onSaved()` path retains the sheet when either events or exceptions reload fails; initial-load and Realtime fire-and-forget callers handle the resulting rejection after the page error is set.
- Authenticated local UI smoke passed: only-this edit, this-and-future edit, only-this delete, this-and-future delete, and the save/delete action chooser.
- Local PostgREST cache recovery: database inspection confirmed `delete_occurrence_and_future(uuid, date, timestamptz)` already exists; a local `NOTIFY pgrst, 'reload schema'` completed and PostgREST logged a 15-function schema cache. The existing v0.1.7.3.3.1 patch was subsequently applied once to Production, its cache was reloaded, and the final RPC signatures/permissions were verified. No SQL file changed.

Production acceptance completed on 2026-07-19:

- Passed on Production Desktop and iPhone Standalone PWA: 「仅修改当前事件」、「修改当前及未来事件」、「仅删除当前事件」and「删除当前及未来事件」.
- Passed: the Production alias serves the v0.1.7.3.3.2 build and the recurrence action chooser retains the sheet until the selected mutation succeeds and refresh completes.
- iOS Standalone PWA cannot actively refresh itself. This is an iOS system limitation, not an application defect; the smoke scope verified the supported manual interaction flow.
- Deferred by product decision: `delete_logical_series` remains an available backend RPC but has no frontend entry point. Whole-logical-lineage deletion requires a separately approved UX and safeguard slice.
- Two-session Realtime and DST-zone behavior remain separate verification work. Recurrence-rule and all-day changes remain out of scope for occurrence edits.

## v0.1.7.3.3.1 Split RPC Correctness Patch

Passed locally on 2026-07-18. `supabase db reset --local --yes` resets the local Supabase instance but does not load this repository's `supabase/schema.sql`; the validated fresh bootstrap explicitly loaded that file through the local Postgres container. `schema.sql` is the latest complete bootstrap artifact, while `supabase/patches/*.sql` are ordered upgrades from an older database state.

- Standalone bootstrap: v0.1.7.1 foundation pgTAP 18/18; v0.1.7.3 series-editing pgTAP 30/30; total 48/48.
- Ordered upgrade from `e7decd1` bootstrap through v0.1.7.1, v0.1.7.3.1, and v0.1.7.3.3.1 patches: 48/48.
- Node recurrence/edit regressions: 34/34; `tests/supabase-schema-recurrence.test.ts`: 1/1; total 35/35. The schema test guards recurrence lineage, exception foundation, helpers, final RPCs, SECURITY DEFINER/search_path, and child `recurrence_until` inheritance.
- Passed: `npm run build` and `git diff --check`.

## v0.1.7.3.2 Frontend RPC Integration

Verified on 2026-07-18 with localhost:5175 connected to Production Supabase project `ximazjhxvmktpcdbypka` after the v0.1.7.3.1 patch and PostgREST schema-cache reload:

- Passed: opening a non-first recurring occurrence hydrates the sheet from the occurrence projection, including its own date and time rather than the source event baseline.
- Passed: editing title/time for one occurrence writes an only-this override; surrounding occurrences remain unchanged and the projection remains correct after refresh.
- Passed: deleting one occurrence writes an only-this deletion; surrounding occurrences remain and the projection remains correct after refresh.
- Passed: ordinary non-recurring event edit/delete regression.
- Passed: `node --test tests/recurrence.test.ts tests/event-edit-target.test.ts tests/event-edit-draft.test.ts tests/event-edit-mutation.test.ts tests/event-edit-ui.test.ts` (34 tests), `npm run build`, and `git diff --check`.
- Passed locally: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.3-series-editing.test.sql` (15 pgTAP assertions).
- Scope: only-this occurrence mutation only. Recurrence-rule and all-day controls are unavailable for an occurrence because the override RPC contract accepts only `title`, `description`, `starts_at`, and `ends_at`.

## v0.1.7.3.1 Series Editing Database RPC Foundation

Verified locally on 2026-07-18, then applied and structurally/RPC-verified on Production project `ximazjhxvmktpcdbypka` before the v0.1.7.3.2 authenticated smoke:

- Passed: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.3-series-editing.test.sql` (15 pgTAP assertions). Coverage includes only-this override/delete, source-timezone candidate validation, non-member denial, split cutoff/child lineage/no exception migration, stale `updated_at` rejection, and logical-series deletion of root, child, and exceptions.
- Passed regression: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql` (18 pgTAP assertions).
- Passed Production: preflight found the v0.1.7.1 prerequisites and no existing v0.1.7.3.1 RPCs; the reviewed patch was applied once, PostgREST schema cache was reloaded, and all four `SECURITY DEFINER` RPCs were recognized by PostgREST. Frontend only-this integration and authenticated smoke are recorded above; split and logical-series UI remain outside this slice.

## v0.1.7.1 Recurrence Exceptions Database Foundation

Implemented locally on 2026-07-18, pending database execution:

- Added pgTAP coverage for migration structure, deleted/override exception insert and update, exception delete, and member/non-member RLS behavior in `supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql`.
- Pending: run `supabase test db --local supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql` after a local Supabase/Postgres instance is configured and the additive v0.1.7.1 patch has been applied there. The 2026-07-18 attempt failed to connect to local Postgres; no linked or Production test was attempted.
- The pgTAP prerequisite `permission denied for table events` is addressed in `supabase/schema.sql` by policy-matched `authenticated` table grants. Re-run locally to verify that existing RLS policies, rather than missing base privileges, control access.
- Passed: `node --test tests/recurrence.test.ts` (17 tests), `npm run build`, and `git diff --check`.

## Current Smoke-Test Status

- Passed: local production build.
- Passed: Supabase schema, RPC, RLS, and Realtime validation.
- Passed: two-user desktop flow for space creation/join and event create/update/delete.
- Passed: v0.1.1 personal owner-only management and non-owner read-only details.
- Passed: direct API enforcement for personal events and immutable event identity fields.
- Passed: third-user capacity rejection and non-member RLS read/write isolation.
- Passed: iOS Safari layout and add-to-home-screen behavior.
- Passed: Android Chrome layout and creation of a home-screen shortcut.
- Passed: v0.1.2 Vercel Production deployment and first-round HTTPS smoke testing.
- Passed: desktop User A Production Magic Link, session restoration, shared/personal CRUD, and same-account two-window Realtime.
- Passed: iPhone Production page, logged-out layout, manifest/icons, add-to-home-screen, and home-screen launch.
- Passed: User B Production Magic Link login.
- Passed: two-account Production shared Realtime create/update/delete.
- Passed: two-account Production personal-event owner/read-only permissions and Realtime propagation.
- Passed: authenticated iPhone User B Production login, mobile layout, shared CRUD, and desktop Realtime propagation.
- Passed: v0.1.3 local production build.
- Passed: v0.1.3 real-browser shared/personal event form UX smoke test.
- Passed: v0.1.3 all-day functional regression.
- Passed: Android Chrome Production compatibility smoke test on Xiaomi 14 / Android 16.
- Passed: Android Chrome Magic Link login, session restore, event CRUD, Realtime, permissions, and PWA home-screen flow.
- Passed: Supabase keep-alive Cron registration, unauthorized 401 check, and first scheduled Production invocation with HTTP 200.
- Passed: v0.1.4 local TypeScript/Vite production build and diff hygiene.
- Passed: v0.1.4 Production Supabase patch, constraint/trigger/RLS verification, and local two-account desktop smoke.
- Passed: v0.1.4 deployed-frontend two-account Production desktop smoke, including member identity, owner permissions, CRUD, and events Realtime.
- Passed: v0.1.4 Production iPhone Safari browser smoke and Android Chrome/PWA smoke.
- Pending: v0.1.4 new-user first-login behavior and the safe single-member-space scenario.
- Passed: v0.1.5 local Email OTP acceptance for existing/new users, new-user space creation, member display-name update, and existing-session regression.
- Passed: v0.1.5 Production acceptance on Desktop, iPhone Safari, iPhone standalone PWA, Android Chrome, and Android PWA.

## v0.1.6.1 Recurring Events Foundation

Completed locally on 2026-07-17:

- Passed: `node --test tests/recurrence.test.ts` (10 tests). Coverage includes one-off projection, daily interval, weekly weekday selection and interval anchor, monthly numeric day and `last_day`, yearly date and leap day, invalid rule rejection, and the 500-candidate failure path.
- Passed: `npm run build` and `git diff --check`.
- Passed: static review confirms the new patch only adds nullable `events.recurrence_rule`, a recurrence validation function/trigger, and no RLS or Realtime changes.

Database acceptance completed against the linked Production Supabase project on 2026-07-17:

- Passed: preflight confirmed `recurrence_rule` was absent before migration; recorded baseline events triggers, four RLS policies, Realtime publication, and `FULL` replica identity.
- Passed: `supabase/patches/2026-07-17-v0.1.6.1-recurring-events-foundation.sql` applied successfully once.
- Passed: post-apply schema reports `events.recurrence_rule` as nullable `jsonb`; all four legacy events have `recurrence_rule = null`.
- Passed: existing `events_validate_owner` and `events_touch_updated_at` triggers remain, with only `events_validate_recurrence_rule` added. The four original RLS policies and `supabase_realtime` / `FULL` metadata are unchanged.
- Passed: rollback-only two-account RLS simulation: both members read/update a shared recurring event; the personal owner updates their event; the non-owner update affects zero rows. Final check confirmed no test events persisted.

Still required before UI integration or release:

- Verify live Realtime propagation of a committed `recurrence_rule` update between two separately authenticated subscribed clients. A 2026-07-17 automated attempt using two isolated email/password accounts stopped before subscription because Production requires email confirmation and issued no sessions. The temporary accounts were removed (zero temporary users/spaces remain). The database publication metadata alone is not end-to-end delivery proof; use two existing Email OTP-authenticated browser sessions for this check.
- Confirm timezone behavior in the supported browsers before claiming DST-zone support. No timezone dependency was added.

## v0.1.6.2 Calendar Integration

Completed locally on 2026-07-17:

- Passed: `CalendarViews` projects source `events` through `expandRecurringEvents()` for the active visible range before all Today, Week, and Month filtering/rendering.
- Passed: Today covers the selected local day, Week covers Monday through Sunday, and Month covers the full 42 visible grid cells. Existing duration intersection semantics remain applied to display occurrences.
- Passed: one-off source events project once; recurring display entries use `occurrence_id` keys and occurrence start/end values while source events remain the edit/delete identity.
- Passed: `node --test tests/recurrence.test.ts` (12 tests), including source-list projection and Today/Week/42-cell range construction; existing daily, weekly, monthly, yearly, range, and candidate-limit coverage remains green.
- Passed: `npm run build` and `git diff --check`.

Deferred by the v0.1.6.2 scope:

- No recurrence create/edit/delete UI, series-management copy, exception behavior, or single-occurrence operation has been added.
- Run the real two-client Realtime subscription check after recurrence UI is complete; source-row reload and re-projection are connected, but the prior authenticated-client transport checkpoint remains unobserved.

## v0.1.6.3 Recurrence UI Implementation

Completed locally on 2026-07-17:

- Passed: event-sheet recurrence controls serialize `null` for 不重复 and the supported v1 daily, weekly, monthly, and yearly shapes for source-event creates and updates.
- Passed: the browser timezone is obtained with native `Intl.DateTimeFormat().resolvedOptions().timeZone`; the existing rule parser rejects invalid interval, weekday, and yearly date combinations before the Supabase write.
- Passed: recurring source events are edited through the existing source ID. The sheet labels whole-series edit/delete behavior and has no single-occurrence, exception, or future-occurrence control.
- Passed: `node --test tests/recurrence.test.ts` (17 tests), including non-recurring/daily/weekly/monthly/yearly rule construction, saved-rule edit conversion, invalid selectors, source identity, range projection, and candidate limit behavior.
- Passed: `npm run build` and `git diff --check`.

Still required for final acceptance:

- Use two existing independently authenticated Email OTP browser sessions to create/edit/delete a shared recurring source event, confirm all rendered occurrences update as a series, and observe the second client receive/reproject the source-row Realtime UPDATE.
- Run the same recurrence form smoke on supported narrow iPhone Safari and Android Chrome/PWA layouts, including DST-observing timezone behavior before claiming that support.

## v0.1.5 Email OTP

Supabase SMTP and the passwordless email template are configured to deliver `{{ .Token }}` as 8-digit Email OTP codes.

Production acceptance completed on 2026-07-15:

- Desktop, iPhone Safari, iPhone standalone PWA, Android Chrome, and Android PWA Email OTP login passed.
- Existing-user and new-user OTP login passed; a new user created a shared space successfully.
- The existing `profiles` trigger and display-name editing behavior passed after OTP login.
- Existing-session restoration/regression passed.
- iOS standalone PWA login now completes in the standalone container through OTP input, removing the previous Magic Link return limitation.

Future observation: monitor Production email delivery, resend/cooldown/error UX, and session restoration during normal use.

## v0.1.4 Member Identity & Space Members

For an existing environment, do not rerun `supabase/schema.sql`. Execute `supabase/patches/2026-07-11-v0.1.4-member-display-name.sql` only once per environment.

Static SQL review completed locally:

- The patch transactionally blocks concurrent profile writes, converts whitespace-only names to `null`, trims valid legacy values, and truncates legacy non-empty values to 20 characters before the check constraint is added.
- The constraint permits `null` and otherwise requires a trimmed 1–20-character name.
- `handle_new_user()` inserts `display_name = null`; it no longer reads Auth metadata, email, or email prefixes.
- Existing `profiles_select_same_space` and `profiles_update_self` policies are unchanged. No profile/member Realtime publication or subscription is added.

Verified against the current Production Supabase project on 2026-07-11:

- The v0.1.4 patch completed successfully. The three existing profiles needed no whitespace cleanup, trimming, or truncation.
- `profiles_display_name_format_check` exists; the post-patch data check returned zero edge-whitespace, over-limit, and empty values.
- `handle_new_user()` now writes `display_name = null`, keeps `SECURITY DEFINER`, `search_path = public`, the trigger return type, and `on conflict (id) do nothing`; it no longer reads Auth metadata or email data.
- The existing profiles, space-members, and events RLS policies were confirmed unchanged.

Verified in a local two-account desktop smoke test on 2026-07-11:

- A and B entered the same two-member space and each saw the correct 「成员 · 2」 list, current-user marker, and self-only edit control.
- Name editing, trim behavior, local immediate refresh, and refreshed second-session display passed; A/B name labels remained correct in event cards, owner choices, and details.
- Today, week, and month labels showed the concrete personal owner name or 「共同」; no deprecated relative event labels appeared.
- Shared, A-owned personal, and B-owned personal creation passed. Non-owners remained read-only, owners managed their personal events, and either member managed shared events.
- Shared and personal events propagated through the existing events Realtime create/update/delete flow. Temporary smoke events were deleted successfully after verification.
- Same-name owner regression also passed: ownership and editability continued to use user IDs, not display names.

Verified against the deployed Production frontend on 2026-07-14:

- Two-account desktop smoke passed: header member count, member sheet, current-user marker, self-only name editing, local immediate update, refreshed second-session update, today/week/month labels, shared/personal CRUD, owner-only personal access, same-name owner regression, and events Realtime create/update/delete.
- iPhone Safari browser smoke passed. The standalone PWA can be added to the home screen and its non-login UI checks passed, but it keeps a separate session and Magic Links normally open Safari rather than returning to the standalone app. Standalone authenticated login is therefore not verified and remains an iOS platform/Auth UX limitation outside v0.1.4.
- Android Chrome smoke passed. Android home-screen PWA existing-session use, browser-Gmail Magic Link completion, narrow layout, keyboard, member UI, shared/personal flow, and events Realtime passed.
- Android Gmail native-App limitation: its Magic Link does not return to the PWA. This is a cross-app handoff limitation, not a v0.1.4 application failure.
- Non-blocking browser observation: native `datetime-local` controls follow browser/system locale (Chrome 24-hour vs Safari 12-hour presentation); stored and rendered event times were correct.

Still pending:

- New-user first-login behavior with a newly created Auth account.
- The single-member-space UI path, which was intentionally not tested by removing a real member.

## Android Production Compatibility

- Date: 2026-07-06.
- Device: Xiaomi 14.
- Android version: 16.
- Browser: Chrome.
- URL: https://cross-platform-shared-calendar.vercel.app/.
- Network: mobile network.
- Test accounts: User A on desktop, User B on Android.
- Production page opened successfully.
- Android Chrome Magic Link login passed.
- Login session restore passed.
- Today, week, and month views passed.
- Mobile layout passed.
- New shared event default end time equals start time plus 1 hour.
- New personal event default end time equals start time plus 1 hour.
- Changing start time updates the end time while the end time has not been manually edited.
- Manually edited end time is not overwritten by later start-time changes.
- Editing existing shared and personal events does not reset the stored end time.
- Shared Realtime create, update, and delete passed.
- Personal read-only permission behavior passed.
- User A creating a personal event for User B transferred management permissions to User B as expected.
- Android Chrome add-to-home-screen passed.
- Home-screen PWA launch passed.
- Creating and deleting events from the PWA synced to desktop through Realtime.
- Issues found: none.
- Note: Android Chrome initially reported that it was still adding a previous site to the home screen; restarting Chrome resolved it. This was treated as a browser state issue, not a project bug.
- Conclusion: Android compatibility smoke test passed, including the previously pending authenticated Android CRUD, Realtime, and PWA compatibility scope.

## Supabase Restore Minimum Smoke Test

Run this if the Supabase Free project is restored after an inactivity pause:

- Production page opens.
- Magic Link login works.
- Session remains available after refresh.
- Calendar data can be read.
- Shared event create, edit, and delete work.
- Basic two-client Realtime sync works.

## Supabase Keep-Alive

- Endpoint: `/api/supabase-keepalive`.
- Schedule: daily Vercel Cron at `0 3 * * *`.
- Auth: `Authorization: Bearer <CRON_SECRET>`.
- Data access: three sequential anon-key, head-only reads from `spaces`.
- Expected unauthorized result: missing or incorrect bearer token returns `401`.
- Expected local missing-env result: correct token without required Supabase env vars returns `500` without printing env values.
- Expected success result after env setup: `200` with `{ "ok": true, "checks": 3 }`.
- Success response must not include query rows, space IDs, user data, Supabase keys, or `CRON_SECRET`.
- Production verification on 2026-07-09:
  - Passed: Cron Job registered for `/api/supabase-keepalive` at `0 3 * * *`.
  - Passed: unauthenticated browser request returned `401 unauthorized`.
  - Passed: first scheduled Production invocation returned HTTP 200.
- Vercel Dashboard checks after deploy:
  - `CRON_SECRET` is configured for Production.
  - The deployment includes `/api/supabase-keepalive`.
  - Continue checking Cron Jobs and Function logs to confirm later invocations return HTTP 200.
  - Function logs should show success/failure only and must not print secrets or query data.
- Supabase follow-up:
  - Confirm the project remains Active after several daily Cron runs and over longer periods.
  - The first successful invocation does not prove that the project can never be paused.
  - If the project still pauses, reassess whether a dedicated read-only RPC or Supabase Pro is needed.

## v0.1.3 Event Form UX Defaults

- Confirm `npm run build` passes.
- Create a new shared event and confirm the default end time is the default start time plus 1 hour.
- Create a new personal event and confirm the default end time is the default start time plus 1 hour.
- Create a new event, change the start time before touching the end time, and confirm the end time follows the new start time plus 1 hour.
- Create a new event, manually change the end time, then change the start time, and confirm the manually chosen end time is not overwritten.
- Create a new all-day event without manually editing the end time and confirm there is no UI or save regression.
- Create or edit an all-day event after manually editing the end time and confirm the existing behavior of saving the user-entered end value is preserved.
- Edit an existing shared event and confirm the stored end time loads from the database and is not reset to start plus 1 hour.
- Edit an existing personal event and confirm the stored end time loads from the database and is not reset to start plus 1 hour.
- Confirm a non-owner personal event still opens as read-only, without save or delete controls.
- Confirm Realtime create, update, and delete propagation still works between two authenticated sessions.
- Confirm desktop local or Production smoke test passes.
- Confirm iPhone smoke test passes.

Verified in a real browser on 2026-06-24:

- New shared and personal events defaulted the end time to start plus 1 hour.
- New-event start changes kept the end time at start plus 1 hour until the end time was manually edited.
- After manually editing the end time, later start changes did not overwrite the end time.
- Existing shared and personal events kept their original end times when opened for editing.
- Non-owner personal events remained read-only.
- Realtime create, update, and delete continued to work.
- All-day functional regression passed; no UI or save abnormality was observed. Database-field behavior was protected by the save-payload logic, but this manual pass did not separately inspect the stored database field.

## v0.1.2 HTTPS Production

- Production URL: https://cross-platform-shared-calendar.vercel.app/
- Vercel deployment completed successfully.
- Confirm the Production page loads without a Supabase configuration error.
- Confirm `VITE_SUPABASE_URL` uses only the Supabase project base URL ending in `.supabase.co`; it must not contain `/rest/v1/`.
- Supabase Auth Site URL is configured to the Production URL.
- Redirect URLs include the Production URL with and without a trailing slash.
- Local redirects currently include `http://localhost:5175`.
- `http://192.168.10.6:5175` is retained only as a temporary LAN phone-test redirect, not as a stable deployment address.
- Verified desktop User A Magic Link login, logout, repeat login, and session restoration.
- Verified the post-login URL remains on the Production domain; an empty `/#` is acceptable.
- Verified User A shared event create, update, and delete operations, including correct state after refresh.
- Verified User A personal event create, update, and delete operations.
- Verified Realtime create, update, and delete propagation between two browser windows using User A.
- Verified `/manifest.webmanifest`, `/icons/icon-192.svg`, and `/icons/icon-512.svg` are accessible.
- Verified iPhone Safari can open the Production URL.
- Verified the app can be added to and launched from the iPhone home screen.
- Verified the logged-out iPhone layout displays the email login entry point correctly.
- Verified User B can log in to the Production URL via Magic Link from an incognito window and reach the calendar page.
- Verified A and B pages both remain normal after B login and show the same invite code, confirming they are in the same shared space.
- Verified two-account shared Realtime:
  - A creates `ab realtime create test`; B sees it without refreshing.
  - B edits it to `ab realtime edit test`; A sees the update without refreshing.
  - B deletes it; A sees it disappear without refreshing.
- Verified A-owned personal permissions and Realtime:
  - A creates `a personal readonly test`; B sees it without refreshing and it is labeled as the other person's event.
  - B opens it read-only, with no save button, no delete button, and non-editable title/time fields.
  - A edits it to `a personal owner edit test`; B sees the update without refreshing.
  - A deletes it; B sees it disappear without refreshing.
- Verified B-owned personal event creation from A's session:
  - A creates `b personal ownership test` as a personal event belonging to B.
  - B sees it without refreshing and it is labeled as mine.
  - A sees it as the other person's event and can only open it read-only, with no save/delete controls.
  - B can edit and delete it as owner.
  - After B deletes it, A sees it disappear automatically.
- Verified authenticated iPhone Production flow:
  - iPhone logs in with User B and ends on the Production domain.
  - iPhone reaches the calendar page with normal mobile layout.
  - iPhone B creates `iphone shared test`; desktop A sees it without refreshing.
  - iPhone B deletes it; desktop A sees it disappear without refreshing.
- Pending: authenticated Android CRUD because the Android device is temporarily unavailable.

## Local Build

- Run:

  ```bash
  npm run build
  ```

- Expected result: TypeScript and Vite production build pass.

## Local Development Server

- Run:

  ```bash
  npm run dev
  ```

- Expected result: Vite starts on fixed port `5175`.
- Browser acceptance testing should open `http://127.0.0.1:5175`.
- `http://localhost:5175` is also valid for desktop local testing.
- Do not use Vite's default `5173` port for this project.
- The dev script uses `--strictPort`, so startup should fail instead of falling back to another port when `5175` is occupied.

## Supabase Schema

- Execute `supabase/schema.sql` in the Supabase SQL Editor.
- Confirm tables, indexes, triggers, RLS policies, and RPC functions are created.
- Confirm RLS is enabled for `profiles`, `spaces`, `space_members`, and `events`.
- Confirm `public.generate_invite_code()` can create a code without a `gen_random_bytes` lookup error.
- Confirm PostgREST can query `space_members` with `profiles(display_name)` through the direct profile foreign key.
- Confirm `public.events` is included in the `supabase_realtime` publication.
- Confirm `public.events` uses `replica identity full` so filtered DELETE events include `space_id`.

For an existing environment, do not rerun the full schema. Before applying the v0.1.1 patch, run this preflight query:

```sql
select id, space_id, scope, owner_user_id
from public.events
where (scope = 'shared' and owner_user_id is not null)
   or (scope = 'personal' and owner_user_id is null);
```

- Expected result: zero rows.
- If any row is returned, stop and inspect the data before applying the patch.
- When preflight passes, execute `supabase/patches/2026-06-20-v0.1.1-personal-permissions.sql`.

## Magic Link

- Configure Supabase Auth redirect URLs for local development and deployment domains.
- Request a Magic Link from the login page.
- Open the email link on desktop and mobile.
- Confirm the app restores the Supabase session after redirect.

## Two-User Flow

- User A creates a shared space.
- User A copies the invite code.
- User B joins with the invite code.
- User A creates, edits, and deletes an event.
- User B creates, edits, and deletes an event.
- Confirm both users can see shared updates.
- Keep User B open while User A creates an event, and confirm it appears without refreshing.
- Delete the event in User B's session and confirm it disappears from User A's session without refreshing.
- Confirm "我的", "对方的", and "共同的" labels render correctly from each user's perspective.

## Personal Event Permissions

- User A creates a personal event owned by A.
- User B can view it and open a read-only detail sheet.
- User B does not see save or delete controls.
- The read-only detail sheet remains fully visible or scrollable within the viewport on desktop and mobile.
- User A can edit and delete it.
- User A creates a personal event owned by B.
- User A can only view it after creation; User B can edit and delete it.
- Either member can edit and delete a shared event.
- Allowed edits and deletes continue to propagate through Realtime.

## Direct API Permission Checks

- As User B, attempt to update and delete a personal event owned by User A.
- Expected result: RLS rejects the operation or affects zero rows; the stored event remains unchanged.
- As an authorized event manager, separately attempt to change `space_id`, `created_by`, `scope`, and `owner_user_id`.
- Expected result: the event validation trigger rejects each identity-field change.
- Verified on 2026-06-21: non-owner personal UPDATE/DELETE affected zero rows; all four identity-field updates raised the expected trigger errors.

## Space Capacity

- User C tries to join the already full space.
- Expected result: the join RPC returns a clear error and User C is not added.

## RLS Isolation

- A non-member attempts to read spaces, members, and events.
- Expected result: non-members cannot read or modify private space data.

## Mobile Browsers

- Test on iOS Safari.
- Test on Android Chrome.
- Confirm login, onboarding, event creation, event editing, event deletion, and calendar navigation work on narrow screens.

## PWA

- Open the app on mobile.
- Add it to the home screen.
- Launch from the home screen.
- Confirm the app opens with standalone PWA presentation where supported.
