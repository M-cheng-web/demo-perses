# @grafana-fast/component Design Tokens

本组件库以「运维场景」为核心，默认采用低饱和蓝色主调、克制阴影与圆角、清晰层级与留白节奏。所有基础视觉均通过 CSS Variables（Design Tokens）统一管理，便于：

- 统一视觉语言（颜色 / 字体 / 间距 / 阴影 / 动效）
- 快速换肤（通过 `.gf-theme-*` 容器类）
- 组件按语义消费 token（减少魔法数、降低维护成本）

## 1. Token 文件位置

- `packages/component/src/styles/tokens.less`：Design Tokens 定义（CSS Variables）
- `packages/component/src/styles/theme.less`：基础全局样式、通用工具类（依赖 tokens）

组件库入口 `packages/component/src/index.ts` 默认会引入 `theme.less`（进而引入 tokens），无需额外手动引入。

## 2. 主题使用方式

Token 同时挂在 `:root` 和主题容器 `.gf-theme-blue` 上，因此你可以：

- 全局生效：直接使用 `:root`（默认）
- 局部生效：在某个容器上加 `class="gf-theme-blue"`，token 仅在该子树生效

同时提供工业风深色模式，token 挂在：

- `.gf-theme-dark`
- `[data-gf-theme="dark"]`（推荐：用于应用根节点切换）

## 3. 命名规范

推荐消费语义 token（`--gf-color-*` / `--gf-shadow-*` / `--gf-space-*`），避免直接依赖调色板或历史 alias。

- **Primitive / Palette**：`--gf-palette-*`（原子颜色，不直接用于组件）
- **Semantic**：`--gf-color-*`（组件与页面优先使用）
- **System**：`--gf-font-*` `--gf-space-*` `--gf-radius-*` `--gf-shadow-*` `--gf-z-*`
- **Legacy aliases（兼容）**：`--gf-primary` `--gf-surface` 等（保留，逐步迁移）

## 4. 核心语义 Token（节选）

### Colors

- `--gf-color-primary`：主色（蓝）
- `--gf-color-primary-secondary`：次主色（更浅一档，用于次要高亮/导航强调）
- `--gf-color-primary-hover` / `--gf-color-primary-active`：交互态
- `--gf-color-bg`：页面背景
- `--gf-color-surface` / `--gf-color-surface-muted`：容器背景层级
- `--gf-color-text` / `--gf-color-text-secondary`：正文 / 次要文本
- `--gf-color-border` / `--gf-color-border-strong`：边框层级
- `--gf-color-success` / `--gf-color-warning` / `--gf-color-danger`：状态色
- `--gf-color-zebra`：斑马纹底色（极浅冷灰，用于表格/列表行交替背景）

### Industrial Blue（基于 Ant Design 蓝色系的低饱和版本）

以下为 light 模式的主蓝梯度（对应 `packages/component/src/styles/tokens.less`）：

- `--gf-palette-blue-400`：`#4a86dd`（次主色）
- `--gf-palette-blue-500`：`#356fcf`（主色）
- `--gf-palette-blue-600`：`#2d63c0`（hover）
- `--gf-palette-blue-700`：`#2553a6`（active）

语义映射：

- `--gf-color-primary` = `--gf-palette-blue-500`
- `--gf-color-primary-secondary` = `--gf-palette-blue-400`
- `--gf-color-primary-hover` = `--gf-palette-blue-600`
- `--gf-color-primary-active` = `--gf-palette-blue-700`

### Spacing

以 `4px` 为基准：

- `--gf-space-1` = `4px`
- `--gf-space-2` = `8px`
- `--gf-space-3` = `12px`
- `--gf-space-4` = `16px`
- `--gf-space-6` = `24px`

### Shadow

- `--gf-shadow-1`：轻阴影（卡片 / 浮层）
- `--gf-shadow-2`：强调阴影（Modal / Drawer）

### Motion

- `--gf-motion-fast` / `--gf-motion-normal`
- `--gf-easing`

## 5. 迁移建议

- 新组件优先使用 `--gf-color-*` 等语义 token
- 老组件允许继续使用 `--gf-primary` / `--gf-border` 等 alias；当需要统一调整视觉时，优先下沉到 token 里统一调参

## 6. Ant Design Token（TS / JSON）

为了兼容 Ant Design / Ant Design Vue 的 `ConfigProvider theme.token` 生态，这里提供了一份「AntD Token Key → gf CSS Variables」的映射清单：

- TS：`packages/component/src/theme/antdTokens.ts`
- JSON：`packages/component/src/theme/antdTokens.cssvar.json`

组件库入口已导出：

- `gfAntdTokensCssVar`
- `gfAntdTokensCssVarJson`
