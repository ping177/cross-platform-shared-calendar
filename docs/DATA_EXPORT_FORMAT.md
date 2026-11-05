# 用户数据导出：格式合同与分阶段实现

格式说明作者：Ping Weng。状态：CLOSED / ACCEPTED（用户已验收的个人/共享导出、中文CSV/Numbers及最终UI范围）；验收Source feb729c8608b30f6d714e8a7d037fed39ff83a16。历史回顾参与者RLS真实多账号反向验证仍NOT VERIFIED，详见TESTING最新节。项目正式版本v0.1.21、文件format_version=2不变。

## 已确认规则与范围

- 当前登录用户通过 Supabase RLS 读取有权访问的 Space；Space 是归属边界，created_by 是审计字段。
- 支持个人／共享、一个／多个／全部 Space；默认只勾选个人 Space，共享主动选择，提供全选。
- 模块关闭但仍存在且获准读取的数据仍纳入导出。
- 接受非事务快照，记录数据准备时间范围；检测缺页、计数变化、身份或关联异常时失败，不交付部分 ZIP。
- Slice 1原范围为文件合同/合成ZIP/保存验证；Slice 2–4逐步接入读取器与账户入口，实际阶段覆盖见下节。没有RLS／Schema／Auth变更或Production操作。
- 不支持重新导入、数据恢复、在线备份、后台任务、服务端导出、Storage 上传或账号注销。

## 文件结构

`shared-calendar-export_<UTC时间>.zip`，文件名时间中的冒号与小数点替换为 `-`。

```text
README.txt
manifest.json
spaces/space_<安全名称>__<完整Space-ID>/
  空间信息.csv
  空间成员.csv
  功能设置.csv
  日程.csv
  重复日程调整.csv
  任务.csv
  清单.csv
  清单分组.csv
  清单事项.csv
  重要日.csv
  回顾记录.csv
  回顾内容.csv
```

当前authorized-spaces范围每个Space的12个CSV必须齐全，包括仅表头的空表。阶段性personal-calendar/core-spaces范围见下节，未纳入的表不生成CSV。相同名称由完整 UUID 区分。名称 NFC 规范化，路径分隔符、Windows 非法字符、控制与双向控制字符替换，点串替换，去除末尾空格，最多 40 个 Unicode 码点。固定 `space_` 前缀避免 Windows 设备名；ID 必须是小写标准 UUID。不会使用原名称拼接任意路径。

## 格式 2：中文文件和列映射（当前本地方案）

文件协议修订为`format_version=2`，与正式项目版本v0.1.21无关。CSV文件名、表头及列顺序发生有意变更；原12类字段/类型/可空性与全部原始值不变。旧格式1的解析器需要按manifest的新映射读取；已下载的旧ZIP不改变，不生成第二套重复CSV。

`file_names`用原始类别键映射中文文件名；`fields[类别]`按实际CSV列顺序给出`name`（原始字段）、`label`（中文表头）、`type`、`nullable`；`files`逐Space记录`table/path/rows`。原始字段白名单及查询排序保持，序列化单独使用下表顺序。

### 空间信息.csv（space）

| 原始字段 | 中文列名 |
| --- | --- |
| name | 空间名称 |
| kind | 空间类型 |
| created_at | 创建时间 |
| id | 空间ID |
| created_by | 创建者ID |

### 空间成员.csv（members）

| 原始字段 | 中文列名 |
| --- | --- |
| role | 成员角色 |
| joined_at | 加入时间 |
| user_id | 成员ID |
| space_id | 空间ID |

### 功能设置.csv（modules）

| 原始字段 | 中文列名 |
| --- | --- |
| module_key | 功能标识 |
| enabled | 是否启用 |
| space_id | 空间ID |

### 日程.csv（events）

| 原始字段 | 中文列名 |
| --- | --- |
| title | 日程标题 |
| description | 日程说明 |
| starts_at | 开始时间 |
| ends_at | 结束时间 |
| all_day | 是否全天 |
| time_zone | 时区 |
| scope | 可见范围 |
| reminder_kind | 提醒方式 |
| recurrence_rule | 重复规则 |
| recurrence_until | 重复截止时间（不含） |
| created_at | 创建时间 |
| updated_at | 修改时间 |
| id | 日程ID |
| space_id | 空间ID |
| created_by | 创建者ID |
| owner_user_id | 个人日程所属成员ID |
| series_id | 重复系列ID |
| parent_event_id | 上一日程段ID |
| reminder_schedule_changed_at | 提醒计划变更时间 |

### 重复日程调整.csv（event_occurrence_exceptions）

| 原始字段 | 中文列名 |
| --- | --- |
| occurrence_date | 原定发生日期 |
| exception_type | 调整类型 |
| override_data | 调整内容 |
| created_at | 创建时间 |
| updated_at | 修改时间 |
| id | 调整记录ID |
| event_id | 日程ID |

### 任务.csv（tasks）

| 原始字段 | 中文列名 |
| --- | --- |
| title | 任务标题 |
| status | 任务状态 |
| due_on | 截止日期 |
| reminder_kind | 提醒方式 |
| time_zone | 时区 |
| created_at | 创建时间 |
| updated_at | 修改时间 |
| id | 任务ID |
| space_id | 空间ID |
| assigned_to_user_id | 指派成员ID |
| created_by | 创建者ID |
| reminder_schedule_changed_at | 提醒计划变更时间 |

### 清单.csv（lists）

| 原始字段 | 中文列名 |
| --- | --- |
| name | 清单名称 |
| created_at | 创建时间 |
| updated_at | 修改时间 |
| id | 清单ID |
| space_id | 空间ID |
| created_by | 创建者ID |

### 清单分组.csv（list_sections）

| 原始字段 | 中文列名 |
| --- | --- |
| name | 分组名称 |
| sort_order | 排列顺序 |
| created_at | 创建时间 |
| updated_at | 修改时间 |
| id | 分组ID |
| list_id | 清单ID |
| created_by | 创建者ID |

### 清单事项.csv（list_items）

| 原始字段 | 中文列名 |
| --- | --- |
| content | 事项内容 |
| completed | 是否完成 |
| sort_order | 排列顺序 |
| created_at | 创建时间 |
| updated_at | 修改时间 |
| id | 事项ID |
| list_id | 清单ID |
| section_id | 分组ID |
| space_id | 空间ID |
| created_by | 创建者ID |

### 重要日.csv（important_dates）

| 原始字段 | 中文列名 |
| --- | --- |
| name | 重要日名称 |
| emoji | 表情符号 |
| repeat_kind | 重复方式 |
| month | 月份 |
| day | 日期（日） |
| year | 年份 |
| reminder_kind | 提醒方式 |
| time_zone | 时区 |
| created_at | 创建时间 |
| updated_at | 修改时间 |
| id | 重要日ID |
| space_id | 空间ID |
| created_by | 创建者ID |
| reminder_schedule_changed_at | 提醒计划变更时间 |

### 回顾记录.csv（review_rounds）

| 原始字段 | 中文列名 |
| --- | --- |
| review_date | 回顾日期 |
| round_no | 回顾轮次 |
| created_at | 创建时间 |
| id | 回顾记录ID |
| space_id | 空间ID |
| created_by | 创建者ID |

### 回顾内容.csv（review_entries）

| 原始字段 | 中文列名 |
| --- | --- |
| focus | 近期专注事项 |
| progress | 近期进展 |
| problems | 面临问题 |
| next_plan | 下一步计划 |
| updated_at | 修改时间 |
| review_id | 回顾记录ID |
| user_id | 参与者ID |
| content_revision | 内容版本号 |
| filled_revision | 已确认填写版本号 |

共12类、102个字段映射；每表原字段集合/数量一致，中文表头无重复。UTF-8 BOM、CRLF、引号、NULL/空串与text:/json:/int:/date:/time:安全可逆编码保持；不改枚举/布尔/ID值，不改RLS或读取范围。容量仍按实际中文CSV字节累计，8MiB读取/16MiB组装保护不变。

## 保存界面（本轮本地）

生成后显示“数据已准备好”、空间数量与ZIP文件大小，主体不展示完整技术文件名。“更新导出文件”为次级按钮，重新读取当前所选Space最新授权业务数据并生成新ZIP，原结果先失效；再次保存/分享已有文件复用同一个File，只复核访问资格，不重新读取业务表。

正常状态仅有主保存操作“保存或分享文件”，不显示可展开备用菜单。只有当前ZIP文件的系统分享能力不可用（缺API/canShare不支持或检测异常），或该文件的系统分享发生实际技术失败时，才显示次级“直接下载 ZIP”。不支持系统分享时，主操作也能进入浏览器下载路径。主动取消不新增技术失败标记；失败保留文件供主操作重试及备用下载，后续分享成功可收起备用。新生成、改选、账号/权限失效等清理时同时清除旧文件失败标记。

每次保存先异步重验访问资格，再由用户点击“继续保存或分享”/“确认下载文件”提供新的用户手势（有效10秒），超时重新选择。取消分享/失败保留内存文件重试；改选、账号/权限失效、导航离开清除文件/确认凭证/下载URL。仅报告系统接收请求或浏览器下载请求，不显示“尚未保存”或“已保存成功”。不持久化文件，不改业务读取/权限/CSV格式。

## 原始字段白名单（读取合同与格式1历史）

当前CSV中文列顺序以格式2映射表为准。下方原始字段顺序保留查询白名单语义，旧阶段/格式1记录为历史，不再代表格式2文件名或表头。


### Slice 4：完整授权范围（当前实现）

收口Review及必要复验通过；等待后续Push/Deploy授权，本轮仅本地检查点。UI失败提示与ZIP README已明确容量保护与超限失败。Production公开目标匹配当前Build；匿名零行API已接受5表GET/HEAD、2处JSON ::text和例外空in；另外7表受ACL拒绝。bigint/JSON实值、受限表、非空分页、真实RLS及iPhone仍须登录态/真机验证，详见TESTING最新节；不是完整Production合同PASS。以下为实施时历史记录。

2026-11-04 LOCAL VERIFIED / READY FOR REVIEW，未提交/发布；Slice 3本地检查点为6f458ec208fe7ea3fd8559169cd37881c199ca77。format_version仍为1，字段白名单与编码完全不变。正常入口使用export_scope=authorized-spaces，12类table_coverage均为exported，每Space12个CSV（空表也有表头），N个Space共12N+2文件。complete_backup=false表示非事务数据库/恢复备份，不表示有模块尚未接入；旧阶段profile仅保留内部回归兼容。

回顾直接从当前Session/RLS可见的review_rounds按Space稳定分页读取；不使用上一份计划或特权RPC。仅将这些轮次ID每100个一批读取review_entries，每批继续按review_id,user_id完整分页和精确计数，bigint显式::text。统一postflight仅复核相同可见父集合，禁止查询整个Space的entries总量、隐藏轮次统计或占位符。不可见旧轮合法缺省；授权轮次缺少本人、参与人数不符、重复身份、错误关联或revision异常时失败。历史对方无需是当前成员，当前导出者仍必须有成员资格。

manifest增加通用authorization_scope说明，files只列实际RLS范围行数，无隐藏历史ID/数量；README解释原参与者、新Owner及已离开对方的范围。UI不再称阶段性导出，说明当前授权、多次读取非单一时点、不能导入恢复；默认个人/全选/改选清理等行为保持。取消/卸载/账号失效会废弃结果，并通过AbortSignal终止在途fflate压缩worker。

容量复核：8 MiB限制累计CSV UTF-8字节（每Space每表表头一次、每行一次，页重复表头已减去）；16 MiB是最终全部文件组装的第二道保护，包含README/manifest，与前者不是相加预算。两者均不等于JS堆、worker或总进程内存上限，也不以ZIP压缩后大小计费。恰好8 MiB接受、再多1字节失败的测试排除了重复/过度计费。保留阈值，未凭桌面结果提高手机内存风险。

多年正常数据确实可能超限：3650条300字日程CSV4,778,228 B，520次双人四字段350字周回顾所在Space CSV4,621,231 B，合选超限、分Space成功；每字段1000字时单Space也会失败。600字多样中文长回顾样本CSV7,755,359 B、ZIP约3.15 MB，桌面Chrome主线程JS堆采样约61.7 MB，独立Node峰值RSS约180 MiB（含运行时/夹具，非手机）。阈值是保守工程边界，不能声称支持所有多年用户；超限明确失败并建议分Space，单Space仍超限暂不支持。没有证明可安全提高限额的iPhone证据，不引入后台导出；未来若必须支持此类大单Space，应单独评估减少复制/增量组装，不能静默截断。

Production RLS、bigint/JSON ::text（含NULL及大数）、空父集合in过滤/精确count及Realtime投递仍NOT VERIFIED；Mock不是这些门禁的证据。iPhone standalone PWA保存/取消/落盘解压与真实内存待正式发布后用户真机验收，前置环境兼容Gate不得省略。

### Slice 3：多空间主要业务范围（历史检查点）

2026-11-04 LOCAL VERIFIED / READY FOR REVIEW，未提交/发布。沿用format_version=1、原12类字段和编码；export_scope=core-spaces、complete_backup=false。每个所选Space实际读取并生成space/members/modules/events/event_occurrence_exceptions/tasks/lists/list_sections/list_items/important_dates共10类CSV，确实空时保留表头。review_rounds/review_entries固定not_included且不生成文件，留Slice 4；README/UI明确这不是包含回顾的完整备份。两Space为22文件，不把disabled、缺模块行或读取失败当成业务空表。

src/lib/space-export.ts从当前用户的完整成员关系派生可选Space，名单也完整分页；选择ID必须非空、不重复且全在新核验名单中。不以created_by判断归属。默认只选personal，共享主动勾选，可全选/取消全选；零选择禁生成，修改选择同步废弃旧ZIP/保存确认。选择只存在本页内存，不改全站筛选器；成员/空间通知及恢复焦点刷新或失败关闭，丢失权限的选中项移除并提示。

依旧只用现有Session/RLS，白名单SELECT（JSON/bigint ::text），不查询enabled筛选、不读取profiles/邮箱/邀请码/订阅/账本。members.csv仍只有原四列，历史昵称不追查。任务合法NULL指派和审计created_by原样保留。清单分组/条目、事件例外按100个父ID分批且每批继续分页；空父集合也请求空in筛选、核验0结果（目标后端空in行为仍属环境门禁）。所有读取都有稳定顺序、精确count及身份/Space检查；读完所有Space后统一复核各表/批次数量，再核验授权。非事务同数量替换/修改仍不能保证检测。

清单CSV按list_id、分组、精确bigint sort_order稳定排列，NULL代表未分组，不把字符串排序号转为Number。共享成员变更可能导致关联复核失败，必须整包重试，不越权补数据。

容量保护：读取过程中按真实CSV UTF-8字节累计，8 MiB预算，超长原文先作下界检查再编码；最终组装保留16 MiB保护，均为失败而非截断。超限建议减少所选Space/分Space导出；单Space仍超限时本阶段不能导出，不开发后台服务。1万条合成清单样本未压缩7,312,066 B，ZIP约128,904 B；桌面Chrome主线程JS堆采样峰值53,312,775 B，不能从小ZIP推断低内存。测量范围与限制见TESTING，不代表真实iPhone容量通过。

原确认保存/取消/失败重试、账号隔离、AbortSignal及迟到响应废弃保持。Production bigint/JSON cast、空in、真实RLS/Realtime投递和iPhone standalone PWA仍NOT VERIFIED，真实验收前先完成环境对齐门禁。

### Slice 2：个人空间日程阶段性范围

2026-11-04 本地实现；沿用 format_version=1 和全部既有字段/编码，增加明确的范围元数据：export_scope=`personal-calendar`、complete_backup=false、table_coverage逐表标记。仅space/members/events/event_occurrence_exceptions为exported，包含确实为空时的表头；modules/tasks/lists/list_sections/list_items/important_dates/review_rounds/review_entries为not_included，不生成其CSV，不能解释为已查询为空。每包当前为4个CSV＋README＋manifest共6文件。默认全模块合成验证仍输出原12类CSV；不允许阶段输入夹带未纳入模块的数据后静默丢弃。

README首段和账户导出界面均明确“阶段性导出，不是完整备份”。仅日程与重复例外真实读取接口已实现，其他模块和多Space未实现。Mock测试会经过实际读取器产生synthetic=false协议分支，但测试来源仍是合成内存数据，不是Production数据或验收证明。

src/lib/personal-export.ts不接受导出目标Space参数；先getUser核对当前用户，再分页读取其成员关系，与kind=personal空间相交，必须唯一；不以created_by识别归属。显式列查询，JSON使用::text，按ID稳定分页，子表每100来源事件ID一批且每批继续分页。复用completeRows并拒绝NULL响应，末尾再核对events及各例外批次精确数量；准备区间覆盖读取阶段。非事务读取仍不能发现所有同数量替换或修改。

权限在分页前后、读取结束、压缩后和保存准备阶段核验；Auth变化、成员变更通知、导航离开使请求/内存结果失效。恢复焦点/可见时重新核验已生成文件，失败关闭。Realtime通知不能保证即时到达，因此保存前始终重新查询；核验与交付不是一个数据库原子事务，先前已合法读取或保存的文件无法远程撤回。

保存先进行异步权限核验，再由用户点击“确认保存ZIP”获得新的用户手势，确认有效期10秒；超时重新核验。原生分享取消/失败可重试或下载，不声称已落盘。File/Object URL只在内存中，失效或卸载释放，不写localStorage/sessionStorage/IndexedDB；压缩无法瞬间中止时废弃其迟到结果。

目标Production的JSON ::text仍NOT VERIFIED，失败不降级成解析对象或空数组；Slice 2不读取bigint业务表，其实际cast门禁留后续。真实账号验收前必须完成环境对齐，本轮只做Mock和自动化，不要求用户登录验收。

可执行读取白名单为 `src/lib/data-export-format.ts` 的 `exportColumns`；格式2序列化及manifest的有序字段为`exportCsvColumns`，中文文件/列映射为`exportPresentation`。下列字段均来自真实 Schema，没有增加业务列。`space`、`members`、`modules` 分别对应 spaces、space_members、space_modules；其他原始类别键与数据库表同名。

| CSV | 严格列顺序 |
| --- | --- |
| space | id, name, kind, created_by, created_at |
| members | space_id, user_id, role, joined_at |
| modules | space_id, module_key, enabled |
| events | id, space_id, created_by, scope, owner_user_id, title, description, starts_at, ends_at, all_day, reminder_kind, time_zone, reminder_schedule_changed_at, recurrence_rule, series_id, parent_event_id, recurrence_until, created_at, updated_at |
| event_occurrence_exceptions | id, event_id, occurrence_date, exception_type, override_data, created_at, updated_at |
| tasks | id, space_id, created_by, assigned_to_user_id, title, status, due_on, created_at, updated_at, reminder_kind, time_zone, reminder_schedule_changed_at |
| lists | id, space_id, name, created_by, created_at, updated_at |
| list_sections | id, list_id, name, sort_order, created_by, created_at, updated_at |
| list_items | id, list_id, space_id, section_id, content, completed, sort_order, created_by, created_at, updated_at |
| important_dates | id, space_id, name, emoji, repeat_kind, month, day, year, reminder_kind, time_zone, reminder_schedule_changed_at, created_by, created_at, updated_at |
| review_rounds | id, space_id, round_no, review_date, created_by, created_at |
| review_entries | review_id, user_id, focus, progress, problems, next_plan, content_revision, filled_revision, updated_at |

输入必须精确匹配白名单：缺字段、undefined、额外字段均拒绝。不得直接传入 SELECT * 结果，特别是 spaces.invite_code。这里没有导出 profiles 昵称、头像、用户邮箱、Auth 信息、邀请码、推送订阅密钥或发送账本；历史用户 ID 保留，不越权解析用户资料。memo 只有模块枚举，尚无实际内容表，不虚构文件。

## 单元格编码与可逆边界

每份 CSV：UTF-8，开头一个 BOM；逗号分隔；所有字段与表头使用双引号，内部双引号加倍；每条记录 CRLF 结束，包括最后一条。正文内部 CR/LF 原样保留，必须使用 CSV 解析器，不能用逐行 split 统计。

先 CSV 解码，再按 manifest 中列类型处理：

| 数据 | 文件中的逻辑单元格值 | 还原规则 |
| --- | --- | --- |
| SQL NULL | `\N` | 仅 nullable 列允许，转为 NULL |
| 文本 | `text:`＋原文 | 精确去掉一次 `text:`，不 trim、不递归解码 |
| 空字符串 | `text:` | 得到空串，区别于 NULL |
| 原文为 `\N` 或 `text:x` | `text:\N` 或 `text:text:x` | 去掉一次前缀得到原文 |
| JSON/JSONB | `json:`＋原始 JSON 文本 | 去掉一次前缀得到 JSON 文本；不要求先 JSON.parse/stringify |
| bigint | `int:`＋精确十进制字符串 | 去掉一次前缀，用字符串或任意精度整数处理 |
| date | `date:`＋服务端日期文本 | 去掉一次前缀；不经 JS Date，不转 UTC |
| timestamptz | `time:`＋服务端时间文本 | 去掉一次前缀；保留返回值与独立 time_zone |
| integer | 十进制 int32 | 无浮点数、科学计数法；保持整数 |
| boolean | `true` / `false` | 转为布尔 |
| UUID | 小写 UUID 原值 | 原样关联 |

bigint 只接受字符串或 JS bigint，拒绝所有 JS number（即使暂时安全），并检查 PostgreSQL 有符号 64 位范围。JSON 输入只接受有效的原始 JSON 文本，不接受已解析对象，以保留 JSON 大数字和文本内容。拒绝无法无损写成 UTF-8 的孤立代理码及 PostgreSQL text 不支持的 NUL。

文本、JSON、日期、时间和 bigint 的固定可见前缀会保留在表格单元格里。这是为了防止公式执行与自动类型改写，不是显示错误；正文仍可读。用户若自行去除前缀、重编码或交给不遵守合同的下游，安全与精度保证终止。前缀含义写入 ZIP README，不依赖 Excel 对引号、单引号或 Tab 的特殊处理。未声称已在 Excel/Numbers 所有版本做运行验收。

可逆性针对未经编辑的 CSV 逻辑值，不代表数据库物理备份、不保留原 JSONB 存储前已经丢失的排版或顺序，不保留应用中的未保存草稿；本轮没有导入／恢复 UI 或解码写入数据库的接口。

## 关联与权限合同

- 组装器要求每个 Space 一条元信息，所有直接 space_id 必须匹配；当前导出者必须出现在成员列表。它不发起查询，不能证明真正授权，真实权限由space-export现有Session查询及后端RLS执行，后端实测仍待核验。
- 日程保留源段与 series_id/parent_event_id；验证引用存在、同 Space／audience、父段无环。例外必须引用重复源，保留 occurrence_date 与 deleted/override。重复规则不展开；recurrence_until 是排他截止。
- 任务保留指派成员 ID 或 NULL。创建者可能已离开，不要求 created_by 都是当前成员。
- 清单、分组、条目验证父子 ID，section_id=NULL 表示未分组；保留排序号和完成状态，不增加派生统计列。
- 回顾同时要求当前成员及原轮参与者；组装器要求该轮含导出者 entry，个人一条／共享两条，允许对方为已离开历史参与者。保留 content_revision/filled_revision，不将未参加的旧轮补入；不推断或导出隐藏的“上一份”回顾关系。
- 每表主键／复合身份去重，并核对例外日期、回顾日期和编号、清单排序唯一性。所有 CSV 的预期行数由读取器独立给出，输入不符即失败。
- 读取器分页前后及统一postflight核验账号和可见范围，交付/保存前重验成员资格；通知与页面离开废弃结果。客户端关联检查不能替代RLS，当前本地输入全部是合成Mock，未验证真实会话。

## manifest

- format_version=2，与产品版本分开；1为已发布历史协议。
- synthetic 标识样本来源，exported_by_user_id 是本次导出者（不改业务 created_by）；started_at/finished_at 是数据准备区间，必须先后有效；不含随后 ZIP 压缩及用户点击保存耗时。
- transactional_snapshot=false、includes_disabled_modules=true，以及中文 limitations。
- spaces：所选Space ID、原名称、kind和目录名；files：实际已纳入CSV的原始类别table、路径path和数据行数rows，不计表头；table_coverage明确exported/not_included。当前authorized-spaces每Space12类CSV均exported，authorization_scope说明回顾参与者范围，不包含不可见历史的元数据。
- file_names：原始类别到中文文件名；fields：12类CSV实际列顺序的name/label/type/nullable定义；encoding：NULL、类型前缀、字符集、记录分隔等。
- manifest 不包含凭据、真实邮箱、开发机器路径或内部临时文件名；README 的格式说明归属不覆盖业务记录 created_by。

## bigint／JSON 文本读取门禁（未执行）

仓库读取器对 bigint 及 JSON 列使用 `::text`，保留原字段名，例如：

```text
list_sections: sort_order::text
list_items: sort_order::text
important_dates: year::text
review_entries: content_revision::text,filled_revision::text
events: recurrence_rule::text
event_occurrence_exceptions: override_data::text
```

本地未启动隔离PostgREST。收口已用正式公开anon配置做不可能命中的零行API探针：events/例外两处JSON ::text语法可执行；bigint来源表受匿名ACL拒绝，bigint cast执行及所有NULL/超安全整数/JSON数字实值响应仍NOT VERIFIED。仅GET/HEAD，没有用户Session/私密Auth凭据、业务读取或Production写入；不能将API零行或Mock当认证合同通过。

## 保存验证与容量边界

fflate 精确锁定 0.8.3（MIT、无运行时依赖）。generateExportZip 校验全部文件后才动态 import ZIP 能力，压缩成功前不返回文件。读取器8 MiB/最终组装16 MiB的含义与复核见Slice 4节；取消时终止在途压缩。上限不是已测量的手机容量承诺。

本地入口：运行 `npm run dev` 后访问 `http://127.0.0.1:5175/tests/fixtures/data-export.html`。入口有 DEV 限制、只使用固定合成数据、不注册 SW／不请求 Supabase；应用 main／账户页面没有引用它，Production Build 不包含此页。

先点击“生成合成 ZIP”，完成后再次主动点击“保存 ZIP”。检测当前 ZIP File 的 canShare；支持时在同一点击内调用 share，否则触发 Blob 下载；也提供独立“下载 ZIP”。取消／失败保留重试，反馈只说“请求已交给系统／浏览器”，不声称已落盘。重新生成或卸载释放旧 Object URL；忙态同步锁与 generation 防止重复和迟到结果。

WebKit/Chrome 的真实 Blob 下载和下载文件解压可自动验证；原生分享在自动化中只模拟 API 边界，不能据此称为系统分享面板 PASS。iPhone standalone PWA 的 HTTPS、实际 ZIP MIME 支持、“存储到文件”、取消／重试和后台恢复仍待后续独立授权的人工验收；不在本轮部署验证页。

## 验证命令与后续顺序

```sh
node --test tests/data-export-format.test.ts tests/data-export-archive.test.ts tests/data-export-save.test.ts
PLAYWRIGHT_MODULE_PATH=<既有playwright路径> node --test tests/data-export.browser.mjs
node_modules/.bin/tsc -b
npm run build
git diff --check
```

下一步review Slice 4本地完整范围及容量边界，再另行授权环境门禁、Git/发布流程；数据导出优先，之后才讨论自主注销。Production cast/RLS/空in核验与真实PWA验收完成前，不标记Production CLOSED/PASS。

参考：[RFC 4180](https://www.rfc-editor.org/rfc/rfc4180.txt)、[PostgREST column casting](https://docs.postgrest.org/en/stable/references/api/tables_views.html#casting-columns)、[OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection)、[Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)、[fflate](https://github.com/101arrowz/fflate)。
