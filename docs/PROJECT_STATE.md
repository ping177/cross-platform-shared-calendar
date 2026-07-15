# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.5

## Current status

v0.1.5 Email OTP 登录 UX 已完成仓库实现、SMTP/邮件模板配置与本地登录回归，等待人工多端验收。用户可在当前浏览器或 PWA 中输入 8 位验证码，不再依赖 Magic Link 的邮件客户端回跳。数据库、RLS、日程与成员逻辑保持不变。

## Latest completed

v0.1.5 AuthPage now supports send/verify Email OTP, numeric 8-digit input, autofocus, change-email, and a 60-second resend cooldown while retaining the existing Supabase session listener.

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

## Last verified

2026-07-14

## Next Action

Deploy when approved, and complete the v0.1.5 desktop/iPhone/Android browser and PWA acceptance checklist.

## Blockers

None known.

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
- v0.1.5 requires the Supabase passwordless email template to use `{{ .Token }}`. Email OTP removes Magic Link return handling, but Safari and standalone PWA still keep separate session storage and must each be logged in directly.
- The single-member-space path and new-user first-login behavior remain intentionally unverified.

## Handoff Prompt

Continue 跨系统共享日历 by configuring and manually accepting v0.1.5 Email OTP. Do not rerun `supabase/patches/2026-07-11-v0.1.4-member-display-name.sql`, loosen RLS, modify protected event identity fields, or add nickname/Realtime scope without a separate decision.
