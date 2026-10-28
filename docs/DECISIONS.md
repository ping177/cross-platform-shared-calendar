# Decisions

## 2026-10-28 — Slice 2真实验收通过，仅治理收口

用户明确确认Production真实验收全部PASS并授权Governance Commit/正常Push origin/main。Slice 2正式CLOSED / PASS，解除本次Review写入维护；仅关闭此Slice，v0.1.21整体IN PROGRESS，Slice 1继续DEFERRED、Slices 3–5未开始，v0.1.20 CLOSED / PASS保持。回顾边缘返回/完成入口独立登记UI/UX待办，默认空间待产品讨论、对方状态短延迟观察，均不在收口实施或认定为并发安全失败。正常文档Push允许现有Vercel自动部署，仅核验Source/资源保持；不改业务/SQL/测试、重跑Patch或恢复旧无条件接口。下方旧授权/验收Pending为当时历史边界。

## 2026-10-28 — Slice2兼容前端正式发布授权与验收边界

用户明确授权已审核Slice2的Commit、正常Push origin/main及Vercel Production验证；数据库Patch、Postflight、负向探针和真实匿名缓存识别已由用户确认。只发布现有content_revision条件保存与冲突保留方案，不重跑SQL、不新增功能；新前端Source/资源验证后由用户登录iPhone Safari/PWA及同账号双会话验收。发布成功不等于用户验收，维护停写持续到验收确认，不提前关闭Slice2或通知其他成员恢复编辑，不恢复旧无条件RPC；此前未授权记录保留为历史。

## 2026-10-17 — v0.1.21 Slice 2 使用现有内容版本作原子条件写入

用户批准本地实施，未授权 Production/Git。保存和标记均要求草稿基线 content_revision，保留原 Space锁、auth.uid/participant/module检查、内容实际变化才递增及filled_revision状态语义；不采用updated_at，不新增版本字段。旧签名保留但中文明确拒绝，不能保留无条件兼容旁路。冲突只读查看最新版；重新载入前明确确认丢弃本机输入，读取失败原稿保持。按本轮最小UX要求不实现草稿备份库、Diff或合并编辑器。发布会使旧客户端暂时无法保存/标记，必须另行授权维护窗口及先保留输入再刷新；详见TESTING。v0.1.20关闭结论不变，Slice1继续暂缓。

## 2026-10-16 — v0.1.20 正式收口，后续审查独立启动

用户明确确认整轮UI/UX六项及创建表单Space补充六项真实Production iPhone PWA全部PASS，授权仅治理文档Commit/正常Push及状态核验；正式v0.1.20 = CLOSED / PASS，无剩余阻塞验收项，不新版本。已验收业务基线b021a41，历史实施/发布Pending由最终验收接续但保留原事实。旧来源文案及bundle提示非阻塞，不借收口修复；不把其他未执行业务测试写成PASS。后续“独立工程稳定性审查（尚未启动）”先只读，需另行用户指示，不在本轮开展。允许正常Git集成触发docs-only部署，不手动部署/改配置；仅Source SHA改变不代表应用行为变化，不重复要求整轮PWA验收。

## 2026-10-16 — 创建表单 Space 本地验收通过，授权正式发布

用户确认日历/任务/清单/重要日及首页快捷新建本地iPhone Safari全部PASS，冻结当前补充实现，授权正常实现Commit、Push origin/main和现有GitHub→Vercel自动Production。仅原24文件源码/直接测试/治理记录，不新增设计、版本、依赖或后台/配置变更。此前六项正式PWA PASS保持；本次提交前Production release/PWA acceptance均PENDING，Source/资源另行实证，正式PWA由用户验收。收到本次Production PASS前不最终CLOSED/PASS、不追加最终Governance Closeout Commit或启动稳定性审查。下方LOCAL ONLY为当时实施边界，现由本次授权接续。

## 2026-10-16 — 补齐创建表单 Space 控件，业务归属与筛选分离

用户确认此前六项正式PWA PASS后，授权 LOCAL ONLY 补齐 Event/Task/List/Important Date 创建表单原生 Space 菜单遗漏。复用原顶部菜单的视觉与交互，增加 opt-in dialog 定位/焦点支持和薄 SpaceTargetDropdown，不另建菜单框架；禁止“全部空间”，可选资格/default/ownership/编辑不可迁移/真实提交均由父级保持。Review无表单控件，不新增。日期、时间、提醒、成员选择不属本轮。旧PWA PASS保留，补充本地真机及未来发布验收未完成前不最终CLOSED/PASS，不Commit/Push/部署/新版本。

## 2026-10-16 — 全域UX本地最终验收通过并授权正式发布

用户确认本轮全部本地iPhone Safari PASS，包括最后首页16px/600三板块标题；冻结当前设计与功能，授权整轮实现Commit、正常Push origin/main及既有GitHub→Vercel自动Production。发布前累计diff/全量自动化/视觉及Project State Gate检查，允许仅修本轮失效的直接测试，不扩改设计或业务。没有新版本、依赖、后台/生产配置或第二次手动部署。提交前Production release/PWA acceptance均PENDING，部署实绩以独立核验报告为准；用户正式PWA验收PASS前不最终CLOSED/PASS、不追加closeout提交、不启动新功能或稳定性审查。下方旧Local Pending/未授权发布为历史检查点。

## 2026-10-16 — 次级折叠入口沿用任务轻量规则

用户指定任务/清单已完成、重要日历史入口统一任务已有透明文字行：无白卡/描边/阴影、14px/500、44px点击区、18pxChevron、统一数量表达及左右/纵向节奏；保留原业务名称、统计、状态、列表和触摸/键盘行为。允许修复同类视觉遗漏，因此清单/重要日同级主分组标题统一14px/500、主区至入口改任务既有12px。回顾无对应区域，不新增。只提取小型共享CSS，不建立新组件体系。

四模块完整实测仍有筛选框字重/边框、行标题强调层级差异；前者受原冻结约束、后者需新的产品视觉判断，记录证据待用户决定，不擅自扩改。回顾Sheet贴边、空间右滑、登录已获用户真机PASS并冻结；整体主要视觉“基本满意”不等于最终全范围CLOSED/PASS。继续仅本地等待三入口验收，不Git发布或创建版本。

## 2026-10-16 — 回顾短弹窗改为真正贴底Sheet

用户确认空间管理右滑与登录配色/标语真实iPhone Safari PASS，冻结且本轮不修改；回顾左右贴边PASS但底部悬空FAIL，明确撤销此前不改垂直位置约束。仅将新建/日期更正两弹窗接入既有底部Sheet几何：手机外部底距0、仅顶部圆角、内容自然高、safe-area在内部；共用同一规则，不新增Portal/弹窗系统。原内容/日期/按钮/焦点/忙态不变；自动化标准模式/视口模型通过后仍等待用户Safari原生日期/键盘/底栏复验，不提交发布或最终CLOSED/PASS。下方旧垂直冻结为已被本决定接续的历史。

## 2026-10-16 — 首轮本地反馈的三项定向修正

沿用当前UX修整及版本，不重新设计。回顾新建/日期更正仅手机横向全宽、与确认一致max512，桌面原448；垂直位置、padding/safe-area、内容、日期及交互保持。空间管理/详情复用原右滑hook与App共享guard，调用同一顶部返回语义，忙态/输入/模态及原dirty取消保护保持。登录Logo与两阶段按钮复用UI v2浅accent-soft底配accent文字，删除两人旧标语，无新宣传语/新色/认证变更。仅本地自动验证后等待三项真机复验，不Commit/Push/部署，不标记最终CLOSED/PASS。

## 2026-10-16 — 全域UX修整冻结范围（仅本地）

用户逐项确认UX-01至UX-09：任务/清单/回顾历史/重要日主标题20px/600、屏幕居中/Sticky，参考清单/重要日统一节奏并移除回顾52px补偿；历史回顾辅助标题仍14px/500。等宽左右栏保护操作，保留现有Space下拉菜单及宽度/字号/业务。

成功空回顾/重要日概览主值统一暂无，数量/真实数据/上下文/Loading/Error/Disabled保持；功能入口只保留图标、名称、Chevron和64px触摸行。四模块等价正常空结果用14px/400居中纯文字、轻量留白，无独立卡片/图标/解释/重复新建；保留当前/已完成/历史分组和资格引导。

短弹窗复用既有键盘hook，仅新接入回顾新建/日期更正及通知启用背景滚动锁、明确opener恢复和Tab循环，解决WebKit日期控件跳BODY；原日期字段内部以方向键操作。保留Review忙态取消保护与通知原关闭语义，不引入弹窗框架。登录/OTP/通知只用UI v2暖白/灰绿/控件tokens，认证、权限及Push业务不改。具体Space用实际名称仅局部修正，类型说明保留；退出登录仅移除右Chevron。

允许必要测试/治理记录，禁止Commit/Push/部署、新版本和后端改造。本轮自动PASS后等待用户本地iPhone Safari反馈，不提前CLOSED/PASS；上一轮Space筛选器Production主要交互正常但顶部间距问题及最终治理未完全收口，不被本轮自动结果覆盖。

## 2026-10-16 — 筛选器本地验收通过并授权正式发布

用户确认真实账号本地iPhone Safari验收PASS，冻结当前设计及功能，不再调整。授权单一实现Commit、正常Push origin/main并沿用GitHub→Vercel自动Production；不手动二次部署、不改后台或配置、不新增版本。Production installed PWA用户最终验收前不CLOSED/PASS、不执行最终治理收口提交。下方“仅本地/未授权发布”为此前实施检查点。

## 2026-10-16 — 五模块Space筛选器冻结设计

用户确认日历、任务、清单、回顾、重要日统一为触发框正下方的自定义下拉菜单，保留触发框位置、宽度和字号；菜单16px、最大384px，日历窄框也展开同标准宽菜单，左对齐并受视口/安全区约束，内部独立滚动。选中即生效并关闭，外点/Escape关闭，键盘与触摸可用；不使用原生select、底部Sheet或blur提前卸载。筛选器统一显示Space实际名称。回顾去掉可见“空间”标签、保留可访问名称，历史标题采用14px/500的同级辅助标题与适度间距。

仅共享UI组件与样式，各模块资格、独立筛选与记忆、新建默认目标、创建表单保存到、回顾单Space/成员数/分页/编号及异步安全边界保持。不新增依赖/持久化状态/版本，不改后端；本轮仅本地实施和自动验证，用户验收前不CLOSED、不自动Commit/Push/部署。

## 2026-10-15 — 删除确认与清单分组修复正式关闭

用户确认Production iPhone PWA最终验收PASS，冻结本轮已验收实现并标记本范围CLOSED / PASS。治理收口只修改必要文档并按正常Commit/Push流程同步；接受现有Git集成可能随Push自动触发Vercel部署，不主动部署、不改Ignored Build Step或Production配置。正式版本仍为v0.1.20；不扩展为整个项目试用完成，不自动开始筛选器或其他功能。

## 2026-10-15 — 本轮UI本地验收通过并授权Production前端发布

用户确认分组四入口、两范围、贴底容器和清单基准内部设计及特殊安全规则本地iPhone Safari PASS，冻结当前设计；授权Commit/正常Push/origin-main及既有Vercel自动Production发布，不再等待重复批准。发布只含已验收UI、测试和治理，禁止扩大到筛选器/架构/后端/Auth/数据；正式PWA最终用户验收通过后才标记本轮CLOSED/PASS。下方待确认/未授权措辞为当时历史检查点。

## 2026-10-15 — 删除确认内部只采用整清单视觉基准

用户明确指定现有整清单删除确认作为唯一内部基准：左对齐18px粗体标题，正文对象标签与加粗名称、可用空间信息，独立14px/24px风险段落，12px段间距和20px按钮前留白；普通操作取消在左、删除在右，44px热区/12px按钮圆角/8px间隔。沿用清单“对象信息→风险说明”实际结构；高风险两步与范围型选项保持必要内容/明确动作名，采用相同层级。一组共享CSS内容角色承载样式，不新建弹窗框架或修改外壳，常规表单/数据/权限/RPC不改。既有iPhone Safari功能/外壳验收PASS保留，本轮新内容待用户确认，未授权Git或发布。

## 2026-10-15 — 用户批准统一删除确认外壳

本轮用户选择现有主流Sheet几何：手机全宽贴底、最大32rem、仅顶部24px圆角、至少20px底部安全区留白；桌面统一居中、24px外层留白与四角圆角。复用既有List/Important/Space确认类和Sheet tokens，Event/Task只在删除态接入；保留全部确认内容、非空分组两范围、高风险两步及权限/RPC，不创建新的UI组件体系。此决定接续下方上一轮仅局部盘点的历史范围；只授权本地修复，未授权Commit/Push/部署。

## 2026-10-15 — 删除确认只统一安全的UI差异

用户已确认五项本地真实验收PASS并明确授权统一前端发布；仍以最终Production设备反馈作为本轮关闭条件。

复用既有确认层样式及useListModalKeyboard，不新增通用弹窗框架/CSS、不迁移所有模块。Review、清单项目/空分组、恢复输入清除和邀请码轮换补App确认；原二元按钮取消在左、危险动作在右，保留高风险两步及范围型选项。权限、RPC参数、失败资格核验与数据完整性不变。头像替换/默认的旧照清理仍属原已验收替换流程，不擅自增加每次选头像的确认；草稿离开确认及可逆设备状态不作普通删除统一。

## 2026-10-15 — Review整次删除沿用参与者权限与级联

本轮经用户授权，删除定义为整次round及双方entries永久删除，显式二次确认；合法操作者沿用既有Review写权限：当前Space成员且属于该次参与者快照、模块开启；Personal仍私有。不扩大历史内容给后来加入的非参与成员。写入继续RPC-owned，不授予表DELETE；复用现有Space锁及entries ON DELETE CASCADE。保留其他历史编号、允许空缺，新建编号机制不变；上一份计划按日期动态重新定位，不重写其他回顾。新增前向SQL在本地验证后，已按用户单独授权安装Production并只读核验；未调用生产删除RPC，真实功能验收由用户使用可丢弃回顾完成。

## Final pre-trial UX exception — calendar create / 2026-10-15

日历右上角唯一44×44「+」直接打开既有完整EventSheet，不再有前置空间选择Sheet。全部空间默认当前用户Personal Space，具体筛选默认当前Space；两种模式均显示可交互的「保存到」选择控件，可改为其他合法Space。切换保留标题、日期时间、重复、提醒和描述，仅重置空间相关归属；保存使用最终选中的Space，保存前重验Auth/成员。无合法目标或读取失败禁用保存并提示/重试；取消保留日历日期、视图、筛选。已有Event编辑/转移、任务清单及后端不变。 本轮日历真实账号及我的标题视觉均已由用户验收，统一Commit/正常Push与Production发布已明确授权；沿用既有Git自动部署，不改生产配置。部署/静态通过不等于Production/PWA人工PASS，用户确认后才CLOSED；随后暂停常规开发，不新增版本。用户报告测试数据已清理，本轮不再清理。

## Real-use observation after closeout — 2026-10-14

暂停常规功能开发，进入约两周真实使用观察（2026-10-14起，约至2026-10-28）；记录实际使用问题与未完整覆盖的边界，再决定是否需要后续修正。未来独立待办：整理测试数据，三个测试账号保留两个；保留账号选择与清理需另行确认，本轮不执行，也不是当前阻塞项。不创建新版本或启动新功能。

## Profile Card Compact + Avatar v1 — 2026-10-14

冻结紧凑资料卡与轻量头像Sheet，不扩展范围。12原创头像为复古几何拼贴插画；猫固定F造型+02陶粉与燕麦。照片存于现有Supabase私有bucket，本人修改/管理，当前同Space成员读取当前照片；签名5分钟。上传immutable UUID→CAS metadata→已确认后清理旧照片；metadata响应不确定时延迟到既有>24h未引用恢复，不因即时回读旧值误删late commit照片。用户已确认切回预设后的旧照片删除。用户确认Production前端人工验收PASS，Avatar和Space Rename最终CLOSED / PASS；未完整验证的边界保留，不新增版本。测试数据清理独立延期，三个测试账号未来保留两个，不在本轮执行。

## Product Direction Freeze — 2026-10-09

This is the user-confirmed next-stage direction after v0.1.20 CLOSED / PASS, not a new feature-version assignment or implementation authorization.

### Product goals

- Build a complete, refined, reliable shared-life management PWA that is practical to use. Continue supporting lightweight shared schedules, tasks and reminders for the user and family living in different places.
- Treat the project as a formal AI-assisted product development portfolio case, demonstrating requirements management, product design, implementation coordination, testing, deployment and iteration experience.
- Commercialization remains exploratory and is not required to complete the product. Lower current personal usage does not justify abandoning Space ownership, multi-member/sharing or reminder architecture.

### Frozen work sequence

1. Establish the Figma ↔ Codex MCP design workflow and design the entire application until the user explicitly confirms satisfaction.
2. Codex implements confirmed designs in stages, preserving existing business logic and acceptance records.
3. Complete Chinese/English interfaces and the internationalization experience.
4. Check security, privacy, account and access experience before external trials.
5. Use with family and conduct a proportionate amount of external trials.
6. Prepare product demos, design artifacts, project explanation and resume/LinkedIn portfolio materials.

Representative pages may validate the Figma workflow first, but one or two sample pages are not the final design deliverable. Final UI coverage must include Home, Calendar, Tasks, Review, Lists, Important Dates, My, Space Management and major Sheets/forms, with a complete, consistent design explicitly accepted by the user. Preserve the four navigation tabs, Home quick-add, Space ownership, Realtime, Push and current interactions. Proposals that change product behavior must be raised separately before implementation; design approval does not silently authorize such changes.

### Candidates, not approved features

- Google / Outlook / Apple external-calendar aggregation and selective sharing.
- Data export, user-owned backup and sensitive-content encryption.
- Native App, commercial subscription and mainland-China-specific deployment.
- Review stays optional; do not assume it is a commercial selling point.

No implementation date or architecture is promised for these candidates. Market Validation / Commercialization Study is retained as exploration rather than the immediate next task or a prerequisite for product completion; it does not replace the frozen design-first sequence.

This freeze changes governance documents only: no Figma MCP installation/configuration, UI implementation, business/dependency/backend/deployment changes or push. Future work proceeds under its separately authorized scope.

## v0.1.20 — Frozen mobile gesture scope / 2026-10-08

- Calendar right/left means previous/next civil period (Today day, Week seven days, Month month). Share the original button-equivalent date calculation; date cells and display cards opt in without granting gestures to their editing/dangerous descendants.
- Tasks/completed/Review history/Lists overview/Important Dates use existing Back callbacks on the local main surface, without an edge-start restriction. Keep existing filter/snapshot/re-entry semantics and all buttons.
- Adopt Food Expiry v0.3.5 recognition lessons, read-only: touch-only/ref-held pointer recognition, vertical/multi-touch/cancel priority, local pan-y/pinch-zoom, scope reset and a click guard retained by CalendarApp across page unmount. No Sidebar thresholds/navigation architecture, new history/controller or dependency.
- Any modal, including Portal content outside the DOM surface, blocks background events; existing editor/create/delete/busy states disable gestures. Details and editing Sheets remain out of scope; do not redesign their exit protection or attach business operations to swipes.
- Final closeout: implementation/review/788 automatic tests PASS; separately authorized push and Vercel Production/asset/target verification completed. User confirms real iPhone installed-PWA 13/13 manual PASS. Multi-touch/cancellation and busy were not separately manually checked; retain automated coverage without labeling manual PASS or FAIL. No confirmed defect/blocker; v0.1.20 CLOSED / PASS. This round authorizes governance docs/local commit only, without push/deploy. Historical closeout next action was Market Validation / Commercialization Study; the 2026-10-09 Product Direction Freeze above supersedes its priority without presuming commercialization conclusions or a native App route.

## v0.1.19 — Task Due-date Push Reminder — 2026-10-05

- Approved repo-first bounded extension; [canonical contract](./v0.1.19_TASK_REMINDERS_SPEC.md). Four tasks/automatic verification, Production exact SQL/postflight, ACTIVE v4/Cron, frontend publication/target alignment and user local/Production/installed-PWA acceptance PASS. User confirms real Task Push on 2026-10-07 evening; accepted as manual PASS. Aggregate backend evidence/limitations are in TESTING. v0.1.19 CLOSED / PASS as of 2026-10-08; docs REMOTE_SYNCED is established only by final authorized push verification.
- Task remains Space-owned, date-only due and open/completed. No due means off. New UI-created due Task defaults same-day 08:00; historical null never auto-enables or guesses timezone. Two existing all-day presets/null; capture valid IANA on enablement without established zone and reject failed capture. Device changes preserve saved zone.
- Personal recipient = Personal Space owner/self; Shared assigned = current assignee; Shared unassigned = all current members and active devices. This resolves the historical future-backlog recipient question without changing Event/Important Date recipients or Task status authority.
- Three Task fields with server marker on due/preset/timezone/status/assignee (including FK set-null); title does not invalidate. Extend the existing ledger source identity/Task civil due identity, service-only claim/pre-send, and Tasks toggle Space locking. Keep direct Task CRUD and one existing scheduler/sender/subscription/SW architecture. No generic framework, queue/retry/lease/Task occurrence table or hidden Event.
- Final database pre-send canonical check is the qualification boundary. Changes after the RPC returns cannot be atomically coordinated with Web Push/retract accepted notifications. Preserve newly-past skip/infrastructure-only ten-minute grace and existing duplicate identity; existing 50-delivery overflow limitation is only recorded.
- Backend-first rollout completed under separate authorizations: exact SQL → integrated Edge → postflight/target alignment → local authenticated acceptance → normal Git push/Vercel Production → deployed alignment → user final acceptance. This round authorizes only docs closeout/commit and aggregate read-only evidence; no push or additional backend/scheduler/secrets work.

## Next-stage direction — 2026-10-08（历史；由上方 v0.1.20 冻结范围接续）

- Next is PWA 手势交互体验评估: first read lessons learned from another project supplied by the user, then decide the applicable scope. Do not assume an implementation method or assign a version number before that review.
- Preserve the original Market Validation / Commercialization Study route; do not start or replace it during this closeout.

## Current implemented modules stage interaction cleanup — 2026-10-05

- Home/Calendar single Important Date rows use their local direct Sheet with the shared exact canonical target/editor and requestId/generation qualification. Full-module entry/view-all/session restore stays in the existing navigation parser. The unreachable old runtime row-to-module controller, pending/returnTo wiring and module target branch are removed; no generic routing/resolver layer replaces them.
- Calendar Important Date functional + retention UX and Calendar Event P0a user manual acceptance PASS. P0b local automated PASS; its normal behavior is included in user FINAL_MANUAL_REGRESSION = PASS. Session-local feature-specific validated presentation remains separate from fresh action authority.
- Full Important Dates with retained rows says 更新中 while canonical refresh runs; cold entry says 正在读取. Event/Task use local Escape/Tab/focus handling modeled on the existing Important Date Sheet, without a generic modal framework. Ordinary Event destructive icon now asks for explicit named confirmation; recurring scope choice and Task/Important Date confirmation retain their own semantics. Existing save/close mutation ordering remains unchanged.
- This is a stage cleanup for current implemented modules, not a permanently completed product-wide audit. Future major features may trigger another consistency audit. User FINAL_MANUAL_REGRESSION = PASS closes this stage cleanup, Slice 3 (T1–T4) and v0.1.18 as CLOSED / PASS. Next product work is separately scoped; no additional Production/PWA-specific acceptance or deployment is established by this closeout.

## Historical checkpoint — v0.1.18 Slice 3 T3 Home interaction frozen — 2026-10-04

- User authenticated local acceptance closes T3 as CLOSED / PASS. Overall v0.1.18 / Slice 3 remain IN PROGRESS, T4 NOT STARTED. This local acceptance is not current T3 Production/installed-PWA acceptance; normal Git remote publication does not prove deployment or acceptance.
- Home single Event / Task / Important Date rows open their own existing Sheet directly on Home. Important Date close/cancel/save/delete stays Home; title / 查看全部 enters the full module. This supersedes the acceptance-era Home row-to-module navigation, with ordinary full-module behavior preserved. The historical T2 navigation layer was later proven unreachable and removed at the stage cleanup above; its exact target reader/editor and request guards stay active.
- CalendarApp owns three independent feature-specific Home validated presentation slots, extending v0.1.16. A safe warm return restores content while canonical reread runs; refresh errors retain safe content with retry. Snapshots never authorize editing/mutation. Event uses current canonical reconciliation; Task exact-open/qualified completion and Important Date exact canonical14/Auth/member/role/module/Space checks remain authoritative. Existing Event/Task Realtime stays notification→canonical reread; Important Date active-view Realtime remains deferred. No generic cache/store/target/router/projection framework or persistent frontend business data.
- After T4 / Slice 3 functional completion, before final Slice 3 closeout, perform product-wide Interaction Consistency & Cleanup Audit (scope in BACKLOG). Audit first, delete later under bounded authorization. At that historical checkpoint, audit/cleanup had not run; the authorized stage cleanup above supersedes that timing constraint. Final Slice 3 Production/PWA acceptance follows that work.

## v0.1.18 — 重要日 Design Freeze — 2026-09-30

- Historical design-freeze checkpoint; later implementation/acceptance is recorded in PROJECT_STATE and the T3 decision above. User-approved canonical contract: [v0.1.18 重要日 Specification](./v0.1.18_IMPORTANT_DATES_SPEC.md). At that checkpoint, status was `DESIGN FROZEN / IMPLEMENTATION PLANNING`; business implementation and Slices 1–3 are `NOT STARTED`. v0.1.17 remains `CLOSED / PASS`. This approval covers docs/governance and a docs-only commit, not implementation, Production writes, deployment, or push.
- 重要日 is a first-class 功能中心 module, with one Space-owned canonical object for Personal/Shared; countdown/count-up/anniversary are derived. Reuse existing Space module/permission/entry/navigation conventions and v0.1.17 explicit form-target ownership. Disabling preserves records/settings while excluding availability, Home/Calendar projections and Push eligibility.
- Annual with year has a true canonical start date: no earlier occurrence in any consumer. The same pure-date contract supplies Day 1, real anniversaries, and February 29 → February 28 in non-leap years. Existing Event leap-day skip semantics stay unchanged.
- Reuse all-day Event presets (不提醒 / 当天08:00 / 前一天20:00), one persisted IANA timezone and shared object-level setting. Extend the existing scheduler with Important Date-specific candidate/claim/pre-send revalidation and ledger source identity; no hidden Events, second scheduler, generic framework, or per-member preference.
- Slice 1 may prepare reminder persistence but must not expose unusable settings. Reminder publication waits for the complete Slice 2 path and actual backend capability gate, idempotency and Event regression. Slice 1 may correct Shared Space permanent-delete copy to include all affected business data, including 回顾、清单、重要日, without changing lifecycle semantics/RPCs or unrelated UI.
- Three planned Slices: core object flow; date-level Push; Home/Calendar projections. No Realtime in v1; canonical rereads and bounded same-session display continuity remain the state model. No archive/trash/undo or global state/cache/repository abstraction.
- Task due-date Push remains a separate future backlog. Shared without assignee recipient is unresolved and outside this version; the detailed backlog is in [Backlog](./BACKLOG.md).

## Space-aware Create Defaults — Frozen Convention — 2026-09-30

- `SPACE_AWARE_CREATE_DEFAULT_CONVENTION`: `CURRENT FILTER AS DEFAULT PRESELECTION, NOT OWNERSHIP AUTHORITY`. Aggregate 全部空间 defaults to the user's Personal Space; a specific eligible Space filter defaults to that Space. The create form target remains explicit and user-visible; final ownership comes from the target selected in that form. Current membership, module eligibility, RLS, and backend validation remain authoritative. Invalid targets cannot silently redirect and save. Module filters remain independent.
- Tasks already conform; Review conforms through its single-Space flow; Lists was corrected in v0.1.17 and accepted; Calendar behavior was intentionally unchanged. Future Space-level modules, including Important Dates, should follow this convention. The prior v0.1.15 safety rule that a Shared Space must always be manually selected—even when already filtered—was replaced after real-use consistency review. This supersession does not erase the historical rule; the v0.1.15 spec history remains available. No generic create framework is implied. v0.1.17 is `CLOSED / PASS` with implementation/automated, local authenticated, and Production/PWA acceptance all passed.

## v0.1.16 Module Entry Responsiveness — Design Frozen — 2026-09-28

- `V016_REENTRY_RETENTION_DESIGN_FROZEN` amends the design after first authenticated Tasks acceptance failed: module unmount discarded its validated business view. CalendarApp now retains three narrow, user- and scope-bound in-memory display snapshots for Tasks, Review, and Lists. A safe Hub re-entry restores the last validated view immediately and starts that module's canonical reread in the background. This does not authorize mutations or replace Supabase/RLS. Confirmed eligibility or membership loss, mutation rejection, and true auth boundaries invalidate affected snapshots; routine same-user token refresh does not.
- A future Space-level optional module should reuse valid CalendarApp/session entry information and restore its own still-safe validated view on ordinary same-session Hub re-entry, then read its own canonical business data in the background. Module-specific snapshots provide display continuity, not business authority; no generic cache layer is implied.
- Space-level module entry reuses authenticated CalendarApp current Spaces and valid session-scoped module eligibility as hints, then reads that module's canonical business data. Repeated entry does not rediscover current Spaces or `space_modules` while the hint is valid. Supabase, RLS, bounded invalidation, and canonical mutation checks remain authoritative.
- Only entry discovery is shared. Tasks retain paginated Tasks and member reads; Review retains rounds → entries; Lists retain complete Lists/Items reads and consistency checks. Independent reads may overlap, while background rereads keep validated content visible. No generic module framework, persistent business-data cache, dependency, SQL, or backend change is planned.
- First-entry latency is outside this correction: no partial publication, prefetch, business-data cache, Hub business-data loading, or timing framework. Reconsider only if real use later finds first entry materially problematic.
- Implementation complexity target is `SIMPLER`. After the initial Tasks failure, the second local authenticated acceptance and user-reported Production installed-PWA acceptance PASSED for Tasks, Review, and Lists; v0.1.16 is `CLOSED / PASS`.

## v0.1 Product Shape

- v0.1 is a Web/PWA, not a native iOS or Android app.
- "Cross-platform" means the app works in iOS Safari and Android Chrome. It does not mean bidirectional sync with Apple Calendar or Google Calendar.
- The backend uses Supabase Auth, Supabase Postgres, Supabase RLS, and Supabase Realtime.

## Shared Space Event collaboration — confirmed 2026-10-15, local implementation

- All current Shared Space members may read, edit, reassign and delete every Event; deletion requires confirmation. Audience identifies participation/reminder recipients, not mutation authority. Personal Space remains owner-private; space_id/created_by remain immutable.
- Audience changes affect the entire logical series including split segments, atomically; content retains existing occurrence scope. No per-occurrence audience override, cross-Space move, new checkbox UI or Task-permission change.
- This supersedes the v0.1.1 scope/owner immutability and owner-only mutation decision ONLY inside Shared Space. The old baseline below remains historical. Production SQL was user-applied and independently verified; matching Edge v5 and original Cron restoration are complete. User core A/B and real Push A→B acceptance passed. Frontend release is explicitly authorized; final Production/Safari/iPhone PWA acceptance remains pending and is not implied by deployment. No new formal version. Implementation and rollout boundaries: [Event collaboration](./EVENT_COLLABORATION_ROLLOUT.md).

## Data Model — historical baseline before the collaboration rollout

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

- `v0.1.8 — Mobile Push Reminder` is `CLOSED / PASS`. Slice 1 (`v0.1.8.1 — Push Infrastructure Foundation`) passed on Desktop Chrome/macOS, iPhone installed PWA, and Android Studio Emulator. Android evidence is emulator-based: permission/subscription and test Push passed; physical-device heads-up presentation was not validated.
- **Implementation status:** `v0.1.8.2 — Reminder Persistence + Ordinary Event Delivery` Slice A/B/C, Slice 3 Recurrence Reminder Integration, and final cross-platform acceptance are `CLOSED / PASS`. The reviewed long-duration correction changes only the Reminder projection adapter and leaves the canonical recurrence engine unchanged. DB patch, `send-reminders` v2, frontend rollout, scheduler health, ordinary regression, recurring override/delete/split behavior, Mac/iPhone automatic Push, and Android Emulator ordinary automatic Reminder passed acceptance. This freeze supersedes the earlier Option A `events.reminder_offset_minutes` decision.
- **Reminder persistence:** use one nullable event-level `events.reminder_kind`, with `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder. Do not create a JSON reminder config, multiple-reminder table, arbitrary-minute reminder, or per-user reminder preference.
- **Defaults and migration:** new timed events created by the v0.1.8.2 UI default to `timed_10m_before`; new all-day events default to `all_day_same_day_08`. The database default remains `null`, every historical Event migrates with `reminder_kind = null`, and rollout never silently enables reminders for existing data.
- **Canonical Event timezone:** add nullable `events.time_zone` containing an IANA timezone detected from the creating browser/PWA through standard `Intl` capability. Never hardcode one country/offset, never silently fall back to UTC when detection fails, and never silently rewrite an existing Event when a device later changes timezone. A required capture failure blocks the complete mutation with a controlled validation error. Historical ordinary Event timezone remains null rather than guessed; historical recurring sources may initialize it from their already-authoritative `recurrence_rule.time_zone`. A timezone-dependent reminder selected on a null-timezone Event establishes the canonical timezone from the current device. A recurring Event's `events.time_zone` and `recurrence_rule.time_zone` must agree.
- **Due semantics:** minute presets subtract real minutes from the effective start. `timed_previous_day_same_time` means the prior calendar day at the same wall-clock time in the Event timezone, using the existing recurrence DST conversion semantics rather than fixed 1440 minutes. All-day presets use effective Event date plus canonical timezone at 08:00 the same day or 20:00 the prior day. Multi-day reminders use only the range start; `ends_at` does not affect v0.1.8 due calculation.
- **Conversion and edits:** timed-to-all-day maps a non-null reminder to `all_day_same_day_08`; all-day-to-timed maps a non-null reminder to `timed_10m_before`; null remains null, and the UI must expose the resulting option. Start/date, all-day, reminder-kind, or timezone changes update the internal `reminder_schedule_changed_at` marker and derive a new current due; title/description/ends-at changes do not update that marker. Event mutations do not create, cancel, or otherwise maintain delivery rows.
- **Past due and grace:** creating, editing, enabling, or changing a reminder never immediately sends or compensates when the newly derived due is already past. The roughly ten-minute grace applies only to infrastructure delay and applies equally to timed and all-day reminders.
- **Current all-day boundary:** v0.1.8.2 accepts the existing all-day presentation flag plus effective date model and does not introduce date-only storage, exclusive-end semantics, or a new all-day recurrence representation. Implementation must stop and report if effective date plus canonical timezone cannot safely produce all-day 08:00.
- **Delivery channel:** use standards-based Web Push to system notifications. Email reminder delivery, SMS, Bark, notification inbox/history, snooze, sound customization, and native alarms are excluded. Existing Email OTP authentication is unrelated and remains unchanged.
- **Push client:** add a Service Worker that handles Push and notification clicks only. It must not add offline caching. Permission is requested only after an explicit user action; iPhone and Android installed PWAs are the primary mobile targets.
- **Subscription identity:** `push_subscriptions` binds a subscription to `user + installation`, not to a Space. One user may retain simultaneous iPhone, Android, and Desktop subscriptions. Endpoint, `p256dh`, `auth`, expiry/lifecycle state, and installation identity are stored per subscription.
- **Future multi-space compatibility:** a device subscription is reusable across every Space the user may join in a future multi-space model. v0.1.8 does not implement multi-space. Delivery resolves recipients at send time through `event.space_id` and current membership, so a multi-space schema upgrade must not require redesigning Push Subscription persistence.
- **Recipients:** a shared event reminder applies to every current active member of its Space, and the reminder UI must disclose this behavior. A personal event reminder applies only to the current `owner_user_id`. A user without an active subscription receives no device notification, and a former Space member must not receive a delivery.
- **Recurrence:** Production ordinary non-recurring and Slice 3 recurring delivery dynamically project due occurrences through the existing runtime-neutral recurrence engine using source Event + rule + cutoff + exceptions. Its timezone/calendar-bounded window covers every frozen Reminder kind and grace period, including moved-in overrides, without a second recurrence/DST algorithm or occurrence materialization.
- **Scheduling:** Supabase Cron invokes an Edge Function sender every minute. Normal target precision is about one minute. A simple configurable late-delivery grace window may compensate reminders missed within roughly ten minutes; reminders older than that window are not sent late. Web Push is best-effort and is not an Alarm Clock.
- **Future consideration — Web/PWA Push delivery precision:** semantic `due_at` remains exact. The accepted recurring E2E produced the exact ten-minute lead time (`11:45` due for an `11:55` start), while once-per-minute Cron plus asynchronous `pg_net` and Web Push claimed/finalized around `11:46`. This is scheduler/network/provider delivery latency, not a due-calculation defect. v0.1.8 does not add a `-60s` early-dispatch allowance, does not distinguish ordinary and recurring Reminder timing, and does not change Cron frequency or redesign the scheduler. Revisit only if real-use feedback shows material UX impact or a future native iOS/Android app adopts OS-level local notification scheduling.
- **Future consideration — physical Android heads-up presentation:** Android Studio Emulator functional delivery, sound, and notification-shade presence passed, but no heads-up banner was observed and physical Android hardware presentation was not validated. This may be casually revalidated later; it is not a release blocker and does not reopen v0.1.8.
- **Delivery ledger:** Slice C1 creates durable audit rows only for currently due, eligible ordinary Event/subscription pairs after atomic current-state revalidation. Event, recipient-user, and subscription IDs deliberately have no foreign keys so audit survives later lifecycle changes. The minimal lifecycle is `claimed` / `sent` / `failed`; there is no long-lived pending queue, mutation-time ledger cancellation, processing recovery, retry scheduler, or generic background-job abstraction. The ledger is server-only and the claim function is executable only by `service_role`.
- **C2 scan caps:** the future ordinary-Event candidate scan must abort the invocation before any claim or Push send if the enabled ordinary-Event scan exceeds 1000 rows. After eligibility is fully derived, delivery tasks are ordered deterministically by `due_at` ascending before applying the 50-task per-invocation cap. These bounds do not introduce a queue.
- **Schedule marker precision:** `claim_reminder_delivery` compares `p_expected_reminder_schedule_changed_at` to the current Event marker using exact PostgreSQL `timestamptz` equality. Future callers must round-trip the database value without JS date reformatting, precision truncation, or reconstruction; a lossy marker is stale and the claim returns null.
- **Idempotency:** the local Slice 3 ledger identity is `(logical_series_id/event_id, nullable occurrence_date, subscription_id, due_at)` with `NULLS NOT DISTINCT`. Ordinary rows keep `occurrence_date = NULL`, preserving their former identity and requiring no backfill; recurring rows use the stable scheduled `occurrence_date`, so two occurrences moved to the same due remain distinct across split lineage. `recipient_user_id` remains audit context. Provider failures are not automatically retried.
- **Recurring claim boundary:** recurring delivery uses a separate service-role-only `SECURITY DEFINER` claim with a hardened search path. It atomically revalidates exact source revision/Reminder marker, expected exception absence or exact override revision/type, current membership/subscription, effective schedule freshness, due/grace, and ledger uniqueness. SQL never expands recurrence; the trusted Edge caller supplies the canonical projection snapshot.
- **Occurrence schedule marker:** a normal occurrence uses the source `reminder_schedule_changed_at`. An only-this override contributes `exception.updated_at` only when its effective start differs from the canonical scheduled start; title/description-only overrides do not suppress a valid due. Split children inherit Reminder/timezone and receive their own insert-time marker to prevent newly-past catch-up.
- **Implementation slices:** deliver Push Infrastructure Foundation, Reminder Persistence + Ordinary Event Delivery, Recurrence Integration, then Production Validation + Canonical Closeout. Later roadmap versions remain directional and do not imply frozen architecture.
- **Web Push server dependency:** `@mmmike/web-push@1.3.0` remains pinned exactly at the Edge-function boundary and is loaded only by the server-only shared Web Push sender currently reused by `send-test-push`. No browser Web Push package or root npm dependency is added; the client uses the platform Service Worker, PushManager, Notification, and PushSubscription APIs directly.
- **Slice 1 security boundary:** authenticated clients register/disable only through `SECURITY DEFINER` RPCs whose identity comes from `auth.uid()`; clients receive no direct subscription-table privileges. The test sender accepts only an installation UUID, re-authenticates the JWT, scopes lookup and invalid-subscription retirement to that user, and allowlists current Chromium, Mozilla, and Apple push-service hosts before outbound delivery.
- **Slice 1 validation strategy:** retain safe test-sender diagnostics (`status`, `delivered`, hostname-only `provider`, `gone`) and treat retry, unsubscribe/resubscribe, then browser/PWA restart as first-line recovery for an accepted-but-not-displayed Push before deeper RCA. The initial Desktop Chrome subscription recovered after resubscription; no architecture, VAPID, Edge Function, or Service Worker blocker was found.
- **C2 Phase 1 acceptance note:** the deployed shared sender preserved the existing `send-test-push` response and notification behavior on Desktop Chrome/macOS and iPhone installed PWA. Repeated Desktop banners using the unchanged constant `shared-calendar-test` tag are pre-existing/non-blocking behavior; this Phase does not change the tag or add `renotify`.

## v0.1.9 Shared Tasks MVP Scope Freeze and Slice 1 Foundation

- Status is `v0.1.9 CLOSED / PASS; SLICE 1/2/3 CLOSED / PASS`. The canonical detailed contract is `docs/v0.1.9_SHARED_TASKS_SPEC.md`; the backend was applied/postflight verified and the Vercel frontend passed user-run Desktop A/B and iPhone Production acceptance. At that milestone, v0.1.9 was the latest accepted user-facing Production capability.
- A Task means something that remains to be completed; an Event means when something happens. Every Task belongs to exactly one explicit Space, and a Task due date never creates or mutates an Event.
- `created_by` is immutable creator attribution only. Assignment identifies responsibility: null means shared; a current same-Space member ID owns status transitions while not restricting collaborative visibility, editing, reassignment, or deletion.
- Every current Space member may view, edit title/due date, reassign, and delete every Task. Shared Task complete/reopen is open to any current member; assigned Task complete/reopen belongs only to its current assignee. Former and non-members have no access. RLS plus a database trigger checking `OLD.assigned_to_user_id` remain authoritative.
- Status is exactly `open` or `completed`; v0.1.9 stores no completion actor, timestamp, or history. `due_on` is an optional PostgreSQL `date` with no time or timezone.
- v0.1.9 adds only `public.tasks` with `id`, `space_id`, `created_by`, `assigned_to_user_id`, `title`, `status`, `due_on`, `created_at`, and `updated_at`. It adds no Task scope, description, reminder, recurrence, priority, tags, ordering, JSON config, or Event foreign key.
- If an assigned member leaves the Space, the Task becomes shared. The actual local Supabase PostgreSQL 17.6 target supports the chosen composite FK `(space_id, assigned_to_user_id) → space_members(space_id, user_id)` with column-specific `ON DELETE SET NULL (assigned_to_user_id)`, so the Task and `space_id` survive without a cleanup trigger.
- The single list index is `(space_id, status, due_on, created_at, id)`, matching the frozen stable ordering including PostgreSQL ascending nulls-last behavior. Task CRUD remains direct PostgREST + RLS; no Task RPC was added.
- Task CRUD should use direct Supabase/PostgREST. Do not add Task CRUD RPCs without a demonstrated atomicity requirement. Realtime reuses the existing Space-filtered Supabase pattern and compatible filtered-delete replica identity.
- Decision: `MULTISPACE_NOT_REQUIRED_FOR_V019`. Explicit `space_id` keeps Task identity future-compatible; v0.1.9 does not change current membership lifecycle, add a Space selector, or implement Multi-space.
- Task Reminder is deferred. v0.1.9 does not modify Event Reminder persistence, sender, ledger, Cron, Web Push, recipients, or recurrence projection, and does not reopen v0.1.8.
- Implementation is bounded to Slice 1 persistence/authorization, amended Slice 2 current-Space CRUD/UI/Realtime, and separately authorized Slice 3 Production acceptance/closeout. The earlier top-level `Calendar / Tasks` switch is superseded by the minimum reusable current-Space / Space Hub entry. Slice 2 frontend passed user-run authenticated acceptance locally before the separately approved Vercel deployment and Production acceptance.
- **2026-09-23 status-ownership correction:** Real A/B acceptance found that A could complete a Task assigned to B under the former all-member status rule. The product rule now requires A to reassign B's Task to A first, then complete in a second UPDATE. A same-statement reassignment plus status transition is rejected against the old assignee. The small corrective trigger was applied to Production after local tests and postflight; existing Task RLS and ordinary collaborative edits remain unchanged. This does not close Slice 2 acceptance.

## Authenticated Integration and backend-first rollout — 2026-09-23

- Before requesting any real-login, A/B, Realtime, or authenticated mobile/PWA manual acceptance, Codex must verify the frontend's actual backend environment, the backend's required schema/RPC/Edge Function capabilities, and feature-version compatibility. A mismatch blocks manual acceptance.
- A reviewed, tested, backward-compatible additive backend change may reach Production first, followed by backend postflight and user-run real-account acceptance of the local new frontend against Production. Frontend commit/push and Vercel rollout wait until that acceptance passes and separate Git authorization is given.
- Frontend defects remain local; backend corrections require a new reviewed forward corrective migration. Applied Production migrations are not rewritten, and Production is not casually rolled back or reset. Breaking/destructive migrations require a separate rollout, compatibility, and rollback plan.
- Codex owns automated checks and environment alignment. The user owns Magic Link/OTP, A/B real-account, authenticated browser-session, and iPhone/Android/PWA acceptance in real browsers/devices. The 2026-09-23 Slice 1 Production Task foundation postflight passed; this is not Slice 2 or v0.1.9 user-facing Production acceptance.

## Shared Life Architecture Freeze — 2026-09-23

The canonical long-term model and roadmap are in [Shared Life Architecture Freeze](./SHARED_LIFE_ARCHITECTURE.md). This is a docs-only architecture decision, not an implementation or deployment milestone.

- At the 2026-09-23 architecture freeze, first-level navigation was `首页 / 日历 / 空间 / 我的`: cross-module Home, Calendar time/source aggregation, Personal and Shared Spaces with modules, and personal account/device/settings respectively. That shipped navigation remains current until the separately frozen v0.1.12 migration below; the full navigation was not part of v0.1.9.
- Each user will have one genuinely private Personal Space and may join multiple Shared Spaces. Each business object has one canonical Space; views may aggregate Spaces. An Event marked `personal` inside a Shared Space remains visible to that Space's members and is distinct from Personal Space content.
- Each Space has Calendar as its core and may enable Tasks, Lists, Important Dates, structured Review / Check-in, Memo, or later modules. Enablement is per Space; disabling hides a module without deleting its data, and re-enabling restores visibility. Permanent data deletion is deferred; v0.1.10 enable/disable authority is frozen below.
- Calendar Sources may be Space-backed or global/external, including Chinese holidays and adjusted workdays, ICS, and later Google or Apple/System calendars. External sources need no owning Space; views may overlay or filter Space Calendars.
- The initial long-term creation model considered Event, Task, List, Important Date, and Memo; Wishlist is a List type. Slice 4's final product decision below supersedes the Home entry surface: the current Event and Task section actions each open their matching form directly. Each Home form has a selectable target, names it in the save action, and requires a second target confirmation before writing. Future module actions will be considered with their Home sections when implemented.
- Event and Task retain distinct semantics. Task due dates may later be projected read-only into Calendar. Review / Check-in is structured content with period, Focus, Wins, Problems, next plan, and historical continuity; voice input is a goal without a frozen technical approach. Task Archive is deferred; v0.1.9 Completed remains reopenable/deletable history without a new status.
- The original 2026-09-23 directional roadmap placed Lists at v0.1.12, Important Dates at v0.1.13, Review at v0.1.14, and Calendar Sources v1 at v0.1.15. This sequence is superseded by the 2026-09-25 roadmap re-freeze below; later module priorities and ordering are open to change based on real product use. Native remains a decision gate without a committed implementation version.

## v0.1.10 Personal Space / Multi-space / Module Enablement Scope Freeze — 2026-09-23

- Status at scope freeze: `CLOSED / READY FOR IMPLEMENTATION`. Final status: Slice 1 backend `PRODUCTION BACKEND ROLLOUT PASS`; Slice 2 `CLOSED / PASS`; Slice 3 `CLOSED / PASS` after user-run authenticated Production acceptance; v0.1.10 `CLOSED / PASS`. The full contract and accepted closeout state are in `docs/SHARED_LIFE_ARCHITECTURE.md` and `docs/TESTING.md`.
- Reuse `spaces / space_members`; `spaces.kind` is `personal | shared` with `shared` as the legacy default. The sole Personal Space per user uses **`UNIQUE(created_by) WHERE kind = 'personal'`**, never `UNIQUE(kind, created_by)`, so multiple Shared Spaces remain possible. Personal membership is exactly the creator as sole owner, enforced even against direct membership writes. `kind` and `created_by` cannot be client-mutated; Personal Spaces cannot be invite-joined, exited, or ordinarily deleted.
- Remove the one-user-one-space membership unique index while retaining `(space_id, user_id)` identity. Shared create RPC still creates Shared Spaces only; join checks duplicate membership in the target Space and retains the two-member limit. Shared Space three-plus-member support is deferred because existing Event UI assumes one other member.
- Personal Space Events are database-enforced `scope = 'personal'` with `owner_user_id = spaces.created_by`; their UI hides the audience selector. Shared Space `scope = 'personal'` retains its existing meaning. Personal Tasks retain the existing schema and authorization, hide assignment UI, and default new rows to `assigned_to_user_id = NULL`.
- Calendar is implicit and always enabled. `space_modules(space_id, module_key, enabled)` stores optional Space-level state; absent row means disabled. Existing Shared and new Personal/Shared Spaces have Tasks enabled by default; Lists, Important Dates, Review, and Memo default disabled. v0.1.10 exposes only the Tasks toggle. Disabling Tasks retains SELECT/history but blocks all Task mutation at the database boundary; re-enabling restores access to historical rows. Only Space owner may toggle through a controlled RPC; other members read state without direct table-write rights.
- One validated frontend `selectedSpaceId` drives Event, Task, members, modules, and Realtime. The client must prevent stale requests/subscriptions from crossing a switch. Existing users initially retain their old Shared Space; users without a Shared Space default to Personal Space. Current Space is not a unique profile/database attribute.
- Backend capability may deploy first, but no Personal Space auto-creation or bulk backfill occurs before compatible frontend readiness. The new frontend then uses an idempotent `ensure_personal_space()` per user; bulk backfill is considered only after real authenticated acceptance. Production schema/index/RPC/RLS preflight and postflight are required; the read-only repository audit did not establish Production state.
- Three slices: Data / permission foundation; Selected/current Space vertical flow; Tasks module enablement + user-visible `Task / Tasks` → “任务” UI text closeout, without full i18n. Preserve Event/Task identity, v0.1.9 Task authorization, v0.1.8 Reminder semantics, and recurrence. Full navigation, aggregation, global `+`, Calendar overlay, Lists/Important Dates/Review implementation, External Calendar Sources, UI redesign, Native App, and Shared Space three-plus-member support remain deferred.

## v0.1.11 Navigation + Aggregation Experience Design Freeze — 2026-09-24

- The accepted read-only audit is `V011_SCOPE_READY`; the canonical [v0.1.11 specification](./v0.1.11_NAVIGATION_AGGREGATION_SPEC.md) freezes four bounded slices: Navigation Foundation, Aggregate Calendar, Home Aggregation, and Global Create Safety. Design remains frozen. Slice 1 is `CLOSED / PASS` after automated verification, final review, desktop authenticated acceptance, Production frontend rollout, and iPhone Safari / installed PWA acceptance. Slice 2 is `CLOSED / PASS` after local automated verification, user-run local authenticated acceptance, Production frontend rollout and bounded Production smoke; the rollout made no backend/schema/RPC changes. Overall v0.1.11 remains `IN PROGRESS`; Slices 3–4 have not started.
- `selectedSpaceId` remains the concrete current Space, while Calendar uses an independent all/one-Space filter derived against validated memberships. Home aggregates all visible Spaces. Every aggregate item returns to its canonical Event/Task and corresponding Space context; no duplicate persistence, aggregate editor or backend service is introduced.
- Slice 1 exposes no temporary selected-Space Home. Aggregate Realtime exists only for the active view and tears down on exit/filter/membership/account changes. Personal plus the existing Shared Space suffices for acceptance; no extra Production Shared Space is created just for testing.
- Slice 4 Home Event and Task creation use the two section-specific actions recorded below. Each requires a visible, membership-valid target plus a second target confirmation. There is no silent Shared fallback; Task targets require an authoritative `tasks enabled=true` state, and zero valid targets means creation is unavailable before opening the Sheet. The authenticated integration readiness gate remains mandatory before real-account acceptance.
- Slice 2 Calendar `all` deliberately offers no Event create action. A single-Space filter creates only in that explicitly filtered Space, shows `保存到：<Space>`, and checks membership at Sheet open and submit. Hub → 查看日历 sets the single-Space filter while leaving `selectedSpaceId` unchanged. Slice 2 retains its own creation behavior and does not add the Slice 4 Home shortcuts.
- Slice 4 最终入口调整（2026-09-25）：首页“近期日程”和“需要处理的任务”区块标题右侧各有轻量 `+`，分别直接进入日程、任务创建；首页标题不设创建按钮，也没有类型选择面板。日历、空间、我的不增加此入口。未来模块完成后才考虑其所在首页区块的快捷创建。首页创建仍显示可选目标、写明目标的主按钮和同一表单内的第二次确认；日历单空间日程、空间任务本地入口维持直接保存。

## v0.1.11 Slice 4 Production Acceptance + Final Closeout — 2026-09-25

- 用户报告 Production installed PWA acceptance `PASS`。验收时 Production URL 对应 Slice 4 前端提交 `f916dc0f0a1962facca44f4174241031b4f44bf2`。结合此前 Desktop authenticated acceptance `PASS`，Slice 4 和 v0.1.11 更新为 `CLOSED / PASS`。
- 专门的 iPhone Safari 最终验收为 `NOT RUN`，没有推断或记录为 PASS；本次以 installed PWA 真实使用验收完成 Slice 4 移动端验收，因此 Safari 单独未测不是 blocker。Slice 3 独立 Event/Task 区块错误/重试仍为 `NOT RUN / DIFFICULT TO SIMULATE SAFELY`，也不是 closeout blocker。
- Slice 4 保持首页两项分开的直达创建入口及安全 contract：Personal Space 默认、不使用 `selectedSpaceId` 隐式定 target、用户可换 Space、Task 只能写入 Tasks-enabled Space、disabled Personal Tasks 不 fallback、提交前复验 membership/module/member-derived state、轻量二次确认、stale-request 与重复提交保护；现有 Calendar 单 Space 日程及 Space 内任务创建继续走本地直达路径。
- Production 部署和 PWA 验收属于前端；没有 Production backend、schema、RPC 或业务代码变更。

## v0.1.12 Module Hub + Space Management Navigation — Frozen Direction — 2026-09-25

- The v0.1.12 product direction is frozen as a module-first navigation migration from `首页 / 日历 / 空间 / 我的` to the semantic target `首页 / 日历 / 功能中心 / 我的`. The exact Chinese tab label may be confirmed during the read-only repo / product / architecture design review. The third destination opens modules directly rather than asking the user to choose a Space first. At the time of this roadmap freeze, implementation had not started; Slices 1–4 have since closed.
- Migrate only currently implemented optional modules. Tasks is the only implemented optional module and the first module to expose in 功能中心. Lists, Important Dates, Review / Check-in, Memo, and Wishlist do not get implemented or shown as placeholders; this direction adds no generic module framework or plugin system.
- Keep module enablement and a module page's view filter as separate semantics. `space_modules` remains per-Space configuration; the Tasks filter lists only Spaces with Tasks enabled. Disabling a module hides it from that Space's module entry while retaining its data. Each module owns its own filter; Calendar's `calendarFilter` stays independent and continues to support all Spaces or one Space. Do not add a global app-wide Space filter.
- “我的” target responsibilities are personal profile, Space management, and general settings. Space management may provide the Space list, create/join actions, and a Space detail surface for members, invitations, Space settings, and enabled-module controls. Module controls may be a section within Space details; a separate nested module-management page is not required. Slice 2 later delivered this management structure and is accepted `CLOSED / PASS`; visual refinement is deferred to a future unified design pass and is not a functional blocker.
- Space remains the canonical ownership boundary. Events, Tasks, Lists, Important Dates, and Review each belong to one canonical Space; `ownership ≠ view`. This migration changes navigation, aggregation, and view, not canonical ownership, persistence, or the Space schema.
- Preserve the v0.1.11 Home shortcuts: “近期日程 +” directly opens Event creation and “需要处理的任务 +” directly opens Task creation. Future module Home sections and shortcuts are decided when each module is actually implemented.

## v0.1.12 Final Production/PWA Acceptance + Closeout — 2026-09-25

- The user reported final authenticated Production and installed-PWA acceptance `PASS`. Slice 4 and v0.1.12 are `CLOSED / PASS`, with Slices 1–3 already closed. The accepted navigation is 首页 / 日历 / 功能中心 / 我的; 功能中心 contains only 任务, while 我的 → 空间管理 owns Personal/Shared Space detail. Space remains the canonical ownership boundary.
- Visual refinement, unused `MemberSheet.tsx`, `space_modules` Realtime, and Calendar all-Space creation stay deferred. v0.1.13 Space Lifecycle & Membership Safety is the next planned version; no lifecycle design or implementation is part of this closeout.

## v0.1.13 Slice 2 — Filter and Lifecycle State Contract

Slice 2 state review clarification: lifecycle operations do not synchronously set Calendar or Task filters. The existing canonical eligibility reconciliation may return `all` or another established valid default after their selected Space becomes ineligible. A successful leave/delete clears the management selection and detail before attempting the list refresh; remove/transfer retain the still-valid current Space.

### Final closeout — 2026-09-25

- v0.1.13 and Slices 1/2 are `CLOSED / PASS`. Slice 1 backend Production rollout/postflight and Slice 2 frontend Production deployment passed; the user reported authenticated, mobile and installed-PWA acceptance `PASS`. Codex did not operate the authenticated sessions or PWA.
- Future direction only: consider `Personal Event → Share / Projection` into another Space while the Event remains one canonical object owned by its source Space. A target Space may gain visibility through a projection, not a second canonical Event; leaving the target Shared Space must not affect the source Event. This is outside v0.1.13 and does not reserve schema or authorize implementation.
- Next Action is next-version product planning, including reprioritizing Structured Review / Check-in, Shared Lists and other candidates. No next feature is selected or started by this closeout.

## v0.1.13 Slice 1 — CLOSED / PASS

The frozen backend design passed local verification and the Slice 1B Production rollout/postflight. At the Slice 1 closeout checkpoint, Slice 1 was `CLOSED / PASS` and Next Action was Slice 2 Space Detail lifecycle controls. The runtime invariant boundary covers `anon`, `authenticated`, and `service_role`; DB owner/postgres/migration administrators are outside it. These application roles must not bypass the owner/member/Event/Task lifecycle guards through legacy `TRUNCATE`, so Slice 1A revokes only that privilege on the six affected tables. Historical reminder ledger rows remain independent records. No general ACL framework, TRUNCATE trigger, or account-management capability is introduced; the only Production mutation was the reviewed Slice 1A forward patch. v0.1.13 overall is now `CLOSED / PASS`; see the final closeout above.

After v0.1.12 closeout, prioritize Space Lifecycle & Membership Safety before adding further Space-owned modules. Future candidate capabilities include leaving Shared Space, removing members, transferring ownership, and deleting Shared Space. Structured Review / Check-in and Shared Lists remain important candidates after lifecycle safety; do not assign versions beyond v0.1.13 yet.

At the original roadmap freeze, only these high-level safety principles were recorded; the later Slice 1A backend design and local implementation supersede that initial design status:

- Personal Space cannot be deleted or left.
- Owner exit must not create an ownerless Shared Space.
- Ownership transfer, member removal, leaving, and deletion require explicit permission and data-integrity design.
- Destructive multi-record operations should prefer atomic backend-owned behavior over fragile frontend mutation sequences.
- Shared Space deletion must be reviewed against all Space-owned canonical data; future modules must respect the eventual lifecycle contract.

## v0.1.14 回顾（Structured Check-in）Design Freeze — 2026-09-25

- v0.1.14 的产品语义于 2026-09-25 完成 docs-only 设计冻结；canonical 数据、权限、UI、slices 和验收契约见 [v0.1.14 规格](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md)。Backend/date chronology、Slice 2–4 frontend、acceptance fixes、Production deployment/public smoke、用户报告的 Production authenticated acceptance 与最终 exact-ID fixture cleanup 均已通过；v0.1.14 现为 `CLOSED / PASS`。
- 每轮回顾的 participant 在创建时以 `review_entries` 固定。读取和写入旧轮均要求当前 Space membership **及**该轮 participant 身份；leave/remove 保留历史 entry，但离开者失去访问权，新成员不能访问或补写旧轮，原 participant 重新加入后恢复旧轮访问。Personal 一人可创建；Shared 仅当前两名成员齐全时可创建，沿用现有两人上限。
- `round_no` 是每 Space 创建时固定的内部编号，创建 RPC 锁 Space 行后取 `max+1`，以唯一约束兜底；它不在历史、详情、无障碍名称或更正日期弹窗中向用户显示，不承担业务 chronology 或 previous-plan 关系。`review_date` 是业务时间轴，可由当前成员且该轮 participant 通过窄 RPC 更正，不改编号或参与者。
- 2026-09-26 第一轮真实账号验收后的 bounded 调整移除了用户可见序号、加入 RLS authoritative `共 N 篇回顾` 并统一「上一份计划」文案。第二轮反馈 supersede 了当时“同日多份允许、previous-plan 使用 `round_no-1`”的决定：现在数据库保证 `unique(space_id, review_date)`；同日新建/日期更正冲突明确拒绝；上一份计划严格取同 Space 中 `review_date` 小于当前日期的最近一篇。日期上的立即上一篇没有本人 entry 或 plan 为空时返回空态，不向更早日期 fallback。
- previous-plan 使用窄 `SECURITY DEFINER` 只读 RPC，因为 participant RLS 会隐藏未参加的真正上一篇，纯客户端查询可能错误跳到更早的可见回顾。RPC 先验证当前轮 membership + participant，再在后端确定真实上一篇，只返回调用者自己的 plan 或 `null`，不泄露隐藏 round 元数据或对方正文。
- 四个内容字段均可空；全空为未填写且不能标记。非空内容以服务端 content/filled revision 导出编辑中、已填写、有更新；相同内容重复保存不增加 revision。各人只能编辑、标记自己的 entry；无单次回顾删除。
- 沿用 `space_modules`：缺行/关闭时不进入正常回顾选择器、禁止写入、保留历史，重开恢复。只扩展 owner-only 模块开关，不加 Realtime、archive/read-only 旁路或通用框架。面向用户只称「回顾」。

## v0.1.14.1 Navigation Persistence — 2026-09-26

- 在现有 React memory navigation 上使用按 authenticated user 隔离的 sessionStorage 小型页面目标，恢复同一 browser/tab session 的刷新位置。只保存页面与稳定 Space/Review ID；不保存筛选、业务数据、草稿、弹层或 `justCreated`。新登录从首页开始，logout 清除当前用户目标。
- 恢复必须经过当前 membership、Review module eligibility 与 participant 读取；已确认失效时按目标页面回退，读取失败时保留重试。保持 selectedSpaceId localStorage 及 Calendar/Task/Review 各自的选择边界。此版本不迁移 router，不提供深链、browser history 改造或 PWA 完全关闭后的页面记忆承诺。

## v0.1.15 Shared Lists Design Freeze — 2026-09-26

- Status is `DESIGN FROZEN / CLOSED / PASS`: Slices 1–4 are `CLOSED / PASS`. Final desktop authenticated, dual-account Realtime and mobile/PWA acceptance, including Item drag and long-list auto-scroll, passed. Section drag is `DEFERRED / NON-BLOCKING`; stale reorder is `AUTOMATED PASS / MANUAL NOT REQUIRED`. The canonical contract is [v0.1.15 Shared Lists Specification](./v0.1.15_SHARED_LISTS_SPEC.md).
- Lists are owned by a Space and enabled independently in Personal and Shared Spaces. Three relational tables—`lists`, `list_sections`, and `list_items`—represent the fixed List → Section → Item structure. `created_by` is audit metadata only. A single redundant `list_items.space_id` is allowed only with a composite FK enforcing consistency with its parent List; nullable `section_id` represents ungrouped Items.
- Completion is derived only from real Items; empty Lists remain active. Progress, completion status, completion time, archive state, and duplicate counters are not persisted. Deterministic integer/bigint `sort_order` remains canonical through completion/reopen; transactional reorder RPCs lock the parent List, validate current membership of the reorder set, and renumber atomically.
- Non-empty Section deletion is frozen: “仅删除分组” moves Items to ungrouped and appends them as a stable ordered block; “删除分组及其中内容” removes them atomically. Whole-List deletion uses a two-step UI confirmation that identifies the List and its Space both times, then cascades through backend/FKs.
- Item drag within ungrouped or the same Section is a v0.1.15 requirement. Up/down controls may be accessibility/keyboard fallbacks but do not replace drag acceptance. Cross-Section drag remains deferred; Section drag may be deferred only if Slice 4 mobile validation finds it materially complex. No drag dependency is installed during Design Freeze.
- Membership and module eligibility are revalidated at Lists entry, focus, Realtime reconnect, and relevant mutation rejection. No perpetual Lists-specific membership polling loop is introduced. Realtime remains notification-to-reread; filtered DELETE delivery must be validated with two authenticated accounts.
- The four frozen implementation slices are DB foundation, overview/ownership, detail/collaboration, and ordering/mobile acceptance. The accepted Slice 1 concurrency amendment requires a narrow `set_list_item_completed` RPC and denies direct `completed` updates, keeping all completion-group changes on the parent List lock path. Slices 1–4 are `CLOSED / PASS`; Slice 4 Item drag passed local automation, desktop/dual-account and mobile/PWA acceptance. Stale reorder remains `AUTOMATED PASS / MANUAL NOT REQUIRED`.

## v0.1.15 Slice 4 Section Drag Deferral — 2026-09-27

- Item drag uses the explicitly authorized single direct dependency `@hello-pangea/dnd@18.0.1`. Section drag/reorder UI is `DEFERRED` under the frozen bounded-complexity exception: nesting movable Sections around sortable Item groups materially increases touch gesture, scrolling, accessibility, and testing burden. The existing Section reorder RPC remains unused. This deferral did not block Slice 4 or v0.1.15 closeout.

## Future UX Consideration — Calendar Create Action

现有 Slice 2 冻结行为是：Calendar 选“全部空间”时没有日程创建 `+`，筛选单一 Space 时显示创建 `+`。未来可以重新评估这项行为；本次不改，也不重开 Slice 2。

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
