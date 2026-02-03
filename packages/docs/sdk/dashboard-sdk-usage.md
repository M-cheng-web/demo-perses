# Dashboard SDK 使用说明

本项目的 `useDashboardSdk` 采用 **“命令式（Command In）+ 事件总线（Event Out）+ 快照拉取（Snapshot Pull）”** 的集成模型，目标是：

- **强隔离**：宿主拿不到内部 store / ref / reactive 对象的引用，无法“改变量”影响内部。
- **可控变更**：宿主若要修改内部，只能调用 `actions.*`（命令式 API）。
- **可观测**：宿主若要监听变化，只能通过 `on/off` 订阅事件。

> 设计原则：**内部不 watch 外部入参来驱动业务**；外部如果想影响内部，应显式调用命令方法。

---

## 快速开始（推荐写法：解构 + 订阅）

```ts
import { onUnmounted, ref } from 'vue';
import { useDashboardSdk, DashboardApi } from '@grafana-fast/hooks';

const containerRef = ref<HTMLElement | null>(null);

const { on, getState, getApiConfig, actions } = useDashboardSdk(containerRef, {
  instanceId: 'my-dashboard-1', // 多实例时务必唯一且稳定
  // dashboardId 是“资源标识”（不在导出的 JSON 里），用于后端定位这份 Dashboard 内容
  dashboardId: 'default',
  apiConfig: {
    baseUrl: 'https://api.example.com',
    endpoints: {
      [DashboardApi.ExecuteQueries]: '/custom/execute',
    },
  },
  onError: (err) => console.error('[dashboard-sdk] error:', err),
});

// 读取：拿到“快照”（mutation-safe）
const state = ref(getState());

// 监听：通过事件总线订阅变化
const unsubscribe = on('change', ({ state: next }) => {
  state.value = next;
});

onUnmounted(() => unsubscribe());

// 修改：只能通过 actions（命令式 API）
actions.setReadOnly(true);
```

说明：

- `getState()` 返回的是 **快照**，外部修改这个对象不会影响内部。
- `on('change')` 用于监听变化；`on` 会返回一个 `unsubscribe()`，组件卸载时记得调用。
- `actions.*` 是**唯一被支持**的“外部修改内部”的方式。
- 若 `dashboardId` 需要从业务接口异步获取，建议使用 `autoLoad: false`，拿到 id 后再 `actions.loadDashboard(dashboardId)`；详见 `/sdk/dashboard-sdk-plan-a`。

---

## 状态读取：`getState()` vs `getDashboardSnapshot()`

SDK 提供两类读取方式：

- `getState()`：轻量状态快照（适合频繁读取/渲染 UI）
  - 包含容器尺寸、主题、只读开关、viewMode、timeRange、加载/保存状态等
  - `state.dashboard` 只提供摘要（id/name/groupCount/panelCount）
    - 其中 `id` 指的是 `dashboardId`（资源标识），不是 Dashboard JSON 的字段
  - 通过 `state.dashboardRevision` 反映 dashboard JSON 是否发生变化（单调递增）
- `getDashboardSnapshot()`：深拷贝后的 dashboard JSON（可能很大，**不要在每次 change 都调用**）
  - 返回的是 `DashboardContent`（纯内容），不包含 `dashboardId`

推荐策略：

- 平时 UI 只用 `getState()`（或 `change.payload.state`）。
- 当你确实需要 dashboard 全量 JSON 时：
  - 只在 `payload.dashboardChanged === true` 或 `payload.changedKeys` 包含 `dashboardRevision` 时，再调用 `getDashboardSnapshot()`。

---

## 事件总线：为什么只保留少量事件？

SDK 目前对外只保留两类事件：

- `change`：统一的“状态变化”事件（带 diff 信息，方便宿主侧自行筛选）
- `error`：错误事件（SDK/内部 store 抛错会触发）

这样做的目的：

- 避免“事件过细导致宿主接入复杂、维护成本高”。
- 通过 `change.payload.changedKeys` + `dashboardChanged`，宿主可以自由组合成自己需要的订阅粒度。

### `change` payload 结构

```ts
type DashboardSdkChangePayload = {
  at: number;
  state: DashboardSdkStateSnapshot;
  prevState: DashboardSdkStateSnapshot | null;
  changedKeys: Array<keyof DashboardSdkStateSnapshot>;
  dashboardChanged: boolean;
}
```

使用示例（按变化 key 过滤）：

```ts
on('change', ({ changedKeys, state }) => {
  if (changedKeys.includes('containerSize')) {
    // 处理尺寸变化
  }
  if (changedKeys.includes('timeRange')) {
    // 处理时间范围变化
  }
  if (changedKeys.includes('dashboardRevision')) {
    // dashboard JSON 变化：如确需全量，再去拉 getDashboardSnapshot()
  }
});
```

---

## 命令式 API：宿主如何控制内部？

宿主只能通过 `actions.*` 修改内部（部分常用示例）：

- 生命周期/挂载：
  - `actions.mountDashboard()` / `actions.unmountDashboard()`
- Dashboard 数据：
  - `actions.loadDashboard(dashboardId)`
  - `actions.saveDashboard()`
  - `actions.setDashboard(dashboardContent, { markAsSynced? })`
- 能力开关：
  - `actions.setReadOnly(true/false)`
- 时间范围：
  - `actions.setTimeRange({ from, to })`
  - `actions.setRefreshInterval(ms)`
  - `actions.refreshTimeRange()`
- 主题：
  - `actions.setTheme('light' | 'dark')`
  - `actions.setThemePreference('light' | 'dark' | 'system')`
- UI 辅助（依赖组件已挂载）：
  - `actions.openSettings()` / `actions.closeSettings()`
  - `actions.toolbar.openJsonModal()` / `actions.toolbar.viewJson()` 等

> 建议：宿主侧把 `actions` 当作“命令总线”；不要尝试通过 props 或直接改内部对象来驱动 dashboard。

---

## 最佳实践与注意事项

- **把快照当作只读**：不要在 `change` 回调里 mutate `payload.state`，即便不会影响内部，也容易导致宿主自身逻辑混乱。
- **避免重操作写在高频 change 里**：例如每次 change 都 stringify dashboard；用 `dashboardChanged`/`dashboardRevision` 做过滤，必要时再 debounce。
- **多实例一定要传 `instanceId`**：否则本地持久化/调度器 scope 等可能互相干扰。
- **订阅要记得清理**：用 `const off = on(...); onUnmounted(off)` 这种写法最简单。
