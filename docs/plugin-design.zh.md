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
| `tests/plugin-client.test.mjs` | 26 项：bundle 结构、两个 seat、缺 slot 降级、按 Host/Session 分键、清除、快照引用稳定、未解析 Host 不落盘、坏数据忽略、fiber 取 id（含环终止）、颜色换算、色块几何、层叠层级、portal、手机抽屉跟随、hex 字段宽度、Host 半边、包名/挂载一致性 |
| `tests/docs.test.mjs` | 8 项：`docs/` 只放设计记录与图片、全部本地 Markdown 链接与锚点可达、两个 README 互相链接并写明安装、两个 README 的兼容性版本与 `dsh.compatibility.dshReleases` 逐字一致、三张 README 截图的签名与尺寸、Demo 的静态卫生（单一 inline script、id 唯一、无外部引用） |

### 两个界面，都走公开 slot

| 界面 | slot | 说明 |
| --- | --- | --- |
| 颜色选择器 | `conversation.session.header.utilities` | 系统风格面板：大色板、色相、透明度、HEX/RGBA、主题色、我的颜色、吸色（`EyeDropper`）。注册在**右对齐 utilities** 而不是标题旁的 actions，原因见下 |
| 行内色块 | `shell.overlay` | 框架级浮层，**默认点击穿透**，官方文档称其为"你自己的框架级界面的增量座位" |

**没有修改任何自带文件，没有 DOM 补丁。**

### 行内色块怎么定位（这是唯一有耦合的部分）

alpha.2 没有会话行 slot，行的 DOM 也**不暴露 session id**（实测：侧栏 24 个会话行，全侧栏 0 个带 id 形态值的属性）。所以浮层靠两件事对齐：

1. `[role="treeitem"][aria-selected]` 找到渲染出来的会话行（ARIA，非哈希类名）；
2. 从行的 React fiber 读 `memoizedProps.node.id` 拿**精确** session id（实测可得，如 `session-0698599a-418…`）。

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
