# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.7.2 (Exception Expansion Engine)

## Current status

v0.1.7.2 的纯前端 exception expansion 已在仓库实现：读取 source events 与 `event_occurrence_exceptions`，以 source rule timezone 的 scheduled local date 匹配异常，投影 deleted/override 结果，并支持 moved override 跨 Today、Week、Month 可见范围。当地 Supabase schema 已包含 v0.1.7.1 foundation，且 pgTAP 通过；本次未修改或向 Production 应用 SQL。Local Supabase Email OTP 已恢复并完成 authenticated Calendar 登录；exception 的 Today/Week/Month 可视验收仍待执行。

## Latest completed

v0.1.7.2 exception expansion completed locally: occurrence IDs now use `event_id:occurrence_date`; deleted exceptions suppress scheduled candidates; whitelisted override fields update display values while starts-only changes preserve duration; and overrides moved into/out of the active range are reprojected correctly. Local integration confirmed the exception-table contract and passed the v0.1.7.1 pgTAP suite (18 tests); isolated deleted/override rows were inserted and read back successfully. Local Auth now sends Mailpit-delivered 8-digit OTPs compatible with the existing UI, and browser OTP verification reaches the Calendar page.

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
- v0.1.7.2 — Exception Expansion Engine（纯 projection + reader integration；local Authenticated Calendar 登录已验证，exception 可视验收待执行）

## Last verified

2026-07-18

## Next Action

Use the existing isolated local exception rows to complete Today/Week/Month browser verification: deleted occurrence absent, override time changed, and stable occurrence identity. Local Email OTP can use the Mailpit-delivered 8-digit code at `http://127.0.0.1:5175`. Do not apply a patch to Production without a separate preflight/approval.

## Blockers

Final acceptance is blocked on two existing Email OTP sessions for real Realtime transport verification and supported-device browser smoke. Local v0.1.7.2 exception Calendar verification is pending but no longer Auth-blocked. Native `Intl` is used without a new dependency; DST-zone behavior still needs supported-browser verification before it is claimed.

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
- `supabase/config.toml` uses a stable local `project_id`; the local database/API/Auth/Mailpit stack is reachable. It configures a local 8-digit Mailpit OTP template and port-5175 redirect URL only; the local status currently reports stopped imgproxy and pooler services, which do not block Postgres, Auth, Mailpit, or pgTAP validation.
- The engine uses native `Intl` IANA timezone formatting/conversion and rejects invalid rule shapes at both client and database boundaries. It returns an explicit error instead of a partial result after 500 candidates.

## Handoff Prompt

Continue 跨系统共享日历 by signing in to the local Vite app with a Mailpit-delivered 8-digit OTP and verifying the existing isolated v0.1.7.2 deleted/override rows in Today, Week, and Month. Apply no patch to Production without explicit preflight/approval. Do not add mutation UI, split/end-from-here behavior, Realtime, reminders, or materialized occurrences without a new approved task. Also preserve the pending v0.1.6 two-client/device recurrence acceptance.
