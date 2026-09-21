# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.8.2 (Phase 3 send-reminders auth config — PREPARED / HUMAN REVIEW PASS)

## Current status

Calendar Core 与 Recurring Events 已完成并通过 Production 验收。`v0.1.8.1 — Push Infrastructure Foundation` 保持 `CLOSED / PASS — Android final acceptance deferred`。`v0.1.8.2` Slice A 与 Slice B 已关闭。Slice C1 Minimal Delivery Ledger + Atomic Claim 已完成 implementation、verification、human review 与 push；其 database changes 尚未部署到 Production。Slice C2 Phase 1 server-only shared Web Push sender extraction 与 C2 Phase 2 `send-reminders` core orchestration 均为 `CLOSED / PASS`；Phase 2 已完成本地实现、自动验证、bounded human/code review 与 push。Due Calculator DST-gap CPU blocker 已完成 corrective implementation、verification 与 human review，`DUE_CALCULATOR_CPU_BLOCKER = RESOLVED / PASS`。Phase 3 repository-only auth configuration preparation 已加入 source-controlled `verify_jwt = false`，使未来 Cron custom bearer 可到达现有 application auth；该准备已通过 human review，并已 push。`send-reminders`、C1 均未部署，`REMINDER_CRON_SECRET`、Vault、pg_cron、pg_net 与 Reminder Cron 均未配置或变更，Slice C 整体仍未关闭。

## Latest completed

Prepared the bounded Phase 3 repository auth configuration by adding `[functions.send-reminders] verify_jwt = false` beside the existing `send-test-push` function stanza. The existing high-entropy `Authorization: Bearer <REMINDER_CRON_SECRET>` application check remains authoritative and still runs before Supabase client/database access; no function code or secret value changed. Focused `send-reminders` tests passed 26/26, Deno checked both the function entry and orchestration logic, and `npm run build` passed. Bounded human review passed with no findings. No deployment, Production invocation/data change, C1 application, secret generation/configuration, Vault entry, pg_cron/pg_net enablement, or Cron job occurred; the reviewed auth-config commit is pushed; C1 and `send-reminders` remain undeployed and Slice C remains open.

## Deployment

Status: public_deployed
Public URL: https://cross-platform-shared-calendar.vercel.app/
Provider: Vercel
Backend: Supabase Free
Notes: 现有公网版本继续服务；Slice B Production migration/deployment/acceptance 已完成。Slice C1 additive patch 尚未应用到 Production。仅 `send-test-push` 部署了 C2 Phase 1 sender extraction，并完成 Desktop/iPhone real-device regression。C2 Phase 2 `send-reminders` 仅在仓库中实现，Phase 3 auth config 已 push 为 source-controlled preparation；两者均未部署。Cron、Vault、pg_cron、pg_net 与真实 secret 均未配置或变更，Production 未受本次 preparation 影响。Android Push lifecycle 仍按 validation strategy 延后。

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
- v0.1.8.2 — Reminder Persistence + Ordinary Event Delivery（Slice A/B closed；Slice C1 complete/reviewed/pushed but undeployed；Slice C2 Phase 1 CLOSED / PASS；Due Calculator DST-gap correction human-review PASS；C2 Phase 2 send-reminders implemented locally/automated verification PASS/human-code review PASS/no findings；implementation commit `bb6a5e0` pushed；Cron not started；Slice C open）

## Last verified

2026-09-21

## Next Action

After this post-push governance freshness closeout, request separate authorization for P3A Production C1 preflight and deployment only; do not deploy `send-reminders` or configure secrets/Vault/Cron yet.

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
- v0.1.8 freezes a one-minute Supabase Cron + Edge Function sender architecture. Slice 2 will implement ordinary events; Slice 3 will dynamically project recurring occurrences through canonical recurrence/exception semantics without materializing a long horizon.
- Slice 2 ordinary-delivery idempotency is `(event_id, subscription_id, due_at)`. It does not add `occurrence_key`, pre-generate pending rows, mutate ledger rows when an Event schedule changes, or automatically retry provider failures. Recurring occurrence identity remains a Slice 3 decision.
- Slice C1 implementation, verification, and human review are complete; commit `6902234c40fbfb397d0ed271ec8ea213b7498e88` is pushed to `origin/main`. The durable server-only `reminder_deliveries` ledger and one service-role-only atomic claim remain undeployed to Production. Audit rows intentionally have no Event/user/subscription foreign keys. The expected `reminder_schedule_changed_at` must round-trip at full PostgreSQL `timestamptz` precision; future callers must not normalize, truncate, or reconstruct it through a lossy JavaScript formatting path.
- Slice C2 Phase 1 extracts Web Push sending into a server-only shared module with a closed safe result union and keeps `send-test-push` externally unchanged. Automated verification and Desktop/iPhone real-device regression passed after deploying only `send-test-push`. Repeated Desktop banners with the fixed `shared-calendar-test` tag are pre-existing/non-blocking; tag/renotify behavior remains unchanged. The later C2 scan must abort before claims/sends when enabled ordinary Events exceed 1000, and must sort eligible tasks by `due_at` ascending before capping at 50; no queue is added.
- Slice C2 Phase 2 `send-reminders` is implemented locally and passed bounded human/code review with no BLOCKER / MAJOR / MINOR findings. It uses stable 100-row keyset pages plus an explicit 1001st-row probe, aborts overflow before recipient/claim/send work, preserves the raw C1 schedule marker, resolves current memberships and active subscriptions in batches, selects at most 50 tasks deterministically, uses five workers, and rechecks the 95-second budget immediately before claim acquisition. It adds no retry, lease, queue, recurring delivery, schema, or dependency and is not deployed.
- A newly created/edited/enabled reminder whose derived `due_at` is already past is skipped without immediate Push or compensation. Normal target precision is about one minute; a roughly ten-minute grace window applies only to infrastructure delay. Web Push remains best-effort and is not an Alarm Clock.
- v0.1.8 excludes Email reminder delivery, SMS, Bark, multiple reminders, arbitrary custom minutes, snooze, sound customization, notification inbox/history, native alarms, and per-user reminder preferences. Email OTP authentication remains unchanged.
- `v0.1.9 Shared Tasks`, `v0.1.10 Shared Lists`, `v0.1.11 Important Dates / Anniversaries`, and `v0.1.12 Tags / Color = Who` are roadmap directions only, not frozen architectures. UI/UX overhaul remains deferred pending a Design System.

## Handoff Prompt

v0.1.8.2 Phase 3 rollout planning is complete (`PHASE3_ROLLOUT_PLAN_READY`). Repository-only auth preparation exists and is pushed: `supabase/config.toml` contains `[functions.send-reminders] verify_jwt = false`; focused verification passed; and bounded human review passed with no remaining findings. No Production deployment or C1 Production deployment occurred, no secret is configured, Vault/Cron/`pg_cron`/`pg_net` remain untouched, and Slice C remains open. Next: after this governance freshness closeout, separately authorize P3A Production C1 preflight/deployment. Do not execute rollout steps without separate authorization.
