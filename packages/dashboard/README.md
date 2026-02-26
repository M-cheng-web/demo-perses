# @grafana-fast/dashboard

可嵌入式 Dashboard 引擎（渲染 + 编辑 + QueryBuilder + JSON 导入/导出）。

UI 基座默认使用 `@grafana-fast/component`（CSS Variables 主题，不污染宿主），并以 **embedded-first** 为前提：优先支持“在任意宿主应用里以 SDK 方式挂载”的集成形态。

## Installation

```bash
pnpm add @grafana-fast/dashboard @grafana-fast/hooks
```

> 推荐宿主通过 `@grafana-fast/hooks` 的 `useDashboardSdk` 挂载（SDK-only：当前唯一支持方式）。

## Peer Dependencies

宿主应用需要提供（peer deps）：

- `vue`
- `echarts`
- `@ant-design/icons-vue`

## 集成指南（面向宿主应用）

### 1) 实现 `getDashboardSessionKey`（必需）

Dashboard 的资源定位采用短期会话 key：`dashboardSessionKey`（真实 `dashboardId` 不对前端暴露）。

宿主需要提供一个函数：进入/切换业务上下文时，向你的后端换取 `dashboardSessionKey`。

- 接口约定见根目录：`API_REQUIREMENTS.md`

```ts
const getDashboardSessionKey = async () => {
  const res = await fetch('/api/dashboards/session/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params: { projectId: 'p-1' } }),
  });
  const json = await res.json();
  return json.dashboardSessionKey as string;
};
```

### 2) 通过 SDK 挂载（推荐且唯一支持方式）

```ts
import { ref } from 'vue';
import { useDashboardSdk } from '@grafana-fast/hooks';

const dashboardRef = ref<HTMLElement | null>(null);

const sdk = useDashboardSdk(dashboardRef, {
  getDashboardSessionKey,
  instanceId: 'my-dashboard-1',
  // 推荐：宿主注入 remote apiClient（实现 API_REQUIREMENTS.md 里的接口）
  // apiClient: yourRemoteApiClient,
  //
  // 本地开发可选：启用 mock（参考 packages/app）
  // enableMock: true,
  // defaultApiMode: 'mock',
  // createMockApiClient: async () => (await import('@grafana-fast/api/mock')).createMockApiClient(),
});

sdk.actions.setReadOnly(true);
```

说明：

- 当前版本 **不支持** 直接渲染 `DashboardView` 组件；请统一使用 `useDashboardSdk(ref, options)`（SDK 负责 pinia 隔离、mount/unmount 与清理）。
- 外部“读取状态 / 订阅变化 / 修改内部”的推荐方式：
  - 读取：`sdk.getState()`（返回快照，外部改不会影响内部）
  - 订阅：`sdk.on/off`（事件总线：`change` / `error` 等）
  - 修改：`sdk.actions.*`（命令式 API）

### 3) 主题/样式策略（不污染宿主）

`@grafana-fast/component` 的 design tokens 通过 CSS Variables 提供，挂载在：

- `.gf-theme-light` / `.gf-theme-dark`
- 或 `[data-gf-theme="light" | "dark"]`（推荐）

宿主可选择在 dashboard 容器外层设置主题属性，实现“局部生效”而不改写 `html/body`。

### 4) 多实例与销毁（多 Dashboard 同页）

- 多实例同页：为每个实例提供不同的 `instanceId`，并使用独立的容器 ref。
- 组件 unmount 时 SDK 会自动做销毁清理（auto refresh / scheduler / isolate pinia 等）。

### 5) 本仓库示例（参考 app 如何接入）

- `packages/app/src/views/DashboardView.vue`：标准接入（`getDashboardSessionKey` + mock apiClient）
- `packages/app/src/views/PerformanceView.vue`：性能/大盘场景回归

### 6) 发布形态 smoke test（dist）

本仓库本地开发默认走源码 alias。建议定期验证“真实发布形态”（走 `dist` + `exports`）：

```bash
pnpm build
GF_USE_DIST=1 pnpm -C packages/app dev
```

## Mock / Fixtures（可选）

`packages/dashboard/mock/` 提供 JSON fixtures 生成脚本，用于压测 “导入 JSON” 等极端场景：

```bash
node packages/dashboard/mock/generate-fixtures.mjs
# GF_GENERATE_HUGE_FIXTURES=1 node packages/dashboard/mock/generate-fixtures.mjs
```
