# Dashboard JSON（schemaVersion + migration）

Dashboard 支持通过复制/粘贴 JSON 导入导出。为避免未来结构升级导致旧 JSON 报废，引入：

- `schemaVersion`：每份 Dashboard JSON 的结构版本
- `migrateDashboard()`：导入时将旧版本 JSON 迁移到当前版本

## 设计目标

- v1 JSON 在 v2/v3 仍可导入
- 不要求与 Grafana/Perses JSON 兼容（内部迁移优先）
- 未注册的面板类型不丢失：使用 `UnsupportedPanel` 占位并保留原始 options

## 使用建议

导入时：

```ts
import { migrateDashboard } from '@grafana-fast/types';

const normalized = migrateDashboard(JSON.parse(rawJson));
```

导出时：

- 建议直接导出 store 中的 `currentDashboard`（已是当前 schema）

