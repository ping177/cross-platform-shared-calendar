# Account Deletion — 用户自主注销账号设计冻结

Status: `FINAL_EXECUTION_READY_FOR_REVIEW`（2026-11-06，仅隔离本地服务端闭环，待审查）。已可信受理的合成job经Storage/业务/Auth hard delete及真实Cron恢复、严格完成/短期回执验证；正式UI未实施、Production安全性 `NOT VERIFIED`，功能不标CLOSED。正式版本保持v0.1.21。

Author: Ping Weng。记录日期：2026-11-05。正式项目版本仍为 `v0.1.21`；本规格不分配下一版本号，不新增 Version Index 里程碑。

## 1. Baseline and authority

原设计冻结轮次文档基线为 `4b1032e1924ee64d6f7f5faa24f36ec7af831161`，前一治理提交 `f631f7b`。开始时 main 与本地 origin/main 相同、ahead/behind 0/0、工作区 clean；这不是一次新的远端或 Production 核验。前轮调查为 `READ_ONLY_COMPLETE`，本轮不重做全项目调查。

数据导出按已验收范围 `CLOSED / ACCEPTED`；历史 Review 真实多账号反向权限验证仍 `NOT VERIFIED`。参见 [TESTING](./TESTING.md)。既有关闭结论与旧稳定性 Slice 1 DEFERRED 保持。

规则来源：[AGENTS](../AGENTS.md)、[DECISIONS 的 v0.1.13 生命周期合同](./DECISIONS.md#v0113-slice-1--closed--pass)、[Shared Life Architecture](./SHARED_LIFE_ARCHITECTURE.md)、[v0.1.14 Review](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md)、[v0.1.15 Lists](./v0.1.15_SHARED_LISTS_SPEC.md)。本规格只为永久账号注销增加必要能力；不重设计 Space 权限或业务归属。后续 Event collaboration 等已生效规则仍有效，不回退旧历史权限。

原设计冻结轮次仅写规格及治理；本轮用户已另行授权Slice 1必要canonical SQL、独立forward patch、专项测试与记录。仍不操作Production、真实账号/Storage，不改UI、不实现Auth Admin/Edge/Cron，不Commit/Push/Deploy。两个闲置账号继续保留，不用于开发试删。

### Final Execution & Offline Recovery checkpoint — 2026-11-06

用户已接受Trusted Acceptance & Personal Cleanup阶段，另行授权隔离本地最终Storage/Auth执行、最小离线恢复和回执。本轮开始HEAD/main/本地origin/main仍4b1032e、0/0，33个既有未提交文件先记录SHA256并保留。原审计、屏障、trusted patch及其算法不重写；新增独立execution patch和canonical追加块。

现已实现每job一个90秒随机租约/代次、每次唤醒一阶段、Storage第一页≤100对象API清理/复查、复用受限Personal事务、Auth Admin hard delete及独立不存在确认、最终DB/API后置核验、有限退避与needs_attention。真实pg_cron→pg_net→Edge在进程崩溃及用户离线后接续；唤醒凭据在Vault，排队请求头权限也经本地平台owner收紧并验证。回执在最终接受前发放，仅摘要/7天期限，已删除Session也可只读status。

升级50＋fresh3＝53真实服务断言、真实catalog/ACL检查、822 SQL/28双会话/2隔离、121 Node、cached Deno及Build通过；关键失败/丢响应、Edge SIGKILL/真实租约到期、双Cron竞争、共享整行与历史Review权限保留有本地证据。精确合同见[覆盖报告§9](./ACCOUNT_DELETION_BARRIER_COVERAGE.md#9-final-execution--offline-recovery--2026-11-06)，命令及真实/模拟区分见TESTING。

仅本轮隔离栈新建合成Auth账号实际hard delete；Production/真实账号与两个闲置账号完全未操作。默认关闭且拒绝非本地后端的Edge保留，没有正式UI或线上调度/部署资源，无Commit/Push/Deploy。§5–8中的完整本地子集以此checkpoint为准，Production/真实设备与UI仍有独立门禁；下方旧NOT IMPLEMENTED/Personal/Auth未实现是历史记录。

### Trusted Acceptance & Personal Cleanup checkpoint — 2026-11-06

用户已接受Storage本地设计Gate，并另行授权本轮隔离本地可信OTP受理及Personal专用清理。开始main/本地origin/main均4b1032e、0/0，25个未提交路径先记录SHA256并保留；未fetch、不接Production。新增独立trusted forward patch及canonical末尾对应块；原审计/barrier patch和专项SQL不重写。

已实现一个默认关闭且仅允许本地HTTP后端的专用Edge草案、真实Auth邮箱验证、同UUID/原session/意图绑定的一次性确认许可、原子接受与账号屏障，以及NOLOGIN受限业务清理函数。正向清理授权来自实际SMTP OTP链，不以SQL fixture伪造成功。准确权限/锁/测试边界集中在[覆盖报告§8](./ACCOUNT_DELETION_BARRIER_COVERAGE.md#8-trusted-acceptance--personal-cleanup--2026-11-06)，命令与分层证据见TESTING最新节。

受理提交是不可逆起点；当前只能在合成账号隔离栈调用。没有正式UI、部署配置/资源或Production入口。业务清理完成后仍保留processing/storage与business_cleaned_at，Auth用户和Storage阶段未完成，completed转入仍被拒绝；本轮不具备关闭客户端后自动完成全链的执行器，绝不能对真实用户开放。

下方各checkpoint为历史；§5–8是完整目标及当前已验证子集，未列入本checkpoint的恢复/回执/完成能力不能当作已实现。

### Storage Drain & Recovery Gate checkpoint — 2026-11-06

按用户本轮明确边界，Storage完成语义分为应用可验证的对象清理/发布屏障与平台内部字节生命周期；不再把无法证明的通用上传硬上界作为唯一收口路径，也不声称立即物理零字节。官方失败上传自动清理说明、版本差异、29项真实故障断言和needs_attention降级见[覆盖报告§7](./ACCOUNT_DELETION_BARRIER_COVERAGE.md#7-storage-drain--recovery-gate--2026-11-06)。建议CROSS_SERVICE_GATE_PASS_FOR_LOCAL_DESIGN；完整功能/Production仍未实施验证。

本轮仅新增一个复用隔离栈的Storage专项，原24个未提交路径在文档更新前逐字保留。标准/signed上传完整字节后metadata拒绝、DELETE超时/崩溃重试、成功丢确认均验证；硬崩溃无metadata残留不能由公开API清理，已验证持久needs_attention且不得完成。17项头像Node、语法/diff通过，无业务SQL/代码变更、无Build/无关全套重跑、无Auth删除/Production/Git动作。

### Cross-Service Integration Gate checkpoint — 2026-11-06

本轮授权仅本地跨服务验证。原业务SQL/Edge与此前测试均保持；新增隔离harness在真实Auth/PostgREST/Storage/两个Edge Runtime入口完成112项HTTP/后置条件，相关Node113/113及Build通过。Auth是合成邮箱自动确认的真实密码Session，不是邮箱OTP重验；外部Push为替身。精确结果、权限审查和未验证项见[覆盖报告§6](./ACCOUNT_DELETION_BARRIER_COVERAGE.md#6-cross-service-integration-gate--2026-11-06)。

关键反例：Storage API空列表和DELETE成功时仍可存在在途部分blob；正常迟到metadata被guard拒绝且本地平台清理成功，不能外推崩溃/清理失败后的可靠排空。Storage硬上界/故障恢复未证实，completed与Auth删除仍不能开放；整体PARTIAL，不是CROSS_SERVICE_GATE_PASS。原§5–7技术候选仍须据此验证，不能用任意sleep/只反复list来满足完成判定。

private受理包装/OTP证明和受限执行角色尚未实施；无Personal专用删除、Auth Admin删除、Cron、Production或Git发布。正式v0.1.21保持，等待审查，不进入Slice 3。下方为前轮历史检查点。

### Slice 2 local checkpoint — 2026-11-05

用户后续另行授权Slice 2内部状态及权限屏障；开始核对保留11个既有未提交路径。Slice 1审计patch/专项SQL/Tasks schema测试逐字不变，canonical原Slice 1前缀SHA256保持；只追加新的独立Slice 2块，测试harness增量支持`--barrier`。没有覆盖或重复实现审计迁移。

已实现private状态、仅内部可用的prepare/accept/status合同、15表restrictive RLS/写guard、9项definer/eligibility显式补充、头像Storage SQL策略/写guard、提醒候选批量预过滤与发送前复核。受理只更新私有job、不取得Space/Push业务行锁，正常写用共享账号门闩，非READ COMMITTED读写失败关闭，未改变全局隔离或既有Space锁顺序。精确入口清单、锁边界和未验证部分集中见[Slice 2覆盖报告](./ACCOUNT_DELETION_BARRIER_COVERAGE.md)。

private状态表/函数没有授予PUBLIC、anon、authenticated或service_role访问/执行权；测试库owner模拟未来可信受理，**不是OTP验证结果**。没有公开受理包装、删除函数、OTP/真实JWT证明、完成器或自动恢复执行器。completed只是预留终态，本轮禁止转入，不伪造成功。

最终本地fresh/upgrade各59屏障+338关联断言，共794 SQL PASS；各14个双会话场景、非默认隔离失败关闭、113相关Node、两个既有Edge入口cached-only Deno类型、TypeScript/Build、语法/diff检查PASS。public/private/Storage SQL夹具schema+ACL parity，安装屏障前后业务测试行不变。真实Auth/PostgREST/Storage API角色与在途blob/签名URL尚未核验；旧头像signed URL不因状态立即撤销。整体PARTIAL，不能称SLICE_2_READY_FOR_REVIEW或完整访问撤销。

下一步先用户/ChatGPT审查本轮SQL及覆盖边界，再单独授权隔离真实服务集成和OTP受理证明；Personal专用删除仍不能因已有内部job表就提前开放。Production/真实账号/Edge部署/Cron/Commit/Push/Deploy均未发生，正式v0.1.21保持。

### Slice 1 local checkpoint — 2026-11-05

开始时六份未提交设计/治理文件的状态、内容及SHA256与前轮报告相符，HEAD仍4b1032e；先记录指纹，实施前复核六份文件仍逐字未变，再在原内容上增补本轮记录。没有覆盖回HEAD或丢弃前轮成果。

本地canonical及单份forward patch仅将四类created_by改为原值/非空/不可改的审计UUID快照。迁移检查public中全部九条Auth/Profile FK；预期移除四条，保留Profile→Auth、成员→Auth、成员→Profile、Event owner→Auth、Push→Auth五条。未知FK/动作漂移或重放拒绝；不改变RLS、ACL、触发器、RPC或数据值。现有查询使用普通UUID字段，成员资料嵌套依赖space_members→profiles（保留），未发现依赖四条创建者FK的当前客户端嵌套查询；Review仍由成员+participant授权。已注销身份文字/标记尚未实现，不由缺失Profile推断。

**安全边界与依赖修正：**Personal专用例外需要可信accepted记录及受理授权；当前二者未实现。不能用可伪造参数/GUC或测试fixture代替真实授权，因此本轮不创建状态表、NOLOGIN执行角色、清理函数或任何Personal删除例外。现有guard逐字保持，空/非空Personal只能验证“删除仍拒绝、数据完整”，专用删除正向场景NOT IMPLEMENTED / NOT VERIFIED，不标完整Slice 1 READY。

实施顺序为：Slice 1审计子集 → Slice 2中受理授权/屏障最小闭环经审查验证 → 回补Slice 1受限Personal删除子任务 → 后续完整执行/恢复。Slice 2不再依赖尚未具备授权的Personal删除；Slice 3仍依赖二者完成。这只是技术依赖澄清，不自动授权本轮进入Slice 2，也不放宽产品安全规则。

证据：baseline两项语义RED（审计FK仍存在、Profile级联误删Task）；最终fresh/upgrade各44专项+294关联回归，共676 SQL断言PASS；迁移前后15表测试数据指纹保持，仅四FK的DDL差异，fresh/upgrade public schema+ACL一致；48相关Node测试、TypeScript/Build、语法及diff检查PASS。真实Auth/Session/Storage/并发屏障及Production仍未验证，详情见TESTING本轮节。

## 2. Frozen product contract

1. 用户可从「我的 → 账户管理 → 注销账号」自主发起，无需联系管理员。注销永久、不可撤销，必须提示后果并最终确认。
2. 删除本人的 Personal Space 及全部私人业务数据。普通 Space 管理仍禁止删除/退出 Personal Space；只有安全专用注销路径可执行。
3. Shared Space 严格复用 v0.1.13–v0.1.15 生命周期：普通成员注销不删除共同内容；Owner 必须先转给现有成员或独立明确确认删除对应空间。处理全部 Owner 身份，不只当前选中空间。不得留下无 Owner 空间或误删他人数据。
4. Shared 中沿用成员退出的 personal Event 删除规则，按当前 `scope + owner_user_id` 判断，不按创建者判断。Shared Tasks 保留，离开者指派置空；Lists/Sections/Items、Important Dates 继续属于 Space。
5. 保留 Shared 历史 Review 双方正文、固定 participant UUID、轮次和 revision。读取继续要求「当前成员且原参与者」，仅可修改本人的 entry。新成员、新 Owner 不能获得未参加历史轮次的权限。
6. 允许保留必要原 UUID 历史标记，但 Auth 与 Profile 必须真正删除；历史 UUID 不得靠 FK 强制保留 Auth/Profile。界面中需要展示该历史身份时显示「已注销用户」，不展示原邮箱、昵称或头像。保留 UUID 不宣称完全匿名化，不改记为新 Owner。
7. 删除本人全部 Push 订阅、本人作为接收者的提醒历史，以及被删除个人日程对应的提醒历史。其他成员的共享提醒历史保留，不按创建者清空账本；不改变现有去重身份和发送语义。
8. 注销前提醒备份并提供现有导出入口；允许跳过。导出失败不是永久阻止注销的条件；不改已验收导出实现。
9. 每次注销前重新验证邮箱，优先复用现有 Email OTP。服务端必须核对验证结果与原待注销账号为同一个 UUID；前端布尔值不是删除许可。不规范化 Gmail 点号、不自动合并账号。
10. 最终确认且服务端持久接受后，即使关闭 PWA、断网、不再登录，也必须独立自动推进至完成或明确异常终态；不能依赖客户端存活、下次打开或再次提供用户 JWT。
11. 区分未接受、已接受处理中、完成、需要异常处理。只在严格完成判定通过后显示注销成功；超时/丢响应不等于失败未执行，也不等于成功。
12. 清楚区分当前业务数据、Auth 身份、Storage 文件与平台备份/日志。不得承诺所有备份、已下载文件、缓存副本或已发送通知立即物理消失。

## 3. User journey and irreversible boundary

流程：账户管理 → 永久注销说明 → 现有导出入口或跳过 → 处理全部 Shared Owner 身份 → 向当前 Auth 邮箱发送并验证 OTP → 最终风险确认 → 服务端接受 → 处理状态/终态。

- Owner 处理优先导航到既有 Space 管理能力，复用 transfer/delete RPC 的当前角色、现有成员、独立空间删除确认与数据范围文案；不做批量静默转让，不在后台替用户选择继任者或删除空间。转让后原 Owner 可仍为普通成员，由注销事务执行退出语义。
- Owner 预处理具有自身已确认的效果：已成功的转让/空间删除，不因用户随后放弃账号注销而回滚。单人成员空间没有可转让目标，必须先明确删除该空间，或由用户先安排成员加入再转让。
- 预检与最终确认页列出个人数据会删除、共享内容/双方历史 Review会保留、原 UUID 可能保留、其他成员影响及备份/日志边界。不能声称所有 Shared 数据均被删除或账号清理可恢复。
- 最终确认绑定本次 OTP 许可和稳定请求 ID。服务端接受时重新检查角色等前提；出现新的 Owner 身份则拒绝接受、返回处理空间，不偷偷修改计划。
- **不可逆起点为接受事务成功提交**：此后注销授权已持久化、普通业务能力被封锁，自动执行器可开始删除。之前可返回/放弃；之后无“取消注销”或自动恢复正常账号路径。
- 网络未知时显示「正在确认是否已受理」，复查同一请求；只有服务器明确拒绝才显示“尚未接受”。接受后的页面离开仅关闭页面，不能暗示取消。已受理不冒称已完成，也不承诺固定完成秒数。
- 当前设备在接受后进入仅注销状态界面，停止业务读取/写入/自动 bootstrap，撤销内存导出文件、Object URL、业务快照和头像显示；完成后本地退出、清用户导航状态、尽力取消当前 Push 与关闭通知。清理失败不恢复业务访问、不将服务端删除回退。

## 4. Data deletion and retention map

以下是前轮已核对的仓库合同与本次目标；实际线上对象仍须独立 catalog 门禁。仓库当前 public 业务表共 15 张，没有单独持久化的“reminders”任务表，提醒设置在业务来源表中。

| 对象 | 调查基线关键依赖/风险（四类审计FK已在本地迁移，线上未改） | 注销目标 |
|---|---|---|
| auth.users / profiles | Profile 随 Auth CASCADE；Profile 有自更新/同空间读取规则 | Auth hard delete、Profile 不存在；托管 sessions/identities 等依赖另核验 |
| spaces | created_by → Auth NO ACTION；创建者不可改；Personal 删除保护 | 删除 Personal；保留未明确删除的 Shared；创建者改为保留原 UUID 的审计快照建模 |
| space_members | 同时引用 Auth/Profile CASCADE；Personal 成员保护；Shared 最终 Owner 校验 | 移除本人全部成员关系；仍需保持个人保护与共享 Owner invariant |
| space_modules | space_id CASCADE | 随被删空间清除；其他空间配置不动 |
| events | space_id CASCADE；created_by 与 owner_user_id → Auth NO ACTION；系列/父段 RESTRICT | 删本人 Personal Space 全部事件和 Shared 中本人当前 personal 事件；Shared 共同事件及其他人的 personal 事件保留 |
| event_occurrence_exceptions | event_id CASCADE | 随目标系列/分段删除；保留系列的例外不动 |
| tasks | created_by → Profile CASCADE；指派复合 FK随成员删除只置空 assigned_to_user_id | 个人空间内删除；Shared Task 保留、本人指派置空；创建者快照不再引用 Profile |
| lists / list_sections / list_items | Space/List/Section 级联；created_by 已为无用户 FK UUID 快照 | 个人空间内删除；Shared 内容与排序/关联保留 |
| important_dates | space_id CASCADE；created_by 已为 UUID 快照 | 个人空间内删除；Shared 内容保留 |
| review_rounds / review_entries | round.created_by → Auth NO ACTION；participant 是无用户 FK快照；Space/round CASCADE | 个人轮及 entries 删除；Shared 双方正文/身份/权限保持；round 创建者为无用户 FK快照 |
| push_subscriptions | user_id → Auth CASCADE；注册/停用走 RPC | 本人全部设备订阅清除，受理后禁注册/发送；不等到客户端退出才处理 |
| reminder_deliveries | recipient/subscription/source 刻意无 FK，普通退群保留账本 | 删除 recipient=本人或 event_id属于被删个人事件/逻辑根的记录；其余共享账本保留 |
| Storage | 私有 profile-avatars；当前引用和遗留文件不随 Profile 清理 | 通过 Storage API 删除本人命名空间的当前及遗留头像；跨桶归属清单核验，未知对象停止扩删 |

### 4.1 Historical creator snapshots

用户已允许必要原 UUID 快照，故技术首选是把 `spaces.created_by`、`events.created_by`、`tasks.created_by`、`review_rounds.created_by` 的 Auth/Profile FK 正式迁移为与 Lists 相同的 UUID 审计快照；保留原值、非空约束、现有身份不可改触发器及必要索引，不新增匿名 Auth 用户，不改写历史创建者。

这是一份待评审的永久数据建模迁移，不是临时关约束：只替换不适用于历史快照的四类用户 FK，特别消除 Task→Profile 的破坏性级联；Space 归属、成员 Auth/Profile FK、任务指派、事件 owner、系列与子表 FK 均保持保护。正常新建仍须通过当前本人/成员校验；受控重复系列派生保留原创建者的既有行为不误伤。

注销者在历史空间中已无成员关系也可能仍有这些创建者快照，因此依赖核验不能只从当前 spaces 列表发现引用。不存在的/正在注销的账号不得凭旧 JWT 经新建 RPC重新生成 Space/Profile或业务数据。

### 4.2 Review and visible deleted identity

- 不删除、不补建、不替换 Shared review_entries；不改 user_id、正文、round_no、日期、revision。保留用户自己在共享空间写过的正文是本次明确规则，不属于应随 Personal Space 删除的私人空间数据。
- 保留 can_read_review_round 的当前成员 + own participant 双条件，previous-plan 仍只返回有权的本人内容；Owner 不获得额外历史权限。不存在用邮箱重绑旧 UUID的逻辑。
- 删除 Profile 后，**不能仅凭“查不到 Profile”就判断已注销**：普通退群后也可能因 RLS看不到该 Profile。用已核实 Auth 删除的最小注销标记区分，展示统一文字和默认图标，不回填旧邮箱/昵称/头像。
- 优先只补实际展示历史参与者的 Review 读取路径：窄的删除身份标记读取必须先验证该轮当前成员+原参与者，仅返回该可见轮的相关 UUID/状态。不向客户端开放全局注销表、任意 UUID探测或扩大旧轮 RLS。其他模块不显示作者时不新增作者 UI。
- 用户提交的共享正文原文保留，系统不能扫描/改写其中用户主动写入的姓名或邮箱；“不展示原身份资料”指系统身份字段和解析，不构成清洗共享正文的授权。

### 4.3 Reminder ledger cleanup

数据库清理前在同一事务中确定被删个人事件集合及逻辑系列根，再清除 `recipient_user_id=目标用户` **或** `event_id` 命中该个人删除集合/逻辑根的账本。处理分段和历史受众变化，不能先删来源再丢失 ledger定位信息。个人 Space Tasks/Important Dates 的来源清理同时按已确定私有来源 ID覆盖残留，不按 created_by 扩到共享来源。

其他成员对保留 Shared 来源的账本继续存在，唯一去重键、claimed/sent/failed语义、时间窗、候选排序及发送预算不变；不把留存 claimed/failed记录改成可重试队列。已明确删除整个 Shared Space 仍复用旧空间删除的账本保留合同，另仅应用本人的接收记录/个人来源清理要求；不额外泛化全空间历史清空。

受理后所有 claim / pre-send / test-push 必须排除正在注销的接收者；受理前已经进入外部 Push 网络的请求不能撤回。清理与并发 claim/ledger写入要串行化，最终 postflight 不允许本人账本重生。

## 5. Minimal server design (local execution verified; Production pending)

### 5.1 Components and records

首选一个专用 `account-deletion` Edge Function，明确区分用户动作和内部恢复动作；复用现有 Supabase SDK、Email OTP、Storage API、Auth Admin及 pg_cron/pg_net调度方式。逻辑与 HTTP边界拆开便于测试；不把清理塞进提醒发送循环。本地受理/Personal合同见覆盖报告§8，后续已授权的Storage/Auth/租约恢复及回执实现见§9；Production仍为待独立核验/授权，不能据本地文件推断线上已部署。

一张不暴露于 Data API 的 `private.account_deletions` 表即可承载短期准备与持久工作状态，目标 UUID无 Auth/Profile FK以跨越身份删除。每用户至多一个有效请求，保留稳定 request_id；准备阶段可以过期重开，受理后不换目标、不重置进度。

最小字段分组：user_id/request_id；准备许可摘要、过期时间与绑定 session_id；accepted_at、phase/status；attempts/next_attempt_at；lease_until及递增generation；安全错误码；各阶段确认时间、completed_at；状态回执摘要及期限。无邮箱、姓名、头像、业务正文、OTP、JWT或Storage签名URL。完成后清除许可和租约等临时字段；回执摘要在完成后保留短期查询宽限（建议七天，待验证后固定），过期由同一维护执行器清除。长期仅保留UUID/request_id/完成标记及必要时间以支持已注销身份识别；不是永久业务镜像或通用任务库。

### 5.2 OTP and acceptance

1. 用户端请求只携带当前JWT与本次request_id，不允许提交待删 user_id、邮箱、角色或自选清理清单。Edge 调用 getUser 验证本人，邮箱取该Auth用户的实际已确认邮箱。
2. 用现有Email OTP能力发送，`shouldCreateUser:false`；验证码长度与当前已部署合同对齐。本次许可建议有效五分钟，独立于全局OTP有效期，不改变现有登录配置。服务端限制发送和验证频率/尝试次数，具体阈值在本地验证冻结。
3. Edge使用不持久化Session的独立用户Auth client验证OTP；返回UUID必须等于原调用者。不能把admin client中的service JWT替换成用户JWT。首选验证后立即仅退出这份临时验证会话，保留原调用会话；具体SDK local scope行为须本地验证，不依赖未来保存其Token来清理，也不能误用global退出所有会话。
4. 验证后将一次性、短期、随机许可摘要写入准备记录，绑定request/user/原调用session；前端获得本次确认凭据。request_id和只读状态回执在最终提交之前交付，故即使接受响应丢失且Auth随后已删，仍能查询同一意图。`reauthenticate()` 的密码nonce不是现成注销授权，JWT新iat/last_sign_in_at不是本次OTP证明。
5. 最终接受使用窄的 `accept_my_account_deletion(request_id, confirmation_token)` 语义：调用者来自auth.uid与有效session，核对服务端许可、期限和绑定，重新确认不存在本人Owner身份，再原子消费许可、持久化accepted状态并启用屏障。可以由Edge使用用户scope client调用；客户端即使直调同一RPC也不能改变目标、跳过OTP或清理数据。
6. 只有接受事务提交后返回已受理（建议HTTP202）。提交前退出/验证码失败/校验失败不产生自动删除任务；HTTP超时仍须按原request_id重查。所有临时许可撤销/过期不影响已经受理的持久授权。

### 5.3 Account barrier and concurrency

受理提交后一直到最终身份删除，旧JWT只能使用受限状态接口，不能普通读写或重新bootstrap。完成后active判定也必须要求Auth真实用户存在，不能仅检查“没有processing记录”。

拟采用**每用户事务级共享/排他门闩**：正常写入及相关接收者/成员目标取得共享门闩，再在锁后重验账号状态；接受仅取得本人排他门闩，等待已有相关写事务结束后，以独立语句重新读Owner状态并提交受理。此接受事务不执行Storage/业务删除、不等待Space/业务行锁，避免持账号排他锁再等待已持业务行锁的写者形成环。

新旧正常写路径都必须参加这套边界，包括 direct CRUD触发器和SECURITY DEFINER RPC，不能只改一个UI或is_space_member。写事务若在获得共享门闩前已持行锁，接受过程不得反向等待该行；锁后查询必须看到受理提交后的状态，不能用旧快照的STABLE判定蒙混通过。锁顺序和实际隔离级别必须双会话验证，不能仅凭本段宣称串行正确。

受理后的后台清理依赖持久屏障，不跨外部API持有账号排他锁；内部业务清理沿用既有Space advisory→Space行锁→业务行的顺序，多Space稳定排序。外部新写会快速检查deleting并失败，内部清理用受限专用身份进入；不得以“跳过所有触发器”实现。

必须覆盖：Profile、create/ensure/join/transfer/member/module RPC、Event直接写/例外/系列派生、Tasks、Lists/Sections/Items、Important Dates、Review、Storage上传/读取/删除本人路径、Push注册和claim/pre-send/测试发送。其他用户转让Owner或分配personal Event/Task给注销者也要检查目标；普通其他成员的共享编辑保持既有权限。

### 5.4 Personal Space dedicated cleanup

首选一个专用NOLOGIN数据库执行角色，仅作为内部清理SECURITY DEFINER函数的owner，授予必要的表/内部helper能力；不授予authenticated/service_role切换该角色的成员资格。后台只能执行“处理已受理job”的窄函数。

该角色不获得全库BYPASSRLS、TRUNCATE或业务表所有权。表ACL不自动等于RLS通过：需要在专项迁移中用仅对该执行角色、精确已受理job范围生效的清理策略或已审查内部helper提供必要访问，并证明原客户端策略不被放宽。其具体权限矩阵已在本轮Personal子任务验证（覆盖报告§8）；不能因权限报错改为禁RLS或全库管理员执行。该角色是函数执行身份，不向Edge提供数据库owner凭据。

guard_personal_space_delete仅增加受限注销分支：必须同时验证专用执行身份、已锁定的accepted job与有效generation/phase，以及old.kind=personal且old.created_by精确等于job目标。否则继续抛原保护错误。job目标由数据库记录推导，函数不接受任意Personal space_id或user_id。

复用delete_lifecycle_event_set的闭合引用验证和叶子优先删除；先删事件链再删除Personal Space，由现有Space FK清子表和成员。验证成员保护在父空间删除级联中的可见性；如果需调整，也只允许同一受限目标上下文。普通leave/delete RPC、直接DELETE、伪造GUC/job ID、嵌套definer调用均不能进入例外。执行角色与嵌套函数current_user语义须本地证明；仅设置自定义session variable不构成授权。

### 5.5 Stage order and transaction boundaries

| 阶段 | 工作与持久推进条件 | 失败/重入 |
|---|---|---|
| Accept transaction | OTP许可、同UUID、无Owner；写accepted及屏障 | 原子提交；未提交绝不进worker |
| Storage cleanup | API分批删除本人头像所有页，包含当前与遗留；确认对象归属、处理在途上传 | 每批幂等；失败保留本阶段；清理不套用旧24小时头像维护阈值 |
| Business transaction | 锁job和目标Space；重查无Owner；先删指定ledger，再删personal事件/退出Shared、轮换邀请码、清指派、删Personal及Profile/订阅；留Shared正文/审计UUID | 整笔commit才推进；异常整笔回滚，不分散前端串行删除 |
| Auth delete | 在上述提交后调用admin.deleteUser(固定job目标,false)；读取确认Auth不存在 | API成功响应或明确not-found后核实；网络错误不是不存在证据；可安全重试同目标 |
| Final verification | 再查Storage与业务/接收账本无残留、Auth/Profile/成员不存在、保护后置条件正确 | 未全部通过不completed；残留仅在已授权范围内补清，未知归属needs_attention |
| Completion transaction | CAS核对generation与阶段，写completed、清临时许可并设置回执查询宽限 | Auth已删后仍能凭回执查完成；旧worker不能覆盖新阶段 |

不能把Storage HTTP、业务RPC、Auth Admin包装成跨服务原子事务。本方案接受明确的已受理隔离状态：即使Profile/个人数据已删、Auth暂未成功，也不恢复正常账号，只自动前向完成。普通登录即使仍由Auth成功，也只能进入状态页，禁止ensure_personal_space重建。

清理Profile前必须已完成4.1的正式审计快照迁移；不能先试删Profile观察是否级联。处理Shared成员时复用既有规则/内部helper，不把全部旧生命周期RPC授予service_role，不通过伪造auth.uid代演用户。

Storage只通过API删除文件，不执行storage.objects SQL DELETE。分页不能在边删边增加offset时漏项，可反复读取第一页清批，最终复查；路径以数据库job UUID精确构造并核对bucket/owner_id等实际元数据，不接受客户端路径。未知跨桶资源先停下查明归属，不能直接批量删该用户拥有的一切潜在共享对象。

Storage策略/元数据写保护必须拦住旧JWT和迟到的特权metadata发布。**连续空列表本身不能证明物理排空**；不得靠任意sleep宣布安全。按本轮用户明确范围，以发布屏障、API删除及后置复核确认应用对象清理；正常失败上传的隐藏字节由平台生命周期处理，不承诺即时物理消失。已知残留/清理失败或无法覆盖的发布路由必须停在needs_attention，不能完成。精确可验证条件与供应商边界见覆盖报告§7；旧§6.4硬时限候选不作为必需方案。

## 6. Automatic recovery and least privilege

新增一条账号注销专用pg_cron调度，复用当前Cron→pg_net→Edge的技术方式，建议每分钟唤醒；**不复用/修改send-reminders业务任务本身**，不增加通用队列、消息代理或常驻进程。当前已有仅隔离环境的真实调度/Vault合成凭据验证（覆盖报告§9）；不创建Production调度、Edge部署或secret。

内部唤醒使用专用高熵凭据，按既有受控secret/Vault方式配置，只在可信服务端可读；不能把anon key、任意Authorization字符串或CORS当worker授权。用户JWT路径不能进入worker模式，内部凭据路径不能执行“接受某用户注销”。未核验实际调度/凭据能力之前，此架构不是Production可用结论。

单函数的网关verify_jwt配置须与内部唤醒方式匹配；若采用verify_jwt=false以接收专用worker凭据，则每个用户动作仍须在函数内getUser验证真实JWT，worker分支独立严格验证专用凭据，不能出现仅凭action字段进入的未认证分支。测试必须直接调用两种分支验证交叉凭据和空凭据均不能越权。

worker HTTP body不含待删user_id、space_id或清理路径；由数据库窄claim函数用 `FOR UPDATE SKIP LOCKED` 等机制领取到期、已受理、非completed的固定job，得到短租约及generation。窄cleanup/advance/complete函数只接受job身份与有效lease，内部推导目标并重查accepted_at；准备记录不参与claim。

首轮候选预算：每次一个job、Storage每批不超过100对象、有界Edge执行时间与比该时间更长的租约；预算、租约和超时取值通过本地代表容量验证后固定，不当作平台已保证值。一次不够则记录进度/next_attempt_at，下一tick继续。业务事务保持原子，若实际数据量超时先停止评审，不偷偷改成可能破坏共享关联的逐条删除。

- 成功阶段单调推进；重复到达同阶段必须先确认后置条件，不能重复消费新的确认或扩大范围。
- HTTP/crash/超时后租约自动到期，下一tick重领；数据库状态推进使用generation fencing防旧worker覆盖。外部API可能重复调用，不能把租约当exactly-once保证；删除对象/同UUID Auth删除须按幂等结果处理。
- 临时网络、限流和服务5xx使用有上限间隔的退避，可持续自动重试，不能因达到固定尝试次数就永久放弃。错误码脱敏记录、避免日志含个人资料。
- 未知FK/新Owner/外部事件引用/未知Storage归属等安全不变量失败，进入 `needs_attention`，停止有风险扩删、保留访问屏障；这不是成功。受控修复后只能恢复原已受理job，不允许改目标或开启任意账号删除。普通用户不必联系管理员发起注销；异常修复是运营责任。
- 调度停止、凭据失效、长时间无进展必须在现有Dashboard/运行日志中可发现并有发布后运营检查，不将“永不被观察的挂起”包装为自动可靠。不承诺平台持续故障时仍能在固定期限完成。
- 接受事务落盘即可由Cron独立推进，不能依赖响应返回、浏览器fetch、waitUntil、用户再次登录或保存的用户refresh token。

Edge持有的Auth Admin服务凭据本身仍具广泛平台能力；job约束缩小的是本功能对外暴露与正常执行面，不宣称能限制已泄露service key。仅服务端持有、不打印、不通过任意目标接口转发，不赋予客户端表级管理权限。

## 7. Status and strict completion

| 用户可见状态 | 服务端证据 | 可显示/允许 |
|---|---|---|
| 未接受 | 准备、未最终确认或服务端明确拒绝；超时未知不能归入本状态 | 返回、处理Owner、重新验证、再次确认 |
| 已接受，正在处理 | accepted事务已提交；worker阶段/自动重试中 | 仅本人最小状态与说明，不允许取消或普通业务 |
| 需要异常处理 | 已受理job遇安全阻塞且记录needs_attention | 明确尚未完成；保持隔离，运营受控修复，不显示成功 |
| 已完成 | 全部严格后置条件确认并commit completed | 注销成功、清本机Session；不恢复旧身份 |

断网/身份已删除时，可用随机高熵回执查询单一job的最小状态；数据库仅存摘要，接口不返回user_id/邮箱/空间/原因细节。回执仅能读状态，不能接受、恢复删除或改变目标；不放URL/query/log。回执过期/遗失不影响Cron。Auth不存在不能用邮件重新注册来“续跑”旧job；同邮箱新注册为新UUID。

`completed`必须同时满足：Auth hard delete已独立确认；Profile和本人所有成员关系不存在；Personal Space及其全部业务子记录、Shared内目标personal事件/例外不存在；本人Push订阅与4.3指定账本不存在；本人头像当前/遗留可枚举对象经Storage API确认清完、所有受控在途发布已被屏障阻止且无已知未解决清理异常（供应商内部字节生命周期不等于应用已证明零字节，见覆盖报告§7）；无未处理Owner；未授权扩删/未知依赖为零。保存必要Shared内容、Review正文/participant、其他成员共享提醒历史是正确完成的一部分，不能用全库搜不到目标UUID作为通过条件。

测试需要证明其他成员保留记录的ID、内容、revision、指派合法变化、系列/清单关联、提醒去重与历史可见范围正确；不能只有删除表行数为零。生产运行的每次完成采用受限postflight与事务不变量，不长期复制其他成员全量数据作对照。

平台备份、Auth平台审计/日志与保留政策不在业务事务控制范围；实际依赖/策略需门禁核对并准确披露，不能通过删系统审计掩盖操作。旧已签发JWT、短期头像签名URL、其他设备离线显示和已送达Push各有边界：服务器拒绝后续业务访问，已下载导出/已缓存显示/已发送通知不能远程收回。

## 8. Implementation slices

当前审计/受理/屏障/Personal及Slice 3服务端最终执行与离线恢复已获本地证据；本轮FINAL_EXECUTION_READY_FOR_REVIEW。Slice 4正式UI/历史身份显示与Production门禁仍未实施/通过，不整体关闭账号注销。下方为完整目标和历史拆分，实际边界以最新checkpoint为准。

每个Slice需独立实施授权、评审、实际验证记录；以下文件/对象为预计，不是本轮变更。涉及多个写入口时拆成小批SQL变更、每批尽量不超过约5个实现/测试文件，治理记录按需同步；整个注销入口在屏障覆盖完成前不得开放。

### Slice 1 — Local data contract and protected personal cleanup

- 目标：在隔离本地库证明历史UUID快照、共享Tasks保留、Personal专用路径及普通保护可以同时成立；不对用户开放注销。
- 文件/对象：supabase/schema.sql、一份日期命名forward patch、supabase/tests/account-deletion-data.test.sql、supabase/tests/account_deletion_local.py；四类created_by FK迁移、最小private job结构/测试用已受理上下文、NOLOGIN执行角色及受限清理helper。
- 依赖：审计子集已获本地实施授权；Personal子任务须先有经验证的受理授权最小闭环，不用fixture伪造可用授权。本轮停在审计迁移与普通保护验证边界。
- 测试：fresh/upgrade parity、正常路径仍拒绝Personal删除、伪造上下文/角色/未受理job拒绝、共享Tasks及完整Review保留、事件闭合删除和失败全回滚。
- 验收：不能经Profile级联丢Shared Task；Shared正文不改；受限清理只作用于已绑定目标，既有Space FK/Owner约束仍有效。Production：不触及。

### Slice 2 — Durable acceptance and account access barrier

- 目标：本地闭合准备/OTP许可记录→最终接受→持久屏障；所有普通写与相关目标身份检查参加边界。
- 文件/对象：schema、独立forward patch、专项SQL/双会话测试；再按模块分小批补现有RPC/直接CRUD/Storage及推送guards。private记录许可/accept/状态函数、受理门闩、active判定。
- 依赖：Slice 1审计子集；先验证可信受理授权与屏障，再回补Slice 1的Personal子任务。未接入真实Edge验证的许可用合成fixture测试，不宣称邮箱身份链已验证，更不能因此开放Personal例外。
- 测试：两个设备重复接受、许可过期/伪造/不同UUID、Owner并发变更、旧JWT重建Space/Profile/头像、各模块写入和incoming指派/转让、ledger与claim竞态、锁顺序/死锁。
- 验收：受理提交是唯一不可逆起点；已受理者不能普通访问或生成新数据，其他成员原有权限不扩大；所有入口清单有实际覆盖证据。Production：不触及。

### Slice 3 — Server execution and offline recovery

- 目标：完整本地Auth/Storage栈中的合成账号，经真实OTP→受理→用户离线→Cron自动完成/异常终态。
- 文件/对象：supabase/functions/account-deletion/index.ts、logic.ts、deno.json（如既有方式需要）、专用Node/集成测试；分小批补schema/forward patch中的claim/lease/advance及本地调度说明。不增npm生产依赖。
- 依赖：Slices 1–2；可用的隔离完整本地栈。简化auth.users stub只证明SQL，不证明Auth Admin/session/blob能力。
- 测试：Storage分页/在途上传/部分失败、Auth失败/not-found/丢响应、各阶段crash与租约过期、重叠worker、伪造内部唤醒/未受理目标、关闭客户端仍完成、退避与needs_attention。
- 验收：没有客户端token依赖；固定job目标且幂等；只有严格postflight写completed；正常请求自动推进、异常保留隔离与可诊断路径。Production：不触及，不创建线上调度/secret/资源。

### Slice 4 — Account flow and deleted identity presentation

- 目标：接入既有账户页面与导出导航，OTP/最终确认/处理状态及Review「已注销用户」展示。
- 文件/对象：AccountManagementPage.tsx、新AccountDeletionPage.tsx、src/lib/account-deletion.ts、相关Node/browser测试；单独小批接App bootstrap隔离、Review已授权身份标记读取/渲染及其测试。不改导出业务，不重排已验收账户UI。
- 依赖：Slices 1–3。本地server/合成夹具完成后才测试客户端；历史身份窄RPC与UI一起评审。
- 测试：跳过/导出失败可继续、所有Owner提示、OTP错误与同UUID、最终确认重复/未知响应、回执、接受后关PWA/重开、退出清理；当前参与者/新Owner/后来成员的旧轮反向权限及无Profile不误标注销。
- 验收：四类状态准确、无过早成功、旧界面不重建数据、身份不泄露旧资料；真实设备/认证验收留给用户。Production：不触及。

### Gate — Independent Production safety review (NOT PASSED)

Slices 1–4本地通过也不授予迁移/发布权限。正式申请之前必须：

1. 只读核对当前前端实际后端目标、真实catalog全部相关FK/触发器/RLS/grants/definer owner/默认ACL、额外public及托管Auth依赖、Auth服务行为、Storage bucket/owner字段/在途语义、现有cron/pg_net/secret能力；不输出cron.command或secret值。
2. 全部合成账号数据链、真实本地Auth/Storage/Session、双会话、离线自动恢复、提醒去重及其他成员数据完整性通过；历史Review权限须专项反向证明，不拿旧导出验收补PASS。真实设备/OTP由用户执行，在支持的隔离/合成账号环境中完成，不能拿两个闲置或其他现有真实账户试删。
3. 安全评审确认快照FK迁移、受限执行角色/上下文、worker权限、屏障全覆盖及旧前端兼容性；定义请求接受开关、异常监测、forward corrective方案。停止新接受不取消已接受job；不能停worker留用户永久半注销；不能回滚到会重新生成个人数据的旧前端。
4. 只有Gate证据齐全才申请单独Production迁移、Edge/调度部署及Git授权。按实际兼容性选择项目AGENTS的发布顺序，不自动套用Slice 2旧版本例外；backend postflight与合成账号验收通过前不开放正式用户入口。

## 9. Verification, open technical risks and delivery state

现有目录/风格：React/TypeScript在src/components与src/lib，Node/browser在tests，SQL与隔离Python harness在supabase/tests，schema/forward patches分开。沿用两空格、单引号、显式错误处理与p_ SQL参数，例如现有 `if (error) throw error;`。不新建通用repository、权限框架、队列或本地持久化业务目录。

设计冻结轮次仅执行docs-only检查；后续Slice 1/2已获本地实施授权，实际执行隔离SQL/相关Node/并发/类型/Build，准确命令与证据分层见TESTING最新节，不把规划或模拟认证记成真实服务PASS。浏览器仍固定 `http://127.0.0.1:5175`，`strictPort:true`；本轮未启动真实账号浏览器验收。

快照迁移/derived写、SQL权限/默认隔离边界和本轮双会话顺序已有本地证据，详见覆盖报告。仍待技术验证：Production Auth/PostgREST/Storage角色与隔离及配置、线上发布屏障/平台生命周期与异常处理（本地Storage设计/故障证据见最新checkpoint，不要求通用硬超时证明）；已本地验证的OTP/NOLOGIN/Storage/Auth/租约/回执在托管环境的适配；Production队列/Vault/角色/网关与调度健康、容量/事故运维；旧PWA缓存/bootstrap兼容。任一关键项失败必须修改技术方案后再评审，不能降低已冻结产品规则来过关。

本次用户已解决前轮三项产品分歧；不再把Review正文、历史UUID、提醒历史列为待用户重新决定。新发现业务冲突才单独提出，不擅自扩删。当前Slice 1/2本地检查点见§1及覆盖报告：均保留明确未完成边界，等待ChatGPT与用户审查，不标完整功能IMPLEMENTED、CLOSED或Production READY。
