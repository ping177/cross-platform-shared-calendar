# Development Log

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
