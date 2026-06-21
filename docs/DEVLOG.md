# Development Log

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
