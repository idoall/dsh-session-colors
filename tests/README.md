# 测试入口

```sh
npm test        # 等价于 node --test tests/*.test.mjs，39 项
```

仓库只有这一套测试，覆盖当前插件；不保留已废弃的置顶会话方案。

## 覆盖

| 文件 | 覆盖 |
| --- | --- |
| [plugin-client.test.mjs](plugin-client.test.mjs) | 30 项。Host/Client bundle、两个槽位、缺槽位降级、模拟 Host 路由与跨设备收敛、失败状态、行身份读取、颜色换算、几何与层叠、portal、动画跟随，以及 alpha.3 原生抽屉属性变化在无 transition 事件时触发重新测量。 |
| [docs.test.mjs](docs.test.mjs) | 9 项。文档目录、双语 Release 锚点、本地链接、双语 README 版本与 manifest 一致性、预发布版本范围、Demo 静态检查和截图格式。 |

浏览器半边通过 `node:vm` 执行手写 bundle，提供 React / ReactDOM 与 DOM 替身；Host 半边按路径导入。没有构建步骤。

## 边界

- 单元测试不等于真实 GUI 验收，不证明真实像素位置、跨设备网络或真实 Session/Workspace 操作成功。
- 原生抽屉测试执行组件 effect 与 MutationObserver 回调，确认三个框架属性触发测量和有界跟随；不是浏览器布局测试。
- 真实 GUI 验证须使用已认证的浏览器；认证不可用时明确记录限制，不绕过鉴权。
- 工作边界见 [AGENTS.md](../AGENTS.md)，设计记录见 [plugin-design.zh.md](../docs/plugin-design.zh.md)。
