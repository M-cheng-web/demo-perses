# @grafana-fast/hooks

组合式 SDK，用于驱动 `@grafana-fast/component` 提供的 Dashboard。

```bash
pnpm add @grafana-fast/hooks
```

```ts
import { ref } from 'vue';
import { useDashboardSdk } from '@grafana-fast/hooks';

const container = ref<HTMLElement | null>(null);
const getDashboardSessionKey = async () => {
  // 真实场景：调用你的业务接口，根据上下文参数换取 sessionKey
  // demo/mock：直接用 mock apiClient 模拟“后端签发 sessionKey”
  const { createMockApiClient } = await import('@grafana-fast/api/mock');
  const api = createMockApiClient();
  const res = await api.dashboard.resolveDashboardSession({ params: { dashboardKey: 'default' } });
  return res.dashboardSessionKey;
};

const { on, getState, actions } = useDashboardSdk(container, {
  getDashboardSessionKey,
  // 本地开发/演示可开启 mock；生产建议直接提供 apiClient（remote）
  enableMock: true,
  defaultApiMode: 'mock',
  createMockApiClient: async () => (await import('@grafana-fast/api/mock')).createMockApiClient(),
});

// 读取：拿到一个“可安全修改的快照”（外部改不会影响内部）
const state = getState();

// 监听：通过事件总线订阅变化
const unsubscribe = on('change', ({ state }) => {
  console.log('state changed:', state);
});

// 修改：宿主变更内部的唯一支持方式（命令式）
actions.setReadOnly(true);
```

SDK 不再直接暴露可被外部改写的响应式状态引用：

- 读取状态：使用 `getState()`（返回快照，外部修改不会影响内部）
- 监听变化：使用 `on/off` 事件总线（例如 `change` / `error`）
- 修改内部：仅允许通过 `actions.*`（命令式 API）

更多接入细节与最佳实践见：`packages/docs/sdk/dashboard-sdk-usage.md`。
