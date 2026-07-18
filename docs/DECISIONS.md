# Decisions

## v0.1 Product Shape

- v0.1 is a Web/PWA, not a native iOS or Android app.
- "Cross-platform" means the app works in iOS Safari and Android Chrome. It does not mean bidirectional sync with Apple Calendar or Google Calendar.
- The backend uses Supabase Auth, Supabase Postgres, Supabase RLS, and Supabase Realtime.

## Data Model

- Event ownership uses stable fields: `scope + owner_user_id`.
- The app does not store relative viewpoint values such as `mine`, `partner`, or `shared` for event ownership.
- UI labels like "我的", "对方的", and "共同的" are derived from the current user and `owner_user_id`.
- Both space members can read personal events, but only `owner_user_id` can update or delete them.
- Both space members can update or delete shared events.
- Members may create a personal event for their partner; after creation, only the assigned owner can manage it.
- Existing events cannot change `space_id`, `created_by`, `scope`, or `owner_user_id`.
- Frontend read-only behavior is for usability; RLS and database triggers remain the final permission boundary.

## Space Membership

- Creating a space, joining by invite code, and rotating invite codes are handled by RPC functions so the operations complete atomically.
- RLS remains enabled, and RPC functions perform explicit membership and capacity checks.

## v0.1.4 Member Identity

- v0.1.4 only uses the existing global `profiles.display_name`; it does not add `space_members.nickname`.
- `display_name` is nullable for compatibility. A non-null value is trimmed and limited to 1–20 characters; the UI safely falls back to 「成员」 when it is absent or invalid.
- New users receive a profile with `display_name = null`. Neither Auth metadata nor email/email prefix is used as a public default, to avoid unintended identity disclosure.
- A space member may update only their own global display name under the existing `profiles_update_self` RLS policy. No profile, space-member, or event RLS policy is broadened.
- Personal event labels show the stored owner’s member display name; shared event labels remain 「共同」. Labels never participate in permission checks.
- Name saves reload the local member list. v0.1.4 does not subscribe to profile or member Realtime changes; other devices see a changed name after refresh, re-entry, or session restoration.
- Reconsider `space_members.nickname` only if multi-space support and real per-space naming needs are introduced.

## v0.1.5 Email OTP

- Passwordless login uses Email OTP instead of Magic Link. Users enter the 8-digit code in the active browser or PWA container.
- This removes the Magic Link dependency on mail-client, browser, and standalone-PWA return handling. It does not merge Safari and standalone PWA session storage.
- The existing Supabase client, `getSession()`, and `onAuthStateChange()` remain the session architecture. No database, schema, RLS, event, or membership behavior changes.

## v0.1.7 Recurrence Exceptions & Series Editing (Design, Pending Review)

- Recurring source events remain the baseline; occurrence records are not materialized. A new sparse exception table will persist either a complete one-off override snapshot or a deletion keyed by source event and scheduled local date in the source rule timezone.
- A recurring source uses `series_id` for its root lineage and `parent_event_id` for its immediate preceding segment. A future-only edit/delete ends the old source segment with an exclusive recurrence cutoff; a future edit creates a linked child source and never rewrites historical source data.
- After a split, “entire series” means the selected current source segment. Logical lineage is retained for traceability, not as an instruction to rewrite historical/future segments together.
- An exception always belongs to the event segment that created it. A split never migrates or copies exceptions to the child: historical exceptions remain on the old segment, and the child begins without inherited exceptions.
- A future-only delete removes the selected/future portion of the current segment and atomically clears that segment's now-invalid exceptions at or after the cutoff. A future-only edit applies the same count-confirmed cleanup to unreachable old-segment exceptions; no exception is silently removed.
- Split and exception mutation require an atomic permission-checked database mutation boundary.
- These are design decisions only until `docs/RECURRENCE_EXCEPTIONS_DESIGN.md` receives human review and a subsequent implementation task is approved.

## PWA

- v0.1 includes basic PWA support with a manifest and mobile meta tags.
- v0.1 does not add complex service worker offline caching, to avoid stale-cache issues during testing.

## Supabase Free Operations

- Use a daily Vercel Cron keep-alive while the project remains on Supabase Free.
- The keep-alive uses the Supabase anon key and RLS-protected, head-only reads; it does not use service role or return business data.
- Do not add a heartbeat table or modify the database schema or RLS solely for keep-alive.
- Continue observing Cron results and Supabase Active status; reconsider Supabase Pro only if the project becomes a formal service that must remain online long term.
