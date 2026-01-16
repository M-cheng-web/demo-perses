# Panels 插件化（Panel Registry）

面板插件化的目的不是破坏 JSON 通用性，而是让扩展更可控：

- JSON 只声明 `panel.type`
- 运行时通过 registry 找到对应渲染器
- 未找到时使用 `UnsupportedPanel` 占位（不丢信息）

## 基础用法

```ts
import { PanelPlugins } from '@grafana-fast/panels';

const registry = PanelPlugins
  .all()                 // 内置全部
  .exclude(['heatmap'])  // 排除部分类型
  .build();
```

然后将 `registry` 传给 SDK：

```ts
useDashboardSdk(container, { panelRegistry: registry });
```

## 未注册面板类型（宽松模式）

当 JSON 中出现未注册的 `panel.type` 时：

- UI 展示 `UnsupportedPanel`
- 提示 “缺少插件：xxx”
- 展示并可复制原始 `options` JSON
- 面板数据仍保留在 Dashboard 结构中（安装插件后可恢复）

