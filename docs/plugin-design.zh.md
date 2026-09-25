# 会话颜色标记插件设计（自有实现）

本文件是 `@idoall/dsh-session-colors` 的**现行设计记录**：为什么这么做、实测到什么、哪些取舍是刻意的。工作边界与不变量见 [AGENTS.md](../AGENTS.md)，面向使用者的说明见 [README.zh.md](../README.zh.md)。

## 为什么是目录插件

最早的做法是在 DSH 源码树里改自带包，再把重建产物拷进全局安装。做过一次就证明这条路很脆：源码 checkout 是 `0.1.6-alpha.1`、运行实例是 `0.1.6-alpha.2`，跨发布装入直接把左侧工作区弄坏了。目录插件走另一条路——作为独立包被 profile 加载，对着**运行实例自己的** API 运行，不替换任何自带产物；版本演进时它优雅降级，而不是把宿主搞坏。

## 事实基础：alpha.2 的 slot 目录

以下不是推测，是从运行实例的 slot 目录与自带包的 `slots.ts` 读出来的。它决定了这个插件**能**用哪些位置、以及为什么色块只能做成浮层：

| 事实 | 结论 |
| --- | --- |
| `sidebar.workspaces` 是 `single`，由自带 `ui-workspace` 注册（声明即占用） | 插件**不能**把自己的内容放进工作区列表内部 |
| **alpha.2 不存在任何会话行级 slot** | 插件**无法**在会话行里渲染任何东西——色块只能做成框架级浮层 |
| 会话行首的状态位由 `ui-workspace` 的 `Rows.tsx` 渲染，数据是封闭联合（`done \| warning \| ongoing \| error \| idle`），没有 provider 注册点 | 插件**无法**把颜色画进那个位置；色块因此取行内边距 |
| `conversation.session.header.actions`（`list`，scope=session） | 会话标题旁的动作位 |
| `conversation.session.header.utilities`（`list`，scope=session） | 右对齐的会话工具簇——选择器注册在这里，原因见下 |
| `shell.overlay`（`list`） | 框架级浮层，**默认点击穿透**；色块浮层注册在这里 |

## 界面与装入状态

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包名 `@idoall/dsh-session-colors`、`exports['./client']`、`dsh.bundle.patch`、`dsh.client.inject = [client-ui-layout, client-ui-conversation]` |
| `cordis.patch.yml` | `insert` 挂载（与 `dsh-notify` 同构） |
| `src/index.js` | Host 半边：**刻意无状态**，不写任何 Session 事件、不注册 Host 服务 |
| `src/client.js` | 浏览器半边：手写 `__ModuleLoader__` bundle（**免构建**），只 require `react` 与 `react-dom`（都是 DSH web shell 的 static module） |
| `tests/plugin-client.test.mjs` | 29 项：bundle 结构、两个 seat、缺 slot 降级、按 Host/Session 分键、清除、快照引用稳定、未解析 Host 不落盘、坏数据忽略、`data-row-key` 取 id（含 fiber 回退与环终止）、颜色换算、色块几何、层叠层级、portal、手机抽屉跟随、动画行跟随、hex 字段宽度、Host 半边、包名/挂载一致性、link 插件依赖声明 |
| `tests/docs.test.mjs` | 9 项：`docs/` 只放设计记录与图片、全部本地 Markdown 链接与锚点可达、两个 README 互相链接并写明安装、两个 README 的兼容性版本与 `dsh.compatibility.dshReleases` 逐字一致（含预发布范围判断）、三张 README 截图的签名与尺寸、Demo 的静态卫生（单一 inline script、id 唯一、无外部引用） |

### 两个界面，都走公开 slot

| 界面 | slot | 说明 |
| --- | --- | --- |
| 颜色选择器 | `conversation.session.header.utilities` | 系统风格面板：大色板、色相、透明度、HEX/RGBA、主题色、我的颜色、吸色（`EyeDropper`）。注册在**右对齐 utilities** 而不是标题旁的 actions，原因见下 |
| 行内色块 | `shell.overlay` | 框架级浮层，**默认点击穿透**，官方文档称其为"你自己的框架级界面的增量座位" |

**没有修改任何自带文件，没有 DOM 补丁。**

### 行内色块怎么定位（这是唯一有耦合的部分）

DSH 0.1.6 没有会话行 slot，行的 DOM 也**不暴露 session id**（当时实测：侧栏 24 个会话行，全侧栏 0 个带 id 形态值的属性）。0.1.7 给每个会话行加了 `data-row-key="session:<id>"`，所以浮层现在靠：

1. `[role="treeitem"][aria-selected]` 找到渲染出来的会话行（ARIA，非哈希类名）；
2. 先读行自身的 `data-row-key`（`session:` 前缀）拿**精确** session id；
3. 读不到时回退到 React fiber 的 `memoizedProps.node.id`——旧构建与搜索结果行（无 `data-row-key`）走这条路径。

这一层耦合是**故意且无害的**：每一步都有 `try/catch`，读不到就跳过该行；浮层不接受指针事件，所以最坏情况只是色块不显示，不会挡住点击、不会弄坏侧栏。长期正道是向上游提一个 `sessions.row.*` slot 需求。

### 色块位置的取舍（已实测确认）

真实行几何：`[8px 内边距][16px 状态位][4px][标题]`，状态点 10px 在 x=11..21。

**标题前那 16px 被状态点占着**——盖掉它正好毁掉"哪个会话完成了"这个信号。因此色块取**行内边距里的 4px 竖条**（x=row.left+2），与状态点互不重叠。Demo 里保留了"标题前方块"的对照画法可一键切换，供日后改主意时参考。

### 手机端色块看不见（2026-09-22 实测定位与修复）

用户报"移动端那个颜色看不到"。实测环境：手机页面经 dsh-bridge 的局域网反代（`10.0.0.30:3082` → `127.0.0.1:3080`），视口 390×844。**不是存储问题**：手机上 `data-dsh-sc-status=ready`、`data-dsh-sc-marks=2`，色块元素存在、位置正确（x=14、y=376）、颜色正确（`rgb(0,122,255)`），但屏幕上什么都看不到。**也不是点击被挡**：`.dsh-sc-layer` 的 `pointer-events` 仍是 `none`。

两个独立原因叠加，缺一个都看不到：

| # | 原因 | 证据 |
| --- | --- | --- |
| ① 层叠上下文被封 | dsh-bridge 在 ≤767px 把侧栏 `_sidebarCol` 提升成 `position:fixed; z-index:10000` 的抽屉（不透明背景）。插件的浮层在 DSH 的 `.overlayLayer`（`position:absolute; z-index:20`）里，**层叠上下文内的元素永远盖不过它的兄弟**，所以浮层自己的 `z-index:2147483000` 实际被压到 20，色块被抽屉背景整片盖住 | 把 `.overlayLayer` 的 z-index 临时提到 10001，同一个色块立刻可见（`evidence/mobile-drawer-chip-zindex-proof.png` 对比 `evidence/mobile-drawer-chip-hidden.png`） |
| ② 坐标停在抽屉关上时 | 抽屉是 `transform: translateX(-105%) → 0` 滑进来的：**没有滚动、没有 resize、没有 childList 变更**。浮层只监听 scroll/resize/MutationObserver，于是打开抽屉后色块仍停在 x=-292（屏外） | 点开抽屉后实测 `chips:[[-292,376]]`，DOM 里抽屉已开 |

修复（客户端半边，刷新页面即生效）：

1. **portal 到 `document.body`**：脱离 `.overlayLayer` 这个层叠上下文。`react-dom` 是 DSH web shell 的 static module（`dist` 里 `staticModules` 明确列出），拿不到时降级为留在 slot 内（旧行为），不会变成"没有界面"。
2. **按行祖先链实测层叠层级**（`layerZIndexOf`）：从行往上找**最外层**带 `position` 且 `z-index` 非 `auto` 的祖先，取它 +1。桌面原生布局全链 `z-index:auto` → 1；抽屉 → 10001。这样既不硬编码 bridge 的 10000，也**保住了桌面上的正确层级**：色块仍在设置弹窗（`z-index:1000`）之下，不会浮在弹窗上。
3. **跟随祖先的过渡**：监听 `transitionrun`/`transitionend`（capture，且只认"包含会话行"的目标），触发一个有上限的 rAF 跟随循环（40 帧），并额外观察 `body` 的 class 变化，覆盖"过渡被禁用时几何照样变"的情况。

顺带修掉一个尚未爆发的隐患：dsh-mobile 的专用手机布局用 `.dshm-overlay>*{pointer-events:auto}` 覆盖直接子元素，portal 之后这条规则不再命中浮层，"浮层永不接收指针事件"这条不变量在两种手机适配下都成立。

验证（同一手机视口，修复后）：`build=host-routes+drawer-aware`、浮层父节点为 `BODY`、`z=10001`、`pointer-events=none`；抽屉打开后色块在 x=14 可见（`evidence/mobile-drawer-chip-visible.png`）。手机端**完整往返**也跑通：打开选择器 → 点主题色 → 当前会话行立刻出现绿色色块 → 点"清除标记" → 宿主文件回到原来的 2 条标记。桌面 1892px 复测：`z=1`、色块在侧栏行上可见（`evidence/desktop-chip-after-portal.png`），设置弹窗打开时色块被弹窗盖住（`evidence/desktop-chip-below-dialog.png`）。

### 折叠工作区时色块不消失（2026-09-22 实测定位与修复）

用户报：把带标记会话的工作区**折叠**起来后，色块还留在原处（盖在下一行上），**约 20 秒后**才消失；展开时同样要等 20 秒才出现。

20 秒正是 `PEER_POLL_MS`——那一次轮询让 store 产出新快照、React 重渲染、effect 重跑，才顺带重算了色块。也就是说：**折叠/展开根本没有触发任何重算**。

**根因是 DOM 规范的一条细节**：对**同一个 target** 第二次调用 `observer.observe(target, options)` 是**替换** options，不是合并。浮层原本为了监听手机抽屉的 `body` class 变化，在同一个 observer 上又 observe 了一次 `document.body`：

```js
observer.observe(document.body, { childList: true, subtree: true })
observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })  // ← 把 childList 顶掉了
```

于是在真实页面上做了对照实验（同一 observer 先 childList 再 class，然后插入+删除一个节点并切换 body class）：**只收到 2 条记录，全是 class 变化，childList 一条都没有**。工作区折叠在这个构建里是**真的把行从 DOM 移除**（实测 `rows` 5→4、mutation 记录里有 childList 移除），所以本该触发重算——被这条细节吃掉了。

**修法**：每个 options 组合各用一个 observer（行增删 / body class / `aria-expanded` 与 `hidden`），并在卸载时逐个 disconnect。第三个观察是给"只隐藏不移除"的折叠方式留的后路，`aria-expanded` 正是工作区展开折叠的语义信号。

**实测验收**（真实 GUI，1200×900）：折叠 → 色块在 1 秒内消失（原先 20 秒）；展开 → 1 秒内出现；手机抽屉路径复验仍正常（`z=10001`、`pointer-events:none`、抽屉内可见）。回归测试守住"每个 options 组合必须有独立 observer"。

### 适配 DSH 0.1.7-alpha.2（2026-09-23）

DSH 升级到 `0.1.7-alpha.2` 后，插件有三处直接受影响：① 会让旧构建**装不上**（`link:` 装入后宿主半边 import 失败），② 是声明错误（peer 范围按 node-semver 默认规则不覆盖运行版本，pnpm 报 unmet peer），③ 是可见的行为回退（折叠/展开/重排时色块停在滑动起点）。三处都从运行实例的源码/清单里核实过，不是猜测：

| # | 0.1.7 的变化（源码位置） | 对旧构建的影响 | 修法 |
| --- | --- | --- | --- |
| ① | link 插件的依赖解析：`packages/boot/app-boot/src/profile-resolution/resolver.ts` 里 `readLinkedPeerNames()`——只有 link 包 `peerDependencies` 里列的名字才在拦截层被"占用"并解析到运行实例，普通 `dependencies` 只在插件自己的 `node_modules` 下找 | `@deepseek-ai/schemastery` 原本是普通依赖，而本仓库不带 `node_modules`，`link:` 装入后宿主半边 `ERR_MODULE_NOT_FOUND`，**插件根本不加载** | 把 schemastery 移到 `peerDependencies`（另留 `devDependencies` 供本仓库自测）。运行实例的解析表里确实有 `@deepseek-ai/schemastery 3.18.4`（`createRuntimeResolution()` 实测），所以 peer 能解析到它 |
| ② | 预发布版本的范围语义：带预发布的版本只有在某个比较符写了**同一个 `major.minor.patch`** 时才被纳入（node-semver 默认规则） | 旧范围 `>=0.1.6-0 <0.2.0` **不包含** `0.1.7-alpha.2`，pnpm 报 unmet peer。市场的发现流程传了 `includePrerelease`，所以它显示"未知"而不是"不兼容"——但声明仍然不该这么写 | 范围改为 `>=0.1.7-alpha.2 <0.2.0`，新增 `dsh.engines.dsh`；文档一致性测试也从 `includes()` 字符串判断改成带预发布规则的比较器集合判断 |
| ③ | 侧栏行变成动画行：`Rows.tsx` 给每个会话行加 `data-row-key="session:<id>"`；`AnimatedRows.tsx` 用 `element.animate()` 滑动行（Web Animations API 既不发 `transitionrun`/`transitionend`，也不改 DOM） | 浮层只在过渡事件里进入有限跟随循环，而折叠的那次 MutationObserver 回调落在动画第一帧——此时所有行还画在旧坐标，之后没有任何事件再报告滑动，色块就停在原地 | 行列表内的变更与窗口 resize 统一走 `kick()`：先立即重算一次，再进入与 CSS 过渡相同的 40 帧有限跟随循环；`rowsChanged()` 只把落在 `[role="tree"]` 里的 childList 变更算作行列表变更，其他 body 变更只重算一次、不开窗口，流式输出不会让测量循环常驻；同时 `sessionIdOf()` 优先读 `data-row-key`，fiber 降级为回退 |

构建标记随之改为 `host-routes+animated-rows`，设备上的 DOM dump 能区分"缓存客户端"。

**实测验收（2026-09-23，运行实例 0.1.7-alpha.2，视口 2056×1027）**：`dsh plugin --profile web add link:…` 装入后，运行中的实例（`patchReload: live`）**热挂载**成功——boot 图里出现 `@idoall/dsh-session-colors`，控制台打印 `build=host-routes+animated-rows marks route status=ready`，说明宿主半边的 peer 解析路径成立（无需先重启）。选择器从会话头部打开正常；点主题色后该会话行出现色块，实测 `left=14px`（行 `left=12` + 2）、`top=250`（行 `top=242` + (32−16)/2）、颜色 `rgb(52,199,89)`、浮层父节点 `BODY`、`z=1`、`pointer-events:none`。跟随验证用真实折叠触发 `AnimatedRows` 的 WAAPI 滑动：被标记行逐帧从 `top=564` 移到 `530`（22 个不同取值），色块同步从 `572` 跟到 `538`，逐帧差值恒为 8–10px（亚像素取整），即色块始终贴在行上。验证用的临时标记已清除，宿主文件回到 `{"version":1,"marks":{}}`。

**为什么 schemastery 用 peer 而不是"依赖 + 自带 node_modules"**：`link:` 装入不会把被 link 包的依赖装进 profile，本仓库也不发布 `node_modules`；而 0.1.7 明确把 link 包的 peer 解析到运行实例。声明成 peer 后，本目录 `link:` 装入即可用，运行实例的 schemastery 版本（3.18.4）就是实际使用的那份；本仓库自己的 `pnpm install` 仍通过 `devDependencies` 拿到它跑测试。

### 验证 DSH 0.1.7-rc.1（2026-09-23，插件 0.1.4）

官方发布 `0.1.7` 系列首个候选版 `0.1.7-rc.1` 后，本仓库没有新的适配工作：`alpha.2 → rc.1` 之间，插件依赖的客户端/宿主契约（client-modules 加载器、`ui-workspace` 的 `Rows.tsx`/`AnimatedRows.tsx`、`ui-layout` 的 overlay、`ui-slots`、`locale`、host `webserver`、`connection`、app-boot 的 profile 解析）**没有源码改动**，只有版本号。`0.1.4` 因此只改声明与文档。

**rc.1 的新行为（本次唯一实质新增，值得记下）**：boot 增加了插件兼容性预检 `evaluatePluginCompatibility`（`packages/boot/app-boot/src/plugin-compatibility.ts`）。它只检查 `peerDependencies` 里名字为 `@deepseek-ai/dsh` 或以 `@deepseek-ai/dsh-` 开头的项，用 `semver.satisfies(runtime, range, { includePrerelease: true })` 判定；**任何一项不满足就把该插件行直接禁用**（`disabled`），而不是只打警告。因此 peer 范围写对已经从"声明问题"变成"能不能加载"的问题——这正是 `0.1.3` 把下界从 `>=0.1.6-0` 改成 `>=0.1.7-alpha.2` 的现实理由。我们的范围对 rc.1 实测 `true`（node-semver 与市场两套判定都通过），所以无需改动。

**实测验收（2026-09-23，运行实例 0.1.7-rc.1，视口 2056×1027，安装形态为已发布的 `0.1.3` COPY 安装）**：boot 图含 `@idoall/dsh-session-colors` 且未被预检禁用；控制台 `build=host-routes+animated-rows marks route status=ready`；3 个真实标记的色块与行精确对齐——`left=14`（行 `left=12` + 2）、`top`＝行顶 + 8、偏差 0，颜色分别为 `rgb(0,122,255)`、`rgb(52,199,89)`、`rgb(255,204,0)`；选择器正常打开（`role=dialog`、`aria-label=选择会话颜色`、7 个主题色、面板 `right=2048 ≤ 2056` 留在屏内）并按 Esc 关闭。验证过程未改动任何已有标记。

### 验证 DSH 0.1.7-rc.2（2026-09-25，插件 0.1.5）

`0.1.7` 系列的第二个候选版 `0.1.7-rc.2` 发布后，本仓库同样没有新的适配工作。逐包比对 `rc.1 → rc.2` 的官方产物，本插件依赖的契约全部未变：`dsh-client-modules`（客户端加载器）与 `dsh-client-ui-slots`（slot 注册 API）的 `client.js` **逐字节相同**——这两者正是手写 bundle 的全部立足点；`ui-workspace` 的会话行仍是 `data-row-key="session:<id>"` + `role="treeitem"` + `aria-selected`，行几何（`padding-inline-start: calc(8px + var(--dsh-workspace-indent))`、`height:32px`、16×20 前置格、标题外边距）不变，只多了一个 `border-radius` 令牌；`AnimatedRows` 整段**逐字节相同**（`armed` 由列表内首次 `pointerdown`/`keydown` 触发，`element.animate()` 位移 200ms）；`ui-layout` 的 `shell.overlay` 与 `.overlayLayer`（`z-index:20`、`pointer-events:none`、子元素 `auto`）不变；`ui-conversation` 的 `conversation.session.header.utilities` 不变；`ui-sidebar` 的 `--dsh-sidebar-inline-padding:12px` 与区域几何不变；`locale` 的 `register`/`bind` 不变。`app-boot` 的 `evaluatePluginCompatibility` 也**逐字节相同**——rc.2 只把"被跳过的 bundle"从直接写 stderr 改为记入 `skippedBundles`，并新增 `reportSkippedBundles` 一次性上报。

**实测验收（2026-09-25，运行实例 0.1.7-rc.2，视口 2056×1060，安装形态为已发布的 `0.1.4`，其源码与本版逐字节相同）**：浮层 `dataset` 为 `dshScBuild=host-routes+animated-rows`、`dshScStatus=ready`、`dshScMarks=3`、`dshScWritable=true`，父节点 `BODY`、`z=1`、`pointer-events:none`，并按侧栏列表裁剪；3 个真实标记的色块与各自的行偏差为 0（`left=14`＝行 `left=12`+2，`top`＝行顶+8）；折叠工作区触发真实 WAAPI 滑动时，被标记行的 `top` 从 700 经 24 个不同取值滑到 632，色块逐帧跟随，瞬时偏差最大 5px（亚像素取整）随后归零；选择器打开为 `role=dialog`、`aria-label=选择会话颜色`、7 个主题色、5 个输入框、面板 `right=2048 ≤ 2056`，按 Esc 关闭。验证期间未写入任何标记，宿主文件仍是原来那 3 条。

**rc.2 唯一的实质新增：会话行座位。** `ui-workspace` 在 rc.2 声明了两个 `list` 座位——`sidebar.session.row.leading`（会话行标题前那一格，注释写明"the 16px cell before the title that the row's own state dot otherwise occupies"）与 `sidebar.session.row.hover`（悬停卡片中的一段）。会话行的渲染随之改成：`<span class=slot>` 恒定渲染，内部为 `!row.archived && !row.blank && (showStatus ? <SessionStatusDots/> : renderSlot("sidebar.session.row.leading", { sessionId }))`；行内原来的 `ActiveScheduleIndicator` 与 `flatSessionRowWithoutStatus` 类被移除。

**为什么不把色块搬进该座位（记录为产品选择，0.1.5 不实施）**：① 座位与状态点**共用同一格**，而 DSH 的座位文档写明更高优先级的状态会"用那个点替换座位"，即**只有行处于空闲主状态时才挂载占位**；② 已归档行的该格留空。本插件的两条不变量是"色块在任何状态下都可见"与"色块永不盖住状态点"，搬进去会让色块在运行中、等待中、已归档时消失——恰恰是最需要它的场景。浮层方案不受这些状态影响，并已经过 alpha.2 / rc.1 / rc.2 三轮实测。**因此 0.1.5 保持浮层不变，把"是否改用座位、或空闲行用座位而其余用浮层"留作需要明确决策的问题**，不在小版本里擅自改动。

### 为什么选择器注册在 utilities 而不是 actions

标题簇 `titleCluster` 是 `flex: 1 1 0%`，但它**不能收缩到内容以下**。注册在标题旁的 `headerActions` 会让它多出 28px + 4px 间隙；一旦左侧的模式 chip 变宽（例如「标准模式 · 1 个后台任务运行中」），整个簇就会溢出，**压在右侧 `headerUtilities` 上**——移动端实测溢出 102px，色块正好盖住模型下拉框。

`headerUtilities` 是右对齐簇（"Right-aligned Session utilities"），我们是它的**同级 flex 项**，同级不会互相重叠；宽度压力由弹性的标题簇吸收。390px 视口实测：正常 0 碰撞，左侧簇加宽到 200px 仍 0 碰撞且按钮留在行内。

（极窄视口 + 极宽 chip 时整行仍会溢出，那是 DSH 头部布局本身的容量问题，不是控件互相压。）

### 面板在窄屏上的钳位

面板**自己**设 `box-sizing: border-box`（那行 `.dsh-sc-panel *` 只作用于子元素，面板本身仍是 content-box，于是 `width:268px` 实际渲染成 294px）。宽度写成 `min(268px, calc(100vw - 16px))`、高度加 `max-height: calc(100vh - 16px)`，并且定位**按 `getBoundingClientRect()` 实测尺寸**钳位，而不是按名义宽度——按名义宽度算会让面板在移动端被屏幕切掉右边约 26px。未定位前 `visibility: hidden`，避免先在错误位置闪一下。

实测：390px 视口 right=382（距边 8px，溢出 0）；320px 视口 right=312（溢出 0）。

**字段栅格（2026-09-22 修正）**：五个字段原来按 `1.3fr repeat(4,1fr)` 分，实测十六进制输入框 `clientWidth=51` 而 `#FFCC00` 需要 `scrollWidth=58`——面板里显示成 `#FFCC0`，**少一位**。改成 `1.55fr repeat(4,1fr)`、间距 6→4px、输入框左右内边距 4→2px 后，实测 hex `61/61`、R/G/B/A 各 `39/39`，全部不再溢出。回归测试会检查 hex 列必须比数字列宽、且内边距保持 2px。

### 按钮的主题适配

按钮**不写死颜色**：`color: inherit` 继承头部自身文字色，边框/底色用中性半透明 `rgba(128,128,128,.5)` / `rgba(128,128,128,.12)`，色块环 `rgba(128,128,128,.6)`。按钮**不带文字**（未设色显示 🎨，设色后显示该色块），说明放在面板顶部的可见标题「颜色标记」里，避免在深浅两种主题下都要调文字色。回归测试会在源码重新出现 `--dsw-color-text` / `--dsw-color-border` 或 `.dsh-sc-action` 丢掉 `color:inherit` 时失败。

### 存储：插件自己的路由 + 文件（跨设备的关键）

**两次都错了，第三次才对。** 记录全过程，避免后人重踩：

| 方案 | 结果 |
| --- | --- |
| ① 浏览器 `localStorage` | ❌ 每浏览器独立，PC 设的颜色手机永远看不到 |
| ② DSH `settingsScope`（宿主设置段 `ui-session-color`） | ❌ **只在回环页面可用**——局域网/隧道页面拿不到 |
| ③ **插件自己的 HTTP 路由 + 自己目录下的 JSON 文件** | ✅ 不受该限制，局域网可用 |

②失败的确切原因（源码，`@deepseek-ai/dsh-client-ui-settings/lib/client.js`）：

```js
const persistence = ctx.remote.$host.isLoopback ? "host" : "memory"
// ...
status: persistence === "host" ? "loading" : "unavailable"
```

注释原文：`non-loopback pages may remain process-local`。所以用 `10.0.0.30:3082` 打开时 `persistence = "memory"`，scope 状态**永久 `unavailable`**——读不了也写不进。本机 `127.0.0.1` 是回环，一直正常，掩盖了这个问题。

### 现在的实现

| 半边 | 做法 |
| --- | --- |
| 宿主 `src/index.js` | `ctx.inject(['webServer','connection'])` 注册 `GET/POST /plugins/dsh-session-colors/marks`；`dataDir` 由 profile 提供（与 dsh-notify 同款，插件不猜 profile）；原子写 `<dataDir>/session-colors.json`；鉴权走 `connection.requestRejection`，写入另加同源检查 |
| 客户端 `src/client.js` | `fetch(MARKS_ROUTE)` 读、`POST {sessionId, color\|null}` 写；乐观更新 + 失败可见；页面重新可见时与每 20s 重读一次以获取其他设备的改动 |

路由前缀 `ROUTE_PREFIX`（宿主）与 `MARKS_ROUTE`（客户端）必须一致，有测试守着。

dsh-bridge 是**全路径反向代理**：转发时把 `Host`/`Origin` 改写成回环并注入 DSH 认证 cookie（HTTP 与 WebSocket 升级两条路径都改写），所以经局域网进来的请求在 DSH 侧仍是回环，自有路由正常响应。它只缓存二维码与版本探测，不缓存应用响应。

**注意**：宿主半边只在 DSH **启动时**加载，改动它需要重启 `dsh web`；客户端半边刷新页面即热重载。

## 验证路径

1. `npm test`：两个半边的单元测试 + 文档一致性（README 的已验证 DSH 版本必须与 `package.json` 的 `dsh.compatibility.dshReleases` 一致）。
2. 真实浏览器验证用 `/browser-skill`（`bsk`）驱动用户已登录的 Chromium：装入 profile 后打开真实 GUI，实测渲染与几何。
3. 手机端经局域网转发（`dsh-bridge` 的 `:3082`）在真实手机视口上复验。手机抽屉里色块不可见这个问题就是这样定位的：DOM 里色块存在、位置与颜色都正确，但被抽屉的不透明背景盖住；修复后的验证同样是实测（`z=10001`、抽屉打开后色块在 x=14 可见）。
