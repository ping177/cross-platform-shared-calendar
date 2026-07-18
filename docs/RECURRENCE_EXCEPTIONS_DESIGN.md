# v0.1.7 Design: Recurrence Exceptions & Series Editing

## Status and objective

**Status:** Design only; awaiting human review. This document authorizes no production change by itself.

v0.1.6 stores a recurring source event in `events.recurrence_rule` and projects visible occurrences in the client. An occurrence has no persisted identity beyond its derived display key, so editing or deleting an occurrence currently changes or deletes the source event.

v0.1.7 adds two capabilities without materializing every occurrence:

- persist a one-off override or deletion for a scheduled occurrence;
- split a recurring source into a historical segment and a new future segment.

The source `events` row remains the baseline. Exceptions are sparse deltas; a series split creates a second source row. The phase must preserve existing event identity and ownership fields: `space_id`, `created_by`, `scope`, and `owner_user_id`.

## Scope, commands, and boundaries

### In scope for a later implementation

- Exceptions for recurring events only: one override or deletion per scheduled occurrence.
- Edit/delete choices: only this occurrence, this and following occurrences, and the current series segment.
- Bound a source segment with an exclusive recurrence cutoff.
- Reproject events plus exceptions in Today, Week, and Month views.

### Out of scope

- Materialized occurrence rows, invitations, reminders, external sync, a new recurrence-rule version, or timezone-library dependency.
- Editing an exception as an independent series, multi-level undo, and a UI for inspecting all exceptions.
- Changing the existing `events` ownership model or loosening RLS.

### Existing commands for the future implementation

```bash
npm run build
node --test tests/recurrence.test.ts
git diff --check
```

### Boundaries

- Always: preserve `events` ownership/identity fields; use the source rule's IANA timezone; make a split atomic; verify database/RLS/Realtime and browser behavior before release.
- Ask first: apply a production migration, add a dependency, alter existing event RLS or triggers, or change the planned data contract below.
- Never: rerun `supabase/schema.sql` on an existing environment; materialize unbounded occurrences; migrate an exception to another segment; silently clear an exception; commit secrets.

## Terminology and stable identity

| Term | Meaning |
| --- | --- |
| source event / segment | One `events` row, its recurrence rule, start/end baseline, and optional cutoff. |
| logical series | The source segments sharing one root `series_id`. It is for lineage; UI manages the current segment. |
| scheduled occurrence | A candidate generated from a source rule before exceptions are applied. |
| occurrence key | `YYYY-MM-DD` in the source rule's IANA timezone: the scheduled local calendar date, never the overridden display start. |
| exception | The one sparse record for a source event and occurrence key. It is either `override` or `deleted`. |

The recurrence engine must change its internal occurrence identity from v0.1.6's `event-id:scheduled-UTC-instant` to `event-id:occurrence-key`. v0.1.6 IDs were React/display keys only and were never persisted, so this is backward compatible. A moved override therefore keeps the identity of the occurrence it replaces.

`recurrence_until` is an **exclusive scheduled-start instant**. A source emits candidates strictly earlier than it. It is not an end-time and is evaluated in the source rule timezone. An unset value means no scheduled cutoff.

## Product behavior

These actions are available only for a recurring occurrence the user may manage under the existing source-event permission rules. A non-recurring event keeps the existing simple edit/delete path. A personal source remains read-only to a non-owner.

### Edit

| User choice | Persistent change | Result |
| --- | --- | --- |
| 仅此一次 | Upsert `event_occurrence_exceptions` for `(source_event_id, occurrence_key)` with `kind = 'override'` and a complete event-content snapshot. | Only that projected occurrence displays the snapshot's title, description, start/end, and all-day state. It may move in time; its source ownership does not change. |
| 此次及之后 | Atomically set the old segment's `recurrence_until` to the selected occurrence's original scheduled instant; insert a child source event beginning with the edited occurrence's new baseline; retain only prior exceptions on the old segment and clear the now-unreachable selected/future exceptions after explicit confirmation. | Earlier occurrences and their exceptions remain owned by the old segment and stable. The selected and later occurrences come from the child segment, which starts without inherited exceptions. |
| 整个当前系列 | Update the selected source row's baseline fields and recurrence rule under current v0.1.6 validation. Existing valid exceptions remain attached to their scheduled keys. | All non-exception occurrences in that segment update; explicit overrides/deletions continue to win. |

An entire-series recurrence-rule edit that would leave stored exceptions without a generated scheduled key must not save silently. The editor shows the count and asks the user to either keep an equivalent schedule, remove the affected exceptions explicitly, or cancel. This prevents hidden/orphaned edits.

### Delete

| User choice | Persistent change | Result |
| --- | --- | --- |
| 仅此一次 | Upsert the exception as `kind = 'deleted'`, with all override columns null. | The scheduled occurrence is omitted; no source row changes. An existing override is replaced by the deletion. |
| 此次及之后 | Atomically set the selected source segment's `recurrence_until` to the selected original scheduled instant and delete its exceptions at or after the selected occurrence key. | The selected and future portion of this segment is deleted. Historical occurrences and their exceptions remain; every exception made invalid by the new cutoff is removed in the same transaction after a count-bearing confirmation. |
| 整个当前系列 | Delete the source event. Its exceptions cascade-delete through the foreign key. | The current segment disappears. A later split segment is an independent current series and is not deleted. |

The terminology after a split is intentionally precise: “整个当前系列” means the source segment containing the selected occurrence, not every historical/future segment sharing `series_id`. This keeps a past segment stable and avoids surprising edits to prior history.

## Data-model design

### Additions to `events`

```text
series_id uuid null references events(id) on delete restrict
parent_event_id uuid null references events(id) on delete restrict
recurrence_until timestamptz null
```

- For a recurring source, `series_id` is the root source event ID. A newly created recurring source initially sets `series_id = id`; a split child copies that root ID. A non-recurring event has both lineage fields null.
- `parent_event_id` points to the immediately preceding source segment, is null for the root, and is immutable after insert. It is a lineage pointer only; it does not make exception rows children of the new segment.
- `recurrence_until` is null for an open segment or the selected original scheduled instant for a split/end-from-here action.
- A trigger validates that a non-null cutoff is later than `starts_at`, that lineage sources have the same immutable identity fields, that parent and root belong to the same logical series, and that a child does not start before its parent's cutoff. The client and database both validate recurrence shape; the database remains authoritative.
- Recommended indexes: `(series_id, starts_at)` and `(space_id, recurrence_until)` (the latter assists bounded source queries if introduced). Existing `(space_id, starts_at)` remains.

`series_id` cannot use a normal same-row FK at insert unless the ID is generated in the application/RPC first. The implementation should generate the root UUID inside a transaction/RPC, insert it with `series_id = id`, and never retrofit lineage through a client-side multi-request sequence.

### New table: `public.event_occurrence_exceptions`

```text
id uuid primary key default gen_random_uuid()
source_event_id uuid not null references public.events(id) on delete cascade
occurrence_key date not null
kind text not null check (kind in ('override', 'deleted'))
title text null
description text null
starts_at timestamptz null
ends_at timestamptz null
all_day boolean null
created_by uuid not null default auth.uid() references auth.users(id)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique (source_event_id, occurrence_key)
check (
  (kind = 'deleted' and title is null and description is null and starts_at is null and ends_at is null and all_day is null)
  or
  (kind = 'override' and title is not null and starts_at is not null and all_day is not null
   and (ends_at is null or ends_at >= starts_at))
)
```

An override stores a full display snapshot instead of a field patch. That makes projection deterministic when the segment baseline changes and allows a user to clear/revert an exception by deleting this row. `created_by` is audit metadata only; it never changes permissions.

**Exception ownership is segment-local and immutable.** An exception always belongs to the exact `source_event_id` that existed when the user created it. A series split never changes that foreign key and never copies an exception to the child event. Exceptions before the split key remain active on the old segment; selected/future exceptions made unreachable by a new cutoff are explicitly cleared as part of the confirmed mutation. The child starts with no inherited exceptions.

Required indexes:

- unique `(source_event_id, occurrence_key)` (also serves normal source/key lookup);
- `(source_event_id, starts_at)` partial index `where kind = 'override'` for moved overrides intersecting the visible range;
- `(source_event_id, occurrence_key)` partial index `where kind = 'deleted'` is optional and should be justified by query planning, since the unique index already covers it.

Required triggers/constraints beyond the SQL checks:

- the referenced source must currently be recurring;
- `occurrence_key` is interpreted only in that source's recurrence timezone;
- an exception cannot change event ownership, scope, space, or recurrence rule because those columns do not exist on the exception;
- `updated_at` uses the existing touch trigger/function pattern;
- `created_by` is immutable and must equal the acting user on insert.

The exact check that a key is a candidate of an arbitrary client-supplied recurrence rule is intentionally not encoded as a fragile SQL reimplementation of the TypeScript expansion engine. The mutation RPC validates it using the canonical recurrence contract; projection ignores a malformed/orphaned row defensively and reports it for repair. This is safe because RLS only permits an actor who can already manage the source event.

### RLS, Realtime, and mutation boundary

- Enable RLS on the new table. Select is allowed when the caller is a member of the referenced source's `space_id`; insert/update/delete is allowed only when `public.can_manage_event(...)` is true for that source. No policy trusts a client-provided space or owner column.
- Use a `security definer`, fixed-`search_path` RPC for **split** and for compound exception mutations. It rechecks `auth.uid()`, source permission, occurrence validity, and optimistic `updated_at`/version expectations before changing rows. It clears only exceptions that become unreachable in that source segment; it never reassigns `source_event_id`. This prevents a partial old-cutoff/new-child/exceptions state.
- Add the table to `supabase_realtime` with `replica identity full`. Subscribe, merge, and reproject on event and exception changes. A source delete relies on cascade plus Realtime handling/reload; no client should assume delete ordering between the two tables.
- Existing `events` RLS policies remain unchanged. New lineage/cutoff validation is additive and must not broaden personal-event access.

## Series-split algorithm

Example: a weekly Monday 20:00 source is changed from 2026-08-10 to Monday 21:00 “this and following.”

1. The UI submits the *original scheduled key* (`2026-08-10`), original scheduled instant (20:00 in the source timezone), edited child baseline (21:00), desired child rule, and the source row's concurrency token to `split_recurring_event`.
2. The RPC locks the source and its exceptions. It confirms the occurrence exists, the source is open at that instant, and the caller can manage it.
3. It updates only the old source: `recurrence_until = 2026-08-10T20:00` (exclusive). The old source now emits through 2026-08-03; its prior exceptions remain attached and unchanged.
4. It inserts a child `events` row with copied immutable identity fields, edited content/time, the chosen valid rule, `series_id` equal to the old root, and `parent_event_id` equal to the old source. The child starts at 2026-08-10 21:00 and has no cutoff.
5. It leaves exceptions with keys before `2026-08-10` on the old segment unchanged. It never migrates them. It counts exceptions at or after `2026-08-10` (including an override used to open the editor), shows that count in the confirmation UI, and deletes those now-unreachable old-segment rows in the same transaction. The selected edit is represented by the child baseline, not by copying an exception.
6. It commits all changes together. Realtime clients reload/reproject both source rows and exception rows.

The old segment is never re-anchored or rewritten for a future-only edit. This preserves past projection exactly, including DST conversion behavior and prior one-off changes. A child is a normal recurring source, so it can later be split again.

For “delete this and following,” steps 1–3 occur but no child is inserted: the selected/future portion of the current segment is removed. Before confirmation, the UI counts exception rows at/after the selected key. The RPC deletes those invalidated rows atomically with the cutoff; historical exceptions remain with the shortened source.

## Occurrence expansion design

The renderer receives source events plus their exception rows, not precomputed occurrence records:

```text
events + recurrence_until
          └─ expand scheduled candidates (per source)
exceptions ── index by (source_event_id, occurrence_key)
          └─ deleted: remove candidate
          └─ override: replace display values and range intersection
          └─ moved override: add when override time intersects visible range
                                      ↓
                              sorted expanded occurrences
```

Algorithm, per source segment:

1. Generate scheduled candidates using the existing rule engine, stopping before `recurrence_until`; the candidate includes its local-date `occurrence_key`.
2. Read matching exceptions by `(source_event_id, occurrence_key)`. A `deleted` exception suppresses the candidate. An `override` replaces its title/description/start/end/all-day values but retains `source_event_id` and `occurrence_key` identity.
3. For an override moved into the visible range whose original scheduled candidate is outside it, query/index it by override `starts_at` and add it once. For a moved override leaving the range, do not show the original candidate.
4. Apply the normal range-intersection test **after** override values are selected, then sort by display start and source ID. Deduplicate by `(source_event_id, occurrence_key)`.
5. Expand every visible source segment independently. Split segments do not overlap because the parent segment's cutoff is exclusive; their results therefore combine naturally.

Errors preserve the current per-source error reporting. An exception referencing a non-generated key is excluded and reported as data-integrity telemetry; it must never create a phantom occurrence.

## Mobile-first UI flow

Tapping a recurring occurrence opens the existing bottom sheet/detail view. The title area shows the occurrence date and a compact “重复日程” label; the sheet continues to respect read-only personal-event access.

### Edit flow

1. Tap **编辑**. A bottom-sheet choice screen uses full-width 44px+ actions:
   - **仅此一次** — “只修改 8 月 10 日这一次。”
   - **此次及之后** — “从 8 月 10 日开始创建新的重复日程；之前的日程不变。”
   - **整个当前系列** — “修改此系列中的所有未单独修改日程。”
2. The selected choice is shown as a persistent scope chip in the editor. Only “此次及之后” exposes the repeat controls for the new child series; “仅此一次” hides repeat controls; “整个当前系列” shows them with exception-impact warning if needed.
3. Save uses explicit loading/disabled state, then returns to the projected calendar. On conflict/realtime change, reload source and exceptions and ask the user to review rather than retrying stale writes.

### Delete flow

1. Tap **删除**; a separate destructive bottom sheet offers the same three scopes.
2. Copy is explicit: “仅删除 8 月 10 日”, “删除从 8 月 10 日起的日程”, and “删除整个当前系列”. The last action names the series title.
3. “此次及之后” shows “还会移除 N 个未来单次更改” when applicable. The same count-bearing warning appears before an edit split because the child does not inherit old-segment exceptions. The confirm button is red for delete and says exactly what it will delete.

### Edge cases

- A split target is the scheduled identity even if that occurrence was previously moved; show both “原定日期” and the displayed time when needed.
- If the target is already a deleted occurrence, it is absent from the calendar; no action is offered until a future exception-management surface exists.
- If a series has no future candidate after the selected occurrence, “此次及之后” is equivalent to “仅此一次” for edit and is hidden/disabled for delete with explanatory copy.
- A source with a cutoff is not editable past its final scheduled occurrence. Child segments are edited independently.
- Small screens use one-choice-per-row, no nested popovers, a sticky primary action, and safe-area padding. Desktop may use the same sheet centered as a dialog.

## Migration strategy

No migration is part of this design task. A later implementation applies one additive, transaction-wrapped patch in this order:

1. **Preflight:** confirm v0.1.6.1 `recurrence_rule` exists; inventory event policies/triggers, Realtime publication, and existing rows; back up schema metadata; do not rerun `schema.sql`.
2. **Schema:** add nullable `series_id`, `parent_event_id`, and cutoff columns; create `event_occurrence_exceptions` with checks, foreign keys, indexes, touch trigger, RLS enabled, and policies. Existing events are unchanged and continue to project as before because `recurrence_until` is null and no exceptions exist.
3. **Backfill:** assign each existing recurring event `series_id = id` and leave `parent_event_id` null; leave non-recurring lineage fields null. Validate that no `recurrence_until` is set and row counts/timestamps/content are unchanged otherwise.
4. **Guards and RPC:** add additive validation triggers and transactional mutation RPCs only after data is valid. Validate RLS with shared, personal-owner, non-owner, and non-member cases.
5. **Realtime:** set full replica identity and publication membership for the new table; confirm subscriptions before enabling UI mutations.
6. **Release sequencing:** deploy compatible readers first (they tolerate no exception rows), apply the patch once, then deploy writers/UI. Maintain a documented rollback: disable new UI/RPC first; do not drop tables/columns while exception data exists.

## Future implementation plan and testing strategy

### Ordered implementation slices

1. **Contracts and pure expansion (S/M):** extend types and recurrence engine with occurrence keys, cutoff handling, exception merge, and moved-override range logic. Verify focused Node tests and `npm run build`.
2. **Database foundation (M):** create the additive patch, RLS, indexes, Realtime metadata, and pre/postflight SQL checklist. Verify against an isolated environment and direct-RLS matrix; obtain approval before Production apply.
3. **Atomic mutation boundary (M):** implement/test exception upsert and split/end-from-here RPC contracts with optimistic concurrency and segment-local exception cleanup. Verify rollback on forced failure and no partial rows.
4. **UI vertical slice (M):** add mobile choice sheets, scope-aware editor, destructive copy, and Realtime reload/reprojection. Verify desktop and narrow layouts.
5. **Review/release checkpoint:** run quality/security review, two-user acceptance, and migration production checklist before marking v0.1.7 complete.

### Unit tests

- Source expansion honors an exclusive cutoff; adjacent split segments neither gap nor overlap.
- Stable occurrence keys survive an override that changes start time/date and an all-day conversion.
- Deleted exception suppresses only its scheduled occurrence; override replaces only its snapshot fields.
- Moved override enters/leaves Today, Week, and 42-cell Month correctly without duplication.
- Exceptions for separate source IDs do not cross-apply; invalid/orphaned keys are excluded and surfaced.
- Split keeps historical occurrences and historical exceptions stable, begins a child without inherited exceptions, clears only confirmed unreachable old-segment exceptions, and rolls back on validation failure.
- Existing daily/weekly/monthly/yearly, leap day, DST, range, and 500-candidate tests remain green.

### Integration tests

- A manager creates, edits, reverts, and deletes an only-this override; a non-owner of a personal source cannot mutate it.
- Shared and personal-owner flows for all three edit/delete scopes update the intended database rows only.
- Split is atomic under a simulated failure and respects an updated-at conflict.
- Existing exception behavior after an entire-series edit is preserved or requires explicit resolution; split/future-delete cleanup is count-confirmed and no exception migrates between segments.
- Two subscribed clients receive event and exception changes and reproject consistently, including source deletion/cascade ordering.

### Production acceptance

Run with two existing independently authenticated Email OTP users in the same space:

- **Desktop:** all six scopes, historical stability after split, override move across view boundaries, reload, conflict handling, shared/personal permissions, and two-user Realtime.
- **iPhone Safari and standalone PWA:** bottom-sheet choices, safe-area/sticky actions, native date/time controls, save/delete/reprojection, and DST-observing timezone smoke.
- **Android Chrome and PWA:** same flows on a narrow viewport, keyboard interaction, Realtime, and home-screen session behavior.
- **Data checks:** exact source/exception row counts, RLS isolation for non-member/non-owner, no orphaned exceptions, and unchanged v0.1.6 series behavior.

## Success criteria and open review points

The future implementation is complete only when all six scope choices have deterministic, tested persistence semantics; existing v0.1.6 recurring events remain unchanged after migration; no historical occurrence or exception is rewritten by a future split; exception ownership never crosses a segment; invalidated future exceptions are explicitly count-confirmed and atomically cleared; and the production acceptance matrix passes.

Reviewed architecture decisions:

1. “Entire series” means the selected current source segment after a split, not every member of the logical lineage.
2. `series_id` identifies the root lineage and `parent_event_id` identifies the immediate prior segment.
3. Exceptions never migrate across segments; a split child begins without inherited exceptions.
4. Editing or deleting this-and-following clears only the old segment's exceptions made unreachable by its new cutoff, after count-bearing confirmation.
