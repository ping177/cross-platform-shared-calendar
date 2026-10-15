# Shared Space Event collaboration — local contract and rollout

2026-10-15. Baseline: 2204b30fee3e00d116d902c6925b33239b6409dc.
Status: PRODUCTION BACKEND + USER A/B/PUSH PASS / FINAL FRONTEND DEVICE ACCEPTANCE PENDING.
SQL was applied by the user; Edge + original Cron restoration separately authorized and completed below. Frontend release separately authorized; exact release result/Source is recorded independently below. No new version.

## Frontend release acceptance — 2026-10-15

User confirms ordinary cross-member edit/audience, recurring whole-series audience,
Shared deletion/Personal isolation and actual Push A→B (B received, A did not) PASS.
Review form/date repair is locally visually accepted. Full978/978, TypeScript/Build,
diff-check and Production public VAPID/server digest gate PASS. No backend rollout
or Push E2E repeated. Frontend Git/Vercel release is explicitly authorized; exact
Source/deployment/public-resource evidence is recorded after verification. Final
Production/Safari/iPhone PWA user feedback is still required; no overall CLOSED.
Earlier pending/no-due records below are historical checkpoint limits, not a denial
of the user's subsequent actual delivery result. Realtime/concurrency/other device
coverage is not expanded by this acceptance.

## Production backend checkpoint — 2026-10-15

- Correct project `ximazjhxvmktpcdbypka` independently verified Healthy. User had
  already applied the exact SQL; Codex did NOT replay it. All eight installed
  function bodies match the reviewed patch; documented postflight booleans PASS.
- Existing Keychain authentication used only inside authorized processes; no
  credential values printed/persisted, no CLI login/repair or secret/config change.
  One Management API source deployment: same Function ID, ACTIVE v4 → **v5**,
  `verify_jwt=false` preserved. Deployment metadata SHA-256:
  `95f02fb496854b8e2c4b085545468b69b7bd06f27f8cc9df24fc75ce14dcb72f`.
- Uploaded 14 source/config files. Downloaded 13 runtime source/config files are
  byte-identical to local source; type-only src/types.ts is normally erased.
  index.ts contains check_event_reminder_delivery and logic.ts awaits checkEvent
  before send. Independent metadata read matches deployment response. Exported
  ESZIP hash is a separate value, NOT compared directly to metadata ezbr_sha256
  (the old v4 export also differs). No second deployment was performed.
- Both new RPCs appear in database OpenAPI. Read-only management role was correctly
  denied service-only EXECUTE; a temporary service_role negative check against a
  nonexistent Event returned false without business writes. This is not a live
  recipient/claim/Push E2E test; no real accounts or source records were operated.
- Preflight confirmed original Job 1 paused, running/queue/claimed=0, no enabled
  Event/Task/Important Date reminder sources, last old HTTP33846/33847 completed
  with zero errors. User-provided drain/shutdown evidence retained. First guarded
  resume was rejected because direct FOR UPDATE needs forbidden system-table
  UPDATE privilege; confirmed job still paused, then used permitted official
  cron.alter_job with exact ID/config guards. No grants or schema were altered.
- **Job 1 restored**, same schedule `* * * * *`, same command fingerprint
  `cd0c5b049c9c1ca9f564c2b1895c00d1`, no new/deleted job. Natural runs/HTTP IDs
  **33848 / 33849** at 14:35 / 14:36 Asia/Shanghai: succeeded, HTTP200/completed,
  failed/finalize_failures/unexpected_task_errors=0; no cutoff/truncation, queue or
  claimed residue. Existing Event/exception/Task/Important Date/Push subscription
  fingerprints and empty ledger unchanged; other Functions unchanged.
- Actual 127.0.0.1:5175 source serves the new Event RPC/UI and targets the same
  Production project. Backend/frontend capability gate PASS for user A/B local
  acceptance. Production frontend still 2204b30; Review repair remains local.
- No enabled reminder sources meant candidates/claim/send=0. Real collaboration,
  recipient changes, provider delivery, Realtime and iPhone/PWA acceptance remain
  pending. Local 978/978 evidence retained, no full test rerun. No Commit/Push/
  frontend deployment; overall feature is NOT CLOSED/PASS.

The remaining rollout sections are the reusable runbook and historical readiness
checks; their pre-install false/paused expectations do not describe the live state
above. Do not rerun the migration or pause a healthy job based on those baselines.

## Contract

- Every current Shared Space member may read, edit, reassign and delete every Event. Audience is scope + owner_user_id and controls participation/reminder recipients, not editing rights. The existing three-button UI remains.
- Personal Space remains private and owner-managed; non-members have no access. space_id and created_by remain immutable. A personal audience must identify a current member; shared audience has no owner.
- Existing UPDATE/DELETE/exception RLS and recurring RPCs use the updated can_manage_event function. No policy or trigger is disabled.
- New save_event_edit is SECURITY INVOKER, retaining caller RLS. It locks the Space, rechecks membership and expected updated_at, validates allowed content/final audience, and returns the actual saved record. Ordinary deletion requires confirmation, Space + ID + version and exactly one returned row.
- Content retains existing only-this / this-and-future semantics. Audience changes atomically affect the whole logical series, including existing prior/future split segments. Exceptions inherit audience and keep their identities/content. Audience-only saves create no exceptions/splits. Content changes preserve the complete displayed occurrence so unchanged override fields are not erased.
- Deferred constraint validates linked segments' Space/audience/series coherence at transaction end; lineage fields cannot be rewritten to detach segments. Existing inconsistent links stop the patch, never silent repair. Recurring RPCs share the Space-first lock order. No new whole-series deletion UI is added.
- Audience changes monotonically advance reminder_schedule_changed_at. Old/ABA candidates cannot claim; ledger identity/history stays intact. A new service-only Event pre-send check verifies current membership, recipient, subscription, marker, source and exception snapshot after claim. Failed checks finalize as failed through the existing sender.
- The DB check and external Push cannot be atomic; changes after the final check and already sent/in-flight Push cannot be recalled. No history replay or notification-recall promise.
- Shared members retain editing rights after assigning to another member; loss-of-edit-right confirmation is unnecessary.
- Accepted Review repair remains separate: its component/CSS/test bytes match the pre-Event snapshot. No selectors, Task behavior, Avatar, data cleanup, Cron or Storage changes.

## Implementation / evidence

Frontend: src/App.tsx, src/lib/event-edit-mutation.ts, src/lib/space-content.ts.
Backend: supabase/schema.sql; exact patch supabase/patches/2026-10-15-event-collaboration.sql; bounded Event pre-send call in supabase/functions/send-reminders/{index,logic}.ts.

Tests include actual component handlers, double-submit/failed/stale saves, zero-row deletion, both A/B identities, Personal/outsider isolation, series/split/exception integrity and reminder claim/check/ABA/deduplication. Local runner uses only generated event_collab_{fresh,upgrade}_* databases in the existing LOCAL Docker container over a Unix socket, never the existing app DB or linked Production. It compares fresh/upgrade function definitions and synthetic legacy-row fingerprints, and removes its own test DBs at completion.

Existing lifecycle test fixtures now define immutable links on INSERT, retaining every lifecycle assertion; no production lifecycle logic changes. The legacy reminder fixture evaluates the new deferred constraint before its existing historical-marker fixture DDL.

Commands:
~~~sh
python3 supabase/tests/event_collaboration_local.py
node --test --test-reporter=tap tests/*.test.ts tests/*.test.js
npx tsc -b
npm run build
deno check --no-lock --node-modules-dir=none --cached-only --config supabase/functions/send-reminders/deno.json supabase/functions/send-reminders/index.ts
git diff --check
~~~

Real-component offline screenshots in this Chat: event-collaboration/{ordinary,series}-{375,430}.png, series-save-scope-375.png, delete-confirmation-375.png. Current source/CSS, memory writes, envFile=false, CSP connect-src none. No overflow, dates left aligned, audience controls enabled, content-scope and delete confirmations retained. These do not replace real Supabase, two-account, device, Realtime or Push acceptance.

Local results: full Node 978/978 PASS; TypeScript, Build, Deno and diff-check PASS.
Both fresh and upgrade: 62 new pgTAP assertions + 314 existing assertions PASS,
7 observed two-session concurrency orderings PASS. All eight function definitions
match; documented SQL pre/postflight executes locally; the upgrade synthetic Event
fingerprint is unchanged. Review code/CSS/test fingerprints remain 3/3 identical.
Build retains the existing >500kB chunk warning.

## Changed files by scope

Event frontend:
- src/App.tsx
- src/lib/event-edit-mutation.ts
- src/lib/space-content.ts

Event backend:
- supabase/schema.sql
- supabase/patches/2026-10-15-event-collaboration.sql
- supabase/functions/send-reminders/index.ts
- supabase/functions/send-reminders/logic.ts

Event verification:
- supabase/tests/2026-10-15-event-collaboration.test.sql
- supabase/tests/event_collaboration_local.py
- supabase/tests/event_collaboration_concurrency.py
- supabase/tests/2026-09-25-v0.1.13-space-lifecycle-slice1a.test.sql (fixture links on INSERT; assertions retained)
- supabase/tests/2026-09-20-v0.1.8.2-reminder-delivery.test.sql (flush deferred constraint before existing fixture DDL)
- tests/event-collaboration.test.ts
- tests/event-collaboration-ui.test.ts
- tests/current-modules-interaction.test.ts (membership fixture)
- tests/mixed-source-reminders.test.ts (mandatory Event check fixture + negative pre-send case)
- tests/send-reminders.test.ts
- tests/recurring-reminders.test.ts
- tests/task-reminder-delivery.test.ts (the latter three supply the mandatory check dependency)

Governance:
- docs/PROJECT_STATE.md, docs/DEVLOG.md, docs/TESTING.md, docs/BACKLOG.md (shared with the earlier Review record)
- docs/DECISIONS.md, docs/EVENT_COLLABORATION_ROLLOUT.md

Earlier Review-only files preserved byte-for-byte against this task's starting snapshot:
- src/components/ReviewHistoryPage.tsx
- src/styles.css
- tests/sheet-date-layout.test.ts

## Rollout — maintenance authorization and live evidence required

2026-10-15 readiness follow-up: this document closes the missing cutover procedure;
it does not establish Production readiness. No live Production SQL connection was
available in this preparation session. No Production preflight, Cron pause, SQL,
Edge deployment or account acceptance was performed. The live window is UNKNOWN.
Existing local test evidence remains 978/978; no full rerun for this docs-only step.

Safe order:
**Production read-only preflight → confirm a quiet reminder window → pause new
scheduled/manual invocations → drain old Edge and HTTP work → exact SQL → matching
send-reminders → verify SQL/RPC/Edge → resume the SAME scheduler → reminder health
→ user A/B acceptance → separately authorized frontend release.**

### Roles, Dashboard operations and gates

- Codex can prepare/review local artifacts and read-only results. The user selects
  the real Production project (`ximazjhxvmktpcdbypka`) and runs SQL Editor checks,
  Dashboard controls and real-account/PWA acceptance. Codex must not inherit login.
  Actual SQL/Edge/Cron writes and later Git/frontend release need separate approval.
- Before any write: in the correct project's SQL Editor run the **Production
  operational preflight** below (one JSON result; includes the schema checks).
  Do not run the patch or canonical schema. Save the timestamp/result privately.
  Confirm backup/export availability, original scheduler identity/config fingerprint
  and current Edge deployment version/source. Do not export commands, Vault values,
  request headers, Push endpoints/keys or credentials.
- Review enabled reminder sources, including recurring exceptions and active Task /
  Important Date modules. A ledger-only query cannot predict future reminders.
  Use the existing pure reminder projection/due helpers on the returned snapshot
  to assess `[snapshot time - 10 minutes, planned resume + 10 minutes]`; evaluate
  recurring/Task/Important Date projections at successive minute endpoints across
  that interval, deduplicate candidates and include ordinary due calculation.
  Preserve timezone/DST, override and marker semantics; do not invent a SQL
  recurrence implementation. The snapshot omits text/owner fields unnecessary for
  due calculation; use empty text placeholders if needed by the local pure helpers.
  This calculation must never invoke claim, sender, test-push or finalize RPCs.
  Any projection error/incomplete export means STOP. All enabled source arrays
  empty establishes no configured reminders at that snapshot, not a future guarantee.
- Choose a window without due/overdue critical reminders across all four sources;
  conservatively treat every candidate as critical until the user confirms otherwise.
  Recheck immediately before pause; users refrain from creating/editing reminders
  or testing new audience permissions until SQL/Edge alignment. Plan a short window
  with recovery margin **well below 10 minutes**, but draining is evidence-based,
  never a fixed-time wait. If that cannot fit, reschedule; do not promise lossless
  maintenance. Long pauses can lose Event, Task and Important Date reminders.
- Only after maintenance authorization: Dashboard **Cron → Jobs**, find exactly
  `send-reminders-every-minute`, record job ID/schedule/command fingerprint, and
  toggle **Active → Inactive**. Do not delete/recreate the job, edit its command,
  change secrets/JWT or disable unrelated jobs. Confirm inactive via read-only
  preflight and no new runs after any already-started scheduler transaction ends.
  Stop manual/Test/curl invocations as well. If this control is unavailable, STOP;
  obtain an explicitly reviewed alternative instead of improvising a write.
- Apply the drain gate below before SQL. Then user executes ONLY
  `supabase/patches/2026-10-15-event-collaboration.sql` once in SQL Editor.
  Reviewed SHA-256: `4f4e99d394eb6b9d58bdc7b5d4ac1a52be666cd2a95dd0fdf6d7f7a86ac34073`.
  One transaction, lock timeout 5s / statement timeout 60s, no existing row rewrite;
  replay guard, RLS/triggers and lineage preconditions must pass. Never apply schema.sql.
- Run SQL postflight below: all booleans true; compare all eight installed function
  definitions to the reviewed patch and verify PostgREST discovery of save_event_edit
  and the service-only check RPC. Do not use a real Event mutation to probe discovery.
  Deploy the matching current send-reminders through the existing authorized workflow;
  in Dashboard **Edge Functions → send-reminders**, confirm version/source contains
  `check_event_reminder_delivery` and preserved invocation/JWT/secrets configuration.
  ACTIVE alone is insufficient. An authorized controlled invocation may send due
  reminders; do it only after the quiet-window check and explicit backend approval.
  Check its full completion diagnostics, including scan limits/errors/finalization,
  without replaying historical deliveries.
- After SQL/RPC/Edge gates pass, toggle the original Cron job **Inactive → Active**.
  Verify same job ID, schedule, target and command fingerprint, exactly one active
  reminder scheduler, then observe natural invocations through terminal Edge/HTTP
  results. Verify no RPC/cache errors, unexplained failed/stuck claims, duplicate
  delivery identities or unexpected subscription disabling against the preflight
  baseline. Zero sends is valid in a quiet window; it is not a real Push E2E PASS.
- Verify local frontend's actual backend target/capabilities before requesting user
  A/B acceptance: A/B edit/reassign/delete all three audiences, Personal/outsider
  isolation, series/splits/exceptions, stale saves and automatic reminder recipients.
  Old frontend stays data-compatible but has old UI restrictions. New audience
  acceptance must wait for matching SQL + Edge and resumed healthy reminders.
- Only after A/B acceptance and separate Git/release authorization: commit/push/Vercel,
  exact Source/public-resource verification, then user Safari/PWA/Review acceptance.
  Refresh old runtimes. No CLOSED/PASS before actual evidence. No new version.

### Drain gate — completion evidence, not elapsed time

1. Record pause time and old Edge deployment/version. In Cron History, allow any
   already-running SQL job to finish dispatching. In **send-reminders → Invocations /
   Logs**, inventory every old invocation that could overlap the window, including
   manual ones. Match request/execution IDs, deployment ID and start/end/result.
   Use the full relevant history, not just the latest 20 or 30 minutes if incomplete.
2. Re-run the read-only operational preflight: no queued reminder requests and no
   running reminder Cron job. Queue removal means pg_net picked a request up, NOT
   that HTTP/Edge finished. Recent HTTP responses are listed without headers/body;
   they are unfiltered across endpoints because response rows do not store URL.
   Correlate them to known request/execution IDs through Dashboard details where
   available. Do not assume every recent HTTP 200 belongs to send-reminders.
3. Every dispatched/started old invocation must have a terminal result from the
   expected deployment. This sender awaits all workers, Push HTTP calls and ledger
   finalization before returning diagnostics; matched normal completion therefore
   proves its awaited application work ended. Check diagnostics, not just HTTP200.
   For timeout, missing response, crash or killed invocation, require additional
   execution-specific platform termination evidence and investigate unresolved
   ledger outcomes. HTTP/client/pg_net timeout alone does not terminate remote work.
   If Dashboard retention/visibility cannot establish a complete inventory and
   termination, **STOP before SQL**; obtain platform evidence/support or a separately
   reviewed bounded termination procedure. Do not replace evidence with sleep.
4. Once all known old requests are terminal, no reminder requests remain queued,
   no dispatch is running and no new invocations appear with entry points paused,
   record the drain gate PASS. Claimed rows are supplementary; inspect any baseline
   or new unresolved claim, but do not clear/reclaim/delete it to make the gate pass.
   95s is only a new-claim cutoff, not total execution time. Cron succeeded, Edge
   ACTIVE, queue=0 or claimed=0 alone cannot establish drain PASS.

Push already accepted by a provider or delivered to a device cannot be recalled;
this gate drains application HTTP work, not the provider's downstream delivery.
Even the new final DB check cannot be atomic with external Push. Preserve that
accepted limitation; do not claim recipient changes retract in-flight notifications.

### Failure / partial-deployment handling

| Failure point | STOP and forward recovery |
| --- | --- |
| Preflight, quiet window or drain not proven | Do not apply SQL. If still on the intact old SQL + old Edge pair and no write/unknown in-flight operation occurred, explicitly abort the window and restore the same scheduler after confirming old backend health; otherwise keep paused and investigate. |
| SQL error/timeout | Stop before Edge. On a confirmed error, issue ROLLBACK in that editor session if still open, then read-only inspect capabilities/functions/triggers to prove the old state. A disconnected editor or unknown COMMIT is not proof of rollback. Do not blindly rerun. Only a separately approved retry of a proven unapplied patch may proceed; partial/new state needs reviewed forward correction. |
| SQL succeeds but Edge deployment/verification fails | Keep reminders paused and withhold new permission acceptance/frontend release. Preserve SQL/data and repair/redeploy the matching Edge forward. Do not restore old Edge as a full rollback or resume it with the new policy. Record pause duration and potentially missed reminders. Escalate if the quiet window/recovery margin is exceeded. |
| RPC cache or installed-source mismatch | Keep paused, stop acceptance. Verify actual schema/cache and correct deployment with reviewed forward actions; do not mutate a test Event or replay SQL as a probe. |
| Scheduler cannot resume, duplicate job or unhealthy natural invocation | Stop acceptance/frontend release. Inspect the original job and backend; restore only that job through the approved control. Do not create a second scheduler or call HTTP repeatedly as a substitute. If it became active but is unhealthy, contain using the approved pause and drain again. |
| Later acceptance fails | Stop frontend release, preserve evidence/data. A backend defect needs reviewed forward corrective migration/Edge; frontend defect stays local. Do not disable guards, reset schema, clear business data, delete ledger rows or replay old sends. |

There is no automatic notification catch-up beyond the existing 10-minute grace,
no new retry/lease/replay mechanism and no guaranteed lossless long outage. Preserve
all existing Events, segments, exceptions, ledger/history and Push subscriptions.
Do not modify Storage, RLS configurations outside the patch, Cron schedule/command,
Auth or other modules. Pause/resume is a future authorized operational action only.

Official operational references: [Cron activation/deactivation](https://supabase.com/docs/guides/cron/quickstart),
[pg_net queue and response semantics](https://supabase.com/docs/guides/database/extensions/pg_net).

### Read-only preflight — one result

Expected baseline: installed=false, event_rls=true, guards=4, invalid_audiences=0, invalid_links=0.
This is bounded prerequisite checking, not a complete production drift audit.

~~~sql
select jsonb_build_object(
 'installed',to_regprocedure('public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date)') is not null,
 'event_rls',(select relrowsecurity from pg_class where oid='public.events'::regclass),
 'guards',(select count(*) from pg_trigger where tgrelid='public.events'::regclass
   and not tgisinternal and tgenabled='O' and tgname in
   ('events_validate_owner','events_lock_personal_membership','events_prepare_reminder_schedule','events_touch_updated_at')),
 'invalid_audiences',(select count(*) from public.events e join public.spaces s on s.id=e.space_id
   where e.scope not in ('personal','shared') or (e.scope='shared' and e.owner_user_id is not null)
   or (e.scope='personal' and (e.owner_user_id is null or not exists
     (select 1 from public.space_members m where m.space_id=e.space_id and m.user_id=e.owner_user_id)))
   or (s.kind='personal' and (e.scope<>'personal' or e.owner_user_id is distinct from s.created_by))),
 'invalid_links',(select count(*) from public.events c join public.events p
   on p.id=c.series_id or p.id=c.parent_event_id where c.id<>p.id
   and (c.space_id is distinct from p.space_id or c.scope is distinct from p.scope
     or c.owner_user_id is distinct from p.owner_user_id
     or coalesce(c.series_id,c.id) is distinct from coalesce(p.series_id,p.id)))
);
~~~

### Read-only SQL postflight — one result

All booleans true. Separately verify Edge version, PostgREST cache and real-account behavior.

~~~sql
select jsonb_build_object(
 'event_rls',(select relrowsecurity from pg_class where oid='public.events'::regclass),
 'save_invoker',(select not prosecdef from pg_proc where
   oid=to_regprocedure('public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date)')),
 'save_authenticated_only',
   has_function_privilege('authenticated','public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date)','EXECUTE')
   and not has_function_privilege('anon','public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date)','EXECUTE')
   and not has_function_privilege('service_role','public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date)','EXECUTE'),
 'check_service_only',
   has_function_privilege('service_role','public.check_event_reminder_delivery(uuid,uuid,timestamptz,timestamptz,date,uuid,timestamptz,text)','EXECUTE')
   and not has_function_privilege('authenticated','public.check_event_reminder_delivery(uuid,uuid,timestamptz,timestamptz,date,uuid,timestamptz,text)','EXECUTE')
   and not has_function_privilege('anon','public.check_event_reminder_delivery(uuid,uuid,timestamptz,timestamptz,date,uuid,timestamptz,text)','EXECUTE'),
 'lineage_constraint',exists(select 1 from pg_trigger where tgrelid='public.events'::regclass
   and tgname='events_lineage_audience' and tgenabled='O' and tgdeferrable and tginitdeferred),
 'old_guards',(select count(*)=4 from pg_trigger where tgrelid='public.events'::regclass
   and not tgisinternal and tgenabled='O' and tgname in
   ('events_validate_owner','events_lock_personal_membership','events_prepare_reminder_schedule','events_touch_updated_at'))
);
~~~

### Production operational preflight — user runs now, READ ONLY

Run this whole block in the correct Production project's SQL Editor and return the
single JSON result from one SELECT (no trailing COMMIT result). It incorporates the focused schema preflight above; do not
execute the migration. No secret/credential columns, source text or Auth sessions
are selected. The reminder source lists are deliberately conservative (Event
sources include every enabled reminder; Task/Important Date require enabled module).
Snapshot evidence expires if users edit data. `observed_at` is the inspection time,
not the later approved pause time. Re-run for pause/resume evidence when authorized.
The 30-minute HTTP/Cron view is diagnostic only, not a complete drain certificate.
If queue/history tables are missing, permissions fail or output is truncated, STOP
and report it; do not enable extensions or relax grants to make this query run.

```sql
with
j as (
  select jobid,jobname,schedule,active,md5(command) command_fingerprint,
    command like '%https://ximazjhxvmktpcdbypka.supabase.co/functions/v1/send-reminders%' expected_target
  from cron.job
  where jobname='send-reminders-every-minute' or command like '%send-reminders%'
),
e as (
  select id,space_id,starts_at,ends_at,all_day,reminder_kind,time_zone,
    reminder_schedule_changed_at,recurrence_rule,series_id,parent_event_id,
    recurrence_until,created_at,updated_at
  from public.events where reminder_kind is not null
),
x as (
  select x.id,x.event_id,x.occurrence_date,x.exception_type,
    x.override_data - 'title' - 'description' override_data,x.created_at,x.updated_at
  from public.event_occurrence_exceptions x
  join e on e.id=x.event_id where e.recurrence_rule is not null
),
t as (
  select t.id,t.space_id,t.due_on,t.status,t.reminder_kind,t.time_zone,
    t.reminder_schedule_changed_at
  from public.tasks t join public.space_modules m on m.space_id=t.space_id
    and m.module_key='tasks' and m.enabled
  where t.status='open' and t.due_on is not null and t.reminder_kind is not null
),
d as (
  select d.id,d.space_id,d.repeat_kind,d.month,d.day,d.year,d.reminder_kind,
    d.time_zone,d.reminder_schedule_changed_at
  from public.important_dates d join public.space_modules m on m.space_id=d.space_id
    and m.module_key='important_dates' and m.enabled
  where d.reminder_kind is not null
)
select jsonb_build_object(
 'observed_at',now(),
 'schema_preflight',jsonb_build_object(
   'installed',to_regprocedure('public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date)') is not null,
   'new_check_exists',to_regprocedure('public.check_event_reminder_delivery(uuid,uuid,timestamptz,timestamptz,date,uuid,timestamptz,text)') is not null,
   'new_lineage_trigger_exists',exists(select 1 from pg_trigger where tgrelid='public.events'::regclass and tgname='events_lineage_audience'),
   'event_rls',(select relrowsecurity from pg_class where oid='public.events'::regclass),
   'guards',(select count(*) from pg_trigger where tgrelid='public.events'::regclass
     and not tgisinternal and tgenabled='O' and tgname in
     ('events_validate_owner','events_lock_personal_membership','events_prepare_reminder_schedule','events_touch_updated_at')),
   'invalid_audiences',(select count(*) from public.events e join public.spaces s on s.id=e.space_id
     where e.scope not in ('personal','shared') or (e.scope='shared' and e.owner_user_id is not null)
     or (e.scope='personal' and (e.owner_user_id is null or not exists
       (select 1 from public.space_members m where m.space_id=e.space_id and m.user_id=e.owner_user_id)))
     or (s.kind='personal' and (e.scope<>'personal' or e.owner_user_id is distinct from s.created_by))),
   'invalid_links',(select count(*) from public.events c join public.events p
     on p.id=c.series_id or p.id=c.parent_event_id where c.id<>p.id
     and (c.space_id is distinct from p.space_id or c.scope is distinct from p.scope
       or c.owner_user_id is distinct from p.owner_user_id
       or coalesce(c.series_id,c.id) is distinct from coalesce(p.series_id,p.id)))
 ),
 'reminder_jobs',coalesce((select jsonb_agg(to_jsonb(j) order by jobid) from j),'[]'::jsonb),
 'running_reminder_cron',(select count(*) from cron.job_run_details r join j using(jobid) where r.end_time is null),
 'recent_reminder_cron',coalesce((select jsonb_agg(to_jsonb(r) order by start_time) from
   (select r.jobid,r.runid,r.status,r.start_time,r.end_time from cron.job_run_details r
     join j using(jobid) where r.start_time>=now()-interval '30 minutes') r),'[]'::jsonb),
 'queued_reminder_request_ids',coalesce((select jsonb_agg(id order by id) from net.http_request_queue
   where url like '%/functions/v1/send-reminders%'),'[]'::jsonb),
 'recent_http_unattributed',coalesce((select jsonb_agg(to_jsonb(r) order by created,id) from
   (select id,status_code,timed_out,(error_msg is not null) has_error,created
     from net._http_response where created>=now()-interval '30 minutes') r),'[]'::jsonb),
 'claimed_ledger',coalesce((select jsonb_agg(jsonb_build_object('id',id,'event_id',event_id,
   'task_id',task_id,'important_date_id',important_date_id,'due_at',due_at,'created_at',created_at,'updated_at',updated_at)
   order by created_at,id) from public.reminder_deliveries where status='claimed'),'[]'::jsonb),
 'recent_ledger_status',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from
   (select status,count(*) n from public.reminder_deliveries where updated_at>=now()-interval '30 minutes' group by status) q),
 'active_push_subscription_count',(select count(*) from public.push_subscriptions
   where disabled_at is null and (expiration_time is null or expiration_time>now())),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by id) from e),'[]'::jsonb),
 'recurring_exceptions',coalesce((select jsonb_agg(to_jsonb(x) order by event_id,occurrence_date) from x),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by id) from t),'[]'::jsonb),
 'important_dates',coalesce((select jsonb_agg(to_jsonb(d) order by id) from d),'[]'::jsonb)
) as production_preflight;
```

Before migration: schema_preflight expects installed/new_check_exists/
new_lineage_trigger_exists=false; event_rls=true; guards=4; invalid_audiences/
invalid_links=0. Exactly one original reminder job, expected_target=true and
schedule `* * * * *`; active initially true, false only during the approved pause,
then true after resume; command_fingerprint/jobid must remain unchanged. Do not
use only these booleans to infer installed SQL definitions or Edge version.
Return JSON before deciding the window: until source projection and live drain
checks are reviewed, **NO-GO / live maintenance prerequisites pending**.
