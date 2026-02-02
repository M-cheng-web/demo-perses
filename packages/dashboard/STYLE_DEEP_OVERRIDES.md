# Dashboard `:deep()` 覆写盘点（2026-02）

目标：减少业务层对组件内部结构的强耦合（`:deep()`），优先通过 **公共组件 API / CSS variables / variant** 来实现样式差异，避免后续“越改越散”与回归成本上升。

> 说明：已处理的项（例如 Button icon-only、Table/Card/Tabs/Cascader 等“去 deep”改造）已从本文清单移除，避免文档越来越长；需要追溯可直接看 git history。

## 当前仍存在的 `:deep()`（现状与建议）

> 说明：这里的 “保留” 不代表永远不改，只是 **不值得立刻上升为公共组件 API** 或者属于“天然是局部特殊布局”的场景。

### 1) 建议保留（更偏“局部/布局/动画”，上升成本高）

- `packages/dashboard/src/components/Dashboard/Dashboard.vue`
  - `:deep(.dp-panel-group-focus-layer)`：用于修正 overlay 与父容器 `> * { position: relative }` 的冲突（布局级别，保留）。
- `packages/dashboard/src/components/PanelGroup/PanelGroupFocusLayer.vue`
  - `:deep(.dp-panel-group-focus-layer__group-panel > .gf-panel__header)`：header “从点击处平滑移动到顶部”的动画（高度特化）。
  - `:deep(.gf-panel__body)`：让 body 成为 column 以固定 pagination（也偏特化）。
- `packages/dashboard/src/components/PanelGroup/PanelGroupList.vue`
  - `:deep(.gf-panel__header)`：聚焦态隐藏 source header（增强“标题浮起/落回”的连续感，特化）。

### 2) 值得考虑上升为公共组件能力（通用、容易复用）

- `Table`：目前已提供 `--gf-table-*` vars（wrap/header/hover/padding/font-size），后续如需更“产品化”可再补 `variant="compact|zebra|plain"` 等语义化配置。
- `Card`：目前已提供 `--gf-card-*` vars（header/body/title），若后续业务反复定制，可考虑提供 `variant="elevated|flat|section"` 等。
- `Cascader/Select/Dropdown`：目前 Cascader 已补 `dropdownMinWidth` 和 size-class 同步，后续如需统一 overlay 密度，可抽象 `overlayClass/overlayStyle`（或统一 Portal + overlay tokens）。
- `Alert`：目前已补 `size`，若需要更完整的 AntD 体验，可考虑 `banner/closable icon slot` 等能力（按需）。

### 3) 可接受但不急（非常局部、可替代性强）

- `Common/DataTable.vue` 的 `:deep(.anticon)`（第三方 icon 节点，影响面较小）。

## 下一步可优化清单（如果你希望继续减少 `:deep()`）

> 这部分是“可选项”，不是强制：当前剩余的 `:deep()` 大多是局部动画/布局类需求，ROI 没前面高。

- [ ] `Panel` 提供更通用的“子部件 class/style 透传”能力（例如 `classNames.header/body`、`styles.header/body`）：可以把 `PanelGroupFocusLayer.vue` / `PanelGroupList.vue` 里对 `.gf-panel__header/.gf-panel__body` 的 `:deep()` 收敛掉（代价是 Panel API 变复杂一点，但通用性很强，类似 AntD 的 `classNames/styles` 思路）。
- [ ] `Dashboard` 的层级/定位规则再收敛：避免全局性的 `> * { position: relative }` 或者给 FocusLayer 一个明确的容器与 stacking-context，让 `.dp-panel-group-focus-layer` 不必依赖 `:deep()` 修正冲突（收益是 overlay 行为更可控）。
- [ ] `Common/DataTable` 的 icon 节点样式“去第三方选择器”：把 icon 统一包到 `.gf-icon`/`GfIcon` 内再做样式，而不是直接对 `.anticon` 做 `:deep()`（收益中等，但能减少第三方实现细节绑定）。
