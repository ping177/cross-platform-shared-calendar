# Testing

## v0.1.19 backend rollout + local authenticated acceptance — pre-deploy checkpoint / 2026-10-07

- Production project `ximazjhxvmktpcdbypka`: exact `2026-10-05-v0.1.19-task-reminders.sql` applied once with its BEGIN/COMMIT; SHA-256 `84cf08fc5f6f85948dec108954296e3319f976c10c24092c9fe31c8e04ec944a`. Read-only postflight PASS: Task fields/constraints/trigger/marker, historical reminder/timezone null, ledger identities/indexes, service-only candidate/claim/check, private helpers, browser denial and Tasks module locking. Existing Event/Important Date RPC/ACL/history preserved. Old ACTIVE v3 natural Cron run 20077 succeeded / HTTP 200 / completed after SQL.
- Only send-reminders deployed to **ACTIVE v4** on 2026-10-06 00:07:25 Asia/Shanghai, with `verify_jwt=false`. Deployment `ximazjhxvmktpcdbypka_83f9152a-8bd7-47da-884d-968a5dd1347b_4`; bundle SHA-256 `5630c546285fc4345b02850ce8306f96cf47dff35cb687d799f6c0b324e7ccb2`. Uploaded source graph matched clean implementation commit `b53ad3cfbbc63a6d8409e1bcb0ec2cc2a40b311d`. Unique minute scheduler/target/config and secrets unchanged; no extra SQL, test business data or frontend deployment.
- Post-deploy natural runs **20082/20083/20084** (00:08/00:09/00:10 Asia/Shanghai): Cron succeeded, matching HTTP 200/completed, elapsed 281/130/357 ms, no timeout/transport/candidate-selection failure; failed/finalize_failures/unexpected_task_errors all 0. Runtime logs showed normal boots and no Error/Warning records. Task candidate count 0, scanned existing sources 6, due eligible/sent 0: **backend/scheduler compatibility PASS**, not real Task Push acceptance. Task RPC/legacy function ACL and historical ledger fingerprints unchanged; no observed Event/Important Date regression, no actual-delivery claim.
- Local pre-frontend gate: clean implementation HEAD/source, rebuilt frontend and actual served Vite client both target the same Production project; public client configuration available, 5175 strict-port HTTP 200, actual new TaskSheet served. No secret values inspected/output. TypeScript/build PASS before user login; Codex did not drive authenticated product sessions.
- **User-reported local authenticated pre-frontend acceptance all PASS**, received 2026-10-07: historical Task display/reminder off/no auto-fill; new no-due off/due defaults and three presets/canonical reopen; due change/removal, preset edit, complete/reopen; Personal/self, Shared/assignee and Shared/current-members copy; existing two-account Shared edits/assignment/Realtime/canonical reread; narrow-screen controls. This reports the user's local browser results; it does not establish Production installed-PWA or real Task Push delivery.
- Final pre-push recheck (docs-only changes): focused Node **143/143**, zero failures/cancellations/skips; TypeScript/Vite build PASS (1715 modules; existing bundle warning only); diff hygiene checked before docs commit. Full Node **753/753**, checked Deno **54/54** plus legacy runtime **48/48**, and SQL **935 assertions + 40 waits per fresh/upgrade path** remain valid because implementation/SQL/config/dependencies are unchanged. No need to recreate SQL databases or rerun the entire suite for governance updates.
- Remaining after separately authorized Git push/frontend publication: read-only deployed revision/assets/project-target/backend capability alignment; user refresh/restart installed PWA to receive new frontend; bounded Production Task controls/canonical persistence/recipient and relevant Shared regression; real scheduled Task Push on existing supported installations, correct recipient/device behavior and no duplicates, with natural Cron/ledger evidence. No final PASS or version CLOSED until that evidence exists. No new account, module-lifecycle/concurrency framework or unrelated UI audit is required by this checkpoint.

## v0.1.19 final local integration — READY_FOR_PRODUCTION_PATCH_REVIEW / 2026-10-05

Historical local implementation checkpoint, superseded by the rollout/acceptance record above. At this checkpoint all four approved tasks were implemented locally; Production and real-account/PWA acceptance were NOT RUN.

- New Task Node suites **21/21**, focused Task/aggregation/Home/P0b/reminder/claim/mixed-source regression **258/258**, full `node --test tests/*.test.ts tests/*.test.js` **753/753**, zero failures/cancellations/skips. Intercepted Edge entrypoint additionally covers Task source scan, exact raw-marker claim/check parameters, false/error pre-send failed finalization and incomplete Task scan abort without provider dispatch. Existing empty-Task fixtures explicitly supply the new required dependencies.
- `deno check --cached-only --no-lock --node-modules-dir=none --config supabase/functions/send-reminders/deno.json supabase/functions/send-reminders/index.ts` PASS for complete production graph. Checked `task-reminders`, `task-reminder-delivery`, `mixed-source-reminders`, `important-date-claim`, `important-date-reminders`, `important-date-candidates`, `time-zone` suites **54/54 PASS**. Existing `reminder-due`, `recurring-reminders`, `send-reminders` Deno runtime suites **48/48 PASS** with `--no-check --allow-read` and same cached config flags. No dependency installation/lockfile change. Timing-dependent mixed-worker test now has deterministic first-wave barrier; assertions unchanged.
- `npm run build` TypeScript/Vite PASS: 1715 modules, JS 764.20 kB / gzip 220.91 kB; existing >500 kB bundle warning only. `git diff --check` and Python AST syntax PASS.
- SQL fresh/upgrade verification below: **935 assertions + 40 actual lock waits per path**; actual RPC/scanner 1000/1001 + raw timestamp parity. Tests use existing Docker and guarded temporary DB names only; no Production/local-main DB connection or persistent project-data root.
- Injected actual TaskSheet handlers prove new-only 08:00 default, no-due off, historical-null due edits off, preset persistence, removal clearing, recipient copy, timezone failure before any write and canonical reread/close ordering. Exact unsigned Chrome CDP viewport 320/375px with actual SSR Sheet/final CSS: no horizontal overflow, controls in bounds, due/reminder heights 52/46px; 320px screenshot inspected. Real-device interaction/Push delivery is not established by static geometry.
- Final focused review: correctness, simplicity, architecture, security and bounded capacity PASS. Event/Important Date database function definitions and ACL preserved; shared due/timezone/Web Push/SW files unchanged. Existing 50-delivery overflow starvation is recorded, not corrected. Database pre-send qualification cannot atomically cover later provider dispatch/retract notifications; current pipeline semantics retained.

Historical next step (now completed above): separate Production patch/capability review and authorization. Exact SQL must precede new sender; missing Task candidate RPC aborts the whole run. Postflight/backend alignment must precede new authenticated frontend acceptance; local tests are not deployment or user Push PASS.

## v0.1.19 Task reminder persistence / backend — LOCAL PASS / 2026-10-05

- `python3 -u supabase/tests/task_reminder_local.py --red`: frozen `34e52df…` lacks Task reminder columns.
- `python3 -u supabase/tests/task_reminder_local.py`: PASS on guarded disposable local Docker DBs only; fresh canonical schema and baseline + exact forward patch have full public catalog/ACL parity. Historical Task fields/audit rows and legacy Event/Important Date/status-authority functions unchanged; reminders/timezones null; drift/replay rejected atomically.
- Each path: all 17 SQL files / **935 assertions** (54 new); **40 real observed waits**, including module/Space/source/ledger waits, complete/reopen, assignee round-trip, leave/remove FK set-null, due removal, subscription expiry/grace expiry and concurrent duplicate claim. Actual Task candidate RPC feeds existing scanner for **1000/1001** keyset boundaries and raw PG microseconds.
- Old Task exact-column assertion now includes only the three approved columns; existing Node ledger assertion includes task_id. No existing authorization or behavioral assertion removed.
- Cleanup drops only guarded disposable DBs; it does not delete Personal Spaces individually or touch local main/Production. Python AST syntax PASS. Production capability/rollout and real-device acceptance NOT RUN.

## 2026-10-05 — v0.1.18 final acceptance / closeout — CLOSED / PASS

User confirms **`FINAL_MANUAL_REGRESSION = PASS`** for the final implemented frontend. Slice 3 **T1/T2/T3/T4 CLOSED / PASS**; Slice 3 and v0.1.18 **CLOSED / PASS**. T4 Important Date functional manual + same-range retention UX PASS; P0a Calendar Event retention manual PASS; P0b automated PASS and normal filter/complete/reopen included in final manual regression; current-modules stage interaction cleanup PASS. Earlier manual-pending/UX-OPEN/NOT-STARTED statements below are dated historical checkpoints, superseded by this final record.

Final closeout rerun:

- Relevant focused suites **470/470 PASS**: Home Event/Task/Important Date, Calendar Event/Important Date retention, active exact target/editor, T1 date projection/query/flow, full Important Dates CRUD/Reminder, Tasks P0b and module snapshots, navigation/session restore, Event recurrence/Realtime and Reminder regressions.
- Full Node suite **732/732 PASS**, **0 failures / 0 cancelled / 0 skipped / 0 todo**; includes repository-local Project State Push Gate tests. The obsolete navigation suite is removed; active authority coverage remains.
- `npm run build` / TypeScript **PASS**: 1715 modules; JS **762.96 kB / gzip 220.60 kB**. Existing >500 kB warning remains, no code splitting.
- `git diff --check` **PASS**. Business/test files preserved byte-for-byte in this final review round; governance updated only. Actual commit-trailer/tree Push Gate and live remote verification belong to the authorized Git closeout and are reported after execution.

```sh
node --experimental-strip-types --test tests/home*.test.ts tests/calendar*.test.ts tests/important-date*.test.ts tests/important-dates*.test.ts tests/tasks-p0b.test.ts tests/module-reentry-ui.test.ts tests/navigation*.test.ts tests/recurrence.test.ts tests/reminder*.test.ts tests/task*.test.ts tests/aggregate-*.test.ts tests/event-edit*.test.ts tests/global-create*.test.ts tests/current-modules-interaction.test.ts
node --experimental-strip-types --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

Previous unsigned React/375px/320px checks remain automated evidence; final manual PASS is the user's report. No extra Production/PWA-specific acceptance was performed or inferred from repository sync. Existing Slice 1/2 Production/Push acceptance remains as recorded. No backend/schema/RPC/Realtime/dependency contract changes require a new rollout in this closeout. Future major features can trigger another whole-product interaction audit; this closes the current implemented modules stage only.

## Historical automated checkpoint (superseded by final closeout above) — 2026-10-05 Current implemented modules stage interaction cleanup — LOCAL AUTOMATED PASS

- T4 Important Date functional manual + retention UX PASS and P0a Calendar Event user manual PASS are preserved. P0b remains local automated PASS; its normal behavior joins the final regression, without a separate manual failure-simulation blocker. Slice 3 remains IN PROGRESS; no new authenticated/Production/PWA PASS is claimed. This is stage cleanup for current implemented modules, not permanent product-wide audit completion; future major features may trigger another audit.
- Reference-first proof: old controller `.open` had no production caller; App only instantiated/reset/passed empty pending state. Delete `useImportantDateHandoff`, App navigation wiring, full Important Dates pending/returnTo/list-handoff branches and unused `startOfDay`. Preserve ordinary module/view-all/session restore, full-module snapshot/CRUD and list read/error/loss handling. Active IDs/request types now live in `useImportantDateTarget`; shared exact canonical reader, target/editor, request generation, mutation guards and Home/Calendar direct Sheets stay active.
- Remove 39 obsolete Page/navigation-fixture tests; migrate active direct target/editor authority to 23 tests, alongside existing Home/Calendar/CRUD regression. Add 7 current-stage interaction tests and 2 module wording tests. Important Date retained content now says 更新中; cold entry still says 正在读取. Event/Task get local Escape, Tab containment, initial heading focus and close focus return; recurring Event chooser keeps its own scope, focus and cancel semantics. Ordinary Event trash icon gets named explicit confirmation; cancel performs no write. Busy Escape cannot dismiss an unresolved mutation. No generic modal framework. Task/Important Date confirmations and all save→close lifecycle ordering remain unchanged.
- Core **48/48**, related **470/470**, full Node **732/732 PASS**, zero failures/cancellations/skips. Count changed from 739: remove 39 obsolete tests, add 23 target authority + 7 stage interaction + 2 wording cases. `npm run build` / TypeScript and `git diff --check` PASS; 1715 modules, JS **762.96 kB / gzip 220.60 kB**. Existing >500 kB bundle warning only; no code splitting.
- Isolated unsigned real React StrictMode/DOM PASS: Event/Task/Important Date initial focus, both Tab boundaries, Escape and trigger focus return; ordinary Event confirm/cancel, busy Escape guard; recurring scope chooser focus/Tab/cancel without closing parent. The browser check exposed confirmation-cancel focus falling outside the Sheet when its old form node disappeared; a local heading fallback now keeps focus inside. Built-CSS mobile geometry **6/6 PASS** (three Sheets × 375/320px), no overlap/horizontal overflow. Injected I/O only, no authenticated session or Production operation.
- READ-ONLY served 5175 and built frontend target both match linked backend. No new schema/RPC/RLS/Realtime contract; the previous capability gate still applies. No secret/config credential inspection/output, dependency, persistent cache, generic store, keep-mounted page or external project change. Prior T4/P0a/P0b implementation is preserved; only the Calendar Important Date unused navigation-origin field/type changed in its existing untracked hook.
- Docs updated: PROJECT_STATE/DEVLOG/TESTING/BACKLOG plus current navigation assumptions in DECISIONS/spec. No commit/amend/push/deploy/Production write. Stop at the final user regression listed in TESTING.

```sh
node --experimental-strip-types --test tests/important-date-target.test.ts tests/current-modules-interaction.test.ts tests/important-dates-flow.test.ts
node --experimental-strip-types --test tests/home*.test.ts tests/calendar*.test.ts tests/important-date*.test.ts tests/important-dates*.test.ts tests/tasks-p0b.test.ts tests/module-reentry-ui.test.ts tests/navigation*.test.ts tests/recurrence.test.ts tests/reminder*.test.ts tests/task*.test.ts tests/aggregate-*.test.ts tests/event-edit*.test.ts tests/global-create*.test.ts tests/current-modules-interaction.test.ts
node --experimental-strip-types --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

User-run final regression checklist at **http://127.0.0.1:5175** — subsequently reported PASS at final closeout:

1. Home Event/Task/Important Date → own Sheet → close/cancel/save, plus 查看全部 into the ordinary full module. Home warm return keeps all three sections, next canonical result updates them, no wrong object/Space or reopen. Calendar date/view/filter persist after direct Sheet interactions; Event/Important Date warm cards stay visible and Realtime/canonical refresh remains correct.
2. Full Important Dates from 功能中心/查看全部 and refresh/session restore: current/Past/filter/create/edit/Reminder settings/delete still work; back returns to 功能中心. Warm content uses 重要日更新中, cold entry uses 正在读取. No legacy row-to-module navigation is restored.
3. Full Tasks P0b normal behavior: switch all/single Space filters; complete open and reopen completed Tasks; open Sheet uses canonical fields, sorting/next row/Realtime/warm snapshot remain correct. If an ordinary network failure happens, verify error/retry rather than endless loading. Do not deliberately cause Production failures; status/loss/race/error cases are automated.
4. Desktop Event/Task/Important Date Sheets: initial focus is inside; Tab/Shift+Tab stay inside; Escape closes or cancels the active confirmation; closing returns focus to an existing trigger. Check ordinary Event delete cancel/confirm and recurring Event only-this/current-and-future chooser. Task and Important Date keep existing confirmations; reminder presets and save/close behavior remain natural.
5. Existing Review/Lists/我的/功能中心 navigation and session restore still work. Module disable/re-enable preserves data and removes/restores applicable projections. User-operated auth/Space boundaries remain authoritative; no special Production destructive/loss fixture is required in this stage.
6. 375px main / 320px fallback: cards, Sheets, confirmation buttons and source labels have no overlap/truncation/horizontal overflow. Keyboard/physical-device/authenticated acceptance is user-run; isolated automation does not claim it.

Final local manual regression: user reports FINAL_MANUAL_REGRESSION = PASS. The earlier pending status below is historical. No additional Production/installed-PWA-specific acceptance is claimed; normal Git closeout is separately authorized and is not deployment verification. Future major modules may warrant another whole-product consistency audit.

## Historical checkpoint (normal behavior joins final regression above) — 2026-10-05 Slice 3 Tasks P0b — LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST

Current user-reported Calendar Event P0a manual acceptance: **PASS**. T4 Important Date functional + retention UX: **PASS**. Tasks P0b: **local automated PASS; authenticated/manual acceptance NOT RUN**. Slice 3 remains IN PROGRESS; P1 cleanup is pending. Historical P0a manual-pending checkpoints below are superseded by the current user PASS.

- New Tasks P0b **33/33 PASS**: first filter failure exits loading with error/current-filter retry; retained refresh failure preserves rows; retry success; old-filter data only supplies picker; A1→B→A2 late success/error and batched A→B→A action cancellation before render; fresh open/completed complete/reopen; wrong status/deleted/disabled/membership/member-record/assignee/auth loss refusal; expected-status conditional UPDATE race; exact identity mismatch; synchronous duplicate click lock; late filter/role/scope/module/user/Auth/unmount requests; unknown eligibility versus confirmed loss; shared exact Sheet qualification and original channels/cleanup. Initial 25-test RED run failed 20 before the fix.
- Related **168/168 PASS** including Home Task qualification/retention, full Tasks snapshot, Task ordering/aggregation/filter/navigation and Realtime. Full Node **739/739 PASS**, zero failures/cancellations/skips; includes unchanged Calendar Event P0a/Important Date retention, T1/T2, module snapshots, Event recurrence and Reminder.
- `npm run build` / TypeScript and `git diff --check` **PASS**. Vite 1716 modules, JS **763.26 kB / gzip 220.49 kB**; existing >500 kB warning only. No code splitting/dependency change.
- Isolated unsigned real React StrictMode **PASS**: first filter error/retry, retained content + refresh failure/retry, waiting on canonical exact Task, refusing stale completed status, successful fresh complete/reopen. Actual DOM/built-CSS error-with-retained-content geometry **2/2 PASS** at 375/320px, no overlap/horizontal overflow, controls ≥44px. 320px screenshot visually inspected. Injected I/O only; no authenticated browser or Production operation.
- READ-ONLY served development/build target matches linked backend. Qualification and status predicate use existing Task/module/member/user read and UPDATE capabilities; schema/RPC/RLS/Realtime contracts unchanged. Prior backend capability gate remains applicable; no new live catalog postflight. Fixed local server remains 5175. No .env/credential inspection or secret output.

```sh
node --experimental-strip-types --test tests/tasks-p0b.test.ts tests/aggregate-tasks*.test.ts tests/task*.test.ts tests/module-reentry-ui.test.ts tests/home-important-dates.test.ts tests/home-aggregation.test.ts
node --experimental-strip-types --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

User-run P0b acceptance at `http://127.0.0.1:5175` (pending):

1. Full Tasks: all/single Space filter and completed screen still select/order correctly. If a new filter's canonical read fails, loading ends with error + retry; retry targets the selected filter. Same-filter refresh failure keeps validated rows and exposes retry. No deliberate Production failure simulation is required; automated barriers cover those failures.
2. Complete a fresh open Task; it leaves open rows and appears in completed after canonical reread. Reopen a fresh completed Task; it returns to open. Open Task Sheet still uses fresh canonical fields.
3. User-operated second account changes status/assignee or deletes the Task before the first account acts: stale complete/reopen must not repeat/reverse an obsolete operation; fresh status/permission decides, with reread/feedback. Disabled module/member loss/auth change must not permit stale writes.
4. Rapidly switch Space filters or leave the module while qualification is pending; late actions must not mutate old targets or replace the current filter's content. Home Tasks and Realtime/snapshot warm return remain correct.
5. 375px main target / 320px fallback: error/retry, rows and completed actions remain readable without overlap/overflow. Authenticated/device acceptance is performed by the user, not Codex.

No commit/amend/push/deploy/Production write or P1 cleanup in this task. Stop at manual acceptance.

## 历史自动检查点（后续用户 manual PASS）— 2026-10-05 Slice 3 P0a Calendar Event retention — LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST

Current user-reported T4 Important Date functional + same-range retention UX acceptance: **PASS**. Calendar Event P0a: **local automated PASS; authenticated/manual re-test NOT RUN**. Slice 3 remains IN PROGRESS; Task P0b and P1 cleanup are pending. Historical T4 UX-OPEN/manual-pending checkpoints below are superseded for Important Date only.

- Focused **228/228 PASS**, full Node **706/706 PASS**, no failures/cancellations/skips. Covers first load/validated display-only slot, same-range first-frame restore, pending Space refresh, mounted refresh/error/retry, fresh replacement after delete/edit/recurrence exception, complete empty snapshot, retained click waiting for canonical source, missing/inaccessible/out-of-range rejection, auth/member/role/filter/view/range/timezone invalidation, A1→B→A2 actions/reads and original Realtime reconnect/cleanup. Event Feb29 SKIP and Important Date fallback coexist unchanged. Full regression includes T1/T2, Home/full-module snapshots, navigation and Reminder.
- Isolated unsigned real React StrictMode DOM trace **PASS**: all captured warm commits contain the Event and no cold Loading; unresolved Space/canonical reads retain it; immediate click waits and opens the fresh editor; mounted refresh failure preserves rows + retry. Injected I/O only; no authenticated browser/session or backend operation.
- TypeScript/Vite build and diff-check **PASS**. 1716 modules, JS **761.61 kB / gzip 220.03 kB**; existing bundle-size warning recorded without code splitting. Actual Calendar/status SSR with final built CSS, refresh/partial/error/empty × 375/320px: **8/8 geometry PASS**, no overlap/horizontal overflow. Static evidence does not establish touch/keyboard/device acceptance.
- Read-only development/build target matches linked backend; Event/member/exception/Sheet API contracts unchanged. Previous capability gate remains applicable; no new live catalog postflight or backend change. No credential/.env file inspection or secret logging. Fixed `127.0.0.1:5175` server started for user re-test; no port change, commit/push/deploy or Production write.

```sh
node --experimental-strip-types --test tests/calendar-important-dates.test.ts tests/home-important-dates.test.ts tests/aggregate-calendar*.test.ts tests/calendar-refresh.test.ts tests/event-edit-*.test.ts tests/recurrence.test.ts tests/module-reentry-ui.test.ts tests/navigation*.test.ts
node --experimental-strip-types --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

User manual re-test at `http://127.0.0.1:5175` (Event P0a only, pending):

1. Refresh the page, load a range containing Event cards, then Calendar→Home→Calendar without changing filter/view/range. Event cards must exist immediately without “正在读取日程”; Important Date cards must keep their already accepted retention behavior.
2. Click a retained Event immediately on return. It opens after current canonical reconciliation, using fresh fields; deleted/moved/inaccessible objects show feedback instead of a stale editor. Check both ordinary and recurring Events.
3. Edit/delete/reschedule/recurrence change and return to Calendar: presentation remains during reread, then canonical results replace it; date/view/filter stay unchanged. User-run second-account Realtime change should follow the same behavior.
4. If connectivity failure occurs, existing content remains with retry; retry recovers. Failed reconciliation must not authorize a stale editor. Cold first load failure keeps its normal error/retry behavior.
5. Check auth/member/Space loss removes invalid rows, and 375px/320px surfaces remain usable without overlap/overflow. This is user-operated authenticated/device acceptance; Codex does not drive those sessions.

Stop at manual re-test. No P0b/P1 implementation, Git publication, deployment or Slice 3 closeout in this task.

## 2026-10-04 — T4 retention / safe range transition — LOCAL AUTOMATED PASS / FUNCTIONAL MANUAL PASS / UX RE-TEST REQUIRED

User reports functional manual acceptance PASS for display/views/date behavior/filter/toggle/own Sheet/edit/delete/Event coexistence/basic mobile. Retention UX acceptance remains OPEN; this fix requires user re-test, not T4 closeout.

- Core focused **134/134** plus App lifecycle **4/4 PASS**. Covers cold load, validated nonempty/empty snapshot, cross-unmount warm restore before unresolved canonical/Space reads, Day→Week→Month/disjoint range, intersection-only presentation, partial coverage never published as complete snapshot, accessibility incomplete versus confirmed 0/1, same/new-range refresh errors/retry, exact fresh retained-click authority, scope/auth/filter/timezone invalidation, canonical edit/delete slot replacement, unchanged-range selection, StrictMode single actual start and A1→B→A2 slot safety.
- Related regression **545/545**, full Node **676/676 PASS**, no failures/cancellations/skips. Includes T1/T2/T3, Home Event/Task/Important Date retention/direct Sheets, full Important Dates/Past/CRUD/Reminder, v0.1.16 Tasks/Review/Lists snapshots, Event Calendar/Realtime/recurrence/Feb29 SKIP and navigation/session restore. `npm run build` and `git diff --check` PASS; 1714 modules, JS **757.28 kB / gzip 218.46 kB**. Existing bundle warning recorded, no code split.
- Actual unsigned Calendar/status SSR and built CSS, retained refreshing/partial/error-retry/validated-empty × 375/320px: **8/8 geometry PASS**; no overlap, escaped controls or horizontal/card overflow. Month cells remain ~44.7px at 375 and ~36.8×44px at 320. 320px error screenshot visually checked; no authenticated/device UX claim.
- Read-only live development configured URL and build URL match linked backend; canonical data/projection/target/editor/CRUD/Reminder contracts unchanged. Previous T4 backend capability gate and user functional PASS remain applicable; no new backend/schema/RPC/Realtime contract. No .env or credential file read, key output, authenticated browser operation, Production write or Git publication.

```sh
node --test tests/calendar-important-dates.test.ts tests/important-date-projection-flow.test.ts tests/home-important-dates.test.ts
# Also run App lifecycle cases added after core focused verification:
node --test --test-name-pattern='App.*signal rejects' tests/home-important-dates.test.ts
# Related regression: prior T3 regression command + tests/calendar-important-dates.test.ts
node --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

Minimal user UX re-test at existing `http://127.0.0.1:5175`:

1. Calendar→Home→Calendar, same filter/view/range: Important Dates remain immediately visible, no full Loading blank.
2. Day→Week→Month→next month: Event content remains independent; safe Important Date intersection stays while new-range coverage is explicitly updating, then fresh results replace it. A disjoint range may temporarily have no Important Date cards without claiming confirmed empty.

No artificial error simulation required. Keep T4 `FUNCTIONAL MANUAL PASS / UX RE-TEST REQUIRED`, Slice 3 IN PROGRESS; deferred final interaction audit follows UX PASS under separate authorization. No commit/push/deployment in this task.


## 2026-10-04 — T4 first implementation checkpoint (superseded by retention/UX checkpoint above) — LOCAL AUTOMATED PASS / READY FOR MANUAL ACCEPTANCE

- T4 focused integration **20/20 PASS**. Executes real CurrentSpaceApp/CalendarViews/T1 projection/T3 target/editor and existing Sheet callbacks with injected canonical I/O; real target adapter/CRUD/Reminder contracts remain covered by existing tests. Fixed civil dates and an injected Event read-loop timer avoid elapsed-time assertions. First rendering and direct-open tests failed before implementation.
- Coverage: exact local 1/7/42-cell bounds; past/future non-repeat; annual visible years/Dec→Jan; future anchor and Feb29 fallback; identity ties across Spaces; deterministic date-items-before-Events; all/single filter; disable/re-enable without deleting data; membership/role/auth/unmount invalidation; A1→B→A2 target and projection races; fresh canonical Reminder/timezone/raw marker; own Sheet without module navigation/Event dispatch; unchanged Event click; date/annual/start-year/repeat edit and delete reprojection; failed/missing/disabled targets; stale save callbacks; independent error/retry/unresolved refresh; foreground refresh and original Event channel notification/cleanup.
- Focused **198/198**, related regression **521/521**, final full Node **652/652 PASS** (no failures/cancellations/skips). Includes all T1 foundation tests, T2 handoff, T3 Home 80 tests, Important Date full module/CRUD/Reminder, Event recurrence/Feb29 SKIP/edit/Realtime, Tasks/Home, navigation/filter/session restore and v0.1.16 module snapshots. `npm run build` / TypeScript and `git diff --check` PASS. Vite 1714 modules; JS **754.49 kB / gzip 217.63 kB**, existing >500 kB warning only.
- Mobile unsigned static geometry **12/12 PASS** using actual Calendar/Sheet HTML and built CSS: today/week/month × view/Sheet × 375/320px, mixed Event/Important Date and long name/Space. No overlap, horizontal overflow or controls outside container; full ID card name wraps. At 375px month cells ≥44.7px both dimensions; 320px ~36.8×44px, meeting its no-overlap/overflow goal. Sheet/new row controls ≥44px high. Original Calendar header controls remain 40px. Initial 320px aspect-square/min-height overlap failed and was corrected with explicit width/min-w-0; screenshots visually inspected. Static tests do not claim real-device touch/keyboard/scroll acceptance.
- Environment gate READ-ONLY PASS: development/build target matches linked backend; fresh catalog is transaction_read_only=on, has all canonical14 columns, required tables/RLS/SELECT policies, existing CRUD/Reminder overloads and module-toggle capabilities. No new backend/schema/RPC/Edge/scheduler contract or Production write. CLI credential used internally, no credentials/.env contents logged. Codex did not operate authenticated browser sessions. Existing sender/Push Production acceptance remains historical.

```sh
node --experimental-strip-types --test tests/calendar-important-dates.test.ts
node --experimental-strip-types --test tests/calendar-important-dates.test.ts tests/aggregate-calendar*.test.ts tests/important-date-projection*.test.ts tests/important-date-handoff.test.ts tests/home-important-dates.test.ts tests/important-dates-data.test.ts
# Related regression: preceding T3 regression command below + tests/calendar-important-dates.test.ts
node --experimental-strip-types --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

User-run authenticated/manual checklist (NOT RUN):

1. Today/week/month (including adjacent-month cells) shows Important Dates; month selection reveals the day's cards.
2. Annual/non-repeat, historical/future/anchor and Feb29 dates resolve correctly.
3. All/single Space filters preserve ownership and correct source labels.
4. Disable hides that Space; re-enable restores preserved records after reread.
5. Important Date click opens its own Sheet on Calendar, with canonical Reminder/timezone settings; never EventSheet/full module.
6. Change date/month/day/start-year/repeat: old occurrence goes away, new date appears only when in range.
7. Delete: occurrence disappears after canonical reread; save/close/cancel stay on Calendar with same date/view/filter.
8. Mixed same-day Event + Important Date shows both; ID-first, Event order preserved.
9. 375px phone and 320px fallback: month/day/week/long names/Sheet, touch, keyboard/scroll, no overlap/overflow.
10. Existing Event open/create/edit/delete/recurrence/filter/Realtime and Home three-section retained return/direct Sheet/CRUD/Reminder remain correct.

Use existing `npm run dev` / `http://127.0.0.1:5175`; do not change the fixed port. T4 remains LOCAL AUTOMATED PASS / READY FOR MANUAL ACCEPTANCE; T1/T2/T3 closed, overall/Slice 3 IN PROGRESS. Deferred final Interaction Consistency & Cleanup Audit is not performed here; final Slice 3 Production/PWA acceptance follows T4 and that audit. No Git publication or deployment in this task.

## 2026-10-04 — v0.1.18 Slice 3 T3 final acceptance / closeout — CLOSED / PASS

`T3_AUTHENTICATED_LOCAL_ACCEPTANCE = PASS` (user-reported). Home Event / Task / Important Date all PASS; return to all three preserves content without Loading flash; single rows open their own Sheet directly on Home. Important Date top3, next-occurrence order, source Space, fourth-row refill after delete, disable/re-enable inclusion/order, edit/save, Reminder edit/save, delete, close/cancel staying Home, view-all entering full module, and basic mobile layout PASS. This supersedes the historical manual-pending checkpoints below. It does not establish current T3 installed Production/PWA acceptance.

Final full accumulated diff review PASS: canonical authority remains Supabase/RLS; retained rows cannot initialize stale editors or authorize mutations; exact readers and current canonical reconciliation qualify actions. Auth/scope/date/range/confirmed module invalidation, A1→B→A2, late target/list/write results, refresh-error retention, original Realtime cleanup and cross-Sheet opening tickets are covered. No new backend/dependency/Realtime/cache/store/router/framework or T4 code. T2 and full-module contracts are preserved.

- Focused **205/205 PASS**: Home Event/Task/Important Date retention/actions/direct Sheet, Home aggregation, T1 pure projection/reader/lifecycle, T2 handoff, Important Dates adapter/entry/full-module flow/UI.
- Relevant regression **501/501 PASS**: additionally Calendar/Event recurrence/edit, Event/Task Realtime, Reminder/CRUD, v0.1.16 Tasks/Review/Lists snapshots and navigation/session restore.
- Full Node **632/632 PASS**, no failures/cancellations/skips; `npm run build` / TypeScript PASS; `git diff --check` PASS. Vite 1712 modules, JS **750.17 kB / gzip 216.46 kB**; existing >500 kB warning only, no code splitting.

```sh
node --experimental-strip-types --test tests/home-important-dates.test.ts tests/home-aggregation.test.ts tests/important-date-projection*.test.ts tests/important-date-handoff.test.ts tests/important-dates-data.test.ts tests/important-dates-entry.test.ts tests/important-dates-flow.test.ts tests/important-dates-ui.test.ts
node --experimental-strip-types --test tests/home-important-dates.test.ts tests/important-date*.test.ts tests/important-dates*.test.ts tests/navigation*.test.ts tests/task-navigation-regression.test.ts tests/home-aggregation.test.ts tests/global-create*.test.ts tests/aggregate-tasks*.test.ts tests/aggregate-calendar*.test.ts tests/calendar-refresh.test.ts tests/recurrence.test.ts tests/event-*.test.ts tests/recurring-reminders.test.ts tests/mixed-source-reminders.test.ts tests/send-reminders*.test.ts tests/task*.test.ts tests/review*.test.ts tests/lists*.test.ts tests/module-availability.test.ts tests/module-reentry-ui.test.ts
node --experimental-strip-types --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

T3 CLOSED / PASS (local automated + authenticated local acceptance); overall/Slice 3 IN PROGRESS, T4 NOT STARTED. Next is a separately authorized T4 Calendar projection prompt. After T4/functional completion and before Slice 3 final closeout, perform the deferred Interaction Consistency & Cleanup Audit recorded in BACKLOG, then arrange final Slice 3 Production/PWA acceptance. Normal Git remote publication may trigger existing Vercel automation; it is not manual deployment or Production acceptance. No Production write or Codex logged-in session operation in this closeout.

## v0.1.18 Slice 3 T3 Home Important Date direct Sheet — LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST

User-confirmed Home three-section retained-return UX is PASS. New frozen interaction: Home single Event / Task / Important Date opens its own Sheet; title/view-all alone navigate to the full module. Important Date direct-open authenticated/mobile acceptance and full T3 acceptance are pending. Slice 3 IN PROGRESS; T4 NOT STARTED.

- TDD first reproduced Home unmount on row click. New Home tests execute real App/Home/target/editor handlers with injected network: navigation spy and page mount counter prove zero navigation/full-module mount, one exact target read, Home visible throughout and no full-list prerequisite even with unresolved list or global availability (shared target/T2 regression additionally holds real `resolveHubEligibility` Review qualification pending).
- Canonical14 authority including Reminder preset, timezone and raw `reminder_schedule_changed_at` comes from fresh exact target, never a retained row. Existing adapter verifies initial/final Auth, both identity filters, current membership/role, enabled module, Space identity and loss-vs-error semantics. Home target controller rejects mismatched returned identities too.
- Save/delete/close remain Home. Mutation tests cover canonical update/delete helpers, Reminder payload/marker ownership, retained presentation while refresh is unresolved, canonical ordering and A/B/C→B/C/D refill; no source-payload patch/full-module snapshot write. Failure keeps Home and explicit retry/confirmation, never false success. Missing/ineligible requests trigger Home reread; independent projection scope loss hides invalid rows.
- Pending cancel/unmount/sign-out/user switch/member loss/module disable/role change reject late results. Rapid A1→B→A2 publishes only A2; stale errors are masked before effects. Old save callbacks lose authority after close/scope/Auth loss; late save/delete results cannot close or refresh a newer target. Pending Event/Task↔Important Date clicks cancel existing Home opening tickets to avoid stacked Sheets.
- Full module ordinary entry/filter/Past/retained snapshot/create/edit/delete/Reminder/toggle and all 39 T2 tests PASS. Existing Home Event/Task/Important Date retention, Realtime read loops, T1 projection, Tasks/Review/Lists snapshots, Event/Calendar/recurrence, navigation/session restore and Reminder regression PASS. No snapshot shape or subscription contract changes in this task.
- Focused **135/135** (Home **80**, handoff **39**, adapter **16**); relevant regression **501/501**; full Node **632/632**, no skips. TypeScript/Vite build and `git diff --check` PASS; JS **750.17 kB**, gzip **216.46 kB**, existing >500 kB warning, no code splitting.
- Temporary outside-repo deterministic comparison uses real App/reader/Sheet, saved pre-task source and fake read-only transport: navigation **1→0**, ImportantDatesPage mount **1→0**, target reads **6→6** (Auth **2**, exact source **1**, qualification **3**). Both retain four read stages: initial Auth → canonical14 source → parallel membership/module/Space → final Auth → Sheet. After: Home remains visible, Sheet actionable before deferred Review finishes; no extra target request when global pending ends. No physical latency claim or time threshold.
- Actual shared Sheet HTML plus built CSS in isolated unsigned headless Chrome: short/long name × 375/320px **4/4 PASS**; Home stays behind overlay, z-index 40, form within viewport, no control overlap/clipping/horizontal overflow, controls ≥44px. Existing Sheet focus entry/Tab trap/Escape/focus restoration and backdrop semantics are reused; no module DOM dependency, scroll-lock or shared dialog framework added. Real device/keyboard/touch acceptance remains manual.

```sh
node --experimental-strip-types --test tests/home-important-dates.test.ts tests/important-date-handoff.test.ts tests/important-dates-data.test.ts
node --experimental-strip-types --test tests/home-important-dates.test.ts tests/important-date*.test.ts tests/important-dates*.test.ts tests/navigation*.test.ts tests/task-navigation-regression.test.ts tests/home-aggregation.test.ts tests/global-create*.test.ts tests/aggregate-tasks*.test.ts tests/aggregate-calendar*.test.ts tests/calendar-refresh.test.ts tests/recurrence.test.ts tests/event-*.test.ts tests/recurring-reminders.test.ts tests/mixed-source-reminders.test.ts tests/send-reminders*.test.ts tests/task*.test.ts tests/review*.test.ts tests/lists*.test.ts tests/module-availability.test.ts tests/module-reentry-ui.test.ts
node --experimental-strip-types --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

Next user acceptance after the existing readiness gate at **127.0.0.1:5175**: all three single rows open their own Sheet on Home; title/view-all enter full Important Dates module; exact object/Space/Reminder match canonical state; close/save/delete remain Home without Loading flash; date edits/deletes reorder/refill only after reread; missing/loss/error retry and rapid clicks do not open stale/wrong objects; 375px primary, 320px no overlap/clipping/overflow, focus/keyboard/backdrop/touch behavior. Full module filter/Past/CRUD/toggle and the earlier return UX PASS must remain. Codex does not operate logged-in sessions. Built frontend target matches linked backend; required existing table/RLS/CRUD/Reminder capabilities unchanged. Previous read-only alignment evidence remains historical, not a new live postflight. No commit/amend/push/deploy/Production write.

## v0.1.18 Slice 3 T3 Important Date global-pending decoupling — LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST

User Home three-section return UX remains PASS; Important Date real click speed still failed the previous re-test. This implementation removes the confirmed frontend waiting relation, but does not claim real-speed PASS or full authenticated T3 acceptance. T4 NOT STARTED, Slice 3 IN PROGRESS.

- Handoff **39/39**: initial unknown/pending exact opening; real resolveHubEligibility with unresolved Review while other three qualifications finish; stable→refreshing→stable one-read publication; first confirmed valid hint without restart versus first confirmed loss; Space/member/module loss and late reply rejection; target role change invalidation versus unrelated role change; zero-eligible one-time consume/safe exit; StrictMode one actual start and pre-microtask cleanup zero starts; queued and in-flight A1→B→A2; actionable save/delete during refresh; canonical Reminder/CRUD, source identity, error/retry, background list pending/error and later confirmed loss from a pre-opening callback (also before React commits target publication), close/save/delete no reopen, sign-out/unmount, existing session navigation.
- Exact-target adapter/security tests remain unchanged: initial/final Auth, both identity filters, 14 canonical fields, post-source membership/role/module/Space qualification, confirmed loss versus transport errors and unchanged mutation helpers. Ordinary full module and retained snapshot entry regressions pass; global availability allSettled contract is untouched.
- Focused **83/83**, related regression **472/472**, full Node **603/603**, no skips; TypeScript/Vite build and diff-check PASS. Bundle JS 744.19 kB / gzip 214.77 kB; existing warning recorded, no code splitting.
- Temporary deterministic diagnostic outside the repo: actual App navigation, exact reader, module hook and Sheet; injected transport 40ms/request and Review qualification 400ms, comparing saved pre-fix Page to current source. Page mount 0.5→0.4ms; target read start 404.0→1.4ms; source end 487.3→83.3ms; qualification end 568.3→165.5ms; Sheet render/action-ready 571.2→167.6ms; publication-to-render 2.9→2.1ms. Both use six target reads. After: actionable Sheet before Review resolves (~400.4ms), no extra target read when it finishes. Assertions use pending barriers/counts/identities, not wall-clock thresholds. These figures do not measure real-account network or physical browser paint.

```sh
node --test --experimental-strip-types tests/important-date-handoff.test.ts tests/important-dates-data.test.ts tests/important-dates-entry.test.ts tests/important-dates-flow.test.ts tests/important-dates-ui.test.ts
node --test --experimental-strip-types tests/home-important-dates.test.ts tests/important-date*.test.ts tests/important-dates*.test.ts tests/navigation*.test.ts tests/task-navigation-regression.test.ts tests/home-aggregation.test.ts tests/global-create*.test.ts tests/aggregate-tasks*.test.ts tests/aggregate-calendar*.test.ts tests/calendar-refresh.test.ts tests/recurrence.test.ts tests/event-*.test.ts tests/recurring-reminders.test.ts tests/mixed-source-reminders.test.ts tests/send-reminders*.test.ts tests/task*.test.ts tests/review*.test.ts tests/lists*.test.ts tests/module-availability.test.ts tests/module-reentry-ui.test.ts
node --test --experimental-strip-types tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

Next manual re-test, after the existing readiness gate: user opens Home Important Date, checks correct canonical object/Reminder/Space, click speed, close/save/delete, independent list loading/error, scope loss and 375px (320px only no overlap/clipping/overflow). Home retained-return PASS must remain. Codex does not drive authenticated sessions. Backend capability requirements remain unchanged; current built target matches linked backend, previous read-only alignment evidence remains historical, no new live catalog postflight is claimed. No commit/amend/push/deploy/Production write.

## 2026-10-04 — Home object-open latency optimization — LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST

User confirms Home Event/Task/Important Dates return UX (no Loading flash) PASS and correct Event/Task objects. This is not full T3 authenticated acceptance. T3 remains LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST; T4 NOT STARTED; Slice 3 IN PROGRESS.

- Focused **95/95**: Home flow/retention/action safety **51**, T2 handoff **28**, Important Date adapter **16**. Task test holds all three DB reads pending after first Auth, verifies no editor until all plus final Auth, and rejects each query failure/disable/missing/closed/auth switch/late A click; quick-complete qualification remains covered.
- Important Date tests hold the full list pending while exact-target Sheet is already actionable; the inverse ordering cannot open from a list object. List success cannot replace draft/reopen; list failure (including Auth transport failure) cannot block an independently qualified target retry. Actual sign-out closes it. Target pending supports canonical save/delete and one-time consumption. Missing, disabled/member/Space loss, query failure, identity mismatch, full 14 fields, same-label cross-Space identity, A→B→A, stale list/loss/save/delete, entry pending/confirmed loss and unmount are covered.
- Reader transport assertions: one exact important_dates SELECT by Space/id, no range/pagination or other object query; source completes before three current target qualification queries start together; first/final Auth bracket publication. Six reads, four stages. RLS SELECT alone is insufficient for module enablement. Confirmed loss supersedes a failed source read; unknown failures retain exact identity for retry. Full-list snapshots remain complete datasets only.
- Relevant regression **451/451**, full Node **592/592**, no skips. Existing Home retained content, Event/Task Realtime, T1/T2, full Tasks/Review/Lists/Important Dates snapshots, ordinary module/filter/Past/CRUD/Reminder, Event/Calendar and navigation/session restore PASS. `npm run build` / typecheck and `git diff --check` PASS. JS 743.24 kB / gzip 214.55 kB; existing bundle warning only.
- Local 40ms-per-read diagnostics use real App/handlers/Sheets and fake transport/hooks, with no Production calls or wall-clock assertions in tests. Event **3.3ms** (0 prerequisite reads), Task **124.5ms** (5 reads/3 stages, previously 206.6ms/5 stages), Important Date **164.7ms** (6 prerequisite reads/4 stages, previously 501.8ms/13 reads/12 stages), warm **162.5ms**. Independent full-list background uses 8 more reads: **14 total**, not a total-query reduction. Pagination increases background work without becoming a Sheet prerequisite.
- Readiness: built backend target matches linked project; existing read-only alignment evidence confirms required columns/RLS and prior Reminder capability. No backend/schema/RPC change, deployment or new live catalog postflight. Authenticated/browser/device acceptance remains user-owned.

```bash
node --test tests/home-important-dates.test.ts tests/important-date-handoff.test.ts tests/important-dates-data.test.ts
node --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

Manual re-test: keep all three Home return UX PASS; compare Task/Important Date opening, verify fresh name/reminder/source Space, list loading/failure independent of target editing, no reopen after close/save/delete, exact retry versus deleted/disabled/removed target, scope/auth changes and 375px mobile (320px no overflow). Existing environment alignment gate applies; no T3 authenticated PASS or remote sync is claimed.


## Home Event / Task retention — LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST

User-confirmed Important Dates return UX re-test is PASS. Home overall authenticated/manual acceptance is not complete; T3 remains LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST, T4 NOT STARTED, overall/Slice 3 IN PROGRESS.

- Actual App/Home handler fixture now 40/40: cold publication; immediate Event/Task restoration before effects/Space reads/canonical Promises; canonical replacement; full qualified Task expand beyond five; completed/deleted/assignee/horizon exclusion and replacement; retained error/retry vs cold error; ordinary/recurring Event own source authority; exact Task open; qualified/open-only completion; Event click racing Realtime; freshly disabled Task before setup; member/role/user/day/range and scope loss; warm A1→B→A2 old result/action suppression; unmount/auth-await cancellation; sign-out; notification/reconnect/cleanup; Event-only/Task-only warm gate; module/lifecycle signals. Existing 18 Important Dates Home tests remain PASS.
- Home aggregation 11/11: three-day canonical recurrence/exception semantics, complete member/source qualification, Task Home sorting/horizon, fail-closed independent sections; barriers prove parallel independent chains; 501-row Event/Task/exception pagination stays sequential and complete; fresh Task eligibility callback precedes source failure without publishing partial rows.
- Final focused 106/106; relevant regression 394/394 includes T1/T2, Home/Calendar/Event edit/recurrence, Event/Task Realtime, v0.1.16 Tasks/Review/Lists/full Important Dates snapshots, navigation/session restore and Reminder. Full Node 574/574, no skips. Build and diff-check PASS. Final JS 739.52 kB / gzip 213.59 kB; existing >500 kB bundle warning only; no code splitting.
- Isolated temporary Chrome static fixtures, no login/network business data: normal and long retained/error views at 375/320px, 4/4 geometry PASS (no overlap/clipping/horizontal overflow, controls ≥44px). This does not replace user real-browser/device/PWA acceptance. Fixed date injected into handler tests; barriers/counts are not real-network latency benchmarks.

```sh
node --experimental-strip-types --test tests/home-important-dates.test.ts tests/home-aggregation.test.ts tests/important-date-projection*.test.ts tests/important-date-handoff.test.ts
node --experimental-strip-types --test tests/home-important-dates.test.ts tests/important-date*.test.ts tests/important-dates*.test.ts tests/navigation*.test.ts tests/task-navigation-regression.test.ts tests/home-aggregation.test.ts tests/global-create*.test.ts tests/aggregate-tasks*.test.ts tests/aggregate-calendar*.test.ts tests/calendar-refresh.test.ts tests/recurrence.test.ts tests/event-edit*.test.ts tests/event-reminder.test.ts tests/recurring-reminders.test.ts tests/mixed-source-reminders.test.ts tests/send-reminders*.test.ts tests/module-reentry-ui.test.ts tests/module-availability.test.ts tests/task-realtime.test.ts tests/review-history*.test.ts tests/lists-overview*.test.ts
node --experimental-strip-types --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

Manual re-test after the existing environment readiness gate: return from module/own-object to Home with all three sections; Event/Task rows remain immediately, then reconcile. Immediately click retained Event (ordinary/recurring) and open/complete retained Task while refresh is pending; editors/actions must use fresh canonical qualification. Verify Event delete/reschedule/recurrence edit, Task complete/edit/delete/assignee/due changes and next-item fill, independent error/retry, module disable/membership loss, date rollover, and 375px (320px only no overlap/clipping/overflow). Important Dates previously confirmed return behavior must stay PASS.

Target verification: current built frontend matches the linked Supabase backend, local Vite stays 5175/strictPort, and this fix adds no backend capability/API requirement. Prior alignment READ-ONLY result remains historical evidence. No fresh live catalog postflight was completed in this task (installed CLI help terminated SIGKILL); do not relabel that evidence as a new live gate. No Production writes, authenticated session driving, Git publication or deployment occurred.

## v0.1.18 Slice 3 T3 validated-view retention — LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST

- Previous user Home warm-return acceptance FAILED due to loading flash. This fix reuses v0.1.16 App-owned validated-view retention, independent of the full Important Dates module snapshot. Manual/authenticated PASS is not claimed; T4 NOT STARTED, Slice 3 IN PROGRESS.
- Home tests now **18/18**: first cold entry; App snapshot publication and real module/Home unmount/re-entry; immediate retained render before effects, pending Space refresh and unresolved canonical Promise; fresh name replacement; save/delete old presentation followed by canonical B/C/D replacement; update failure retains rows/error/retry; unknown availability is not disable; fresh scope loss clears before source failure; zero eligibility hides; wrong user/day/membership/role/known-disabled initial rejection; midnight/sign-out; local disable/leave/remove/delete signals. Existing T2 exact-object/Reminder/date semantics and Event/Task isolation remain covered.
- Projection flow tests **14/14** additionally verify refreshing vs fresh success/error, successful callback contains only bounded presentation, auth-read failure clears and permits fresh retry, A1→B→A2 cannot overwrite App retention, explicit invalidation suppresses late callbacks. Existing latency parallelism, strict complete pagination/auth/eligibility bounds and StrictMode/same-turn suppression remain unchanged.
- Focused **49/49**, related regression **299/299**, full Node **548/548**, no skips. `npm run build` and `git diff --check` PASS. JS 730.40 kB / gzip 210.63 kB; existing >500 kB bundle warning only. Tests inject transport/account boundaries; they do not establish logged-in network timing or physical-device acceptance.

```sh
node --experimental-strip-types --test tests/home-important-dates.test.ts tests/important-date-projection.test.ts tests/important-date-projection-data.test.ts tests/important-date-projection-flow.test.ts
node --experimental-strip-types --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

Manual re-test target after the existing frontend/backend readiness gate: Home has rows → module/own-object → return Home; rows remain immediately, background reconciliation does not flash. Then verify save/delete replacement, module eligibility and 375px (320px only no overlap/clipping/overflow). The local implementation has no backend capability changes; previous alignment remains recorded, not a new live postflight. Existing Production/PWA does not contain this local worktree. No commit/push/deploy/Production write is authorized here.

## v0.1.18 Slice 3 T3 return latency — historical B/C checkpoint (retention fix above supersedes its UX boundary)

- Authenticated user feedback confirms three rows/order/Space source, but return-to-Home latency prevents manual PASS. Earlier local closure below is historical; frontend/backend alignment subsequently PASS, no backend contract changed by this fix. Resume only local user re-test; no authenticated session is driven by Codex.
- Added deterministic transport barriers/counts proving two independent candidate reads start per eligible Space before annual pagination finishes, complete 501 annual pages + non-repeat bounds equal the full canonical global top 3, and either Space's incomplete non-repeat response rejects without partial results. Pre/post module passes, 4 auth checks and 2 membership reads remain explicit assertions. Existing disabled/membership/source failures and A1→B→A2 suppression remain green.
- Real hook effect replay test proves StrictMode setup/cleanup/setup starts one canonical read and cleanup before its microtask starts none. Same-turn foreground read supersedes queued mount work. Actual App handlers prove entry from Calendar and return from own-object Sheet each reconcile once; stable renders add none. Existing close/save/delete fresh Home/top-three replacement, date semantics, foreground lifecycle and Event/Task isolation remain covered.
- Focused **33/33**, relevant **299/299**, full Node **538/538**, no skips; build/typecheck/diff-check PASS. JS 728.33 kB / gzip 209.99 kB, existing bundle warning only. No tests use real network timing thresholds.
- Controlled temporary local diagnostic uses real Vite-loaded reader/current-spaces, installed PostgREST transport and actual App/Home/Page handler runtime; replaces I/O with fixed 40ms request latency. Reader initial ~539→466ms, return ~502→454ms; return candidate phase ~85→42ms; pre/post ~200ms each, 14 projection requests unchanged. Actual navigation adds App Space refresh and existing Task module setup; no claim these totals are all Home/Event/Task traffic. StrictMode effect protocol proves duplicate complete reads 2→1. Evidence is local injected timing, not Production/user browser performance. At this historical B/C checkpoint Home still went through loading; the separately authorized existing-pattern retention fix above now supersedes that presentation boundary. Canonical reconciliation remains mandatory.

```sh
node --test tests/important-date-projection-data.test.ts tests/important-date-projection-flow.test.ts tests/home-important-dates.test.ts
node --test tests/home-important-dates.test.ts tests/important-date*.test.ts tests/important-dates*.test.ts tests/navigation*.test.ts tests/task-navigation-regression.test.ts tests/home-aggregation.test.ts tests/global-create*.test.ts tests/aggregate-tasks*.test.ts tests/aggregate-calendar*.test.ts tests/calendar-refresh.test.ts tests/recurrence.test.ts tests/event-reminder.test.ts tests/recurring-reminders.test.ts tests/mixed-source-reminders.test.ts tests/send-reminders*.test.ts
node --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

User re-test: repeatedly return from another tab/module/own-object Sheet and assess waiting; then continue original exact-object/Reminder/close/save/delete/replacement/module-toggle/mobile checklist. Do not manufacture backend failure. Actual PWA needs an accessible secure T3 frontend; existing Production PWA does not contain the unpushed local commit/fix. T3 manual acceptance NOT PASS, READY FOR MANUAL RE-TEST; T4 NOT STARTED, Slice 3 IN PROGRESS. No commit/push/deployment/Production operation in this fix task.

## v0.1.18 Slice 3 T3 Home top-3 final review — CLOSED / LOCAL AUTOMATED PASS / AWAITING AUTHENTICATED ACCEPTANCE

- New `tests/home-important-dates.test.ts` **10/10 PASS** exercises actual App/Home/section/T1/T2/Page handlers with injected I/O and hook runtime. Covers 0/1/3/>3, global stable IDs across Spaces, canonical annual/non-repeat/future anchor/Feb29/past rules; loading vs qualified hide/confirmed empty/error/retry; mixed/all disabled, re-enable/membership loss; exact fresh object vs colliding/stale Home snapshot; view-all/title without Sheet; close/save/delete and return reread/top-three replacement; confirmed missing; auth loss/switch, rapid A1→B→A2, foreground/online/visible/midnight and cleanup. T1's existing pure/query tests remain the detailed date/completeness proof; no second algorithm is added.
- Independent real Home section checks explicitly prove Important Date error with successful Event + Task content, successful Important Dates with Event failure, and successful Important Dates with Task failure. Existing Event/Task channel setup remains; no Important Date database channel. Canonical module CRUD/Reminder handlers and navigation are real in the flow test; actual browser/backend authentication is not claimed.
- Relevant **294/294**, full Node **533/533** PASS, no skips; build/typecheck and diff-check PASS. Build 1708 modules; JS 728.24 kB / gzip 209.95 kB. Existing >500 kB warning persists with the expected projection code newly mounted (baseline 718.93 / 207.01); no code splitting/dependency change.
- Actual Home SSR markup with built CSS checked in isolated, unauthenticated headless Chrome. Normal and long names/Space source at **375/320px, 4/4 geometry PASS**: three rows, >=44px buttons, no control overlap/outside bounds or horizontal overflow; primary status remains one line. Normal screenshots inspected. Fixtures/profiles/screenshots stay under temporary paths outside the repo, not product/debug UI or Production data.
- Home read bounds are unchanged from T1: each eligible Space loads all annual pages plus at most three today/future non-repeat rows; combine then derive global top three. Pre/post qualification and stale guard remain canonical. App hints trigger membership/role/module invalidation only; they are not reading/ownership authority. Initial/return mount, focus/visible/online/retry, explicit civil-day rollover and user/scope generations refresh; unmount clears requests/listeners/timer. No active-view Important Date Realtime or polling.

```sh
node --test tests/home-important-dates.test.ts
node --test tests/home-important-dates.test.ts tests/important-date*.test.ts tests/important-dates*.test.ts tests/navigation*.test.ts tests/task-navigation-regression.test.ts tests/home-aggregation.test.ts tests/global-create*.test.ts tests/aggregate-tasks*.test.ts tests/aggregate-calendar*.test.ts tests/calendar-refresh.test.ts tests/recurrence.test.ts tests/event-reminder.test.ts tests/recurring-reminders.test.ts tests/mixed-source-reminders.test.ts tests/send-reminders*.test.ts
node --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

**Authenticated/manual and fresh frontend/backend alignment: NOT RUN.** Local final review and automated verification are PASS; do not begin real-account acceptance until the existing AGENTS environment alignment gate verifies the actual local target/schema/RPC/Edge compatibility. T3 changes no backend capability, but earlier Slice 2 evidence does not substitute for that later fresh gate. User performs login/browser/device/PWA checks; no debug UI, Production fixtures or credential inspection.

Future minimal checklist, after fresh alignment:

1. Home top-three/order/date text matches the full module; Personal is 我的空间, Shared uses its name.
2. Title/view-all opens the full module; colliding rows open the exact canonical object and its Reminder setting.
3. Close/save/delete then return Home: no reopen, fresh presentation, deletion removal and replacement.
4. Disable/re-enable the module preserves data and hides/restores projections. Error isolation is automated PASS; use safe local request interception only if a later manual check is needed, no Production changes.
5. 375px / installed PWA readability and return flows; 320px only overlap/clipping/overflow safety.

Final seven-file diff review PASS, including actual App return lifecycle, qualification/error distinction, independent Home readers, listener/timer cleanup and IDs-only canonical handoff. T1/T2 REMOTE SYNCED; T3 CLOSED / LOCAL AUTOMATED PASS / AWAITING AUTHENTICATED ACCEPTANCE; T4 NOT STARTED; overall/Slice 3 IN PROGRESS. Single local T3 commit authorized; no push/deployment/Production operation or authenticated acceptance in this task. Next: T3 frontend/backend alignment gate, then authenticated/manual Home acceptance. Earlier entries below describe their historical checkpoints.

## 2026-10-03 — v0.1.18 Slice 3 T2 final review — CLOSED / LOCAL AUTOMATED PASS

- Full eight-file diff review PASS: confirmed loss consumes only the current request; true read failure retains exact identity for retry; A1→B→A2 guards reject stale loss/read/mutation replies. Recovery is one straight-line additional canonical read per current request, with fresh qualification; stable completed token and callback dependencies prevent a consumption/reload loop. Ordinary Hub entry/session restore, exact Space + object canonical Sheet authority and existing CRUD/Reminder remain intact.
- Re-run focused **24/24**, relevant T1/Important Date/Reminder/navigation/session/Home/Calendar/Event regression **255/255**, full Node **523/523**, no skips; build and diff-check **PASS**. Existing >500 kB warning only (718.93 kB JS / 207.01 kB gzip). No business/test change during this final retry; closure updates only the three governance docs within the eight-file T2 commit scope.
- Complexity/security review PASS: no generic framework, route framework, global store/cache, second authority, schema/migration/RPC/Realtime/dependency, hidden Event/Event bridge or unrelated refactor. Project State uses durable T2 CLOSED / LOCAL AUTOMATED PASS facts and the required updated trailer. Earlier READY/BLOCKED entries below are historical checkpoints, superseded by this review.
- Slice 3/overall remain IN PROGRESS; T1 CLOSED / LOCAL AUTOMATED PASS / REMOTE SYNCED; T3/T4 NOT STARTED. Next: T3 Home top-3 implementation after separate authorization; no clear blocker. No push, deployment, Production operation, authenticated-session driving or external project edit. Manual acceptance remains with T3/T4 integration after environment alignment, performed by the user; this closure claims local automated verification only.

## v0.1.18 Slice 3 T2 blocker fix — LOCAL IMPLEMENTATION / AUTOMATED PASS / READY FOR FINAL REVIEW

- The previously recorded confirmed eligibility-loss consumption blocker is resolved locally; the BLOCKED entry below records the earlier review checkpoint. T2 is not CLOSED; Slice 3 IN PROGRESS, T3/T4 NOT STARTED. No commit/push/deployment/Production testing or debug UI.
- Final `tests/important-date-handoff.test.ts` **24/24 PASS**: true source/qualification failure retains exact identity and retry; successful pre/post-source qualification removing the target consumes once without fallback; disabled/membership loss with Personal still eligible yields a fresh remaining canonical list, usable create/list and no retryable loss error. Zero eligible consumes and exits Hub, including before a later failure. If list recovery itself fails or keeps drifting, retry is for the module list, not a revived target. Target-still-eligible drift remains retryable. A1 qualification loss arriving after B or A2 cannot consume the current generation. Existing missing, same-name/Emoji/date collisions, source origins, ordinary entry, session restore, CRUD/Reminder, stale save/delete and close/save/delete no-reopen coverage remains.
- Normal handoff read bounds remain the existing full canonical list pagination plus fresh pre/post eligibility. A confirmed-loss scope mismatch with surviving eligible Spaces permits **one** additional canonical list read using that fresh qualification, followed by another eligibility pass; there is no loop. Stable remaining scope publishes only that canonical result; continued drift/errors stay explicit. No eligible Spaces needs no recovery object read. No target object snapshot or second authority is added.
- TDD reproduction: **19 pass / 3 fail**, then correction. Final focused **24/24**, relevant regression **255/255**, full Node **523/523**, TypeScript/Vite build and diff-check **PASS**, no skips; same commands as the T2 implementation section below. Existing >500 kB warning remains, without code splitting or new dependency. Final review and Git authorization remain separate next steps; no authenticated/live backend evidence is claimed.

## 2026-10-03 — v0.1.18 Slice 3 T2 final diff review — BLOCKED / NO COMMIT

- Full eight-file final diff review found one consumption mismatch: fresh post-source qualification confirms the target Space is no longer eligible while another Space remains eligible, but `useImportantDates.ts` throws scope drift and retains the target. `important-date-handoff.test.ts` currently explicitly expects this retention. Confirmed eligibility loss must instead handle/clear the target; genuine query/qualification failures must retain retry identity. This is a final-review correctness blocker, not a test-run failure.
- Re-run results: T2 focused 16/16, relevant regression 247/247, full Node 515/515 (no skips), build and diff-check PASS; existing bundle warning remains. Passing tests do not certify the incorrect loss-consumption expectation. No business code/test fix, stage, commit, push, deployment or Production operation in this review task.
- Minimal next repair, after separate authorization: deliver request-scoped confirmed eligibility to the Page so the current exact target can be handled once even when source data is rejected; distinguish confirmed target-Space loss from read failure and scope drift that preserves target eligibility. Split the corresponding tests. Keep the existing no-eligible Hub exit, no fallback, latest-generation guard and canonical Sheet authority. T2 remains FINAL REVIEW BLOCKED; T3/T4 NOT STARTED.

## v0.1.18 Slice 3 T2 — own-object handoff — LOCAL IMPLEMENTATION / AUTOMATED PASS / READY FOR REVIEW

- T1 CLOSED / LOCAL AUTOMATED PASS / REMOTE SYNCED. Slice 1/2 CLOSED / PASS; overall and Slice 3 IN PROGRESS; T3 Home UI and T4 Calendar UI NOT STARTED. This checkpoint adds only transient handoff/App wiring and the existing Important Dates read/Page flow, with tests and governance docs. No Home/Calendar projection UI, new Sheet, backend/schema/RPC/Realtime/dependency, commit/push, deployment or Production operation.
- New `tests/important-date-handoff.test.ts` **16/16 PASS** uses the real handler, Important Dates hook/Page/Sheet and navigation parser with injected React/data/auth boundaries and no network. Covers identity-only payloads, distinct generations and consume-current-only; user A→B→A isolation; home/calendar origins; canonical read without entry/snapshot authority; exact Space + object identity with colliding name/Emoji/date; existing Reminder setting; confirmed missing vs read failure/retry; disabled/module/membership/Space loss and no-eligible Hub callback without fallback; post-source qualification failure/drift; A→B and A1→B→A2 with A1 last; close/save/delete without reopen; existing CRUD canonical row and delete confirmation; entry-pending/stale scope; late-save before effect cleanup; old delete busy cleanup; source return label/back callback and eligibility loss closing an open Sheet; auth loss/unmount; page-only session restore and static Event/persistence isolation.
- Handoff-triggered reads reuse the module's full canonical list pagination (500-row pages), not T1's Home/Calendar candidate subset. They run fresh eligibility before source reads and again afterward; incomplete/error/drift blocks opening and preserves retry identity. After consumption, only the completed read token and return origin survive for that page lifetime; no target/object remains in handoff, no automatic reopen. Existing mutation adapters retain their own canonical/eligibility checks. These checks are refresh boundaries, not an atomic database snapshot or Realtime guarantee.
- Scoped production diff review confirms no added EventEditTarget, Event editor call, Event RPC/mutation, hidden Event or Event ownership reuse. Home/Calendar/Event implementation, T1 adapter/projection, existing ImportantDateSheet, navigation/session contract and dependencies are unchanged. Returning uses App's existing tab path and Space refresh; Calendar selected date/view/filter remain App-owned. Future T3/T4 callers must supply identity and reread their own projection on re-entry, never a Sheet object snapshot.
- Final focused **16/16**, related regression **247/247**, full Node **515/515**, TypeScript/Vite build and `git diff --check` **PASS**, no skips. Existing >500 kB chunk warning remains; no code splitting or dependency installation. Real authenticated/browser/device acceptance has not run; mocks do not establish Production backend acceptance.

```sh
node --test tests/important-date-handoff.test.ts
node --test tests/important-date*.test.ts tests/important-dates*.test.ts tests/navigation*.test.ts tests/task-navigation-regression.test.ts tests/home-aggregation.test.ts tests/aggregate-calendar*.test.ts tests/calendar-refresh.test.ts tests/recurrence.test.ts tests/event-reminder.test.ts tests/recurring-reminders.test.ts tests/mixed-source-reminders.test.ts tests/send-reminders*.test.ts
node --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

Manual acceptance boundary: T2 has no meaningful independent Home/Calendar UI entry. Test together with T3/T4 integration; no debug UI. Before asking the user to perform these checks, Codex must complete the existing authenticated frontend/backend alignment gate; the user performs real-login/browser/PWA/device acceptance.

1. From Home and Calendar, open colliding same-name/Emoji/date objects in different Spaces; confirm the exact source, existing Reminder setting and canonical edit/delete flow.
2. Close, save, delete and return; no automatic reopen. Home rereads; Calendar retains date/view/filter and rereads projection. Refresh restores only the Important Dates page, without target/draft restoration.
3. Deleted source shows confirmed missing; read failure remains retryable; disabled module, lost membership/removed Space never falls back. With no eligible Space, return to Hub.
4. Rapid A→B→A preserves the latest target; 375px is the primary layout check, 320px only no overlap/clipping/horizontal overflow. Preserve ordinary Hub/create/list flows and existing Event/Task/Reminder behavior.

## v0.1.18 Slice 3 T1 — query / pure derivation foundation — CLOSED / LOCAL AUTOMATED PASS

- Scope is unmounted data/pure projection/request lifecycle only. Slice 1/2 remain CLOSED / PASS; overall and Slice 3 IN PROGRESS; T2 handoff, T3 Home UI and T4 Calendar UI NOT STARTED. No push/deployment, Production query/write, schema/RPC/Edge/dependency change or authenticated/device acceptance in this task.
- New `tests/important-date-projection.test.ts` **7/7 PASS**: Home 0/1/3/>3, mixed annual/non-repeat, cross-Space stable global sorting, past exclusion, future anchor and Feb29; per-Space non-repeat first-three + complete annual candidates equal full global top-three. Pure Calendar covers actual today/week/42-cell grid, cross-month/year, historical/future non-repeat, multiple annual years, future anchor, fallback, colliding name/Emoji/date across Spaces, stable ID/date identity, immutable inputs and invalid/duplicate sources. Differential assertion keeps Event Feb29 skip beside Important Date Feb28 fallback.
- New `tests/important-date-projection-data.test.ts` **8/8 PASS**: installed Supabase client + intercepted GET-only transport executes the actual PostgREST predicates/order/offset/limit. Covers Home bounds and 0/1/3/7 results, 501 annual/candidate sources through two pages, Calendar day/week/42-cell/multi-year candidate predicates, leap vs non-leap and 1900/2000/2100 boundaries, source-time membership/module/auth loss, disabled/missing/removed/empty-filter zero object queries, input snapshots before eligibility awaits, query/null/unknown-count/count-drift/duplicate/wrong-Space/truncation failures. Expected Calendar candidates come from canonical pure projection, not the production predicate builder. No network/backend fixtures or RPCs are used.
- New `tests/important-date-projection-flow.test.ts` **9/9 PASS**: real new hook with injected React runtime/reader/auth boundaries. Covers older refresh/unmount/invalidate replies, render-before-effect scope/range/user masking, rapid filters, A→B→A before effect cleanup plus exact A1 → B → A2 → A1-last (A2 retained), confirmed eligibility loss with subsequent source failure, explicit failed vs empty success, retry and focus/online/visibility/auth invalidation. Static assertions and transport spies prohibit Event mutations/RPCs, persisted occurrences, navigation and DB Realtime. No full Important Date object is retained in hook state; future click handoff still requires IDs + canonical reread in T2.

Query bounds (object requests exclude the existing eligibility passes):

- Home: for each eligible Space `s`, annual count `A_s` requires `max(1, ceil(A_s / 500))` pages; one non-repeat exact-count query returns at most `min(3, N_s)` rows with real date >= today. Total object requests `sum(max(1, ceil(A_s / 500)) + 1)`; candidate rows `sum(A_s + min(3, N_s))`. Annuals are complete by requirement, not capped to three; historical non-repeat rows are never loaded. Exact count does not imply downloading all matching non-repeat rows.
- Calendar: `D = display IDs ∩ fresh eligible IDs`; each Space has one range-filtered source stream of `C_s` candidates, requiring `max(1, ceil(C_s / 500))` pages. Total object requests `sum_D max(1, ceil(C_s / 500))`; source rows `sum_D C_s`. Non-repeat civil bounds include past/today/future real dates inside the visible range. Annual predicate has at most four branches, anchor <= segment year and canonical Feb29 fallback; projection resolves only explicit visible years. No per-day/year query fanout and no fabricated fixed-density row cap.
- Both readers perform **two canonical eligibility passes**, before source queries and after all complete. Each reuses current membership/Space paging plus exact-count module paging (500) and auth checks before/after; an empty membership list skips module queries. Zero eligible/display intersection yields **0 important_dates object queries** and a confirmed empty result only after the final eligibility pass. Stable scope mismatch rejects; no deletion, filter ownership change or fallback to another Space.
- Pagination uses existing completeRows: exact safe count, stable IDs, no duplicates/wrong Space/count drift, no silent null/truncated completion. Home first-three checks expected min(3,count) length and civil-date/ID order. This is the existing read/eligibility boundary, not a database snapshot or a realtime promise; later mutations are discovered at the next explicit/foreground canonical refresh.

Verification:

```sh
node --test tests/important-date-projection*.test.ts
node --test tests/important-date-projection*.test.ts tests/important-date.test.ts tests/important-dates-core.test.ts tests/important-dates-data.test.ts tests/important-dates-flow.test.ts tests/important-date-reminders.test.ts tests/recurrence.test.ts tests/aggregate-calendar.test.ts tests/aggregate-calendar-ui.test.ts tests/calendar-refresh.test.ts tests/space-request-guard.test.ts
node --test tests/*.test.ts tests/*.test.js
npm run build
git diff --check
```

- Results: **24/24**, **127/127**, **499/499** Node PASS, no skip; build/typecheck and diff-check PASS. Full regression includes Reminder Slice 2, Event/Task/Home, Calendar filter/render helpers and existing request lifecycle. Existing >500 kB Vite warning remains non-blocking. New SSR test servers disable env file loading; normal existing tests/build use the normal Vite configuration, without directly inspecting/printing secrets.
- User implementation report approved; final nine-file correctness/complexity/security/diff review PASS, no required findings. Calendar completeness/Feb29/cross-year/future anchor and Home per-Space top-three proof rechecked; production code unchanged during closeout. Project State freshness reviewed for local T1 closure and T2 implementation Next Action; no new version or blocker. Complexity/security/diff review: no required findings; canonical date helpers and Event/Reminder production semantics unchanged. No hidden Event, occurrence table/materialized data, schema/RPC/dependency, generic repository/query/projection framework, global store/persistent cache/source registry, DB Realtime or second editing authority. Production additions are three feature-scoped modules (one adapter extension, one pure module, one hook); no unrelated UI/App edits.
- Authenticated/manual **NOT RUN / NOT APPLICABLE TO UNMOUNTED T1**. Actual backend query/parser behavior is not asserted as authenticated acceptance. After later UI integration, first perform AGENTS backend target/capability compatibility gate, then user-owned Home error isolation, Calendar rendering/filter/click/canonical reread and 375px / 320px acceptance. T1 does not claim those later gates PASS or implement local-midnight scheduling for the future Home caller. Active-view Important Date Realtime remains deferred.

## v0.1.18 Slice 2 — final Production / installed PWA acceptance — CLOSED / PASS

- User-confirmed real Production / installed PWA Push E2E: **PASS**. Current Shared Space members receive a reminder once; no duplicate delivery; objects with 不提醒 do not send. T4 local/authenticated acceptance also PASS. Real-device acceptance is owned/reported by the user; Codex did not drive authenticated sessions or manufacture Production claims/fixtures.
- Accepted Production frontend exact source: `5222b432528bfc60e6fd0a311382b0def94dcef0`; Vercel Production deployment `6802598187` returned success / Deployment has completed. Public alias root/current JS/CSS HTTP 200; served JS contains reminder selector, repeat selector, reminder-aware RPC argument and arrow inset pattern. Backend: T2A/T2B applied once each / independent read-only postflight PASS; integrated send-reminders ACTIVE v3 / verify_jwt=false; original single once-per-minute scheduler unchanged.
- T1 due/occurrence, T2A ledger/candidate/CRUD, T2B claim/pre-send, T3 integrated sender and T4 UI all CLOSED / PASS. Existing automated/disposable/concurrency/Event-regression evidence remains in the checkpoint sections below (latest UI/flow 22/22, full Node 475/475, build and 375/320px geometry PASS); earlier pending acceptance descriptions are historical checkpoints, superseded by this final result.
- Slice 2 **CLOSED / PASS**; overall v0.1.18 **IN PROGRESS**. Active-view Important Date Realtime remains deferred, not a Slice 2 blocker. Next is Slice 3 Home / Calendar projection **READ-ONLY implementation gate**; no Slice 3 implementation or Production changes. Docs-only closeout verification: git diff --check and Project State Push Gate; no unnecessary business test/build rerun.

## v0.1.18 Slice 2 T4 — mobile select polish / authenticated acceptance

- Authenticated local acceptance checklist 1–4: USER PASS. Sole reported visual issue: repeat/reminder arrows too close to right border; reuse existing ChevronDown at 12px inset with 40px right text padding. Related UI/flow 22/22, full Node 475/475, npm run build and diff-check PASS (existing large-chunk warning). Actual Sheet SSR + built CSS in isolated no-login Chrome: create/edit at explicit 375/320px, no overlapping controls, clipping or horizontal overflow; both select computed arrow inset 12px, padding-right 40px, appearance none, height 44px. No reminder/RPC/backend behavior change. Prior T4 local-only status below is historical. Next: verify exact frontend Production deployment, refresh old tabs/restart PWA, then user-run checklist 5 natural future-due Push E2E using existing permissions/active subscriptions; no synthetic claims or scheduler changes.

## v0.1.18 Slice 2 T4 — Reminder UI — LOCAL READY FOR AUTH ACCEPTANCE / 2026-10-02

- `V018_SLICE2_T4_LOCAL_READY_FOR_AUTH_ACCEPTANCE`; implementation/automated verification PASS. Overall IN PROGRESS; Slice 2 is not CLOSED / PASS. Production backend remains READY FOR UI (T2A/T2B applied, integrated send-reminders ACTIVE v3); local Reminder UI is not pushed/deployed/publicly released. User-run authenticated/device/real Push acceptance remains pending.
- Tests-first baseline UI/data/flow run: 24 pass / 10 fail, confirming absent selector/preset payload and raw-marker guards. Final `node --test tests/important-dates*.test.ts tests/important-date*.test.ts tests/reminder*.test.ts tests/time-zone.test.ts tests/recurring-reminders.test.ts tests/send-reminders.test.ts tests/mixed-source-reminders.test.ts` **151/151 PASS**; full `node --test tests/*.test.ts tests/*.test.js` **475/475 PASS**, no skips. `npm run build` (TypeScript + Vite) and `git diff --check` **PASS**; existing >500 kB chunk warning only.
- Real Sheet handlers/SSR + data/Page adapters cover new 08:00 draft; historical null → 不提醒; explicit null/same-day/previous-day create/update overload arguments; captured creation timezone and no timezone/Space/marker edit payload; cosmetic preset/raw six-digit marker preservation; stale schedule read rejection; Shared non-creator canonical reread rather than draft/RPC-row publication; missing capability/throw/wrong returned preset rejected without retry/old-RPC fallback/success notice; optional legacy callers and existing CRUD/auth/eligibility/read/delete regressions. No browser claim/check or synthetic Production data.
- Mobile relevant checks: retained weighted annual date grid and wrap/scroll boundaries, labeled three-option 44px-high full-width/min-width-zero select, disabled busy state and existing focus handling. Actual Sheet SSR + built CSS rendered in isolated, no-network headless Chrome using explicit device metrics; create/edit at 375/320px **4/4 geometry PASS**, no horizontal overflow/overlapping controls; screenshots inspected, 320px edit actions wrap without clipping. CLI viewport/exit attempt timed out and is not counted as PASS. Static geometry is not actual device/keyboard/authenticated acceptance.
- Local acceptance readiness: existing Vite environment and built frontend target linked Production; configured 5175/strictPort remain. Fresh existing Keychain → Management read_only=true SELECT/metadata GET confirms 14-column foundation/member SELECT, full public function fingerprint `0d2772c161b5c267c3947cebcac636e5`, exact deployed reminder-aware CRUD/candidate/claim/check/private-helper body/search_path/ACL and legacy signatures, ledger source unique identity, ACTIVE v3 / verify_jwt=false and scheduler command fingerprint unchanged. No service-only RPC was invoked. No credentials were printed/persisted or .env directly inspected/edited; no new dependencies, backend writes, authenticated session driven by Codex, push or release.
- Complexity/diff/security review PASS: three production modules changed; one local draft field/selector and optional RPC argument preserve compatibility. Reuses preset/default/timezone/date/module/request-guard/canonical reread; no framework, persistent cache/second authority, member preference, new timezone engine, SQL/Edge/scheduler/ledger/claim/projection/Realtime change. Pre-mutation snapshot comparison is a frontend stale-read check, not a new transactional server concurrency token. Real backend concurrency remains the passed T2B contract.

### User-run local authenticated acceptance checkpoint

Use `http://127.0.0.1:5175` with existing real accounts against the verified Production backend. Codex does not drive these sessions. Objects/settings created here are real Space-owned data and can generate automatic Push; choose future legal occurrences whose saved-zone due time has not passed.

1. Personal new Important Date defaults to 当天08:00; save/reopen. Also explicitly save 不提醒 and 前一天20:00, verifying each after reopen. Creation keeps the browser's captured IANA zone.
2. Reopen a pre-existing null reminder object: 不提醒. Save name/Emoji only and reopen: still 不提醒. Repeat cosmetic edit on an enabled preset: preset remains; edit has no Space move control and preserves timezone.
3. A creates a Shared object; B edits the reminder. A re-enters/rereads and sees B's canonical setting. This is one shared setting, with no immediate Realtime promise. Disable/re-enable module retains the setting; disabled/removed scope cannot save.
4. On 375px (and 320px no overlap/clipping/horizontal scroll), check selector/date/actions, Sheet scrolling and keyboard. Cancel creates no object/change. A failed/offline save must not show success; re-entry reads the canonical result before retry.
5. With the intended current member devices' Push permission/active subscriptions enabled, wait for a future saved-zone 08:00 or previous-day 20:00 due and the existing natural Cron. Confirm expected current members receive once, no duplicate across later minutes; 不提醒 does not send. No manual Function/claim/check invocation or custom-time workaround. Report results before any frontend push/release or Slice 2 closeout.

## v0.1.18 Slice 2 Production backend rollout — READY FOR UI / 2026-10-02

- Reviewed rollout order completed under separate explicit authorizations: T2A `2026-10-01-v0.1.18-important-date-reminder-capability.sql` SHA-256 `f0198aae6afdc2f5b71fceccc58b517696eaa64c43bb91228576ced960aa7cd2` → T2B `2026-10-02-v0.1.18-important-date-reminder-claim.sql` SHA-256 `aea94c2a4f1c9210cd0de962f9588648c0838595be7712a8b7a3b1754d10c316` → integrated Edge. Both exact patches applied once; independent READ-ONLY postflight PASS. No replay, corrective SQL or test fixtures.
- Catalog/ACL verification used existing Keychain → Management database-query API with every postflight SELECT `read_only=true`, `current_user = session_user = supabase_read_only_user`. No SET ROLE. The initial T2A candidate execution attempt returned 42501 because this session lacks EXECUTE: postflight method mismatch, not a confirmed ACL regression. Resumed and subsequent verification used catalog queries without invoking service-only RPCs, proving exact candidate signature/return columns/body/SECURITY DEFINER/search_path, service-role-only EXECUTE and no direct service-role Important Dates table CRUD. Behavior evidence remains the disposable DB/Node tests.
- T2A ledger has nullable `event_id`, UUID `important_date_id`, validated source XOR/Important Date occurrence-required checks, and named UNIQUE NULLS NOT DISTINCT `(event_id,important_date_id,occurrence_date,subscription_id,due_at)`. Reminder-aware create/update overloads coexist with compatible old signatures and expected ACL/marker behavior. T2B claim/check exact signatures/results/bodies match the patch, SECURITY DEFINER with pinned `search_path=pg_catalog, pg_temp`, service-role-only EXECUTE; eligibility helper remains private. Old ordinary/recurring Event claims and old Important Date CRUD/marker catalog remain compatible.
- Before Edge deployment the complete production import graph/source bytes (13 files including config; 12 source/import-map upload assets) matched `92786b200671d4eabe082f92e70071ea121f42ba`; full `deno check --cached-only --no-lock --config supabase/functions/send-reminders/deno.json` over the production graph PASS. One source deployment through Management API returned HTTP 201 / version 3. First independent read confirmed ACTIVE v3 / `verify_jwt=false`, correct entry/import map and unchanged other Functions; final read matched returned bundle SHA-256 `92765c59e6449c78d79047f56c33e0bc3faa5b265df74ccc1f7d03580cc77ec7`. No temporary source change, CLI repair/install, retry or redeploy.
- Post-Edge catalog/history comparison PASS: all public function definitions/ACL fingerprint `0d2772c161b5c267c3947cebcac636e5`; public table catalog fingerprint `24edcbbc19872177cfb63d27515a86bc`. Ordinary Event claim body MD5 `2088474f9e8834c8b2f3b531566c52fb`, recurring claim `9d37cb4bce6c61fa153819b821c1f234`, unchanged signatures/search_path/ACL. Historical ledger remains 12 sent rows (5 ordinary / 7 recurring), all `important_date_id` null; full-row fingerprint `0fb37f5d48300c2a6422acb7df2803e7`, legacy aggregate `9285103ed2b4f055cc7f1dc03c667317`. No claimed/failed/duplicate identities, new FK/policy/Realtime, business fingerprint changes or subscription retirement.
- Existing scheduler remained exactly one active `send-reminders-every-minute` / `* * * * *` job, command MD5 `cd0c5b049c9c1ca9f564c2b1895c00d1`, config and 120000ms timeout unchanged. Passive post-deployment observations at 2026-10-02 01:53 and 01:54 Asia/Shanghai: two natural Cron runs succeeded; both HTTP 200 / completed, no timeout/error/truncation, failed/gone/disable/finalize/unexpected-task counters zero, no runtime cutoff. Each scanned four Event candidates, no due tasks; elapsed 174ms / 383ms. This proves observed runtime/candidate compatibility, not provider delivery or live Important Date claim/check execution. Those races/behaviors remain the passed local T2B/T3 evidence; no Production fixtures or manual Function/claim/check calls were added.
- `V018_SLICE2_BACKEND_READY_FOR_UI`; overall IN PROGRESS, T4/Slice 3 not started, Reminder UI/publication closed. Next is T4 Reminder UI gate / implementation and then user-created-object real Push acceptance. This governance synchronization changed only docs; `git diff --check` and Project State Push Gate are the relevant closeout checks, with no Node/build or Production rerun required. Earlier implementation sections below retain their historical checkpoint limits.

## v0.1.18 Slice 2 T3 — Important Date sender integration — CLOSED / PASS

- Production delta is confined to `send-reminders/logic.ts`, `index.ts` and the existing Important Date RPC adapter. T2A candidate RPC → existing stable scanner → T1 bounded occurrence/canonical due → exact raw-marker classification → current Space recipients/active subscriptions → T2B claim → T2B check → existing Web Push → existing retirement/finalize is wired. Important Dates retain a distinct task shape and `important-date:<id>` hash namespace; ordinary/recurring task payload/claim/tag contracts remain intact. No SQL/UI/scheduler change.
- All three scans use 100-row keyset pages and a required 1001st-row probe at their existing 1000-per-source cap; any overflow aborts all sources before recipient/claim/send work. Strict page order, stable nonempty ID, duplicate/repeated-cursor and incomplete transport results fail explicitly. Recurring exception pagination uses the same stable-page validation and aborts overflow/incompleteness too. Event and exception query `data=null` no longer implies an empty completed page. No new aggregate 1000 cap that would alter the established two-Event-source contract. All delivery sources share the same deterministic chronological 50-task selection, five workers and 95-second cutoff, including the post-tag/pre-claim check; async worker dispatch order can differ from selection order.
- TDD: mixed suite initially 0/12 RED on the baseline's absent branch; candidate wrapper absence and intercepted real entrypoint also failed before wiring. Final `tests/mixed-source-reminders.test.ts` **18/18 PASS**: exact three-source claims, raw marker, namespaced tag collision resistance, current memberships/subscription deduplication/expiry, submillisecond newly-past marker, each source overflow/incomplete/duplicate scans and recurring exception overflow, repeated/concurrent run idempotency, claim rejection/error, claim-to-check failure/error, one 50-task/five-worker budget, cutoff before/after acquired claim, provider outcomes, 404/410 disable success/failure, finalize zero/multiple/throw and no resend, deterministic tie ordering, previous-day New Year/Feb 29/grace/future-anchor wiring and invalid projection abort. Concurrent runs use a shared atomic ledger stub; T2B's actual PostgreSQL duplicate/post-lock mutation tests remain the authoritative DB race evidence. No new SQL test was required because schema/RPC bodies are unchanged.
- `tests/send-reminders-entrypoint.test.ts` **1/1 PASS** with seven intercepted-fetch scenarios: actual Supabase client sends exact candidate/claim/check arguments and raw microsecond marker, check false/error yields failed finalize and no provider call; Important Date/ordinary/recurring/exception incomplete results and duplicate exception pages abort before claims. Configuration is synthetic, fetch rejects every non-fixture host, clock is fixed and restored; no `.env`, network/provider/backend or login is used. Candidate RPC boundary suite **6/6 PASS**, rejecting null/malformed/missing fields/unsupported presets/error/exception results.
- Full `node --test tests/*.test.ts tests/*.test.js` **465/465 PASS**, no skip. `deno check --cached-only --no-lock --config supabase/functions/send-reminders/deno.json supabase/functions/send-reminders/index.ts` **PASS**, checking the complete production import graph without install. Deno checked `mixed-source-reminders`, `important-date-reminders`, `important-date-claim`, `important-date-candidates`, `time-zone` suites **43/43 PASS**. Deno runtime `reminder-due`, `recurring-reminders`, `send-reminders` suites **48/48 PASS** with `--no-check --allow-read`: a broader initial test check encountered pre-existing test-only narrowing/optional-payload/`never.status` typing errors. New task-union assertions were narrowed explicitly; legacy test typing was not broadened into production changes. Both Deno commands use the existing function config plus `--cached-only --no-lock`. `npm run build` and `git diff --check` **PASS**, existing >500 kB warning only.
- Temporary differential check imports exact `5210dc6d…:logic.ts` with only relative imports redirected, and compares **15/15 PASS** complete Event-only diagnostics and sorted side-effect traces: normal/claim reject/claim exception, provider failure/throw/gone, finalize zero/exception, removed membership/disabled or expired subscription/cutoff, recurring override/delete/split. Claim inputs, due instants, tag bytes, payload, retirement and finalize match. Temp files are removed; no baseline copy/framework was added to the repo. Existing ordinary/recurring due/timezone/override/delete/split and schema regressions pass the full suite.
- Five-axis complexity/security/diff review **PASS**. One explicit Important Date branch and closed task union reuse the existing recipient/filter/task/worker flow; no registration/dispatcher framework, Event disguise, new persistence, scheduler, retry/lease/queue, UI or dependency. T1/due/timezone/recurring/Web Push modules and all SQL/patches are untouched. No Production query/write, provider send, deployment, authenticated/device acceptance or push.
- T3 local **CLOSED / PASS**; no implementation blocker for a separately authorized rollout gate. Required rollout order is reviewed T2A patch → T2B patch → integrated Edge sender → capability/postflight/old Event checks, with explicit Production authorization. The new Edge must not precede its RPCs: missing candidate capability aborts the whole mixed run. Actual target capability and automatic/device acceptance are pending, so **Slice 2 backend NOT READY / Reminder publication CLOSED**, T4 UI not started. A successful pre-send check cannot retract a provider request already in flight.

## v0.1.18 Slice 2 T2B — Important Date claim / pre-send revalidation — CLOSED / PASS

- Exact SQL delta: two required-argument service-role-only SECURITY DEFINER RPCs, `claim_important_date_reminder_delivery(p_important_date_id uuid,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,p_due_at timestamptz,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz)` → UUID/null and `check_important_date_reminder_delivery(p_delivery_id uuid,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz)` → boolean. Pinned `pg_catalog,pg_temp` search_path; PUBLIC/anon/authenticated denied. The shared source-specific `important_date_reminder_is_eligible` predicate is private, including no service-role execution. Important Dates table CRUD remains denied to service_role. No ledger/candidate/legacy claim/CRUD change.
- Lock order: advisory Space hash → Space row → Important Date row; pre-send additionally locks/rereads the actual ledger row and requires still-claimed Important Date identity. Grace/expiry use `clock_timestamp()` only after those waits. Module, current membership, Personal owner/Shared member, recipient-owned active subscription, source existence, nonnull preset, exact raw marker, due ≥ marker and inclusive ten-minute grace all revalidate. Civil occurrence validation covers non-repeat exact year, annual optional start year and Gregorian Feb 29 fallback; it validates one supplied occurrence, without a SQL projection or UTC converter. Canonical due is supplied by the T1 service-role adapter, as for existing Event claims.
- TDD: new Node suite initially failed on missing adapter; `python3 -u supabase/tests/important_date_claim_local.py --red` proved frozen `5d5cfdc…` lacks the claim RPC. Final `python3 -u supabase/tests/important_date_claim_local.py` **PASS** on separate disposable `v018_task2_*` databases in the existing local Docker container. Fresh uses canonical schema alone; upgrade uses exact frozen T2A schema plus `2026-10-02-v0.1.18-important-date-reminder-claim.sql`. Both paths are cleaned up; no main DB/Production connection.
- Both paths: full public pg_dump catalog/ACL equality, full historical ledger JSON unchanged (ordinary/recurring plus Important Date audit), every pre-existing public function definition/ACL unchanged, atomic incompatible-baseline and replay rejection **PASS**. All **16 SQL files / 881 assertions per path PASS**, including **47 new T2B + 834 existing**. New tests cover role/default-ACL resistance, missing/null/infinite/incorrect occurrence, stale microsecond marker/preset, outsider/subscription-owner mismatch, grace/expiry boundaries, Personal/Shared eligibility, claimed shape, duplicates/cosmetic stability and finalized-failed no-reclaim. **144 cases per path** compare SQL occurrence membership against actual `resolveImportantDateOccurrence`, including 1900/2000/2100/2400 leap-century cases and future start years.
- `important_date_claim_concurrency.py`: **32 actual observed lock waits per path PASS**. Both discovery→claim and claim→pre-send reject module disable, leave/remove, source/Space delete, schedule edit, reminder off, subscription disable/delete; cosmetic edits pass without a new identity. Expiry crosses after advisory/Space/source waits in both phases and ledger wait in pre-send; grace expires while waiting in both phases. Concurrent identical claims create exactly one durable row; failed finalization during ledger wait blocks check; a due that becomes current during a lock wait uses the new clock and qualifies. Existing test barrier gained only an optional after-observed-wait callback.
- `tests/important-date-claim.test.ts` **3/3 PASS**: raw six-digit marker/exact RPC arguments, UUID/null claim boundary, pre-send only exact true, false/malformed/error/exception rejection with controlled messages. Test-only injection into unchanged `runSendReminders` confirms provider calls = 0 and existing `failed/unexpected_task_error` finalization for check rejection/exception; no production orchestrator branch was added.
- Focused `node --test tests/important-date-claim.test.ts tests/important-date-reminders.test.ts tests/important-date.test.ts tests/important-date-candidates.test.ts tests/reminder-due.test.ts tests/time-zone.test.ts tests/recurrence.test.ts tests/event-reminder.test.ts tests/recurring-reminders.test.ts tests/send-reminders.test.ts tests/supabase-schema-reminder.test.ts` **128/128 PASS**. Full `node --test tests/*.test.ts tests/*.test.js` **445/445 PASS**, no skip. `deno check --no-config supabase/functions/send-reminders/important-date-claim.ts`, `npm run build`, Python AST syntax and `git diff --check` **PASS**; existing >500 kB bundle warning remains non-blocking.
- Complexity/security/diff review **PASS**: deployed Slice 1 patch byte-identical; ledger/candidate/ordinary/recurring Event behavior and orchestration unchanged. No scheduler, framework, persistent projection, timezone engine, member preference, lease/retry/queue, UI or dependency. Pre-send check is best-effort validation immediately before provider dispatch; mutations after it returns cannot retract an in-flight Push. T3 must wire this guard inside the existing send/finalize try block. No T3 prerequisite blocker, Production query/write/deploy, authenticated/device acceptance or push; T2A/T2B patches remain NOT APPLIED and Reminder publication is closed.

## v0.1.18 Slice 2 T2A — Important Date reminder DB capability — CLOSED / PASS

- Exact delta: ledger `event_id` becomes nullable and UUID `important_date_id` is added. `reminder_deliveries_source_identity_check` requires exactly one source; `reminder_deliveries_important_date_occurrence_check` requires nonnull civil occurrence for Important Dates. Existing `reminder_deliveries_occurrence_identity_key` remains the conflict target, with `UNIQUE NULLS NOT DISTINCT(event_id,important_date_id,occurrence_date,subscription_id,due_at)`. No FK, cascade, policy or Realtime addition; ledger service role remains SELECT/UPDATE-only.
- New RPC `list_important_date_reminder_candidates(p_after_id uuid,p_limit integer)` returns only `id,space_id,name,repeat_kind,month,day,year,reminder_kind,time_zone,reminder_schedule_changed_at`. SECURITY DEFINER with pinned search_path; EXECUTE service_role only; Important Dates table privileges remain denied to service_role. Filters enabled `important_dates` modules and nonnull presets, orders by UUID, uses strict `id > cursor`, rejects null/zero/negative/>100 limits (`22023`), and has no default arguments. Each call is a discovery page, not authoritative delivery eligibility or a scan-overflow decision.
- New authenticated-only overloads: `create_important_date(uuid,text,text,text,integer,integer,bigint,text,text)` and `update_important_date(uuid,text,text,text,integer,integer,bigint,text)` append required `p_reminder_kind text` to the existing named arguments. Explicit null is off; the two all-day presets are the only nonnull choices. They use the existing Space/object locks, validation and server marker trigger. Update retains canonical timezone. Old signatures/bodies remain unchanged: old create always null, old update preserves its existing preset, old delete remains canonical. No implicit capability default or historical enablement.
- Tests were written first; `python3 supabase/tests/important_date_reminder_local.py --red` proved the frozen `ead7a211…` baseline lacks the new ledger source. Updated schema identity assertion also failed before implementation. Final `python3 -u supabase/tests/important_date_reminder_local.py` **PASS**: separate disposable `v018_task2_*` databases in the existing local Docker container, always cleaned up, no main DB/Production connection. Fresh path uses canonical schema alone; upgrade uses exact frozen schema plus the recorded already-deployed ledger ACL correction, then the new T2A patch. The canonical revoke/grant pair now includes that correction, so fresh does not need a supplemental patch.
- Both paths: full public pg_dump schema/ACL equality (excluding owner/comments/random dump restrict tokens), four old ordinary/recurring ledger rows unchanged except the added null column, old claim/CRUD/marker definitions unchanged, atomic drift/replay rejection **PASS**. All **15 SQL files / 834 assertions per path PASS**: **65 new T2A**, **88 Slice 1 foundation** (two new overload ACL rows naturally add two assertions to historical 86), **681 other existing assertions**. Covers source XOR on INSERT/UPDATE, required occurrence, ordinary null-occurrence duplication, cross-source same UUID/date/subscription/due, independent Important Date source/occurrence/subscription/due, microsecond uniqueness, historical audit retention, ACL/default-grant resistance, invalid presets, legacy/new CRUD, current Shared membership, cross-Space/outsider/disabled/no-actor rejection, and exact raw marker after cosmetic edits.
- Actual SQL candidate pages for **1000 and 1001 rows on each path PASS** through the unchanged `scanReminderCandidates`: ten pages of 100 plus a one-row probe; exact 1000 completes and 1001 sets explicit `candidateTruncated`, with no silent truncation. SQL JSON retains `2026-10-01T12:34:56.123456+00:00` unchanged through Node. Production scanner/orchestration is not wired here. `tests/important-date-candidates.test.ts` **5/5 PASS** covers empty/100/1000/1001, oversized/out-of-order/duplicate/repeated-cursor pages and RPC failures, plus raw marker preservation.
- Focused `node --test tests/important-date*.test.ts tests/reminder*.test.ts tests/time-zone.test.ts tests/recurrence.test.ts tests/recurring-reminders.test.ts tests/event-reminder.test.ts tests/supabase-schema-reminder.test.ts` **134/134 PASS**; full `node --test tests/*.test.ts tests/*.test.js` **442/442 PASS**, no skip. Final scanner/schema rerun **11/11 PASS**. `npm run build`, Python AST syntax and `git diff --check` **PASS**; existing >500 kB build warning remains. No changed Edge/JS production module requires a new Deno check.
- Complexity/security/diff review **PASS**, no T2B prerequisite blocker. Existing Event claim definitions and Reminder regressions remain PASS; Slice 1 deployed patch remains byte-identical. No new claim/pre-send check/send wiring/UI, scheduler, framework, preference, hidden Event, timezone engine, persisted projection or dependency. This is local DB capability evidence only; T2B claim/revalidation, T3 integration and complete backend/publication gate remain outstanding. No Production write/query, rollout, authenticated/device acceptance or push.

## v0.1.18 Slice 2 T1 — civil-date due / bounded occurrence adapter — CLOSED / PASS

- New tests: `tests/important-date-reminders.test.ts` **12/12 PASS**; pre-extraction all-day Event output fixtures in `tests/reminder-due.test.ts` passed on the baseline implementation. New suite was confirmed RED before its module existed. Covers null/two presets, missing/invalid timezone, invalid civil overflow, exact grace bounds, future/expired due, local midnight/New Year across skipped-day transitions, independent colliding occurrences, New York spring/fall and Lord Howe half-hour DST, Feb 29 fallback/first anchor, future start's first previous-day reminder, non-repeat, large future years, raw microsecond marker/input preservation and explicit invalid-source errors.
- Focused: `node --test tests/important-date-reminders.test.ts tests/important-date.test.ts tests/reminder-due.test.ts tests/time-zone.test.ts tests/event-reminder.test.ts tests/recurring-reminders.test.ts tests/send-reminders.test.ts tests/recurrence.test.ts tests/supabase-schema-reminder.test.ts` — **120/120 PASS**. Existing Event Feb 29 skip, timed/all-day presets, timezone capture, recurrence override/delete/split and ordinary/recurring send orchestration regressions remain PASS.
- Full `node --test tests/*.test.ts tests/*.test.js` — **437/437 PASS**, no skip. A one-off temporary differential import of `reminder-due.ts` from baseline `3c003ca3a68458ee50565c17a131069100e924c7` compared **1,280/1,280 PASS** results: all seven kinds/null, timed/all-day mismatches, eight zones, year/DST/skipped-day inputs, invalid starts and missing/invalid zones. Only the unchanged timezone import was redirected to its absolute local module. No baseline copy was added to the repo.
- `deno check --no-config supabase/functions/_shared/reminder-due.ts supabase/functions/_shared/important-date.ts supabase/functions/_shared/time-zone.ts supabase/functions/send-reminders/important-dates.ts` — **PASS**. An initial broader command including unchanged orchestration encountered existing Deno npm resolution for `@mmmike/web-push@1.3.0`; no dependency was installed. The scoped T1 command checks all new/changed production code; unchanged orchestration was verified by Node regressions.
- `npm run build` and `git diff --check` — **PASS**. Existing >500 kB bundle warning remains non-blocking. Complexity/diff self-review PASS: same Event due calculation, one small source adapter, canonical annual resolver and timezone reuse; no SQL/ledger/claim/orchestration/UI/dependency or unrelated edit.
- This proves T1 pure projection, not sending or backend readiness. Adapter retains raw source marker and returns due-window candidates; newly-past classification and authoritative module/member/source/subscription checks remain T2/T3. No Production query/write, database test, sender invocation, authenticated/device acceptance, deployment or push. Reminder publication remains closed until the complete Slice 2 backend and UI gates; T2 is next and not started.

## v0.1.18 Slice 1 — final user acceptance / CLOSED PASS

- User confirms authenticated Slice 1 Important Dates CRUD, permissions, date behavior, and module toggle acceptance: **PASS**. User also confirms the public Production alias and real-device annual layout: **PASS**.
- Annual layout user results: 375px **PASS**; at 320px only action buttons wrap, with no overlap, clipping, or horizontal overflow. The 320px button wrap remains out of scope.
- Another Shared member’s edit does not refresh an already open Important Dates page immediately; leaving and re-entering performs a canonical reread. This is expected under Slice 1’s frozen no-Realtime contract. Active-view Realtime refresh remains a deferred enhancement and is not a blocker.
- Slice 1 is **CLOSED / PASS**; v0.1.18 remains **IN PROGRESS**. Next Action: **v0.1.18 Slice 2 — Date-level Push Reminder**. This is user-reported Production/device acceptance; Codex did not operate authenticated UI or make a Production write in this closeout.


## 2026-10-01 - v0.1.18 annual mobile layout acceptance

- User acceptance: **375px PASS**. At **320px**, only the action buttons wrap; there is no overlap, clipping, or horizontal overflow. The user explicitly keeps 320px button wrapping out of scope for this bounded follow-up.
- The weighted annual one-row layout fix is ready for release. No business logic or non-repeat layout change. Next Action: user Production layout recheck after the commit's Vercel Production deployment is confirmed. The public alias still requires manual mapping confirmation to the exact deployment before that recheck.


## v0.1.18 Slice 1 acceptance bounded fix — annual mobile form

- User reported narrow-phone misalignment of “开始年份（可选） / 月 / 日”. The annual date-field grid now places the year across both mobile columns with month/day beneath, restores three equal columns from `sm`, and gives numeric inputs block layout plus `min-w-0`; non-repeat retains its three-column grid. Existing two-column/width-constrained form patterns are reused; only layout classes changed.
- Added an SSR responsive-layout regression for annual and non-repeat rendering: RED before the fix, GREEN after. Focused Important Date suites **50/50**, complete Node suite **424/424**, `npm run build`, and `git diff --check` PASS. Existing >500 kB chunk warning remains; SSR checks layout contracts, not real-device geometry. User mobile/desktop visual recheck of the correction is pending.
- Actual user feedback: another Shared member's edit does not immediately refresh the continuously open Important Dates view; re-entry canonical reread works. This matches frozen Slice 1 no-Realtime semantics (spec §12). Active-view Realtime refresh is a **deferred future enhancement**, with no subscription/polling implementation in this fix.
- Slice 1 acceptance remains **IN PROGRESS / partial feedback**; no claim of full authenticated/device acceptance or exact Production alias mapping. Backend READY evidence remains unchanged. Date rules, CRUD/RLS, Reminder and Home/Calendar are unchanged; no dependencies, Production writes or authenticated UI driven by Codex. User authorized a local commit only; frontend release needs separate authorization.



## v0.1.18 Slice 1 Production backend rollout — BACKEND READY / 2026-10-01

- Explicit authorization covered exactly one reviewed forward patch: `supabase/patches/2026-09-30-v0.1.18-important-dates-foundation.sql`, SHA-256 `f9f61bb50b6cb7222a6ec781fc4c6e687397e0e99a47888de6c0105f17a19de2`. Pre-write clean `main`, HEAD `6a5ec3dbad247a697d456450936d7b8748ae20b4`, origin/main `f4f9c04c312d9018cea5a383b0219e048740ae69`, ahead/behind 1/0; file equals Task 2 and current committed trees.
- Fresh READ-ONLY preflight: linked project `ACTIVE_HEALTHY`, PostgreSQL 17.6, local Task 4 build/current public frontend/linked Production targets match. Required Space/member/module, Lists/Review, audit/membership and lifecycle capabilities present; no Important Dates table/partial functions/module rows. Module CHECK already allows the key; toggle matches exact predecessor body MD5 `eb83d1e2c407868ddfd7c3f371124695`, SECURITY DEFINER and `search_path=pg_catalog, pg_temp`. Four lifecycle RPCs and membership/private deletion helper match canonical; audit helper's only text difference is equivalent `=`/`:=` assignment.
- Apply: existing CLI binary was unusable, so the authorized request used the linked Supabase Management database-query endpoint with the existing CLI keychain credential kept in process memory. Sent the committed patch's exact UTF-8 bytes once with its original `BEGIN/COMMIT`, `read_only=false`; HTTP **201**, one attempt, no retry, split, schema replay, ad-hoc SQL, cleanup, module enablement or historical migration edit. Separate immediate READ-ONLY query confirmed persisted new objects; no additional Production mutation was issued.
- Immediate postflight **PASS**: 14 exact typed/nullability columns, 10 validated constraints (name/Emoji/repeat/month/year/real Gregorian date/Reminder/PK/only Space FK with cascade), 2 indexes, 3 enabled triggers and one member SELECT policy. Authenticated has table SELECT only; no direct runtime INSERT/UPDATE/DELETE/TRUNCATE/column write, anon/service_role have no new-table privileges. Three exact CRUD RPC signatures/results and all four private lock/trigger helpers have matching patch body MD5s, hardened search paths and expected SECURITY DEFINER flags. Only authenticated executes CRUD; runtime roles cannot execute private helpers. Extended owner toggle matches exact patch definition/allowlist, including Important Dates/Review Space locking, with authenticated-only EXECUTE.
- Important Dates rows **0**, module rows **0**; no automatic enablement, Reminder setting/publication, business fixture or new Realtime publication. All postflight/catalog comparison requests returned `transaction_read_only=on`.
- Old-capability regression **PASS**: all 14 pre-existing public tables, 61 pre-existing function signatures and 27 policies have identical catalog snapshots before/after, including column/default/ACL, constraints/indexes/triggers, function bodies/config/ACL and Realtime publication. Legacy catalog SHA-256 before/after: `8aff3304897f15b6ca368ef9a5c1a2705a54e207f3b7eba4e0d8f1971374f791`. Only new Important Dates objects and the intended toggle change are excluded. Existing module constraints, default ACL and runtime role flags are also unchanged. This is structural regression, not a live authenticated CRUD/concurrency test.
- `V018_SLICE1_BACKEND_READY`: Slice 1 backend capability/compatibility gate is ready for the Task 4 frontend release gate; Slice 1 integrated/authenticated acceptance remains pending. Next Action = **Task 4 frontend push/deployment gate**, under separate Git/deployment authorization and AGENTS.md acceptance sequencing. No frontend push/deploy, login UI, authenticated/device acceptance, Node/build rerun or extra SQL write occurred. Only TESTING/DEVLOG/PROJECT_STATE rollout records changed locally; `git diff --check` PASS. Secrets were not printed or persisted; no .env or external project file was edited.


## v0.1.18 Slice 1 Task 4 — bounded entry/navigation integration — PASS

- Baseline clean `main`, HEAD/origin/main `f4f9c04c312d9018cea5a383b0219e048740ae69`, ahead/behind 0/0. Task 4 = `PASS` / `V018_SLICE1_TASK4_PASS`; Slice 1 remains `IN PROGRESS`, integrated acceptance / rollout gate pending.
- Functional Hub now has an independent Important Dates card/error/retry path; missing/false module rows mean disabled, unknown/read failure is not confirmed disabled. Personal and Shared owners toggle only through frozen `set_space_module_enabled`; ordinary members see status and cannot toggle. Toggle tests execute the real hook with injected I/O: exact RPC parameters, canonical reread, double-submit lock, denial, read failure, missing row and stale Space/unmount replies.
- One `important-dates` page identity extends the existing strict parser and user-scoped sessionStorage. Restore validates current eligibility: confirmed no eligible Space returns Hub; transient read failure leaves a retryable module page. No row, filter, draft or Sheet target enters navigation storage; no router was added. Existing Tasks/Review/Lists/navigation/lifecycle tests remain passing.
- App only adds bounded entry, page/restore wiring and one account/scope-bound in-memory display snapshot (rows/filter/Past expansion). Ordinary Hub re-entry displays a safe snapshot and rereads complete canonical Dates using the valid session scope without repeating Space/module discovery. The dedicated reader accepts an optional read hint and checks the user before/after the read; CRUD independently revalidates eligibility exactly as in Task 3. Foreground/reconnect/visibility, midnight, retry and mutation rejection rediscover eligibility. Pending/unknown/mismatched scope blocks actions; confirmed source or Hub scope loss hides affected content; mismatched canonical membership requests current Space/Hub revalidation. Auth epoch/user isolation is retained. No persistent business cache, generic loader or Realtime was added.
- Shared Space two-step permanent-delete text now names 日程、任务、回顾、清单和重要日. Existing lifecycle RPCs, cascade/lock semantics, Important Date CRUD/date rules/RLS and Reminder publication remain unchanged. No Reminder UI, Home/Calendar projection, Task Reminder or sender/claim/ledger work is included.
- Focused command: `node --experimental-strip-types --test tests/important-dates*.test.ts tests/module-availability.test.ts tests/module-reentry-ui.test.ts tests/lists-overview-ui.test.ts tests/navigation*.test.ts tests/task-navigation-regression.test.ts tests/space-management.test.ts tests/space-lifecycle-ui.test.ts tests/space-modules.test.ts` — **84/84 PASS**. New entry contract cases were RED before implementation. Full `node --experimental-strip-types --test tests/*.test.ts tests/*.test.js` — **423/423 PASS**, including **19/19** Push Gate cases. `npm run build` and `git diff --check` — **PASS**; the existing >500 kB chunk warning remains (713.54 kB current bundle). SSR/injected handler tests do not claim authenticated browser/device acceptance.
- Correctness, maintainability, architecture, permissions and performance self-review: no unresolved blocker. App adds wiring only; the narrow optional read hint reuses Task 3 complete pagination, canonical object validation and Task 1 pure-date implementation. No dependencies, SQL/Edge Function/production data or external project files changed; no real secrets/.env were directly read or printed.
- Next gate: verify actual frontend backend target and required Important Dates table/RLS/CRUD/toggle capability/feature compatibility before any user-run real-login or Shared/PWA/device acceptance. The Task 2 forward patch is still only locally tested and has NOT been applied to Production. Prepare the reviewed backward-compatible backend rollout and integrated acceptance plan under separate authorization; user drives authenticated sessions. Slice 2 reminder publication and Slice 3 projections are separate work. This Task 4 checkpoint has no push, deployment, Production write or authenticated/manual acceptance.

## v0.1.18 Slice 1 Task 3 — Important Dates module core — LOCAL PASS / 2026-10-01

- Baseline: clean `main`, HEAD/origin/main `205175d8aed0a722ba68b1afcb8b63c21f5b744d`, 0/0. Task 3 is `PASS` for local implementation/automated verification; Slice 1 remains in progress.
- Focused: `node --test tests/important-date.test.ts tests/important-dates-core.test.ts tests/important-dates-data.test.ts tests/important-dates-ui.test.ts tests/important-dates-flow.test.ts tests/space-request-guard.test.ts tests/lists-data.test.ts tests/task.test.ts` — **53/53 PASS**, including 21 new Task 3 tests. Core/UI/data tests were first RED against the absent implementation.
- Full: `node --test tests/*.test.ts tests/*.test.js` — **410/410 PASS**. `npm run build` and `git diff --check` — **PASS**. Build retains the existing >500 kB chunk warning; the unconnected module is not added to the App bundle entry.
- Data adapter verifies exact Task 2 RPC payloads, pre/post user identity, current member/enabled target, canonical content/object/Space/audit/timezone identity, Shared non-creator mutation authority, invalid timezone rejection, RPC rejection without replay, and hard-delete void response plus canonical absence. Reads use existing `completeRows`, exact counts and stable ID ordering: 1,001 records span three pages; null/unknown/drifting counts, empty pages, duplicate/wrong-Space/invalid-date rows fail explicitly. Disabled sources are excluded.
- Render and injected hook/handler tests verify explicit Personal/specific-Space defaults, missing/disabled/removed target refusal without fallback, target retention across background changes, deliberate target change, edit Space immutability, date validation and duplicate-save lock. Real page handlers invoke canonical update and reread; opening delete does not invoke RPC and only explicit confirmation proceeds. Rows show Space context and use the single Task 1 helper for Day 1, anniversaries, annual/no-year, non-repeat Past, February 29 and future anchors. Past defaults collapsed. Sheet/content render no Reminder UI.
- Request-guard tests exercise the actual hook with injected I/O: newer refresh wins, invalidation/unmount/auth change rejects late replies, transient errors retain known rows and disable actions, confirmed eligibility loss removes affected rows before a subsequent read failure, and confirmed empty eligibility alone invokes the return callback. Focus/reconnect/visibility/civil-midnight rereads and listener cleanup are covered. `eligibilityRevision` provides the future local-module-change reread seam without App integration.
- Quality/security review: module-specific helper/adapter/hook/page/Sheet, no generic store/loader/cache, no copied date arithmetic, no direct business-table writes or creator ownership gate. UI retains existing tokens/mobile widths, labelled controls, focus containment/Escape/return and scrollable Sheet. Source fetch uses O(N) memory; derived grouping/sort uses O(N log N); page size stays 500 with no source cap.
- Limits: these are local Node/SSR/injected-handler checks, not real browser/device/authenticated/backend acceptance. No SQL rerun was needed because Task 2 schema/RPC files are unchanged. ModuleHub/navigation/App entry, Home/Calendar projections, Realtime, Reminder UI/sender/claim/ledger and Task Reminder are absent from this task. Production backend remains unrolled out; verify environment compatibility before any future user-run acceptance. Next is Slice 1 Task 4 (entry/navigation integration and remaining Slice 1 boundary work under its own authorized scope). No dependencies, external project files, secrets, push, deploy or Production write were changed.


## v0.1.18 Slice 1 Task 2 — Canonical database foundation — LOCAL PASS / 2026-10-01

- Run `python3 supabase/tests/important_dates_local.py` with the existing local `supabase_db_cross-platform-shared-calendar` container. The runner creates two uniquely named `v018_task2_*` disposable databases from `template0`, uses synthetic Auth/users only, and drops only those databases in `finally`. It accepts no database URL or Production credentials. Existing concurrency scripts are imported with their `PSQL` target overridden to the disposable database before execution; the local main business database is not a fixture target.
- Upgrade starts from committed `012d151` bootstrap plus the already-recorded `2026-09-21-v0.1.8.2-reminder-delivery-acl-correction.sql`; fresh bootstrap also includes that existing correction. This is explicit fixture preparation: the old bootstrap alone retains broad service-role ledger grants under the simulated permissive default ACL. No historical patch or Reminder implementation was changed. Both paths include broad default table/function privileges so the new foundation's explicit revokes are tested.
- Full public schema/ACL `pg_dump` equality **PASS** between fresh bootstrap and baseline plus the single new forward patch. Preflight SECURITY DEFINER drift and replay are rejected atomically. Fourteen legacy business/module/ledger table fingerprints remain identical across the upgrade, including populated Event, Task, Review, List and sent ledger fixtures; Important Dates module rows remain zero until explicitly enabled by tests.
- New pgTAP: **86/86 per path**. Covers exact canonical columns, only Space FK, date/name/Emoji/timezone constraints, immutable identity, schedule marker and server audit, SELECT-only member RLS, RPC/private-helper ACL, denied direct INSERT/UPDATE/DELETE/TRUNCATE, Personal isolation, Shared non-creator CRUD, invalid target rejection, disabled retention/all-CRUD rejection/reopen, leave/remove/rejoin/transfer, and FK deletion while disabled. Create fixes `reminder_kind=null`; edit cannot change Space, audit, timezone or Reminder setting. Service role has no Important Dates read/write/EXECUTE grant in Task 2.
- SQL/shared pure-date validation parity: **1,596/1,596 per path**, covering annual/none, nullable/negative/small/future/century/large years and the shared safe-ordinal upper boundary, invalid month/day and leap/overflow rejection. No second occurrence engine was added; the persisted canonical fields remain the input to Task 1's helper.
- Important Dates concurrency: **19/19 per path**. A second connection's actual `pg_stat_activity` advisory/transaction-ID wait is observed before committing the holder. Disable/leave/remove/Space-delete first reject each waiting create/edit/delete; deleted object identity is reread; mutation-before-disable retains data; transfer revalidates owner toggle and preserves ordinary member CRUD; parent-row-only membership removal and Auth cascade are revalidated after waiting. No deadlock or stale write passed.
- All **13 existing SQL files / 681 assertions per path PASS**, including Tasks, multispace, Review/date chronology, Lists, lifecycle, Event recurrence, Push and ordinary/recurring Reminder. Existing concurrency also **PASS per path**: Review 4/4, Lists 17/17, lifecycle 9/9. Three old SQL assertions now use the remaining unsupported `memo` key / expanded toggle message; their other behavior is unchanged.
- Full `node --test tests/*.test.ts tests/*.test.js` **389/389 PASS** (including focused Important Date/date/Event regressions); `npm run build`, Python source syntax check, and `git diff --check` **PASS**. Existing >500 kB build warning remains non-blocking. Self-review found no unresolved permissions, lock-order or upgrade blocker.
- These are local foundation results, not Production capability or authenticated acceptance. No UI/navigation/Home/Calendar/Realtime, candidate discovery/sender/claim/ledger extension/Task Reminder, dependency installation, Production connection/write, deployment or push. Task 3 is next; backend rollout/postflight and user-run authenticated acceptance still require their own authorization/readiness gate. Reminder publication remains closed through the complete Slice 2 gate.

## v0.1.18 Slice 1 Task 1 — Pure-date contract — PASS / 2026-09-30

- Shared implementation: `supabase/functions/_shared/important-date.ts`; tests: `tests/important-date.test.ts`. Four pure APIs validate fields, resolve one target-year occurrence, find next including today, and derive typed display states. No UI copy, system-clock input, local-midnight duration arithmetic, Event engine mutation, or third-party date dependency.
- Important Date **15/15 PASS**. Covers real-date rejection, optional annual start/full non-repeat date, `2028-02-29` first occurrence and `2029-02-28` first anniversary, no occurrence before the `2030-09-30` anchor, Day 1/positive anniversary secondary target, true calendar anniversaries, yearless countdown/today, Past elapsed versus inclusive count, cross-year/leap/century/small-year/overflow cases, and input immutability. Separate processes under UTC, America/New_York and Pacific/Auckland prove identical civil results across DST boundaries.
- Focused command: `node --test tests/important-date.test.ts tests/recurrence.test.ts tests/time-zone.test.ts tests/reminder-due.test.ts tests/recurring-reminders.test.ts tests/event-reminder.test.ts` — **75/75 PASS**, including the 15 Important Date tests. Existing Event yearly February 29 still skips non-leap years.
- Full `node --test tests/*.test.ts tests/*.test.js` — **389/389 PASS**; `npm run build`, `deno check supabase/functions/_shared/important-date.ts`, and `git diff --check` — **PASS**. Build retains the existing >500 kB chunk warning. The shared file is explicitly included in app TypeScript checks; it has no runtime imports and needs no browser/Edge wrapper.
- Task 1 verification is pure-date/compatibility evidence only. No schema/RLS/RPC/SQL test execution, module UI/navigation, sender/ledger/claim, Home/Calendar projection, dependencies, Production write, deployment, push or authenticated/device acceptance. Slice 1 remains in progress; Task 2 canonical database foundation is next.

## v0.1.18 重要日 — Design Freeze checks / historical NOT STARTED checkpoint

Canonical contract and acceptance boundaries: [v0.1.18 Specification](./v0.1.18_IMPORTANT_DATES_SPEC.md). This round is docs-only: governance/spec consistency and `git diff --check` are the required checks; no business code, schema, migration, Edge Function or dependency changes, and no new build/SQL/authenticated/Production/Push acceptance are claimed. The prior read-only audit's 113/113 existing Node tests are reuse evidence only, not v0.1.18 feature tests. All three implementation Slices and feature acceptance remain `NOT STARTED`.

Freeze verification: diff-check, governance/spec consistency and six-doc-only scope review `PASS`; Current version/Next Action/Blockers/Version Index/Deployment agree, existing version history is preserved, and local documentation links resolve. This is documentation verification, not feature acceptance.

Future verification checkpoints:

| Slice | Required coverage before claiming implementation/acceptance |
| --- | --- |
| 1 — core | Day 1, real anniversaries, annual without year, valid date/Past cases, Feb 29 fallback, future-year first occurrence and absence before start; explicit target/no fallback; Personal/Shared and nonmember RLS/ACL; immutable identity; disabled retention/rejection/reopen; leave/remove/transfer/cascade; navigation and confirmed deletion; accurate bounded Space deletion copy; no exposed nonfunctional Reminder UI |
| 2 — Push | exact all-day presets/default, preserved IANA timezone/DST, first legal occurrence (including previous-day preset), bounded discovery/grace/year boundary, raw schedule marker precision, current recipients, claim and pre-send member/module/source/subscription rejection, deleted/edited/disabled source, concurrent claims, source-aware ledger uniqueness and historical upgrade, old ordinary/recurring Event regression, shared run budget and existing scheduler/send/finalize |
| 3 — projections | same date helper across list/Home/Calendar/Reminder; top three ranked by next occurrence; eligibility/filter independence; historical non-repeat and annual start boundary; Today/Week/42-cell month range; Emoji/default icon and own edit path; independent errors/completeness/stale guards; unchanged Event behavior |

Use disposable DB bootstrap/ordered-upgrade, pgTAP and concurrency tests for SQL/ledger/ACL behavior. For code implementation run relevant focused Node tests, `node --test tests/*.test.ts tests/*.test.js`, `npm run build`, and diff-check; do not install dependencies or apply Production changes through a test command. Slice 2 Reminder publication requires all candidate/due/ledger/claim/revalidation/subscription/send/idempotency/Event-regression checks and the actual backend capability gate, not just field persistence.

Before user-run real-login/shared/iPhone/Android/PWA/manual Push acceptance, Codex must verify actual frontend target and backend schema/RPC/Edge Function compatibility under AGENTS.md. Backend rollout/postflight, Git release and deployment require separate authorization. The user drives authenticated sessions/devices; no v0.1.18 end-to-end acceptance has happened. Local acceptance address remains `http://127.0.0.1:5175`.

## v0.1.17 Final Acceptance — CLOSED / PASS

- Implementation / automated verification: focused Lists Node **20/20 PASS**; full Node **374/374 PASS**; `npm run build` and `git diff --check` **PASS**. The build's existing >500 kB chunk warning remains non-blocking.
- Local authenticated acceptance: **PASS**. The user confirmed Lists 全部空间 → `+` preselects Personal; Personal filter preselects that Personal Space; Shared filter preselects that Shared Space. The user changed the Space in the form and confirmed the saved List belongs to the form-selected target.
- Production/PWA acceptance: user-reported **PASS** on the deployed Vercel build for the all-Space, Personal, and Shared default selections. Android-specific acceptance was not reported. No backend change or Production write was required for this frontend-only correction.

## v0.1.17 Local Authenticated Acceptance — PASS / PRODUCTION-PWA PENDING (initial checkpoint)

- User-reported `LOCAL_AUTHENTICATED_ACCEPTANCE = PASS`: Lists 全部空间 `+` preselected Personal; specific Personal `+` preselected that Personal Space; specific Shared `+` preselected that Shared Space. After changing the Space inside the create form and saving, the new List belonged to the form-selected Space, not the outer filter. These are user-run real-account checks; Codex did not operate the authenticated session.
- The local implementation and automated results are recorded below. v0.1.17 has not passed Production/PWA acceptance and is not `CLOSED / PASS`. No backend change or Production write was needed.

## v0.1.17 Space-aware Lists Create Default — LOCAL AUTO / MANUAL AUTHENTICATED ACCEPTANCE PENDING (initial checkpoint)

- Focused Lists Node **20/20 PASS**; full `node --test tests/*.test.ts tests/*.test.js` **374/374 PASS**; `npm run build` and `git diff --check` **PASS**. The build retains the existing >500 kB chunk warning. Tests cover 全部空间/Personal/eligible Shared defaults, disabled Personal and sole eligible Shared without automatic fallback, invalid specific filter requiring re-selection, a newly ineligible Shared target shown as blocked, visible and changeable Sheet target, target stability after opening, and canonical insert payload. Existing Tasks, Review, Calendar aggregate no-create, and Lists ownership/eligibility tests remain passing regression gates. SSR and source-contract tests do not replace authenticated browser acceptance.
- The previously passing read-only frontend/backend alignment gate remains applicable: the frontend Supabase target code/config, Lists schema/RLS/RPC contract, and backend capabilities are unchanged in this frontend-only correction; v0.1.15 Lists Production backend postflight and v0.1.16 alignment are recorded below. The fixed-port local Vite server responds HTTP 200 at `http://127.0.0.1:5175` without login. The user checks that address in their authenticated browser: Lists 全部空间 → `+` shows Personal; specific Personal → `+` shows Personal; specific Shared → `+` shows that Shared; change the Sheet target explicitly and confirm the new List belongs to the chosen Space. Codex does not operate this logged-in session. Manual acceptance is pending; no Production deployment or write is implied.

## v0.1.16 Final acceptance — CLOSED / PASS

- Implementation and automated verification: full Node **371/371 PASS**, `npm run build` **PASS**. Local authenticated desktop acceptance **PASS** after the initial Tasks re-entry failure and three-module retention correction.
- User reports Production installed-PWA acceptance **PASS** on deployed commit `543fa4956dbb58cdc1671b91bafb5b46da98adc0`: after first validated load, Hub → Tasks/Review/Lists each restores content immediately; the repeated full-loading re-entry problem did not recur. Android-specific acceptance was not reported. Earlier pending checkpoints below remain historical.
- First-entry business-data loading was intentionally outside scope; no partial publication, prefetch, persistent business-data cache, Hub business-data preload, or timing/benchmark framework. This is non-blocking unless real use shows material latency.

## v0.1.16 Local Authenticated Acceptance — PASS / PRODUCTION RECHECK PENDING

- User reports `LOCAL_AUTHENTICATED_ACCEPTANCE = PASS`: after first validated loading, Tasks Hub re-entry is fast without the former full-loading cycle; Review immediately restores validated history; Lists immediately restores its validated overview and has no second full-page loading flash during background/SUBSCRIBED refresh. The first Tasks attempt had FAILED before the read-only RCA and bounded three-module correction; that history remains recorded below.
- This is local authenticated desktop acceptance. Production/Vercel mobile/PWA recheck is pending; v0.1.16 is not `CLOSED / PASS`. First-entry latency was deliberately not redesigned and is not a blocker absent a demonstrated correctness defect. No partial publication, prefetch, business-data cache, Hub business-data loading, or timing framework was added.

## v0.1.16 Re-entry Retention Correction — LOCAL AUTO PASS / MANUAL RECHECK PENDING

- First authenticated Tasks Hub re-entry **FAILED** because unmount discarded validated business rows. The accepted RCA and `V016_REENTRY_RETENTION_DESIGN_FROZEN` now cover Tasks, Review, and Lists with user- and scope-bound display snapshots; v0.1.16 stays `IN PROGRESS`.
- Focused SSR React remount tests exercise Hub → each module → Hub → module and show validated Tasks rows, Review history, and Lists overview on the second mount without loading copy. Scope tests reject unsafe hints, changed module eligibility, and membership loss. Existing loader, stale-guard, completeness, rounds → entries, exact-count, permission, and Realtime helper coverage remains passing. Full Node **371/371 PASS** and `npm run build` PASS. These SSR tests do not execute browser effects; authenticated re-entry, SUBSCRIBED convergence, subscription teardown, account switch, and token-refresh behavior require user manual confirmation.
- The earlier read-only frontend/backend alignment gate remains applicable: this correction changed no frontend target, SQL, backend capability, RPC, or Realtime publication. No new Production action was taken.
- Manual checkpoint at `http://127.0.0.1:5175`: first entry may load; on each repeated 功能中心 → Tasks/Review/Lists entry, the last validated view should appear immediately while canonical refresh runs. Verify Tasks/Lists subscriptions stop when leaving and resume only when visible, Lists initial SUBSCRIBED keeps restored rows, module disable/membership loss clears affected content, account switch/sign-out cannot show prior-user rows, and routine same-user token refresh keeps safe views. User acceptance is pending; no CLOSED/PASS claim.

## v0.1.16 Module Entry Responsiveness — LOCAL AUTO PASS / MANUAL PENDING

- Focused Node **33/33 PASS** plus TaskSheet eligibility-gate coverage; full `node --test tests/*.test.ts tests/*.test.js` **365/365 PASS**; `npm run build` and `git diff --check` **PASS**. The existing >500 kB bundle warning remains. Warm-entry mocks show zero duplicate current-Space/module discovery for Tasks and Lists while canonical business and needed member reads still run; Review warm entry renders its selected Space immediately. Tests cover parallel eligible-Space reads, per-Space pagination, exact counts/consistency, rounds → entries order, stale guards, and row-preserving background paths. The Lists SUBSCRIBED/loading assertion is a source contract; authenticated browser behavior still needs user acceptance.
- Read-only alignment gate: local frontend target equals the linked Supabase project. Linked catalog reports required Tasks/Review/Lists and Space/module tables, RLS, `create_review_round`/`delete_list`, and Tasks/Lists/List Items Realtime publication present. This version adds no backend capability or first-run persistent-state change. No credentials were printed and no Production write or authenticated session was used.
- User manual checkpoint on `http://127.0.0.1:5175`: repeat 功能中心 → Tasks/Review/Lists navigation and inspect that warm entry has no duplicate Space/module discovery or avoidable second full loading; verify Lists initial SUBSCRIBED, routine focus/reconnect and Realtime rereads keep confirmed content; toggle modules / change membership and confirm lost content/actions disappear; verify rejected mutation is not replayed; sign out/switch accounts and confirm no prior-user rows; confirm same-user token refresh preserves session content; perform two-account Realtime and device/PWA responsiveness checks as applicable. Manual results are pending, so v0.1.16 is not CLOSED/PASS.

## v0.1.15 Shared Lists final acceptance — CLOSED / PASS

- User-reported desktop authenticated, dual-account Realtime collaboration and mobile/PWA acceptance **PASS**. Slice 4 Item drag on device and long-list auto-scroll **PASS**; Slices 1–4 and v0.1.15 are **CLOSED / PASS**. Prior full Node **356/356 PASS** and build **PASS** remain valid; this docs-only closeout uses `git diff --check`.
- `STALE_REORDER = AUTOMATED PASS / MANUAL NOT REQUIRED` from Slice 1 backend stale-set/concurrency and Slice 4 rejection → canonical reread → no replay tests. Section drag is **DEFERRED / NON-BLOCKING**; the existing >500 kB bundle warning is non-blocking. No authenticated session or Production operation was performed by Codex for this closeout.

## v0.1.15 Shared Lists Slice 4 desktop authenticated acceptance — PASS / MOBILE PENDING

- User-run desktop authenticated results: ungrouped, same-Section and completed Item drag **PASS**; reopen canonical position **PASS**; drag handle and ordinary scrolling **PASS**; keyboard sorting/cancel **PASS**; dual-account Realtime reorder convergence **PASS**. No repeat of these accepted checks is required.
- `STALE_REORDER = AUTOMATED PASS / MANUAL NOT REQUIRED`: Slice 1 backend stale-set/concurrency validation and Slice 4 tests cover rejection, canonical reread and no automatic replay. It was not manually forced. Local evidence remains full Node **356/356 PASS**, `npm run build` **PASS**, `git diff --check` **PASS**. Section drag is **DEFERRED**; Slice 4 mobile/PWA drag acceptance remains **PENDING** after deployment. v0.1.15 remains `IN PROGRESS`.

## v0.1.15 Shared Lists Slice 4 Item ordering — LOCAL AUTO PASS / AUTHENTICATED ACCEPTANCE PENDING

- Focused `node --test tests/lists-detail-ui.test.ts tests/lists-detail.test.ts tests/lists-detail-data.test.ts tests/lists-reorder.test.ts`: **17/17 PASS**. Full `node --test tests/*.test.ts tests/*.test.js`: **356/356 PASS**. `npm run build` and `git diff --check`: **PASS**. The existing >500 kB JS warning remains; main JS is 675.50 kB / 195.39 kB gzip versus pre-install 573.86 kB / 162.16 kB gzip.
- Automated coverage includes four exact group payloads, crossed-region/list/Space rejection, unchanged hidden canonical slots, confirmed-only display projection, later canonical convergence, stale failure without local success or automatic replay, drag-ready render deferral, closed/open completed fold rendering, handle separation, Section collapse preservation, and no Section drag control. Browser touch/auto-scroll and authenticated two-account behavior are not proven by these Node tests.
- Slice 4 requires a fresh frontend/backend acceptance environment alignment gate before user-run desktop/dual-account testing. After authorized deployment, user-run iPhone/Android/PWA acceptance remains pending. Section drag is explicitly **DEFERRED**; Slices 1–3 remain `CLOSED / PASS`, v0.1.15 remains `IN PROGRESS`. Codex did not operate authenticated sessions or Production.

## v0.1.15 Shared Lists Slice 3 final acceptance — CLOSED / PASS

- User-confirmed Vercel Section-delete correction active; “仅删除分组” and “删除分组及其中内容” both responsive on device. Desktop authenticated detail, Shared dual-account Realtime, filtered Item/Section DELETE convergence, drafts/detail restore, prior responsiveness rechecks, and mobile/PWA acceptance all **PASS**. No repeat of accepted desktop or two-account checks is required.
- Final automated evidence: full Node **352/352 PASS** and `npm run build` **PASS**. Slice 3 is `CLOSED / PASS`; Slice 4 remains `NOT STARTED`. This docs-only closeout runs `git diff --check`; no business code or test behavior changed.

## v0.1.15 Slice 3 Section-delete responsiveness — LOCAL PASS / USER RECHECK PENDING

- User-reported mobile/PWA acceptance otherwise **PASS**. Section-delete responsiveness is the sole pending user recheck. Previously accepted desktop authenticated, two-account detail Realtime including Item/Section DELETE, draft/restore, and earlier responsiveness checks remain **PASS**.
- Focused `node --test tests/lists-detail.test.ts tests/lists-detail-ui.test.ts tests/lists-detail-data.test.ts`: **13/13 PASS**. Full `node --test tests/*.test.ts tests/*.test.js`: **352/352 PASS**. `npm run build` and `git diff --check`: **PASS**. The tests cover confirmation-only destructive and preserve updates, ungrouped append order without client `sort_order` edits, dialog closure path, failure, UI state retention, background canonical convergence, and stale-read guarding. Existing >500 kB chunk warning is non-blocking.

## v0.1.15 Shared Lists Slice 3 desktop authenticated acceptance — PASS / MOBILE-PWA PENDING

- User-reported desktop authenticated detail acceptance **PASS** for Personal/Shared flows, draft preservation and detail restoration. Shared dual-account detail Realtime, including Item and Section DELETE, **PASS**. User recheck of quick-add, Section create/rename and related responsiveness correction **PASS**. Do not repeat these accepted desktop checks.
- Local automated evidence: focused affected Node **25/25 PASS**, full Node **349/349 PASS**, `npm run build` and `git diff --check` **PASS**. No SQL/backend/RPC or dependency change. Slice 3 remains open: Vercel deployment verification and user-run mobile/PWA acceptance are **PENDING**; push success alone is not acceptance.

## v0.1.15 Shared Lists Slice 3 responsiveness correction — LOCAL PASS / USER RECHECK PENDING

- The user reported successful desktop Item/Section mutations with multi-second mutation-to-visible latency. Confirmed RPC/UPDATE rows now update local detail before background canonical reread; Item delete removes only its confirmed target. Structural Section deletes continue to await canonical ordering and relocation. Independent Section and Item detail reads run in parallel after List validation.
- Focused affected Node tests **25/25 PASS**, full Node **349/349 PASS**, `npm run build` and `git diff --check` **PASS**. Tests cover confirmation before a deferred reread, later canonical convergence, failure without local success, quick-add draft rules, and Section-delete boundary. The user must recheck actual desktop latency and focus; no Codex authenticated browser or Production operation occurred.

## v0.1.15 Shared Lists Slice 3 — LOCAL AUTO PASS / AUTHENTICATED ACCEPTANCE PENDING

- Focused `node --test tests/lists-detail.test.ts tests/lists-detail-data.test.ts tests/lists-detail-ui.test.ts tests/lists-overview-ui.test.ts tests/navigation-persistence.test.ts`: **23/23 PASS**. Full `node --test tests/*.test.ts tests/*.test.js`: **347/347 PASS**. `npm run build` and `git diff --check`: **PASS**. The existing >500 kB bundle warning remains non-blocking.
- Automated coverage includes canonical region/order derivation, complete Section/Item pagination, exact narrow mutation payloads, zero List row versus eligibility loss versus transient error, user-scoped navigation restore, quick-add draft settlement, ordinary reread preserving drafts/folds/collapse, invalid Section draft recovery, accessible completed fold rendering, and detail Realtime subscription/cleanup source boundaries. The repository has no React DOM interaction framework; input focus and mobile keyboard behavior require user acceptance.
- Slice 3 is **not closed**. Before requesting real-account acceptance, verify the actual local frontend target and deployed Slice 1 schema/RPC/grants/publication compatibility. The user then tests Personal and Shared detail flows and real two-account Item DELETE, both Section DELETE modes, and whole-List DELETE while the partner has detail open. Slice 2's filtered DELETE result does not prove these new detail subscriptions. Codex did not operate authenticated sessions or Production. Mobile/PWA acceptance remains after a separately authorized frontend deployment.

## v0.1.15 Shared Lists Slice 2 — CLOSED / PASS

- Automated: full Node **338/338 PASS** and `npm run build` **PASS** for the accepted Slice 2 frontend. Desktop authenticated acceptance **PASS**: ModuleHub entry; Personal and Shared Lists; independent listFilter; Personal-default ownership and explicit Shared selection; create, rename, two-step delete; module disable/re-enable; navigation refresh; session-scoped availability; and the common Tasks/Review/Lists at-least-one-current-member-Space visibility rule.
- User-run two-account Realtime **PASS**, including filtered DELETE + RLS + canonical reread. User-reported Vercel Production deployment of commit `3b9dfd7` **PASS** and post-deployment mobile/PWA acceptance **PASS**. Slice 1 remains `CLOSED / PASS`, v0.1.15 `IN PROGRESS`, and Slices 3–4 `NOT STARTED`. Earlier pending entries below record their historical checkpoints.

## v0.1.15 Slice 2 final desktop acceptance — PASS / MOBILE-PWA PENDING

- User-reported desktop acceptance now includes immediate ModuleHub return, Tasks hidden when all current member Spaces disable it and restored when one enables it, alongside the previously accepted Personal/Shared Lists, filtering, ownership-safe create, rename, two-step delete, module disable/re-enable, navigation refresh and dual-account Realtime flows. Real two-account filtered DELETE + RLS + canonical reread is `PASS`.
- Full Node **338/338 PASS**, `npm run build` **PASS**, `git diff --check` **PASS**. The existing >500 kB bundle warning is the only build warning. Vercel Production deployment verification and user mobile/PWA acceptance are pending; Slice 2 is not closed. Codex did not operate authenticated browser sessions or the Production backend.

## v0.1.15 Slice 2 ModuleHub three-module visibility — LOCAL PASS / USER RECHECK PENDING

- User recheck confirmed immediate Hub return `PASS` and found Tasks remained visible with Tasks disabled in every current Space. Reused existing authenticated, paginated `loadTaskEligibility` in the session snapshot; Tasks, Review, and Lists now share the same at-least-one-enabled-current-member-Space visibility rule. All three disabled is an explicit empty state. Canonical toggle success patches the known set and revalidates; failed toggles leave it unchanged. Cold loading, background failure retention, retry, and account isolation remain.
- Focused Node **17/17 PASS**, full Node **338/338 PASS**, TypeScript/Vite build and `git diff --check` PASS. User-reported remaining desktop Slice 2 functional acceptance and dual-account filtered Realtime DELETE + RLS/canonical reread remain `PASS`; Tasks visibility awaits recheck. Mobile/PWA remains pending until Vercel deployment. Slice 2 remains open. No backend/SQL, dependency, Production operation, commit, push or deployment.

## v0.1.15 Slice 2 ModuleHub session availability — LOCAL PASS / USER RECHECK PENDING

- `CalendarApp` now owns an in-memory Review/Lists eligibility snapshot for its authenticated user lifetime. Startup reads both canonical eligibility paths once after Spaces bootstrap; ordinary Hub navigation reuses the snapshot. Foreground/online return, successful module toggles, Space lifecycle and eligibility rejection trigger background refresh. The Hub stays visible during refresh; failed reads retain last-known cards and show retry, while a true cold start shows loading. Account changes remount the user-keyed app and discard prior state. Tasks card and ordering are unchanged.
- User-reported desktop authenticated Slice 2 functional acceptance and two-account filtered Realtime DELETE + RLS/canonical reread remain `PASS`. Mobile/PWA acceptance remains pending until Vercel deployment; Slice 2 stays open. Focused Node **18/18 PASS**, full Node **337/337 PASS**, TypeScript/Vite build and `git diff --check` PASS. No backend/SQL, dependencies, Production operation, commit, push or deployment. User recheck of this navigation UX is next.

## v0.1.15 Shared Lists Slice 2 — DESKTOP AUTHENTICATED PASS / HUB UX RECHECK PENDING

- User-reported desktop authenticated flows passed for Personal/Shared Lists, ownership-safe create, filter independence, rename, two-step delete, module disable/re-enable, refresh restoration, and two-account rename and DELETE Realtime. Filtered Realtime DELETE + RLS + canonical reread is now `PASS` based on the user's real two-account test. Codex did not operate the authenticated browser session.
- ModuleHub stagger reproduction failed before the fix: initial render showed Tasks while Review/Lists remained unresolved. Updated UI tests cover initial/partial loading, together-and-ordered final cards, a single focus-refresh result after both reads, confirmed disabled modules, and distinct Review/Lists error-retry states. Focused affected tests **14/14 PASS**, full Node **334/334 PASS**, `npm run build` **PASS**, and `git diff --check` **PASS**. Existing >500 kB bundle warning remains non-blocking.
- The new Hub loading presentation awaits user recheck. Mobile/PWA acceptance is intentionally deferred until after Vercel deployment. Slice 2 is not closed; the frontend is uncommitted and undeployed.

## v0.1.15 Shared Lists Slice 2 — LOCAL AUTOMATED PASS / AUTHENTICATED ACCEPTANCE PENDING

- Focused Lists data, overview and UI tests cover eligibility, absent/disabled module rows, Personal-default ownership with disabled Personal requiring explicit Shared selection, complete pagination/incomplete-result rejection, empty/mixed/completed progress, deterministic grouping, narrow create/rename/delete payloads, two-step destructive copy, Hub visibility/error retry, Realtime burst coalescing/channel cleanup, and eligibility-before-overview reread. Navigation and Space management regressions cover overview restoration, confirmed-loss fallback, transient-read preservation, account-scoped storage, and owner-only Lists controls.
- Full Node suite **333/333 PASS**; `npm run build` passed TypeScript and Vite. The existing >500 kB bundle warning remains non-blocking; `git diff --check` passed. No frontend authenticated session, local real-account acceptance, Production query/mutation, deployment, commit, or push was performed.
- Before requesting user real-login/manual acceptance, run the repository environment-alignment gate for the actual local frontend target and deployed Slice 1 backend contract. The user then validates Personal/Shared switches, Hub visibility, all-Space default, ownership-safe create, shared rename/delete, progress/grouping, Realtime, and mobile/PWA behavior. Filtered Realtime DELETE + RLS with real two-account subscriptions/canonical reread remains `NOT YET PROVEN` for later collaboration acceptance.

## v0.1.15 Shared Lists Slice 1 — CLOSED / PASS

- Production read-only preflight passed on PostgreSQL 17.6 with the intended linked project and the expected predecessor state. The exact SHA-256 `6e16b311a853d6cc227006cdfb9ebcfb46ecf060b9ed28b5118e4df457da4a8b` forward patch was applied once with its `BEGIN/COMMIT`; no retry or repair SQL was run.
- Read-only postflight passed: three empty Lists tables; expected columns, constraints, indexes, six triggers, seven RLS policies, narrow column grants, eight authenticated mutation RPCs and private lock helper; owner-only module toggle accepts Lists without creating a Lists module row; three Lists tables joined `supabase_realtime` with FULL replica identity while Events/Tasks stayed published. All 10/10 existing business-data counts/fingerprints matched preflight; no unrelated catalog change was found. This closes the DB foundation only. Filtered DELETE delivery under RLS with real two-account subscriptions and canonical reread is `NOT YET PROVEN` and remains a later authenticated acceptance checkpoint.

- The frozen contract is [v0.1.15 Shared Lists Specification](./v0.1.15_SHARED_LISTS_SPEC.md). The working local DB received an initial patch iteration and a local function correction after pgTAP found an unqualified constraint name. The **exact final** forward patch was applied once to a disposable prior-schema database. Focused pgTAP passed **135/135** on the working DB and on each of the fresh/upgrade disposable paths; full working-DB regression passed **13 files / 681 assertions**. Existing Review concurrency passed **4/4** and Space lifecycle concurrency passed **9/9**.
- `python3 supabase/tests/shared-lists-concurrency.py` passed **17/17** local dual-session checks: append/reorder/delete serialization, completion and reopen versus stale reorder, completion versus Item/Section deletion, two explicit completion writes, Section-delete versus insert, List-delete versus child creation, contiguous final positions, and no orphan Items or deadlock. Python syntax check passed.
- A fresh canonical schema and prior schema plus the exact forward patch bootstrapped in two disposable local databases. **109** relevant catalog records matched across columns, constraints, indexes, triggers, RLS policies, table and column ACL, RPC definitions, publication, and replica identity; focused pgTAP passed **135/135 on both paths**. The upgrade path preserved a synthetic existing Space/member/Event/Task row fingerprint. Both disposable databases were removed after verification.
- No frontend business code or dependency changed; no frontend build was required for this DB-only Slice. Prior local `git diff --check` passed. Frontend Slices 2–4 and authenticated two-account acceptance, including filtered DELETE delivery under RLS, remain pending. Metadata alone does not prove DELETE delivery; Codex did not operate logged-in user sessions.

## v0.1.14.1 Final Acceptance — CLOSED / PASS

- 用户报告 Production authenticated refresh `PASS`：Calendar、Tasks、已有 Review 历史/相关页面、同一 Space Detail 刷新恢复；深页 logout 后另一账号登录不继承目标。Production 没有 Review 数据，故本轮没有 Review Detail 数据场景的线上重测或 fixture；自动 integration 与本地 authenticated acceptance 覆盖该目标。未验证 browser back/forward、可分享深链、PWA 完全关闭后重启或未保存草稿跨刷新恢复。
- 最终证据链：导航相关 targeted **22/22 PASS**、full Node **320/320 PASS**、Project State gate **19/19 PASS**、`npm run build`、`git diff --check` 与静态范围扫描 PASS；bounded integration review PASS；用户本地 authenticated acceptance PASS；Vercel Production deployment/public smoke PASS；用户 Production authenticated refresh acceptance PASS。此 closeout 仅为文档变更，不重跑完整 Node/build/DB 或真实账号测试。

## v0.1.14.1 Production Public Smoke — PASS / Auth Recheck Pending

- GitHub exact commit `8212cc820c7708e3766e9bf8cc9da84b15a5e5aa`：Vercel `Production / success`。公开 Production 根 HTML **200**、当前 JS **200**、CSS **200**、manifest **200**；未登录页面正常，JS 包含 `sessionStorage`、导航 key 和 Review 重试文案标记，未见缺失 Supabase 配置占位。
- 这只是无认证静态核验。Production authenticated refresh recheck 仍由用户执行；Codex 未使用真实登录会话，也未重新运行此前已通过且本轮未改代码的 full Node/build。

## v0.1.14.1 Local Authenticated Refresh Acceptance — USER-REPORTED PASS

- 用户在本地真实浏览器确认 Calendar、Tasks、Review 相关页面、Space Detail 与其他已测深页刷新恢复，以及 logout → 另一账号登录不恢复前一账号深页，均 `PASS`。Codex 未驱动登录会话或重复人工测试。
- Production authenticated refresh acceptance 仍 `PENDING`。未验证 browser back/forward、可分享深链或 PWA 完全关闭后的恢复。此前 integration review 的 targeted 22/22、full Node 320/320、Project State gate 19/19、build PASS 仍为本次发布代码的自动证据；仅文档记录无需重跑完整测试。

## v0.1.14.1 Navigation Persistence Bounded Integration Review — PASS

- 临时 Auth 读取错误的 Review 详情回退测试先失败后通过；只有明确的 `ReviewUnavailableError` 才退出详情，其他读取错误显示重试且保留 sessionStorage 目标。
- 定向导航/Review/Space/Tasks：`node --test tests/navigation-persistence.test.ts tests/navigation.test.ts tests/task-navigation-regression.test.ts tests/review-detail-ui.test.ts tests/review-history-ui.test.ts tests/space-management.test.ts`，**22/22 PASS**。完整 `node --experimental-strip-types --test tests/*.test.ts tests/*.test.js`，**320/320 PASS**。Project State gate **19/19 PASS**；`npm run build` 与 `git diff --check` PASS。静态扫描未发现 Router/history/hash 导航、导航 localStorage、Review 草稿持久化、SQL 或依赖变更。
- 用户待执行的最小真实浏览器刷新验收：日历、任务、指定 Space 的回顾历史、回顾详情、Space Detail；再检查 logout 后登录不会恢复前一用户的深页。仅保证同一 browser/tab session 的刷新；不覆盖 PWA 完全关闭再启动或 browser history。

## v0.1.14.1 Navigation Persistence — LOCAL PASS / Manual Acceptance Pending

- `node --test tests/navigation-persistence.test.ts tests/navigation.test.ts tests/task-navigation-regression.test.ts tests/review-detail-ui.test.ts tests/review-history-ui.test.ts tests/space-management.test.ts`：**21/21 PASS**。定向测试覆盖 user-scoped sessionStorage、严格解析、异常存储、首页/日历/功能中心/我的、任务/已完成、回顾历史/详情、空间管理/详情、失效目标、Review eligibility 读取失败、dirty 取消与临时 `justCreated` 不持久化。新测试先红后绿。
- `node --experimental-strip-types --test tests/*.test.ts tests/*.test.js`：**319/319 PASS**。`node --test tests/project-state-push-gate.test.js`：**19/19 PASS**。`npm run build`：**PASS**，保留既有 >500 kB chunk warning。`git diff --check`：PASS。仓库无 lint script。
- 后续用户真实浏览器验收：在已登录的同一 tab 分别刷新首页、日历、功能中心、任务/已完成、回顾历史（指定 Space）、回顾详情、我的、空间管理、Space Detail；核对未保存内容不跨刷新保存、正常站内离开详情仍需确认、筛选互不影响。Codex 未操作 OTP、登录会话、iPhone 或 installed PWA。PWA 完全关闭后的页面记忆、browser history 与深链不在本版本承诺内。

## v0.1.14 回顾 Final Production Acceptance + Cleanup — CLOSED / PASS

- 用户执行并明确报告 Production authenticated acceptance **PASS**。覆盖 Review module enablement、ModuleHub 入口、Personal / Shared、双账号读写边界、本人编辑/对方只读、四种 entry 状态、history/create、previous-plan、日期更正、date chronology、same-day duplicate rejection、authoritative count、无用户可见轮次、desktop / 320px responsive behavior 与 unsaved-draft navigation protection。Codex 未操作用户登录 session；数据库 security/concurrency/lifecycle 结论仍来自既有自动测试和 Production postflight。
- Final date-chronology recheck **PASS**。三篇 Personal fixture 分别使用 2026-09-25、2026-09-26、2026-09-27 验证按日期排序、上一份计划和同日拒绝。随后 exact-ID transaction 在锁内重新验证全库 3 rounds / 3 entries、Space/日期/编号/participant metadata，删除集合与 whitelist 完全一致；FK cascade 后 rounds `3 → 0`、entries `3 → 0`，orphans 0、duplicate groups 0、三个 IDs remaining 0。
- Cleanup postflight：Shared 与 Personal Review module rows 仍为 enabled；spaces 4、memberships 5、modules 6、Events 4、Tasks 5、reminder deliveries 12，六组 aggregate fingerprints 前后一致。`UNIQUE(space_id, review_date)`、`UNIQUE(space_id, round_no)`、previous-plan RPC 与 create/correct date-conflict guards 仍存在。无其他 Production write、schema patch、deployment 或 repo change。
- Closeout 为 docs-only；没有重跑 full Node、DB regression、build 或 authenticated test。最终自动证据仍为 Review targeted Node **39/39**、full Node **313/313**、Project State gate **19/19**、build PASS、production dependency audit 0 vulnerabilities，以及此前记录的 DB/concurrency suites。

## v0.1.14 回顾 Frontend Production Deployment — Public Smoke PASS

- Normal `git push origin main` advanced `origin/main` from `f10d140` to `189f055`; the repository pre-push Project State hook passed. GitHub's exact-commit Vercel status for `189f055f350daae3fe118137e23c3bb938a748ea` was `success` with `Deployment has completed`.
- Unauthenticated Production smoke: root HTML **200**, current JS `/assets/index-CaBYwzOG.js` **200**, current CSS `/assets/index-BmUtdkZG.css` **200**, `/manifest.webmanifest` **200** with name `共享日历`. The deployed JS contains `回顾`, `上一份计划` and count-copy markers; the public login page does not show the missing-Supabase-environment error.
- A minimal Production read-only sanity confirmed 0 Review rounds / 0 entries / 2 enabled Review modules. No full Node/build rerun was performed because no code changed after the passing pre-deploy gate. No authenticated browser/PWA/device test, Magic Link/OTP, Review fixture, module mutation, Supabase write or full backend postflight was performed. User-run Production authenticated minimal recheck remains pending.

## v0.1.14 回顾 Frontend Pre-deploy / Push Gate — PASS

- Integrated review covered the seven local commits from `origin/main` through the date-chronology rollout record. A new focused regression proved that a successful date correction refreshes the just-created detail's date-driven previous-plan context; it failed before the bounded fix and passed after it.
- `node --experimental-strip-types --test tests/review-entry.test.ts tests/review-entry-data.test.ts tests/review-history.test.ts tests/review-history-data.test.ts tests/review-history-ui.test.ts tests/review-detail.test.ts tests/review-detail-data.test.ts tests/review-detail-ui.test.ts tests/navigation.test.ts tests/supabase-schema-review-date.test.ts`: **39/39 PASS**.
- `node --experimental-strip-types --test tests/*.test.ts tests/*.test.js`: **313/313 PASS**. `node --test tests/project-state-push-gate.test.js`: **19/19 PASS**. `npm run build`: **PASS** with the known 521.79 kB chunk warning. Production dependency audit: **0 vulnerabilities**. `git diff --check`, sensitive-value scan, old user-visible round-copy scan, Review debug/dev-address/Realtime scan and frontend/Production RPC parity checks: **PASS**. The repository has no lint script.
- Production read-only catalog/data check confirmed `review_rounds` / `review_entries`, RLS and participant policies; `create_review_round(uuid,date)`, `correct_review_date(uuid,date)`, `save_my_review_entry(uuid,text,text,text,text)`, `mark_my_review_filled(uuid)` and `get_my_previous_review_plan(uuid)` match the frontend and retain authenticated-only EXECUTE. Counts remain 0 rounds / 0 entries / 2 enabled Review modules. No Production write, cleanup, authenticated session, push or deployment occurred.
- Responsive review is static/SSR only: Shared desktop two-column, 320px mine/counterpart tabs with both panels mounted, Personal single column, fixed-height internal scrolling and bounded touch controls are covered by source/render tests. Final Production authenticated recheck remains user-run after deployment; refresh-to-home remains deferred.

## v0.1.14 回顾 Date Chronology Production Backend Rollout — PASS

- Pre-apply freshness: local patch SHA-256 `7adf5a8dfa34c0bfca8ab05b7b2467bcfe088d262c50213d6e24fbae939cb82f` matched HEAD; Production had 0 rounds, 0 entries, 0 duplicate groups, no date unique constraint or previous-plan RPC, the original create/correct definitions, and two enabled Review module rows. The preceding exact-ID acceptance-data cleanup removed 4 rounds / 7 entries and preserved all protected core fingerprints.
- Apply: `supabase db query --linked --file supabase/patches/2026-09-26-v0.1.14-review-date-chronology.sql --output json` completed once with exit code 0. The patch's own `BEGIN/COMMIT` remained intact; no SQL error, partial retry, ad-hoc correction, canonical schema replay, cleanup or Production fixture occurred.
- Catalog/security postflight: `review_rounds_space_review_date_key` is `UNIQUE(space_id, review_date)` and the existing `UNIQUE(space_id, round_no)` remains. Production create/correct/get-previous-plan definitions match the committed target semantics; each is `SECURITY DEFINER` with fixed `pg_catalog, pg_temp` search path, and the previous-plan function is `STABLE`. PUBLIC/anon/service-role EXECUTE are absent and authenticated EXECUTE is present. Review RLS remains enabled with the two participant SELECT policies unchanged.
- Data-safety postflight: rounds 0, entries 0, orphan entries 0, duplicate groups 0; both Review modules remain enabled. Spaces 4, memberships 5, all module rows 6, Events 4, Tasks 5 and reminder deliveries 12 retained their pre-apply counts and row fingerprints. No automated suites or frontend build were rerun because the deployed artifact was the already verified exact SQL patch and the repo change is documentation-only.
- Remaining gate: local frontend Slice 2–4, integration and both acceptance fixes are not pushed or deployed. After frontend pre-deploy/push review and Vercel rollout, the user must perform the minimal authenticated date-chronology recheck; this backend rollout does not mark v0.1.14 closed.

## v0.1.14 回顾 Date Chronology Acceptance Fix — Local PASS

- Forward patch: `supabase/patches/2026-09-26-v0.1.14-review-date-chronology.sql`（147 行，SHA-256 `7adf5a8dfa34c0bfca8ab05b7b2467bcfe088d262c50213d6e24fbae939cb82f`）。它在事务内先拒绝 existing duplicate dates，再增加 named unique constraint、替换 create/correct RPC 并新增窄 previous-plan read RPC；没有 delete、truncate、自动改日期或重编号。
- 新增 `supabase/tests/2026-09-26-v0.1.14-review-date-chronology.test.sql`：**41/41 PASS**。覆盖 named date unique constraint、RPC ACL/search_path；Personal/Shared 同日第二篇拒绝且 entries 不增加；跨 Space 同日、同 Space 不同日期；9/26 先建、9/25 后补、9/27 再建的日期关系；占用日期更正原子拒绝与空闲日期成功；日期更正动态关系；Personal/Space 隔离；direct insert 唯一约束；立即上一篇无本人 entry 或空 plan 时不 fallback；leave/rejoin 与非 participant 拒绝。
- `supabase test db --local`：**12 files / 546 pgTAP assertions PASS**。`python3 supabase/tests/review-foundation-concurrency.py`：**4/4 PASS**，覆盖同 Space 同日并发恰好一成一败、无孤立 entries；不同日期均成功且业务顺序按日期；两项既有 module toggle race。`python3 supabase/tests/space-lifecycle-concurrency.py`：**9/9 PASS**。
- Targeted Node（review detail/history UI+data 与 schema/patch contract）：**21/21 PASS**；完整 Node：**312/312 PASS**；`npm run build`：**PASS**，保留既有 >500 kB bundle warning。schema/patch changed-function parity、forward-only/no-cleanup 静态检查 PASS。仓库无 lint script。
- Forward patch 仅应用到本地测试库。Production 未执行 preflight、清理或 patch；由于真实账号验收可能留下同 Space 同日重复测试 rows，Production rollout 前必须只读列出 exact review IDs，由用户确认后另行 exact-ID cleanup，完成 postflight 后才能应用唯一约束 patch。

## v0.1.14 回顾 Authenticated Acceptance Feedback Fix — Local PASS

- 用户已完成本地真实账号广泛验收并反馈两项 bounded UX 调整。本轮自动覆盖历史/详情无可见 `round_no`、日期身份、无障碍名称、0/1/47 authoritative exact count、游标分页不覆盖总数、Space 切换清空旧总数、创建成功进入 canonical 详情，以及「上一份计划」文案。数据读取仍通过 `review_rounds` 既有 participant RLS；无 SQL/RPC 改动。
- `node --experimental-strip-types --test tests/review-history-data.test.ts tests/review-history-ui.test.ts tests/review-detail-ui.test.ts`：**11/11 PASS**。完整 Node suite：**305/305 PASS**。`npm run build`：**PASS**；Vite 保留既有 >500 kB bundle warning。仓库无 lint script。
- 本轮未操作真实登录态、Production 数据或设备；用户只需执行 tiny recheck：历史/详情无「第 N 次」、Space 总数准确、文案为「上一份计划」、新建后回到历史总数更新。刷新浏览器回首页是已记录的未来 UX 事项，不属于本修正验收。

## v0.1.14 回顾 Frontend Integration / Pre-deploy Review — Local PASS

- 基线为 `main` HEAD `b1bb24741e19512720fc0efdc6acc6ec40fa5d0c`，相对 `origin/main` 领先三份 Slice 2–4 提交且检查前工作区干净。审查 Hub、独立 Space 选择、日期/编号游标历史、新建 canonical id、详情、上一轮计划、本人编辑/对方只读、日期更正、返回刷新、过期请求与失权路径。发现并修复底部导航绕过 dirty 确认；回归测试先红后绿。
- `node --experimental-strip-types --test tests/navigation.test.ts tests/review-detail.test.ts tests/review-detail-ui.test.ts`：**7/7 PASS**；全量 Node：**302/302 PASS**；`npm run build` 与 `git diff --check`：**PASS**。构建产物已核对仅指向关联的 Production Supabase 目标；生产依赖官方 npm 安全审计为 **0 漏洞**。Vite 的 >500 kB bundle 警告仍在，未阻断构建。
- Production 只读查询核对 `create_review_round`、`save_my_review_entry`、`mark_my_review_filled`、`correct_review_date` 及 `set_space_module_enabled` 的参数/返回类型/EXECUTE，回顾两表的列、RLS、SELECT 策略和直接写权限，以及授权函数体中的当前成员+当轮 participant 与模块条件；与本地前端所用契约一致。未查询用户回顾正文或执行任何写入。无 authenticated 浏览器/320px/桌面/设备手动验收结论；该部分由用户在本地 5175 前端执行。

## v0.1.14 回顾 Slice 4 — Responsive Detail Local PASS

- `node --test tests/review-detail.test.ts tests/review-detail-data.test.ts tests/review-detail-ui.test.ts tests/review-history-ui.test.ts tests/navigation.test.ts`: **12/12 PASS**。覆盖 participant snapshot 的本人/对方映射、Personal 单列、Shared 移动切换两 panel 持续挂载与桌面双列、只读四字段固定高度/框内滚动、历史打开与刚创建临时导航区别、同 Space 精确 `round_no - 1` 上一轮计划（无轮、无本人 entry、空白均无计划）、日期 RPC 精确参数/服务端结果/拒绝传播、返回 dirty 确认逻辑。
- `node --test tests/*.test.ts tests/*.test.js`: **301/301 PASS**；`npm run build`（TypeScript + Vite）、`git diff --check`: **PASS**。Vite 仍提示 bundle >500 kB，构建成功。仓库无 lint 或 React 交互测试脚本；SSR/静态检查不构成真实浏览器、320px、账号或设备验收。
- 详情重新聚焦刷新 RLS 可见轮次与对方内容，不重载已挂载的本人 editor；若 canonical 读取证明已失去访问条件，则移除正文。本人多端并发没有 backend expected-revision 参数，前端不声称冲突检测。日期更正返回历史后由历史组件重新挂载并读取 canonical 日期排序。上一轮计划只在刚创建的临时导航上下文中显示，失败不阻断当前轮编辑。
- Slice 4 不改 SQL/RLS/RPC/DB tests，Production backend 保持 Slice 1 PASS；Slice 2–4 本地前端未 push、未部署，Production 前端仍为 v0.1.13、没有回顾 UI。真实账号与设备 acceptance 未开始；下一步先做完整前端 integration / pre-deploy review 和 backend compatibility gate。

## v0.1.14 回顾 Slice 3 — History / Create Frontend Local PASS

- `node --test tests/review-history.test.ts tests/review-history-data.test.ts tests/review-history-ui.test.ts tests/navigation.test.ts tests/task-navigation-regression.test.ts`: **12/12 PASS**。覆盖 review module eligibility、缺行/关闭、Shared 单成员历史与双成员创建门槛、独立选择与失效纠偏、participant snapshot 状态、Slice 2 状态 helper、20 轮日期/编号游标分页、去重、精确创建 RPC 参数及服务端返回、错误传播、过期请求 guard、模块 owner/member 控件、Hub/历史初始静态结构和 Tasks 路径回归。
- `node --test tests/*.test.ts tests/*.test.js`: **293/293 PASS**；`npm run build`（TypeScript + Vite）和 `git diff --check`: **PASS**。Vite 报告既有 bundle >500 kB 警告，构建成功；仓库无 lint 或 React 交互测试脚本。
- 本地静态/SSR 验证没有真实登录、浏览器点击链或设备结论。History SELECT 依赖已部署的 participant RLS；列表读取四项正文列仅为复用 canonical「全空」状态判断，不展示正文。分页以 `(review_date DESC, round_no DESC)` 唯一游标加载（Space 内 `round_no` 唯一），并对跨页 ID 去重。后台日期更正等并发重排可通过页面刷新获取 canonical 顺序。
- Slice 3 未改 SQL、RLS、RPC 或 DB tests；Production backend 保持 Slice 1 PASS，Production frontend 仍是 v0.1.13，v0.1.14 用户真实账号/移动/PWA acceptance 未开始。完整详情、上一轮计划、日期更正 UI 属于 Slice 4；其后 authenticated acceptance 前必须执行 frontend/backend compatibility gate。

## v0.1.14 回顾 Slice 2 — Entry Frontend Local PASS

- `node --test tests/review-entry.test.ts tests/review-entry-data.test.ts`: **8/8 PASS**。覆盖 persisted 四状态、空白/常见空白字符、null 与空串的可见草稿比较、编辑后还原的 dirty 清除、已知 backend 拒绝文案、本人 participant 读取、精确 save/mark RPC 参数、服务端 canonical revision/时间返回、backend error、登录变化及异常响应 fail-closed。本机 Supabase 只读 SELECT 还核对了普通空格、制表符、不换行空格和全角空格的 PostgreSQL `[:space:]` 分类。
- `node --test tests/*.test.ts tests/*.test.js`: **284/284 PASS**；`npm run build`（TypeScript + Vite）及 `git diff --check`: **PASS**。仓库无 lint 脚本，也无 React 组件交互测试框架；因此本 Slice 没有组件自动交互或浏览器验收结论。
- 自审确认没有 Review 直接表写入、客户端 revision 推算、自动保存或新 backend primitive；组件未挂到导航。Production backend 仍为 Slice 1 PASS，用户可见 Production 前端仍为 v0.1.13，v0.1.14 真实账号/设备验收未开始。后续正式详情接入前仍须做目标 backend compatibility gate。

## v0.1.14 回顾 Slice 1 — Production Backend Rollout / Postflight PASS

- Exact forward patch: `supabase/patches/2026-09-26-v0.1.14-review-foundation.sql`（306 行，SHA-256 `41cb53b1e7c373e82dcf372261047fe066d5a395851d019456903b6d8d3abf34`）。Pre-apply read-only freshness confirmed absent Review objects, unchanged lifecycle/module definitions, and the previously recorded data baseline. `supabase db query --linked --file` executed the committed file once inside its own `BEGIN/COMMIT` transaction, exit 0 with no SQL error.
- Read-only structure postflight: `review_rounds` / `review_entries` have the canonical columns/defaults; 8 constraints include positive and unique Space round numbering, participant primary key, revision bounds and required cascade FKs. Four indexes, three enabled identity/updated-at triggers, two SELECT policies and RLS on both tables match the patch. `review_entries.user_id` has no FK to cascading membership rows.
- ACL/RPC postflight: both tables have only `authenticated=SELECT` among application roles; anon and service_role have no direct Review table grant, and authenticated has no direct business write or TRUNCATE. The read helper and four write RPCs are `SECURITY DEFINER`, hardened `search_path`, and authenticated-only EXECUTE. Their function-body MD5s, both identity guard bodies, and the owner-only Tasks/Review module toggle body match the committed patch; no role-inheritance bypass was found. Module toggle retains its existing Tasks behavior and authenticated EXECUTE.
- Data comparison (pre-apply → postflight): Spaces **4→4**, memberships **5→5**, module rows **4→4**, Events **4→4**, Tasks **5→5**, reminder ledger rows **12→12**. Full-row MD5s were identical for Spaces `aed85fac9990b7bd21a1e8a7ac9a7083`, members `1ee9d2977ed5b63dddfc0a0431c1f9a5`, modules `3c7ac0cb0158f36f7e29388841f041f5`, Events `0d70932bf90dbf8607cbd9e0fef3be2d`, Tasks `ae266f6c38e6e20578b702adcaf2e7dc`, and reminder ledger `9285103ed2b4f055cc7f1dc03c667317`. Space invite fingerprint also matched. Review rounds, entries and `review` module rows remain **0**; no Production test data was created.
- Four existing lifecycle function fingerprints remained unchanged. Deployed create/read/write definitions retain Space advisory + row lock ordering, `max(round_no)+1` with unique fallback, current membership plus historical participant checks, own-entry mutation, module enablement, same-content revision stability and blank-entry mark rejection. Production mutation RPCs and lifecycle actions were not invoked for testing. The pre-existing `touch_updated_at()` `:=` syntax variant remains unchanged.
- Slice 1 Production backend: **PASS**. v0.1.14 frontend and authenticated/device acceptance: **NOT STARTED**; version overall remains in development. Slice 2 will reuse deployed `save_my_review_entry` and `mark_my_review_filled` rather than recreate backend primitives.

## v0.1.14 回顾 Slice 1 — Backend LOCAL PASS / Production Preflight PASS (pre-rollout checkpoint)

At this pre-rollout checkpoint, the canonical contract was [v0.1.14 回顾规格](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md). The one-time forward patch had been applied only to the local Supabase test database; Production was still at the v0.1.13 backend baseline.

- `supabase test db --local`: **11 files / 505 pgTAP assertions PASS**. The new review file contributes **117 PASS** across schema/FKs/constraints, Personal and Shared eligibility, direct API ACL, RLS isolation, revisions/blank marking, date correction, module disable/re-enable, leave/remove/rejoin, transfer and Space deletion. Existing module and lifecycle regression files also pass.
- `python3 supabase/tests/review-foundation-concurrency.py`: **3/3 PASS** for concurrent create assigning rounds 1/2, disable-first rejecting create, and create-first retaining history before disable. `python3 supabase/tests/space-lifecycle-concurrency.py`: **9/9 PASS**.
- SQL review: the review foundation, module toggle and RPC ACL blocks in `schema.sql` and the forward patch match. The patch creates new objects and narrowly replaces `set_space_module_enabled`; it does not reset, truncate, backfill or delete existing business data. No frontend/build, Production write, or authenticated browser/device test was run for this backend-only slice; the Production read-only preflight is recorded below.

- Production READ-ONLY preflight: **PASS**. Production 的 v0.1.13 schema 与 patch assumptions 兼容；review tables/functions/policies/triggers/index 不存在，`space_modules` 已允许 `review` 且当前 review rows 为 0。4 个 Space、5 条成员关系无 owner/capacity/member anomaly；lifecycle definitions 与 repo canonical 一致。RLS/ACL/RPC boundaries、并发锁前置条件、existing-data safety、schema/patch parity 均通过，blockers 为 `None`。
- Preflight 只读记录：4 Spaces、5 memberships、4 Tasks-module rows、4 Events、5 Tasks、12 reminder ledger rows；Production 未发生写入，数据检查未发现 blocker。回顾 patch 尚未应用，Production backend 仍为 v0.1.13。
- Next checkpoint: 在 Slice 1 implementation 与 preflight 记录推送后，按独立授权应用唯一 forward patch 并执行 read-only Production postflight。前端和 authenticated/device acceptance 尚未开始。

Before any later real-login/two-account/mobile/PWA acceptance, run the frontend-target/backend-capability compatibility gate. The user performs authenticated/device acceptance.

## v0.1.13 Final Regression + Closeout — CLOSED / PASS

- Focused lifecycle/Space Management regressions: **46/46 PASS**. Full Node suite: **276/276 PASS**. `npm run build` and `git diff --check`: **PASS**.
- Read-only Production checks: Vercel deployment `6662531970` for source `c08e9f1bd2d583a65fb42d68588b531ca6e0216c` is `success`; the public entry and current JavaScript/CSS assets returned HTTP 200. Supabase catalog confirmed all four lifecycle RPC signatures and authenticated-only EXECUTE grants with hardened function configuration. No Production mutation occurred.
- **User-reported authenticated real-account, mobile and installed-PWA acceptance: PASS.** Codex did not operate login, OTP/Magic Link, authenticated sessions or PWA and did not repeat the user's acceptance.
- v0.1.13, Slice 1 and Slice 2 are `CLOSED / PASS`. No further real-account acceptance is requested by this closeout.

## v0.1.13 Slice 2 — State review correction

- New automated cases cover leave/delete success clearing selection and detail before a delayed/failed list refresh, persistent selection removal scoped to the current user, remove/transfer retaining detail, RPC rejection retaining selection pending canonical refresh, and Calendar/Task eligibility fallback for an invalid filter target. Focused Node: 46/46 PASS; full Node: 276/276 PASS; `npm run build` (TypeScript + Vite) and `git diff --check`: PASS.
- The lifecycle result path does not write Calendar or Task filters. Existing filter normalization may choose `all` when its target becomes ineligible. Real-account/device acceptance remains user-owned and pending.

## v0.1.13 Slice 2 — Local UI review checkpoint

- Focused Node 8/8 and full Node 271/271 pass. Tests cover Personal/Shared role controls, other-member target validation, four exact RPC names/arguments, canonical pre-submit recheck, stale/error rejection, confirmation and duplicate-submit guards, list/detail refresh, and absence of lifecycle filter mutation. Existing Space Management regression remains in the focused run. `npm run build` (TypeScript + Vite) and `git diff --check` pass.
- At this local review checkpoint, real-account acceptance was pending. Before that later acceptance, the four deployed RPC signatures/grants and backend alignment were checked read-only. The user subsequently reported all real-account, mobile and PWA acceptance passed; see the final closeout above. Codex did not operate any real-account session or PWA.

## v0.1.13 Slice 1 — CLOSED / PASS

- Local database: `supabase test db --local` passed all 10 files / 388 pgTAP tests, including lifecycle, existing Event/Task/recurrence/reminder/RLS regressions. `python3 supabase/tests/space-lifecycle-concurrency.py` passed 9/9 two-session orderings. `node --test tests/*.test.ts tests/*.test.js` passed 266/266; `npm run build` and `git diff --check` passed.
- ACL gate: `has_table_privilege` is false for `TRUNCATE` on `profiles`, `spaces`, `space_members`, `events`, `event_occurrence_exceptions`, and `tasks` for each of `anon`, `authenticated`, `service_role` (18 checks). Actual `TRUNCATE ... CASCADE` attempts as application roles fail with `42501`. Other privileges and unrelated table ACLs are unchanged.
- Slice 1B Production preflight passed: 4 Spaces, 5 members, zero owner/capacity/Event reference anomalies, expected dual membership FKs, four lifecycle RPCs absent, 5 sent historical orphan reminder rows, and aligned trigger/function/RLS/ACL state. Only the reviewed Slice 1A forward patch was applied.
- Production postflight passed: four authenticated-only lifecycle RPCs, restricted deletion helper, valid owner index, five enabled new triggers, 18 denied app-role TRUNCATE privileges, unchanged FK/RLS/policy state, and exact preflight/postflight counts and fingerprints for Space/member/Event/exception/Task/module/subscription/reminder data. All 12 reminder ledger rows, including 5 sent historical orphans, remain unchanged. Reminder scheduler has one active job, with 60 successful and zero failed runs in the previous 60 minutes. No Production test fixtures were created; Slice 2 UI and authenticated browser acceptance remain outside this rollout.
- Acceptance: `v0.1.13 Slice 1 — CLOSED / PASS`. Next Action: Slice 2 Space Detail lifecycle controls, beginning with the frontend/backend compatibility gate.

## v0.1.12 Slice 4 — Final Regression + Production/PWA Acceptance (CLOSED / PASS)

- Final release gate on accepted commit `9847a0761e117234e10e219ec9c8d4bae25a850e`: full applicable Node suite **266/266 PASS**, `npm run build` **PASS**, and `git diff --check` **PASS** with a clean tree. GitHub recorded the commit as the latest successful Vercel Production deployment. The public app shell, JavaScript, CSS, manifest, and service worker returned HTTP 200; the public bundle contained the new navigation and Tasks markers. The frontend target matched the previously verified Supabase host; no backend change or migration was required.
- **Final authenticated Production and installed-PWA acceptance: PASS (user-reported).** This closes Slice 4 and v0.1.12. Codex did not operate a real-login session or the installed PWA. Dedicated iPhone Safari acceptance is not separately claimed. The accepted structure is 首页 / 日历 / 功能中心 / 我的; 功能中心 contains only 任务; Tasks aggregate eligible Spaces with all/single filter, canonical actions and scoped Realtime; 我的 → 空间管理 provides Personal/Shared details. Space remains the canonical ownership boundary.
- Accepted deferred items: unified UI visual refinement, unused `MemberSheet.tsx` cleanup, `space_modules` Realtime, and Calendar all-Space create. They are not v0.1.12 blockers.

## v0.1.12 Slice 3 — One-time Navigation Switch + Aggregate Tasks UI (CLOSED / PASS)

- Automated scope: exactly four primary tabs with 功能中心 replacing 空间; Tasks-only Module Hub; independent eligible-Space taskFilter, invalid-filter normalization, complete all/single-Space Task reads, source `space_id` identity even for duplicate names, Open/Completed filter retention, Personal/single-Space create defaults and disabled-Personal safety, canonical Task actions, per-Space Realtime scope/cleanup, stale-response guard, old Hub retirement, and Home/Calendar/My regressions. Pre-closeout Slice 3 focused Node tests `24/24`, full Node suite `266/266`, form/UI retest `7/7`, post-review create tests `5/5`, `npm run build`, `git diff --check`, and unauthenticated local `5175` HTTP `200` passed. Final closeout rerun: focused tests `19/19`, full Node suite `266/266`, `npm run build`, and `git diff --check` all PASS. Static 320px/390px previews covered the four tabs, Hub, Task rows/filter, and Sheet; Production device behavior remains for Slice 4 acceptance.
- Read-only readiness gate: the local frontend target matches the linked Supabase project. The linked backend has Task and module tables, member SELECT, Task member CRUD guarded by Tasks enablement, the status-owner trigger, and Task Realtime publication with replica identity FULL. No schema, RPC, Edge Function, or backend deployment change is required. Codex did not operate a real-login session.
- **User-run local authenticated acceptance: PASS (user-reported).** The user verified the implemented Slice 3 functionality and reported it working. This closes Slice 3 functional acceptance; Codex did not operate the authenticated session. The accepted scope is 首页 / 日历 / 功能中心 / 我的; Tasks-only Hub; aggregate Personal/Shared Tasks, source labels, all/single eligible-Space filter shared by Open/Completed, safe create targets and canonical mutations, and preservation of Home, Calendar and My → Space Management.
- Slice 4 is `NEXT` for final regression, environment/deployment readiness, and Production/iPhone/PWA acceptance. No Slice 3 Production or device acceptance is claimed by the local PASS.

## v0.1.12 Slice 2 — My → Space Management → Space Detail (CLOSED / PASS)

- Automated scope: My entry and existing profile/notification/logout structure; Personal/Shared list and duplicate-name distinction; Personal/Shared detail boundaries, roles, invite controls and owner/member Tasks switch; management and legacy create/join reuse; selected Space separation from Calendar/Task filters; old four-tab and Hub regressions. Existing `space-selection`, `space-modules`, navigation, Task, Home and Calendar tests remain applicable. The v0.1.10 SQL test retains the disable → Task rows preserved → re-enable and owner/member authorization assertions.
- Local results: focused Node regressions **61/61 PASS**; full Node suite **261/261 PASS**; `npm run build` and `git diff --check` **PASS**. The existing Vite server serves this repository on fixed port `5175`; an unauthenticated `http://127.0.0.1:5175/` check returned **HTTP 200**. These are automated/static checks, not authenticated browser acceptance.
- Read-only backend gate: local frontend target matches linked Supabase. Linked catalog confirms `spaces`, `space_members`, `space_modules`, `tasks`, `ensure_personal_space()`, `create_space_with_invite(text)`, `join_space_by_invite_code(text)`, `rotate_invite_code(uuid)` and `set_space_module_enabled(uuid,text,boolean)` exist. Linked `space_members`/`space_modules` RLS, module SELECT and RPC EXECUTE grants, owner-only toggle guard, and Personal invite-code guard also passed. No backend change is required. No login, OTP, authenticated browser session or Production write was performed by Codex.
- **User-run authenticated acceptance: PASS (user-reported).** The accepted functional scope covers 我的 → 空间管理; Personal and Shared Space lists and details; member/role display; invitation-code behavior; Tasks module toggle; create/join reuse; `selectedSpaceId` limited to management/detail responsibility; and keeping the old Space Hub temporarily for the Slice 3 transition. No authenticated session was operated by Codex.
- UI visual refinement is intentionally deferred to a later unified UI/design pass and is not a Slice 2 blocker. Slice 2 is `CLOSED / PASS`; v0.1.12 remains `IN PROGRESS` with Slice 3 next.

## v0.1.11 Slice 4 — Home Quick Create / Global Create Safety (CLOSED / PASS)

- Automated verification: focused Slice 4 tests **10/10 PASS**; full applicable Node suite **246/246 PASS**; `npm run build` and `git diff --check` **PASS**. Previous unauthenticated local HTTP check on `http://127.0.0.1:5175/` returned **200**.
- 只读环境 gate：本地前端配置目标与 linked Supabase 项目一致；linked backend 中 `spaces`、`space_members`、`events`、`tasks`、`space_modules`、Personal 初始化及模块检查 RPC 存在。Event/Task/module RLS 开启，Event/Task insert policy、Event owner trigger、Task assignee 外键及模块 SELECT 权限已核实。现有 v0.1.10 后端能力与这次纯前端新增入口兼容；没有后端 rollout。检查只返回能力布尔值，没有输出环境变量、凭据或业务行。
- **用户报告真实账号 Desktop 本地验收 PASS：**首页标题无旧创建按钮；“近期日程 +”和“需要处理的任务 +”分别直达对应表单；日程与任务默认目标均为 Personal Space，并能主动切换 Space。日程、任务分别切换到 Shared Space 后，二次确认的目标、首页即时摘要、目标 Space 内对象和实际归属均正确。关闭 Personal Tasks 后没有自动转存 Shared，须主动选已启用任务模块的 Space。取消二次确认后草稿保留且没有记录；确认阶段关闭后重开没有残留确认状态；快速连续确认只产生一条记录。日历单 Space 日程 `+` 仍按当前筛选 Space 直接保存；空间任务“新建任务”仍在当前 Space 直接保存。结果由用户执行并报告，Codex 未操作真实登录态。
- **Production installed PWA acceptance: user-reported PASS.** The Production URL served the Slice 4 frontend at commit `f916dc0f0a1962facca44f4174241031b4f44bf2`. User confirmed the final Home entries and direct forms, successful Event and Task creation, Personal default and Shared target selection, correct confirmation and saved ownership, immediate Home refresh, normal layout, no evident safe-area/keyboard/overflow/blocking issue, normal top-level navigation, the single-Space Calendar Event `+` regression, and no white screen, hang, or obvious interaction regression. Codex did not operate the authenticated session or the installed PWA.
- **Dedicated final iPhone Safari acceptance: `NOT RUN`.** Do not mark Safari `PASS` or infer it from the installed PWA result. This is not a Slice 4 blocker; the user's final Production mobile acceptance was completed in installed PWA. No local 5175/LAN phone acceptance was performed.
- Combined with the Desktop results above, the user-reported manual acceptance for Slice 4 is `PASS`. The additional Desktop checks include disabled Tasks with no Shared fallback, cancel without a write while retaining the draft, close/reopen clearing confirmation state, duplicate-submit protection, and direct local Calendar/Space create regressions.

## v0.1.11 Slice 3 — Home Aggregation (CLOSED / PASS)

- Focused Home tests cover the three local calendar days, same-day all-day ordering, old recurring sources, moved-in override, only-this deletion, this-and-future child identity, a later-Space read failure, Task overdue/today/seven-day/undated ordering and assignment exclusions, disabled/missing/error module handling, plus section loading/empty/error and five-row expand/collapse. The navigation regression covers the module re-read state/render sequence and Tasks/Completed fallback contract. Existing calendar-refresh tests cover reused dirty-read, burst, pause/stop and retry guards.
- Final applicable Node suite `node --test --test-reporter=tap tests/*.test.ts tests/*.test.js`: **236/236 PASS**. `npm run build` and `git diff --check`: **PASS**. Environment alignment passed earlier for this frontend-only Slice; no backend rollout is needed.
- User-reported authenticated manual acceptance: **PASS** on desktop, Vercel Production, iPhone Safari, and installed PWA. The four tabs, Home default, Home leave/return, narrow viewport, and Space → Tasks navigation fix passed.
- Event acceptance: **PASS** for Personal + Shared aggregation and source Space labels; three-day window; same-day all-day-before-timed ordering; five-item default with expand/collapse; Home Event opening the canonical Event Sheet; ordinary Event editing; and the existing recurrence flow.
- Task acceptance: **PASS** for eligible cross-Space aggregation and ordering (overdue → today → future within seven days → no due date); no-due inclusion; assigned-to-other and >7-day exclusion; five-item default with expand/collapse; Home Task opening the canonical Task Sheet; editing/completing; and Tasks module disable/re-enable. A/B Event and Task Realtime passed.
- Production deployment and device acceptance: **PASS** (user-reported); Production includes Slice 3. Codex did not operate authenticated sessions or perform the user-run browser/device acceptance.
- **NOT RUN / DIFFICULT TO SIMULATE SAFELY:** independent Event/Task section error/retry under real backend/network failures; no failure was deliberately induced. Second Shared Space is **N/A / NOT RUN**; no extra Space was created. These are unrun coverage, not PASS claims or blockers.

## v0.1.11 Slice 2 — Aggregate Calendar (CLOSED / PASS)

- Focused Node tests cover all/one filter and `selectedSpaceId` separation, Personal/Shared labels and member context, same-title/time Event identity, multi-page Event reads, bounded/multi-page exception batches, duplicate/count/Space checks, fail-closed aggregate reads, mixed-Space recurrence/only-this override/delete/this-and-future, projection error display, dirty/stale request invalidation, debounce, teardown, and refresh retry. Existing Space/Hub static regression remains green.
- Final focused Node tests 16/16 PASS; full applicable Node suite `node --test --test-reporter=dot tests/*.test.ts tests/*.test.js` 228/228 PASS. `npm run build` and `git diff --check` PASS. These are local automated/static results, separate from the user-run acceptance below.
- Read-only integration gate: the configured local frontend URL matches the linked Supabase project. Linked Production catalog confirms existing `spaces`, `space_members`, `profiles`, `events`, `event_occurrence_exceptions`, Event/exception RLS, four recurrence RPC names, Event Realtime publication and FULL replica identity. No backend rollout is needed for this frontend-only Slice. No authenticated browser, OTP, A/B, iPhone or PWA session was operated by Codex.
- User-run local authenticated functional checks 1–10: **PASS**. Coverage includes default all with Personal/Shared aggregation, source and owner labels, all/single create and explicit target, Hub → 查看日历, Shared-Space personal Events and permissions, recurrence with ONLY-THIS / THIS-AND-FUTURE, A/B Realtime, filter switching, stale-data behavior, refresh/re-entry and basic recovery. Today previous/next day, Week previous/next week, Month previous/next calendar month across year boundaries, and the corresponding current-period actions passed manual revalidation. Calendar Header UI is frozen.
- User-run bounded Production smoke: **PASS**. Production showed the Slice 2 frontend; default aggregate and source labels, all/single create behavior, Event open/edit Space context, Today/Week/Month navigation and current-period actions, Hub → Calendar single-Space filter, rapid filter switching without stale Space data, and A/B Realtime create/update/delete passed. This was user-performed acceptance; Codex did not operate authenticated sessions.
- Slice 2 is **CLOSED / PASS**. No backend rollout was required or made because this Slice is frontend-only. Dedicated Slice 2 check 11 iPhone Safari, 12 installed PWA and 13 final 320px device acceptance remain **DEFERRED / NOT RUN**; check 14 second Shared Space remains **N/A / NOT RUN**. These are coverage limits and are not PASS claims or blockers.

## v0.1.11 Slice 1 — Final Review, Production Rollout and Post-Deploy Acceptance (CLOSED / PASS)

- User-run local authenticated desktop checks: **PASS** for default Calendar; only `日历 / 空间 / 我的` and no Home; Personal and existing Shared Space list/current marker/create/join entries; Shared → Personal and Personal → Shared list→Hub→Calendar flows; members/invite/Tasks module; remembered selection after refresh without cross-Space pollution; Open/Completed Tasks; Tasks disable hiding the business entry and re-enable restoring the entry and original data; My display-name edit with refresh persistence and restored original name; this-device notification settings; logout to login, refresh staying logged out, and relogin without old navigation or Space state leakage. These are the user's results, not Codex-driven sessions.
- Full applicable automated suite: `node --test --test-reporter=dot tests/*.test.ts tests/*.test.js` — **213/213 PASS**. `npm run build`, implementation `git diff --check`, and final diff/code review — **PASS**. Review found no off-scope business query, Task architecture, backend, dependency or Home/aggregation/filter/global-create change. The Project State headings, exact no-blocker text and Version Index were checked.
- Production rollout: **PASS**. The user confirmed the official Production URL `https://cross-platform-shared-calendar.vercel.app/` displays the new Slice 1 three-item navigation after implementation commit `3bc8d89642c687998acef17b3f1ef064baea2358` and Project State freshness commit `885fe901a9304f1a36c290324e845aa1031612f9` were pushed. This rollout changed frontend navigation only; Slice 1 made no backend/schema/RPC or dependency changes.
- Desktop authenticated acceptance: **PASS**. Default Calendar; only `日历 / 空间 / 我的` and no Home; Personal/Shared list, selected Space marker, both switch directions, list→Hub→Calendar, remembered selection after refresh without cross-Space pollution; Open/Completed Tasks; disable/re-enable hiding/restoring the entry with data intact; My display-name edit and refresh persistence with original name restored; device notification settings; logout, refresh while logged out, and relogin without stale navigation/Space state. User performed the checks; Codex did not operate authenticated sessions.
- Post-deploy iPhone Safari acceptance: **PASS** for three-item navigation, Personal ↔ Shared, Event Sheet, Task Sheet, safe area and bottom-navigation clearance. Installed PWA acceptance: **PASS** for the same navigation and Space flows, safe area/bottom navigation, and Event/Task Sheets.
- At the Slice 1 closeout, overall v0.1.11 remained `IN PROGRESS` and Slices 2–4 had not started. No Slice 2 acceptance was included in this Slice 1 record.

## v0.1.11 Slice 1 — Navigation Foundation (LOCAL AUTOMATED PASS)

- Local implementation displays only `日历 / 空间 / 我的`. Calendar remains scoped to the validated concrete `selectedSpaceId`; Space list/create/join leads to the existing Hub; Tasks/Completed remain inside the Space domain; My contains display name, this-device notifications and logout. Home, aggregation, filter and global create are not implemented.
- `node --test --test-reporter=dot tests/*.test.ts tests/*.test.js`: 213/213 PASS. This includes navigation state, static Calendar/Hub/Space/My UI, existing invalid selected-Space fallback, ensure failure degradation, stale request guards, Personal/Shared Event identity, Tasks module/Realtime, recurrence, Reminder and Push regressions. `npm run build`: PASS. Static review confirms 320px minimum width, `viewport-fit=cover`, bottom safe-area spacing, 48px navigation controls, and Sheets above the bottom nav. The subsequent authenticated iPhone/PWA verification is recorded above.
- Environment readiness: the local frontend URL matched the linked Production Supabase project without printing credentials. Linked Production read-only catalog checks confirmed the required tables, all 11 frontend RPC names, RLS on required tables, and Event/Task Realtime publication. No new backend dependency or first-run write was introduced by Slice 1; the later Production frontend rollout is recorded above.
- At the initial `MANUAL_AUTH_ACCEPTANCE_CHECKPOINT`, desktop acceptance had not yet been performed; its subsequent PASS is recorded above. The later post-deploy iPhone Safari and installed PWA checks also passed as recorded above. Codex does not operate real OTP/Magic Link, A/B authenticated sessions or authenticated PWA. No Slice 2 aggregation acceptance is included.

## v0.1.11 Design Freeze — verification and future acceptance boundary

At the Design Freeze checkpoint, the [canonical specification](./v0.1.11_NAVIGATION_AGGREGATION_SPEC.md) was frozen before any v0.1.11 business code, authenticated acceptance or deployment. That docs-only update required `git diff --check` and governance/status review, not a frontend build. Each implementation slice requires focused tests and `npm run build` before its checkpoint.

Before any user-run authenticated test, Codex must verify the local frontend's actual backend target, required Production schema/RPC/Realtime capabilities and frontend/backend compatibility. The user, not Codex, performs OTP/Magic Link, A/B browser, iPhone/Android and PWA authenticated acceptance. Slice 2 can use Personal plus the existing Shared Space to test aggregate/all/one/isolation; record Shared ↔ Shared as `N/A` if no second Shared Space already exists. Do not create one in Production merely for acceptance. Slice 1 Home remains invisible until Slice 3 gives it all-Space semantics; Slice 4 must verify zero enabled Task targets before opening a Sheet.

## v0.1.10 Slice 3 — Tasks Module Enablement + UI Text Closeout (CLOSED / PASS)

- Focused frontend tests: `node --test tests/task.test.ts tests/space-request-guard.test.ts tests/space-ui.test.ts tests/space-modules.test.ts` — 20/20 PASS. Coverage includes true/false/absent/error module reads, ordered RPC-then-authoritative-refresh, RPC versus refresh failure, duplicate toggle blocking, stale cross-Space module response, Personal/Shared owner controls, Shared member read-only display, enabled/disabled/error Hub entry visibility, safe Hub rendering for blocked Tasks/Completed screens, delayed mutation completion after Task read-gate deactivation, and Chinese user-facing Task-domain errors across uppercase/lowercase variants.
- Full Node suite: `node --test tests/*.test.ts tests/*.test.js` — 212/212 PASS. `npm run build` and `git diff --check` PASS. Final read-only review passed. Source review confirms Tasks list/Realtime setup occurs only when enabled, toggle-in-progress hides the business entry, blocked state remounts the Tasks area to close sheets and discard local cache, and inactive `TasksArea` cannot start a new old-Space Task read or continue pagination. The existing database remains the mutation authority. Static/pure tests cannot establish real browser layout, authenticated state transitions, or Production data retention.
- Implementation commit `d14b73f898b3015564960a91c4e17035ee0f8272` reached Vercel Production deployment `6630561119` with `success` status and matching source SHA. The public URL and active JS/CSS assets returned HTTP 200; the unauthenticated login entry rendered without an observed initialization failure. Active JS contained the Slice 3 module state/toggle, disabled-state, and Chinese Task markers. Linked read-only SQL returned 4 Spaces, 4 Tasks enabled, 0 disabled, and 0 missing module rows. At deployment verification time, no Production module toggle or authenticated session was used; the user's later authenticated acceptance is recorded below.
- This Slice adds no `space_modules` Realtime publication. Another member's already-open page may temporarily display old state; refresh or re-entry reads the current row. Database RLS rejects Task mutations while disabled. Before the first real toggle, users must close/refresh old Production tabs and fully restart PWA runtimes; a still-running Slice 2 bundle continues showing the Tasks business entry even after the backend rejects disabled writes.

### User-run authenticated Production acceptance — PASS

- Personal Space owner disabled Tasks after preparing one Open and one Completed Task. The business entry and pending count disappeared while module management stayed visible; the owner re-enabled Tasks, both original rows and their contents/status returned, and edit / complete / reopen / delete worked.
- Shared Space owner disabled and re-enabled Tasks; the business entry disappeared and original Task data returned. Shared member had no toggle; refresh/re-entry showed the owner's current module state.
- Personal and Shared module states remained isolated during Space switching. iPhone/PWA module panel and basic disable/re-enable operation passed without an obvious layout or interaction issue.
- Known characteristic / future consideration: a Shared member who already has the Space open does not receive an immediate module-state update because `space_modules` is not published to Realtime. The old page may temporarily show the Tasks entry; refresh/re-entry updates it, while database policy immediately rejects disabled mutations. This is not a Slice 3 failure and does not reopen v0.1.10.
- The user performed the authenticated acceptance. Codex did not operate Magic Link / OTP or a user session. No module-state Realtime change is included.

### Acceptance coverage completed by the user

The acceptance above covered Personal and Shared owner disable/re-enable, Open/Completed history restoration and CRUD, Shared member read-only state and refresh, Personal/Shared module isolation, and iPhone/PWA behavior. The user completed these checks after closing or refreshing old Production tabs and restarting PWA runtimes.

## v0.1.10 — Personal Space + Multi-space + Module Enablement Foundation (CLOSED / PASS)

Slice 1: `PRODUCTION BACKEND ROLLOUT PASS`; Slice 2: `CLOSED / PASS`; Slice 3: `CLOSED / PASS`. This closes v0.1.10. Shared Spaces retain the two-member cap. Cross-Space aggregation, final four-destination navigation, global `+`, Lists / Important Dates / Review implementation, and module-state Realtime remain deferred. Next: v0.1.11 Navigation + Aggregation Experience — Scope / Architecture Audit (`NOT STARTED`).

## v0.1.10 Slice 2 — Selected / Current Space Vertical Flow (CLOSED / PASS)

Status at Slice 2 closeout: Slice 1 backend `PRODUCTION BACKEND ROLLOUT PASS`; Slice 2 `CLOSED / PASS`; its authenticated Production acceptance `PASS` and frontend rollout `PASS`. Slice 3's final review, Production rollout, and authenticated closeout are recorded above. This closes Slice 2 only, not the full v0.1.10 foundation.

### User-run authenticated Production acceptance — PASS

The user completed acceptance in real Production browsers and on iPhone/PWA after the compatible Slice 2 frontend was deployed. Codex did not open or operate Magic Link/OTP, enter credentials, or control any authenticated user session.

- Bootstrap and Space isolation: A's Personal Space was automatically created at login; A initially remained in the original Shared Space and could switch Shared ↔ Personal. Personal Calendar showed no Shared Calendar data. B's first-upgrade/default behavior and Personal Space behavior passed; A and B could not see each other's Personal Space. A/B remembered Space selections remained isolated, valid selection restored after refresh, and no random Space selection was observed.
- Personal Events: the audience selector (“我的 / 对方 / 共同”) was absent. Create, edit, and delete passed for A and B; Personal Events did not leak into Shared Space.
- Personal Tasks: assignment selector was absent. Create, edit, complete, Completed Tasks list, reopen, and delete passed for A and B; Personal Tasks did not leak into Shared Space.
- Shared behavior and live updates: Shared Event and Task regression passed; A/B Realtime passed. Rapid Shared ↔ Personal switching showed no cross-Space data in Calendar, Tasks, or members, no stale response repopulation, no Realtime leakage, and no white screen or endless loading. Shared create/join entry points and existing behavior had no observed issue.
- Devices and layout: 320px layout and iPhone/PWA smoke passed.

### Scenarios not run (N/A; not failures)

- Sheet-open Space switch: `N/A — current modal/sheet UI prevents Space switching while the sheet is open`. The user could not operate the Space selector with an Event or Task sheet open. This is not a Slice 2 blocker. The existing `selectedSpaceId` change → sheet reset/close behavior remains as defensive protection; no UI change was made for this scenario.
- Shared ↔ Shared switching: `N/A — no current acceptance account has two Shared Spaces`. The user did not create an extra real Shared Space for testing. Existing local automated logic and the `selectedSpaceId` contract remain the evidence for selecting between multiple Shared Spaces; this scenario is not reported as a real Production test.

No other failure was reported. The real-user acceptance above is distinct from local automated verification and the prior unauthenticated deployment checks.

### Automated and deployment verification

- Focused frontend Node tests: 19/19 PASS. Mocked bootstrap covers ensure-before-list order, Shared-first and Personal-only defaults, valid/stale remembered selection, user A/B storage isolation, ensure failure with readable Shared Space, list failure, no readable Space, explicit retry preserving current Shared selection even without device storage, ambiguous RPC response with a readable Personal Space, and Shared create/join result selection. Request-guard tests cover Shared A → Personal → Shared B with late Event/Task/member responses and newer same-Space refresh. Static rendering checks Personal/Shared form controls and selector entries.
- Full Node suite: 204/204 PASS. `npm run build`: PASS. `git diff --check`: PASS. Source review confirms the old one-Space `.limit(1).maybeSingle()` lookup is gone, current content follows membership-validated `selectedSpaceId`, both Event/Task Realtime channels are removed on unmount, and old requests are invalidated.
- Implementation commit `d7e13e1d81472bfee956920e232c443f15f042e5` reached Vercel Production successfully. The public alias and its Slice 2 JS/CSS assets returned HTTP 200; unauthenticated login entry loaded and the active JS contained the Space-switch and Personal bootstrap identifiers. Post-deployment read-only counts were 2 Spaces, 3 memberships, and 0 Personal Spaces before user acceptance. The docs-only redeployment also succeeded with the same frontend JS/CSS assets.

## v0.1.10 Slice 1 — Data / Permission Foundation (PRODUCTION BACKEND ROLLOUT PASS)

- The guarded forward patch was applied to the existing local Supabase test database and, exactly once without repair, to an isolated disposable replay database built from commit `08bec32f`'s v0.1.9 `schema.sql`. A second disposable database used the current fresh-install schema. Only the replay database received synthetic old data: one Shared Space with owner/member and invite, a shared Reminder Event, a Shared-Space personal Event, an open unassigned Task, and a completed assigned Task. Full-row snapshots of Space, membership, Event, and Task records matched after migration; the old Space became `shared`, gained `tasks=true`, kept its invite code, and no Personal row was created.
- Transactional post-patch checks in the replay database passed for multi-Space create/join, Shared two-member cap and duplicate rejection, idempotent Personal ensure and sole-owner guards, Personal invite/identity/Event restrictions, module owner/member privileges, cross-Space isolation, disabled Task SELECT and every mutation class, and re-enable restoration. Fresh-install versus migrated schema matched on 210 relevant catalog records covering columns, constraints, indexes, triggers, RPC definitions, RLS policies, effective table/function privileges, and Event/Task Realtime publication. These isolated databases used minimal local Supabase Auth prerequisites and synthetic users; they are not Production evidence.
- Focused pgTAP: 58/58 PASS. It covers legacy Shared defaults, multiple Shared memberships, Personal ensure idempotence and uniqueness, sole-owner membership guards, invite rejection and direct Personal invite-code update denial, Personal Event/Task rules, module owner/member privileges, absent/disabled module state, disabled Task create/edit/complete/reopen/reassign/delete, historical SELECT and re-enable, and cross-Space isolation. True concurrent `ensure_personal_space()` calls were not executed; the RPC uses a per-user transaction advisory lock plus the partial unique index.
- Full local database regression: 330/330 PASS across nine files. Full Node suite: 185/185 PASS. `npm run build` and `git diff --check`: PASS. The two task-created disposable databases were removed after verification; the existing local Supabase database and its volume were not reset or deleted.
- Production READ-ONLY preflight passed on PostgreSQL 17.6; just before rollout, the linked project and clean Git baseline were reconfirmed and v0.1.10 objects were still absent. The final `supabase/patches/2026-09-23-v0.1.10-multispace-foundation.sql` ran once in its own transaction on Production project `ximazjhxvmktpcdbypka` with no repair. Immediate postflight counts were unchanged: Spaces 2, memberships 3, Events 13, Tasks 0. Deterministic aggregate MD5 fingerprints were unchanged: Spaces `0d5796080933486b18088101f207b796`, memberships `6b540934b983d14453a6067fddb81a92`, Events `65ab2e25e6fdb04d7a79106fac9963e9`, Tasks `d41d8cd98f00b204e9800998ecf8427e`, invite data `ebffddcb4872beb5bf702b34caf85060`. No user content or invite code was printed.
- Postflight confirmed 2 old Shared Spaces with `tasks=true`, Personal Space count 0, absent one-user-one-Space index, valid partial Personal unique index, no `UNIQUE(kind, created_by)`, expected module PK/FK/check and RLS, member SELECT without direct anon/authenticated writes, authenticated owner-only toggle/ensure RPC grants, enabled Personal membership/Event triggers, Task SELECT preserved and all Task mutation policies gated by module state, unchanged Task identity/status-owner triggers, existing create/join/rotate signatures, and Event/Task Realtime publication with full replica identity. Anonymous PostgREST calls to the new RPCs returned `401 / 42501` rather than a missing-schema error; no business write was possible for that role. The existing Vercel frontend returned HTTP 200.
- Old frontend compatibility at the Slice 1 rollout checkpoint: no Personal Space had yet been created, old create/join RPC signatures and Event/Task calls remained compatible, and Tasks were enabled for all existing Spaces. Production Task count was 0 at backend rollout; later Slice 3 authenticated acceptance exercised disable/re-enable data retention. Next at that checkpoint: Slice 2 selected/current Space flow.

## v0.1.9 Shared Tasks MVP Acceptance and Verification

Status: `v0.1.9 CLOSED / PASS; SLICE 1/2/3 CLOSED / PASS`. The canonical behavior and boundaries are defined in [v0.1.9 Shared Tasks Spec](./v0.1.9_SHARED_TASKS_SPEC.md). The Production backend was applied/postflight verified, the Vercel frontend was deployed, and v0.1.9 was the latest accepted user-facing Production capability at that milestone.

### Slice 3 Production acceptance — PASS (user-reported, 2026-09-23)

- Production page loaded and existing Calendar behavior worked. `👥 共享空间 · {space.name} ›` opened Space Hub → Tasks.
- In Desktop A/B Production sessions, A created a Shared Task and B saw it without refresh. Title, assignment, and due-date changes synchronized in real time.
- Either current member could Complete/Reopen a Shared Task. Only the assignee could Complete/Reopen an Assigned Task; the other member could not accidentally activate those controls. A member could first reassign a Task to self, then complete it.
- Complete, Reopen, and Delete synchronized in real time. Delete required a second confirmation, and the Completed page worked.
- iPhone Production smoke passed for the Tasks page and Create/Edit Task Sheet. Assignment and due date were operable; no material horizontal overflow or obstructed controls were observed.
- This is user-run authenticated Production evidence. Codex did not drive logged-in sessions. No new full Reminder delivery acceptance or separate Production non-member isolation test is claimed here.

Slice 2 UI is implemented locally. The original all-member complete/reopen rule was corrected after real A/B acceptance found A could complete B's assigned Task. The user completed real A/B and 320px browser acceptance after the correction and Space-entry fix; Codex did not drive authenticated sessions. Final automated results are recorded below.

### Slice 2 real-browser manual acceptance — PASS (user-reported, 2026-09-23)

- Navigation: the Calendar header `👥 共享空间 · {space.name} ›` was recognizable as the current Space entry; Calendar → Space Hub → Tasks worked. Returning to Calendar preserved the selected date and Today/Week/Month view.
- CRUD/Realtime: A created a Shared Task and B saw it without refresh. A's title, assignee, and due-date edits synchronized to B without refresh. Complete, Reopen, and Delete synchronized in real time; Delete required a second confirmation. A current Space member other than the creator could edit and delete.
- Status ownership: either current member could Complete/Reopen Shared Tasks. For a Task assigned to B, A could neither Complete nor Reopen after completion, while B could do both. A could reassign the Task to A, then Complete in a separate action. The same-UPDATE reassignment-plus-status bypass is separately rejected by the focused database test; the UI follows the two-step flow.
- Mobile: the Space Hub and Tasks page worked at 320px; Create/Edit Task Sheets had no material horizontal overflow, blocked controls, or unreachable actions. Ellipsis on the dynamic Space name at extreme narrow width was accepted and is not a blocker.
- This acceptance covered the local new frontend against the aligned Production Task backend. It is Slice 2 acceptance, not Vercel/frontend Production deployment or Slice 3 acceptance.

### Slice 2 final automated verification — PASS

- Focused Task frontend/schema-contract Node tests: 16/16 PASS.
- Focused Task foundation pgTAP: 58/58 PASS; focused status-ownership pgTAP: 15/15 PASS.
- Existing Node regression suite: 185/185 PASS. All eight local database regression suites: 272/272 PASS.
- `npm run build`: PASS. `git diff --check`: PASS.
- No frontend Production deployment or Slice 3 acceptance was performed by these checks.

### Authenticated Integration Readiness Gate and backend-first sequence

- Before any real-login, A/B, Realtime, or authenticated mobile/PWA manual test, Codex verifies the frontend's actual backend target, the target's required schema/RPC/Edge Function capabilities, and frontend/backend feature-version compatibility. A mismatch blocks the request for browser acceptance.
- For a reviewed, tested, backward-compatible additive backend change: apply the backend first, complete backend postflight, then test the local new frontend against the Production backend with real accounts. After manual acceptance passes, request explicit authorization before committing/pushing the frontend for Vercel.
- Narrow compatibility exception: when the new authenticated frontend's first run changes persistent Production state so the currently served frontend becomes incompatible, do not use local/Preview plus real Production accounts for pre-deployment acceptance. After environment alignment, local automated/static checks and code review, obtain explicit Git/deployment authorization, commit/push/deploy the compatible frontend, verify its unauthenticated/static Production assets and that the old frontend is no longer the active entry point, and have users close/refresh old tabs and restart PWA runtimes. The user then performs authenticated acceptance. This is not a general deploy-before-test rule. For v0.1.10 Slice 2, `ensure_personal_space()` can create a second membership that v0.1.9 `.limit(1).maybeSingle()` cannot handle; once created, v0.1.9 is not a safe rollback target for that account.
- Frontend defects remain local until fixed and retested. Backend corrections use a new reviewed forward migration; do not edit the already-applied Production migration, casually rollback, or reset the database. Breaking/destructive changes need their own rollout, compatibility, and rollback plan.
- Codex runs automated checks and this environment gate. The user runs Magic Link/OTP, A/B real-account, logged-in browser-session, and iPhone/Android/PWA acceptance on real browsers/devices. No Auth bypass or Codex-controlled authenticated browser testing.

### Slice 1 Production backend alignment — 2026-09-23

- The reviewed Slice 1 patch was unchanged from HEAD. The local 5175 frontend's remote target matched the CLI-linked Production project. Preflight found PostgreSQL 17.6, required Space/member helpers and composite uniqueness, and no Task table/function/index/publication entry.
- Applied only `supabase/patches/2026-09-22-v0.1.9-shared-tasks-slice1.sql`. Postflight verified nine columns, six expected constraints, the column-specific same-Space assignment FK, four member RLS policies, immutable-identity and `updated_at` triggers, CRUD grant, list index, Realtime publication, `REPLICA IDENTITY FULL`, and exactly zero Task rows. The non-Task public schema fingerprint was unchanged; an unauthenticated, read-only zero-row PostgREST request returned HTTP 200.
- At this backend-alignment checkpoint, the Vercel frontend was not deployed and manual acceptance was still pending; the later Slice 2 and Slice 3 acceptance results are recorded above.

### Slice 2 Task status-ownership correction — 2026-09-23

- TDD reproduction: before the corrective trigger, A's status UPDATE and same-UPDATE B→A reassignment plus completion succeeded incorrectly; 3/14 focused pgTAP assertions failed. After applying the reviewed corrective patch locally, focused pgTAP passed 15/15 and all eight database suites passed 272/272. Existing non-member and collaborative CRUD regressions remained green.
- The database checks `OLD.assigned_to_user_id` only when `status` changes. Shared Tasks allow any current Space member to complete/reopen under existing RLS; assigned Tasks require the current assignee. Title, due date, and assignment edits remain collaborative. A takeover requires a separate reassignment UPDATE before the new assignee changes status.
- Applied only `supabase/patches/2026-09-23-v0.1.9-task-status-ownership.sql` to Production after a clean preflight: PostgreSQL 17.6, original nine columns/six constraints/four RLS policies/two triggers intact, correction absent, zero Task rows. Postflight confirmed the new BEFORE UPDATE trigger enabled and function bound to OLD assignment; prior schema fingerprint unchanged, existing Task data untouched, zero rows. The 5175 frontend still targets the linked Production backend; no frontend deploy or real-account Codex browser test occurred.

### Slice 1 — Task persistence and authorization — LOCAL PASS

- Focused Task pgTAP: 58/58 PASS.
- Full database regression: 257/257 PASS across seven pgTAP files.
- Relevant schema-contract tests: 14/14 PASS.
- `git diff --check`: PASS.
- Verified local target: PostgreSQL 17.6. The composite assignee FK with column-specific `ON DELETE SET NULL (assigned_to_user_id)` preserved the Task and `space_id` while clearing assignment.
- Scope audit: no frontend, Event, Reminder, recurrence, Multi-space, dependency, Production, or deployment change.

- Verify the exact `tasks` fields and one-table complexity budget, required/default/nullability rules, title canonical-value constraint, `open` / `completed` status check, date-only `due_on`, timestamps, and one reasonable list-oriented index.
- Verify `space_id` and `created_by` are immutable; authenticated creation cannot forge another creator.
- Verify a non-null assignee is a current member of the same Space and cross-Space/former-member assignment is rejected.
- Verify removing an assigned membership clears the assignment to shared without deleting the Task. Test the selected minimal target-compatible mechanism directly.
- Verify current members can select/insert/update/delete under the frozen collaborative policy while former/non-members cannot read or mutate rows.
- Verify RLS remains the final row-level boundary and authenticated table grants do not broaden it.
- Verify `tasks` is present in `supabase_realtime` and uses the compatible replica-identity behavior required for Space-filtered DELETE delivery.
- Verify the incremental patch and fresh-install `schema.sql` converge on the same Task contract and do not modify Event/Reminder objects.
- Run the focused v0.1.9 pgTAP suite, all existing database regressions, relevant schema source-contract tests, and `git diff --check`.

### Slice 2 — Minimal CRUD, UI, and Realtime

- **Space-entry discoverability defect resolved and manually accepted:** Calendar header presents an icon-labeled `共享空间 · {space.name}` control with a chevron. User-run acceptance confirmed the entire pill opens the Hub, returning keeps the selected date and Today/Week/Month view, and extreme-width ellipsis does not block 320px use.
- At `http://127.0.0.1:5175`, start in Calendar. Tap its header Space name, confirm the Hub shows the actual Space name, member count/action, existing invite copy/rotate controls, and only one `Tasks / N 项待完成` module row. Go Hub → Tasks → Completed Tasks and back through each header. Confirm Calendar returns to its former date/view and existing Calendar controls/InvitePanel still work. No old top-level `Calendar / Tasks` switch, full navigation, or future-module placeholders appear.
- Confirm Tasks shows only Open rows, live `待完成 · N`, page-local `+`, assignment/date secondary labels, and one `已完成 · N >` entry. Completed page shows every completed row with view/edit and delete through its edit Sheet; `重新打开` appears only for Shared or self-assigned Tasks. The main page does not expand completed rows. Check that a list exceeding a server row limit is not silently truncated, without adding pagination UI. Test both empty lists and zero counts.
- Confirm Open ordering by `due_on` ascending, nulls last, then `created_at` and `id` ascending; equal-date and no-date fixtures should be deterministic. Completed uses the same stable ordering and makes no completion-recency claim.
- Confirm `+` opens the existing-style bottom Sheet with exactly title, assignment, and optional date; create defaults to Shared and no date. Edit preserves status while changing those fields. Title is trimmed and constrained to 1–200 characters; failures stay visible with input intact. Date can be set and cleared. Close/cancel discards unsaved changes.
- Confirm an eligible left Open circle completes without opening edit and moves the row to Completed; tapping any Task title opens edit without completing. `重新打开` returns an eligible Task to the sorted Open list. For a Task assigned to the other member, neither status control is clickable, but title/due date/assignment editing remains available. Delete exists only inside edit, requires a named second confirmation, and cancel leaves the Task intact. A failed write does not leave a false completed/deleted state.
- Confirm assignment shows `共同` plus only real current Space members. Prefer `profiles.display_name`; in the current two-member v0.1.9 UI, when it is empty use contextual `我` / `对方` labels relative to each signed-in account. Verify those labels are presentation only and writes use member IDs. One-member Space shows no invented partner; no email/Auth metadata label is displayed. Future Multi-space / multi-member display must use generic member logic, not a persisted `partner` identity.
- At 320px narrow mobile width and a typical mobile viewport, verify one column, wrapped titles, distinct circle/title/reopen targets, readable count/chevrons, no horizontal scrolling, Sheet keyboard/safe-area behavior, and keyboard/accessibility labels for icon controls.
- With A and B independently authenticated in the same Space, open Hub/Tasks in both and do not refresh either session: (1) A creates an open Task and B sees the row plus Open/Hub counts; (2) B edits title and A sees it; (3) A assigns to B, then Shared, and B sees each change; (4) B sets then clears a due date and A sees both values and resulting order; (5) A completes via circle and B sees the row leave Open and appear in Completed with both counts updated; (6) B reopens and A sees it return to Open; (7) A deletes through edit and confirmation and B sees it disappear from both lists/counts. Reverse A/B writer roles on a second Task. Verify no manual reload, including when the observer is on Hub or Completed.
- Corrective re-acceptance with A/B real sessions: create a Task assigned to B. A sees no clickable Complete/Reopen control but can edit title/due date and reassign. B can Complete and Reopen. A may reassign B→A and then Complete in a separate action; one UPDATE combining reassignment and completion must be rejected by the database. Repeat Shared Task Complete/Reopen from both accounts. Verify all results synchronize without refresh.
- Verify a non-member cannot receive or query another Space's Tasks and Realtime does not bypass RLS.
- Run focused Task Node tests, the full relevant frontend regression suite, `npm run build`, and authenticated desktop/narrow-mobile smoke at `http://127.0.0.1:5175`.

### Slice 3 — Production acceptance and closeout

- Requires separate Production/deployment approval after Slice 1 and Slice 2 acceptance.
- The authorized backend-first Slice 1 Production patch and structural postflight are recorded above; do not reapply it.
- Before any frontend deployment, review the user-run Slice 2 authenticated acceptance evidence and obtain separate approval for Slice 3.
- Deploy only the compatible reviewed frontend.
- In two authenticated Production sessions, verify Task create/edit/assign/complete/reopen/delete persistence and Realtime, plus non-member/RLS isolation and supported mobile layout.
- Confirm Task due dates do not create Events and no Task enters Reminder persistence, sender, ledger, Cron, or Web Push paths.
- Update canonical docs only after observed Production results; correct only concrete acceptance defects rather than adding polish.

### v0.1.9 Explicit Regression Boundaries

- Existing Event CRUD, recurrence, Calendar Today/Week/Month views, member identity, Email OTP, Push subscription lifecycle, ordinary/recurring Reminder delivery, scheduler, and keep-alive behavior remain unchanged.
- No new dependency, Edge Function, Cron job, queue, local persistence, external storage, Task Reminder, Multi-space implementation, or UI overhaul is part of v0.1.9 acceptance.

## Filesystem Persistence Boundary

- Tests that exercise filesystem persistence must use temporary directories or injected paths.
- Ordinary tests must not write the real `/Users/wp/Projects/_project-data/cross-system-shared-calendar/` root.
- This project currently has no filesystem-level persistent business data; Supabase remains the canonical cloud persistence and is not mirrored locally for filesystem governance.

## Project State Push Gate

运行独立 gate 集成测试：

```bash
node --test tests/project-state-push-gate.test.js
```

测试使用临时 Git repository、bare remote、临时 Git identity 与临时
`GIT_CONFIG_GLOBAL`（并设置 `GIT_CONFIG_NOSYSTEM=1`），只用本地路径且不访问网络。
覆盖 branch 的 `updated` / `verified-current` 分类、PROJECT_STATE 增改删、trailer
边界、首次与 force push、branch/tag 删除、lightweight / annotated / non-commit tag、
多 ref、tip 冲突、remote OID 缺失、真实 bare remote pre-push 接线、安装脚本首次安装/
幂等/冲突拒绝，以及含空格或非 ASCII 的路径。

Gate 实现还包含 forward-only version governance：对 branch push，只检查相对远端新增到
`Current version` 或 `Version Index` 的正式版本 token，并要求其为纯数字 canonical
version（例如 `v0.8`、`v0.8.2`、`v0.6.6.1`）。既有 legacy token 不做回溯验证；tag
不做 PROJECT_STATE tree 或 version-diff 分类。

Gate 语法检查：

```bash
sh -n .githooks/pre-push
sh -n scripts/check-project-state-push.sh
sh -n scripts/install-git-hooks.sh
```

Gate 检查新正式版本 token 的 forward-only canonical 格式，并检查最终 branch tip 的
trailer 是否与 PROJECT_STATE tree diff 一致；tag 只验证目标 commit 的合法 trailer。
`git push --no-verify` 可以绕过本地 hook；gate 不判断状态内容真实性，不会自动 commit
或 push，也不替代用户明确授权。

## v0.1.8 Mobile Push Reminder Acceptance Plan

Status: `v0.1.8 — Mobile Push Reminder` is `CLOSED / PASS`. Push Infrastructure, ordinary Reminder Slice A/B/C, Slice 3 Recurrence Reminder Integration, and final cross-platform acceptance are complete.

### Final Cross-Platform / Android Acceptance — CLOSED / PASS

- Mac Production Push and automatic Reminder: PASS.
- iPhone Production Push and automatic Reminder: PASS.
- Android acceptance was performed on Android Studio Emulator, not physical Android hardware.
- Android notification permission/subscription: PASS.
- Android `send-test-push` delivery: PASS.
- Android ordinary automatic Event Reminder delivery: PASS.
- Android audible notification: PASS.
- Android notification-shade delivery: PASS; pulling down the shade showed the delivered notifications, so no missing delivery was found.
- Android heads-up/top-screen banner: not observed. This is classified as emulator/Chrome notification presentation behavior, not a Push or Reminder delivery failure. Physical Android hardware heads-up presentation was not validated and is non-blocking.
- Notification-click/open PASS is not recorded because the supplied final evidence did not independently confirm it.
- Final read-only Production health review: project Healthy; displayed recent request success 100%; zero displayed Postgres/Edge Function warnings or errors. The accepted `send-reminders` v2, `send-test-push` v4, exactly one active scheduler, healthy recent Cron/pg_net HTTP results, no stuck claims, no unexpected subscription disablement, and no duplicate delivery identities remain the canonical state. No Production mutation was required.
- Existing Future Consideration remains unchanged: semantic due is exact; once-per-minute `pg_cron` + async `pg_net` + Web Push may add sub-minute to approximately one-minute visible latency; v0.1.8 adds no `-60s` early-dispatch allowance. Revisit only for material real-use feedback or future native OS-level local scheduling.
- Optional future consideration: casually revalidate heads-up presentation on physical Android hardware if convenient. This does not reopen v0.1.8.

### Slice 3 Recurring Reminder Production Acceptance — CLOSED / PASS

Production rollout and acceptance on 2026-09-22:

- Applied only the reviewed Slice 3 forward DB patch once. Postflight passed for nullable `reminder_deliveries.occurrence_date`, recurrence-aware `UNIQUE NULLS NOT DISTINCT` identity, preserved ordinary ledger rows, RLS/no-policy/no-Realtime state, service-role SELECT/UPDATE-only table access, and the exact service-role-only hardened recurring claim with no SQL recurrence expansion. Historical recurring Events were not auto-enabled.
- Deployed only `send-reminders` v2 with source-controlled `verify_jwt=false`; `send-test-push` remained v4. The deployed frontend contains recurring source Reminder controls. The unique once-per-minute scheduler stayed active and healthy without Vault/secret/Cron changes.
- Normal recurring automatic E2E passed: semantic start 11:55 and due 11:45 were exact; iPhone and Mac received the automatic Push; two subscription-specific rows finalized as `sent`; repeated work did not duplicate. The approximately one-minute visible delay was traced to asynchronous scheduler/pg_net/Web Push processing, not due calculation.
- ONLY-THIS override acceptance passed with inherited/read-only 10-minute Reminder, effective moved start/title, automatic Push, original scheduled occurrence identity, and no duplicate delivery. ONLY-THIS delete acceptance passed immediately without waiting: one unambiguous delete exception, zero canonical occurrence, zero Reminder candidate/effective due/ledger/claim/send, preserved neighboring occurrences, and structural stale-snapshot claim rejection.
- THIS-AND-FUTURE split acceptance passed: exactly one child source inherited Reminder/timezone/rule and logical identity, received a fresh marker, and projected the split boundary/future while the parent cutoff excluded them. There were no duplicate logical dates, no catch-up ledger, no per-occurrence Reminder field, and the prior override/delete semantics remained intact.
- Final health: `send-reminders` ACTIVE v2; one active scheduler; 10/10 recent Cron runs and pg_net HTTP 200 responses healthy; zero stuck claims, duplicate delivery identities, split-created ledger rows, or unexpected subscription disables. The prior ordinary Reminder regression remains PASS.
- `ALLDAY_PRODUCTION_REALTIME_WAIT_NOT_REQUIRED`: the deployed contracts and focused 26/26 automated verification remain authoritative for recurring all-day same-day 08:00, previous-day 20:00, canonical timezone, DST gap/overlap, a non-1-hour transition, and a full date-line/day transition. No next-day real Push wait was required.
- Future consideration — Web/PWA Push delivery precision: semantic due remains exact; once-per-minute `pg_cron` + async `pg_net` + Web Push may occasionally add sub-minute to approximately one-minute visible latency. v0.1.8 adds no `-60s` early-dispatch allowance and keeps ordinary/recurring timing under the same semantic rule. Revisit only for material real-use UX impact or future native OS-level local notification scheduling.

### P3C Automatic Scheduler E2E — CLOSED / PASS

Production acceptance on 2026-09-22:

- Confirmed exactly one Vault `REMINDER_CRON_SECRET` by name without retrieving its value. Enabled only `pg_cron` in `pg_catalog` and `pg_net` in `extensions`; `cron.schedule`, `cron.unschedule`, and `net.http_post` are available.
- Created exactly one active `send-reminders-every-minute` job on `* * * * *`. The exact stored command targets Production `send-reminders`, performs the Vault lookup at execution time, uses a 120000 ms request timeout, and contains neither plaintext secret nor service-role bearer. Unschedule-first is the canonical failure containment.
- Automatic no-due verification passed with zero enabled ordinary Reminder candidates and zero selected/claimed/sent/failed work. The ledger and subscription state remained unchanged.
- The scheduler discovered one disposable personal timed `Automatic Reminder E2E Test` without any manual curl or Function invocation. Both iPhone and Mac automatically received the real Reminder.
- Ledger postflight confirmed two rows for one due across two distinct active subscriptions: `sent = 2`, `claimed = 0`, `failed = 0`, duplicate identities `= 0`, and unexpected subscription disables `= 0`.
- Four repeated due-window scheduled responses produced eight aggregate claim rejections with no extra claim, row, send, or notification. A bounded 120-minute postflight recorded 120/120 successful Cron runs and HTTP 200 responses, at most one run in any minute, zero timeouts/errors, zero stuck claims, and zero sensitive diagnostic markers.
- C1 remains PASS; `send-reminders` remains ACTIVE v1 / `verify_jwt=false`; `send-test-push` remains ACTIVE v4 reviewed-equivalent. Slice C is `CLOSED / PASS`; Slice 3 recurrence Reminder integration and final Android/cross-platform acceptance remain separate.

### P3B send-reminders Production Manual E2E — CLOSED / PASS

Production acceptance on 2026-09-22:

- `send-reminders` is ACTIVE with `verify_jwt=false`; `send-test-push` remains ACTIVE v4 / `verify_jwt=true`. The Edge `REMINDER_CRON_SECRET` is confirmed by name only; its value was never exposed.
- Missing and invalid Authorization returned HTTP 401 before database work. The authorized no-due invocation returned HTTP 200 with `due_eligible = 0`, `claimed = 0`, `sent = 0`, and `failed = 0`.
- The disposable personal timed Event used `timed_10m_before`; one recipient had two active subscriptions. The first due-window invocation returned HTTP 200 with `due_eligible = 1`, `recipients = 1`, `active_subscriptions = 2`, `delivery_tasks = 2`, `claimed = 2`, `sent = 2`, `failed = 0`, and `finalize_failures = 0`.
- iPhone received the real Reminder; title/body and click behavior passed. Mac backend delivery succeeded, while visible presentation was initially suppressed by Sleep/Focus. After disabling that state, the existing Mac `send-test-push` regression passed.
- The repeat invocation returned `claim_rejected = 2`, `claimed = 0`, `sent = 0`, `failed = 0`, and no duplicate notification.
- Ledger postflight confirmed two finalized `sent` rows, zero remaining `claimed`, zero `failed`, zero duplicate `(event_id, subscription_id, due_at)` identities, zero unexpected subscription disablement, and zero unexpected ledger rows. The disposable Event is not present in the current aggregate check; no ledger rows were deleted.
- Cron remains OFF; Vault Reminder secret, pg_cron, and pg_net remain absent. P3C scheduler activation requires separate authorization.

### P3A Production C1 Foundation Final Closeout — CLOSED / PASS

Production ACL correction and bounded postflight on 2026-09-21:

- Applied only `supabase/patches/2026-09-21-v0.1.8.2-reminder-delivery-acl-correction.sql` once to canonical Production. Final direct/effective ACL is `service_role` SELECT / UPDATE only; INSERT / DELETE / TRUNCATE / REFERENCES / TRIGGER / MAINTAIN are denied. All eight privileges remain denied for anon/authenticated.
- `reminder_deliveries` remains empty with 10 expected columns, five constraints, UUID primary key, unique `(event_id, subscription_id, due_at)`, zero foreign keys, enabled updated-at trigger, RLS enabled, zero policies, and no Realtime publication.
- `claim_reminder_delivery(...)` remains one UUID-returning SECURITY DEFINER function with hardened search path, unchanged definition hash and reviewed body contract, service-role-only execution among application roles, and no Production invocation.
- Events, Push subscriptions, and Space members structural fingerprints matched pre-correction exactly. Five Reminder persistence constraints and the schedule-marker trigger remain intact.
- `send-test-push` remained ACTIVE v3. `send-reminders`, Edge/Vault Reminder secrets, pg_cron, pg_net, and Reminder Cron remain absent or untouched; no Push, Event/test data, or subscription mutation occurred. `C1_PRODUCTION_FOUNDATION = PASS`; stop before P3B.

### P3A C1 ACL Corrective RCA — HUMAN REVIEW PASS / APPLIED

- Production read-only catalog evidence classified the source as `DIRECT_OR_DEFAULT_TABLE_GRANT`: owner `postgres` has a schema-`public` default table ACL granting all privileges to `service_role`, and those grants were materialized directly in `reminder_deliveries.relacl`. `service_role` is not owner/superuser, has no inherited roles, and has no PUBLIC or other-role privilege path.
- Catalog reasoning confirms a table-local `REVOKE ALL PRIVILEGES ... FROM service_role` followed by `GRANT SELECT, UPDATE ... TO service_role` is sufficient. Default privileges affect future object creation and do not reapply to the existing table after the revoke.
- Added the four missing negative assertions for TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN to the existing C1 pgTAP suite. Before the local correction they failed exactly 4/67; after applying the new corrective patch to the local database only, the suite passed 67/67.
- Bounded human/code review found no issues in the corrective SQL, full privilege contract, or governance scope. Production was not modified during the RCA/review itself; the reviewed correction was later applied in the bounded final closeout above.

### P3A Initial Production C1 Foundation Attempt — ACL GATE FAILED (historical)

Production execution and structural verification on 2026-09-21:

- Repository baseline was clean at `7c5c08634e7d689f9df1ae02388a06d02d75f619`; the exact C1 patch SHA-256 matched `81c40c715d6cd52cecc5f4f19835b6612ddafc7daaecdd1aa82d85b6bb6de629`. Linked-project identity matched canonical Production project `ximazjhxvmktpcdbypka`.
- Read-only preflight confirmed both C1 objects absent, all 14 required columns present, all five Slice B constraints and the schedule trigger present, `touch_updated_at()` present, `pg_cron` / `pg_net` absent, and `REMINDER_CRON_SECRET` absent. Structural fingerprints were captured for Events, Push subscriptions, and Space members.
- Applied exactly `supabase/patches/2026-09-21-v0.1.8.2-reminder-delivery.sql` once. Postflight confirmed 10/10 expected columns, five expected constraints, UUID primary key, unique `(event_id, subscription_id, due_at)`, zero foreign keys, enabled `touch_updated_at` trigger, RLS enabled, zero policies, no Realtime publication, and zero initial ledger rows.
- `claim_reminder_delivery(...)` exists once, returns UUID, is SECURITY DEFINER with exact `pg_catalog, pg_temp` search path, matches the reviewed revalidation/idempotency body contract, and is executable by `service_role` but not anon/authenticated.
- Existing Events, Push subscriptions, and Space members column/constraint/index/RLS-policy/trigger/publication fingerprints matched preflight exactly. `send-test-push` remained ACTIVE v3; `send-reminders`, Reminder secret, pg_cron, and pg_net remained absent.
- ACL gate failed: effective and direct ACL inspection showed `service_role` had INSERT / DELETE / TRUNCATE plus other broad table privileges, not only SELECT / UPDATE. No correction or cleanup was attempted during that run. This historical stop condition was resolved by the separately authorized correction and final closeout recorded above.

### Slice 2C2 Phase 2 — send-reminders Core Orchestration

Local implementation verification on 2026-09-21:

- Confirmed TDD RED before implementation because the `send-reminders` module did not exist. A later review-found cutoff regression also failed before the implementation added an immediate pre-claim budget recheck after asynchronous tag generation.
- Passed `node --test tests/send-reminders.test.ts` (26/26). Coverage includes exact bearer auth and zero unauthorized work, fixed run context, stable 100-row keyset pagination, exactly-1000 acceptance, explicit 1001st-row abort, canonical due/grace/marker semantics, current personal/shared recipients, active multi-install subscriptions, deterministic 50-task selection, all sender result mappings, raw-marker C1 claim, claim rejection, 404/410 retirement, exact-one-row finalize checks, aggregate-only diagnostics, five-worker concurrency, and the 95-second claim cutoff.
- Passed the complete repository suite: `node --test tests/*.test.ts tests/*.test.js` (153/153).
- Passed `deno check --no-lock --node-modules-dir=none --config supabase/functions/send-reminders/deno.json` for `logic.ts`, `index.ts`, and the existing shared Web Push sender. The function reuses the existing exact dependency pins and adds no root dependency or lockfile change.
- Passed `npm run build` and `git diff --check`.
- Scope audit: only the new `send-reminders` function, its focused Node test, and canonical status/testing docs changed. No database/schema/C1, recurrence, frontend, Service Worker, shared sender, `send-test-push`, root dependency, Cron, Vault, real secret, deployment, commit, push, or Production change was made. C1 remains undeployed; human/code review passed with no BLOCKER / MAJOR / MINOR findings, and commit/push closeout is the next authorized step.

### Slice 2C2 Phase 1 — Shared Web Push Sender Extraction

Local implementation verification on 2026-09-21:

- Confirmed RED before production refactoring because `supabase/functions/_shared/web-push.ts` did not exist and the new source-contract assertions could not read it.
- Passed `node --test tests/web-push.test.ts tests/send-test-push.test.ts tests/send-test-push-source.test.ts` (29/29). Coverage includes 2xx, 404, 410, provider rejection, timeout, network failure, invalid sender results, allowed/disallowed endpoints, VAPID loading, TTL 60, timeout 10000 ms, normal urgency, hostname/status-only diagnostics, no sensitive result leakage, shared-module usage, preserved CORS/auth/installation/fixed-payload/disable/response contracts, exact package pinning, and exclusion from the browser tsconfig/root package.
- Passed the complete repository suite: `node --test tests/*.test.ts tests/*.test.js` (123/123).
- Passed `deno check --no-lock --node-modules-dir=none supabase/functions/_shared/web-push.ts` and `deno check --no-lock --node-modules-dir=none --config supabase/functions/send-test-push/deno.json supabase/functions/send-test-push/index.ts`, using the Deno global cache for already-pinned function dependencies and adding no root dependency or lockfile.
- Passed `npm run build` and `git diff --check`.
- Passed required real-device regression after deploying only `send-test-push`: Desktop Chrome/macOS and iPhone installed PWA actual notification, unchanged safe diagnostics, correct title/body, and unchanged notification-click behavior. Desktop repeated-banner behavior was separately classified as pre-existing fixed-tag behavior and is non-blocking.
- Scope audit: no `send-reminders`, candidate scan, delivery ledger/claim, Cron, secret, Vault, database, or Service Worker change. Only `send-test-push` was deployed; commit/push closeout remains separate.

### Slice 2C1 — Minimal Delivery Ledger + Atomic Claim

Local implementation verification on 2026-09-21:

- Confirmed TDD RED from `supabase/tests/2026-09-20-v0.1.8.2-reminder-delivery.test.sql` before implementation because `public.reminder_deliveries` and `claim_reminder_delivery(...)` did not exist.
- Passed the final C1 pgTAP contract 63/63. Coverage includes the exact ledger fields and `smallint` provider status, minimum constraints, no audit foreign keys, RLS/ACL/Realtime/function privileges, first/duplicate claim, all frozen eligibility rejections, exact marker matching, valid grace, and audit survival after Event/subscription deletion or disablement.
- Passed a real local concurrency probe with four PostgreSQL sessions calling the identical claim after the same synchronization delay: exactly one call returned a UUID and the final ledger count was one. The fixed-UUID test fixture was removed afterward. No `dblink`, extension, or dependency was added.
- Passed the complete local database suite: 5 files and 161/161 assertions. Slice B remains 28/28.
- Passed `node --test tests/*.test.ts tests/*.test.js` (114/114), `node --test tests/reminder-due.test.ts` (9/9), `node --test tests/recurrence.test.ts` (25/25), both existing Deno checks, `npm run build`, and `git diff --check`.
- Marker contract: future callers must pass the database `reminder_schedule_changed_at` value without lossy JavaScript formatting or precision truncation. C1 itself is DB-only and has no caller, sender, candidate scan, Cron, secret, provider integration, or Production migration.

### Slice 2A — Timezone Primitives + Reminder Due Calculator

Local verification on 2026-09-20:

- Passed `node --test tests/recurrence.test.ts tests/reminder-due.test.ts` (34/34). Coverage includes null/invalid inputs, all seven frozen reminder kinds, timed/all-day mismatch, real-minute offsets, Event-local previous-day arithmetic, all-day 08:00/previous-day 20:00, DST gap/overlap policy, and the absence of `ends_at` from the calculator contract.
- Passed the full repository Node suite: `node --test tests/*.test.ts tests/*.test.js` (101/101).
- Passed `npm run build`, proving the Vite/browser TypeScript project imports the shared runtime-neutral timezone implementation.
- Node imports passed through both recurrence and Reminder tests. Existing recurrence behavior is locked by new DST characterization tests: a nonexistent wall clock advances to the first instant after the spring gap, while an overlapped wall clock selects the earlier instant.
- Passed with system Deno 2.9.7: `deno check supabase/functions/_shared/time-zone.ts` and `deno check supabase/functions/_shared/reminder-due.ts`. Deno remains a system verification tool rather than a project dependency.
- Scope audit passed: no database/schema/migration, Event UI, sender, Cron, Service Worker, Push Subscription, Supabase/Vercel configuration, dependency, deployment, commit, or push change.

### Slice 2B — Reminder Persistence + Event Mutation/UI

Local implementation verification on 2026-09-20:

- Passed the Slice B schema/migration static contract: 4/4. It covers the exact three columns, five minimum constraints, one validation/marker function + trigger, historical recurring-only timezone backfill, no historical Reminder activation, no legacy offset, and split-child timezone inheritance.
- Passed the complete repository Node suite: `node --test tests/*.test.ts tests/*.test.js` (114/114). New coverage includes timed/all-day defaults and mapping, null preservation, controlled timezone capture failure with no UTC fallback, existing timezone preservation, historical capture boundaries, semantic partial payloads, seconds/milliseconds preservation, and protected identity-field exclusion.
- Passed `deno check supabase/functions/_shared/time-zone.ts`, `deno check supabase/functions/_shared/reminder-due.ts`, `npm run build`, and `git diff --check`.
- Added `supabase/tests/2026-09-20-v0.1.8.2-reminder-persistence.test.sql` with 28 planned assertions for structure, constraints, marker behavior, direct marker mutation defense, and split-child timezone inheritance. Existing recurrence pgTAP fixtures now provide their authoritative Event timezone.
- Passed disposable ordered-upgrade from the committed pre-Slice-B schema with historical ordinary/recurring/personal fixtures. Verified historical-null policy, recurring timezone backfill, marker initialization, constraints/trigger, split-child timezone inheritance, RLS, personal ownership, and Realtime preservation.
- Passed Slice B pgTAP 28/28 and the complete local database regression suite 98/98. The recovered local database initially lacked the existing v0.1.8.1 prerequisite; applying that already-approved additive patch locally restored the expected baseline before the final green run.
- Production preflight, application of only `supabase/patches/2026-09-20-v0.1.8.2-reminder-persistence.sql`, and read-only postflight passed. Historical reminders remained disabled, ordinary timezones remained null, recurring timezones matched their rule, and existing RLS/owner validation/Realtime/Push infrastructure were preserved.
- Production human acceptance completed on 2026-09-20 against the deployed frontend — PASS: new timed defaults to 10 minutes before and new all-day defaults to 08:00; timed/all-day conversions preserve the non-null/null rule; timed 1-hour and all-day previous-day 20:00 presets persist; saved timed and all-day reminders persist after reopen; disabling remains 不提醒 after reopen; recurring Events force 不提醒 and disable the other Reminder options; title-only/description-only edits leave start/end unchanged; ordinary schedule edits reopen correctly without Reminder anomalies; A-created-B-owned personal Events remain read-only to A and editable by B; shared CRUD, own personal CRUD, ordinary Event create/update/delete Realtime, and shared Reminder Realtime all pass.
- Historical ordinary Event browser coverage was N/A because Production had no pre-Slice-B ordinary fixture. This is not a failure: ordered-upgrade and Slice B pgTAP covered `historical reminder_kind = null`, `historical ordinary time_zone = null`, and no historical Reminder auto-enable. Timezone detection failure and seconds/milliseconds preservation remain automated semantic checks; the browser acceptance verified the visible schedule was not rewritten by title/description edits.
- Scope audit: no delivery table, claim function, sender, Cron, retry, recipient resolution, Push delivery, recurring Reminder delivery, dependency, deployment, commit, or push change.

### Slice 1 — Push Infrastructure Foundation

Local automated verification updated on 2026-09-19:

- Passed 29/29 Node tests across `tests/push-notifications.test.ts`, `tests/send-test-push.test.ts`, `tests/send-test-push-source.test.ts`, `tests/service-worker.test.ts`, and `tests/supabase-schema-push.test.ts`; the full repository suite passed 90/90.
- Passed `npm run build` (TypeScript project build plus Vite production bundle).
- Passed an Edge static/type check against the exact `@mmmike/web-push@1.3.0` package declarations. Sender diagnostics cover accepted 2xx, gone 404/410, rejected 401/403/429/5xx, and network/runtime failure while returning only upstream status, provider hostname, delivery flags, and a stable non-sensitive error code.
- Added `supabase/tests/2026-09-18-v0.1.8.1-push-infrastructure.test.sql` with 22 assertions for table/RPC structure, privileges, authenticated registration/upsert, endpoint ownership, current-installation disable, and isolation. Its local run is pending because the local Supabase database was unavailable; Production was not used as a substitute.
- The v0.1.8.1 Push Infrastructure pgTAP suite passed as part of the complete 98/98 local database regression run on 2026-09-20.

Real Push Infrastructure acceptance on 2026-09-19:

- **iPhone installed PWA — PASS:** notification permission, subscription, test push, delivery after returning to the home screen, and lock-screen delivery passed.
- **Desktop Chrome/macOS — PASS:** notification permission, local `Notification`, Service Worker `showNotification`, FCM upstream acceptance, and final test-push display passed. The diagnostic result was `status = 201`, `delivered = true`, `provider = fcm.googleapis.com`, and `gone = false`.
- **Desktop recovery evidence:** the initial browser subscription produced FCM acceptance but no displayed Push. Closing notifications, enabling them again, and creating a fresh subscription restored delivery. No evidence indicates a Push architecture, VAPID, Edge Function, or Service Worker blocker.
- **First-line Push recovery:** retry; unsubscribe/resubscribe; restart the browser/PWA. Escalate to deeper RCA only if these do not restore delivery or safe sender diagnostics show provider rejection.
- **Android deferred by validation strategy:** permission, subscription, foreground delivery, background delivery, closed-app delivery, notification click, and logout lifecycle will be validated together during final v0.1.8 cross-platform acceptance. This is not a blocker for Slice 2.

- Register a root-scope Service Worker that handles Push and notification clicks only; verify that it adds no offline cache or `fetch` caching behavior.
- Request notification permission only after an explicit user action. Cover granted, dismissed/default, denied, unsupported-browser, and iPhone-not-installed guidance.
- Persist subscriptions by `user + installation`, not by Space. Desktop and iPhone used independent installations; final Android multi-device coverage remains part of final v0.1.8 acceptance.
- Verify current-installation logout disables/unsubscribes that installation without disabling another device, and invalid/expired endpoints are retired safely.
- Desktop and iPhone diagnostic system-notification smoke passed. Android system-notification and lifecycle smoke is deferred to final v0.1.8 acceptance and does not block reminder-semantics work.
- Confirm this slice does not add Event reminder persistence, reminder scheduling, recurrence delivery, Email reminder delivery, SQL beyond subscription persistence, or offline caching.

### Slice 2 — Reminder Persistence + Ordinary Event Delivery

- Verify nullable `events.reminder_kind` accepts only `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder. Reject timed kinds on all-day Events and all-day kinds on timed Events after the visible conversion step.
- Verify nullable `events.time_zone` accepts canonical IANA timezone names rather than fixed offsets. New Events capture `Intl.DateTimeFormat().resolvedOptions().timeZone`; later device timezone changes do not silently rewrite existing Events. Recurring Events require equality with `recurrence_rule.time_zone`.
- Verify the database default and every historical Event remain `reminder_kind = null`, with historical ordinary `time_zone = null`; no migration guesses a timezone or enables notifications. Historical recurring sources may initialize `time_zone` only from their existing authoritative `recurrence_rule.time_zone`. Enabling a timezone-dependent reminder on a historical null-timezone Event captures the current device IANA timezone explicitly as part of that mutation.
- Verify new UI-created timed Events default to `timed_10m_before` and new UI-created all-day Events default to `all_day_same_day_08`; these are UI defaults, not database defaults.
- Verify at-start/10m/30m/1h use the effective absolute start and real-minute subtraction. Verify `timed_previous_day_same_time` preserves the same wall-clock time on the prior Event-local calendar day and reuses the existing recurrence gap/overlap policy rather than subtracting 1440 minutes.
- Verify all-day same-day 08:00 and previous-day 20:00 derive one canonical instant from effective Event date plus Event timezone, independent of receiving-device timezone. Confirm the current all-day representation safely supports this calculation before proceeding; do not add date-only storage or exclusive-end behavior in Slice 2.
- Verify timed-to-all-day keeps null or maps any non-null timed reminder to `all_day_same_day_08`; all-day-to-timed keeps null or maps any non-null all-day reminder to `timed_10m_before`. The final option must be visible before save.
- Verify multi-day timed/all-day Events use only their effective range start/first date; `ends_at` never creates daily, end, journey, or intermediate reminders.
- Verify start/date and preset edits update `reminder_schedule_changed_at` and derive a new current due; the old due naturally leaves the candidate path without mutation-time ledger maintenance. Title/description edits keep the marker and due unchanged. An already-sent reminder is not withdrawn, while moving an Event to a future due may create one new legitimate delivery.
- Verify create/edit/enable/preset changes whose newly derived due is past do not immediately Push or compensate. Verify approximately ten-minute grace applies only when an already-valid due was missed by infrastructure: 10:00 → 10:07 may send, while 10:00 → 10:30 skips; apply the same rule to all-day 08:00.
- Verify shared events resolve all current active Space members at send time, personal events resolve only `owner_user_id`, former members receive nothing, and members without active subscriptions naturally receive no device notification.
- Verify Reminder UI copy tells the editor that a shared Event reminder notifies current Space members.
- Verify ordinary one-off uniqueness on `(event_id, subscription_id, due_at)`, atomic current-state revalidation/claim, `reminder_schedule_changed_at` snapshot matching, and approximately one-minute normal scheduler precision. Do not pre-generate pending rows or mutate the ledger when an Event schedule changes.
- Verify Production best-effort delivery on Desktop, iPhone installed PWA, and Android installed PWA, including repeated Cron/Edge Function invocation, multi-device delivery, and no duplicate notification on the same subscription/due time. Provider failures and ambiguous timeouts are terminal failed results in this slice and do not enter an automatic retry framework.
- Confirm Email, SMS, Bark, multiple reminders, arbitrary custom minutes, per-user reminder preferences, snooze, sound customization, notification inbox/history, native alarms, multi-space implementation, and UI overhaul remain outside v0.1.8.

### Slice 3 — Recurrence Reminder Integration

Local implementation verification on 2026-09-22 — automated PASS; one reviewed projection blocker corrected; final human/code re-review PASS with no remaining findings:

- Passed focused recurrence/Reminder tests 46/46 and full repository Node regression 169/169. Coverage includes inherited reminders, effective-title and moved-in/moved-out overrides, newly-past marker behavior, delete/cutoff suppression, split projection, all-day same-day 08:00 and previous-day 20:00, canonical timezone, DST gap/overlap, a non-1h transition, collision-safe tags/identities, caps, ordinary delivery regression, UI inheritance/read-only behavior, and a daily Event whose duration spans more than 500 intervals. The long-duration test proves Reminder projection discovers the current due occurrence without mutating the source while canonical calendar expansion retains its existing duration-overlap guard behavior.
- Passed all six local pgTAP files, 199/199 assertions. Slice 3 adds 32 assertions for nullable occurrence identity, atomic claim ACL/search path, exact source/exception race rejection, membership/subscription checks, schedule marker, grace, idempotency, colliding due instants, and unchanged ordinary identity. Slice B now has 30 assertions including split Reminder/timezone inheritance and a fresh child schedule marker.
- Passed strict Deno checks for `send-reminders/logic.ts`, `send-reminders/recurring.ts`, `send-reminders/index.ts`, the canonical recurrence module, and the shared Web Push sender. Passed `npm run build` and `git diff --check`.
- The implementation imports the canonical `src/lib/recurrence.ts` engine; SQL does not expand recurrence. The bounded timezone/calendar window plus the complete capped exception set discovers moved-in overrides without materializing occurrences.
- Production, deployed Functions, scheduler, Vault/Cron/secrets, Push subscriptions, and Production data were not modified. Android final acceptance remains deferred and overall v0.1.8 remains OPEN.

## v0.1.7.3.3.2 Frontend Scope Integration

Passed locally on 2026-07-19:

- `node --test tests/recurrence.test.ts tests/event-edit-target.test.ts tests/event-edit-draft.test.ts tests/event-edit-mutation.test.ts tests/event-edit-ui.test.ts` (41 tests).
- Coverage includes ordinary-event route regression; occurrence only-this and this-and-future routes; final split/future-delete RPC parameter payloads; source all-day/rule/revision preservation; exactly two occurrence scopes and their copy; and projection of old/child split segments without a duplicate split date.
- The UI helper coverage now asserts save/delete action-chooser copy for both scopes; the sheet no longer renders a persistent scope control.
- `npm run build` and `git diff --check` passed.
- Refresh error propagation is implemented so EventSheet's awaited `onSaved()` path retains the sheet when either events or exceptions reload fails; initial-load and Realtime fire-and-forget callers handle the resulting rejection after the page error is set.
- Authenticated local UI smoke passed: only-this edit, this-and-future edit, only-this delete, this-and-future delete, and the save/delete action chooser.
- Local PostgREST cache recovery: database inspection confirmed `delete_occurrence_and_future(uuid, date, timestamptz)` already exists; a local `NOTIFY pgrst, 'reload schema'` completed and PostgREST logged a 15-function schema cache. The existing v0.1.7.3.3.1 patch was subsequently applied once to Production, its cache was reloaded, and the final RPC signatures/permissions were verified. No SQL file changed.

Production acceptance completed on 2026-07-19:

- Passed on Production Desktop and iPhone Standalone PWA: 「仅修改当前事件」、「修改当前及未来事件」、「仅删除当前事件」and「删除当前及未来事件」.
- Passed: the Production alias serves the v0.1.7.3.3.2 build and the recurrence action chooser retains the sheet until the selected mutation succeeds and refresh completes.
- iOS Standalone PWA cannot actively refresh itself. This is an iOS system limitation, not an application defect; the smoke scope verified the supported manual interaction flow.
- Deferred by product decision: `delete_logical_series` remains an available backend RPC but has no frontend entry point. Whole-logical-lineage deletion requires a separately approved UX and safeguard slice.
- Two-session Realtime and DST-zone behavior remain separate verification work. Recurrence-rule and all-day changes remain out of scope for occurrence edits.

## v0.1.7.3.3.1 Split RPC Correctness Patch

Passed locally on 2026-07-18. `supabase db reset --local --yes` resets the local Supabase instance but does not load this repository's `supabase/schema.sql`; the validated fresh bootstrap explicitly loaded that file through the local Postgres container. `schema.sql` is the latest complete bootstrap artifact, while `supabase/patches/*.sql` are ordered upgrades from an older database state.

- Standalone bootstrap: v0.1.7.1 foundation pgTAP 18/18; v0.1.7.3 series-editing pgTAP 30/30; total 48/48.
- Ordered upgrade from `e7decd1` bootstrap through v0.1.7.1, v0.1.7.3.1, and v0.1.7.3.3.1 patches: 48/48.
- Node recurrence/edit regressions: 34/34; `tests/supabase-schema-recurrence.test.ts`: 1/1; total 35/35. The schema test guards recurrence lineage, exception foundation, helpers, final RPCs, SECURITY DEFINER/search_path, and child `recurrence_until` inheritance.
- Passed: `npm run build` and `git diff --check`.

## v0.1.7.3.2 Frontend RPC Integration

Verified on 2026-07-18 with localhost:5175 connected to Production Supabase project `ximazjhxvmktpcdbypka` after the v0.1.7.3.1 patch and PostgREST schema-cache reload:

- Passed: opening a non-first recurring occurrence hydrates the sheet from the occurrence projection, including its own date and time rather than the source event baseline.
- Passed: editing title/time for one occurrence writes an only-this override; surrounding occurrences remain unchanged and the projection remains correct after refresh.
- Passed: deleting one occurrence writes an only-this deletion; surrounding occurrences remain and the projection remains correct after refresh.
- Passed: ordinary non-recurring event edit/delete regression.
- Passed: `node --test tests/recurrence.test.ts tests/event-edit-target.test.ts tests/event-edit-draft.test.ts tests/event-edit-mutation.test.ts tests/event-edit-ui.test.ts` (34 tests), `npm run build`, and `git diff --check`.
- Passed locally: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.3-series-editing.test.sql` (15 pgTAP assertions).
- Scope: only-this occurrence mutation only. Recurrence-rule and all-day controls are unavailable for an occurrence because the override RPC contract accepts only `title`, `description`, `starts_at`, and `ends_at`.

## v0.1.7.3.1 Series Editing Database RPC Foundation

Verified locally on 2026-07-18, then applied and structurally/RPC-verified on Production project `ximazjhxvmktpcdbypka` before the v0.1.7.3.2 authenticated smoke:

- Passed: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.3-series-editing.test.sql` (15 pgTAP assertions). Coverage includes only-this override/delete, source-timezone candidate validation, non-member denial, split cutoff/child lineage/no exception migration, stale `updated_at` rejection, and logical-series deletion of root, child, and exceptions.
- Passed regression: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql` (18 pgTAP assertions).
- Passed Production: preflight found the v0.1.7.1 prerequisites and no existing v0.1.7.3.1 RPCs; the reviewed patch was applied once, PostgREST schema cache was reloaded, and all four `SECURITY DEFINER` RPCs were recognized by PostgREST. Frontend only-this integration and authenticated smoke are recorded above; split and logical-series UI remain outside this slice.

## v0.1.7.1 Recurrence Exceptions Database Foundation

Implemented locally on 2026-07-18, pending database execution:

- Added pgTAP coverage for migration structure, deleted/override exception insert and update, exception delete, and member/non-member RLS behavior in `supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql`.
- Pending: run `supabase test db --local supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql` after a local Supabase/Postgres instance is configured and the additive v0.1.7.1 patch has been applied there. The 2026-07-18 attempt failed to connect to local Postgres; no linked or Production test was attempted.
- The pgTAP prerequisite `permission denied for table events` is addressed in `supabase/schema.sql` by policy-matched `authenticated` table grants. Re-run locally to verify that existing RLS policies, rather than missing base privileges, control access.
- Passed: `node --test tests/recurrence.test.ts` (17 tests), `npm run build`, and `git diff --check`.

## Current Smoke-Test Status

- Passed: local production build.
- Passed: Supabase schema, RPC, RLS, and Realtime validation.
- Passed: two-user desktop flow for space creation/join and event create/update/delete.
- Passed: v0.1.1 personal owner-only management and non-owner read-only details.
- Passed: direct API enforcement for personal events and immutable event identity fields.
- Passed: third-user capacity rejection and non-member RLS read/write isolation.
- Passed: iOS Safari layout and add-to-home-screen behavior.
- Passed: Android Chrome layout and creation of a home-screen shortcut.
- Passed: v0.1.2 Vercel Production deployment and first-round HTTPS smoke testing.
- Passed: desktop User A Production Magic Link, session restoration, shared/personal CRUD, and same-account two-window Realtime.
- Passed: iPhone Production page, logged-out layout, manifest/icons, add-to-home-screen, and home-screen launch.
- Passed: User B Production Magic Link login.
- Passed: two-account Production shared Realtime create/update/delete.
- Passed: two-account Production personal-event owner/read-only permissions and Realtime propagation.
- Passed: authenticated iPhone User B Production login, mobile layout, shared CRUD, and desktop Realtime propagation.
- Passed: v0.1.3 local production build.
- Passed: v0.1.3 real-browser shared/personal event form UX smoke test.
- Passed: v0.1.3 all-day functional regression.
- Passed: Android Chrome Production compatibility smoke test on Xiaomi 14 / Android 16.
- Passed: Android Chrome Magic Link login, session restore, event CRUD, Realtime, permissions, and PWA home-screen flow.
- Passed: Supabase keep-alive Cron registration, unauthorized 401 check, and first scheduled Production invocation with HTTP 200.
- Passed: v0.1.4 local TypeScript/Vite production build and diff hygiene.
- Passed: v0.1.4 Production Supabase patch, constraint/trigger/RLS verification, and local two-account desktop smoke.
- Passed: v0.1.4 deployed-frontend two-account Production desktop smoke, including member identity, owner permissions, CRUD, and events Realtime.
- Passed: v0.1.4 Production iPhone Safari browser smoke and Android Chrome/PWA smoke.
- Pending: v0.1.4 new-user first-login behavior and the safe single-member-space scenario.
- Passed: v0.1.5 local Email OTP acceptance for existing/new users, new-user space creation, member display-name update, and existing-session regression.
- Passed: v0.1.5 Production acceptance on Desktop, iPhone Safari, iPhone standalone PWA, Android Chrome, and Android PWA.

## v0.1.6.1 Recurring Events Foundation

Completed locally on 2026-07-17:

- Passed: `node --test tests/recurrence.test.ts` (10 tests). Coverage includes one-off projection, daily interval, weekly weekday selection and interval anchor, monthly numeric day and `last_day`, yearly date and leap day, invalid rule rejection, and the 500-candidate failure path.
- Passed: `npm run build` and `git diff --check`.
- Passed: static review confirms the new patch only adds nullable `events.recurrence_rule`, a recurrence validation function/trigger, and no RLS or Realtime changes.

Database acceptance completed against the linked Production Supabase project on 2026-07-17:

- Passed: preflight confirmed `recurrence_rule` was absent before migration; recorded baseline events triggers, four RLS policies, Realtime publication, and `FULL` replica identity.
- Passed: `supabase/patches/2026-07-17-v0.1.6.1-recurring-events-foundation.sql` applied successfully once.
- Passed: post-apply schema reports `events.recurrence_rule` as nullable `jsonb`; all four legacy events have `recurrence_rule = null`.
- Passed: existing `events_validate_owner` and `events_touch_updated_at` triggers remain, with only `events_validate_recurrence_rule` added. The four original RLS policies and `supabase_realtime` / `FULL` metadata are unchanged.
- Passed: rollback-only two-account RLS simulation: both members read/update a shared recurring event; the personal owner updates their event; the non-owner update affects zero rows. Final check confirmed no test events persisted.

Still required before UI integration or release:

- Verify live Realtime propagation of a committed `recurrence_rule` update between two separately authenticated subscribed clients. A 2026-07-17 automated attempt using two isolated email/password accounts stopped before subscription because Production requires email confirmation and issued no sessions. The temporary accounts were removed (zero temporary users/spaces remain). The database publication metadata alone is not end-to-end delivery proof; use two existing Email OTP-authenticated browser sessions for this check.
- Confirm timezone behavior in the supported browsers before claiming DST-zone support. No timezone dependency was added.

## v0.1.6.2 Calendar Integration

Completed locally on 2026-07-17:

- Passed: `CalendarViews` projects source `events` through `expandRecurringEvents()` for the active visible range before all Today, Week, and Month filtering/rendering.
- Passed: Today covers the selected local day, Week covers Monday through Sunday, and Month covers the full 42 visible grid cells. Existing duration intersection semantics remain applied to display occurrences.
- Passed: one-off source events project once; recurring display entries use `occurrence_id` keys and occurrence start/end values while source events remain the edit/delete identity.
- Passed: `node --test tests/recurrence.test.ts` (12 tests), including source-list projection and Today/Week/42-cell range construction; existing daily, weekly, monthly, yearly, range, and candidate-limit coverage remains green.
- Passed: `npm run build` and `git diff --check`.

Deferred by the v0.1.6.2 scope:

- No recurrence create/edit/delete UI, series-management copy, exception behavior, or single-occurrence operation has been added.
- Run the real two-client Realtime subscription check after recurrence UI is complete; source-row reload and re-projection are connected, but the prior authenticated-client transport checkpoint remains unobserved.

## v0.1.6.3 Recurrence UI Implementation

Completed locally on 2026-07-17:

- Passed: event-sheet recurrence controls serialize `null` for 不重复 and the supported v1 daily, weekly, monthly, and yearly shapes for source-event creates and updates.
- Passed: the browser timezone is obtained with native `Intl.DateTimeFormat().resolvedOptions().timeZone`; the existing rule parser rejects invalid interval, weekday, and yearly date combinations before the Supabase write.
- Passed: recurring source events are edited through the existing source ID. The sheet labels whole-series edit/delete behavior and has no single-occurrence, exception, or future-occurrence control.
- Passed: `node --test tests/recurrence.test.ts` (17 tests), including non-recurring/daily/weekly/monthly/yearly rule construction, saved-rule edit conversion, invalid selectors, source identity, range projection, and candidate limit behavior.
- Passed: `npm run build` and `git diff --check`.

Still required for final acceptance:

- Use two existing independently authenticated Email OTP browser sessions to create/edit/delete a shared recurring source event, confirm all rendered occurrences update as a series, and observe the second client receive/reproject the source-row Realtime UPDATE.
- Run the same recurrence form smoke on supported narrow iPhone Safari and Android Chrome/PWA layouts, including DST-observing timezone behavior before claiming that support.

## v0.1.5 Email OTP

Supabase SMTP and the passwordless email template are configured to deliver `{{ .Token }}` as 8-digit Email OTP codes.

Production acceptance completed on 2026-07-15:

- Desktop, iPhone Safari, iPhone standalone PWA, Android Chrome, and Android PWA Email OTP login passed.
- Existing-user and new-user OTP login passed; a new user created a shared space successfully.
- The existing `profiles` trigger and display-name editing behavior passed after OTP login.
- Existing-session restoration/regression passed.
- iOS standalone PWA login now completes in the standalone container through OTP input, removing the previous Magic Link return limitation.

Future observation: monitor Production email delivery, resend/cooldown/error UX, and session restoration during normal use.

## v0.1.4 Member Identity & Space Members

For an existing environment, do not rerun `supabase/schema.sql`. Execute `supabase/patches/2026-07-11-v0.1.4-member-display-name.sql` only once per environment.

Static SQL review completed locally:

- The patch transactionally blocks concurrent profile writes, converts whitespace-only names to `null`, trims valid legacy values, and truncates legacy non-empty values to 20 characters before the check constraint is added.
- The constraint permits `null` and otherwise requires a trimmed 1–20-character name.
- `handle_new_user()` inserts `display_name = null`; it no longer reads Auth metadata, email, or email prefixes.
- Existing `profiles_select_same_space` and `profiles_update_self` policies are unchanged. No profile/member Realtime publication or subscription is added.

Verified against the current Production Supabase project on 2026-07-11:

- The v0.1.4 patch completed successfully. The three existing profiles needed no whitespace cleanup, trimming, or truncation.
- `profiles_display_name_format_check` exists; the post-patch data check returned zero edge-whitespace, over-limit, and empty values.
- `handle_new_user()` now writes `display_name = null`, keeps `SECURITY DEFINER`, `search_path = public`, the trigger return type, and `on conflict (id) do nothing`; it no longer reads Auth metadata or email data.
- The existing profiles, space-members, and events RLS policies were confirmed unchanged.

Verified in a local two-account desktop smoke test on 2026-07-11:

- A and B entered the same two-member space and each saw the correct 「成员 · 2」 list, current-user marker, and self-only edit control.
- Name editing, trim behavior, local immediate refresh, and refreshed second-session display passed; A/B name labels remained correct in event cards, owner choices, and details.
- Today, week, and month labels showed the concrete personal owner name or 「共同」; no deprecated relative event labels appeared.
- Shared, A-owned personal, and B-owned personal creation passed. Non-owners remained read-only, owners managed their personal events, and either member managed shared events.
- Shared and personal events propagated through the existing events Realtime create/update/delete flow. Temporary smoke events were deleted successfully after verification.
- Same-name owner regression also passed: ownership and editability continued to use user IDs, not display names.

Verified against the deployed Production frontend on 2026-07-14:

- Two-account desktop smoke passed: header member count, member sheet, current-user marker, self-only name editing, local immediate update, refreshed second-session update, today/week/month labels, shared/personal CRUD, owner-only personal access, same-name owner regression, and events Realtime create/update/delete.
- iPhone Safari browser smoke passed. The standalone PWA can be added to the home screen and its non-login UI checks passed, but it keeps a separate session and Magic Links normally open Safari rather than returning to the standalone app. Standalone authenticated login is therefore not verified and remains an iOS platform/Auth UX limitation outside v0.1.4.
- Android Chrome smoke passed. Android home-screen PWA existing-session use, browser-Gmail Magic Link completion, narrow layout, keyboard, member UI, shared/personal flow, and events Realtime passed.
- Android Gmail native-App limitation: its Magic Link does not return to the PWA. This is a cross-app handoff limitation, not a v0.1.4 application failure.
- Non-blocking browser observation: native `datetime-local` controls follow browser/system locale (Chrome 24-hour vs Safari 12-hour presentation); stored and rendered event times were correct.

Still pending:

- New-user first-login behavior with a newly created Auth account.
- The single-member-space UI path, which was intentionally not tested by removing a real member.

## Android Production Compatibility

- Date: 2026-07-06.
- Device: Xiaomi 14.
- Android version: 16.
- Browser: Chrome.
- URL: https://cross-platform-shared-calendar.vercel.app/.
- Network: mobile network.
- Test accounts: User A on desktop, User B on Android.
- Production page opened successfully.
- Android Chrome Magic Link login passed.
- Login session restore passed.
- Today, week, and month views passed.
- Mobile layout passed.
- New shared event default end time equals start time plus 1 hour.
- New personal event default end time equals start time plus 1 hour.
- Changing start time updates the end time while the end time has not been manually edited.
- Manually edited end time is not overwritten by later start-time changes.
- Editing existing shared and personal events does not reset the stored end time.
- Shared Realtime create, update, and delete passed.
- Personal read-only permission behavior passed.
- User A creating a personal event for User B transferred management permissions to User B as expected.
- Android Chrome add-to-home-screen passed.
- Home-screen PWA launch passed.
- Creating and deleting events from the PWA synced to desktop through Realtime.
- Issues found: none.
- Note: Android Chrome initially reported that it was still adding a previous site to the home screen; restarting Chrome resolved it. This was treated as a browser state issue, not a project bug.
- Conclusion: Android compatibility smoke test passed, including the previously pending authenticated Android CRUD, Realtime, and PWA compatibility scope.

## Supabase Restore Minimum Smoke Test

Run this if the Supabase Free project is restored after an inactivity pause:

- Production page opens.
- Magic Link login works.
- Session remains available after refresh.
- Calendar data can be read.
- Shared event create, edit, and delete work.
- Basic two-client Realtime sync works.

## Supabase Keep-Alive

- Endpoint: `/api/supabase-keepalive`.
- Schedule: daily Vercel Cron at `0 3 * * *`.
- Auth: `Authorization: Bearer <CRON_SECRET>`.
- Data access: three sequential anon-key, head-only reads from `spaces`.
- Expected unauthorized result: missing or incorrect bearer token returns `401`.
- Expected local missing-env result: correct token without required Supabase env vars returns `500` without printing env values.
- Expected success result after env setup: `200` with `{ "ok": true, "checks": 3 }`.
- Success response must not include query rows, space IDs, user data, Supabase keys, or `CRON_SECRET`.
- Production verification on 2026-07-09:
  - Passed: Cron Job registered for `/api/supabase-keepalive` at `0 3 * * *`.
  - Passed: unauthenticated browser request returned `401 unauthorized`.
  - Passed: first scheduled Production invocation returned HTTP 200.
- Vercel Dashboard checks after deploy:
  - `CRON_SECRET` is configured for Production.
  - The deployment includes `/api/supabase-keepalive`.
  - Continue checking Cron Jobs and Function logs to confirm later invocations return HTTP 200.
  - Function logs should show success/failure only and must not print secrets or query data.
- Supabase follow-up:
  - Confirm the project remains Active after several daily Cron runs and over longer periods.
  - The first successful invocation does not prove that the project can never be paused.
  - If the project still pauses, reassess whether a dedicated read-only RPC or Supabase Pro is needed.

## v0.1.3 Event Form UX Defaults

- Confirm `npm run build` passes.
- Create a new shared event and confirm the default end time is the default start time plus 1 hour.
- Create a new personal event and confirm the default end time is the default start time plus 1 hour.
- Create a new event, change the start time before touching the end time, and confirm the end time follows the new start time plus 1 hour.
- Create a new event, manually change the end time, then change the start time, and confirm the manually chosen end time is not overwritten.
- Create a new all-day event without manually editing the end time and confirm there is no UI or save regression.
- Create or edit an all-day event after manually editing the end time and confirm the existing behavior of saving the user-entered end value is preserved.
- Edit an existing shared event and confirm the stored end time loads from the database and is not reset to start plus 1 hour.
- Edit an existing personal event and confirm the stored end time loads from the database and is not reset to start plus 1 hour.
- Confirm a non-owner personal event still opens as read-only, without save or delete controls.
- Confirm Realtime create, update, and delete propagation still works between two authenticated sessions.
- Confirm desktop local or Production smoke test passes.
- Confirm iPhone smoke test passes.

Verified in a real browser on 2026-06-24:

- New shared and personal events defaulted the end time to start plus 1 hour.
- New-event start changes kept the end time at start plus 1 hour until the end time was manually edited.
- After manually editing the end time, later start changes did not overwrite the end time.
- Existing shared and personal events kept their original end times when opened for editing.
- Non-owner personal events remained read-only.
- Realtime create, update, and delete continued to work.
- All-day functional regression passed; no UI or save abnormality was observed. Database-field behavior was protected by the save-payload logic, but this manual pass did not separately inspect the stored database field.

## v0.1.2 HTTPS Production

- Production URL: https://cross-platform-shared-calendar.vercel.app/
- Vercel deployment completed successfully.
- Confirm the Production page loads without a Supabase configuration error.
- Confirm `VITE_SUPABASE_URL` uses only the Supabase project base URL ending in `.supabase.co`; it must not contain `/rest/v1/`.
- Supabase Auth Site URL is configured to the Production URL.
- Redirect URLs include the Production URL with and without a trailing slash.
- Local redirects currently include `http://localhost:5175`.
- `http://192.168.10.6:5175` is retained only as a temporary LAN phone-test redirect, not as a stable deployment address.
- Verified desktop User A Magic Link login, logout, repeat login, and session restoration.
- Verified the post-login URL remains on the Production domain; an empty `/#` is acceptable.
- Verified User A shared event create, update, and delete operations, including correct state after refresh.
- Verified User A personal event create, update, and delete operations.
- Verified Realtime create, update, and delete propagation between two browser windows using User A.
- Verified `/manifest.webmanifest`, `/icons/icon-192.svg`, and `/icons/icon-512.svg` are accessible.
- Verified iPhone Safari can open the Production URL.
- Verified the app can be added to and launched from the iPhone home screen.
- Verified the logged-out iPhone layout displays the email login entry point correctly.
- Verified User B can log in to the Production URL via Magic Link from an incognito window and reach the calendar page.
- Verified A and B pages both remain normal after B login and show the same invite code, confirming they are in the same shared space.
- Verified two-account shared Realtime:
  - A creates `ab realtime create test`; B sees it without refreshing.
  - B edits it to `ab realtime edit test`; A sees the update without refreshing.
  - B deletes it; A sees it disappear without refreshing.
- Verified A-owned personal permissions and Realtime:
  - A creates `a personal readonly test`; B sees it without refreshing and it is labeled as the other person's event.
  - B opens it read-only, with no save button, no delete button, and non-editable title/time fields.
  - A edits it to `a personal owner edit test`; B sees the update without refreshing.
  - A deletes it; B sees it disappear without refreshing.
- Verified B-owned personal event creation from A's session:
  - A creates `b personal ownership test` as a personal event belonging to B.
  - B sees it without refreshing and it is labeled as mine.
  - A sees it as the other person's event and can only open it read-only, with no save/delete controls.
  - B can edit and delete it as owner.
  - After B deletes it, A sees it disappear automatically.
- Verified authenticated iPhone Production flow:
  - iPhone logs in with User B and ends on the Production domain.
  - iPhone reaches the calendar page with normal mobile layout.
  - iPhone B creates `iphone shared test`; desktop A sees it without refreshing.
  - iPhone B deletes it; desktop A sees it disappear without refreshing.
- Pending: authenticated Android CRUD because the Android device is temporarily unavailable.

## Local Build

- Run:

  ```bash
  npm run build
  ```

- Expected result: TypeScript and Vite production build pass.

## Local Development Server

- Run:

  ```bash
  npm run dev
  ```

- Expected result: Vite starts on fixed port `5175`.
- Browser acceptance testing should open `http://127.0.0.1:5175`.
- `http://localhost:5175` is also valid for desktop local testing.
- Do not use Vite's default `5173` port for this project.
- The dev script uses `--strictPort`, so startup should fail instead of falling back to another port when `5175` is occupied.

## Supabase Schema

- Execute `supabase/schema.sql` in the Supabase SQL Editor.
- Confirm tables, indexes, triggers, RLS policies, and RPC functions are created.
- Confirm RLS is enabled for `profiles`, `spaces`, `space_members`, and `events`.
- Confirm `public.generate_invite_code()` can create a code without a `gen_random_bytes` lookup error.
- Confirm PostgREST can query `space_members` with `profiles(display_name)` through the direct profile foreign key.
- Confirm `public.events` is included in the `supabase_realtime` publication.
- Confirm `public.events` uses `replica identity full` so filtered DELETE events include `space_id`.

For an existing environment, do not rerun the full schema. Before applying the v0.1.1 patch, run this preflight query:

```sql
select id, space_id, scope, owner_user_id
from public.events
where (scope = 'shared' and owner_user_id is not null)
   or (scope = 'personal' and owner_user_id is null);
```

- Expected result: zero rows.
- If any row is returned, stop and inspect the data before applying the patch.
- When preflight passes, execute `supabase/patches/2026-06-20-v0.1.1-personal-permissions.sql`.

## Magic Link

- Configure Supabase Auth redirect URLs for local development and deployment domains.
- Request a Magic Link from the login page.
- Open the email link on desktop and mobile.
- Confirm the app restores the Supabase session after redirect.

## Two-User Flow

- User A creates a shared space.
- User A copies the invite code.
- User B joins with the invite code.
- User A creates, edits, and deletes an event.
- User B creates, edits, and deletes an event.
- Confirm both users can see shared updates.
- Keep User B open while User A creates an event, and confirm it appears without refreshing.
- Delete the event in User B's session and confirm it disappears from User A's session without refreshing.
- Confirm "我的", "对方的", and "共同的" labels render correctly from each user's perspective.

## Personal Event Permissions

- User A creates a personal event owned by A.
- User B can view it and open a read-only detail sheet.
- User B does not see save or delete controls.
- The read-only detail sheet remains fully visible or scrollable within the viewport on desktop and mobile.
- User A can edit and delete it.
- User A creates a personal event owned by B.
- User A can only view it after creation; User B can edit and delete it.
- Either member can edit and delete a shared event.
- Allowed edits and deletes continue to propagate through Realtime.

## Direct API Permission Checks

- As User B, attempt to update and delete a personal event owned by User A.
- Expected result: RLS rejects the operation or affects zero rows; the stored event remains unchanged.
- As an authorized event manager, separately attempt to change `space_id`, `created_by`, `scope`, and `owner_user_id`.
- Expected result: the event validation trigger rejects each identity-field change.
- Verified on 2026-06-21: non-owner personal UPDATE/DELETE affected zero rows; all four identity-field updates raised the expected trigger errors.

## Space Capacity

- User C tries to join the already full space.
- Expected result: the join RPC returns a clear error and User C is not added.

## RLS Isolation

- A non-member attempts to read spaces, members, and events.
- Expected result: non-members cannot read or modify private space data.

## Mobile Browsers

- Test on iOS Safari.
- Test on Android Chrome.
- Confirm login, onboarding, event creation, event editing, event deletion, and calendar navigation work on narrow screens.

## PWA

- Open the app on mobile.
- Add it to the home screen.
- Launch from the home screen.
- Confirm the app opens with standalone PWA presentation where supported.
