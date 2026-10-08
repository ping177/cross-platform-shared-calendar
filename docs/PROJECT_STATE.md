# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.19

## Current status

v0.1.19 Task Due-date Push Reminder `CLOSED / PASS`。实现/自动验证、Production SQL/postflight、send-reminders ACTIVE v4、frontend 发布对齐、本地及 Production/installed-PWA 用户人工验收均 PASS。用户确认 2026-10-07 晚间真实 Task Push 成功，接受为最终人工 PASS；最小只读后台证据及其限制见 TESTING。治理收口完成，最终 REMOTE_SYNCED 只由最后一次获授权 push 后的实时 Git 验证建立。暂无明确阻塞。

## Latest completed

2026-10-08 — v0.1.19 Final Closeout：记录用户 Production/installed-PWA 与 10-07 晚间真实 Task Push PASS。只读晚间窗口核验：1 Task / 3 subscription ledger rows 均 sent/delivered/2xx，identity duplicate groups=0，360/360 Cron succeeded；历史 HTTP response 未保留，不虚构设备逐项展示或逐次 HTTP 证据。修正 stale publication/Next Action，版本 CLOSED / PASS；只改治理文档，独立 docs commit，本轮不 push。下一阶段先阅读用户将提供的其他项目 lessons learned，再评估 PWA 手势交互体验；不预设方案/版本号，Market Validation / Commercialization Study 保留但不启动。

2026-10-07 — 已获授权的正常 main push 成功至 9f30f5e；live remote/HEAD/origin/main 一致、0/0、clean。Vercel Production deployment 4in5dLHFYnz4WJC2KbNQjuAEXgsg 成功对应该 revision；root/JS/CSS/manifest/SW HTTP 200、Supabase target 正确；公开 bundle 差异定位为既有 Push 公共配置分支。停在用户 Production/PWA 最终验收点。以上是已完成发布记录，不代表本次尚未 push 的 docs closeout 已 REMOTE_SYNCED。

以下 2026-10-07 pre-deploy 及本地实现描述为历史检查点，由上述最终验收接续。

2026-10-07 — 用户报告 v0.1.19 本地 authenticated pre-frontend acceptance 全部 PASS：历史 null、新建 defaults/presets、canonical 保存/重开、due 编辑/删除、complete/reopen、recipient 文案、双账号基础回归及窄屏控件。Project State freshness review 更新治理记录；最终检查见 TESTING/DEVLOG。本地人工 PASS 不等于 Production installed-PWA 或真实 Task Push PASS。

2026-10-06 — v0.1.19 backend 按两次独立授权上线：exact Task SQL 原样应用/postflight PASS；仅 send-reminders 从 ACTIVE v3 部署为 ACTIVE v4，verify_jwt=false，唯一 minute scheduler/目标、secrets 未变。部署后自然 runs 20082–20084 succeeded / HTTP 200 / completed；runtime Error/Warning 无记录，Task RPC ACL/历史 ledger/旧 Event 与 Important Date compatibility PASS。Task candidate=0，仅 backend/scheduler compatibility PASS。frontend target 与 clean implementation HEAD 对齐后启动本地 5175，由用户验收。

以下 v0.1.19 LOCAL ONLY / 未部署描述是已由上述 rollout/验收接续的历史实现检查点。

2026-10-05 — v0.1.19 sender / TaskSheet integration：复用单一 reminder pipeline、Task recipients/opaque tag/pre-send 和既有表单，新建 due 默认08:00、历史 null、IANA capture、无 due关闭完成。Node 753/753、focused 258/258、Deno checked54/runtime48、TypeScript/build/diff-check、unsigned 320/375px PASS。既有 Event/Important Date 行为保持；无 Production write/部署/push。详细证据见 TESTING/DEVLOG。

2026-10-05 — v0.1.19 persistence/backend：Task 三字段与 server marker、历史 null compatibility、task_id ledger、Task candidate/claim/check、Tasks toggle Space locking 已完成。Fresh/upgrade catalog/ACL parity、17 SQL suites / 935 assertions per path、40 observed waits per path、实际 RPC 1000/1001 分页 PASS。详细证据见 TESTING/DEVLOG。无 Production/main DB write。

2026-10-05 — v0.1.18 最终 closeout：用户最终人工回归 PASS，T1/T2/T3/T4、Slice 3 与整个版本 CLOSED / PASS。保留 T4 projection/retention、P0a Calendar Event retention、P0b fresh Task actions 与阶段性 cleanup；最终完整 diff review、聚焦/全量 Node、build、diff-check 与 Project State Push Gate 用于发布核验，结果见 TESTING/DEVLOG。下一步产品工作单独定范围；没有新功能、backend/schema/RPC/依赖修改或额外 Production/PWA 专项测试。

以下均为历史实现/验收检查点，旧 IN PROGRESS、NOT STARTED、UX OPEN、manual pending、navigation handoff 描述仅反映当时状态，由上述最终 closeout 接续；不代表当前待办。

2026-10-05 — 当前已实现模块阶段性 cleanup：确认旧 handoff `.open` 无生产入口后，删除 controller、App wiring、完整 Important Dates navigation-only 分支与旧导航 tests；identity/request 类型移入活动 target hook。保留 Home/Calendar direct Sheet、full-module CRUD/快照、shared exact reader/editor、权限/request guards。重要日 retained refresh 改为轻量更新文案；Event/Task 补 Escape/Tab/初始焦点/关闭恢复，重复 Event chooser 保留范围语义；普通 Event 垃圾桶增加确认。Save→close lifecycle 与 Task/Important Date delete confirmation 保持。T4 Important Date functional + retention UX PASS、P0a manual PASS、P0b local automated PASS；本轮自动验证与隔离真实 React/小屏证据见 TESTING。停在统一最终人工回归；不是永久完成的产品全局审计。Slice 3 IN PROGRESS，无 Git 发布/部署/Production write。


历史 P0b 自动检查点（由上条阶段 cleanup 接续）— 2026-10-05 用户确认 Calendar Event P0a manual PASS。Tasks P0b：新 filter 首次失败进入 error/retry，仅当前 filter/scope 的安全展示可保留为 ready + refresh error；旧 data 仅供 selector。完整 Tasks Sheet 与 complete/reopen 共用一个 exact canonical qualification；fresh status/负责人检查、conditional status UPDATE 与 auth/scope/filter generation guards 拒绝 stale writes，成功后仍 canonical reread。Home Task、Calendar、Task 排序/Realtime/full snapshot contract 未修改。33 项新测试、相关 168/168、全量 739/739、build/diff-check 与隔离真实 React/375/320px PASS；用户人工复测尚未完成。P1 未实施；Slice 3 IN PROGRESS，无 Git 发布或 Production 操作。详情见 TESTING。

历史自动检查点（后续用户 manual PASS）— 2026-10-05 P0a Calendar Event validated presentation retention：CalendarApp 一个独立 session-local slot，仅当前范围的展示字段/identity/member labels；同 user/member-role/filter/view/range/timezone 暖返回和 mounted refresh 保留内容，失败保留并重试，冷进入不变。当前 canonical source/exception read 与 Event Realtime read-loop 保持；retained click 等待当前完整 reconciliation，以 fresh occurrence 进入 EventSheet，失权/删除/移出范围不能开 stale editor。Important Date projection/retention 未修改。用户 Important Date functional + retention UX PASS；Event 本轮 local automated PASS，真实用户复测待完成。Task P0b、P1 cleanup 尚未实施；无 Git 发布、deploy 或 Production write。验证见 TESTING。


历史 2026-10-04 自动实现检查点（已由用户 retention UX PASS 接续）— T4 Calendar Important Date retention / safe range transition：一个独立 App-owned session-local latest validated slot；同范围立即恢复，换范围仅展示已验证交集并明确未完整确认，成功 canonical read 才替换 slot（包括 empty），失败保留安全展示并重试。既有 App Space gate 窄扩展；confirmed auth/member/role/module/Space/filter/timezone loss 清除；exact target/editor 与 pre/post qualification、分页、StrictMode guard、Event/Home/full-module/Reminder 均保持。功能人工验收 PASS，UX OPEN / RE-TEST REQUIRED；自动验证结果见 TESTING。无 commit/push/deploy/Production write。

此前首次自动实现检查点 — Slice 3 T4 Calendar projection `LOCAL AUTOMATED PASS / READY FOR MANUAL ACCEPTANCE`（已由上条功能验收与 retention UX 检查点接续）：T1 bounded today/week/42-cell civil projection 与 T3 exact target/editor 复用；独立错误/重试、Space filter/eligibility、canonical edit/delete 重投影与 Calendar 原地 Sheet 完成，Event 模型/排序/Realtime、Home retention/T2/Reminder 保持。T4 20/20、focused 198/198、regression 521/521、final full Node 652/652、build/diff-check PASS；375/320px unsigned static geometry 12/12 PASS。READ-ONLY development/build target 与 backend canonical14/RLS/CRUD/Reminder compatibility gate PASS，无新 backend contract。无 commit/push/deploy/Production write；用户 T4 authenticated/device acceptance NOT RUN。整体/Slice 3 IN PROGRESS；final audit 与最终 Production/PWA acceptance 尚未执行。详情见 [Testing](./TESTING.md)。

2026-10-04 — v0.1.18 Slice 3 T3 `CLOSED / PASS`：用户已报告 Home 三区域、无 Loading 暖返回、原地 own-object Sheet 与 Important Date top3/排序/Space/删除补位/开关恢复/edit/Reminder/delete/close/view-all/basic mobile 全部 authenticated local acceptance PASS。累计 HEAD→worktree 的 code/test/governance final review PASS；Home presentation slots 与 fresh action authority 分离，既有 Event/Task Realtime canonical reread、T1/T2/full-module/Reminder 保持。重新验证 focused 205/205、regression 501/501、full Node 632/632（无 skips）、build/diff-check PASS，仅既有 bundle warning。T4 NOT STARTED；deferred final audit 与最终 Slice 3 Production/PWA acceptance 尚未执行。具体历史实现/验证证据见 [Devlog](./DEVLOG.md) / [Testing](./TESTING.md)。

前轮 Important Date real click latency fix `LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST`：用户 Home 三区域 return UX PASS，Important Date 点击仍感觉慢；审计确认 target 等待全局四模块 availability。现仅解耦 transient pending 的启动/失效/操作 gate，保留 confirmed target scope/user/request identity、全部 exact qualification/CRUD authority，并用 microtask/ticket 抑制 StrictMode 重复启动。Handoff 39/39、focused 83/83、regression 472/472、full Node 603/603、build/diff-check PASS；受控 400ms Review 延迟已从 target 关键路径移除，非真实速度验收。T3 完整 authenticated acceptance 未 PASS，T4 NOT STARTED；无 backend/架构/Production 或 Git 发布变化。详情见 [Testing](./TESTING.md)。

前轮 Home Task / Important Date object-open latency optimization 检查点 `LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST`：用户确认 Home 三个区域返回均不闪 Loading，Event/Task 打开正确。Task 保留 2 Auth/3 DB，DB 三项并行；Important Date IDs-only handoff 由单一 exact target reader 取得完整 14 fields，post-source 当前 membership/role/module/Space 与 Auth/generation 复核后进入既有 Sheet，不等待完整列表。完整模块独立 canonical load，不将 singleton 存为完整 snapshot，不抢先打开或替换 draft；失权消费一次并 bounded recovery，未知失败保留 exact retry，真实 session loss 与后台 Auth transport failure 分开。CRUD/Reminder helpers、Event click/main Calendar 与已有 Home/full-module snapshots 保持。95/95 focused、451/451 regression、592/592 full Node、build/diff-check PASS；40ms 受控诊断 Event 3.3ms、Task 124.5ms、Important Date 164.7ms（非 Production benchmark）。Target 6 prerequisite reads/4 stages，后台模块另 8 reads；无 backend/依赖/Realtime/store/cache 或 Git 发布。Home 完整人工验收未结束，T4 NOT STARTED，Slice 3 IN PROGRESS。详情见 [Testing](./TESTING.md)。

前轮 retention 检查点：Home Event/Task existing validated-view retention fix `LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST`：用户已确认 Important Dates return UX PASS。本轮 CalendarApp 增加两个独立 session-local feature slots：Event 仅保存 user/member-role/day/timezone/range-bound 展示字段与 identity/source label；Task 保存完整 Home qualified rows/members 与 eligible scope，独立于完整 Tasks module snapshot。安全暖返回立即展示，后台 canonical 替换；失败保留内容并提示更新失败/重试，冷进入不变。Retained Event 等待当前完整 occurrence/member read 后才进 EventSheet；Task exact open reread 保留，quick complete 先 fresh qualification/current-user check，再按 open 条件写入。Scope/auth/day/range/confirmed module/lifecycle 与 A→B→A guards 覆盖；原 Event/Task read-loop/Realtime/cleanup 保持。独立读取安全并行，分页/exceptions/all-or-nothing 保持。Focused 106/106、regression 394/394、full Node 574/574（无 skips）、build/diff-check、375/320px 静态 geometry 4/4 PASS；既有 bundle warning。保留 Important Dates latency/retention/T1/T2/Reminder 与完整模块 snapshot 契约，未改主 Calendar business-content retention。无新 backend/依赖/Realtime 架构、Production write 或 Git 发布；Home 整体人工验收未完成，T4 NOT STARTED，Slice 3 IN PROGRESS。详情见 [Testing](./TESTING.md)。

前轮 Important Dates validated-view retention 检查点：49/49 focused、299/299 regression、548/548 full Node、build/diff-check PASS；此后用户真实 return UX 复测 PASS，完整 Home 验收仍由本轮后续复测完成。

上一轮 latency B/C 检查点（由上条 retention 修复接续）：`LOCAL AUTOMATED PASS / READY FOR MANUAL RE-TEST`。仅并行独立 annual/non-repeat 候选读取，并用现有 generation 抑制 StrictMode/same-turn 已过期 mount work；4 次 getUser、pre/post fresh qualification、完整分页、fail-closed/global top 3 均保留。Focused 33/33、relevant 299/299、full Node 538/538、build/diff-check PASS；受控 actual App/transport comparison，非真实网络 benchmark。该检查点尚未提供跨 unmount 展示保留；其后用户 loading flash feedback 与修复见上条。详情见 [Testing](./TESTING.md)。

T3 首次 local closeout 检查点（后续 latency RCA/修复见上条）：v0.1.18 Slice 3 T3 `CLOSED / LOCAL AUTOMATED PASS / AWAITING AUTHENTICATED ACCEPTANCE`：Home 第三个独立轻量区域复用 T1 bounded reader/projection/presentation 与现有 Emoji/icon；fresh zero-eligible 隐藏、confirmed empty/独立 error/retry，global top 3。标题/查看全部使用现有模块导航，单条通过 T2 IDs-only handoff canonical reread 打开原 Sheet；返回重新挂载读取，save/delete 更新与补位已验证。会员/角色/module hints 只作 invalidation，focus/visible/online/retry/civil-day rollover 与 generation/unmount guards 保持。Focused 10/10、regression 294/294、full Node 533/533、build/diff-check PASS；375/320px 普通/长内容静态 geometry 4/4 PASS。Final correctness/complexity review 与重新验证 PASS；真实账号/PWA acceptance 与环境对齐 gate 尚未运行，无部署或 Production 操作，T4 NOT STARTED。详情见 [Testing](./TESTING.md)。

v0.1.18 Slice 3 T2 `CLOSED / LOCAL AUTOMATED PASS`：完整八文件 final correctness/complexity/security review 与重新验证 PASS。IDs-only handoff 通过 fresh eligibility + canonical module reread 打开自己的既有 Sheet/CRUD/Reminder；confirmed target loss 当前 generation 消费，真实失败保留 exact identity retry，remaining module recovery 最多一次额外读取，零 eligible 沿用 Hub safe exit。A1→B→A2 stale read/loss/save/delete 不污染新 interaction；普通入口和 session restore 保持。Focused 24/24、相关 Node 255/255、full Node 523/523、build/diff-check PASS。T2 closeout 时 T3/T4 NOT STARTED，Home/Calendar projection UI 尚未接入；当前 T3 进展见上条。无 backend/依赖/Realtime/Production 或部署变化。详情见 [Testing](./TESTING.md)。

v0.1.18 Slice 3 T1 `CLOSED / LOCAL AUTOMATED PASS`：专用 Home annual 完整分页 + 每 Space future non-repeat 前三、Calendar visible civil-range 候选读取、canonical resolver 纯 occurrence 派生及 feature-specific request lifecycle 完成。资格前后复核、incomplete/error fail closed、scope/range/user 与 A→B→A stale suppression 均覆盖；新增 24/24、相关 Node 127/127、full Node 499/499、build/diff-check PASS。未接 Home/Calendar UI、点击/导航或 Event editor；无 SQL/backend/依赖/Realtime/Production 操作；用户实现报告审核与 final diff review PASS，T1 已 commit 并 REMOTE SYNCED；T1 closeout 时 T2/T3/T4 NOT STARTED，当前 T2 进展见上条。详情见 [Testing](./TESTING.md)。

v0.1.18 Slice 2 — Date-level Push Reminder `CLOSED / PASS`：T1/T2A/T2B/T3/T4 实现、自动验证、所需 Production rollout/postflight 与 local/auth acceptance 已通过；用户确认真实 Production / installed PWA Push E2E PASS（Shared 当前成员正常收到一次、无重复、不提醒不发送）。已验收 Production frontend exact commit `5222b432528bfc60e6fd0a311382b0def94dcef0`，integrated send-reminders ACTIVE v3 / verify_jwt=false，原单一每分钟 scheduler 保持不变。Active-view Realtime deferred，非 blocker；该 closeout 检查点下一步为 Slice 3 READ-ONLY gate，其后 T1 本地实现见上条。详情见 [Testing](./TESTING.md)。

v0.1.18 Slice 2 T4 authenticated local acceptance 1–4 `USER PASS`；唯一发现的两个 select 箭头贴边问题已完成 bounded polish，复用已有 ChevronDown 12px 右 inset / 40px 文字 padding。UI/flow 22/22、full Node 475/475、build/diff-check、375/320px create/edit 静态复核 PASS。该 polish 检查点真实 Push E2E 尚待；其后 Production/PWA 验收与 Slice 2 closeout 见上条。

v0.1.18 Slice 2 T4 `LOCAL PASS` / `V018_SLICE2_T4_LOCAL_READY_FOR_AUTH_ACCEPTANCE`：现有 Important Date Sheet 复用 all-day 三 preset；新建默认当天08:00，历史 null 编辑保持不提醒，name/Emoji-only edit 保留 preset/raw marker，Shared 共用对象设置且编辑不迁移 Space。Reminder-aware CRUD 使用已部署 overload；省略 reminder 的旧调用仍兼容，失败不 fallback 或假保存。Canonical reread/confirmed-return 与既有权限 gate 保留。Focused Node 151/151、full 475/475、build/typecheck、diff-check PASS；375/320px 无登录静态 fixture geometry 4/4 PASS。Local/build target 与 Production catalog/RPC/ACL、ACTIVE v3 只读对齐 PASS。该本地实现检查点未 push/deploy；其后用户 authenticated local acceptance 1–4 PASS，箭头 polish 与 Production/PWA checkpoint 见上条。详情见 [Testing](./TESTING.md)。

v0.1.18 Slice 2 Production backend rollout `PASS` / `V018_SLICE2_BACKEND_READY_FOR_UI`：T2A → T2B 两份 exact forward patches 各原样应用一次并通过独立 READ-ONLY postflight；integrated send-reminders 单次部署成功，返回与独立读取均为 ACTIVE v3 / verify_jwt=false。既有单一每分钟 scheduler、command/config/120000ms timeout 未修改；部署后两个自然 Cron/HTTP runs succeeded / 200 / completed，无 scan/runtime/finalize 错误。Catalog/RPC/ACL、旧 Event claim、12 条历史 ledger 和业务数据 fingerprints 不变，无 claimed/failed/duplicate/retirement。完整 source graph 与 92786b2… 一致，cached Deno check PASS。该窗口无到期发送任务，不代表真实 Important Date Push 验收；该 rollout 检查点 UI/publication 未开放；其后 T4 实现与验收见上条。详情见 [Testing](./TESTING.md)。

v0.1.18 Slice 2 T3 `CLOSED / PASS`（本地）：Important Date 明确 source 分支已接入既有 sender pipeline，复用 T1/T2A/T2B、current recipients/subscriptions、50-task/5-worker/95s 共用预算、pre-send check 与 retirement/finalize。任一 source scan/exception scan overflow 或 incomplete 均在 claim/send 前中止。Mixed 18/18、真实 entrypoint 拦截测试 1/1、full Node 465/465、Deno checked 43/43 + legacy runtime 48/48、完整 Edge Deno check、Event baseline differential 15/15、build/diff/complexity review PASS。此本地实现检查点未操作 Production/UI；其后 Production rollout/postflight 见上条。详情见 [Testing](./TESTING.md)。

v0.1.18 Slice 2 T2B `CLOSED / PASS`（本地）：source-specific claim、锁后 eligibility/clock 重验、绑定 claimed ledger 的 pre-send check 和未接 sender 的窄 RPC adapter 已完成。Fresh/5d5cfdc upgrade 完整 catalog/ACL parity、历史 rows/旧函数不变；每路径 881 SQL assertions、144 canonical occurrence 对照、32 实际锁等待竞态 PASS。Focused Node 128/128、full 445/445、Deno check、build、diff-check 与 complexity/security review PASS。无 Event regression；未接 orchestration/UI，未操作 Production。T3 无前置 blocker，Reminder publication 保持关闭。详情见 [Testing](./TESTING.md)。

v0.1.18 Slice 2 T2A `CLOSED / PASS`（本地）：ledger source identity、窄 service-role candidate RPC、兼容旧签名的 reminder-aware CRUD overload 与独立 forward patch 已完成。Fresh/ead7a211 upgrade 完整 schema/ACL parity、历史 rows/旧 claim 不变、每路径 834 SQL assertions、1000/1001 分页/微秒 marker PASS；focused Node 134/134、full 442/442、build、diff-check 与 complexity review PASS。未做 claim/pre-send/send/UI/Production；T2B 无前置 blocker，Reminder publication 仍关闭。详情见 [Testing](./TESTING.md)。

v0.1.18 Slice 2 T1 `CLOSED / PASS`（本地）：抽出 shared all-day civil-date due helper，Event 路径继续委托；新增复用 canonical Important Date resolver 的 bounded occurrence adapter。Focused 120/120、full Node 437/437、baseline Event differential 1,280/1,280、T1 Deno check、build、diff-check PASS；complexity/diff review PASS。无 SQL/ledger/claim/orchestration/UI 或 Production 变化；Slice 2 尚未具备发送能力，publication gate 保持关闭。详情见 [Testing](./TESTING.md)。

v0.1.18 Slice 1 `CLOSED / PASS`：用户确认 authenticated Important Dates CRUD、权限、日期规则、module toggle、public Production alias 和真机 annual layout 验收 PASS。375px PASS；320px 仅按钮换行且无重叠、截断或横向溢出，不再扩展该范围。Shared 成员编辑后停留页面不会立即刷新，重进 canonical reread 正常；符合冻结 no-Realtime 设计，active-view Realtime refresh 保留为 deferred enhancement，不是 blocker。自动验证及 backend readiness 证据见 [Testing](./TESTING.md)。v0.1.18 整体仍 IN PROGRESS。

v0.1.18 Slice 1 Production backend `READY` / `V018_SLICE1_BACKEND_READY`：exact Task 2 foundation patch（SHA-256 `f9f61bb50b6cb7222a6ec781fc4c6e687397e0e99a47888de6c0105f17a19de2`）原样 transactional 应用一次，HTTP 201。新 table/constraints/triggers/member SELECT RLS/ACL、3 个 CRUD RPC/private helpers 和 owner toggle 扩展的只读 postflight PASS；该 postflight 时 Important Dates/module rows 均为 0。旧 14 tables / 61 function signatures / 27 policies 的 catalog 前后一致；仅 reviewed 新对象与 toggle 变化。未自动开启模块、写 fixture、改历史 migration 或进行 frontend release/authenticated acceptance；详细证据见 [Testing](./TESTING.md)。

v0.1.18 Slice 1 Task 4 `PASS`：Important Dates 功能中心入口、owner-only Space toggle、严格 user-scoped navigation/session restore、App bounded wiring 及 Task 3 page 挂载已完成。同账号/成员角色/eligible scope 的内存视图可保留 filter/Past 并进行 canonical reread；unknown/disabled/removed scope 不赋予操作权或 target fallback。Shared Space 两步删除文案准确列出日程、任务、回顾、清单、重要日，lifecycle 语义不变。Focused 84/84、Node 423/423、build、diff-check PASS；无 Reminder UI、Projection、Realtime 或 Production 操作。详细证据与集成验收 gate 见 [Testing](./TESTING.md)。

v0.1.18 Slice 1 Task 3 `PASS`：Important Date types/adapter、完整分页、独立 Space filter、模块页面、显式 target create/edit/confirmed hard delete、日期派生展示及 guarded canonical reread 已完成。复用 Task 1 date contract 与 Task 2 frozen CRUD RPC；Shared current member 可 CRUD，编辑不迁移 Space，失效 target 不 fallback，Past 默认折叠，无 Reminder UI。Focused 53/53、Node 410/410、build、diff-check PASS；Task 3 commit `6de2cd16bc6b6b9e8eb2ead83eb8b9c4058624ef` 已同步至 `origin/main`。未接入口/导航或操作 Production，详细证据与验收限制见 [Testing](./TESTING.md)。

v0.1.18 Slice 1 Task 2 `LOCAL PASS`：canonical table、constraints/triggers、member SELECT RLS/ACL、locked CRUD RPC、module toggle 扩展与一份 forward patch 已完成。两条 disposable bootstrap/upgrade 路径分别通过 86 新 SQL / 681 旧 SQL、1,596 日期对照、19 新锁竞态与既有 Review/Lists/lifecycle 并发；schema/ACL parity、旧数据不变、Node 389/389、build、diff-check PASS。仅本地数据库基础，无 UI、Production rollout 或 authenticated acceptance；详细证据见 [Testing](./TESTING.md)。

v0.1.18 Slice 1 Task 1 `PASS`：单一 browser/Edge-compatible pure-date helper 提供输入验证、按年 occurrence、含今日的 next occurrence 与 typed display；future anchor、Feb 29 fallback、Day 1、周年及 Past 边界已自动验证。Important Date 15/15、日期/recurrence focused 75/75、full Node 389/389、build、Deno check 与 diff-check PASS。Task 1 检查点时尚无数据库或可用模块 UI，真实账号/Production/Push 验收未运行；详细证据见 [Testing](./TESTING.md)。

v0.1.18 重要日 Design Freeze / governance：完成 [canonical spec](./v0.1.18_IMPORTANT_DATES_SPEC.md)，冻结统一 Space-owned 对象、日期/周年与 future start-year 边界、模块关闭保留、Home/Calendar projection、日期 Push 与发布 gate、既有 Shared Space 删除文案的有界修正及三 Slice 计划。该冻结检查点仅文档变更；当时实现/功能测试/用户验收尚未开始。

v0.1.17 Space-aware List create default `CLOSED / PASS`：本地实现与自动验证、local authenticated acceptance、user-reported Production/PWA acceptance 均 PASS。全部空间默认 Personal，筛选到 Personal/Shared 时默认当前 Space；本地验收确认表单内改选后，新清单归属表单目标。Production/PWA 验收覆盖部署的 Vercel build 上全部空间、Personal、Shared 默认预选；Android-specific acceptance 未报告。冻结规则为 `CURRENT FILTER AS DEFAULT PRESELECTION, NOT OWNERSHIP AUTHORITY`。

v0.1.17 初始本地实现及自动验证记录：全部空间默认 Personal，具体合格 Space 默认该 Space；表单可改选且提交使用表单目标，失效目标不能静默保存。Tasks/Review/Calendar 行为未改；无 SQL/backend/依赖变化。该检查点时真实账号手工验收尚待用户执行，随后本地及 Production/PWA 验收均已通过，见上条。

v0.1.16 最终 `CLOSED / PASS`：实现及自动验证（Node 371/371、build）PASS，本地真实账号桌面验收 PASS，用户报告 Production installed-PWA 验收 PASS。首次 Tasks 验收 FAILED 后，只读 RCA 确认卸载导致视图状态丢失；三模块加入有边界的同会话已验证视图保留后，本地复测与 Production PWA 重入均通过。首次进入业务数据加载未重设计，非本版阻塞。

v0.1.15 Shared Lists 最终用户验收 `CLOSED / PASS`：四个 Slice 均关闭；Slice 4 移动端/PWA Item drag、长列表自动滚动通过，保留此前桌面、双账号 Realtime 与自动 stale-set 验证结论。Section drag 与 bundle warning 均不阻塞本版关闭；本次仅做治理文档 closeout，未改业务代码或 Production。

v0.1.15 Slice 4 桌面真实账号验收 `PASS`：用户确认未分组、同 Section、展开完成项拖拽，重新打开后的 canonical 位置，手柄与普通滚动，键盘排序/取消，以及双账号 Realtime 排序收敛。stale reorder 未人为制造竞态；Slice 1 backend stale-set 自动/并发测试和 Slice 4 stale 拒绝→canonical 重读→不重放自动测试已通过，故记为 `AUTOMATED PASS / MANUAL NOT REQUIRED`。Slice 4 移动端/PWA 尚待部署后验收；Section drag 保持 `DEFERRED`。

v0.1.15 Slice 4 Item ordering 本地实现与自动验证 `PASS`：handle-only Item drag 限于同一未分组/Section 的 active 或展开的 completed 组；`reorder_list_items` 成功后仅前端显示投影，后台 canonical 重读收敛，失败/陈旧请求不伪造成功或自动重试；拖拽中延迟应用 Realtime ready 状态。Section drag 因嵌套触控复杂度明确 `DEFERRED`。唯一新增直接依赖 `@hello-pangea/dnd@18.0.1`；focused 17/17、full Node 356/356、build、diff-check PASS。未改 SQL/backend/RPC，未操作 Production、真实账号、部署或 Git 发布。

v0.1.15 Slice 3 最终设备复测与治理 closeout `CLOSED / PASS`：用户确认 Vercel Section 删除响应性修正已生效，“仅删除分组”和“删除分组及其中内容”在设备上均响应迅速。既有桌面真实账号、Shared 双账号详情 Realtime、Item/Section filtered DELETE 收敛、草稿保留、详情刷新恢复、其他响应性和移动端/PWA 验收均 PASS；完整 Node 352/352 与 build PASS。v0.1.15 整体仍 `IN PROGRESS`，Slice 4 `NOT STARTED`。

v0.1.15 Slice 3 Section 删除响应性本地修正：服务端 RPC 成功后立即移除分组并关闭弹层；保留内容时仅在前端投影已知子项目到未分组末尾且保留相对顺序，删除内容时移除目标项目；后台 canonical 重读继续收敛，未修改数据库 `sort_order`、SQL/RPC 或依赖。聚焦 Node 13/13、完整 Node 352/352、build、diff-check PASS。桌面验收保持 PASS；用户报告移动端/PWA 其余项目 PASS，仅此交互待部署后设备复测。

v0.1.15 Slice 3 桌面真实账号验收与 pre-deployment review `PASS`：用户确认 Personal/Shared 详情功能、双账号 detail Realtime、Item/Section DELETE 投递、草稿保留、详情刷新恢复与响应性修正复测均通过；不需重复桌面或双账号验收。聚焦 Node 25/25、完整 Node 349/349、build、diff-check PASS。完整 Slice 3 diff 限于前端详情、导航、测试和治理文档；无 Slice 4、SQL/后端、依赖或秘密。移动端/PWA 尚待部署后验收，Slice 3 未关闭。

v0.1.15 Slice 3 响应性修正本地 `PASS`：用户桌面测试发现 quick-add、分组创建/改名成功后等待完整 detail 重读才显示，造成数秒停顿。现以服务端确认返回行立即更新当前详情，后台 canonical 重读收敛；Item 删除成功后仅移除目标，结构性 Section 删除仍等待后端排序/归位；Section 和 Item 的独立完整读取并行。Focused Node 25/25、full Node 349/349、build、diff-check PASS。下一步由用户复测真实桌面响应与焦点，再继续其余双账号详情验收。未改 SQL/后端/依赖，未提交、推送、部署或由 Codex 操作真实账号。

v0.1.15 Slice 3 List Detail / Collaboration 本地实现及自动验证 `PASS`：真实详情导航与刷新恢复、完整 canonical 读取、顶层/分组 quick-add、Section/Item 编辑与删除、明确布尔完成 RPC、完成折叠、Section 收起及详情 Realtime 已接入。零行重验资格，普通刷新保留未提交草稿和 UI 折叠状态。Focused Node 23/23、full Node 347/347、build、diff-check PASS；未改 SQL/后端或依赖，未操作 Production/真实账号、提交、推送或部署。真实账号双人详情 DELETE 验收仍待用户执行。

v0.1.15 Slice 2 Overview / Ownership 最终 `CLOSED / PASS`：用户报告 commit `3b9dfd7` 的 Vercel Production 部署和移动端/PWA 验收均通过。既有 full Node 338/338、TypeScript/Vite build、桌面真实账号 Personal/Shared Lists、独立 listFilter、Personal 默认与显式 Shared 归属、创建/改名/双步删除、模块关闭/重开、导航刷新、功能中心会话快照与三模块统一可见性、双账号 Realtime（含 filtered DELETE + RLS/canonical reread）全部 `PASS`。本次仅文档治理 closeout；Slices 3–4 未开始。

v0.1.15 Slice 2 最终桌面复核 `PASS`：用户确认返回功能中心立即显示、全部当前 Space 关闭 Tasks 时隐藏任务卡片、任一 Space 开启后恢复任务卡片；其余 Personal/Shared Lists、全部空间筛选与独立 listFilter、创建归属、改名、双步删除、模块关闭/重开、导航刷新、双账号改名与删除 Realtime 均已通过桌面真实账号验收。Filtered DELETE + RLS/canonical reread 已由用户双账号实测 `PASS`。完整 Node 338/338、TypeScript/Vite build、diff-check `PASS`；只有既有 >500 kB bundle warning。移动端/PWA 验收待 Vercel 部署后进行，Slice 2 未关闭；未操作 Production backend 或用户登录会话。

v0.1.15 Slice 2 功能中心三模块可见性修正 `LOCAL AUTO PASS / USER RECHECK PENDING`：用户复核确认会话内返回功能中心立即呈现 `PASS`，但全部当前成员 Space 关闭 Tasks 后任务卡片仍显示 `FAIL`。现复用现有 `loadTaskEligibility`，将 Tasks 与 Review/Lists 一起纳入会话快照；三个模块均仅在至少一个当前成员 Space 启用时显示，全关显示空状态。成功开关以 canonical 回读更新，失败不误改；后台读取失败保留已知卡片及重试。Focused Node 17/17、full Node 338/338、build、diff-check PASS。桌面其余功能及双账号 filtered DELETE + RLS/canonical reread 保持用户报告 PASS；移动端/PWA 待 Vercel 部署后验收。未提交、推送、部署或操作 Production。

v0.1.15 Slice 2 功能中心会话内模块可用性优化 `LOCAL AUTO PASS / USER RECHECK PENDING`：可用性状态由 authenticated CalendarApp 持有，启动时读取一次；普通站内导航重用已知卡片，前台/联网恢复、模块开关成功、空间生命周期及资格拒绝触发后台 canonical 刷新。后台失败保留已知卡片并显示重试，冷启动未知状态继续显示加载；账号切换由 user-key remount 隔离。桌面功能验收与双账号 filtered DELETE + RLS/canonical reread 已由用户报告 PASS；移动端/PWA 待 Vercel 部署后验收。Focused Node 18/18、full Node 337/337、TypeScript/Vite build、diff-check PASS；无 SQL、Production、提交或推送。

v0.1.15 Slice 2 ModuleHub UX 修复 `LOCAL AUTO PASS / USER RECHECK PENDING`：用户报告桌面 authenticated acceptance 的功能流程通过，包含 Personal/Shared 归属、改名、双步删除、模块开关、筛选、刷新恢复、双账号改名及 filtered DELETE Realtime + RLS/canonical reread。发现功能中心任务卡片先于回顾/清单出现导致布局跳动；首次进入等两项资格读取结束后再一并呈现卡片，聚焦刷新保留上一份完整卡片列表直到两项新结果同时提交，失败保留各自重试。受影响 focused 14/14、完整 Node 334/334、TypeScript/Vite build 与 diff-check 通过。移动端/PWA 按既定流程在 Vercel 部署后验收；Codex 未操作登录会话或 Production，前端未提交/部署。

v0.1.15 Slice 2 Overview / Ownership `LOCAL AUTOMATED PASS`：已实现 Personal/Shared 清单模块开关、功能中心合格入口、独立 all-Space 筛选、Personal 默认且显式的创建归属、List 创建/改名/双步删除、Item 派生进度与分组、总览 Realtime 规范重读和 user-scoped 总览导航恢复；无详情/Section/Item UI。完整分页与请求代次、资格失败重试、失效数据清理均经本地验证。Full Node 333/333、TypeScript/Vite build、diff-check 通过；真实账号验收未执行，前端未部署，未操作 Production。

v0.1.15 Slice 1 DB foundation Production rollout/postflight `PASS`：已审查的单份 forward patch（SHA-256 `6e16b311a853d6cc227006cdfb9ebcfb46ecf060b9ed28b5118e4df457da4a8b`）在已核对的 Production Supabase 项目执行一次，保留 `BEGIN/COMMIT`，无重试、修复 SQL 或其他 Production 变更。Postflight 确认三张空表、约束/索引/触发器、RLS/列级 ACL、八个 mutation RPC、Lists module toggle 和三表 Realtime/FULL replica identity；Lists module rows 仍为 0，既有 Events/Tasks publication 不变，10/10 既有业务数据 counts/fingerprints 与 preflight 一致。Slice 1 正式 `CLOSED / PASS`；前端与真实账号 Lists 验收未开始。

v0.1.15 Slice 1 DB foundation `LOCAL PASS`：三表与约束/RLS/ACL、Lists module toggle、八个窄 mutation RPC（含 completion/reopen）、Realtime publication/FULL replica identity、canonical schema 与一份 forward patch 已实现。本地 pgTAP 13 files / 681 assertions、Lists 双会话 17/17、既有 Review 4/4 与 lifecycle 9/9、fresh/upgrade 109 项 catalog parity 均通过；既有业务 fixture 指纹不变。未操作 Production、部署、真实账号或前端。

v0.1.15 Shared Lists Design Freeze `DESIGN FROZEN`：只读仓库调查已接受并转为 canonical specification，冻结 Space ownership、completion/order invariants、Section 删除、item drag、Realtime 与 bounded concurrency。此为先前设计里程碑；后续 Slice 1 已在本地实现。

v0.1.14.1 final governance closeout `CLOSED / PASS`：用户报告 Production Calendar、Tasks、已有 Review 历史/相关页面与同一 Space Detail 刷新恢复通过；深页登出后另一账号不会继承原目标。Production 无 Review 数据，未重建 fixture，也未将 Review Detail 数据场景记作本轮线上实测；其恢复由自动 integration 与本地验收覆盖。Navigation Persistence 仅在既有 React memory navigation 上保存 user-scoped sessionStorage 页面及稳定 ID，经 canonical eligibility 验证失效目标并安全回退；临时读取失败可重试，dirty guard 与各筛选独立。无 Router、URL/history、深链、草稿/筛选持久化或 PWA cold-start 保证。

v0.1.14.1 Production rollout verification `PASS`：正常 push 将 `a534be2..8212cc8` 推至 `origin/main`，pre-push hook 通过，紧邻 push 的只读 freshness 为 `POST_PUSH_STATE_CURRENT`。GitHub 对 exact commit `8212cc820c7708e3766e9bf8cc9da84b15a5e5aa` 报告 Vercel `Production / success`；公开根页、当前 JS/CSS 与 manifest 均 HTTP 200，未登录入口正常，部署 JS 含导航 sessionStorage 标记。未执行 Production authenticated acceptance 或 backend 写入；等待用户线上最小刷新复验。

v0.1.14.1 Local Authenticated Acceptance `PASS`：用户在本地真实浏览器确认 Calendar、Tasks、Review 相关页面、Space Detail 及其他已测深页刷新后仍在原页面；logout 后由另一账号登录不恢复前一账号深页。该报告不覆盖 Production、browser back/forward、可分享深链或 PWA 完全关闭后重启。自动验证沿用 integration review 的 targeted 22/22、full Node 320/320、gate 19/19、build PASS；本次仅记录人工验收。

v0.1.14.1 bounded integration review `PASS`：核对 Auth/Space 启动顺序、用户隔离、各页面写入、dirty guard、失效目标纠偏、临时 UI 与 PWA/history 边界。修复 Review 详情首次读取时临时 Auth 错误被误判为不可访问的问题；保留重试与原目标。Targeted 22/22、full Node 320/320、Project State gate 19/19、build、diff-check PASS。仅本地前端/测试/文档变更；下一步用户在真实浏览器执行关键页面刷新验收。

v0.1.14.1 Navigation Persistence 本地实现与自动验证 `LOCAL PASS`：新增按 user ID 隔离、严格解析且容忍 storage 异常的 sessionStorage 页面目标；Auth 与 Space bootstrap 后恢复，Review history/detail 使用现有 eligibility、participant 读取，Space Detail 核对当前 membership；dirty guard 与独立筛选保持原语义。Node 319/319、Project State gate 19/19、build 与 diff-check PASS。无新依赖、SQL/RPC/RLS 或 Production 操作；真实账号刷新验收待用户执行。

v0.1.14 Final authenticated acceptance + governance closeout `CLOSED / PASS`：用户明确报告 Production 最终复验通过；Personal / Shared 回顾、ModuleHub 入口、双账号本人编辑/对方只读、四状态转换、历史/新建、日期更正、date chronology、同日重复拒绝、`共 N 篇回顾`、date-driven「上一份计划」、桌面/320px 响应式和 dirty navigation 均通过实际产品验收。随后以 exact-ID whitelist、Review 表锁、事务内 metadata/participant 断言和 `DELETE ... RETURNING` 精确删除 3 个 Personal 测试 rounds，FK cascade 删除 3 entries；postflight 为 0/0、orphans 0、duplicates 0，两条 Review modules enabled，Space/member/module/Event/Task/reminder counts 与 fingerprints 不变。v0.1.14 正式关闭。

v0.1.14 Frontend Production push + deployment verification `PASS`：正常 `git push origin main` 将已审查的 9-commit range `f10d140..189f055` 推送到 main，repo pre-push hook 通过。GitHub 上 exact HEAD `189f055f350daae3fe118137e23c3bb938a748ea` 的 Vercel status 为 `success / Deployment has completed`。公开 Production 根页面、当前 JS/CSS 与 manifest 均 HTTP 200，manifest 名称仍为「共享日历」，部署 bundle 包含最终回顾文案，登录页没有 Supabase env 缺失错误。未登录账号、创建 Review、修改 module 或写 Production DB；最终 authenticated recheck pending。

v0.1.14 Frontend Pre-deploy / Push Gate 本地 `PASS`：整体审查 `origin/main...HEAD` 的 7-commit stack，确认最终 UI 使用 `review_date` chronology、同日唯一、authoritative count、日期驱动的上一份计划与内部-only `round_no`。Gate 发现日期更正成功后刚创建详情不会立即刷新上一份计划，已用一个 bounded frontend fix 修正并加入先红后绿回归。Production 只读核对两张表、RLS/policies、五个 RPC 精确签名/定义/ACL 与数据 0 rounds / 0 entries / 2 enabled Review modules；无写入或 cleanup。Review targeted Node 39/39、完整 Node 313/313、Project State gate 19/19、build、diff-check、secret/copy/parity scans 与 production dependency audit（0 vulnerabilities）均通过；既有 521.79 kB bundle warning 不阻断。未 push、deploy 或操作真实账号。

v0.1.14 Date Chronology Production backend rollout `PASS`：cleanup 前只读复核确认唯一 4 个验收 rounds / 7 个 entries，随后按用户授权在独立事务中 exact-ID 删除并通过 FK cascade 清理 entries；两条 enabled Review module rows 与既有核心数据保持不变。SHA-256 `7adf5a8dfa34c0bfca8ab05b7b2467bcfe088d262c50213d6e24fbae939cb82f` 的 exact forward patch 通过自身 `BEGIN/COMMIT` 应用一次，exit code 0。postflight 确认 `unique(space_id, round_no)` 与 `unique(space_id, review_date)` 并存，create/correct duplicate-date 语义和 date-driven previous-plan RPC 与 canonical 一致，三者均为 authenticated-only EXECUTE；Review RLS 未变、数据保持 0/0，Space/member/module/Event/Task/reminder 计数和指纹前后一致。未部署或 push frontend，也未创建 Production fixtures。

v0.1.14 第二轮 acceptance fix 本地 `PASS`：`review_date` 成为业务时间轴，新增同 Space 同日唯一约束；create/date-correction 在既有 Space 锁内拒绝占用日期。previous-plan 改为窄只读 RPC 后端确定严格更早日期中的最近一篇，只返回本人 plan/null，无本人 entry 或空 plan 不 fallback。`round_no` 保持内部不可变序列和游标。新 pgTAP 41/41、完整 DB 12 files/546、Review concurrency 4/4、lifecycle concurrency 9/9、targeted Node 21/21、full Node 312/312、build PASS。patch 只应用本地测试库，未触碰 Production。

v0.1.14 authenticated acceptance feedback fix 本地 `PASS`：移除历史、详情、无障碍名称与日期弹窗中的可见「第 N 次」，日期成为可见身份；历史新增 RLS 下当前 Space 的 authoritative exact count「共 N 篇回顾」，分页不以已加载行数或游标局部计数覆盖；参考文案统一为「上一份计划」。该第一轮节点当时保留 `round_no - 1`，现已由上方第二轮 date chronology 语义 supersede。Focused Node 11/11、完整 Node 305/305、build PASS。没有 Production 写入/部署、依赖或 Codex 登录操作。刷新页面回首页记录为后续 UX 事项，本轮未修复。

v0.1.14 前端 integration / pre-deploy review 本地 `PASS`：核对 Hub → 单 Space 历史/新建 → 服务端 canonical id 详情 → 本人编辑/对方只读 → 日期更正/返回排序；修复底部导航离开详情时绕过未保存草稿确认的问题。构建产物指向已关联的 Production backend；Production 只读核对四个回顾写 RPC、模块开关、函数授权、表列与 RLS，未发现前端依赖未部署能力。Focused Node 7/7、完整 Node 302/302、build、diff-check 与生产依赖安全审计 PASS。未进行真实账号/设备验收、Production 写入、前端部署或 push。

v0.1.14 Slice 4 Responsive Detail + Date Correction + Previous Plan 本地 `PASS`：历史行与新建成功可进入详情；Personal 单列，Shared 桌面我/对方并排、手机切换且保留本人草稿。本人复用 Slice 2 editor；对方当轮 entry 只读、固定高度框内滚动。日期经已部署 `correct_review_date` 更正并用服务端结果更新；返回历史会重新读取排序。该 Slice 当时使用紧邻内部编号读取上一份计划，现已由第二轮 date chronology 修正替代。Focused Node、full Node、TypeScript/Vite build、diff-check PASS；该节点无 SQL/RLS/RPC、Production 写入/部署或真实账号验收。

v0.1.14 Slice 3 Module Entry + Space-scoped History & Create 本地 `PASS`：空间管理增加 owner-only 回顾开关；功能中心仅在存在已开启且当前可访问的 Space 时显示回顾。独立单 Space 选择、参与者快照状态映射、20 轮游标分页和日期可编辑的 `+` 新建复用现有 RLS 与 `create_review_round`。Focused Node、full Node、TypeScript/Vite build 与 diff-check PASS；无 SQL/RLS/RPC、依赖、Production/frontend 部署或真实账号验收。完整详情和上一轮计划属于 Slice 4。

v0.1.14 Slice 2 Entry Save & Filled Status 本地 `PASS`：新增本人 entry 的定向读取与复用已部署 save/mark RPC 的 data layer、四字段固定高度编辑组件、canonical 状态/dirty 分离和失败保留草稿。Focused Node 8/8、full Node 284/284、TypeScript/Vite build 与 diff-check 通过；没有组件测试框架，未进行组件自动交互或真实账号验收。无 SQL、Production frontend、依赖或导航变更。

v0.1.14 Slice 1 Production backend rollout `PASS`：已推送的唯一回顾 forward patch 在 Production 以自身 `BEGIN/COMMIT` 事务执行一次；两表、约束、索引、触发器、RLS/ACL、四个窄 RPC 与模块开关 postflight 通过。既有 Space、成员、模块、Event、Task、Reminder 的计数及全行指纹前后完全一致；回顾两表与 `review` 模块行均为 0。未部署回顾前端或执行真实账号验收。

v0.1.14 Slice 1 Backend Foundation 本地验证节点：canonical schema 与单份 forward patch 已准备；两表、participant 双条件读、四个窄 RPC、Space 锁与 review 模块开关完成。本地 DB 11 文件/505 项、回顾双会话 3/3、既有 lifecycle 双会话 9/9 PASS；该节点未改 Production。

v0.1.14 Slice 1 Production READ-ONLY preflight `PASS`：Production 与 v0.1.13 patch 前置结构兼容；回顾对象及 `review` 模块行均不存在；成员数据无 blocker；lifecycle 定义、RLS/ACL/RPC 边界、锁前置条件与 schema/patch parity 核对通过。未执行 Production 写入，blockers 为 `None`。

v0.1.14 回顾 Design Freeze：固定 Personal 单人 / Shared 创建时双人 participant snapshot、历史成员访问、Space 内编号、日期更正、四字段状态、模块开关和响应式 UI；形成五个 bounded implementation slices 与验收条件。仅文档变更，未实施功能。

v0.1.13 Final Regression + Closeout `CLOSED / PASS`：Slice 2 Production deployment `6662531970`（source `c08e9f1`）成功；公开入口及当前 JS/CSS 静态资源返回 HTTP 200，Production 四个 lifecycle RPC 的签名、search_path 与 authenticated-only EXECUTE 权限只读核对通过。用户报告真实账号、移动端及 PWA 验收全部通过。Focused Node 46/46、full Node 276/276、build、diff-check 均通过；Codex 未操作真实登录态。

v0.1.13 Slice 2 review 修正：leave/delete RPC 成功后先清除当前与持久化的 Space 选择并退出详情，再刷新空间列表；刷新失败也不恢复失效详情。remove/transfer 保留合法选择。Calendar/Task 的既有 eligibility 纠偏在目标失效时可回退默认值。Node 276/276、build、diff-check 通过；只读核对 Production RPC，无数据库变更或真实账号登录。

v0.1.13 Slice 2 本地前端实现：Shared owner/member 分别显示授权操作，Personal 不显示 lifecycle 操作；四个动作直接调用 Slice 1 RPC，带成员重验、确认与防重复提交，完成后刷新空间和详情。自动 Node 回归、build、diff-check 通过；未操作 Production、真实账号或 PWA。

v0.1.13 Slice 1 `CLOSED / PASS`：Slice 1B 只应用一份已审查 forward patch，Production postflight 核对四个 RPC、owner/capacity guard、Personal hard protection、18 项 TRUNCATE 拒绝和 reminder claim 结构。业务数据前后计数与指纹完全一致，5 条 sent 历史 orphan ledger 保留。Slice 1 本地 DB 388/388、双会话 9/9、Node 266/266、build 和 diff-check 均通过；Production 未创建测试数据，未部署前端。

v0.1.13 Slice 1A 本地 backend 和窄 ACL recovery 完成：四个 lifecycle RPC、Shared owner/capacity guard、精确 Event 清理、reminder claim 并发锁；对三个应用角色撤销六个 lifecycle 相关表的 `TRUNCATE`。本地 DB 388/388、双会话 9/9、Node 266/266、构建和 diff 检查通过。

v0.1.12 — Module Hub + Space Management Navigation 已完成并 `CLOSED / PASS`。Production 部署了已验收的前端提交 `9847a0761e117234e10e219ec9c8d4bae25a850e`，最终自动回归与用户真实账号 Production / installed-PWA 验收通过。一级导航为 首页 / 日历 / 功能中心 / 我的；功能中心仅有任务，任务聚合各 eligible Space；我的 → 空间管理管理 Personal / Shared 详情。Space 仍是 canonical ownership boundary。统一 UI 视觉精修、未使用的 `MemberSheet.tsx`、`space_modules` Realtime 和 Calendar all-Space 创建留待后续，不阻塞本版本。

v0.1.12 Slice 3 已通过用户真实账号本地功能验收并 `CLOSED / PASS`。一级导航为 首页 / 日历 / 功能中心 / 我的；功能中心目前仅有任务，任务聚合与独立筛选已接入，旧 Space-first 日常任务路径已退役。最终代码 review 与自动校验通过；其后 Slice 4 Production / installed-PWA 验收亦通过。未用的 `MemberSheet.tsx` 待另行决定删除。

v0.1.12 Slice 2 My → Space Management → Space Detail 已通过用户真实账号功能验收并 `CLOSED / PASS`。涵盖 Personal/Shared 列表和详情、成员/角色、邀请码、Tasks 开关、create/join 复用、selectedSpaceId 管理职责及临时旧 Hub 过渡。UI视觉精修留待统一设计迭代，不阻塞本 Slice。Production 未变。

v0.1.12 Slice 1 Aggregate Tasks foundation 已验收为 `CLOSED / PASS`：eligible Tasks Space、独立 taskFilter 修正、完整跨 Space 读取与分页、沿用单 Space canonical 排序、Space 来源映射、stale-request 保护和 malformed module page fail-closed。仅增加数据层及测试，未接入可见 UI；不代表 v0.1.12 整体已关闭。

v0.1.11 — Navigation + Aggregation Experience 已完成并 `CLOSED / PASS`。首页“近期日程 +”和“需要处理的任务 +”分别直达对应创建表单；没有首页标题 Global `+` 或类型选择面板。用户报告 Desktop 与 Production installed PWA 验收通过，覆盖入口、Personal/Shared target 与归属、保存即时刷新、模块关闭安全、二次确认取消、关闭重开、防重复提交、布局、一级导航及现有日历/空间本地创建回归。目标空间安全、membership/module/member-derived state 重验、stale request 与 duplicate-submit protection 均保留。Production URL 在验收时对应前端提交 `f916dc0f0a1962facca44f4174241031b4f44bf2`。Dedicated final iPhone Safari acceptance 为 `NOT RUN`；未将其记为 PASS，也不是 blocker。

2026-09-25 roadmap re-freeze：v0.1.12 目标为 Module Hub + Space Management Navigation（功能中心 + 空间管理信息架构迁移）；当时仅进入 READ-ONLY 设计审查，此后 Slice 1、Slice 2 已关闭。原先在 Structured Review / Check-in 与 Shared Lists 之间择一作为 v0.1.13 的想法，已被后续 Space Lifecycle & Membership Safety 优先决策取代；其余远期模块顺序保持开放。

Slice 3 Home Aggregation is deployed to Vercel Production and `CLOSED / PASS` after local implementation, automated verification, and user-run desktop and Production device acceptance. Home aggregates membership-visible Event occurrences over three local calendar days and eligible open Tasks through seven future days plus undated; each section has five-row collapse/expand, source Space labels, canonical Sheets, independent error/retry and active-view bounded Realtime. User-run acceptance passed on desktop, Vercel Production, iPhone Safari, and installed PWA, including the four tabs and Home default; Personal/Shared Events and eligible Tasks; ordering, labels, inclusion/exclusion, expand/collapse and canonical Sheet interactions; module disable/re-enable; Home leave/return; A/B Event/Task Realtime; narrow viewport; and the Space → Tasks navigation fix. Only confirmed module `disabled` exits Tasks; `loading`/`error` keep the page with mutation gating and retry. The regression test failed before the fix and passes now. Production includes Slices 1–3. Independent Event/Task section error/retry is `NOT RUN / DIFFICULT TO SIMULATE SAFELY`; second Shared Space is `N/A / NOT RUN`, with no test Space created. No backend/schema/RPC or dependency change.

Slice 2 Aggregate Calendar is implemented under Option A: `all` has no create action; a single Space filter uses the existing Event Sheet with an explicit target and membership recheck. Complete Event/exception reads, per-Space members, canonical recurrence/edit reuse, fail-closed display and active-view Realtime passed automated checks and the read-only frontend/backend readiness gate. Implementation commit `0505091` is pushed to `origin/main`; local automated verification and user-run authenticated functional checks 1–10 are `PASS`, including Today/Week/Month navigation and current-period actions. User-run bounded Production smoke is `PASS`: Production runs the Slice 2 frontend; aggregate/source labels, all/single create behavior, Event open/edit context, date navigation/current-period actions, Hub → Calendar filter, rapid-filter stale-data isolation, and A/B Realtime create/update/delete passed. Slice 2 is `CLOSED / PASS`. Checks 11 iPhone Safari, 12 installed PWA and 13 final 320px device check are `DEFERRED / NOT RUN`; check 14 second Shared Space is `N/A / NOT RUN`. No Slice 2 backend rollout occurred; Slice 1 remains `CLOSED / PASS` in Production.

## Deployment

v0.1.19: Production project `ximazjhxvmktpcdbypka` Task SQL/postflight PASS；send-reminders ACTIVE v4（verify_jwt=false），单一 minute scheduler/Cron compatibility PASS，secrets 未改变。已核验的 Vercel Production revision `9f30f5e48eaa34282a5b2ca00d2c254f90711be2` / deployment `4in5dLHFYnz4WJC2KbNQjuAEXgsg` 于 2026-10-07 14:21:52 Asia/Shanghai success；unsigned assets/target alignment PASS。用户 Production/installed-PWA 人工验收与 10-07 晚间真实 Task Push PASS，v0.1.19 CLOSED / PASS。后续治理 commit 的 REMOTE_SYNCED 以最后获授权 push 后验证为准。以下 v0.1.18 deployment 为历史记录，不是当前 sender 版本。

Status: public_deployed
Public URL: https://cross-platform-shared-calendar.vercel.app/
Provider: Vercel
Backend: Supabase Free
Slice 2: CLOSED / PASS. T1/T2A/T2B/T3/T4 PASS; T2A → T2B exact SQL patches APPLIED ONCE each / independent READ-ONLY POSTFLIGHT PASS; integrated send-reminders ACTIVE v3 / verify_jwt=false. Existing single active once-per-minute scheduler, command/config/120000ms timeout unchanged. Catalog/history/Event compatibility and passive diagnostics PASS. T4 local/auth acceptance PASS; accepted Production frontend source `5222b432528bfc60e6fd0a311382b0def94dcef0` has Vercel Production deployment success and public root/current JS/CSS HTTP 200. User confirms real Production / installed PWA Push E2E PASS: current Shared members receive once, no duplicates, no-reminder objects do not send. Important Date active-view Realtime remains deferred/non-blocking; v0.1.18 is CLOSED / PASS under the final acceptance record above.
Slice 3: CLOSED / PASS. T1/T2/T3/T4 CLOSED / PASS；Important Date functional manual + retention UX PASS；Calendar Event P0a manual PASS；Task P0b automated PASS，正常行为与阶段性 cleanup 已纳入用户 FINAL_MANUAL_REGRESSION = PASS。本次 closeout 仅仓库 review/验证/发布，不执行 backend rollout、手动部署或额外 Production/installed-PWA 专项验收；Git remote sync 不证明当前 Vercel deployment/Production acceptance。
Historical Slice 3 T3 acceptance: local automated + user authenticated local acceptance PASS. Final local manual regression now PASS for the completed Slice 3; no extra Production / installed-PWA-specific PASS is inferred.
Backend rollout: v0.1.18 Slice 1 Important Dates exact Task 2 forward patch APPLIED ONCE / READ-ONLY POSTFLIGHT + LEGACY CAPABILITY REGRESSION PASS; v0.1.15 Slice 1 Shared Lists exact forward patch APPLIED ONCE / POSTFLIGHT PASS; v0.1.14 review foundation and date chronology forward patches remain applied; v0.1.13 lifecycle remains applied.
v0.1.16 frontend: GitHub records successful Vercel Production deployment of `543fa4956dbb58cdc1671b91bafb5b46da98adc0`; user-reported installed-PWA acceptance PASS for Tasks/Review/Lists re-entry. Android-specific acceptance was not reported.
v0.1.17 frontend: user-reported Production/PWA acceptance PASS on the deployed Vercel build for Lists create defaults in 全部空间, Personal, and Shared filters. Explicit form-target ownership passed in local authenticated acceptance. Android-specific acceptance was not reported; this frontend-only correction required no backend rollout.
v0.1.18: Tasks 1–4 implementation/automatic verification PASS. The exact Task 2 Important Dates foundation forward patch was applied once to Production; read-only postflight and legacy capability regression PASS, V018_SLICE1_BACKEND_READY. At foundation postflight, Important Dates records/module rows were zero; rollout did not auto-enable modules, publish Reminders, add fixtures or new Realtime publication. User confirms the public Production alias and real-device annual layout PASS, and authenticated CRUD/permissions/date behavior/module toggle acceptance PASS. Slice 1 is CLOSED / PASS. Active-view cross-member refresh remains deferred under the frozen no-Realtime contract; v0.1.17 acceptance remains historical.
Notes: Shared Lists Slice 1 backend rollout/postflight and Slices 2–3 Vercel/mobile acceptance passed. User reports final Slice 4 desktop, dual-account Realtime, mobile/PWA Item drag and long-list auto-scroll acceptance `PASS`; v0.1.15 is `CLOSED / PASS`. The v0.1.16 deployment record was checked read-only; Codex did not operate Production or authenticated sessions. Existing Review backend keeps same-Space/date uniqueness, duplicate-safe create/date correction and `get_my_previous_review_plan`; final Review fixtures remain 0/0 while Shared and Personal Review modules remain enabled. Historical version-specific acceptance limits remain in DEVLOG/TESTING. `space_modules` remains outside Realtime; `send-test-push` remains ACTIVE v4 reviewed-equivalent and `send-reminders` ACTIVE v3 / `verify_jwt=false`. Vault, secrets and Cron were not changed.

## Version Index

- v0.1 — 共享日历 MVP
- v0.1-smoke-test — Supabase 验收
- v0.1.1 — 个人事件权限
- v0.1.2 — 公网部署验收
- v0.1.3 — 事件表单默认值
- v0.1.4 — 成员身份与空间成员
- v0.1.5 — Email OTP 登录 UX
- v0.1.6.1 — Recurring Events Foundation（migration + engine，Production patch 已执行）
- v0.1.6.2 — Recurring Events Calendar Integration（occurrence projection，未实现 recurrence UI）
- v0.1.6.3 — Recurring Events UI Implementation（source-series form，待最终浏览器/Realtime 验收）
- v0.1.7 — Recurrence Exceptions & Series Editing（设计完成，待人工 review）
- v0.1.7.1 — Recurrence Exceptions Database Foundation（Production prerequisites 已验证）
- v0.1.7.2 — Exception Expansion Engine（Production 已验证）
- v0.1.7.3 — Recurrence Editing Semantics Design（设计完成，待人工 review/implementation approval）
- v0.1.7.3.1 — Database RPC Foundation（Production patch + PostgREST schema cache 已验证）
- v0.1.7.3.2 — Frontend RPC Integration（only-this authenticated smoke 已通过）
- v0.1.7.3.3.1 — Split RPC Correctness Patch（final split / future-delete semantics 已验证）
- v0.1.7.3.3.2 — Frontend Scope Integration（Production Desktop 与 iPhone Standalone PWA recurrence smoke 已通过）
- v0.1.8 — Mobile Push Reminder（CLOSED / PASS）
- v0.1.8.1 — Push Infrastructure Foundation（CLOSED / PASS；Desktop + iPhone + Android Studio Emulator verified）
- v0.1.8.2 — Reminder Persistence + Ordinary Event Delivery（Slice A/B/C CLOSED / PASS；P3A C1、P3B manual E2E、P3C automatic scheduler E2E complete）
- v0.1.9 — Shared Tasks MVP（CLOSED / PASS；Slice 1/2/3 CLOSED / PASS；Production backend verified、frontend deployed and accepted）
- v0.1.10 — Personal Space + Multi-space + Module Enablement Foundation（CLOSED / PASS；Slice 1 PRODUCTION BACKEND ROLLOUT PASS；Slice 2 CLOSED / PASS；Slice 3 CLOSED / PASS）
- v0.1.11 — Navigation + Aggregation Experience（CLOSED / PASS；Slice 1–4 CLOSED / PASS；Production installed PWA acceptance PASS；dedicated final iPhone Safari acceptance NOT RUN）
- v0.1.12 — Module Hub + Space Management Navigation（CLOSED / PASS；Slice 1–4 CLOSED / PASS；Production / installed-PWA acceptance PASS）
- v0.1.13 — Space Lifecycle & Membership Safety（CLOSED / PASS；Slice 1/2 CLOSED / PASS；Production deployment、用户报告的 authenticated/mobile/PWA acceptance PASS）
- v0.1.14 — 回顾（CLOSED / PASS；backend/date chronology Production PASS；frontend deployed；public smoke 与 Production authenticated acceptance PASS；final exact-ID cleanup PASS，Review 0/0、两条 module enabled）
- v0.1.14.1 — Navigation Persistence（CLOSED / PASS；实现、integration review、本地及 Production 真实账号验收、Production deployment/public smoke PASS）
- v0.1.15 — Shared Lists（CLOSED / PASS；Slices 1–4 CLOSED / PASS；desktop、dual-account Realtime、mobile/PWA PASS；Section drag DEFERRED / NON-BLOCKING）
- v0.1.16 — Module Entry Responsiveness / Data Flow Simplification（CLOSED / PASS；implementation/automated、local authenticated desktop、Production installed-PWA acceptance PASS）
- v0.1.17 — Space-aware List create default（CLOSED / PASS；implementation/automated verification、local authenticated、Production/PWA acceptance PASS；Android-specific acceptance 未报告）
- v0.1.18 — 重要日（CLOSED / PASS；Slice 1/2/3 与 Slice 3 T1/T2/T3/T4 CLOSED / PASS；T4 functional manual + retention UX PASS、P0a manual PASS、P0b automated PASS 并纳入最终人工回归、当前模块阶段性 cleanup PASS；FINAL_MANUAL_REGRESSION = PASS；active-view Realtime deferred）

- v0.1.19 — Task Due-date Push Reminder（CLOSED / PASS；backend SQL/ACTIVE v4、frontend 发布对齐、local/Production/installed-PWA 人工验收及 2026-10-07 晚间真实 Task Push PASS）

## Last verified

2026-10-08

## Next Action

Next Action: PWA 手势交互体验评估。先阅读用户将提供的其他项目 lessons learned，再确定本项目适用范围，不预设实现方式或版本号。原 Market Validation / Commercialization Study 路线保留，本轮不启动。

## Blockers

暂无明确阻塞。

## Important Context

- Slice 1 user acceptance: authenticated CRUD/permissions/date behavior/module toggle, public Production alias and real-device annual layout are PASS. Annual 375px PASS; 320px only buttons wrap without overlap, clipping or horizontal overflow; no further 320px scope. Shared edits by another member appear after re-entry canonical reread rather than immediately in an open view, matching the frozen no-Realtime design. Active-view Realtime refresh is deferred and is not a blocker.

- v0.1.18 重要日的唯一 canonical contract 是 [规格](./v0.1.18_IMPORTANT_DATES_SPEC.md)。Slice 1/2 CLOSED / PASS；日期核心由 browser/Edge 共用，future anchor / Feb29 Important Date fallback 与 Event skip 语义保持。Slice 3 与 T1/T2/T3/T4 CLOSED / PASS；T4 functional manual + retention UX、Calendar Event P0a manual、Tasks P0b automated 与用户最终人工回归 PASS。当前模块阶段性 cleanup PASS；Home/Calendar 原地 Sheet 与治理说明见 DECISIONS/BACKLOG。Important Date active-view Realtime deferred，Task due-date Push 已选为 v0.1.19 bounded scope，状态见上方。
- v0.1.17 `CLOSED / PASS`；冻结约定为 `CURRENT FILTER AS DEFAULT PRESELECTION, NOT OWNERSHIP AUTHORITY`。Tasks/Review/Lists 已符合，Calendar 行为有意保持不变；v0.1.18 重要日遵循此约定。Slice 3 T1 的 display Space IDs 只收窄读取/展示，不修改 ownership；T2 的 spaceId + importantDateId exact canonical reader 与 request guards 仍有效；当前 Home/Calendar 使用原地 Sheet，旧 module-navigation handoff/returnTo 已删除；target 不持久化，无新依赖。
- v0.1.15 Shared Lists 的唯一 canonical contract 是 [v0.1.15_SHARED_LISTS_SPEC.md](./v0.1.15_SHARED_LISTS_SPEC.md)。Slices 1–4 与整个版本 `CLOSED / PASS`；Item drag 设备验收及长列表自动滚动通过。Section drag 按冻结设计延后且不阻塞；stale reorder `AUTOMATED PASS / MANUAL NOT REQUIRED`，既有 bundle warning 非阻塞。
- v0.1.14 `CLOSED / PASS`：`review_date` 是业务时间轴且同 Space 同日唯一；上一份计划严格按日期上一篇、不 fallback；`round_no` 仅为内部技术序列。Backend、frontend deployment、public smoke、用户 Production authenticated acceptance 与最终 exact-ID fixture cleanup 均通过；Production 当前 0 rounds / 0 entries、Shared 与 Personal Review module enabled。v0.1.14.1 已解决刷新回首页问题并 `CLOSED / PASS`；既有 >500 kB bundle warning 仍为非阻塞项。完整 Review contract 和验收条件只以 v0.1.14 规格为准。
- Git branch、latest commit、working tree 由 project-command-center 实时 Git 扫描读取；PROJECT_STATE.md 不作为这些字段的权威来源。
- Production URL: `https://cross-platform-shared-calendar.vercel.app/`.
- Supabase project status is currently Active, but Free Tier inactivity pause remains an operational risk.
- A Supabase pause may affect Auth, Database, RLS, and Realtime until the project is restored.
- Vercel Cron 每天调用 `/api/supabase-keepalive`；每次调用连续执行 3 次极轻量、只读、无业务副作用的数据库检查；首次 Production Cron 已返回 HTTP 200 并完成验证。
- Keep-alive is active, but its long-term effectiveness against inactivity pauses still requires observation.
- Continue using Supabase Cloud for now; do not upgrade to Pro or migrate the backend unless real usage requires it.
- README is the project entrypoint; detailed smoke checklists and production validation records live in `docs/TESTING.md`.
- Android compatibility smoke test is complete for Xiaomi 14 / Android 16 / Chrome on mobile network.
- v0.1 is a Web/PWA, not native iOS / Android.
- v0.1.9 canonical scope is `docs/v0.1.9_SHARED_TASKS_SPEC.md`; Slice 1 backend is Production applied/postflight verified, Slice 2 local UI passed user-run authenticated acceptance, and Slice 3 Production Desktop A/B plus iPhone smoke passed. All three slices are CLOSED / PASS.
- v0.1.10 is `CLOSED / PASS`: it reuses `spaces / space_members`, enforces sole-owner Personal Space with partial unique `UNIQUE(created_by) WHERE kind = 'personal'`, retains the Shared two-member limit, and keeps disabled Tasks history readable while blocking mutations. Calendar is always on; Tasks is the only v0.1.10 visible module toggle. Slice 1 / 2 / 3 passed their respective backend, frontend, and user acceptance gates. Production frontend now also includes the v0.1.11 Slice 1 navigation foundation; that rollout changed no backend/schema/RPC. Shared three-plus-member support remains deferred.
- v0.1.11 canonical scope is `docs/v0.1.11_NAVIGATION_AGGREGATION_SPEC.md`; overall and Slices 1–4 are `CLOSED / PASS`. Production installed PWA acceptance is user-reported `PASS`; dedicated final iPhone Safari acceptance is accurately recorded as `NOT RUN` and is not a blocker. Production includes the Slice 4 frontend from feature commit `f916dc0f0a1962facca44f4174241031b4f44bf2`. Slice 3 independent Event/Task section error/retry remains `NOT RUN / DIFFICULT TO SIMULATE SAFELY`; second Shared Space is `N/A / NOT RUN`. Dedicated Slice 2 device checks remain deferred as recorded above.
- Roadmap at the v0.1.13 closeout: v0.1.12 and v0.1.13 were `CLOSED / PASS`; v0.1.13 Slice 1/2, Production deployment, and user-reported authenticated/mobile/PWA acceptance were all `PASS`. The next-version planning checkpoint later selected v0.1.14「回顾」; its current state is recorded above. A future Personal Event share/projection direction may preserve one canonical Space owner while adding visibility elsewhere; it is not v0.1.13 scope and has no schema reservation.
- v0.1.10 backend rollout preserved existing Space/member/Event/Task row counts and identity/invite fingerprints. The user subsequently completed the first A/B authenticated acceptance; Personal Spaces are now created by the deployed Slice 2 bootstrap. The old v0.1.9 runtime is not a safe rollback target for an account with a Personal Space. Any older-account bulk backfill remains outside Slice 2 and requires a separate review. Production Task count was 0 at backend rollout, so historical Task disable/re-enable remains locally verified rather than Production-tested.
- v0.1.10 is closed with Shared Spaces retaining the two-member limit. It does not include cross-Space aggregation, final four-destination navigation, global `+`, Lists / Important Dates / Review implementation, or module-state Realtime. The observed member refresh behavior is a known characteristic and future consideration; it does not reopen v0.1.10.
- `V019_SLICE2_UI_FROZEN` / `SLICE 2 IMPLEMENTED / MANUAL AUTH ACCEPTANCE PASS`: Calendar header `共享空间 · {space.name}` opens the current Space Hub; its only module entry is Tasks. Open Tasks and separate Completed Tasks use the existing Space-scoped contract. Empty `profiles.display_name` may use contextual `我 / 对方` only in the current two-member v0.1.9 UI; this is not a durable partner identity, and future Multi-space / multi-member UI uses generic member display logic. Space-entry navigation and 320px layout passed user-run acceptance; extreme-width name ellipsis is accepted.
- Slice 1 uses direct PostgREST CRUD with four member-scoped RLS policies, no Task RPC, one exact-order list index, and a PostgreSQL 17.6-verified composite FK whose column-specific delete action clears only `assigned_to_user_id` when a member leaves.
- A Task is Space-scoped work that remains to be completed. Assignment does not restrict visibility, ordinary edits, reassignment, or deletion; null means shared. Shared status transitions belong to any current member, while assigned status transitions require the assignee from before the UPDATE. A takeover and completion require separate UPDATEs; RLS and the corrective DB trigger remain authoritative.
- Task status is only `open` / `completed`; `due_on` is optional date-only metadata. v0.1.9 has no completion audit, Task Reminder, recurrence, Task/Event dual persistence, Multi-space implementation, or UI overhaul.
- Multi-space decision is `MULTISPACE_NOT_REQUIRED_FOR_V019`. Task persistence must always use explicit `space_id` and introduce no new one-space-only assumption.
- Event ownership uses stable `scope + owner_user_id`; UI labels are derived from the current user.
- Personal events are visible to both members but only editable/deletable by the owner.
- Existing event identity fields must not change: `space_id`, `created_by`, `scope`, `owner_user_id`.
- Supabase RLS and database triggers remain the final permission boundary.
- v0.1.4 uses only `profiles.display_name`, which is nullable and constrained to trimmed 1–20-character values. UI fallback is 「成员」; shared remains 「共同」.
- New profiles default to a null display name, never an Auth metadata or email-derived public name.
- No `space_members.nickname`, no profile/member Realtime subscription, and no RLS policy changes were added. A name change updates the saving device immediately; other sessions refresh/re-enter to see it.
- The current Production Supabase patch and SQL/RLS verification passed on 2026-07-11. Local two-account desktop smoke and deployed-frontend Production desktop smoke passed.
- Resend SMTP + Supabase Auth passwordless template deliver 8-digit Email OTP in Production. Email OTP removes Magic Link return handling; Safari and standalone PWA retain separate session storage and each complete login directly with the code.
- New-user first-login, new-space creation, and profiles/display_name behavior passed in v0.1.5 Production acceptance. The single-member-space path remains intentionally unverified.
- v0.1.6 recurrence rules are source-event metadata only. Existing event identity fields remain immutable; no recurrence table, occurrence materialization, exception model, RLS change, Realtime configuration change, reminder, or notification work is included. v0.1.6.2 projects only the current Today/Week/Month visible range and uses occurrence IDs only as display keys; v0.1.6.3 writes recurrence rules only on source events and labels all recurring edits/deletes as whole-series actions.
- The original v0.1.7 design is in `docs/RECURRENCE_EXCEPTIONS_DESIGN.md`. Its exception foundation, projection, database RPCs, and v0.1.7.3.3.2 only-this / this-and-future UI are implemented. Logical-series deletion UI remains deliberately deferred; exception Realtime publication remains future work.
- v0.1.7.1 foundation is present in the local schema and its 18-test pgTAP suite passes. v0.1.7.2 has a compatible reader/projection implementation. v0.1.7.3.3.2 supports only-this and this-and-future mutation UI; logical-series deletion UI and exception Realtime publication/subscriptions remain deliberately deferred.
- v0.1.7.3 treats `series_id` as the logical root and `parent_event_id` as the immediate predecessor. The final split RPC moves future exceptions to the child, consumes a split-day override, rejects a split-day deletion, preserves source recurrence rule/all-day, and requires the child to start on the selected occurrence date. The actual exception schema uses `event_id`, `occurrence_date`, `exception_type`, and `override_data`; the v0.1.7.3.3.2 client relies on the RPC for all transaction work.
- Final Production recurrence smoke passed on Desktop and iPhone Standalone PWA for all four supported occurrence actions. iOS Standalone PWA cannot actively refresh itself due to an iOS system limitation; this is not an application defect.
- `supabase/config.toml` uses a stable local `project_id` and configures a local 8-digit Mailpit OTP template plus the port-5175 redirect URL. The local Docker/Supabase stack was recovered without reset or volume deletion; C1 pgTAP 63/63 and all database regressions 161/161 passed.
- The engine uses native `Intl` IANA timezone formatting/conversion and rejects invalid rule shapes at both client and database boundaries. It returns an explicit error instead of a partial result after 500 candidates.
- C2 Phase 2 pre-implementation review identified a reproducible DST-gap CPU blocker in the legacy 2161-point minute fallback. The corrective patch preserves the existing minute-grid outputs while using the fixed-point candidates to bracket and binary-search proven forward gaps. Same-machine 1000-call Deno improved from `7099.71 ms` to `144.06 ms`; human review passed and `DUE_CALCULATOR_CPU_BLOCKER = RESOLVED / PASS`.
- v0.1.8.2 supersedes the earlier `events.reminder_offset_minutes` proposal. One event-level nullable `events.reminder_kind` supports `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder. Multiple reminders, JSON reminder config, arbitrary custom minutes, and per-user reminder preferences remain outside this version.
- `events.time_zone` is the nullable canonical IANA timezone of the Event. New events detect it from the creating browser/PWA with standard `Intl` capability; later device timezone changes never silently rewrite an existing Event. Historical ordinary timezone remains null rather than guessed, while historical recurring sources may initialize it from their already-authoritative rule timezone. Recurring Event `time_zone` must equal `recurrence_rule.time_zone`, so there is only one authoritative timezone.
- New UI-created timed events default to `timed_10m_before`; new UI-created all-day events default to `all_day_same_day_08`. Database defaults and all historical events remain `reminder_kind = null`; historical ordinary Event timezone is not guessed or bulk-backfilled.
- Timed-to-all-day conversion maps a non-null timed reminder to `all_day_same_day_08`; all-day-to-timed maps a non-null all-day reminder to `timed_10m_before`; null remains null and the UI must show the resulting option. Multi-day reminders anchor only to the start and ignore `ends_at`.
- v0.1.8.1 Push Infrastructure is closed and passed on Desktop Chrome/macOS and iPhone installed PWA. `push_subscriptions` uses RPC-only authenticated browser writes, `send-test-push` owns server-side VAPID delivery, and the private key remains only in Supabase secrets. Safe diagnostics expose only upstream `status`, `delivered`, hostname-only `provider`, and `gone`. `@mmmike/web-push@1.3.0` remains an exact function-level dependency; no root/browser dependency was added.
- The initial Desktop Chrome subscription was abnormal/stale: FCM accepted the send (`201`, `delivered = true`) but no notification appeared. Closing notifications, unsubscribing, and creating a fresh subscription restored Desktop test-push delivery. For similar Push symptoms, try retry, unsubscribe/resubscribe, and browser/PWA restart before deeper RCA.
- Standard Web Push is the delivery channel. The Push Service Worker handles Push only and must not introduce offline caching. Desktop/macOS and iPhone acceptance passed. Android Studio Emulator permission/subscription, test Push, ordinary automatic Reminder, audible presentation, and notification-shade delivery passed; the supplied evidence does not establish physical-device heads-up behavior, and no notification-click PASS is asserted beyond the evidence provided.
- Push subscriptions bind to `user + installation`, never to a Space, and one user may retain multiple active device/browser subscriptions. This persistence model remains compatible with a future multi-space schema without implementing multi-space in v0.1.8.
- shared event reminders resolve current active Space members at send time; personal event reminders resolve only the current `owner_user_id`. A former member must not receive a delivery.
- v0.1.8 uses one active once-per-minute Supabase Cron + Edge Function sender. Slice 2 ordinary Event delivery and Slice 3 recurring delivery are closed in Production. Slice 3 dynamically projects recurring occurrences through canonical recurrence/exception semantics within a bounded timezone-aware window and does not materialize a future horizon.
- Slice 3 Reminder projection passes a non-mutating `ends_at = null` view to the canonical engine because Reminder due semantics depend only on effective occurrence start. The canonical calendar engine and its 500-candidate duration-overlap guard remain unchanged.
- Deployed Slice 3 extends ledger identity with nullable `occurrence_date`: ordinary rows keep NULL and retain `(event_id, subscription_id, due_at)` behavior through `NULLS NOT DISTINCT`; recurring rows use logical series ID plus scheduled occurrence date, subscription, and due. No queue, future rows, retry framework, or occurrence table was added.
- Slice C1 implementation, verification, human review, Production deployment, ACL correction, and final postflight are complete. The original patch created the empty durable ledger and atomic claim function; RCA isolated its ACL gate failure to the `postgres`/`public` default table ACL, and the reviewed table-local correction reduced `service_role` to SELECT / UPDATE only. `C1_PRODUCTION_FOUNDATION = PASS`. Audit rows intentionally have no Event/user/subscription foreign keys. The schedule marker must still round-trip at full PostgreSQL `timestamptz` precision.
- Slice C2 Phase 1 extracts Web Push sending into a server-only shared module with a closed safe result union and keeps `send-test-push` externally unchanged. Automated verification and Desktop/iPhone real-device regression passed after deploying only `send-test-push`. Repeated Desktop banners with the fixed `shared-calendar-test` tag are pre-existing/non-blocking; tag/renotify behavior remains unchanged. The later C2 scan must abort before claims/sends when enabled ordinary Events exceed 1000, and must sort eligible tasks by `due_at` ascending before capping at 50; no queue is added.
- Slice C2 Phase 2 `send-reminders` passed bounded human/code review with no BLOCKER / MAJOR / MINOR findings and completed P3B Production manual acceptance. It uses stable 100-row keyset pages plus an explicit 1001st-row probe, aborts overflow before recipient/claim/send work, preserves the raw C1 schedule marker, resolves current memberships and active subscriptions in batches, selects at most 50 tasks deterministically, uses five workers, and rechecks the 95-second budget immediately before claim acquisition. It adds no retry, lease, queue, recurring delivery, schema, or dependency. P3B delivered one iPhone Reminder, finalized two ledger rows, and passed idempotency; Mac visible delivery was initially suppressed by Sleep/Focus and later send-test-push regression passed after that state was cleared.
- P3C enabled only Vault, `pg_cron`, and `pg_net`, then created exactly one active once-per-minute scheduler whose stored command performs the `REMINDER_CRON_SECRET` Vault lookup at execution time. Automatic no-due and real iPhone/Mac Reminder delivery passed without manual invocation. Two subscription-specific ledger rows finalized as `sent`; repeated scheduler runs created no duplicate row or send. The canonical failure containment is to unschedule `send-reminders-every-minute` first, before diagnosis.
- A newly created/edited/enabled reminder whose derived `due_at` is already past is skipped without immediate Push or compensation. Normal target precision is about one minute; a roughly ten-minute grace window applies only to infrastructure delay. Web Push remains best-effort and is not an Alarm Clock.
- Future consideration — Web/PWA Push delivery precision: semantic Reminder due calculation remains exact, while once-per-minute `pg_cron` + async `pg_net` + Web Push may occasionally add sub-minute to approximately one-minute visible delivery latency. The observed recurring example had semantic due 11:45 and claim/finalize around 11:46; this is not a due-calculation defect. v0.1.8 adds no `-60s` early-dispatch allowance and keeps ordinary/recurring timing under the same semantic rule. Revisit only if real-use feedback shows material UX impact or a future native iOS/Android app adopts OS-level local notification scheduling.
- Future consideration — physical Android heads-up presentation: functional delivery passed on Android Studio Emulator, including sound and notification-shade presence, but no heads-up banner was observed and physical hardware presentation was not validated. This may be casually revalidated on a physical Android device later; it is non-blocking and does not reopen v0.1.8.
- v0.1.8 excludes Email reminder delivery, SMS, Bark, multiple reminders, arbitrary custom minutes, snooze, sound customization, notification inbox/history, native alarms, and per-user reminder preferences. Email OTP authentication remains unchanged.
- `v0.1.9 Shared Tasks` Slice 1/2/3 are CLOSED / PASS: backend applied/postflight verified, frontend deployed through Vercel, Desktop A/B Production acceptance and iPhone smoke passed. At the v0.1.13 closeout, Structured Review / Check-in and Shared Lists were future candidates; v0.1.14/14.1 subsequently closed, and Shared Lists was selected for v0.1.15. Its design is frozen and Slice 1 DB foundation is `CLOSED / PASS` after Production postflight.

## Handoff Prompt

v0.1.19 CLOSED / PASS：backend exact SQL/postflight、ACTIVE v4/verify_jwt=false、唯一 Cron、已发布 frontend/target alignment 与用户 local/Production/installed-PWA/2026-10-07 晚间真实 Task Push PASS。只读 ledger/Cron 佐证与 HTTP 保留/设备展示限制见 TESTING；不扩大旧 overflow 或 post-check→provider best-effort 边界。本轮只做治理 docs closeout commit、不 push；最终 REMOTE_SYNCED 须最后授权 push 后独立验证。下一阶段等用户提供其他项目 lessons learned，先阅读再定 PWA 手势交互体验评估范围，不预设方案/版本。Market Validation / Commercialization Study 保留且本轮不启动。
