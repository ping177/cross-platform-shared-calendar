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

## v0.1.7.3 Recurring Event Editing Semantics

- Recurring source events remain the baseline; projected occurrence rows are not materialized. `occurrence_date` is the scheduled local date in the source recurrence-rule timezone and is the stable occurrence mutation identity.
- **Only this event:** use `event_occurrence_exceptions` through a database RPC. An only-this edit never directly updates the source event; an only-this delete writes a `deleted` exception.
- **Delete all recurring events:** delete the complete logical series lineage: root segment, every child segment, and their exceptions. This matches the product meaning of deleting the whole recurring series.
- **Logical-series deletion UI:** defer it. Keep `delete_logical_series` as a permission-checked backend RPC, but do not expose a frontend entry point until a separately approved high-impact deletion UX provides explicit copy and safeguards.
- **This and following:** use a series split. The old segment receives an exclusive `recurrence_until` cutoff; the child keeps the same `series_id` and sets `parent_event_id` to the old segment ID.
- **Final split exception handling:** future exceptions migrate from the old segment to the child, a split-day override is consumed by the child baseline, and a split-day deletion is rejected. This supersedes the earlier design rule that a split never migrates exceptions.
- **Recurring mutations:** the frontend must not compose `update + insert + delete` requests for an occurrence operation. It calls a permission-checked database RPC so locks, validation, and writes are one transaction.
- Only-this does not currently support an `all_day` override. The override contract is limited to `starts_at`, `ends_at`, `title`, and `description` until a separately approved projection change expands it.

## v0.1.8 Mobile Push Reminder Architecture Freeze

- `v0.1.8 — Mobile Push Reminder` is the current approved product line. Slice 1 (`v0.1.8.1 — Push Infrastructure Foundation`) is `CLOSED / PASS — Android final acceptance deferred`: Desktop Chrome/macOS and iPhone installed PWA Push Infrastructure acceptance passed. Android Push lifecycle acceptance is deferred to final v0.1.8 cross-platform acceptance by validation strategy and does not block Slice 2.
- **Slice 2 freeze:** `v0.1.8.2 — Reminder Persistence + Ordinary Event Delivery` architecture / semantics are frozen; implementation has not started. This freeze supersedes the earlier Option A `events.reminder_offset_minutes` decision.
- **Reminder persistence:** use one nullable event-level `events.reminder_kind`, with `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder. Do not create a JSON reminder config, multiple-reminder table, arbitrary-minute reminder, or per-user reminder preference.
- **Defaults and migration:** new timed events created by the v0.1.8.2 UI default to `timed_10m_before`; new all-day events default to `all_day_same_day_08`. The database default remains `null`, every historical Event migrates with `reminder_kind = null`, and rollout never silently enables reminders for existing data.
- **Canonical Event timezone:** add nullable `events.time_zone` containing an IANA timezone detected from the creating browser/PWA through standard `Intl` capability. Never hardcode one country/offset and never silently rewrite an existing Event when a device later changes timezone. Historical ordinary Event timezone remains null rather than guessed; historical recurring sources may initialize it from their already-authoritative `recurrence_rule.time_zone`. A timezone-dependent reminder selected on a null-timezone Event establishes the canonical timezone from the current device. A recurring Event's `events.time_zone` and `recurrence_rule.time_zone` must agree.
- **Due semantics:** minute presets subtract real minutes from the effective start. `timed_previous_day_same_time` means the prior calendar day at the same wall-clock time in the Event timezone, using the existing recurrence DST conversion semantics rather than fixed 1440 minutes. All-day presets use effective Event date plus canonical timezone at 08:00 the same day or 20:00 the prior day. Multi-day reminders use only the range start; `ends_at` does not affect v0.1.8 due calculation.
- **Conversion and edits:** timed-to-all-day maps a non-null reminder to `all_day_same_day_08`; all-day-to-timed maps a non-null reminder to `timed_10m_before`; null remains null, and the UI must expose the resulting option. Start/date or preset changes invalidate stale pending deliveries and derive a new due; title/description changes do not. An already-sent reminder cannot be withdrawn, while a later future due is a legitimate new delivery.
- **Past due and grace:** creating, editing, enabling, or changing a reminder never immediately sends or compensates when the newly derived due is already past. The roughly ten-minute grace applies only to infrastructure delay and applies equally to timed and all-day reminders.
- **Current all-day boundary:** v0.1.8.2 accepts the existing all-day presentation flag plus effective date model and does not introduce date-only storage, exclusive-end semantics, or a new all-day recurrence representation. Implementation must stop and report if effective date plus canonical timezone cannot safely produce all-day 08:00.
- **Delivery channel:** use standards-based Web Push to system notifications. Email reminder delivery, SMS, Bark, notification inbox/history, snooze, sound customization, and native alarms are excluded. Existing Email OTP authentication is unrelated and remains unchanged.
- **Push client:** add a Service Worker that handles Push and notification clicks only. It must not add offline caching. Permission is requested only after an explicit user action; iPhone and Android installed PWAs are the primary mobile targets.
- **Subscription identity:** `push_subscriptions` binds a subscription to `user + installation`, not to a Space. One user may retain simultaneous iPhone, Android, and Desktop subscriptions. Endpoint, `p256dh`, `auth`, expiry/lifecycle state, and installation identity are stored per subscription.
- **Future multi-space compatibility:** a device subscription is reusable across every Space the user may join in a future multi-space model. v0.1.8 does not implement multi-space. Delivery resolves recipients at send time through `event.space_id` and current membership, so a multi-space schema upgrade must not require redesigning Push Subscription persistence.
- **Recipients:** a shared event reminder applies to every current active member of its Space, and the reminder UI must disclose this behavior. A personal event reminder applies only to the current `owner_user_id`. A user without an active subscription receives no device notification, and a former Space member must not receive a delivery.
- **Recurrence:** Slice 2 implements ordinary non-recurring delivery only. Slice 3 dynamically projects due occurrences with canonical source-event, source-timezone, exception, override, delete, cutoff, future-split, and reminder/timezone inheritance semantics. It does not introduce a second recurrence or DST algorithm or materialize a long horizon of future reminder rows.
- **Scheduling:** Supabase Cron invokes an Edge Function sender every minute. Normal target precision is about one minute. A simple configurable late-delivery grace window may compensate reminders missed within roughly ten minutes; reminders older than that window are not sent late. Web Push is best-effort and is not an Alarm Clock.
- **Delivery ledger:** `reminder_deliveries` records pending/processing/sent/failed/cancelled delivery attempts and revalidates current event, occurrence, membership, subscription, and `due_at` before sending. Stale pending/processing rows are cancelled after an event is moved or deleted.
- **Idempotency:** recurring deliveries are unique by `(logical_series_id, occurrence_key, subscription_id, due_at)`; one-off deliveries are unique by `(event_id, "once", subscription_id, due_at)`. `due_at` is the stable `timestamptz` derived from effective start/date, `reminder_kind`, and canonical Event timezone. The same occurrence/device/due time succeeds at most once; title or description changes do not create a new reminder; a changed effective start/date or preset may create a new legitimate delivery. A future split does not duplicate a reminder when logical occurrence and `due_at` are unchanged.
- **Implementation slices:** deliver Push Infrastructure Foundation, Reminder Persistence + Ordinary Event Delivery, Recurrence Integration, then Production Validation + Canonical Closeout. Later roadmap versions remain directional and do not imply frozen architecture.
- **Slice 1 server dependency:** `@mmmike/web-push@1.3.0` is pinned exactly in `supabase/functions/send-test-push/deno.json` and is used only by that Edge Function. No browser Web Push package or root npm dependency is added; the client uses the platform Service Worker, PushManager, Notification, and PushSubscription APIs directly.
- **Slice 1 security boundary:** authenticated clients register/disable only through `SECURITY DEFINER` RPCs whose identity comes from `auth.uid()`; clients receive no direct subscription-table privileges. The test sender accepts only an installation UUID, re-authenticates the JWT, scopes lookup and invalid-subscription retirement to that user, and allowlists current Chromium, Mozilla, and Apple push-service hosts before outbound delivery.
- **Slice 1 validation strategy:** retain safe test-sender diagnostics (`status`, `delivered`, hostname-only `provider`, `gone`) and treat retry, unsubscribe/resubscribe, then browser/PWA restart as first-line recovery for an accepted-but-not-displayed Push before deeper RCA. The initial Desktop Chrome subscription recovered after resubscription; no architecture, VAPID, Edge Function, or Service Worker blocker was found.

## PWA

- v0.1 includes basic PWA support with a manifest and mobile meta tags.
- v0.1 does not add complex service worker offline caching, to avoid stale-cache issues during testing.
- iOS Standalone PWA cannot actively refresh itself; treat that as an iOS system limitation rather than an application defect. Supported user-driven recurrence interactions were accepted in the final Production smoke.

## Supabase Free Operations

- Use a daily Vercel Cron keep-alive while the project remains on Supabase Free.
- The keep-alive uses the Supabase anon key and RLS-protected, head-only reads; it does not use service role or return business data.
- Do not add a heartbeat table or modify the database schema or RLS solely for keep-alive.
- Continue observing Cron results and Supabase Active status; reconsider Supabase Pro only if the project becomes a formal service that must remain online long term.

## Project Command Center Filesystem Data Governance

- Stable projectId is `cross-system-shared-calendar`.
- The 2026-08-08 filesystem persistence audit found no filesystem-level persistent project data, so the canonical `/Users/wp/Projects/_project-data/cross-system-shared-calendar/` directory is not currently required and no migration is required.
- Supabase remains the canonical cloud business persistence. Supabase data must not be mirrored locally for this filesystem governance boundary.
- If true filesystem-level persistent runtime or user data is introduced later, it must use `/Users/wp/Projects/_project-data/cross-system-shared-calendar/` as its canonical root after governance review.
