# @grafana-fast/hooks

组合式 SDK，用于驱动 `@grafana-fast/component` 提供的 Dashboard。

```bash
pnpm add @grafana-fast/hooks
```

```ts
import { ref } from 'vue';
import { useDashboardSdk } from '@grafana-fast/hooks';

const container = ref<HTMLElement | null>(null);
const { state, actions } = useDashboardSdk(container, { dashboardId: 'default' });
```

返回的 `state` 包含 dashboard、panelGroups、viewPanel、timeRange、tooltip 等关键数据，`actions` 则封装了增删改查、时间范围、Tooltip 注册等能力。
