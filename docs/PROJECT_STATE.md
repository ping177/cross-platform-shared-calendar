# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.7.3.3.1 (Split RPC Correctness Patch)

## Current status

v0.1.7.3.3.1 database foundation 已在本地 Supabase 验证；前端 scope integration 尚未开始，Production patch 与部署仍保持 e7decd1 状态。

## Latest completed

v0.1.7.3.2 preserves `CalendarOccurrence → EventEditTarget → EventSheet` context. Occurrence drafts hydrate title, description, `occurrence_starts_at`, `occurrence_ends_at`, and all-day display state from the projection while the source event remains responsible for identity, permission, recurrence rule, and series metadata. Only-this save uses `upsert_occurrence_override`; delete uses `delete_occurrence`; override data is limited to `title`, `description`, `starts_at`, and `ends_at`. Occurrence mode does not allow recurrence-rule or all-day changes. The v0.1.7.3.1 Production patch is applied to `ximazjhxvmktpcdbypka`, its PostgREST schema cache is reloaded, and all four RPCs exist.

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

## Last verified

2026-07-18

## Next Action

Start v0.1.7.3.3 Split Recurring Event as a separate approved slice: implement “此次及未来事件” with `split_recurring_event`, old-segment cutoff, child segment lineage, a modified occurrence as the future-segment anchor, rebuilt recurrence cadence, and dedicated timezone/DST validation. Do not treat logical-series deletion as completed.

## Blockers

No blocker for v0.1.7.3.2. v0.1.7.3.3 requires separate UX, split-anchor, cadence, and timezone/DST approval/verification. Final two-session Realtime/device coverage remains a separate product-quality checkpoint.

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
- The original v0.1.7 design is in `docs/RECURRENCE_EXCEPTIONS_DESIGN.md`. Its exception foundation, projection, database RPCs, and v0.1.7.3.2 only-this UI are now implemented; split/end-from-here UI, logical-series deletion UI, and exception Realtime publication remain future work.
- v0.1.7.1 foundation is present in the local schema and its 18-test pgTAP suite passes. v0.1.7.2 has a compatible reader/projection implementation. v0.1.7.3.2 adds only-this mutation UI, but intentionally omits split/end-from-here UI, logical-series deletion UI, and exception Realtime publication/subscriptions.
- v0.1.7.3 design treats `series_id` as the logical root and `parent_event_id` as the immediate predecessor. Exceptions stay attached to their original source segment; a split count-confirms and removes only old-segment exceptions made unreachable by the new cutoff. The actual exception schema uses `event_id`, `occurrence_date`, `exception_type`, and `override_data`.
- v0.1.7.3.1 split currently retains all exceptions on the old segment and never migrates them; unreachable future exceptions are not cleaned in this foundation slice because no user count-confirmation UI/contract exists yet. Split also requires the child to retain the source recurrence timezone and begin on the selected local occurrence date.
- `supabase/config.toml` uses a stable local `project_id`; the local database/API/Auth/Mailpit stack is reachable. It configures a local 8-digit Mailpit OTP template and port-5175 redirect URL only; the local status currently reports stopped imgproxy and pooler services, which do not block Postgres, Auth, Mailpit, or pgTAP validation.
- The engine uses native `Intl` IANA timezone formatting/conversion and rejects invalid rule shapes at both client and database boundaries. It returns an explicit error instead of a partial result after 500 candidates.

## Handoff Prompt

Continue 跨系统共享日历 with a separately approved v0.1.7.3.3 Split Recurring Event slice. Preserve the verified only-this flow and use `split_recurring_event` rather than composing source updates in the client. Design the scope UI, child anchor/cadence reconstruction, old-segment cutoff, lineage, and timezone/DST checks before implementation. Do not add logical-series deletion UI, reminders, materialized occurrences, or unapproved Realtime behavior.
