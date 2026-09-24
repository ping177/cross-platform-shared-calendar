# Shared Life Architecture Freeze

Status: `ARCHITECTURE FROZEN`; v0.1.10 Scope / Architecture Freeze: `CLOSED / READY FOR IMPLEMENTATION`; Slice 1: `PRODUCTION BACKEND ROLLOUT PASS`; Slice 2: `CLOSED / PASS` (Production frontend rollout and authenticated acceptance passed); Slice 3: `LOCAL VERIFIED / REVIEW PENDING` (Production rollout and authenticated acceptance not started). The full v0.1.10 foundation is not closed.

This document freezes the long-term product model and navigation direction plus the reviewed v0.1.10 foundation scope. It does not change the accepted v0.1.9 Production capability. Later roadmap versions remain directional and need their own scope review.

## Primary Navigation

The long-term first-level navigation is `首页 / 日历 / 空间 / 我的`.

| Destination | Responsibility |
| --- | --- |
| 首页 | Cross-module summary and future global create `+` |
| 日历 | Time views and aggregation of Calendar Sources |
| 空间 | Personal and Shared Spaces with their content modules |
| 我的 | Profile, account, notifications, devices, and settings |

The complete four-destination navigation is deferred to v0.1.11 or later.

## Spaces and Canonical Ownership

- Each user will own one Personal Space for genuinely private content.
- A user may belong to multiple Shared Spaces, including couple, family, friends, or travel groups.
- Every business object has exactly one canonical Space. A view may aggregate objects from multiple Spaces, but an object is not canonically owned by multiple Spaces at once.
- A `personal` Event inside a Shared Space is still visible to that Space's members under the existing Event model. It describes member ownership within that Shared Space; it is not content in the user's private Personal Space.
- The current one-Space product lifecycle and `MULTISPACE_NOT_REQUIRED_FOR_V019` remain unchanged in v0.1.9. The explicit `tasks.space_id` implemented in Slice 1 is compatible with this future model.

## Space Capabilities and Module Enablement

`Space = Calendar Core + Optional Modules`.

Calendar is the core capability of every Space. Optional modules may include Tasks, Lists, Important Dates, Review / Check-in, Memo, and later validated modules.

- Enablement belongs to the Space, not to an individual member's preference. Different Spaces may enable different modules.
- A disabled module does not appear in that Space's main interface.
- Disabling a module preserves its historical data; re-enabling makes that data visible again.
- Permanent deletion of module data is deferred.
- v0.1.10 module authority and persistence are specified below.

v0.1.9 did not add enablement storage, controls, or permissions.

## v0.1.10 Scope / Architecture Freeze

Status: `CLOSED / READY FOR IMPLEMENTATION`. This section is the reviewed design contract; current implementation and deployment status are stated above. v0.1.9 remains the latest accepted Production capability.

### Personal Space and membership

- Reuse `spaces` and `space_members`; never add separate personal Event or Task tables. Add `spaces.kind` constrained to `personal | shared`, defaulting to `shared`, so every existing Space remains Shared.
- At most one Personal Space per creator is enforced by a **partial unique index** equivalent to `UNIQUE(created_by) WHERE kind = 'personal'`. Do not use `UNIQUE(kind, created_by)`: one user must be able to create multiple Shared Spaces.
- A Personal Space has exactly one member: `created_by`, with owner role. The database boundary must reject direct membership writes that add another person or remove the sole owner. Client writes cannot change `spaces.kind` or `spaces.created_by`; enforce the invariant without a general permission framework.
- No Personal Space invite-code join, exit, or ordinary deletion. Shared Space create/join remains an RPC flow; `create_space_with_invite` creates Shared Spaces only. Keep `(space_id, user_id)` as membership identity, remove the user-wide unique membership index, and make join reject only an existing membership in the target Space. Keep the Shared Space two-member cap and its concurrent-join protection in v0.1.10; three-plus-member support is deferred.

### Event and Task semantics

- Every Event and Task keeps one canonical `space_id`; do not rewrite existing rows or change their identity. A Personal Space Event must have `scope = 'personal'` and `owner_user_id = spaces.created_by`; enforce this at the database boundary. Its form hides the 「我的 / 对方 / 共同」 audience selector. A Shared Space Event with `scope = 'personal'` retains its existing member-visible, owner-managed meaning.
- Personal Space Tasks use the current `tasks` schema and authorization. Their UI hides assignment, and new Tasks use `assigned_to_user_id = NULL`. No Task identity, Realtime, or v0.1.9 Task authorization redesign is part of this version.
- Event Reminder recipients and v0.1.8 semantics, recurrence projection/editing, Event identity, and Task identity remain unchanged. Push subscriptions continue to bind to user and installation, never a Space.

### Module enablement and permissions

- Calendar is always enabled and has no `space_modules` row. Use `space_modules(space_id, module_key, enabled)` with a constrained module key and one row per Space/module. An absent row means disabled; avoid JSON configuration, per-member preferences, and a plugin framework.
- Backfill `tasks = true` for existing Shared Spaces. New Personal and Shared Spaces default to `tasks = true`; `lists`, `important_dates`, `review`, and `memo` default to disabled. Only Tasks gets a user-visible toggle in v0.1.10; unimplemented modules have no empty UI.
- Disabling Tasks preserves SELECT access and all historical rows, but the database rejects every Task mutation: create, edit, delete, complete, reopen, and reassign. Re-enabling restores the existing Task history and permitted mutations. Other v0.1.9 Task authorization rules still apply when Tasks is enabled.
- Module state belongs to the Space. Its owner may toggle it; other members can read state only. Use an authorization-checked RPC and do not grant direct client writes to `space_modules`.

### Selected Space and rollout

- The frontend uses one explicit, membership-validated `selectedSpaceId` for Event, Task, members, modules, and Realtime. Current Space is client selection, not a unique database/profile attribute. Switching clears Space-local state and guards against late requests or old subscriptions populating the new Space. Existing users initially keep their old Shared Space; users with no Shared Space initially select Personal Space. v0.1.10 does not aggregate Spaces.
- Slice 1 backend capability may roll out first, subject to real Production schema/index/RPC/RLS preflight and postflight. Before the compatible v0.1.10 frontend is ready, do **not** automatically create or bulk-backfill Personal Spaces: the v0.1.9 frontend selects an arbitrary first Space. Once the new frontend is ready, it calls a controlled, idempotent `ensure_personal_space()` per user. Consider bulk backfill for older accounts only after real authenticated acceptance and compatibility review. This repository audit did not verify Production state.

### Implementation slices and boundary

1. **Slice 1 — Data / permission foundation:** constraints, controlled lifecycle and module RPCs, migration/fresh schema parity, database authorization and compatibility tests, plus Production preflight/postflight planning.
2. **Slice 2 — Selected/current Space vertical flow:** Personal Space ensure after frontend readiness, Shared Space create/join and selection, Space-local Event/Task/member/module loading, Realtime cleanup, and stale-request isolation.
3. **Slice 3 — Tasks module enablement + UI text closeout:** owner toggle, disabled-state behavior and history restoration, and user-visible `Task / Tasks` copy changed to Chinese “任务”. Change UI text only; retain table/type/file names and do not add full i18n.

Deferred to v0.1.11 or later: final `首页 / 日历 / 空间 / 我的` navigation, cross-Space aggregation, global `+`, Calendar multi-Space overlay, Lists / Important Dates / Review implementation, External Calendar Sources, UI redesign, Native App, and Shared Space three-plus-member support. Memo content implementation also remains deferred.

## Calendar Sources

The long-term Calendar view aggregates sources, not just one Space's Events.

| Source class | Examples |
| --- | --- |
| Space-backed | Personal Space Calendar; Shared Space Calendars |
| Global or external | 中国节假日 / 调休; ICS; future Google Calendar; future Apple/System Calendar or native integration |

Global and external Calendar Sources do not require a corresponding Space and may serve all Spaces. A user can overlay multiple Space Calendars or filter down to one Space. External integrations are future work, not an implicit data migration into Space ownership.

## Global Create and Privacy Guardrail

The future global `+` may create 日程, 待办, 清单, 重要日期, or 备忘. Wishlist is a List type, not a first-level content type.

The target Space default follows the user's current context:

1. Inside a specific Space: that Space.
2. In Calendar with exactly one Space selected: that Space.
3. On Home, in All Spaces, or without clear Space context: Personal Space.

The creation form must visibly show the target Space and allow changing it. Its primary action reads `保存到「Space Name」`. After that action, a second confirmation explicitly names the target Space; the write occurs only after confirmation. A lightweight success confirmation may follow. These steps guard against accidentally sharing private content into the wrong Space.

Global create is deferred beyond v0.1.10. The target rule does not change v0.1.10 Space-local creation UI.

## Content Semantics

- Event: when something happens.
- Task: something that remains to be completed. A future read-only Calendar projection may show `tasks.due_on`; it does not create an Event or duplicate Task persistence.
- v0.1.9 Slice 2 will present Completed Tasks in a separate history section with reopen and delete actions. Task Archive is deferred; there is no `archive` status in the v0.1.9 data contract.
- Review / Check-in is structured Space content distinct from Memo. Its future structure includes review period, Focus, Achievements / Wins, Problems, next-period plan, historical continuity, and access to the previous plan when preparing the next Review.
- Voice input is an important future Review experience goal. The recording and transcription technology is not frozen here.

## Directional Roadmap

| Version | Direction |
| --- | --- |
| v0.1.9 | Shared Tasks |
| v0.1.10 | Personal Space + Multi-space + Module Enablement Foundation |
| v0.1.11 | Navigation + Aggregation Experience |
| v0.1.12 | Shared Lists |
| v0.1.13 | Important Dates |
| v0.1.14 | Structured Review / Check-in |
| v0.1.15 | Calendar Sources v1 |

Future directions without a committed version: Memo, Photos / Memories, richer external Calendars, Task Archive, and other validated modules. Native has a decision gate only; no native implementation version is committed.

## v0.1.9 Slice Boundary

Slice 1/2/3 are `CLOSED / PASS`: v0.1.9 Tasks are accepted in Production under the then-current one-Space experience. Its historical implementation did not add Personal Space, Multi-space, module enablement, complete navigation, aggregation, or global create.
