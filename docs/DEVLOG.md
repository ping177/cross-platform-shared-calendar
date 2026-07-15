# Development Log

## 2026-07-14 - v0.1.5 Email OTP Auth UX Improvement

- Replaced the AuthPage Magic Link UX with a two-step Email OTP UX: send code, enter an 8-digit numeric code, verify, change email, and resend after a 60-second cooldown.
- The existing `getSession()` and `onAuthStateChange()` flow remains the sole session state mechanism; successful OTP verification does not manually set session state.
- No dependencies, environment variables, database schema, SQL patches, RLS policies, event/space/member behavior, Realtime subscriptions, or secrets changed.
- Supabase SMTP and passwordless email template are configured to send `{{ .Token }}` as an OTP. Local acceptance passed for existing-user and new-user login, new-user space creation, member display-name update, and existing-session regression.

## 2026-07-11 - v0.1.4 Member Identity & Space Members

- Added a standalone `2026-07-11-v0.1.4-member-display-name.sql` patch. It transactionally locks profile writes during migration, converts blank names to `null`, trims legacy names, deterministically truncates legacy non-empty names to 20 characters, adds the nullable trimmed 1–20-character constraint, and changes `handle_new_user()` to create a null display name.
- Synced the initial schema with the same profile constraint and privacy-safe new-user behavior. Existing RLS policies, RPCs, indexes, event fields, and Realtime publication were not changed.
- Added a compact member entry and bottom sheet. It lists the current member with 「（我）」, uses `joined_at` then `user_id` for deterministic member ordering, shows no invented second member in a one-member space, and only permits the current user to edit their own `profiles` row.
- Personal event cards, owner choices, and read-only details now show the member display name; shared events show 「共同」. Missing, blank, or invalid loaded names safely display 「成员」.
- A successful name save reloads members on the saving device. No `profiles` or `space_members` Realtime subscription was introduced; another device updates on refresh, re-entry, or session restoration.
- Initial local implementation verification: `npm run build` and `git diff --check` passed before Supabase SQL or browser smoke was performed.
- Follow-up verification: the v0.1.4 patch was executed successfully in the current Production Supabase project after a clean preflight. Constraint, normalization, new-user trigger, and unchanged RLS policy checks passed.
- Local two-account desktop smoke passed: member list and self-only editing, cross-session name refresh, personal/shared labels, same-name owner regression, owner-only personal permissions, shared permissions, and existing events Realtime create/update/delete. Temporary smoke events were removed after verification.
- Production acceptance follow-up on 2026-07-14: deployed two-account desktop smoke passed, including member sheet, self-only name editing, concrete owner labels, shared/personal CRUD, owner-only personal access, same-name owner regression, and events Realtime.
- Production iPhone Safari browser smoke passed. The standalone PWA requires its own session; Magic Links normally return to Safari rather than the standalone app because their storage is isolated. This known Auth/PWA UX limitation is out of v0.1.4 scope.
- Production Android Chrome and home-screen PWA smoke passed: existing session, browser-Gmail Magic Link completion, narrow layout, keyboard, member UI, shared/personal ownership flow, and events Realtime. A Magic Link opened from the Gmail native App does not return to the PWA; this is recorded as a cross-app handoff limitation rather than an application bug.
- No business code, Auth configuration, Supabase schema/RLS, Vercel configuration, dependencies, or secrets were changed during Production acceptance. The single-member path and a newly created-account first login remain untested.

## 2026-07-09

- Completed the first Production verification of the Supabase Free keep-alive.
- Confirmed the Vercel Cron Job is registered for `/api/supabase-keepalive` on the daily `0 3 * * *` schedule.
- Confirmed an unauthenticated browser request returns `401 unauthorized`.
- Confirmed the first scheduled Production Cron invocation returned HTTP 200, indicating that all three read-only Supabase checks completed successfully under the current Function contract.
- Supabase remains Active. Continued Cron success and long-term inactivity-pause prevention still require observation.
- This was a docs-only verification closure; no business code, Function or Cron configuration, environment variables, database schema, RLS, deployment configuration, or secrets were changed or exposed.

## 2026-07-08

- Recorded the Supabase Free Tier inactivity pause operational risk.
- Confirmed the current Supabase project status is Active.
- Documented that a future pause may affect Auth, Database, RLS, and Realtime until the project is restored.
- Implemented a minimal keep-alive path using daily Vercel Cron at `/api/supabase-keepalive`.
- Added a CRON_SECRET-protected Vercel Function that uses the existing Supabase anon key environment variables and performs three sequential head-only read checks against `spaces`.
- The Function does not use service role, does not write heartbeat data, does not modify business tables, and does not return query data.
- Current decision remains to continue using Supabase Cloud without upgrading to Pro or migrating the backend.
- Local checks covered build, type checking for the Function, unauthorized/error-path endpoint behavior, `vercel.json` JSON parsing, and diff hygiene; the first Production Cron verification was completed on 2026-07-09.
- No calendar business logic, database schema, RLS, Supabase/Vercel dashboard configuration, dependencies, or secrets were changed in the repository.

## 2026-07-06

- Completed Android compatibility smoke testing on Xiaomi 14 / Android 16 / Chrome over a mobile network.
- Verified the Production URL opens, Android Chrome Magic Link login works, and the session restores after login.
- Verified today, week, and month views plus mobile layout on Android Chrome.
- Verified v0.1.3 event form behavior on Android: shared/personal default end time, start-time follow behavior, manual end-time preservation, and existing shared/personal event end-time preservation.
- Verified shared Realtime create/update/delete, personal read-only permissions, and User A creating a personal event for User B with ownership transfer.
- Verified Android Chrome add-to-home-screen, home-screen PWA launch, and PWA event create/delete syncing to desktop.
- Found no project bugs. A temporary Chrome add-to-home-screen state message cleared after restarting Chrome and was treated as a browser state issue.
- Closed the previously pending Android authenticated CRUD, Realtime, and PWA compatibility verification scope.
- No business code, Supabase schema, RLS, Vercel configuration, package configuration, dependencies, or secrets were changed.

## 2026-06-26

- Completed a docs-only cleanup for project documentation boundaries.
- Simplified `README.md` testing content so detailed smoke checklists and production validation records live in `docs/TESTING.md`.
- Reorganized `docs/BACKLOG.md` into P0/P1/P2/P3 priority sections while preserving completed and deferred version history.
- Updated `docs/PROJECT_STATE.md` with the documentation cleanup as the latest completed handoff-relevant work.
- No business code, configuration, dependencies, database schema, RLS, deployment settings, or secrets were changed.

## 2026-06-24 - v0.1.3

- Started the event form UX defaults phase.
- New event drafts now prefill the end time as the start time plus 1 hour, using the same start `Date` as the calculation base.
- Changing the start time for a new event keeps the end time at start plus 1 hour until the user manually edits the end time.
- Existing event drafts still load `starts_at` and `ends_at` from the database and do not reset the end time to a new default.
- Editing existing events continues to update only content fields and does not change the v0.1.1 protected identity fields: `space_id`, `created_by`, `scope`, or `owner_user_id`.
- All-day compatibility: new all-day events whose end time was not manually edited save `ends_at` as `null`; if a user manually edits the end time, the existing form behavior of saving that value is preserved.
- Verified v0.1.3 in a real browser: shared and personal default end times, start/end follow behavior, manual end preservation, existing event end preservation, read-only personal events, Realtime create/update/delete, and all-day functional regression passed.
- No Supabase schema, RLS, Vercel, Supabase configuration, secret, Android pending, member display, anniversary, Todo, or service worker changes were made.

## 2026-06-23 - v0.1.2

- Deployed the current Vite app to Vercel at https://cross-platform-shared-calendar.vercel.app/.
- Configured the Supabase Auth Site URL and Redirect URLs for the Production URL while retaining local test redirects.
- Diagnosed the first Production Magic Link failure, `Invalid path specified in request URL`: the Vercel environment variable value was empty, and the Supabase URL had also previously been copied from the REST endpoint.
- Corrected `VITE_SUPABASE_URL` to the project base URL ending in `.supabase.co`, without `/rest/v1/`, and redeployed successfully.
- Verified the Production page loads without a Supabase configuration error.
- Verified desktop User A Magic Link login, logout and repeat login, Production-domain redirect, and session restoration. An empty `/#` after login is accepted.
- Verified User A shared and personal event create, update, and delete flows, including persistence after refresh.
- Verified Realtime create, update, and delete propagation between two windows for User A.
- Verified the manifest and both SVG icons are accessible.
- Verified iPhone Safari can open the Production URL, add the app to the home screen, and launch it from the home screen.
- Verified the logged-out iPhone layout and email login entry point.
- Follow-up smoke test: verified User B Production Magic Link login in an incognito window, with both A and B reaching the calendar page and seeing the same invite code for the shared space.
- Verified two-account Production Realtime for shared events: A created `ab realtime create test`, B received it without refresh, B edited it to `ab realtime edit test`, A received the update without refresh, and B deleted it with A seeing it disappear without refresh.
- Verified personal-event permissions and Realtime in Production: A-owned personal events are visible to B as read-only, owner edits/deletes propagate without refresh, and A-created B-owned personal events transfer management to B while A remains read-only.
- Verified iPhone authenticated Production flow with User B: Magic Link login, Production-domain redirect, calendar entry, mobile layout, shared event creation, desktop A Realtime receipt, and deletion propagation.
- Pending: Android authenticated CRUD.
- Pending Android testing is deferred because the Android device is temporarily unavailable.
- No application business logic changed for this deployment.

## 2026-06-20 - v0.1.1

- Implemented owner-only update/delete policies for personal events while keeping them visible to both members.
- Kept shared events editable and deletable by both space members.
- Added read-only personal-event details for the non-owner.
- Adjusted the event sheet so read-only details stay within the viewport and scroll correctly on desktop and mobile.
- Locked existing event identity fields: `space_id`, `created_by`, `scope`, and `owner_user_id`.
- Added a non-destructive v0.1.1 patch SQL for existing Supabase projects with smoke-test data.
- Added a preflight query that must return zero invalid scope/owner rows before applying the patch.
- Applied the patch after the preflight returned zero invalid rows.
- Verified desktop two-account read-only and owner-management behavior for personal events.
- Verified both members can still edit and delete shared events.
- Verified non-owner direct API updates/deletes affect zero personal-event rows.
- Verified the trigger rejects changes to all four event identity fields.
- Verified allowed personal/shared updates and deletes continue to propagate through Realtime; one stale browser subscription required a single refresh before the regression test.
- Android authenticated testing remains pending and is not part of this change.

## 2026-06-20

- Completed the available v0.1 Supabase smoke-test scope.
- Verified two-user space creation/join, the two-member capacity limit, invite-code rotation, and invalidation of old invite codes.
- Verified RLS blocks non-members from reading or writing space data.
- Verified Realtime create, update, and delete propagation between two authenticated sessions.
- Verified iOS Safari layout and add-to-home-screen behavior.
- Verified Android Chrome layout and creation of a home-screen shortcut.
- Pending: Android Magic Link login.
- Pending: viewing, creating, editing, and deleting events after login on Android.
- Android authenticated testing is deferred because the Android device is temporarily unavailable. Testing was also interrupted by Supabase's default email rate limit and an earlier incorrect Site URL configuration that pointed to `localhost:3000`.
- Next step after this stabilization commit: begin v0.1.1 personal-event permission corrections, then resume Android authenticated testing when the device is available.

## 2026-06-18

- Started real Supabase smoke testing.
- Executed `supabase/schema.sql` successfully in a new Supabase project.
- Fixed invite-code generation to call `extensions.gen_random_bytes` explicitly.
- Added a direct `space_members.user_id -> profiles.id` foreign key so PostgREST can resolve the member profile relationship.
- Added `events` to the `supabase_realtime` publication after confirming it was not enabled by default.
- Verified that User B receives a newly created shared event from User A without refreshing.
- Enabled `replica identity full` for `events` so filtered Realtime subscriptions receive enough data to process deletions.
- Verified cross-user event editing and deletion with live updates in the other user's session.
- Verified the two-member capacity limit and non-member RLS read/write isolation.

## 2026-06-17

- Project initialization completed.
- Technical stack: React + Vite + TypeScript + Tailwind + Supabase.
- v0.1 goal: a two-person shared calendar Web/PWA that works on iOS Safari and Android Chrome.
- First commit completed: `bbdde4f feat: initialize shared calendar MVP`.
- Production build passed with `npm run build`.
- Remote repository: `git@github.com:ping177/cross-platform-shared-calendar.git`.
- Next step: real Supabase integration and acceptance testing.
