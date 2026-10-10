# UI v2 Implementation Specification

2026-10-10 · Slice 1 · 本地实施规格。UI v2 / Slice 是工作组织标签，不新增正式版本；既有 v0.1.20 CLOSED / PASS 及验收边界保持。

## 设计来源与优先级

- 正式包：`/Users/wp/Projects/跨系统共享日历-UI设计参考/UI_DESIGN_APPROVED_REFERENCES_2026-10-10_v2.zip`。
- ZIP SHA-256：`39ade13689e54d8347b156e339f7c2ea21d47857936d46a440ca7ff07576973a`；Phase 0 与 Slice 1 复核可读取、CRC 无错误、approved 下 15 PNG。
- 阅读基线：`/Users/wp/Projects/跨系统共享日历-UI设计参考/UI_DESIGN_BASELINE_2026-10-10_v2.md`；与包内 `UI_DESIGN_BASELINE_2026-10-10.md` 内容相同。
- 最新用户明确指令优先；书面基线的产品/交互规则优先于图片样例；真实业务字段、权限及 canonical contracts 必须保留。冲突停在所属 Slice 单独确认，图片不得授权新增功能。
- 视觉采用 approved 首次获认可的方向，只有明确指定替换的图例外；不重画确认页面。参考编号：01 首页 C；02–05 日/周/月/月浮层；06 功能中心；07 任务；08–10 回顾；11 原始清单五屏；12 原始重要日设计板；13 我的/空间开关；14 日程表单；15 无描述的任务表单。排除后续清单重画；插画未冻结。
- 本文的精确颜色、像素、字重、阴影是**第一版工程候选值**，来自基线初稿和 Phase 0 建议；不是用户逐项批准的不可变规范。页面接入后按真实屏幕及人工验收微调。

## 实施边界与单一链路

Slice 1 仅修改 styles.css、tailwind.config.ts、本规格、DEVLOG、PROJECT_STATE。旧 worktree 不动；新 worktree 基于 `ab3a9a8c61515572cf92dedbad67391d4d1614d8`。

唯一链路是 `:root --ui-* → Tailwind theme.extend → 显式 ui 工具类`。不新增框架、ThemeProvider、依赖或第二套主题；现有 root 字体/背景/文字、ink/mist/coral/teal/amber/soft 和 Safe Area 类保持。此阶段只有变量进入全局，页面尚未接入 ui 类；不全局替换 button/input/card 样式，不重定义 white、rounded-lg、shadow-sm，不使用 !important。

## 字体与排版 tokens

`--ui-font-sans` / `font-ui`：system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Noto Sans CJK SC", "Noto Sans SC", "Microsoft YaHei", sans-serif。使用已安装系统字体，不下发字体文件；iOS/Android/中文回退仍需真机检查。

字体与间距使用 rem，下表 px 是根字号 16px 时的等价值，不锁定 html 字号；用户字体设置和浏览器缩放可放大。颜色不靠文字透明度降级。

| 角色 / Tailwind | 字号变量 / 行高变量 | px / px / 字重 |
|---|---|---|
| 页面 `text-ui-page-title` | text-page / leading-page | 26 / 34 / 700 |
| 模块 `text-ui-section` | text-section / leading-section | 20 / 28 / 600 |
| 顶栏 `text-ui-bar` | text-bar / leading-bar | 18 / 26 / 600 |
| 列表 `text-ui-list` | text-list / leading-list | 16 / 24 / 500 |
| 正文/输入 `text-ui-body` | text-body / leading-body | 16 / 24 / 400 |
| 辅助 `text-ui-meta` | text-meta / leading-meta | 14 / 20 / 400 |
| 标签 `text-ui-label` | text-label / leading-label | 13 / 18 / 500 |
| 紧凑标签 `text-ui-label-small` | text-label-small / leading-label | 12 / 18 / 500 |

以上变量均加 `--ui-` 前缀。字重变量 `--ui-weight-{normal,medium,semibold,bold}` 为 400/500/600/700，对应 `font-ui-*`；排版类同时输出字号、行高和默认字重。列表需 600 时加 `font-ui-semibold`，不另造近似字号。排版键不与颜色键重名（如标题用 text-ui-page-title，text-ui-page 仅是页面色），防止同一 Tailwind 类同时改字号与文字颜色。不要在同一元素混用旧 text/leading/font 类覆盖语义排版。输入必须使用正文字号，防止 iOS 小字号输入放大。

## 颜色 tokens / CSS 与 Tailwind 映射

颜色变量保存空格分隔的 RGB 通道；全部 `colors.ui.KEY` 映射为 `rgb(var(--ui-color-KEY) / <alpha-value>)`，生成 `bg-ui-*` / `text-ui-*` / `border-ui-*` / `outline-ui-*`。透明度仅用于装饰表面；正常/次级文字以及必要边界使用不透明色。

| KEY（变量后缀） | Hex | 用途 |
|---|---|---|
| page | #FAF9F6 | 暖白页面 |
| surface | #FFFFFF | 容器、输入表面 |
| soft | #F0F3EE | 中性弱底 |
| text | #28342F | 主文字 |
| muted | #636F67 | 次级文字，禁止额外 opacity |
| accent / accent-strong / accent-soft | #436552 / #34523F / #E8EEE6 | 品牌操作 / hover / 淡底 |
| on-accent | #FFFFFF | 品牌实色按钮文字 |
| auxiliary / auxiliary-soft | #7C6249 / #F1EADF | 米棕辅助，不代表事件优先级 |
| success / success-soft | #436552 / #E8EEE6 | 成功语义，变量独立于品牌 |
| warning / warning-soft | #896222 / #F7EFDC | 警示语义 |
| danger / danger-soft | #A54539 / #F9EBE8 | 危险操作 / 淡底 |
| on-status | #FFFFFF | 成功/警示/危险实色上的文字 |
| border | #DDDCD5 | 装饰分隔，不能作为唯一控件边界 |
| control | #7C8980 | 必要控件边界 |
| focus | #436552 | 键盘 Focus，独立语义变量 |

推荐对比度（WCAG sRGB 计算，未四舍五入值用于判定）：

| 配对 | 对比度 |
|---|---|
| text / page、surface、soft | 12.29、12.94、11.56 |
| muted / page、surface、soft | 4.99、5.25、4.69 |
| accent / accent-soft；auxiliary / auxiliary-soft | 5.53；4.75 |
| success / success-soft；warning / warning-soft；danger / danger-soft | 5.53；4.78；5.15 |
| on-accent / accent、accent-strong | 6.52、8.66 |
| on-status / success、warning、danger | 6.52、5.48、5.98 |
| control / page、surface、soft、accent-soft、auxiliary-soft | 3.47、3.65、3.26、3.10、3.06 |
| focus / 同上 | 6.19、6.52、5.82、5.53、5.45 |

正文最少 4.5:1，必要边界/状态识别最少 3:1。淡色状态标签使用同名实色文字；不要把 muted 放在任意状态淡底，不保证跨配对达标。border 在白底仅 1.38:1，限装饰分隔；输入用 control。颜色不能是状态/危险的唯一信号，保留文本、图标、aria 状态及原有确认。

## 间距、圆角、边框、阴影与 Focus

- `--ui-space-1..7`：4/8/12/16/20/24/32px，对应 spacing `ui-1..7`，生成 p-/px-/py-/gap-/m- 等。页面横向默认 16px；控件内距 12/16px；列表行 12/16px；组间 20/24px，大段 32px，具体布局由对应 Slice 验收。
- `--ui-radius-{control,group,sheet}`：12/16/24px → `rounded-ui-control/group/sheet`；仅当现有组件功能适用时显式接入。
- `--ui-border-width: 1px` → `border-ui`（宽度）；与 `border-ui-control`（颜色）组合，不混淆二者。
- `--ui-shadow-group: 0 1px 3px rgb(var(--ui-color-text) / 0.06)` → `shadow-ui-group`；Sheet 为 `0 16px 40px ... / 0.12` → `shadow-ui-sheet`。首页时间线不用大阴影/大色块，图标不加底框。
- `.ui-focus:focus-visible` 使用 `--ui-focus-width: 2px` 实线 focus 和 `--ui-focus-offset: 2px`；可配 `focus:border-ui-focus`。不要关闭浏览器 outline 而无替代；检查圆角容器不裁切 outline。保留原焦点捕获、Escape、关闭后焦点恢复。
- `--ui-touch-target: 2.75rem` → `min-h-ui-touch`（44px）；点击目标宽度也至少 44px，不能只看视觉图标尺寸。

## Safe Area 与导航兼容

- `--ui-nav-content-height: 3rem`（48px），匹配当前 BottomNavigation min-h-12；`--ui-nav-clearance: 1rem`（16px）。不在本 Slice 改底栏高度、导航结构或视口设置。
- `.ui-pb-nav` = nav-content-height + max(nav-clearance, env(safe-area-inset-bottom, 0px))，默认与旧 `.pb-nav` 一致。
- `.ui-bottom-nav` = env(safe-area-inset-bottom, 0px)；`.ui-safe-bottom` = max(space-4, env(...))；`.ui-nav-alert` bottom = nav-content-height + env(...) + space-3（12px），与旧提示定位一致。
- 当前 `.pb-nav`、`.bottom-nav`、`.safe-bottom`、`.nav-alert` 保留原样；后续逐处迁移，避免同时用两套 padding 类。以后若导航真实高度变化，必须同时验收预留空间及提示位置，不用任意 72px 替代。
- 保留 viewport-fit=cover 与 body min-width:320px。新输入 w-full/min-w-0；长中文和空间名必须换行或安全截断。Sheet 内正文独立滚动、顶部操作可达，键盘与底部安全区需 iOS/Android/PWA 人工验收。

## 已确认视觉与功能例外（后续实施，不是本 Slice 完成项）

| 模块 | 视觉规则与已授权例外 | 必须保留 / 禁止 |
|---|---|---|
| 首页 | C 行式时间线、无大色块；日程/任务/重要日 3/2/2 **预览上限**；各标题独立 + | 不新增首页展开；保留时间窗口、筛选排序及三模块独立状态。重要日 + 需后续接入现有创建能力；无右上我/头像/全局快添 |
| 日历 | 分段日/周/月、独立 Space 筛选；紧凑周空日；月格 1–2 短标题/+N 与轻浮层 | 保留前后/回当前周期及查看全部路径；不新增空闲统计/优先级字段；不修改 recurrence/overlap/日期算法 |
| 功能中心 | 2×2 概览 + 一体列表/分隔线，无图标底框 | 现有 availability 不是业务统计；不得造图中数字，统计来源不足先确认语义，不增加隐式业务读取 |
| 任务 | 已完成默认页内收起，展开可重新打开 | 兼容旧 tasks-completed 导航，映射展开状态，保护返回/筛选/快照/权限/busy；不任意限量或新增分页 |
| 回顾 | 纯历史日期/第 N 次/填写状态，统一中文 | 保留四字段 focus/progress/problems/next_plan、上一份我的计划、独立保存与标记填写；Personal 不造双方状态 |
| 清单 | 只用原始五屏 | 保留改名/删除、条目增改删/勾选/拖拽/分组；无跨空间移动、图标选择、描述、新开关或字数上限 |
| 重要日 | 历史一次性日期默认折叠「历史重要日 · N」，「已过 X 天」 | 复用现有 civil-date/elapsedDays/下一次日期计算及提醒；不新增备注、添加到日历、新周期 |
| 我的/空间 | 绿右开、灰左关，保留可访问性 switch | 原权限、邀请码复制/轮换、危险确认/转让/删除保护保持；不造邀请成员按钮；插画未冻结 |
| 表单 | 固定顶部关闭/保存、原生日期时间、无重复底部保存 | 保留实际 Space 默认规则、成员分配、五种日程重复及细节、无截止不启用任务提醒、历史 null；无任务描述或 500 字限制 |

图片虚构的按钮/字段/权限/状态/流程一律不新增。实际业务以 [DECISIONS](./DECISIONS.md)、[导航聚合](./v0.1.11_NAVIGATION_AGGREGATION_SPEC.md)、[回顾](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md)、[清单](./v0.1.15_SHARED_LISTS_SPEC.md)、[重要日](./v0.1.18_IMPORTANT_DATES_SPEC.md)、[任务提醒](./v0.1.19_TASK_REMINDERS_SPEC.md)、[手势](./v0.1.20_MOBILE_GESTURE_NAVIGATION_SPEC.md) 为准；这里不重写 RLS/RPC/ownership/Realtime/Push 治理。

## 页面接入规则

1. 每轮另行授权精确文件范围；优先在页面根显式 `font-ui bg-ui-page text-ui-text`，对子元素选择排版角色。Portal 不在父级 DOM 内，后续 Sheet 须单独接入字体/表面；不全局强制接入。
2. 替换同一属性的旧工具类，避免 class 顺序误判；用静态完整类名供 Tailwind 扫描，不动态拼接语义色名。严禁组件内复制 Hex 或手写第二组主题变量。
3. 输入候选组合：`font-ui text-ui-body w-full min-w-0 min-h-ui-touch px-ui-4 py-ui-3 bg-ui-surface text-ui-text border-ui border-ui-control rounded-ui-control ui-focus focus:border-ui-focus`。按钮同样使用正文/标签角色与 44px 目标；品牌按钮用 accent/on-accent，危险按钮用 danger/on-status，不只改变透明度。
4. label 关联、错误文本、disabled/busy 状态和现有交互不得丢失。每次组合颜色重新验算；新增主题只能替换集中 tokens，不能改变状态含义。

## 分阶段验收边界

| 阶段（需分别授权） | 可独立验收产物 | 自动与人工检查点 |
|---|---|---|
| Slice 1（本轮） | Tokens + 本规格，页面未迁移 | 映射/计算样式/对比度、320px 离线样例、原基础类与既有页面回归、相关 Node、build、diff/scope；不宣称全应用 UI 完成 |
| 下一 Slice 建议 | 首页及四栏壳层视觉，另定精确范围 | 3/2/2 仅预览、独立 +、四栏与 Safe Area、loading/empty/error、长标题；聚合/导航/手势回归；用户确认视觉后停止 |
| 日历 | 三视图与日期浮层 | 原周期/日期/多事件访问路径/Space 隔离、聚合日期与手势测试；手机浮层/纵向滚动/键盘检查 |
| 任务与重要日 | 页内完成折叠、历史折叠与已有正计时 | 旧导航恢复、complete/reopen 资格、snapshot/date fixtures；默认收起与展开人工验收，不改 canonical 读写 |
| 回顾与清单 | 既有列表/详情/表单迁移 | 四字段保存/标记、历史分页、改名增改删/拖拽分组；真实 A/B/长列表/设备验收 |
| 我的/空间与表单 | 开关和所有编辑表单统一 | owners/成员边界、删除确认、原提醒/重复/分配；输入字体/原生选择器/键盘/滚动/Focus 真机验收 |
| 全应用收口 | 跨页一致性与最终设计验收 | 全量相关自动测试/build/review，iOS Safari、Android Chrome、installed PWA 与桌面视觉/可用性；不把历史 PASS 转移到新 UI |

真实登录、双账号和 PWA 验收前先执行 AGENTS 的前后端环境/版本对齐 gate；用户操作账号和设备，Codex 不驱动登录会话。测试约定及历史覆盖见 [TESTING](./TESTING.md)。本轮不准备真实登录环境，不访问 Production；commit/push/deploy 始终另行授权。Slice 1 实际检查结果见 DEVLOG，不能以本计划推断 PASS。
