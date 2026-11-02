# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.21

## Current status

2026-11-02 — **Slice 5 Reminder Capacity CLOSED / PASS；v0.1.21 CLOSED / PASS（已接受范围）**。用户明确接受Production观察并授权收口。Slices 2–5 CLOSED / PASS；Slice 1仍DEFERRED，未实施、未完成，风险POTENTIAL/数据库实测NOT VERIFIED保留。仓库BACKLOG允许NO ACTION / DEFERRED、不强制全部修复，据此关闭已接受版本范围，不抹去暂缓项。Notification Cleanup用户确认不需要，不是未解决缺陷。后续回顾编辑入口为独立本地UI follow-up，不重新打开已关闭Slice。下方Pending/HOLD均为历史。

## Latest completed

业务发布48b032907929576bbb34a465b087f2d2afb463e0；send-reminders ACTIVE v6、verify_jwt=false，三份改动源码独立回读一致；用户REST Gate 2 PASS（非空仅2条），全量Node1066/1066、针对85/85、类型/Build/语法/diff通过，Vercel Source匹配。用户提供Dashboard截图并确认可接受：部署约12分钟，新版以来11次调用无报告错误；最近一小时57次调用、4xx/5xx均0%，页面平均1554ms/最大8998ms。小时汇总跨越旧/新版本，不全部归属v6；无Production高负载或重复发送E2E实测。部署后唯一Cron复核曾超时，发布前确认唯一active每分钟任务，本次未修改调度。上述观察与边界不阻碍用户已接受范围收口；不补造人工故障/负载PASS。

## Deployment

业务发布48b032907929576bbb34a465b087f2d2afb463e0；send-reminders ACTIVE v6、verify_jwt=false，三份改动源码独立回读一致；用户REST Gate 2 PASS（非空仅2条），全量Node1066/1066、针对85/85、类型/Build/语法/diff通过，Vercel Source匹配。用户提供Dashboard截图并确认可接受：部署约12分钟，新版以来11次调用无报告错误；最近一小时57次调用、4xx/5xx均0%，页面平均1554ms/最大8998ms。小时汇总跨越旧/新版本，不全部归属v6；无Production高负载或重复发送E2E实测。部署后唯一Cron复核曾超时，发布前确认唯一active每分钟任务，本次未修改调度。上述观察与边界不阻碍用户已接受范围收口；不补造人工故障/负载PASS。

本轮仅治理收口Commit/正常Push；业务资源及Edge未改，不将自动Vercel治理部署当新业务验收。

2026-11-02：本次仅按既有CLI流程发布send-reminders，保留verify_jwt=false、Secrets变量合同及既有唯一每分钟调度；不部署数据库或配置。发布前独立CLI读取为ACTIVE v5。实际新版本、三份源码回读、调度/运行摘要及Vercel Source以`/private/tmp/calendar-slice5-release-20261102/RELEASE_RECEIPT.md`记录；不预写成功，Vercel不能替代Edge部署证据。用户REST非空仅2条，不声明20条真实负载或长期性能已验证。下方未发布为历史检查点。

2026-11-01：本次发布止于Gate 2，未Commit/Push，未触发新Vercel部署，未部署send-reminders；不修改schema/RLS/RPC/索引/环境/verify_jwt/调度。实际当前Edge版本、ACTIVE与调度健康未独立核验，不能预写部署后观察PASS。

2026-10-30：容量预过滤只改本地send-reminders Edge源码/直接测试；无SQL、RLS、RPC、Cron、部署配置或客户端变化，尚未部署。后续需要用户另行授权Edge发布，不以Vercel前端部署代替后端发布。

已验收业务Source e5a3cf152cb68cf822c34c090bc831906f339f53 / Production7407802024 success、七项资源与Build一致、Supabase ximazjhxvmktpcdbypka。用户最终Production PWA验收PASS。本次仅治理收口，不改资源/后端；Git集成如自动部署，其实绩由执行报告核验，不预写成功。下方Pending为历史。

本次Follow-up按授权origin/main→既有Vercel Production发布；实际Source SHA/部署成功、七项资源和目标以`/private/tmp/calendar-create-wait-release/RELEASE_RECEIPT.md`核验，不以Push替代发布证据。无后端能力/配置变更，沿用用户已验收核心创建基线，最终提示体验待用户确认。下方旧部署为历史。

本次Slice 4按用户授权经origin/main与既有Vercel Production集成发布；实际Source SHA、部署状态、七项资源/Supabase目标及Git结果以`/private/tmp/calendar-slice4-release/RELEASE_RECEIPT.md`为准，不以Push代替部署证据。无后端变更，Production catalog与真实写入未验证。下方未发布为历史。

2026-10-29 — Slice 4仅本地实施和验证，未Commit/Push/Deploy，本轮未改变Production；发布与真实用户验收另行授权。Slice 3已验收业务基线b90b81b6eac5dcee85e084e3e123b41260bc97f7保持；本次开始时Git基线02f271468599a7dee97b2f0e43da3364848fe0d7。未执行Production数据库探测/写入。

已验收业务Source b90b81b6eac5dcee85e084e3e123b41260bc97f7 / Vercel Production7403767389 success，七项资源与Build一致，目标ximazjhxvmktpcdbypka。用户最终Production PWA验收PASS；本次仅文档收口，允许既有Git集成自动部署，实绩由本轮报告确认，无后端或配置变更。

Snapshot补丁采用已授权origin/main→既有Vercel Production发布；实际Source、success状态、七项资源与本地Build逐字节比对及Supabase目标由`/private/tmp/calendar-snapshot-release-20261029/RELEASE_RECEIPT.md`记录，不以Push替代部署证据。无数据库/RLS/RPC/Realtime或保存规则变化；发布前a9fd99ae仅作历史与兼容回退参考，异常停止报告、不自动回退。

Slice 3本次获授权通过origin/main→既有Vercel Production发布；实际Source SHA、success状态、七项公开资源与Build比对及Supabase目标由`/private/tmp/calendar-v0121-slice3-release-20261028/RELEASE_RECEIPT.md`核验记录，不以本地Build或Push替代部署证据。无数据库/RLS/RPC/Realtime配置变化；发布前Production基线66d024d6（业务412ad4f8）仅作历史与兼容回退参考，异常时停止报告，不自动回退。

最终业务基线 `412ad4f8c5ac3ce13df7d46f6a9d8f2d2890269b` 已部署 Production（GitHub `7379031279` success、Source 匹配，7/7 公开资源与 Build 逐字节一致）；用户确认最终视觉满意并结束本轮。收口仅治理文档，允许既有 Vercel Git 集成自动部署；其执行与资源核验结果由本轮报告确认，不预写部署成功。无数据库或配置变更；下方旧部署为历史。

Slice 2已验收功能Source Commit：`069f6fe5e22356991ee4eda2d409f6a100886ff8`；Vercel官方GitHub集成Production Deployment `7374948037` / Vercel `8i4etxVi573b447kmC1aZzbYZom1` success，Source匹配，正式HTML/JS/CSS/manifest/SW/两个图标7/7与Build逐字节一致。公开Supabase目标为ximazjhxvmktpcdbypka，数据库及缓存验证PASS，用户随后确认Production真实验收全部PASS；Review维护已解除。

本轮仅文档收口，正常Git Push可触发现有Vercel自动部署，不手动二次部署或更改配置；已验收业务资源保持。治理部署精确Source/状态及资源核验由`/private/tmp/calendar-v0121-slice2-closeout-20261028/`独立回执记录，不预写未发生的结果、不把治理SHA变化当业务变化。原功能发布证据在`/private/tmp/calendar-v0121-slice2-release-20261028/RELEASE_RECEIPT.md`。无需重复已PASS的整轮真实验收；下方旧部署记录为历史。

已验收业务代码基线 `b021a41d4d02543e565a121ba6a8cdb17c988361`，GitHub Production Deployment `7114613389` / Vercel `jcaKrzrRQuptpwkHUGi2P8Udey2U` success，Source SHA与该业务提交一致。正式HTML/JS/CSS/manifest/SW/图标7项正常且与已验证Build逐字节一致，公开后台目标/客户端/VAPID及后端能力契约保持；用户其后明确确认本补充正式installed iPhone PWA六项全部PASS。此前整轮e70c66f的六项正式PWA PASS保留，Production release及本轮PWA验收均已完成。

本次仅治理文档Commit/正常Push；既有Git集成允许自动触发docs-only部署，不手动部署或修改配置。若部署Source SHA更新为治理提交，已验收业务代码仍来自b021a41；实际治理部署/资源一致性由 `/private/tmp/calendar-v020-closeout/` 独立核验记录，不把SHA更新误写为产品功能变化，不要求重复整轮人工验收。以下部署记录均为历史检查点，其旧Pending不代表当前未验收。

本轮Space筛选器发布前main/origin-main基线为afd6e35a331af2d58db4cf5c4c16e3650928103e；用户已授权正常Commit/Push及GitHub→Vercel自动Production前端发布，不主动手动部署或改配置。实际部署成功状态、精确Source SHA及正式静态资源核验由本次独立发布报告记录，不能用发布授权代替部署证据。用户认证本地5175 iPhone Safari已PASS；Production installed PWA用户最终验收仍Pending。本地Build公开后台目标与已验收Production一致，无新后端能力/配置要求。

本轮删除确认与清单分组修复对应的Production应用基线为 `8d7fb252c60b75688d0a736be6f761c0506ff0b5`，GitHub Production deployment 7093050865 / Vercel `HSqce4foW3jffYGfjpmRi5rAdrKw` success。用户已确认该正式iPhone PWA验收PASS。其业务前端实现来自 `b0487c106cc654dc72de5054191480376b9aacc8`；后续8d7fb25为已核验的docs-only发布记录，正式JS/CSS/manifest/SW与通过Build一致。本轮治理收口仅修改文档，不主动触发部署或修改Production配置。

本轮UI首个功能Production Source：`b0487c106cc654dc72de5054191480376b9aacc8`，GitHub部署 7092894811、Vercel 2jNzviS264gyfMpKzzpNkXGVMHMy 均success。正式域名JS `/assets/index-DYnsqgws.js`、CSS `/assets/index-CgQs3Nqx.css`、manifest及SW成功获取且与本地Build逐字节一致；新焦点/内容/外壳标识均存在，公开后端客户端/VAPID配置与已验证Build匹配。375px正式无登录首页渲染PASS，零pageerror/后台请求。固定部署地址受Vercel登录保护，本轮不登录或绕过；Source以vercel[bot]的正确仓库/Production/精确SHA记录核对，资产以正式公开域名核对。

本条是首个功能部署时的静态资源与无登录首页证据，不单独证明真实PWA验收。后续docs-only Source `8d7fb252c60b75688d0a736be6f761c0506ff0b5` 及Production deployment 7093050865 / Vercel `HSqce4foW3jffYGfjpmRi5rAdrKw` 已核验成功，用户其后确认该Production iPhone PWA验收PASS，见本节顶部最终状态。没有数据库/Edge/Cron/Auth/业务数据操作，未更改生产配置。此前5e17194及下方记录均为历史部署证据。

Review最终修复 + 确认UI首个功能Production Source d514b71d348d74dc12ebe46345b475c163d08b25（Review提交8f5efd1）。GitHub7089323536 / VercelBZbyFYcM8Erdbq19VmWA3NEFEruv success；正式域名HTML/JS/CSS/manifest/sw200，JS/CSS与本地Build一致，Supabase目标与既有VAPID公钥匹配。后续已授权docs-only发布记录Source与最终main由本轮独立报告核验；本条仅记录首个功能发布，不推断永久最新。最后Production iPhone PWA验收仍PENDING，无后端重复部署。

本轮Review最终修复/确认UI的发布前基线305681eda48311052604043aa140102efda14b38；前端Git→Vercel发布由用户单独授权，精确新Source/部署ID/公开资源结论以本轮独立发布记录为准。Review删除后端已完成且不重放；最终Production iPhone PWA人工验收PENDING。

2026-10-15 Review删除后端：Production ximazjhxvmktpcdbypka已通过现有Management API应用2026-10-15-review-delete.sql一次，SHA25620aeff18f86e36d6e3328cc34c10421472ab315d3bfc5c17aa3b11dc49dc107d；定义/ACL/既有Review契约及数据指纹只读核验PASS，无生产删除RPC调用。5175后端目标/新代码对齐，前端仍305681e，等待用户真实验收与后续Git发布授权。

Event Collaboration后台：用户SQL已应用且8函数/ACL/RLS/RPC核验PASS；send-reminders ACTIVE v5 / verify_jwt=false，部署元数据SHA95f02fb496854b8e2c4b085545468b69b7bd06f27f8cc9df24fc75ce14dcb72f，13运行时源码下载匹配。原Job1 schedule及MD5 cd0c5b049c9c1ca9f564c2b1895c00d1保持；自然健康及用户真实Push A→B接收人验收已通过。本轮不再操作后台。

首个Event Collaboration + Review功能前端Production Source：2c233e842733fe9c3a916fdbf672860fd26e023f；GitHub Production deployment7087198195 / VercelAsgVoZ7BxNZaodeG3anCQ3XHu5En success，项目与精确SHA匹配。正式域名 https://cross-platform-shared-calendar.vercel.app/ 的HTML/JS/CSS/manifest/sw200，JS/CSS与最终本地Build逐字节一致、VAPID原公钥与服务端匹配，.env.local未提交。后续本轮已授权docs-only发布记录拥有独立Source，不能把功能发布SHA冒充始终最新的治理SHA；最终最新Source在独立发布报告核对。最终Safari/iPhone PWA人工验收PENDING，整体未CLOSED。

日期/表单修复 Production Source：2204b30fee3e00d116d902c6925b33239b6409dc；Vercel 7bvzSyKWKASGCmF1zzydaZygRXJM / GitHub deployment7073484012，部署 success；正式HTML/JS/CSS/manifest/SW HTTP200，CSS与本地构建一致。用户确认上述四项 iPhone PWA PASS。该段记录日期/表单修复的历史部署；后续回顾创建局部修复已获本地验收，并随上方2c233e8功能版本发布，最终Production设备验收仍待用户反馈；未修改生产数据、配置或后端。正式域名 https://cross-platform-shared-calendar.vercel.app/ 。上一版0fe85e8的iPhone问题与旧Pending记录保留为历史证据。

本轮日历创建与我的标题沿用origin/main → Vercel自动Production部署；部署成功、精确Source SHA和公开资源以发布核验报告的实测结果为准。Production/PWA真实人工验收PENDING，不能由部署成功推断PASS。真实Vite固定5175与Production项目ximazjhxvmktpcdbypka已对齐，既有Event/成员契约limit0 HTTP200；无新Schema/RPC/Edge要求、不改后端。正式域名：https://cross-platform-shared-calendar.vercel.app/ 。

Profile Card Compact + Avatar v1功能发布：Vercel Production成功，GitHub deployment7063583427 / Vercel9CJitJKsrtz1TRo9iYRfoW6491qa，Source SHA精确匹配fcd3c8ad1b91bd7ec137c331e3d721ea8fae6cac。正式域名HTML/JS/CSS/12SVG/manifest/SW HTTP200，新Profile/Avatar标识存在，CSS与本地build一致，12头像逐字匹配（猫F+02）；JS与本地构建字节完全相等未建立，不扩大该证据。用户现确认正式网站人工PASS，Avatar与Space Rename均CLOSED / PASS。此SHA标识已验收的功能发布，不声称docs-only提交也为同一部署SHA。

Production项目ximazjhxvmktpcdbypka；Avatar准确补丁已由用户报告执行Success，Preflight/核心Postflight通过。本轮不执行SQL、Storage/RLS/RPC变更或数据清理。旧照片切回预设后删除已获用户确认；不确定metadata响应保留上传文件，依既有>24h未引用恢复。签名最多5分钟，撤销最后共同Space阻止新签的真实边界未完整人工验证，不承诺已有签名即时撤销。

UI v2及后续 Calendar 视觉优化已完成 Production 发布与用户验收，状态为 **PRODUCTION ACCEPTED / CLOSED**（关闭范围仅限本次 UI 改造与相应验收）。UI v2全部11个Slice、两轮Integration、功能中心概览、Calendar UI Patch与Chevron Removal均已完成；Calendar Patch Commit `391708f4…`，Chevron Commit `ecbe03d7…`，Chevron已验收的部署 source HEAD 为 `1fc7a3bd…`。

自动化证据：全量测试919/919、响应式检查180/180、Build PASS；已知 bundle 大小警告非阻塞。无需 Supabase migration，正式版本保持v0.1.20。此状态不扩大为完整业务E2E、危险操作、Push或Realtime全覆盖；P2字重审美、Space Color System、多人共享空间/回顾与跨Space投影等继续Deferred，农历为候选功能且未来周视图位置优先每日区域右上角。

以下 Slice 部署段落保留为各自当时的历史记录，不表示当前 UI 未发布。

Slice11 = LOCAL PASS / VISUAL ACCEPTED，授权本地Git closeout已完成；新My/Space UI未push/deploy，Production v0.1.20保持。原生dirty确认E2E及真实账号/设备/PWA/Realtime/Production集成验收Pending；UI v2 11个Slice完成本地阶段，整体尚未完成集成验收或发布。
Slice10已完成本地自动检查、离线视觉验收及本地Git closeout；用户已确认整体视觉。正式Production v0.1.20及线上部署不变，新重要日UI没有push/deploy。真实账号/双账号、设备/PWA/Realtime/Production验收留到UI v2最终集成阶段。

Slice9 = LOCAL PASS / VISUAL PROVISIONALLY ACCEPTED，已完成一个本地commit，未push/deploy，新清单UI未发布。真实账号/双账号、设备软键盘/Safe Area、PWA、Realtime及Production未验收。最终中文字体栈、字重层级和行内操作排版复核Deferred。


Slice8用户离线视觉验收PASS，并按授权完成本地Git closeout；新回顾UI尚未push/deploy。真实账号、双账号、设备/PWA与Production验收仍待后续安排。下方Production记录为既有版本历史证据。

Slice7 = LOCAL PASS / VISUAL PASS，已完成本地commit，未push/deploy；新任务UI未发布。真实账号、iOS/Android、installed PWA与Production未验收。

Slice6 = LOCAL PASS / VISUAL PASS，已完成本地commit，未push/deploy。UI v2 Slice1–4仅本地实现/commit；Slice4为LOCAL PASS / VISUAL PROVISIONALLY ACCEPTED。Slice5月视图已LOCAL PASS / VISUAL PASS并完成本地commit；未push/deploy。新UI尚未发布到Production。下方Production与真实设备PASS仅为既有版本历史证据，不代表本轮UI已发布或通过真实设备验收。

v0.1.20: Production frontend 已发布。实施 revision `2534a4085b9a5d64c488aa2b8975fa1a817460dd` 正常 push 后由独立 git ls-remote 确认；GitHub Production deployment `6937002413` / Vercel `8djfXCjoR5pBhkPoAyZ6D4yphSDM` 于 2026-10-08T13:35:45Z success，source SHA 精确匹配。正式域名 root/新 JS/CSS/manifest/SW HTTP 200；默认与绕缓存入口均使用新 JS，Supabase target 与原 Production 一致。用户 iPhone installed-PWA 13/13 PASS。独立部署 URL 的资产对比 NOT VERIFIED（未返回应用脚本），不扩大既有验证结论。backend/SQL/RPC/Edge/scheduler/config 未变；无 fresh live backend postflight。最终 docs closeout `c316b60c14694c0c2c831fd65d7130b4839d03aa` 已正常 push 并独立核验；该次 GitHub Production deployment `6937387220` / Vercel `5Lk9zsDDw4TyKZ6dYPnR3y1zAUbF` 于 2026-10-08T13:52:02Z success，source SHA 匹配。以上为已完成发布记录；本轮方向冻结不发布新前端，也不宣称本轮新文档已同步。

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

- v0.1.21 — CLOSED / PASS（已接受范围Slices 2–5）；Slice 1 DEFERRED、未完成，Notification Cleanup用户确认不需要。
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

- v0.1.20 — Mobile Gesture Navigation（CLOSED / PASS；实施/review/788 自动测试、Production 发布核验、用户 iPhone installed PWA 13/13 人工 PASS）；后续全域UI/UX一致性及表单Space补充亦 CLOSED / PASS（最终Node990/990、WebKit/Chrome105/105，用户两组六项正式PWA均PASS，2026-10-16治理收口）

## Last verified

2026-10-29 — 范围补丁相关Node128/128、全量1020/1020、Browser28/28、TypeScript/Build/语法/diff-check PASS；仅既有bundle提示。四项源码/测试及Build指纹、详细命令/边界见TESTING首节及临时日志目录；未做真实账号或Production验收。

2026-10-28 — 发布前四项源码/测试SHA256锁定并核对保持；重新Build与保留产物逐字节一致，TypeScript/语法/diff检查及官方生产依赖audit0通过。沿用Node1013/1013、Browser96/96，无新真实账号测试或后端能力变化。

2026-10-28 — Slice 3相关Node96/96、全量1013/1013、双引擎Browser96/96、tsc/build及语法/diff-check PASS；无真实登录态自动验收或Production业务操作。环境Gate基于公开Build目标与已验收后台契约保持一致；详见TESTING首节。

2026-10-28 — Follow-up 最终发布与自动化证据见 Current status / TESTING；本次只做 docs 差异、非治理树、治理门禁及 Push 后只读核验，不把旧真机未执行项转为 PASS。

2026-10-17 — Slice2本地：Node996/996、直接21/21、DB升级/全新432项及12个观察锁等待顺序、本地PostgREST8/8、WebKit/Chrome新增14/14及既有Review10/10、TypeScript/Build/语法/diff-check通过；额外Review删除回归双路径通过。无Production/真实设备验收或部署，外部证据/private/tmp/calendar-v0121-slice2-implementation/。

2026-10-16 — 用户明确确认整轮六项及补充六项正式installed iPhone PWA全部PASS；业务代码b021a41的最终Node990/990、Browser105/105、TS/Build/语法/diff-check及Production Source/7项资源逐字节一致证据沿用，无代码变更。收口前main/HEAD/origin-main/远端main一致、clean，最新Production仍为b021a41且静态资源与已验收业务发布一致。本次只验证docs-only/diff/治理门禁，不重跑业务测试；Governance Push/自动部署实绩见独立收口报告。

2026-10-16 — 全量Node990/990（无失败/跳过）、现有原并行Browser81/81（UI26/筛选26/删除18/Space手势11）PASS；上次Chrome Calendar原生tap超时本轮未复现，未改timeout或删除断言。TypeScript/Production Build、脚本语法、diff-check通过，生产依赖audit0；旧大chunk提示保持。真实四模块375/430标题20px600/筛选y76/空文字60px/折叠44px与12px节奏、Review两Sheet底距0，最终截图和测量通过；首页16px600的10场景原证据与最终源码/CSS一致。提交前Production公开目标/anon客户端/VAPID与新Build一致，无后台能力变化；发布后Source和正式资产由独立报告核验，不驱动真实Session。

## Next Action

独立回顾详情编辑入口UI follow-up：仅本地实现及测试，等待用户手机/PWA验收与另行发布授权；不重开Slices 2–5，不实施Slice 1或Notification Cleanup。

## Blockers

暂无明确阻塞。

## Important Context

Slice 5 Gate 2已按用户真实Production证据PASS，不要求重复SQL/REST/钥匙串操作。Notification Cleanup由用户确认无需开发，历史通知自行管理；不是本版本待修缺陷。OTP独立待办仍待核查，不改认证。Slices 2–4 CLOSED / PASS、Slice 1 DEFERRED保持。

- v0.1.21 Slices 2–4已CLOSED / PASS，整体未完成。回顾边缘返回/完成入口独立 Follow-up 已按实际验收范围关闭，创建默认空间待产品讨论，对方状态短延迟暂观察；不在收口中扩大手势或Realtime范围。

- 本次仅复用 Space 筛选菜单的展示/交互能力，表单禁止“全部空间”；父级保留资格、ownership、默认值、编辑不可迁移限制、草稿及提交验证。此前“不重做筛选器”仍有效：只增加默认关闭的弹窗模式，原页面筛选器无重新设计。

- 当前UX-01至UX-09范围以2026-10-16冻结决定为准；不重做SpaceFilterDropdown、不改变筛选资格/独立记忆/新建默认、日历时间、底栏结构、删除规则、Auth/OTP或Push订阅业务。UX-07仅修本轮明确指向具体Space的名称，不批量替换类型说明。

- Avatar正式Production人工验收已由用户确认PASS；照片权限复用已审核私有Storage/本人Profile边界。未完整验证的跨设备/续期/撤销等边界继续保留，不以整体关闭推断全部场景通过。

- Production验收通过仅覆盖本记录的 UI 改造与用户确认场景；不声称所有业务 E2E、危险操作、Push 或 Realtime 均已覆盖。对应的旧交互保护缺口、测试边界和 Deferred 项继续按各自历史记录保留。

- Round2只统一表单展示：Task默认直接关闭、模块dirty/moduleMutation与重要日模块Emoji范围不变；默认重要日名称初始焦点保持。Event/默认Task同步防护非全覆盖、三表单通用IME缺口和既有焦点兜底局限未修复。预览为最新真实React+内存fixture，不代表真实账号/真机/PWA验收。

- Slice11视觉已获用户确认，本地自动化和离线预览通过。App核心选择/刷新/底栏/导航和Lifecycle确认/RPC链路保持，个人Space保护与Shared最多两人不变。内嵌浏览器原生dirty确认驱动超时并保留输入；接受/拒绝分支自动通过，完整原生浏览器E2E仍Pending。真实账号及设备/PWA/Realtime/Production验收待最终集成阶段。

- Slice10日期引擎、API/提醒与canonical刷新策略未改；模块列表点击仍原编辑Sheet，无独立只读详情/添加到日历/备注/新重复频率。moduleView仅模块启用，首页/日历默认模式与共享Icon保持。旧worktree28 modified + 1 untracked与8661项项目指纹完全一致，不清理共享.git快照。

- Slice9旧worktree仍28 modified + 1 untracked，8661/8661既有项目文件/符号链接指纹匹配；共享.git快照元数据沿用既有记录，不恢复/清理。最终中文字体栈、字重层级与行内按钮排版 Deferred 到全局视觉一致性检查；这不表示当前Slice9未通过本地或暂时视觉验收。离线fixture不等于真实数据库、权限或Realtime验收。

- 本轮 + 修正/多人只读审计后检：旧worktree完整8725项（含ignored/共享.git）与本轮前基线完全一致，无新增/删除/修改，原28 modified + 1 untracked保持。下条自动turn-diffs差异是前轮历史记录，本轮未发现新增差异；未自动修复元数据。最新 preview source-manifest六项匹配，增量精确五文件。

- Slice8旧worktree仍28 modified + 1 untracked，全部工作区项目文件及现存基线文件字节指纹保持；包含共享.git的完整清单发现Codex turn-diffs快照引用新增2/移除1，不能宣称全清单完全一致。未修改/恢复/清理Git元数据；具体见DEVLOG及离线old-workspace-postflight.json。预览是离线fixture，不证明真实账号/backend或Realtime验收；原回顾focus刷新与资格/晚响应保护保持，无新增active-view Realtime。

日历视觉基线已由用户明确冻结：小圆点区分Space；标题深色，副信息灰色；不依赖大色块或彩色标题，整体轻、干净、克制。日/周已本地收敛；Slice5月网格/日期浮层已按同一语言本地实现并获离线视觉验收。Space无颜色字段；当前Slice4六色默认圆点palette获用户阶段性接受，但默认色不够鲜亮是已知Deferred事项，不等同配色满意。临时映射以成员Space ID集合消解冲突，最多6个不重复；Space成员增减可能调整映射。未来独立Space Color System目标为用户选择并持久化、身份稳定、日周月一致，其他Space增删不影响已选颜色，默认色更鲜亮；需先设计选择器、色板、存储和迁移。现在不实施自定义颜色/数据库；后续月视图沿用当前冻结整体风格。

- UI v2 唯一技术链路为 CSS variables → Tailwind ui semantic mappings，显式逐页迁移；无 ThemeProvider/新框架/依赖变更。参考包身份、工程候选值、首页 3/2/2 仅预览、任务已完成页内折叠兼容旧导航、重要日复用日期引擎及禁止虚构功能见 [实施规格](./UI_V2_IMPLEMENTATION_SPEC.md)。Slice 2 首页与四栏、Slice 3 首页3/2/2及重要日直接创建均获用户离线视觉验收；Slice 3 本地已完成。任务完成页内折叠已在Slice7本地实施并获用户视觉验收；重要日历史折叠留待以后单独定范围；Slice4日历顶部/日/周已获阶段性视觉接受；Slice5月内容已本地实现并获离线视觉验收。不新增正式版本条目。

- 新阶段产品方向与六步顺序见 DECISIONS 的 Product Direction Freeze；商业化是可探索方向，不是完成产品的必要条件。保留分散居住家人的轻量共享需求与既有 Space/多成员/共享/提醒架构，不因个人使用频率降低而废弃。外部日历、导出/备份/加密、原生 App/订阅/大陆部署均未获功能批准或时间/架构承诺；回顾仍可选，不预设商业卖点。

- v0.1.20 仅局部 Calendar 周期滑动及模块列表返回；保留按钮、filters/snapshots、编辑/危险确认。无全局 swipe-back、Sidebar、底栏横滑、详情/Sheet 关闭、业务操作手势或 dirty/busy 重构。识别阈值60px/800ms、2:1横向/30px最大纵向漂移；明显横向意图30px抑制尾随click；用户 iPhone installed PWA 13/13 PASS，多指取消/busy 未单独人工检查（不记失败），保留自动保护测试证据。

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

v0.1.21与Slice 5按用户接受范围正式关闭，Slice 1仍DEFERRED。继续独立回顾详情页编辑入口本地UI优化，不Commit/Push/Deploy UI，等待用户验收与发布授权。历史证据及边界见TESTING最新节。

