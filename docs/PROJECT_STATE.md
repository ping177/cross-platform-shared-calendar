# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.6.3 (Recurring Events UI Implementation)

## Current status

v0.1.6.3 已完成 recurring source event 的创建/编辑 UI。表单支持不重复、daily、weekly、monthly、yearly 及其最小选择器，以浏览器 `Intl` timezone 生成受限 v1 `recurrence_rule`；所有 occurrence 操作都回到 source event，编辑/删除明确作用于整个系列。无 exception、单次 occurrence 操作或数据库/RLS 变更。最终真实浏览器与双客户端 Realtime 验收尚待执行。

## Latest completed

v0.1.6.3 Recurrence UI completed locally: existing EventSheet now saves valid v1 recurrence rules or null to the source event, renders user-facing whole-series controls, and has no occurrence persistence path. 17 Node tests, the production build, and diff hygiene pass; Supabase/RLS/Realtime configuration remains untouched.

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

## Last verified

2026-07-17

## Next Action

Run final recurrence acceptance with two existing independently authenticated Email OTP browser sessions: create, edit, and delete daily/weekly/monthly/yearly source series; confirm Today/Week/Month reproject correctly and observe the second client receive the source-row Realtime update. Then smoke the recurrence form on iPhone Safari and Android Chrome/PWA.

## Blockers

Final acceptance is blocked on two existing Email OTP sessions for real Realtime transport verification and supported-device browser smoke. Do not alter Auth settings to bypass it. Native `Intl` is used without a new dependency; DST-zone behavior still needs supported-browser verification before it is claimed.

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
- The engine uses native `Intl` IANA timezone formatting/conversion and rejects invalid rule shapes at both client and database boundaries. It returns an explicit error instead of a partial result after 500 candidates.

## Handoff Prompt

Continue 跨系统共享日历 by performing final v0.1.6 recurrence acceptance with two existing Email OTP browser sessions. Verify source-series create/edit/delete and occurrence re-projection in Today/Week/Month, then observe the second client receive the source-row Realtime update. Also smoke iPhone Safari and Android Chrome/PWA recurrence forms. Do not rerun the already-applied v0.1.4 or v0.1.6.1 patches, loosen RLS, alter Auth settings, add exceptions/single-occurrence operations, materialize occurrences, add a recurrence table, or expand into reminders, notifications, colors, or multi-space.
