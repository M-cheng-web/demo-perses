# @grafana-fast/dashboard

可嵌入式 Dashboard 引擎（渲染 + 编辑 + QueryBuilder + JSON 导入/导出），默认使用 `@grafana-fast/component` 作为 UI 基座。

## 安装

```bash
pnpm add @grafana-fast/dashboard
```

Peer dependencies（宿主应用需要提供）：

- `vue`
- `echarts`
- `@ant-design/icons-vue`

## 推荐用法：通过 SDK 挂载（最省心）

仓库内推荐入口在 `@grafana-fast/hooks`：

```ts
import { useDashboardSdk } from '@grafana-fast/hooks';

const sdk = useDashboardSdk(dashboardRef, {
  dashboardId: 'default',
  instanceId: 'my-dashboard-1',
  // apiClient / theme / readOnly 等…
});

sdk.actions.setReadOnly(true);
```

优点：

- 自动处理 pinia 隔离、多实例销毁清理
- 对外提供“命令式 actions + 事件订阅 on/off + getState 快照读取”的稳定 API 面

说明：

- 当前版本 **不支持** 直接挂载 `DashboardView` 组件；请统一使用 `useDashboardSdk(ref, options)`。
- 若误用 `DashboardView`，运行时会给出警告并拒绝加载（渲染错误提示），以避免宿主“半接入半可用”的不一致状态。

## 更多集成说明

查看 `packages/dashboard/INTEGRATION.md`。
