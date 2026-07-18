# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.7.2 (Exception Expansion Engine)

## Current status

v0.1.7.2 Exception Expansion Engine 已完成并通过 Production 验证。v0.1.7.3.1 Database RPC Foundation 已在仓库与 local Supabase 实现/验证：only-this override/delete、atomic split 和 logical-series delete 均通过函数内权限复核与 optional `updated_at` concurrency 检查；React/UI integration 尚未开始。

## Latest completed

v0.1.7.3.1 database foundation completed locally: `2026-07-18-v0.1.7.3-series-editing.sql` adds fixed-`search_path`, permission-checked RPCs for occurrence override/delete, series split, and logical-series deletion. The local 15-test pgTAP suite plus the v0.1.7.1 18-test regression suite pass. The patch is not applied to Production.

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
- v0.1.7.1 — Recurrence Exceptions Database Foundation（local schema/pgTAP 已验证；Production 待单独审批）
- v0.1.7.2 — Exception Expansion Engine（Production 已验证）
- v0.1.7.3 — Recurrence Editing Semantics Design（设计完成，待人工 review/implementation approval）
- v0.1.7.3.1 — Database RPC Foundation（local patch + pgTAP 已验证；Production 待单独审批）

## Last verified

2026-07-18

## Next Action

Review the local RPC contract and perform a separate Production patch preflight/approval before applying it. Only after database deployment/verification may a new task add occurrence-aware React/UI scope selection and RPC integration.

## Blockers

Production application of the v0.1.7.3.1 patch is pending separate preflight/approval. React/UI scope selection and Realtime reload/subscription work are intentionally out of this database-only task. Final two-session Realtime/device coverage remains a separate product-quality checkpoint. Native `Intl` DST behavior still needs supported-browser verification before it is claimed.

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
- v0.1.7 is design-only. The proposed design is in `docs/RECURRENCE_EXCEPTIONS_DESIGN.md`; it has not added `event_occurrence_exceptions`, source lineage/cutoff fields, RPCs, RLS, Realtime publication, or UI behavior.
- v0.1.7.1 foundation is present in the local schema and its 18-test pgTAP suite passes. v0.1.7.2 now has a compatible reader/projection implementation, but it must not deploy before a target environment contains the exception table. Both versions intentionally omit mutation UI, split/end-from-here RPCs, and Realtime publication/subscriptions.
- v0.1.7.3 design treats `series_id` as the logical root and `parent_event_id` as the immediate predecessor. Exceptions stay attached to their original source segment; a split count-confirms and removes only old-segment exceptions made unreachable by the new cutoff. The actual exception schema uses `event_id`, `occurrence_date`, `exception_type`, and `override_data`.
- v0.1.7.3.1 split currently retains all exceptions on the old segment and never migrates them; unreachable future exceptions are not cleaned in this foundation slice because no user count-confirmation UI/contract exists yet. Split also requires the child to retain the source recurrence timezone and begin on the selected local occurrence date.
- `supabase/config.toml` uses a stable local `project_id`; the local database/API/Auth/Mailpit stack is reachable. It configures a local 8-digit Mailpit OTP template and port-5175 redirect URL only; the local status currently reports stopped imgproxy and pooler services, which do not block Postgres, Auth, Mailpit, or pgTAP validation.
- The engine uses native `Intl` IANA timezone formatting/conversion and rejects invalid rule shapes at both client and database boundaries. It returns an explicit error instead of a partial result after 500 candidates.

## Handoff Prompt

Continue 跨系统共享日历 by performing an approved Production preflight for `2026-07-18-v0.1.7.3-series-editing.sql`, then applying and verifying it once. After that, a separate approved UI task can pass occurrence context into these RPCs. Do not add reminders, materialized occurrences, or unapproved Realtime behavior. Also preserve the pending v0.1.6 two-client/device recurrence acceptance.
