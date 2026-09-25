# Shared Life Architecture Freeze

Status: `ARCHITECTURE FROZEN`; v0.1.10–v0.1.13 are `CLOSED / PASS`. The v0.1.11 contract is [Navigation + Aggregation Experience Specification](./v0.1.11_NAVIGATION_AGGREGATION_SPEC.md); the v0.1.14「回顾」design-only contract is [v0.1.14 回顾规格](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md).

This document freezes the long-term product model and navigation direction plus the reviewed v0.1.10 foundation scope. It does not change the accepted v0.1.9 Production capability. Later roadmap versions remain directional and need their own scope review.

## Primary Navigation

The currently shipped first-level navigation is `首页 / 日历 / 功能中心 / 我的`.

| Destination | Responsibility |
| --- | --- |
| 首页 | Cross-module summary; each supported section has a direct create `+` |
| 日历 | Time views and aggregation of Calendar Sources |
| 功能中心 | Implemented optional modules; currently only 任务 |
| 我的 | Profile, account, Space management, notifications, devices, and settings |

The initial four-destination navigation shipped in v0.1.11. Slice 3 added Home aggregation, Slice 4 added direct Event and Task creation from their Home sections, and v0.1.12 changed the third destination to 功能中心.

## v0.1.12 Module Hub + Space Management Navigation — Historical Frozen Target

The v0.1.12 migration to `首页 / 日历 / 功能中心 / 我的` is complete. The Module Hub opens implemented modules directly; 任务 remains the only Production module until v0.1.14 is implemented. The following rules record the frozen v0.1.12 architecture. Unimplemented modules must not appear as placeholders; no generic module framework or plugin system is part of the direction.

Module enablement remains per-Space configuration in `space_modules`. A module page's filter is separate view state and lists only Spaces where that module is enabled. For Tasks, Spaces with Tasks disabled are excluded from its filter; disabling Tasks keeps its data. Each module owns its filter, while Calendar's `calendarFilter` remains independent and continues to support all Spaces or one Space. Do not create an app-wide Space filter.

“我的” is directed toward personal profile, Space management, and general settings. Space management may provide a Space list, create/join actions, and Space details for members, invitations, Space settings, and module switches. Module switches can be a section of Space details; a separate nested module-management page is not required.

Space remains the canonical ownership boundary. Each Event, Task, List, Important Date, and 回顾 belongs to one canonical Space; `ownership ≠ view`. This migration changed navigation, aggregation, and view, not canonical ownership, persistence, or Space schema. Preserve both v0.1.11 Home quick-create shortcuts unchanged; see [Decisions](./DECISIONS.md) and [Backlog](./BACKLOG.md).

## Spaces and Canonical Ownership

- Each user will own one Personal Space for genuinely private content.
- A user may belong to multiple Shared Spaces, including couple, family, friends, or travel groups.
- Every business object has exactly one canonical Space. A view may aggregate objects from multiple Spaces, but an object is not canonically owned by multiple Spaces at once.
- A `personal` Event inside a Shared Space is still visible to that Space's members under the existing Event model. It describes member ownership within that Shared Space; it is not content in the user's private Personal Space.
- The current one-Space product lifecycle and `MULTISPACE_NOT_REQUIRED_FOR_V019` remain unchanged in v0.1.9. The explicit `tasks.space_id` implemented in Slice 1 is compatible with this future model.

## Space Capabilities and Module Enablement

`Space = Calendar Core + Optional Modules`.

Calendar is the core capability of every Space. Optional modules may include Tasks, Lists, Important Dates, Review / Check-in, Memo, and later validated modules. Tasks is currently the only implemented optional module; names of future modules are architecture candidates and do not imply Production placeholders or a generic module framework.

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
3. **Slice 3 — Tasks module enablement + UI text closeout — CLOSED / PASS:** Production owner toggle, disabled-state behavior, Task history restoration, Chinese user-visible `Task / Tasks` wording, and user-run authenticated acceptance passed. Retain table/type/file names; full i18n remains out of scope.

Known characteristic / future consideration: `space_modules` is not in the Realtime publication. An already-open Shared member page may temporarily retain the previous module UI until refresh or re-entry. Database policy immediately rejects disabled Task writes. Consider module-state Realtime / immediate cross-client UI refresh only if real usage demonstrates a need; this does not reopen v0.1.10.

At the v0.1.10 scope freeze, later work included final `首页 / 日历 / 空间 / 我的` navigation, cross-Space aggregation, Calendar multi-Space overlay, Lists / Important Dates / Review implementation, External Calendar Sources, UI redesign, Native App, and Shared Space three-plus-member support. Memo content implementation also remained deferred.

## v0.1.11 Design Freeze — 2026-09-24

The accepted four-slice scope, state contract, active-view Realtime lifecycle, canonical item navigation, Home create-target privacy rules and deferred list are frozen in [v0.1.11 Navigation + Aggregation Experience Specification](./v0.1.11_NAVIGATION_AGGREGATION_SPEC.md). At this design milestone, v0.1.11 business implementation and deployment had not started. Slice 1 later shipped without a temporary Home driven by `selectedSpaceId`; user-visible Home begins only with the all-Spaces aggregation of Slice 3. No second Shared Space is required solely for acceptance.

## Calendar Sources

The long-term Calendar view aggregates sources, not just one Space's Events.

| Source class | Examples |
| --- | --- |
| Space-backed | Personal Space Calendar; Shared Space Calendars |
| Global or external | 中国节假日 / 调休; ICS; future Google Calendar; future Apple/System Calendar or native integration |

Global and external Calendar Sources do not require a corresponding Space and may serve all Spaces. A user can overlay multiple Space Calendars or filter down to one Space. External integrations are future work, not an implicit data migration into Space ownership.

Future consideration: current Slice 2 Calendar behavior intentionally has no Event create action in the all-Spaces view, while a single-Space filter can create in that Space. Reconsidering that affordance requires separate product review; it is outside the completed v0.1.11 scope.

## Home Quick Create and Privacy Guardrail

Slice 4 Home has a `+` beside “近期日程” and another beside “需要处理的任务”. Each opens its matching creation form directly; there is no Home title `+` or Event/Task type chooser. Other module shortcuts can be added alongside their sections when those modules are implemented. Wishlist is a List type, not a first-level content type.

The target Space follows the current creation context:

1. Inside a specific Space: that Space.
2. In Calendar with exactly one Space selected: that Space.
3. From a Home section shortcut: Personal Space by default, independent of the selected Calendar Space.

The Home creation form visibly shows the target Space and allows changing it. Its primary action names the target Space. A second confirmation explicitly names the target before the write. These steps guard against accidentally sharing private content into the wrong Space. Existing Calendar single-Space Event creation and Space-local Task creation retain their direct-save paths.

## Content Semantics

- Event: when something happens.
- Task: something that remains to be completed. A future read-only Calendar projection may show `tasks.due_on`; it does not create an Event or duplicate Task persistence.
- v0.1.9 Slice 2 will present Completed Tasks in a separate history section with reopen and delete actions. Task Archive is deferred; there is no `archive` status in the v0.1.9 data contract.
- 回顾 is structured Space content distinct from Memo. v0.1.14 freezes its four fields, fixed round number, actual date, participant snapshot, historical continuity and previous-plan reference in the [canonical specification](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md).
- Voice input remains a later goal for 回顾; it is outside v0.1.14.

## Directional Roadmap

| Version | Direction |
| --- | --- |
| v0.1.9 | Shared Tasks |
| v0.1.10 | Personal Space + Multi-space + Module Enablement Foundation |
| v0.1.11 | Navigation + Aggregation Experience |
| v0.1.12 | Module Hub + Space Management Navigation (CLOSED / PASS) |
| v0.1.13 | Space Lifecycle & Membership Safety (CLOSED / PASS) |
| v0.1.14 | 回顾 (DESIGN FROZEN; implementation not started) |

Shared Lists, Important Dates, Calendar Sources v1, Memo, Photos / Memories, richer external Calendars, Task Archive, and other validated modules remain candidates without a fixed order. Priority and order may change based on real product use. Native has a decision gate only; no native implementation version is committed.

## v0.1.9 Slice Boundary

Slice 1/2/3 are `CLOSED / PASS`: v0.1.9 Tasks are accepted in Production under the then-current one-Space experience. Its historical implementation did not add Personal Space, Multi-space, module enablement, complete navigation, aggregation, or global create.
