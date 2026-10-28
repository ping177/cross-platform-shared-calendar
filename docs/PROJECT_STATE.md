# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.21

## Current status

2026-10-28 — **v0.1.21 Slice 3 = LOCAL VERIFIED / RELEASE AUTHORIZED / FINAL ACCEPTANCE PENDING**。用户报告本地日历页面基本操作正常，并明确授权本次Commit、正常Push origin/main及既有Vercel Production发布。仅发布已验证的Calendar REST / Realtime Decoupling；无额外业务改动。用户当前无实际日程，不能声称真实非空数据验收通过；Production仅待页面打开、日期/月切换、刷新无异常的轻量确认，故障边界沿用自动化，不要求制造线上Realtime故障。Slice 2及Follow-up关闭、Slice 1暂缓、Slices 4–5未开始保持。 实际部署Source/资源及最终Git结果以本轮回执为准，不预写发布成功。

2026-10-28 — **独立 Review UI/UX Follow-up = CLOSED / ACCEPTED（按实际验收范围收口）**。用户确认最终 Production 视觉满意并明确结束本轮，不再追加人工验收。阅读页右滑返回由用户真机验证 PASS；最终“标记已填写”的位置、字号、布局获视觉确认，阅读页与编辑页两个入口保留。编辑态右滑、dirty 取消四字段保留/确认离开、阅读态标记/已完成去重及旧 revision 拒绝等未逐项真机检查，记录为 AUTOMATED PASS / MANUAL NOT RUN，不冒称人工 PASS，且不再作为本轮待验收阻塞。

已发布业务基线 `412ad4f8c5ac3ce13df7d46f6a9d8f2d2890269b`；Vercel Production `7379031279` success、Source 匹配，HTML/JS/CSS/manifest/SW/两个图标 7/7 与最终 Build 逐字节一致。既有 Node1000/1000、WebKit/Chrome46/46及最终布局针对性 Node31/31、WebKit/Chrome39/39、TypeScript/Build PASS 证据沿用，本次仅治理，不重跑业务或数据库。

v0.1.21 整体 IN PROGRESS；Slice 2 CLOSED / PASS、Slice 1 DEFERRED 保持。Slice 3 仅获只读调查授权，尚未实施；Slices 4–5 NOT STARTED。不新建版本条目。下方 Follow-up 的 LOCAL/PENDING/未发布及人工验收清单均为历史检查点，由本次范围收口接续。

2026-10-28 — **v0.1.21 Slice 2 = CLOSED / PASS**。用户明确确认Production真实验收全部PASS：PWA登录、回顾四字段保存及重入保留、双方独立填写与“我已填写”状态、同账号双会话旧稿拒绝、冲突四字段保留、查看最新不清稿、取消载入保留及明确确认才替换；日历、任务、清单、重要日和空间管理抽查正常。解除本次Review写入维护，可恢复正常使用；Codex未操作真实登录会话。

已验收功能发布Commit `069f6fe5e22356991ee4eda2d409f6a100886ff8`，Production数据库Patch/Postflight/Negative Probes/Schema Cache、Vercel部署及七项线上资源核验均PASS；最后代码验证Node996/996、WebKit/Chrome14/14、TypeScript/Build PASS。本轮仅治理收口，不改业务/SQL/测试或重跑数据库。v0.1.21整体仍IN PROGRESS：Slice 1 DEFERRED，Slices 3–5 NOT STARTED；v0.1.20 CLOSED / PASS保持。后续UI/UX反馈及非阻塞观察单独记录BACKLOG，不算本Slice并发保护失败。下方旧检查点为历史。

2026-10-16 — **v0.1.20 = CLOSED / PASS**。全域 UI/UX 一致性修整及创建表单 Space 选择器补充修复全部完成；用户明确确认在已安装正式 iPhone Production PWA 中完成整轮六项及补充六项人工验收，全部 PASS。验收属于真实用户，不是 Codex 自动化或模拟结果。本地自动测试、本地 iPhone Safari 人工、Production 部署及静态资源核验、Production iPhone PWA 人工验收均 PASS，无剩余阻塞性验收项。

最近已验收业务代码基线 `b021a41d4d02543e565a121ba6a8cdb17c988361`；此前整轮六项验收对应 `e70c66f3e221d33f3ebe6ff474334eb51a422662`。最终代码 Node990/990、WebKit/Chrome105/105、TypeScript/Build/语法/diff-check PASS，本次只做 docs-only Governance Closeout，不重跑代码测试、不创建新版本。此关闭只证明已定义版本/UI范围及用户确认场景，不代表所有业务E2E或整个项目正式试用已完成。

下一阶段仅记录“独立工程稳定性审查（尚未启动）”，等待另行指示后先只读检查。非阻塞保留：普通日历编辑可能显示通用“我的空间”来源文案、既有 bundle 大小提示。下方旧实施/发布记录的 Pending/Local 状态为历史事实，已由本次最终验收接续，不作为当前待办。

本轮删除确认UI与清单分组WebKit触摸修复 = **PRODUCTION ACCEPTED / CLOSED / PASS**。用户确认正式Production iPhone PWA最终验收PASS。验收对应应用基线 `8d7fb252c60b75688d0a736be6f761c0506ff0b5`（其前端实现提交为 `b0487c106cc654dc72de5054191480376b9aacc8`）；GitHub Production 7093050865 / Vercel `HSqce4foW3jffYGfjpmRi5rAdrKw` 成功。992/992、WebKit/Chrome18/18、TypeScript、Build、Node语法和diff-check PASS。只关闭本轮UI修复及验收，不代表整个项目已完成正式试用或所有业务E2E。正式版本仍v0.1.20；没有数据库、Edge、Cron、Auth或业务数据变更。

用户报告Production测试数据已清理，目前保留两个账号及各自Personal Space；本轮未执行该清理或独立读取账号数据。此前整理测试数据/三个账号保留两个的计划已由用户报告接续，不再列作当前待执行任务。

用户确认Profile Card Compact + Avatar v1正式Production人工验收PASS，最终状态CLOSED / PASS；Space Rename真实Production功能及最终UI也为CLOSED / PASS。Avatar已验收功能发布Source SHA：fcd3c8ad1b91bd7ec137c331e3d721ea8fae6cac。12预设及猫F+02「陶粉与燕麦」保持冻结。该整体验收不扩大为跨设备、照片替换/默认恢复、真实失败/断网重试、退出最后共同Space的新签拒绝、5分钟签名续期及iOS/Android/PWA全部边界已通过；未完整验证项继续在观察期记录。

Avatar阶段全量957/957、相关49/49、TypeScript/Build已PASS，后端增量补丁/Preflight/核心Postflight通过为用户报告；独立前端目标/API及发布Source/正式资源核验通过。该阶段已关闭；本轮新增前端范围仍按上方Production/PWA待验收规则执行，不改后端。

**UI v2 及后续 Calendar 视觉优化 = PRODUCTION ACCEPTED / CLOSED**（仅关闭 UI 改造及对应发布验收范围）。UI v2 的全部11个 Slice、Integration Round 1/2 与功能中心顶部概览优化已完成；UI v2 已发布 Production 并通过用户验收。Calendar UI Patch（统一日/周/月头部、重做周视图及日期对齐修正）Commit `391708f4…` 已发布并通过用户验收。Calendar Chevron Removal Commit `ecbe03d7…` 移除日/周视图日程右侧箭头并保留整行点击；该 Chevron 补丁部署 source HEAD `1fc7a3bd…`，用户再次确认正式网站箭头消失且点击正常。

该范围的全量测试为919/919 PASS，响应式检查180/180 PASS，Build PASS；既有 bundle 大小警告为非阻塞项。上述 UI 改造不需要新增 Supabase migration。正式产品版本仍为 v0.1.20；这项关闭不表示所有完整业务 E2E、危险操作、Push 或 Realtime 场景均已覆盖。P2字重审美、Space Color System、多人共享空间/回顾、跨 Space 投影继续 Deferred；农历为未来候选，若实现优先放在周视图每日区域右上角。不新增下一版本或额外开发计划。旧版29项修改已保存在 `design/ui-redesign` 归档提交 `84f0a087…`；原项目目录现为日常 `main` 工作区。

以下 Slice/Round 条目保留各自当时的实施与验证状态；其中“未发布 / 待验收”等文字均为历史检查点，以上方最终 Production 状态为准。详细实现和风险记录保留在 DEVLOG / TESTING。

UI v2 Module Hub Refinement = LOCAL PASS / VISUAL ACCEPTED：用户在本地确认顶部四项概览视觉通过；本次最终复审仅四授权文件，真实数据/业务与下方导航保持。重跑36/36、918/918、build/diff-check PASS，既有42/42响应式/截图证据源码指纹一致。11个Slice、Round1/2及本次优化均已完成本地视觉验收，UI v2视觉开发阶段已完成；部分真实桌面检查已由用户进行，完整业务E2E、真机/PWA/Push/Realtime与Production验收仍Pending。仅本地Git收口，未push/deploy/merge；整体集成、合并和发布未完成，Production仍v0.1.20。

UI v2 Integration Round 2 = LOCAL PASS / VISUAL ACCEPTED。用户明确确认日程、任务、重要日三个共享表单视觉满意，最终范围/业务复审通过；本轮直接相关64/64、全量918/918、build/diff-check PASS，既有六真实CSS视口144/144、短视口30/30及13张375px截图源码指纹匹配。三个共享表单视觉整合完成；按本轮最终确认，11个Slice及Round1/2均完成本地视觉验收，计划中的UI v2视觉开发阶段结束。仅授权12文件本地Git收口，未push/deploy/merge。UI v2整体集成验收、合并和发布仍Pending，Production保持v0.1.20。环境对齐Gate、真实账号/双账号E2E、原生dirty confirm、真机软键盘/IME/Safe Area、iOS/Android PWA、Push/Realtime及Production验收均Pending；P2字重审美、Space Color System、多人Shared Space/回顾与跨Space投影等Deferred不自动实施。

UI v2 Slices 1–11均完成本地阶段；Slice11 = LOCAL PASS / VISUAL ACCEPTED。我的名称行内编辑、空间分组及创建/加入、成员/邀请码/模块开关与原生命周期流程本地完成。直接12/12、Space UI26/26、相关91/91、全量895/895、build/diff-check、六视口102/102和短视口12/12通过。已获用户视觉确认并完成本地Git closeout。原生dirty确认接受/拒绝完整E2E仍待人工验收；真实账号/双账号、Push、手机软键盘、PWA、Realtime及Production验收也待最终集成阶段。UI v2整体尚未完成集成验收、合并或发布；正式Production仍为v0.1.20。

UI v2 Slice10 = LOCAL PASS / VISUAL ACCEPTED：用户确认重要日模块与Emoji选择器整体视觉满意。最终相关376/376、全量883/883、build/diff-check PASS；六真实CSS视口24/24、短视口/滚动12/12、键盘/Escape/Focus及六张375px截图通过。范围精确7文件；真实账号、双账号、真机、PWA、Realtime与Production仍待UI v2最终集成验收；全局中文字体栈/字重检查Deferred。Production正式v0.1.20不变，UI v2整体未完成/未发布。已按授权完成单一本地commit，未push/deploy，不自动进入Slice11。

UI v2 Slice9 = LOCAL PASS / VISUAL PROVISIONALLY ACCEPTED。用户接受清单布局与交互；对字体美观及字重搭配仍有保留，记录为暂时接受。清单/分组···、项目名称原位编辑、快速添加/完成/拖拽及局部dirty/IME/导航保护保持。最终12文件范围，清单59/59、全量872/872、build/diff-check PASS；真实CSS视口320/360/375/390/768/1024均无横向溢出，375px操作同排，320px删除换行但44px热区保留。最终视觉一致性阶段Deferred：复核中文字体栈、字重层级与行内操作按钮排版。多人回顾仍Deferred / Design Pending；正式v0.1.20不变，真实账号/设备/PWA/Realtime/Production未验收。已按授权完成一个本地commit，未push/deploy，不自动进入Slice10。

UI v2 Slice8 = LOCAL PASS / VISUAL PASS：用户已确认历史、详情、填写、草稿/已填写状态及透明18px灰绿44×44 +。最终范围11授权文件；相关47/47、全量850/850、npm run build、git diff --check、六视口90/90通过；预览 `/slice8-plus/index.html` 有真实375/390截图。多人回顾仅只读审计，BACKLOG标记Deferred / Design Pending。正式v0.1.20保持；真实账号/双账号/设备/PWA/Production仍未验收。按用户本轮授权创建一次本地commit后状态应clean；未push/deploy，不进入Slice9。旧worktree保持原28 modified + 1 untracked及8725项文件指纹。

UI v2 Slice7 = LOCAL PASS / VISUAL PASS：用户已验收任务列表、页内已完成折叠、任务Sheet、Shared“分配给”、透明18px任务+及全局下拉箭头。15处native select与日历Space按钮触发器采用统一16px chevron/right16/text reserve48px；任务/导航/业务行为保持。完整回归841/841、build与diff-check PASS；一个本地commit已完成。真实账号、iOS/Android、installed PWA与Production尚未验收；未push/deploy。

UI v2 Slice6 = LOCAL PASS / VISUAL PASS：用户已认可四张居中概览卡片视觉；最终范围审查、候选计数修复和完整相关回归317/317、build/diff-check PASS，本地Git closeout完成。业务数量指标保留精确计数，资格/刷新/日期规则保持。真实账号、iOS/Android、installed PWA与Production未验收。此前STOP审计及全部实施记录保留于DEVLOG。

v0.1.20 CLOSED / PASS及既有Production/PWA历史验收保持。UI v2 Slice2/3为LOCAL PASS / VISUAL PASS；Slice4为LOCAL PASS / VISUAL PROVISIONALLY ACCEPTED。Slice5月视图本地验证与离线视觉验收通过：两条短标题/准确+N、六色圆点与日期浮层，261/261相关测试、build/diff-check、28组四宽度离线检查PASS；用户确认普通月、密集月、空月及浮层满意。已授权本地commit；不代表真实账号、真机、installed PWA或Production验收。Space Color System继续Deferred；真实账号/真机/installed PWA/Production未验收。正式版本仍v0.1.20。

## Latest completed

2026-10-28 — 用户报告Slice 3本地日历基本操作正常并授权发布；四项业务/测试指纹保持，重新Build与已测试产物逐字节一致，语法/diff及生产依赖audit通过。全量Node1013/1013、双引擎Browser96/96证据沿用；无代码扩改，不提前关闭Slice 3。

2026-10-28 — 独立 Review UI/UX Follow-up 按实际范围 CLOSED / ACCEPTED；阅读态右滑真机 PASS、最终 Production 视觉满意，其他边界仅自动化覆盖，用户不追加人工验收。仅治理收口；Slice 2 不重开。

2026-10-28 — Slice 2 Production真实用户验收全部PASS，正式CLOSED / PASS并解除Review维护；完成治理收口及后续反馈登记。功能发布、数据库与自动化证据保留，真实验收逐项见TESTING首节。

2026-10-16 — v0.1.20 全域UI/UX及表单Space补充正式 CLOSED / PASS。用户确认整轮六项与补充六项真实 Production iPhone PWA 验收全部 PASS；本地自动/人工及Production部署/资源证据齐全，业务代码基线b021a41。仅治理文档收口，无功能、样式、测试实现、后台、依赖或配置变更。下一阶段独立工程稳定性审查尚未启动。

2026-10-16 — 用户确认四类创建及首页快捷新建 iPhone Safari 全部 PASS，授权补充修复正式发布。24 文件累计范围审查通过；最终源码完整 Node990/990、WebKit/Chrome105/105、TypeScript/Production Build、脚本语法/diff-check及生产依赖audit0通过，未改产品设计或业务。此前整轮六项正式 PWA PASS 保留；本次新增控件正式 PWA 待用户验收，发布与资源结果见 `/private/tmp/calendar-space-release/` 独立记录。

2026-10-16 — 系统盘点 Event/Task/List/Important Date 创建与编辑、首页快捷入口、Review：只有四类创建表单存在原生 Space 选择，均接入小型 SpaceTargetDropdown；既有 SpaceFilterDropdown 增加 opt-in 弹窗定位/禁用选项/嵌套键盘支持，筛选状态与保存归属分离。当前控件、父级资格/默认值及真实提交回归结果见 TESTING；等待用户本地 iPhone Safari，原六项正式 PWA PASS 保持。

2026-10-16 — 用户确认本轮全部本地iPhone Safari PASS并授权发布。累计30文件范围复审通过；仅修一处旧静态测试的class顺序假设，安全区/滚动约束与真实DOM覆盖保留，无应用重改。最终Node990/990、原并行Browser81/81、TS/Build/语法/diff-check及生产依赖audit0；375/430视觉及此前首页10场景有效证据通过。实际Git/Production结果另行核验，正式PWA验收Pending。

2026-10-16 — 首页三板块标题仅两处class调整，统一16px/600/24行高；真实HomePage及当前CSS双引擎10场景实测，卡片、正文和主标题几何/内容保持，Node115/115及TS/Build通过。此前六项本地人工验收PASS已由用户确认，当前仅待首页；完整证据 `/private/tmp/calendar-home-title-check/`。

2026-10-16 — 三模块次级折叠入口统一透明/无描边、14px/500、44px热区、18px Chevron与12px区块间距；清单/重要日同级主分组标题统一14px/500。WebKit375/430、Chrome375真实四模块两种数据状态完整并排，触摸/键盘/焦点/展开收起及页底可见性通过。Node80/80、浏览器70/70、TS/Build通过；其余已验收源码保留，尚待折叠入口人工复验。证据 `/private/tmp/calendar-disclosure-review/`。

2026-10-16 — 两个回顾Sheet底部悬空定向修复：外层py4是标准模式16px底部空隙来源；复用既有底部Sheet外部0/内部safe-area/顶部圆角/自然高。测试夹具补doctype排除旧32px混入的form默认margin；双引擎375/430实际gap0，Node35/35、浏览器41/41及TS/Build/语法/diff-check通过。空间管理和登录已获用户真机PASS且源码未再修改；下一步仅Review本地真机复验。

2026-10-16 — 首轮本地反馈三项修正：两个回顾短弹窗375/430横向全宽、原垂直几何不变；Space管理/详情复用原右滑与返回链，真实RootApp/WebKit触摸序列及Chrome原生CDP触摸通过；登录复用浅accent-soft底+accent文字，对比度5.53:1并去旧标语。相关123/123、UI21/21、Space11/11、删除18/18、筛选复跑26/26及最终TS/Build/语法/diff-check PASS；仅待用户三项复验，详见DEVLOG/TESTING。

2026-10-16 — 冻结UX-01至UX-09本地完成；四模块375/430真实渲染标题20px/600、中心偏差≤1px、筛选器y76、标题至筛选器22px；正常空结果14px/400/透明居中/60px高，功能入口64px。真实WebKit日期Tab越界已复现并局部修复；Node990/990、增量40/40、浏览器61/61及最终TS/Build/语法/diff-check PASS。用户本地真机验收Pending，不提交发布或关闭本轮。详见DEVLOG/TESTING。

2026-10-16 — 五模块Space下拉UI及回顾辅助标题本地自动验证和用户真实账号iPhone Safari验收均PASS；发布范围/业务不变复审完成，确认992→990仅移除旧Calendar Sheet的两项模态测试并由新下拉真实DOM覆盖替代。用户授权单一实现提交、正常Push及既有自动Production部署；实际Git/Source/资源证据见本次发布报告，最后Production PWA验收仍Pending。

2026-10-15 — 本轮删除确认与清单分组修复 CLOSED / PASS：用户确认正式Production iPhone PWA最终验收PASS。验收对应应用基线 `8d7fb252c60b75688d0a736be6f761c0506ff0b5`；GitHub Production 7093050865 / Vercel `HSqce4foW3jffYGfjpmRi5rAdrKw` success。992/992、WebKit/Chrome18/18、TypeScript/Build/Node语法/diff-check PASS。治理收口仅更新文档；最终Git与Production状态见本轮交付记录。

2026-10-15 — 用户确认本轮五项iPhone Safari功能/视觉及特殊删除安全规则PASS，并授权正式前端发布；20文件范围与自动验证证据复核、最终Build/语法/diff-check及生产依赖audit0通过。实际Git/Vercel/静态资源另行核验，正式PWA最终验收前不CLOSED。

2026-10-15 — 用户真实iPhone Safari分组/外壳/触摸与安全区PASS；新增删除确认内部层级按清单唯一基准统一，16内容状态×双引擎实测、三组375px并排截图、136/136与992/992、浏览器18/18、TS/Build/diff-check PASS。本轮内部视觉待确认，无提交发布。

2026-10-15 — WebKit真实复现分组四入口失效；最小菜单焦点修复和15类确认状态外壳统一完成，相关126/126、全量992/992、WebKit/Chrome16/16、TS/Build及375/430/短视口检查PASS。仅本地，等待用户反馈，不提交/推送/部署；证据与真机/环境边界见TESTING。

2026-10-15 — Review日期/删除与确认UI功能Production d514b71发布成功（GitHub7089323536 / VercelBZbyFYcM8Erdbq19VmWA3NEFEruv），正式JS/CSS逐字节匹配、Review/List/Invite标识及目标/公钥核验PASS。用户本地验收PASS保持，最后Production iPhone PWA待反馈，不提前关闭。

2026-10-15 — 用户确认Review日期及五项确认交互本地真实PASS；19文件最终范围、源码与992/992/TS/Build证据一致性、diff-check及敏感字面量扫描通过。后端补丁源码与已安装版本一致，仅纳入Git记录。最终Production前端Source/资源和iPhone PWA结果独立核验，不提前关闭。

2026-10-15 — 用户确认上轮Review日期/删除真实PASS；全App删除确认盘点及Review/List/Invite局部UI统一本地完成，992/992、TS/Build和375/430实际组件检查PASS。等待本地确认后另行授权前端Git发布，无后台操作。

2026-10-15 — Review删除Production RPC安装与只读Postflight PASS，既有数据/权限/函数保持；日期更正/删除入口视觉已获用户确认，5175真实Vite目标及新代码对齐。待用户可丢弃回顾真实删除/iPhone验收，未前端Git发布。

2026-10-15 — Review日期更正弹窗局部WebKit边界/左对齐、整次删除RPC及确认/刷新本地完成；自动980/980、TS/Build、升级/全新库及375/430真实组件验证通过。等待用户视觉确认及另行后端发布授权；既有Production Event/Push/Review新建PASS已由用户确认。

2026-10-15 — Event Collaboration及Review前端首个Production功能部署2c233e8完成（VercelAsgVoZ7BxNZaodeG3anCQ3XHu5En / GitHub7087198195 success）；正式JS/CSS逐字节匹配、VAPID/目标/静态资源PASS。已验收后台与真实Push保持，最终Safari/PWA用户反馈待完成，整体不提前关闭。

2026-10-15 — 用户确认Event Collaboration核心A/B及真实Push A→B正确送达PASS、Review本地视觉PASS；最终28文件范围、978/978/TypeScript/Build/diff-check及实际Production VAPID配置核验通过。独立Review提交02d9973；本轮前端实际Source/发布结果单独核验，最终设备验收不提前关闭。

2026-10-15 — 已授权Production后台切换完成：用户SQL独立核验PASS、send-reminders v5/源码匹配、原Cron1恢复及两次自然健康调用PASS；本地5175目标/能力对齐。真实A/B/Push及新前端发布待后续门禁，不提前CLOSED。

2026-10-15 — 完成已确认Shared Space全员Event协作权限的本地SQL/前端/提醒最小扩展；整系列归属事务、RLS保留、CAS/实际返回行、claim前后校验、978/978与双路径DB/并发验证通过。未部署/提交；回顾修复保留，用户审查后按独立授权流程推进。证据见DEVLOG/TESTING/EVENT_COLLABORATION_ROLLOUT。


2026-10-15 — 保留用户确认的四项 Production iPhone PWA PASS；回顾创建仅增加局部样式类、复用 WebKit 日期修正与高度/滚动边界。针对39/39、全量968/968、TS/Build/diff-check通过；375/430十组真实组件与短视口/长名称/失败重试检查通过，桌面证据不等于iPhone。已有Event转移只读评估，无后端修改；尚未提交或发布本轮回顾修复。

2026-10-15 — 用户确认Mac本地视觉正常并授权日期/表单修复发布；最终审查六文件范围、967/967、TypeScript/Build/diff-check通过，保留已验收Event Space创建和全部现有筛选器。发布/Source以独立核验结果为准，iPhone Safari/PWA待用户复验。

2026-10-15 — Production UI问题定向诊断/本地修复：两提交差异无Event/Task容器及日期样式变更；WebKit iOS原生内部值居中/最小宽度机制已查证。CSS仅作用于两类Sheet日期与Event横向滚动，3项回归先失败后通过、全量967/967、TS/Build/diff-check PASS；375/430/短视口及声明的宽度压力模型通过。Production验收FAIL保持，等待真机复验及后续单独发布授权。

2026-10-15 — 日历创建与我的标题用户验收通过，完成统一发布范围审查及964/964、TypeScript/Build验证。正式发布的部署状态与Source SHA以本轮发布核验报告为准；Production/PWA真实人工验收待用户完成。

2026-10-15 — 用户确认日历创建真实账号功能PASS；「我的」标题复用日历text-ui-page-title、左对齐与44px标题行，16px边距和safe-area保持；相关25/25（含Event创建7项）、TypeScript/Build/diff-check及375px隔离真实组件截图通过。等待标题视觉确认及单独统一发布授权。

2026-10-15 — 日历最终创建交互本地完成：7项交互测试、全量964/964、TypeScript/Build/diff-check通过；375px真实组件检查两种默认目标均可修改，草稿保留、最终目标模拟保存、单空间/空空间与取消通过。用户验收/发布未完成，后端与Avatar不变。

2026-10-14 — 用户确认Profile Card Compact + Avatar v1正式Production人工验收PASS，最终状态CLOSED / PASS；Space Rename真实Production功能及最终UI也为CLOSED / PASS。Avatar已验收功能发布Source SHA：fcd3c8ad1b91bd7ec137c331e3d721ea8fae6cac。12预设及猫F+02「陶粉与燕麦」保持冻结。该整体验收不扩大为跨设备、照片替换/默认恢复、真实失败/断网重试、退出最后共同Space的新签拒绝、5分钟签名续期及iOS/Android/PWA全部边界已通过；未完整验证项继续在观察期记录。 本轮最终治理记录收口，未新增版本。

2026-10-14 — UI v2 + Calendar视觉优化最终治理收口：PRODUCTION ACCEPTED / CLOSED（仅 UI 改造范围）。用户确认Chevron Production视觉及点击验收；记录11个Slice、Round1/2、功能中心优化、Calendar Patch及Chevron发布状态、919/919测试、180/180响应式检查与Build证据。旧版29项修改归档及原目录main日常工作区状态保持，详见DEVLOG / TESTING。

以下记录为最终Production收口前的历史检查点；旧Pending状态由上方最终验收条目接续。

2026-10-13 — Calendar UI Patch：LOCAL PASS / VISUAL ACCEPTED；随后已Push并成功部署，用户完成相应验收。源码验证证据为121/121、919/919、build及180/180响应式检查通过，日/月正文保持，详见DEVLOG。

2026-10-13 — 功能中心视觉优化最终审查与授权本地Git Closeout：LOCAL PASS / VISUAL ACCEPTED；36/36、918/918、build/diff-check和证据指纹PASS，详见DEVLOG。

2026-10-13 — Integration Round 2最终审查与授权本地Git Closeout：LOCAL PASS / VISUAL ACCEPTED；用户确认三表单视觉满意，64/64、918/918、build/diff-check及证据指纹PASS。11个Slice与Round1/2本地视觉阶段完成，计划视觉开发结束；整体集成/发布仍Pending，下一步等待另行授权环境对齐Gate。详见DEVLOG。

2026-10-13 — Integration Round 2共享表单本地实施完成：LOCAL TECHNICAL PASS / VISUAL ACCEPTANCE PENDING；无新Props/moduleView切换，原业务保持。918/918、build/diff-check、144/144及30/30浏览器布局通过，最新离线预览与375px截图已生成；等待用户验收，未Git closeout/发布。详见DEVLOG。

2026-10-13 — Integration Round 1最终审查与本地Git closeout：用户视觉确认，LOCAL PASS / VISUAL ACCEPTED；授权12文件，17/17、109/109、905/905及build/diff-check PASS，已有六视口72/72、短视口24/24与375px证据源码匹配。本地收口，不push/deploy/merge；Round 2未实施，真实业务/设备验收仍Pending，详见DEVLOG。

2026-10-13 — Slice11最终审查与本地Git Closeout：用户确认视觉，记录 LOCAL PASS / VISUAL ACCEPTED；授权9文件，直接12/12、相关91/91、全量895/895、build/diff-check、六真实视口102/102及短视口12/12通过。本地commit完成。原生dirty确认完整E2E、真实账号/双账号、Push、手机软键盘、PWA、Realtime及Production仍待最终集成验收；UI v2 11个Slice均完成本地阶段，但整体尚未集成验收、合并或发布。详见DEVLOG。

2026-10-12 — Slice10最终审查与本地Git closeout：用户确认视觉，LOCAL PASS / VISUAL ACCEPTED；相关376/376、全量883/883、build/diff-check及既有六宽度/短视口/键盘Focus证据通过，7文件本地commit完成。真账号/双账号/设备/PWA/Realtime/Production仍待最终集成验收，不进入Slice11。详见DEVLOG。

2026-10-12 — Slice10模块专属Emoji选择/清除/Escape交互补充，原输入与保存语义保持；376/376、883/883和build PASS。最新真实源码预览已生成；浏览器自动审批限流阻断，新增响应式与375px截图待验证。详见DEVLOG。

2026-10-12 — Slice10重要日UI本地完成：原列表与历史、模块专属Sheet、透明18px/44px +、完整字段与日期语义；371/371、878/878、build/diff-check、24状态×六视口144/144通过。最新React离线预览与真实375px截图完成，等待用户视觉验收。详见DEVLOG。

2026-10-12 — Slice9最终审查与本地Git Closeout：LOCAL PASS / VISUAL PROVISIONALLY ACCEPTED；最终全量872/872、清单59/59、build/diff-check及六真实CSS视口通过。一个本地commit，旧worktree状态及8661项指纹保持。最终字体栈/字重/行内排版复核Deferred；真实账号、设备、PWA与Production未验收。详见DEVLOG。

2026-10-12 — Slice9用户确认的管理收纳/直接行内编辑本地完成：清单与分组菜单、项目无常驻操作、局部dirty/IME/导航/远端目标消失保护；59/59、872/872、build/diff-check、六宽度120/120 PASS。最新真实组件离线预览与375px截图完成，等待视觉及交互验收。没有Git closeout或部署，详见DEVLOG。

2026-10-11 — UI v2 Slice9清单模块本地实施及验证：3组件/局部CSS/新增测试/2治理共7文件，原Space资格/提交/排序/导航/Realtime保持；43/43与全量856/856、build/diff-check、六宽度84/84通过，最新React预览与375px七类完整截图完成。LOCAL PASS / VISUAL ACCEPTANCE PENDING，停止等用户视觉验收；无commit/push/deploy。详见DEVLOG。

2026-10-11 — UI v2 Slice8 最终审查与本地 Git Closeout：用户确认视觉，记录LOCAL PASS / VISUAL PASS。11文件授权范围审查；Review相关47/47、全量850/850、build/diff-check及320/360/375/390/768/1024×15状态90/90通过。多人回顾仅只读审计并Deferred / Design Pending；未改业务模型/权限/其他模块。真实账号、双账号、设备/PWA/Production未验收。已授权本地Git closeout，不push/deploy，不自动进入Slice9。详见DEVLOG。

2026-10-11 — Slice8回顾 + 最小视觉修正与多人回顾只读审计：18px透明44×44按钮、原Focus/创建资格/回调保持；47/47及build/diff-check、五宽度20/20通过，最新 `/slice8-plus/index.html`。未来每轮选参与成员的Space容量/创建RPC/前端1/2假设、快照/草稿/权限/历史兼容已审计；详细建议与未决隐私记录BACKLOG Deferred / Design Pending。未实施多人、不收口Slice8，等待用户确认。

2026-10-11 — Slice8回顾模块本地实施/测试/离线预览：历史仅日期/真实轮次/实际状态，详情完整四字段只读与本人编辑，新建沿用上一份本人计划参考；个人无对方，双方面板持续挂载，保存草稿与独立标记保持。849/849、build/diff-check及320/375/390/768/1024共75项布局通过，入口 `/slice8/index.html`。视觉与真实环境尚未验收，未Git closeout。详见DEVLOG。

2026-10-11 — Slice7最终Git closeout：用户验收最新视觉，Slice7 = LOCAL PASS / VISUAL PASS；授权12文件以一个本地commit收口。全量841/841、npm run build、git diff --check PASS；旧worktree 28 modified + 1 untracked及29项指纹保持。真实账号、iOS/Android、installed PWA与Production未验收；未push/deploy。详见DEVLOG。

2026-10-11 — Slice7任务模块本地实现与验证：8文件范围，原业务/查询/权限/提醒/Realtime保持；页内已完成和模块专属固定Sheet顶栏、dirty确认及同步重复提交防护。409/409、build/diff-check、60/60布局与390×844最新源码截图完成，离线入口 `/slice7/index.html`。用户视觉与真实环境待验收，详见DEVLOG。

2026-10-11 — Slice6最终本地Git closeout：11个授权文件以一个本地commit收口；计数修复后完整相关测试317/317、build/diff-check PASS。用户离线视觉验收通过，Slice6 = LOCAL PASS / VISUAL PASS。未push/deploy；真实账号、设备、installed PWA与Production仍未验收。详见DEVLOG。

2026-10-11 — Slice6顶部概览视觉增量：四张白底浅边框等高居中卡片、简化重复文案、两行长名称与独立日期；数据/资格/刷新与下方左对齐入口保持。57/57相关测试、build/diff-check及四宽度七状态28/28检查PASS；最新正常/长名称离线截图已更新，等待用户视觉确认。详见DEVLOG。

2026-10-11 — Slice6续作本地完成：未完成任务精确计数、选中Space最近回顾记录日期、清单精确总数、canonical下一个重要日；读取前后资格核验、请求失效与60秒freshness。最新源码离线七状态四宽度28/28检查、相关测试314/314及build/diff-check PASS；11文件未提交。等待用户视觉验收，不宣称真实账号/设备/Production通过。详见DEVLOG。

2026-10-11 — Slice6实施前数据审计完成：Hub只有模块资格/错误，不含任务/清单统计；下一次回顾排期与生日分类无可靠现有语义。按用户STOP条件停止，仅记录治理文档。无Slice6代码、测试/build或离线视觉完成声明。

2026-10-11 — UI v2 Slice5月网格/日期浮层本地完成并获用户离线视觉验收：4–6周、真实两条短标题与+N、原六色Space小圆点；真实详情回调、外点/Escape/焦点恢复与月份/筛选/视图清理。261/261、build/diff-check、28组响应式及10项离线交互记录PASS；新390px四状态截图已生成。LOCAL PASS / VISUAL PASS，仅本地技术与离线视觉范围；真实账号/设备/PWA/Production未验收。本地commit获授权，未push/deploy，未进入其他Slice。详见DEVLOG。

2026-10-11 — UI v2 Slice4本地收口：用户阶段性接受六色圆点日/周，但反馈默认色不够鲜亮；记录VISUAL PROVISIONALLY ACCEPTED，不宣称配色完全满意。243/243、build、diff-check、40项窄屏检查PASS；准确六文件本地commit，未push/deploy。Space Color System列入Deferred；月视图为后续独立Slice。详见DEVLOG/BACKLOG。

2026-10-11 — Slice4六色Space识别修正：绿/蓝/橙/紫/玫红/青局部圆点palette、完整成员集合确定性消解；5-Space日周最新源码样本、40项窄屏检查、243/243、build/diff-check PASS。原五文件未提交；标题深色/副信息灰色/透明底，业务与月内容不改。最新视觉待用户最终确认。详见DEVLOG。

2026-10-10 — Slice4日历视觉收敛：用户确认Space小圆点着色、标题深色、副信息灰色、无大色块，并冻结为后续月视图视觉基线；日/周最新源码离线预览与36项窄屏检查、242/242、build/diff-check PASS。增量四文件，总Slice4仍五文件未提交；月内容与业务不变，最新实现待用户复核。详见DEVLOG。

2026-10-10 — UI v2 Slice4本地视觉实施：日/周/月分段顶部与独立Space筛选、原周期导航；日时间轴/周七天紧凑列表，空周日期一行。精确五文件，242/242、build/diff-check、四宽度72项检查PASS；月内容markup及计算样式与HEAD相同，旧worktree保持。用户视觉/真机/PWA/Production待验收，不提交发布、不进入Slice5。详见DEVLOG。

2026-10-10 — UI v2 Slice 3 最终收口：用户确认最终离线视觉「可以了，没那么突兀了」，记录 LOCAL PASS / VISUAL PASS。3/2/2、原查询/排序/资格及重要日真实创建链路通过完整相关测试177/177、build、diff-check与320/390px检查；精确七文件范围已创建本地 commit。旧 worktree 未变；真实账号、iOS/Android、installed PWA、Production 未验收；没有 push/deploy。正式版本仍v0.1.20，Slice 4未启动。

2026-10-10 — UI v2 Slice 3：只调整首页展示上限、移除旧首页展开，新增重要日 + 并复用 existing Sheet/default/资格/canonical 写入与重读；保留原 Event/Task 创建行为。仅七个首页组件、测试与治理文件；177/177、build/diff-check、两宽度18组新源码离线检查 PASS，旧 worktree 指纹保持。用户/真实业务/PWA/Production 验收待完成，未提交或发布。

2026-10-10 — UI v2 Slice 2 本地收口：用户确认离线视觉预览满意，Slice 2 = LOCAL PASS / VISUAL PASS。四栏 Shell 与首页 C 实现；143/143 回归、build/diff-check、36 组响应式/状态检查及 16 组其他页面 CSS 隔离对照 PASS，旧 worktree 指纹保持。真机、installed PWA 与 Production 尚未验收；下一步为另行授权的 Slice 3，详见 DEVLOG。

2026-10-10 — Slice 1 最终复审 LOCAL PASS：预检分支/HEAD/精确五文件符合；tokens 单一来源、基础类/依赖/业务保持，相关测试 18/18、build 与 diff-check 重验 PASS。仅获本地 commit 授权，无 push/deploy；真机/PWA 与后续页面验收边界不变。

2026-10-10 — UI v2 Slice 1：新增 ui CSS variables → Tailwind semantic mappings 与 [实施规格](./UI_V2_IMPLEMENTATION_SPEC.md)，保留旧页面默认样式/基础类/导航安全区。只改授权的五个文件；相关测试 18/18、build/diff-check、299 条既有 CSS 规则一致、8 个排版角色/26 组配色和四类页面 320px 离线对照 PASS；真实设备/新 UI 人工验收未执行。后续页面 Slice 未启动。

2026-10-09 — 用户确认 Product Direction Freeze，记录产品定位、六步顺序、全应用 UI 覆盖与既有行为保护；商业化非产品完成条件，外部日历/备份加密/原生 App 等仅候选。只更新治理文档并创建本地 docs commit，不 push/deploy。

2026-10-08 — 已授权最终 docs closeout commit `c316b60c14694c0c2c831fd65d7130b4839d03aa` 正常 push；独立 git ls-remote 精确匹配，最终 Git 0/0、clean。此次 docs-only push 触发 GitHub Production deployment `6937387220` / Vercel `5Lk9zsDDw4TyKZ6dYPnR3y1zAUbF`，success 且 source SHA 精确匹配。以下“本轮本地收口/未同步”和原 Next Action 是当时历史事实，由本记录与新阶段冻结接续；本次方向文档的同步不由上述 push 证明。

2026-10-08 — v0.1.20 最终治理收口：用户确认 iPhone installed PWA 13/13 人工检查 PASS，版本 CLOSED / PASS；正常 Git push、匹配实施 SHA 的 Vercel Production 成功记录与正式域名新资产已验证。只更新治理文档；保留未单独人工检查的多指取消/busy 边界和既有延期事项，无确认新缺陷。下一阶段 Market Validation / Commercialization Study，先研究，不预设商业化结论或原生 App 路线。

以下 v0.1.20 本地实现与发布前记录为历史检查点，由上述收口接续。

2026-10-08 — v0.1.20 focused READ-ONLY review PASS，无明确 BLOCKER；用户随后仅授权本地 feat commit，未授权 push/deploy。版本仍待发布对齐及真实 iPhone PWA 人工验收，不是 CLOSED / PASS。

2026-10-08 — v0.1.20 两个冻结 Scope 本地完成：日历右前/左后按 Today/Week/Month 原周期计算；Tasks/completed/Review history/Lists overview/Important Dates 调用既有返回入口。局部 touch-only Pointer Events、ref recognition、纵向/多指/cancel 清理、display-card opt-in、stable click guard、Portal/Sheet/Dialog/busy/drag 排除；不扩展详情/Sheet 关闭或全局导航。新增35项测试在全量788/788中通过；既有bundle警告保留。构建目标与已验收v0.1.19 Production一致，backend/contracts无变化，未重跑live Production postflight；发布后环境/资产对齐与真机验收待独立授权。详见 [规格](./v0.1.20_MOBILE_GESTURE_NAVIGATION_SPEC.md) 与 TESTING。

以下 v0.1.19 及更早记录为历史检查点。

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

- v0.1.21 — Engineering Stability & Data Safety；整体IN PROGRESS，Slice 2 CLOSED / PASS（Production真实验收通过、Review维护解除）；Slice 1 DEFERRED，Slice 3 RELEASE AUTHORIZED / FINAL ACCEPTANCE PENDING，Slices 4–5 NOT STARTED。
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

2026-10-28 — 发布前四项源码/测试SHA256锁定并核对保持；重新Build与保留产物逐字节一致，TypeScript/语法/diff检查及官方生产依赖audit0通过。沿用Node1013/1013、Browser96/96，无新真实账号测试或后端能力变化。

2026-10-28 — Slice 3相关Node96/96、全量1013/1013、双引擎Browser96/96、tsc/build及语法/diff-check PASS；无真实登录态自动验收或Production业务操作。环境Gate基于公开Build目标与已验收后台契约保持一致；详见TESTING首节。

2026-10-28 — Follow-up 最终发布与自动化证据见 Current status / TESTING；本次只做 docs 差异、非治理树、治理门禁及 Push 后只读核验，不把旧真机未执行项转为 PASS。

2026-10-17 — Slice2本地：Node996/996、直接21/21、DB升级/全新432项及12个观察锁等待顺序、本地PostgREST8/8、WebKit/Chrome新增14/14及既有Review10/10、TypeScript/Build/语法/diff-check通过；额外Review删除回归双路径通过。无Production/真实设备验收或部署，外部证据/private/tmp/calendar-v0121-slice2-implementation/。

2026-10-16 — 用户明确确认整轮六项及补充六项正式installed iPhone PWA全部PASS；业务代码b021a41的最终Node990/990、Browser105/105、TS/Build/语法/diff-check及Production Source/7项资源逐字节一致证据沿用，无代码变更。收口前main/HEAD/origin-main/远端main一致、clean，最新Production仍为b021a41且静态资源与已验收业务发布一致。本次只验证docs-only/diff/治理门禁，不重跑业务测试；Governance Push/自动部署实绩见独立收口报告。

2026-10-16 — 全量Node990/990（无失败/跳过）、现有原并行Browser81/81（UI26/筛选26/删除18/Space手势11）PASS；上次Chrome Calendar原生tap超时本轮未复现，未改timeout或删除断言。TypeScript/Production Build、脚本语法、diff-check通过，生产依赖audit0；旧大chunk提示保持。真实四模块375/430标题20px600/筛选y76/空文字60px/折叠44px与12px节奏、Review两Sheet底距0，最终截图和测量通过；首页16px600的10场景原证据与最终源码/CSS一致。提交前Production公开目标/anon客户端/VAPID与新Build一致，无后台能力变化；发布后Source和正式资产由独立报告核验，不驱动真实Session。

## Next Action

Production部署与资源核验通过后，由用户轻量确认日历打开、日期/月切换及刷新无异常；无实际日程，不要求非空数据或手动故障验收。等待用户最终确认后再决定Slice 3收口，不自动进入Slice 4或5。

## Blockers

暂无明确阻塞。

## Important Context

- v0.1.21仅Slice 2并发保护及用户确认场景已CLOSED / PASS，整体未完成。回顾边缘返回/完成入口独立 Follow-up 已按实际验收范围关闭，创建默认空间待产品讨论，对方状态短延迟暂观察；不在收口中扩大手势或Realtime范围。

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

Slice 3 LOCAL VERIFIED / RELEASE AUTHORIZED / FINAL ACCEPTANCE PENDING：用户报告本地基本操作正常，明确授权10文件Commit/正常Push及既有Vercel Production；仅已验证REST/Realtime解耦，代码/测试指纹保持。Node1013/1013、Browser96/96、TypeScript/Build证据有效，实际Git/部署Source/公开资源见`/private/tmp/calendar-v0121-slice3-release-20261028/RELEASE_RECEIPT.md`。不提前CLOSED/PASS；用户无实际日程，最终仅轻量确认页面打开、日期/月切换、刷新无异常，故障场景以自动化覆盖。Codex不操作真实登录态/Production业务数据或后端配置；Slice 2/Follow-up关闭、Slice 1暂缓、Slices 4–5未开始保持。

下方旧handoff仅作历史记录。

v0.1.21 只完成 Slice 2 本地实施和隔离验证，等待用户与 ChatGPT 审核，不自动发布或进入 Slice 3。使用现有 content_revision；保存/标记新签名必填 expected，旧签名中文拒绝；冲突保留草稿，只有明确确认才重新载入。Production仍v0.1.20 CLOSED / PASS，Slice1继续DEFERRED/POTENTIAL/NOT VERIFIED。测试及维护窗口/回退说明见TESTING首节，外部日志/private/tmp/calendar-v0121-slice2-implementation/。下方旧交接为历史。

v0.1.20 = CLOSED / PASS。用户已明确确认全域UI/UX整轮六项及创建表单Space补充六项真实Production iPhone PWA全部PASS；本地自动/本地iPhone Safari/Production部署与资源核验均PASS，最近业务代码b021a41d4d02543e565a121ba6a8cdb17c988361。最后代码验证Node990/990、WebKit/Chrome105/105、TS/Build/语法/diff-check有效；本轮只治理文档收口，Git/治理部署证据 `/private/tmp/calendar-v020-closeout/`。无剩余阻塞项，不要求重验已PASS功能、不修改业务/后台/配置、不新版本。独立工程稳定性审查尚未启动，等待用户另行指示后只读开始；旧日历来源文案与bundle提示仅非阻塞遗留。下方旧交接为历史，不作为当前动作。

用户确认Profile Card Compact + Avatar v1正式Production人工验收PASS，最终状态CLOSED / PASS；Space Rename真实Production功能及最终UI也为CLOSED / PASS。Avatar已验收功能发布Source SHA：fcd3c8ad1b91bd7ec137c331e3d721ea8fae6cac。12预设及猫F+02「陶粉与燕麦」保持冻结。该整体验收不扩大为跨设备、照片替换/默认恢复、真实失败/断网重试、退出最后共同Space的新签拒绝、5分钟签名续期及iOS/Android/PWA全部边界已通过；未完整验证项继续在观察期记录。

暂停常规功能开发，进入约两周真实使用观察（2026-10-14起，约至2026-10-28）；记录实际使用问题与未完整覆盖的边界，再决定是否需要后续修正。未来独立待办：整理测试数据，三个测试账号保留两个；保留账号选择与清理需另行确认，本轮不执行，也不是当前阻塞项。不创建新版本或启动新功能。

以下旧Slice/Round handoff仅为历史，不作为当前开发或待验收任务。

UI v2 Integration Round 2 = LOCAL PASS / VISUAL ACCEPTED。用户明确确认日程、任务、重要日三个共享表单视觉满意，最终范围/业务复审通过；本轮直接相关64/64、全量918/918、build/diff-check PASS，既有六真实CSS视口144/144、短视口30/30及13张375px截图源码指纹匹配。三个共享表单视觉整合完成；按本轮最终确认，11个Slice及Round1/2均完成本地视觉验收，计划中的UI v2视觉开发阶段结束。仅授权12文件本地Git收口，未push/deploy/merge。UI v2整体集成验收、合并和发布仍Pending，Production保持v0.1.20。环境对齐Gate、真实账号/双账号E2E、原生dirty confirm、真机软键盘/IME/Safe Area、iOS/Android PWA、Push/Realtime及Production验收均Pending；P2字重审美、Space Color System、多人Shared Space/回顾与跨Space投影等Deferred不自动实施。 当前唯一下一步是等待用户另行授权环境对齐Gate，不自动推进。旧worktree保持28 modified +1 untracked及8661项项目文件/符号链接；以下旧轮/Slice条目仅为历史。

Slice11 My/Space UI已按用户批准方案完成本地实施与授权Git closeout，LOCAL PASS / VISUAL ACCEPTED；直接12/12、相关91/91、全量895/895、build/diff-check和响应式验证通过。原生dirty确认接受/拒绝完整E2E、真实账号/双账号、Push、手机软键盘、PWA、Realtime和Production仍待最终集成验收。UI v2 11个Slice均完成本地阶段，整体尚未完成集成验收、合并或发布；下一步先执行前后端环境对齐gate。旧worktree28 modified + 1 untracked及8661项指纹保持；正式v0.1.20不变。

Slice10本地完成，LOCAL PASS / VISUAL ACCEPTANCE PENDING，等待用户视觉验收。worktree `/Users/wp/Projects/跨系统共享日历-ui-v2`，design/ui-v2，HEAD `ea820fb75ecd8a0c99a098c8e4f508b3eacc7b1c`保持；6 modified + 1 untracked/index空，7文件范围：2重要日组件、局部CSS、既有UI测试历史文案、新增important-dates-ui-v2、DEVLOG/PROJECT_STATE。真实groupImportantDates排序、日期引擎/年度Day1/周年/闰日、Space/提醒/权限/刷新/右滑与原提交handlers保持；历史仅一次性past，显示“已过X天”，默认折叠并保留有效导航恢复。模块Sheet固定关闭/标题/唯一保存，默认模式保持首页/日历；无新增独立详情或虚构字段。相关371/371、全量878/878、build/diff-check、320/360/375/390/768/1024×24状态144/144 PASS，最新 `http://127.0.0.1:5176/slice10/index.html` 提供375px完整JPEG与证据，fixture不代表真实账号/设备/Production。旧worktree28 modified + 1 untracked、8661指纹一致；正式v0.1.20不变，无commit/push/deploy，不进入Slice11。全局字体复核Deferred继续保持。以下Slice9及更早状态为历史。

Slice9最终Closeout：LOCAL PASS / VISUAL PROVISIONALLY ACCEPTED。用户接受布局与交互，对当前字体美观及字重搭配保留“先这样吧”；最终全局视觉一致性检查Deferred复核中文字体栈、字重层级及行内操作排版。12文件本地commit已按授权创建；清单59/59、全量872/872、build/diff-check及320/360/375/390/768/1024真实CSS视口PASS。375px三个操作同排52×44；320px删除操作换行、无溢出且44px热区保留。旧worktree28 modified + 1 untracked及8661项指纹一致。真实账号/设备/PWA/Realtime/Production未验收；未push/deploy，不进入Slice10，正式v0.1.20保持。

历史记录：Slice9管理菜单、原位编辑及保护行为的实现细节与前轮120项布局结果见此前DEVLOG记录；本次最终验证为全量872/872及六个CSS视口复测。

Slice8最终状态：LOCAL PASS / VISUAL PASS。用户确认历史列表、详情、填写、草稿/已填写状态及透明18px灰绿44×44 +。worktree `/Users/wp/Projects/跨系统共享日历-ui-v2`，design/ui-v2；本地 closeout 11文件。Review相关47/47、全量850/850、build/diff-check及真实CSS 320/360/375/390/768/1024 ×15状态90/90 PASS；390×844、真实375×844及390完整离线截图已提供，预览 `/slice8-plus/index.html`。新前端和真实组件预览，不是账号/设备/Production验收。业务字段、双人权限和保存/填写语义保持；多人需求仅只读审计，BACKLOG Deferred / Design Pending，Space上限与现行前端/RPC固定1/2人为主要先决限制，未来隐私/资格未决定。正式版本v0.1.20；真实账号、双账号、iOS/Android、installed PWA与Production未验收。用户已授权本地 Git closeout，本轮完成后等待用户另行启动Slice9；不push/deploy。旧worktree28 modified + 1 untracked和既定业务指纹保持；不清理既有共享.git快照元数据。以下Slice7/6/5条目为历史记录。

Slice7任务模块、视觉修正及本地Git closeout已完成，LOCAL PASS / VISUAL PASS。授权12文件（10 modified + 2 untracked）已提交一个本地commit：TasksArea/TaskSheet/styles，App日历选择箭头、ListsOverviewPage/ImportantDateSheet冗余选择器SVG，4个测试与2份治理。App后三模块的本轮修改严格为下拉展示；原查询/导航/业务/权限保持，Home三个+与TaskSheet本轮前源码不改。全局15处native select声明与一个日历按钮选择器共用16px轻chevron、右16px/文本预留48px；不影响日期/折叠/导航箭头，native popup仍系统负责。任务+改为透明44×44/18px首页规格。全量841/841、build/diff-check、84/84响应式与9项本地交互通过。5176 `/slice7/index.html` 提供最新真实组件task15状态、跨模块6状态与390px新截图，fixture/SSR不代表真实接口验收。旧worktree28 modified + 1 untracked及29指纹保持。正式v0.1.20与Space Color System Deferred保持。用户视觉验收已通过，本地closeout完成；不push/deploy、不进入Slice8。真实账号/iOS/Android/PWA/Production仍待验收。以下为既有Slice6/5历史记录。

Slice6已按用户方案A完成本地实现及最终closeout：隔离worktree design/ui-v2，起点HEAD 2c9a03032077dec9add6007e0c1a51b7078b7ec2；最终11个授权文件以一个本地commit收口。四真实指标使用受控只读查询与canonical日期规则，回顾维持选中Space边界；资格前后核验、晚响应屏蔽、返回重读及60秒可见页freshness。候选计数最小修复后完整相关回归317/317、build/diff-check通过；离线视觉已由用户验收，Slice6 = LOCAL PASS / VISUAL PASS。静态fixture只用于视觉，不代表真实业务验收。真实账号、iOS/Android、installed PWA与Production仍待验收，认证前按AGENTS gate。上次STOP审计历史完整保留于DEVLOG，旧worktree28modified+1untracked/29指纹不变。正式v0.1.20与Version Index保持、Space Color System Deferred。未push/deploy；此处为Slice6收口时的历史状态，Slice7当前进度见上文。

UI v2隔离worktree `/Users/wp/Projects/跨系统共享日历-ui-v2`，design/ui-v2，Slice5起点dc97fae3ebfb486b241796c4a8b54277d7b78ce9。本轮七文件（App/styles/三日历及手势测试/DEVLOG/PROJECT_STATE）随 Slice5 收口创建本地commit。Slice5月视图已本地完成：4–6周两条标题/+N、六色圆点、轻日期浮层及真实详情入口，日期包括邻月一击打开，外点/Escape/焦点/周期/筛选/视图清理。261/261、build/diff-check、四宽度28组与10项离线交互记录PASS；最新源码manifest匹配，390px四截图与预览 `/slice5/index.html` 在独立离线5176服务。准确状态 LOCAL PASS / VISUAL PASS（仅本地技术与离线视觉验收）；真实账号/真机/PWA/Production未验收，认证前按AGENTS gate。既有42天查询/日期引擎/权限/创建保存/后端未改，旧worktree28modified+1untracked/29指纹不变。日/周/home保持，Space Color System Deferred，不自定义颜色，不进入下一Slice；按用户授权完成一个本地commit，未push/deploy。视觉验收已通过；正式v0.1.20与Version Index保持。
