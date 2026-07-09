# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.3

## Current status

项目已完成共享日历 MVP、权限修正、v0.1.3 event form UX defaults、Production smoke test，以及 Android Chrome 真实设备兼容性验收。Backend 当前使用 Supabase Free，项目状态为 Active；daily Vercel Cron keep-alive 已启用，首次 Production Cron 调用已验证为 HTTP 200。

## Latest completed

Supabase Free keep-alive is active: the Cron Job is registered, unauthenticated access returns 401, and the first scheduled Production invocation returned HTTP 200.

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

## Last verified

2026-07-09

## Next Action

Decide the next product scope: member nicknames/display names/member list, continued event create/edit UX polish, or v0.2 reminder / anniversary / countdown planning.

## Blockers

None known.

## Important Context

- Git branch、latest commit、working tree 由 project-command-center 实时 Git 扫描读取；PROJECT_STATE.md 不作为这些字段的权威来源。
- Production URL: `https://cross-platform-shared-calendar.vercel.app/`.
- Supabase project status is currently Active, but Free Tier inactivity pause remains an operational risk.
- A Supabase pause may affect Auth, Database, RLS, and Realtime until the project is restored.
- Daily Vercel Cron keep-alive calls `/api/supabase-keepalive` with `CRON_SECRET` and uses the anon key for head-only read checks; the first Production Cron invocation returned HTTP 200.
- Keep-alive is active, but its long-term effectiveness against inactivity pauses still requires observation.
- Continue using Supabase Cloud for now; do not upgrade to Pro or migrate the backend unless real usage requires it.
- README is the project entrypoint; detailed smoke checklists and production validation records live in `docs/TESTING.md`.
- Android compatibility smoke test is complete for Xiaomi 14 / Android 16 / Chrome on mobile network.
- v0.1 is a Web/PWA, not native iOS / Android.
- Event ownership uses stable `scope + owner_user_id`; UI labels are derived from the current user.
- Personal events are visible to both members but only editable/deletable by the owner.
- Existing event identity fields must not change: `space_id`, `created_by`, `scope`, `owner_user_id`.
- Supabase RLS and database triggers remain the final permission boundary.

## Handoff Prompt

Continue 跨系统共享日历 by choosing the next product scope after completed Android compatibility verification. Good candidates are member nicknames/display names/member list, continued event create/edit UX polish, or v0.2 reminder / anniversary / countdown planning. Do not loosen personal-event ownership rules or modify protected identity fields.
