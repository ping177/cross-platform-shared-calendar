# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.3

## Current status

Two-person shared calendar Web/PWA using React, Vite, TypeScript, Tailwind, and Supabase Auth/Postgres/RLS/Realtime. Production HTTPS deployment is available, and v0.1.3 event-form default end-time behavior has been verified in a real browser.

## Latest completed

v0.1.3 event form UX defaults: new event drafts default end time to start time plus 1 hour, preserve existing event end times, support all-day compatibility, and keep protected identity fields unchanged.

## Last verified

2026-06-25

## Next Action

Resume deferred authenticated Android CRUD testing when an Android device is available, then consider v0.2 reminder / anniversary / countdown scope.

## Blockers

Android authenticated CRUD remains deferred because the Android device was unavailable during prior verification.

## Important Context

- Git branch、latest commit、working tree 由 project-command-center 实时 Git 扫描读取；PROJECT_STATE.md 不作为这些字段的权威来源。
- Production URL: `https://cross-platform-shared-calendar.vercel.app/`.
- v0.1 is a Web/PWA, not native iOS / Android.
- Event ownership uses stable `scope + owner_user_id`; UI labels are derived from the current user.
- Personal events are visible to both members but only editable/deletable by the owner.
- Existing event identity fields must not change: `space_id`, `created_by`, `scope`, `owner_user_id`.
- Supabase RLS and database triggers remain the final permission boundary.

## Handoff Prompt

Continue 跨系统共享日历 by running authenticated Android CRUD verification against the production flow, then decide whether reminders, anniversaries, and countdowns should enter v0.2. Do not loosen personal-event ownership rules or modify protected identity fields.
