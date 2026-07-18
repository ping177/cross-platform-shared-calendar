# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.7.1 (Recurrence Exceptions — Database Foundation)

## Current status

v0.1.7.1 数据库基础层已在仓库中实现，尚未应用到任何 Supabase 环境：新增 additive patch、`events` lineage/cutoff 设计的 SQL 基础、exception table、继承 event 权限的 RLS，以及 pgTAP CRUD/RLS 测试。`schema.sql` 已补充 authenticated 基础 table GRANT，使请求可进入既有 RLS 判断；未放宽 policy。未修改 recurrence expansion、frontend、UI、Realtime、依赖或现有 patch。v0.1.6 最终真实浏览器与双客户端 Realtime 验收仍待执行。

## Latest completed

v0.1.7.1 database foundation completed locally: `2026-07-18-v0.1.7.1-database-foundation.sql` adds nullable event lineage/cutoff fields, backfills recurring roots, creates `event_occurrence_exceptions`, applies segment-local validation and inherited RLS, and adds a pgTAP test. `schema.sql` now grants only policy-matched base operations to `authenticated`, so RLS can evaluate them. No patch was applied to Production; pgTAP execution is pending local Docker/Postgres.

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
- v0.1.7.1 — Recurrence Exceptions Database Foundation（migration + RLS + pgTAP，待数据库执行与人工 review）

## Last verified

2026-07-17

## Next Action

Install and start Docker Desktop locally, then run `supabase start` and `supabase test db --local supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql`. The `schema.sql` authenticated GRANT prerequisite is now present; verify that RLS, not table privilege denial, controls the test cases. `supabase/config.toml` was initialized on 2026-07-18 with `project_id = "cross-platform-shared-calendar"`; its prior absence caused the CLI configuration failure. Do not apply the patch to Production without a separate preflight/approval. After database verification, continue the documented pure-expansion slice; separately retain the pending v0.1.6 two-client Realtime and device acceptance.

## Blockers

Final acceptance is blocked on two existing Email OTP sessions for real Realtime transport verification and supported-device browser smoke. Local Supabase start/pgTAP is additionally blocked because Docker Desktop and the Docker CLI are not installed on this machine; the repaired `config.toml` has passed CLI configuration parsing. Do not alter Auth settings to bypass it. Native `Intl` is used without a new dependency; DST-zone behavior still needs supported-browser verification before it is claimed.

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
- v0.1.7.1 has a local, un-applied database patch and pgTAP test only. It intentionally omits exception projection, split/end-from-here RPCs, frontend/UI changes, and Realtime publication/subscriptions. Local Supabase CLI testing is currently blocked because the local Postgres instance is unavailable; no linked/Production fallback was attempted.
- `supabase/config.toml` was absent and is now initialized with a stable local `project_id`; `supabase start` now reaches Docker startup instead of failing configuration validation. Docker Desktop/CLI are absent, so no local containers can start until the user installs and starts Docker.
- The engine uses native `Intl` IANA timezone formatting/conversion and rejects invalid rule shapes at both client and database boundaries. It returns an explicit error instead of a partial result after 500 candidates.

## Handoff Prompt

Continue 跨系统共享日历 by installing/starting Docker Desktop, then using the repaired local `supabase/config.toml` to run `supabase start` and the un-applied v0.1.7.1 pgTAP suite locally. Apply no patch to Production without explicit preflight/approval. Then implement the approved pure-expansion slice; later work must preserve `series_id + parent_event_id`, segment-local exceptions, and count-confirmed invalid-future-exception cleanup. Do not loosen RLS, alter Auth settings, materialize occurrences, or expand into reminders, notifications, colors, or multi-space. Also preserve the pending v0.1.6 two-client/device recurrence acceptance.
