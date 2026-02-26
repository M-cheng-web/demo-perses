# @grafana-fast/component

grafana-fast 的 UI 组件库（Vue 3）。

该包面向 dashboard runtime 的通用 UI 需求（表单、弹出层、布局组件等），并尽量避免引入宿主应用的全局副作用，便于「多实例同页嵌入」。

## Installation

```bash
pnpm add @grafana-fast/component
```

## Theme / Design Tokens

组件库的基础视觉（颜色 / 字体 / 间距 / 阴影 / 动效）统一由 CSS Variables（Design Tokens）管理：

- Tokens 定义：`packages/component/src/styles/tokens.less`
- 基础样式：`packages/component/src/styles/theme.less`（组件库入口会自动引入）

主题容器（推荐做“局部挂载”，避免污染宿主）：

- `.gf-theme-light` / `.gf-theme-dark`
- 或 `[data-gf-theme="light" | "dark"]`

## AntD Tokens（可选）

为了兼容 Ant Design / Ant Design Vue 的 token key 生态，组件库额外导出一份 “AntD Token Key → gf CSS Variables” 的映射：

- `gfAntdTokensCssVar`
- `gfAntdTokensCssVarJson`

## License

MIT
