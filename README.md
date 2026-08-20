<div align="center">

# opencode-glm-status

**OpenCode TUI 插件：在输入框右侧内联显示智谱 GLM Coding Plan 配额**

Show your Zhipu / GLM / Z.ai Coding Plan quota right next to the prompt input bar.

</div>

## 效果预览 / Preview

```
> 请输入你的问题…                                 GLM ████████░░ 69% ↻14:00 MCP 100 [lite]
```

- `5h token`：5 小时滚动 token 窗口剩余比例（进度条，低额度变黄/红）
- `↻14:00`：下一次配额重置时间
- `MCP 100`：本月 MCP 工具调用剩余次数
- `[lite]`：账号套餐等级

每 30 秒自动刷新，并在每次回复完成时立即刷新。

## 安装 / Installation

在 `~/.config/opencode/tui.json`（无则新建）的 `plugin` 数组添加一行：

```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-glm-status"]
}
```

重启 opencode 即生效（opencode 会用 Bun 自动安装 npm 包，无需手动装依赖）。

## 前置条件 / Prerequisites

- opencode ≥ 1.17（TUI 插件插槽 API）
- 已配置智谱 GLM Coding Plan 账号，凭据存放在以下任一位置：
  - `~/.local/share/opencode/auth.json`（推荐，`opencode auth` 添加）
  - opencode provider 配置（`options.apiKey`）
- 支持平台自动识别：
  - 智谱开放平台（国内）：`open.bigmodel.cn`
  - Z.ai（国际）：`api.z.ai`

## 工作原理 / How it works

1. 从 opencode 认证信息中发现智谱 provider 及 API key（不读取环境变量，仅本机凭据）
2. 直接请求智谱官方监控接口 `/api/monitor/usage/quota/limit`
3. 渲染到 TUI `session_prompt_right` 插槽（输入框右侧）

你的 API key 仅用于请求智谱官方接口，不会被上传到任何第三方服务。

## 常见问题 / FAQ

**Q: 什么都不显示？**
检查 `tui.json` 配置是否正确，并确认已通过 `opencode auth` 添加智谱 Coding Plan 账号（provider id 含 `zhipu` / `zai` / `bigmodel`，或 baseURL 指向 `open.bigmodel.cn` / `api.z.ai`）。

**Q: 显示 `GLM ?`？**
插件未能在本机找到智谱凭据或请求失败，查看 opencode 日志（`~/.local/share/opencode/log/`）定位。

**Q: 用的是国内站还是国际站？**
自动识别。若你的 key 来自 Z.ai，插件会请求 `api.z.ai`；来自智谱开放平台则请求 `open.bigmodel.cn`。

## 卸载 / Uninstall

从 `tui.json` 移除 `"opencode-glm-status"` 并重启 opencode 即可。

## 从源码构建 / Build from source

```bash
npm install
bun run build   # 产出 dist/tui.js + dist/index.js（需 bun ≥ 1.3）
```

> 注意：npm 包入口是编译后的 `dist/*.js`（solid 编译产物），不要把 `exports` 改指向 `src/*.tsx`——opencode 的 Bun 运行时不转译 node_modules 内的 TSX，且 `@opentui/solid` 0.3.x 无 jsx-runtime 实现，直接发布源码会导致插件静默加载失败。

## License

MIT
