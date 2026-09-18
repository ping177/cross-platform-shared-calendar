# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.8.1 (Push Infrastructure Foundation)

## Current status

Calendar Core 与 Recurring Events 已完成并通过 Production 验收。`v0.1.8.1 — Push Infrastructure Foundation` 已在仓库实现，状态为 `IMPLEMENTED / VALIDATION PENDING`：自动测试和 production build 已通过，但 Supabase patch、VAPID secrets、Edge Function/Vercel deployment 与 Desktop/iPhone/Android 真机 Push 验收尚未执行。Production 当前仍运行已验收的 v0.1.7.3.3.2。

## Latest completed

Implemented v0.1.8 Slice 1 in the repository: Push-only Service Worker, explicit notification settings and permission flow, stable installation identity, `push_subscriptions` canonical/patch SQL, authenticated lifecycle RPCs, function-only `@mmmike/web-push@1.3.0`, current-installation test-push Edge Function, and logout cleanup. Twenty-one Node tests and the production build passed. The 22-assertion pgTAP suite exists but remains unexecuted because local Supabase was unavailable. No cloud configuration, Production database mutation, deploy, commit, or push occurred.

## Deployment

Status: public_deployed
Public URL: https://cross-platform-shared-calendar.vercel.app/
Provider: Vercel
Backend: Supabase Free
Notes: 已完成公网部署，用于真实设备访问和跨端验收。

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
- v0.1.8.1 — Push Infrastructure Foundation（repository implemented；cloud / real-device validation pending）

## Last verified

2026-09-18

## Next Action

执行 v0.1.8.1 人工验证：应用 `2026-09-18-v0.1.8.1-push-infrastructure.sql`，配置 Supabase VAPID secrets 并部署 `send-test-push`，在 Vercel 配置同一 public key 后重新部署，再完成 Desktop、iPhone installed PWA 与 Android installed PWA 的 permission / subscribe / foreground-background-closed test push。验证通过并单独批准后，才进入 Slice 2 reminder persistence；recurrence Realtime 与 DST-zone coverage 仍是 non-blocking follow-up。

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
- `supabase/config.toml` uses a stable local `project_id`; the local database/API/Auth/Mailpit stack is reachable. It configures a local 8-digit Mailpit OTP template and port-5175 redirect URL only; the local status currently reports stopped imgproxy and pooler services, which do not block Postgres, Auth, Mailpit, or pgTAP validation.
- The engine uses native `Intl` IANA timezone formatting/conversion and rejects invalid rule shapes at both client and database boundaries. It returns an explicit error instead of a partial result after 500 candidates.
- v0.1.8 uses one event-level reminder stored as nullable `events.reminder_offset_minutes`; allowed values are `0`, `10`, `30`, `60`, and `1440`, with `null` meaning no reminder. Multiple reminders, arbitrary custom minutes, and per-user reminder preferences are outside this version.
- v0.1.8.1 repository implementation is complete but not deployed: `push_subscriptions` uses RPC-only authenticated browser writes, `send-test-push` owns server-side VAPID delivery, and the private key must remain only in Supabase secrets. `@mmmike/web-push@1.3.0` is an exact function-level dependency; no root/browser dependency was added.
- Standard Web Push is the delivery channel. The Push Service Worker handles Push only and must not introduce offline caching. iPhone and Android installed PWAs are the primary mobile targets; Desktop is also part of acceptance coverage.
- Push subscriptions bind to `user + installation`, never to a Space, and one user may retain multiple active device/browser subscriptions. This persistence model remains compatible with a future multi-space schema without implementing multi-space in v0.1.8.
- shared event reminders resolve current active Space members at send time; personal event reminders resolve only the current `owner_user_id`. A former member must not receive a delivery.
- Supabase Cron runs every minute and invokes an Edge Function sender. The sender dynamically projects due ordinary and recurring occurrences through the canonical recurrence/exception semantics; it does not materialize a long horizon of future reminders.
- Delivery idempotency is due-time aware: recurring `(logical_series_id, occurrence_key, subscription_id, due_at)` and one-off `(event_id, "once", subscription_id, due_at)`. A changed start or reminder offset may create a new legitimate delivery; unchanged `due_at` must not duplicate, including across a future split.
- Normal target precision is about one minute. A simple configurable grace window may compensate reminders missed within roughly ten minutes; older reminders are not sent late. Web Push remains best-effort and is not an Alarm Clock.
- v0.1.8 excludes Email reminder delivery, SMS, Bark, multiple reminders, arbitrary custom minutes, snooze, sound customization, notification inbox/history, native alarms, and per-user reminder preferences. Email OTP authentication remains unchanged.
- `v0.1.9 Shared Tasks`, `v0.1.10 Shared Lists`, `v0.1.11 Important Dates / Anniversaries`, and `v0.1.12 Tags / Color = Who` are roadmap directions only, not frozen architectures. UI/UX overhaul remains deferred pending a Design System.

## Handoff Prompt

Validate v0.1.8.1 without expanding scope: apply the reviewed additive patch, configure Supabase VAPID secrets, deploy `send-test-push`, configure the matching Vercel public key, and perform Desktop/iPhone installed-PWA/Android installed-PWA test-push acceptance. Keep status `IMPLEMENTED / VALIDATION PENDING` until those checks pass. Do not start Slice 2, add `events.reminder_offset_minutes`, Cron, scheduler, recurrence delivery, offline caching, or another delivery channel without separate approval. Keep recurrence Realtime/DST coverage non-blocking and do not expose `delete_logical_series` UI.
