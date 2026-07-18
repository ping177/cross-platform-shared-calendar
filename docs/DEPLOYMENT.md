# Deployment

## Supabase production deployment order

For every additive database-backed release, use this order:

1. **Database patch** — review the specific new file in `supabase/patches/`, take a production preflight/backup decision, then apply that patch once through the approved production process.
2. **Database/RLS/RPC verification** — run the patch's structural, data, RLS/RPC, and Realtime checks against the target environment. Confirm existing behavior remains intact before exposing new writers.
3. **Frontend deploy** — deploy only a frontend compatible with the verified database contract. For a release that introduces writers, deploy readers/compatibility first when practical, then enable the UI writer flow.
4. **Smoke test** — use real authenticated production accounts to verify the released flow, permissions, Realtime propagation, and supported desktop/mobile browsers. Record the result in the relevant testing notes.

## Important rule

`supabase/schema.sql` is a baseline/bootstrap reference. It is **not** an incremental production migration and must not be rerun against an existing production environment.

Use one reviewed, versioned file from `supabase/patches/` for each existing-environment change. A patch must be idempotent only where intentional, and production application requires separate approval.

## Recurrence releases

For recurrence exception or series-editing work, additionally verify:

- the required `events` lineage/cutoff columns and `event_occurrence_exceptions` table exist before deploying a frontend that reads or writes them;
- exception-table RLS and source-event permissions remain no broader than the existing event model;
- split/end-from-here mutations are atomic and leave no orphaned or silently removed exceptions;
- two independently authenticated clients reproject consistently after event and exception changes.
