# Backlog

## v0.1-smoke-test

- Run real Supabase integration testing.
- Test the full two-user end-to-end flow.
- Verify RLS and RPC behavior against real users.
- Confirm Realtime updates across two devices or browser sessions.

## v0.1.1

- Completed: restrict personal event updates/deletes to `owner_user_id`.
- Completed: show non-owner personal events as read-only details.
- Completed: desktop two-account UI, RLS, direct API, trigger, and Realtime regression tests.
- Deferred: Android Magic Link and authenticated CRUD testing when the device is available.

## v0.1.2

- Completed: deploy the current app to a stable Vercel HTTPS Production URL.
- Completed: configure the Production Site URL and allowed Redirect URLs in Supabase Auth.
- Completed: verify desktop User A Magic Link, session restoration, shared/personal CRUD, and same-account two-window Realtime in Production.
- Completed: verify Production manifest/icons and logged-out iPhone Safari add-to-home-screen behavior.
- Completed: verify User B Production Magic Link login.
- Completed: verify two-account Production shared Realtime create/update/delete.
- Completed: verify two-account Production personal-event owner/read-only permissions and Realtime propagation.
- Completed: verify authenticated iPhone User B Production login, mobile layout, shared CRUD, and desktop Realtime propagation.
- Deferred: authenticated Android CRUD while the device is unavailable.

## UX backlog

- Members: add nicknames, display names, and a shared-space member list so the UI can feel warmer than only showing "我的" / "对方的".
- Personal event labels: show the specific member name for personal events instead of only "对方的" when display names are available.
- New event defaults: prefill the end time as start time plus 1 hour. For example, if the start time is 10:00 on the selected day, default the end time to 11:00.

## v0.2

- Add reminders.
- Add anniversaries.
- Add countdowns.

## v0.3

- Add a shared Todo List.

## v0.4

- Evaluate external calendar import/export.
- Evaluate external calendar sync options.
