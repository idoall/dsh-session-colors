# 测试入口

```sh
npm test        # 等价于 node --test tests/*.test.mjs，34 项
```

仓库里只有这一套测试，覆盖的是**现在发货的插件**。已废弃的"置顶会话"线连同它的测试材料一起删掉了，不保留第二套规格或第二套测试。

## 覆盖

| 文件 | 覆盖 |
| --- | --- |
| [plugin-client.test.mjs](plugin-client.test.mjs) | 26 项。浏览器半边与宿主半边：bundle 结构、两个 seat、缺 slot 降级、Host 路由存储与跨设备收敛、失败可见、坏数据忽略、fiber 取 session id（含环终止）、颜色换算、色块几何与层叠层级、portal、手机抽屉跟随、hex 字段宽度、路由前缀一致性、宿主半边的各种降级形状 |
| [docs.test.mjs](docs.test.mjs) | 8 项。文档与静态资产：`docs/` 只放设计记录与图片、全部本地 Markdown 链接与锚点可达（含 HTML img 的 src 属性）、两个 README 互相链接并写明安装、两个 README 的兼容性版本与 `package.json` 的 `dsh.compatibility.dshReleases` 逐字一致、三张 README 截图是尺寸正确的真 PNG、[Demo](../demos/session-color-mark-demo.html) 的静态卫生（单一 inline script、id 唯一、无外部引用） |

浏览器半边的测试用 `node:vm` 按 DSH 客户端加载器的方式执行手写 bundle，`require` 只提供 `react` 与 `react-dom`；宿主半边按路径 import。没有构建步骤，也没有测试依赖需要安装。

## 边界

- 单元测试**不是**真实 GUI 验收：不验证像素布局、真实宿主事件、真实 Session/Workspace 数据。
- 真实浏览器验证用 `/browser-skill`（`bsk`）驱动用户已登录的 Chromium；本仓库不安装 Playwright。
- 工作边界与不变量见 [AGENTS.md](../AGENTS.md)，设计记录见 [plugin-design.zh.md](../docs/plugin-design.zh.md)。
