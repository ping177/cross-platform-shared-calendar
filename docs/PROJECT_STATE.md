# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.8 (Mobile Push Reminder — Slice 3 local implementation and final human/code review PASS; not deployed)

## Current status

Calendar Core 与 Recurring Events 已完成并通过 Production 验收。`v0.1.8.1` Push Infrastructure 与 `v0.1.8.2` ordinary Reminder Slice A/B/C 保持 `CLOSED / PASS`；Production ordinary scheduler 继续以原已验收版本运行。Slice 3 Recurrence Reminder Integration 已完成本地实现、自动化验证与 final human/code review PASS。Review 发现的唯一 long-duration projection blocker 已用 Reminder-only `ends_at = null` 投影视图有界修正并通过 re-review；canonical recurrence engine、candidate cap 与 ordinary Reminder 路径保持不变。Slice 3 source commit 已推送到 `origin/main`，但尚未部署；Android final acceptance 仍延期，因此整体 `v0.1.8` 保持 OPEN。

## Latest completed

Completed Slice 3 source governance closeout. Commit `2226731` (`feat: add recurring reminder integration`) was pushed normally to `origin/main` after focused recurrence/Reminder 46/46, ordinary sender 26/26, Node 169/169, pgTAP 199/199, strict Deno, build, diff hygiene, secret scan, and Project State Push Gate all passed. The implementation and long-duration correction remain not deployed, and Production was not modified.

## Deployment

Status: public_deployed
Public URL: https://cross-platform-shared-calendar.vercel.app/
Provider: Vercel
Backend: Supabase Free
Notes: 现有公网版本继续服务；`v0.1.8.2` ordinary Slice A/B/C 的 Production acceptance 状态不变。`send-test-push` 保持 ACTIVE v4 reviewed-equivalent；`send-reminders` 保持已验收的 ACTIVE v1 / `verify_jwt=false`；现有 Vault、`pg_cron`、`pg_net` 与 once-per-minute scheduler 均未改动。Slice 3 仅在本地实现和验证，未部署；Android final Push acceptance 仍延期。

## Version Index

- v0.1 — 共享日历 MVP
- v0.1-smoke-test — Supabase 验收
- v0.1.1 — 个人事件权限
- v0.1.2 — 公网部署验收
- v0.1.3 — 事件表单默认值
- v0.1.4 — 成员身份与空间成员
- v0.1.5 — Email OTP 登录 UX
- v0.1.6.1 — Recurring Events Foundation（migration + engine，Production patch 已执行）
- v0.1.6.2 — Recurring Events Calendar Integration（occurrence projection，未实现 recurrence UI）
- v0.1.6.3 — Recurring Events UI Implementation（source-series form，待最终浏览器/Realtime 验收）
- v0.1.7 — Recurrence Exceptions & Series Editing（设计完成，待人工 review）
- v0.1.7.1 — Recurrence Exceptions Database Foundation（Production prerequisites 已验证）
- v0.1.7.2 — Exception Expansion Engine（Production 已验证）
- v0.1.7.3 — Recurrence Editing Semantics Design（设计完成，待人工 review/implementation approval）
- v0.1.7.3.1 — Database RPC Foundation（Production patch + PostgREST schema cache 已验证）
- v0.1.7.3.2 — Frontend RPC Integration（only-this authenticated smoke 已通过）
- v0.1.7.3.3.1 — Split RPC Correctness Patch（final split / future-delete semantics 已验证）
- v0.1.7.3.3.2 — Frontend Scope Integration（Production Desktop 与 iPhone Standalone PWA recurrence smoke 已通过）
- v0.1.8 — Mobile Push Reminder（current approved product line；architecture frozen）
- v0.1.8.1 — Push Infrastructure Foundation（CLOSED / PASS；Desktop + iPhone verified；Android final acceptance deferred）
- v0.1.8.2 — Reminder Persistence + Ordinary Event Delivery（Slice A/B/C CLOSED / PASS；P3A C1、P3B manual E2E、P3C automatic scheduler E2E complete）

## Last verified

2026-09-22

## Next Action

Perform the separately authorized bounded Slice 3 Production rollout after source closeout. Keep Production migration/function/frontend deployment, scheduler checks, and acceptance inside that future authorization; Android final cross-platform acceptance remains a later separate step.

## Blockers

暂无明确阻塞。

## Important Context

- Git branch、latest commit、working tree 由 project-command-center 实时 Git 扫描读取；PROJECT_STATE.md 不作为这些字段的权威来源。
- Production URL: `https://cross-platform-shared-calendar.vercel.app/`.
- Supabase project status is currently Active, but Free Tier inactivity pause remains an operational risk.
- A Supabase pause may affect Auth, Database, RLS, and Realtime until the project is restored.
- Vercel Cron 每天调用 `/api/supabase-keepalive`；每次调用连续执行 3 次极轻量、只读、无业务副作用的数据库检查；首次 Production Cron 已返回 HTTP 200 并完成验证。
- Keep-alive is active, but its long-term effectiveness against inactivity pauses still requires observation.
- Continue using Supabase Cloud for now; do not upgrade to Pro or migrate the backend unless real usage requires it.
- README is the project entrypoint; detailed smoke checklists and production validation records live in `docs/TESTING.md`.
- Android compatibility smoke test is complete for Xiaomi 14 / Android 16 / Chrome on mobile network.
- v0.1 is a Web/PWA, not native iOS / Android.
- Event ownership uses stable `scope + owner_user_id`; UI labels are derived from the current user.
- Personal events are visible to both members but only editable/deletable by the owner.
- Existing event identity fields must not change: `space_id`, `created_by`, `scope`, `owner_user_id`.
- Supabase RLS and database triggers remain the final permission boundary.
- v0.1.4 uses only `profiles.display_name`, which is nullable and constrained to trimmed 1–20-character values. UI fallback is 「成员」; shared remains 「共同」.
- New profiles default to a null display name, never an Auth metadata or email-derived public name.
- No `space_members.nickname`, no profile/member Realtime subscription, and no RLS policy changes were added. A name change updates the saving device immediately; other sessions refresh/re-enter to see it.
- The current Production Supabase patch and SQL/RLS verification passed on 2026-07-11. Local two-account desktop smoke and deployed-frontend Production desktop smoke passed.
- Resend SMTP + Supabase Auth passwordless template deliver 8-digit Email OTP in Production. Email OTP removes Magic Link return handling; Safari and standalone PWA retain separate session storage and each complete login directly with the code.
- New-user first-login, new-space creation, and profiles/display_name behavior passed in v0.1.5 Production acceptance. The single-member-space path remains intentionally unverified.
- v0.1.6 recurrence rules are source-event metadata only. Existing event identity fields remain immutable; no recurrence table, occurrence materialization, exception model, RLS change, Realtime configuration change, reminder, or notification work is included. v0.1.6.2 projects only the current Today/Week/Month visible range and uses occurrence IDs only as display keys; v0.1.6.3 writes recurrence rules only on source events and labels all recurring edits/deletes as whole-series actions.
- The original v0.1.7 design is in `docs/RECURRENCE_EXCEPTIONS_DESIGN.md`. Its exception foundation, projection, database RPCs, and v0.1.7.3.3.2 only-this / this-and-future UI are implemented. Logical-series deletion UI remains deliberately deferred; exception Realtime publication remains future work.
- v0.1.7.1 foundation is present in the local schema and its 18-test pgTAP suite passes. v0.1.7.2 has a compatible reader/projection implementation. v0.1.7.3.3.2 supports only-this and this-and-future mutation UI; logical-series deletion UI and exception Realtime publication/subscriptions remain deliberately deferred.
- v0.1.7.3 treats `series_id` as the logical root and `parent_event_id` as the immediate predecessor. The final split RPC moves future exceptions to the child, consumes a split-day override, rejects a split-day deletion, preserves source recurrence rule/all-day, and requires the child to start on the selected occurrence date. The actual exception schema uses `event_id`, `occurrence_date`, `exception_type`, and `override_data`; the v0.1.7.3.3.2 client relies on the RPC for all transaction work.
- Final Production recurrence smoke passed on Desktop and iPhone Standalone PWA for all four supported occurrence actions. iOS Standalone PWA cannot actively refresh itself due to an iOS system limitation; this is not an application defect.
- `supabase/config.toml` uses a stable local `project_id` and configures a local 8-digit Mailpit OTP template plus the port-5175 redirect URL. The local Docker/Supabase stack was recovered without reset or volume deletion; C1 pgTAP 63/63 and all database regressions 161/161 passed.
- The engine uses native `Intl` IANA timezone formatting/conversion and rejects invalid rule shapes at both client and database boundaries. It returns an explicit error instead of a partial result after 500 candidates.
- C2 Phase 2 pre-implementation review identified a reproducible DST-gap CPU blocker in the legacy 2161-point minute fallback. The corrective patch preserves the existing minute-grid outputs while using the fixed-point candidates to bracket and binary-search proven forward gaps. Same-machine 1000-call Deno improved from `7099.71 ms` to `144.06 ms`; human review passed and `DUE_CALCULATOR_CPU_BLOCKER = RESOLVED / PASS`.
- v0.1.8.2 supersedes the earlier `events.reminder_offset_minutes` proposal. One event-level nullable `events.reminder_kind` supports `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder. Multiple reminders, JSON reminder config, arbitrary custom minutes, and per-user reminder preferences remain outside this version.
- `events.time_zone` is the nullable canonical IANA timezone of the Event. New events detect it from the creating browser/PWA with standard `Intl` capability; later device timezone changes never silently rewrite an existing Event. Historical ordinary timezone remains null rather than guessed, while historical recurring sources may initialize it from their already-authoritative rule timezone. Recurring Event `time_zone` must equal `recurrence_rule.time_zone`, so there is only one authoritative timezone.
- New UI-created timed events default to `timed_10m_before`; new UI-created all-day events default to `all_day_same_day_08`. Database defaults and all historical events remain `reminder_kind = null`; historical ordinary Event timezone is not guessed or bulk-backfilled.
- Timed-to-all-day conversion maps a non-null timed reminder to `all_day_same_day_08`; all-day-to-timed maps a non-null all-day reminder to `timed_10m_before`; null remains null and the UI must show the resulting option. Multi-day reminders anchor only to the start and ignore `ends_at`.
- v0.1.8.1 Push Infrastructure is closed and passed on Desktop Chrome/macOS and iPhone installed PWA. `push_subscriptions` uses RPC-only authenticated browser writes, `send-test-push` owns server-side VAPID delivery, and the private key remains only in Supabase secrets. Safe diagnostics expose only upstream `status`, `delivered`, hostname-only `provider`, and `gone`. `@mmmike/web-push@1.3.0` remains an exact function-level dependency; no root/browser dependency was added.
- The initial Desktop Chrome subscription was abnormal/stale: FCM accepted the send (`201`, `delivered = true`) but no notification appeared. Closing notifications, unsubscribing, and creating a fresh subscription restored Desktop test-push delivery. For similar Push symptoms, try retry, unsubscribe/resubscribe, and browser/PWA restart before deeper RCA.
- Standard Web Push is the delivery channel. The Push Service Worker handles Push only and must not introduce offline caching. Desktop and iPhone Slice 1 acceptance passed; Android permission, subscription, foreground/background/closed-app delivery, notification click, and logout lifecycle are deferred together to final v0.1.8 cross-platform acceptance. This is a validation strategy, not a blocker.
- Push subscriptions bind to `user + installation`, never to a Space, and one user may retain multiple active device/browser subscriptions. This persistence model remains compatible with a future multi-space schema without implementing multi-space in v0.1.8.
- shared event reminders resolve current active Space members at send time; personal event reminders resolve only the current `owner_user_id`. A former member must not receive a delivery.
- v0.1.8 uses one active once-per-minute Supabase Cron + Edge Function sender. Slice 2 ordinary Event delivery is closed. The local Slice 3 implementation dynamically projects recurring occurrences through canonical recurrence/exception semantics within a bounded timezone-aware window and does not materialize a future horizon.
- Slice 3 Reminder projection passes a non-mutating `ends_at = null` view to the canonical engine because Reminder due semantics depend only on effective occurrence start. The canonical calendar engine and its 500-candidate duration-overlap guard remain unchanged.
- Local Slice 3 extends ledger identity with nullable `occurrence_date`: ordinary rows keep NULL and retain `(event_id, subscription_id, due_at)` behavior through `NULLS NOT DISTINCT`; recurring rows use logical series ID plus scheduled occurrence date, subscription, and due. No queue, future rows, retry framework, or occurrence table was added.
- Slice C1 implementation, verification, human review, Production deployment, ACL correction, and final postflight are complete. The original patch created the empty durable ledger and atomic claim function; RCA isolated its ACL gate failure to the `postgres`/`public` default table ACL, and the reviewed table-local correction reduced `service_role` to SELECT / UPDATE only. `C1_PRODUCTION_FOUNDATION = PASS`. Audit rows intentionally have no Event/user/subscription foreign keys. The schedule marker must still round-trip at full PostgreSQL `timestamptz` precision.
- Slice C2 Phase 1 extracts Web Push sending into a server-only shared module with a closed safe result union and keeps `send-test-push` externally unchanged. Automated verification and Desktop/iPhone real-device regression passed after deploying only `send-test-push`. Repeated Desktop banners with the fixed `shared-calendar-test` tag are pre-existing/non-blocking; tag/renotify behavior remains unchanged. The later C2 scan must abort before claims/sends when enabled ordinary Events exceed 1000, and must sort eligible tasks by `due_at` ascending before capping at 50; no queue is added.
- Slice C2 Phase 2 `send-reminders` passed bounded human/code review with no BLOCKER / MAJOR / MINOR findings and completed P3B Production manual acceptance. It uses stable 100-row keyset pages plus an explicit 1001st-row probe, aborts overflow before recipient/claim/send work, preserves the raw C1 schedule marker, resolves current memberships and active subscriptions in batches, selects at most 50 tasks deterministically, uses five workers, and rechecks the 95-second budget immediately before claim acquisition. It adds no retry, lease, queue, recurring delivery, schema, or dependency. P3B delivered one iPhone Reminder, finalized two ledger rows, and passed idempotency; Mac visible delivery was initially suppressed by Sleep/Focus and later send-test-push regression passed after that state was cleared.
- P3C enabled only Vault, `pg_cron`, and `pg_net`, then created exactly one active once-per-minute scheduler whose stored command performs the `REMINDER_CRON_SECRET` Vault lookup at execution time. Automatic no-due and real iPhone/Mac Reminder delivery passed without manual invocation. Two subscription-specific ledger rows finalized as `sent`; repeated scheduler runs created no duplicate row or send. The canonical failure containment is to unschedule `send-reminders-every-minute` first, before diagnosis.
- A newly created/edited/enabled reminder whose derived `due_at` is already past is skipped without immediate Push or compensation. Normal target precision is about one minute; a roughly ten-minute grace window applies only to infrastructure delay. Web Push remains best-effort and is not an Alarm Clock.
- v0.1.8 excludes Email reminder delivery, SMS, Bark, multiple reminders, arbitrary custom minutes, snooze, sound customization, notification inbox/history, native alarms, and per-user reminder preferences. Email OTP authentication remains unchanged.
- `v0.1.9 Shared Tasks`, `v0.1.10 Shared Lists`, `v0.1.11 Important Dates / Anniversaries`, and `v0.1.12 Tags / Color = Who` are roadmap directions only, not frozen architectures. UI/UX overhaul remains deferred pending a Design System.

## Handoff Prompt

v0.1.8 remains OPEN. `v0.1.8.2` ordinary Slice A/B/C are closed and Production ordinary delivery/scheduler remain live and unchanged. Slice 3 Recurrence Reminder Integration source is committed and pushed to `origin/main`; final human/code review and the bounded long-duration correction re-review are PASS with no remaining findings. It reuses the one canonical recurrence engine, preserves calendar behavior/caps and ordinary Reminder regression, and adds no dependency, queue, materialization, new Function, or Cron. Slice 3 is not deployed. Next: separately authorize and execute the bounded Slice 3 Production rollout; final Android/cross-platform acceptance remains later and separate.
