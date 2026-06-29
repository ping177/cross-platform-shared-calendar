# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.3

## Current status

项目已完成共享日历 MVP、权限修正和生产 smoke test 记录。当前开发暂缓，等待 Android 设备返回后继续做跨端真实验收。

## Latest completed

P1-4 docs-only cleanup 已完成：README 指向 `docs/TESTING.md`，`docs/BACKLOG.md` 按 P0-P3 优先级整理。

## Deployment

Status: public_deployed
Public URL: https://cross-platform-shared-calendar.vercel.app/
Provider: Vercel
Notes: 已完成公网部署，用于真实设备访问和跨端验收。

## Last verified

2026-06-25

## Next Action

Android 设备可用后，继续验证跨端登录、加入空间、事件同步和权限表现。

## Blockers

等待 Android 设备返回后继续跨端验收。

## Important Context

- Git branch、latest commit、working tree 由 project-command-center 实时 Git 扫描读取；PROJECT_STATE.md 不作为这些字段的权威来源。
- Production URL: `https://cross-platform-shared-calendar.vercel.app/`.
- README is the project entrypoint; detailed smoke checklists and production validation records live in `docs/TESTING.md`.
- v0.1 is a Web/PWA, not native iOS / Android.
- Event ownership uses stable `scope + owner_user_id`; UI labels are derived from the current user.
- Personal events are visible to both members but only editable/deletable by the owner.
- Existing event identity fields must not change: `space_id`, `created_by`, `scope`, `owner_user_id`.
- Supabase RLS and database triggers remain the final permission boundary.

## Handoff Prompt

Continue 跨系统共享日历 by running authenticated Android CRUD verification against the production flow, then decide whether reminders, anniversaries, and countdowns should enter v0.2. Do not loosen personal-event ownership rules or modify protected identity fields.
