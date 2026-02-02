# Dashboard 集成指南（面向宿主应用）

本指南以 **嵌入式（embedded-first）** 为前提，帮助你把 `@grafana-fast/dashboard` 安全地集成到任意宿主应用中。

> 不涉及后端接口对接（apiClient 由宿主自行实现/注入）。

## 1. 最小集成（推荐：useDashboardSdk）

如果你希望快速落地、并且需要“同页多实例隔离 + 自动清理”，推荐直接使用：

- `@grafana-fast/hooks` 的 `useDashboardSdk`

它会负责：

- Pinia 实例隔离（默认 isolate）
- apiClient 注入到 runtime
- Dashboard mount / unmount 生命周期

## 2. 直接使用组件（DashboardView）

### 必须的 props

- `instanceId`：Dashboard 实例唯一 ID（同页多实例隔离的关键）

### 常用能力开关

- `theme`：`light | dark`

> 说明：`readOnly`（全局只读能力）不再通过 DashboardView props 驱动。
> 推荐由宿主通过 SDK/store 命令式控制（例如 `useDashboardSdk().actions.setReadOnly(true)`）。

### Portal（Teleport 挂载点）

Dashboard 内部大量浮层组件使用 Teleport（Modal/Drawer/Dropdown/Select/Tooltip/Popconfirm…）。

你可以通过 `portalTarget` 指定 Teleport 的挂载点：

- 默认：挂到 `body`（更接近 AntD 的行为，浮层定位最稳）
- 嵌入式建议：挂到 dashboard 容器或宿主提供的容器（便于销毁、减少全局副作用）

示例：

```vue
<template>
  <div ref="hostEl" style="width: 100%; height: 100%">
    <DashboardView
      :instanceId="'demo-1'"
      theme="light"
      :portalTarget="hostEl"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { DashboardView } from '@grafana-fast/dashboard';

  const hostEl = ref<HTMLElement | null>(null);
</script>
```

注意事项：

- `portalTarget` 可能会影响 `position: fixed` 的包含块行为（当宿主容器/祖先存在 transform/filter 时）；若遇到定位异常，建议回退到 `body`。
- 如果你希望跟随宿主主题，建议由宿主统一控制主题，并把 Dashboard `theme` 映射为宿主当前的 `light/dark`。
- `portalTarget` 也会影响 `message` 的挂载点（会优先挂到 `.gf-portal-root`，确保继承主题 token）。

## 3. 主题策略（不污染宿主）

`@grafana-fast/component` 的主题 token 默认挂在：

- `.gf-theme-light` / `.gf-theme-dark`（`.gf-theme-blue` 为兼容别名）
- `[data-gf-theme="light" | "dark"]`

不会自动改写宿主的 `html/body`，以避免“嵌入式污染”。

建议：

- 宿主应用想全站接管主题：由宿主自己决定把 `data-gf-theme` 放在哪（documentElement 或局部容器）。
- 只想让 dashboard 自己切换：直接使用 DashboardView 的 `theme` / SDK 的 `themePreference`。

## 4. 销毁与清理（多实例场景）

如果你使用 `useDashboardSdk`：

- SDK 会在 unmount 时尝试停止 auto refresh、dispose scheduler（isolate 场景）

如果你直接用组件：

- 需要宿主自己控制组件卸载
- 推荐为每个实例都提供稳定 `instanceId`

## 5. 发布形态 smoke test（dist）

本仓库本地开发默认走源码 alias。建议定期验证 “真实发布形态”：

```bash
pnpm build
GF_USE_DIST=1 pnpm -C packages/app dev
```
