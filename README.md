# @grafana-fast/monorepo

原 `demo-perses` 项目已重构为 pnpm monorepo，提供可复用的 Dashboard 组件、对外 SDK hooks、类型包、文档与示例站点。

## ✨ 主要功能

### 📊 图表类型
- 时间序列图 (TimeSeries)
- 柱状图 (Bar Chart)
- 饼图 (Pie Chart)
- 仪表盘 (Gauge)
- 热力图 (Heatmap)
- 统计面板 (Stat Panel)
- 表格 (Table)

### 🔍 QueryBuilder 查询构建器（新增）
- **可视化查询构建**：无需了解 PromQL 语法即可构建复杂查询
- **70+ 种操作**：聚合、范围函数、数学函数、三角函数、时间函数等
- **智能提示**：自动分析查询并给出优化建议
- **查询解释**：步骤化展示查询构建过程
- **快速开始**：10+ 种预设查询模板
- **二元查询**：支持查询间的算术和比较运算
- **双模式**：可视化构建或手动输入 PromQL

### 🎨 面板编辑器
- 拖拽式布局调整
- 实时预览
- 丰富的样式配置选项
- 支持 QueryBuilder 和手动 PromQL 两种查询方式
- JSON 编辑模式

### 📈 仪表板功能
- 多面板组管理
- 面板分组折叠/展开
- 全局时间范围控制
- 自动刷新
- 响应式布局

## 🚀 快速开始

```bash
pnpm install
pnpm dev                # 运行演示站点（packages/app）
pnpm run build:packages # 构建 types -> component -> hooks
pnpm run docs:dev       # 打开 VitePress 文档
```

演示站点默认运行在 http://localhost:5173 ，文档运行在 http://localhost:4173 。

## 📁 项目结构

```
demo-perses/
├── packages/
│   ├── app/         # 演示站点（消费组件与 hooks）
│   ├── component/   # 对外发布的 Dashboard 组件包 @grafana-fast/component
│   ├── hook/        # SDK hooks 包 @grafana-fast/hooks
│   ├── types/       # 类型包 @grafana-fast/types
│   └── docs/        # VitePress 文档
├── scripts/         # 打包/发布辅助脚本（参考 morehook 的 build/publish）
├── tsconfig.base.json  # 统一别名与编译配置，提供 /#/ 与 @grafana-fast/* 路径
├── pnpm-workspace.yaml
└── README.md
```

别名说明：

- `/#/`：指向组件包源码，支持在包内使用绝对路径（例如 `/#/utils/index.ts`）。  
- `@grafana-fast/component` / `@grafana-fast/hooks` / `@grafana-fast/types`：工作区内的各子包入口。

## 📚 使用文档

### QueryBuilder 使用指南

详细的 QueryBuilder 使用指南请查看：[QUERYBUILDER_GUIDE.md](./QUERYBUILDER_GUIDE.md)

主要功能：
1. **指标选择**：从 Prometheus 指标列表中选择或搜索
2. **标签过滤**：添加标签过滤条件（=, !=, =~, !~）
3. **操作管理**：添加聚合、函数等操作，支持拖拽排序
4. **查询预览**：实时查看生成的 PromQL
5. **快速开始**：使用预设模板快速构建查询
6. **查询提示**：获取智能优化建议

### QueryBuilder 移植说明

完整的移植文档请查看：[QUERYBUILDER_MIGRATION.md](./QUERYBUILDER_MIGRATION.md)

### 创建面板

1. 在仪表板页面点击"添加面板"
2. 选择图表类型
3. 在"数据查询"Tab中配置查询：
   - 切换到 QueryBuilder 模式进行可视化构建
   - 或使用 PromQL 模式直接输入表达式
4. 在"图表样式"Tab中配置图表样式
5. 点击"保存"

### QueryBuilder 模式示例

**计算 CPU 使用率**：
```
1. 选择指标: node_cpu_seconds_total
2. 添加标签: mode = "idle"
3. 添加操作:
   - rate [5m]
   - sum by (instance)
4. 执行查询
```

**计算错误率**：
```
1. 选择快速开始模板: "Error Rate"
2. 第一个查询选择: http_requests_total, status=~"5.."
3. 第二个查询选择: http_requests_total
4. 执行查询
```

## 🛠️ 技术栈

- **框架**: Vue 3.5 + TypeScript
- **UI 库**: Ant Design Vue 4.x
- **图表库**: ECharts 6.0
- **状态管理**: Pinia 3.0
- **路由**: Vue Router 4.x
- **构建工具**: Vite 7.x
- **样式**: Less
- **其他**: 
  - vue-grid-layout-v3 (拖拽布局)
  - vuedraggable (拖拽排序)
  - dayjs (时间处理)
  - axios (HTTP 请求)

## 📝 开发说明

### 代码规范

项目使用 ESLint + Prettier 进行代码规范检查和格式化。

```bash
# 检查/修复
pnpm lint

# 格式化
pnpm format
```

### 添加新的图表类型

1. 在 `packages/component/src/enums/panelType.ts` 中添加新类型
2. 在 `packages/component/src/components/Charts/` 中创建新的图表组件
3. 在 `packages/component/src/components/PanelEditor/ChartStyles/` 中创建样式配置组件
4. 在 `PanelEditorDrawer.vue` 中注册新组件

### 自定义 QueryBuilder 操作

在 `packages/component/src/components/QueryBuilder/lib/operations.ts` 中添加新的操作定义：

```typescript
{
  id: 'my_custom_operation',
  name: 'My Custom Operation',
  params: [
    { name: 'Parameter', type: 'number' }
  ],
  defaultParams: [1],
  category: PromVisualQueryOperationCategory.Functions,
  renderer: functionRendererLeft,
  addOperationHandler: defaultAddOperationHandler,
  explainHandler: (op) => `Custom operation with param ${op.params[0]}`,
}
```

## 🔌 对接真实 Prometheus

当前项目使用 mock 数据。要对接真实的 Prometheus API：

1. 修改 `packages/component/src/api/querybuilder/prometheusApi.ts`
2. 将模拟函数替换为真实的 API 调用：

```typescript
export async function fetchMetrics(search?: string): Promise<string[]> {
  const response = await fetch('http://your-prometheus:9090/api/v1/label/__name__/values');
  const data = await response.json();
  return data.data;
}
```

3. 或者修改 `packages/component/src/api/prometheus.ts` 中的查询函数

## 🎯 功能特性

### 已实现
- ✅ 多种图表类型支持
- ✅ 可视化 QueryBuilder
- ✅ 拖拽式面板布局
- ✅ 面板编辑器
- ✅ 时间范围控制
- ✅ 自动刷新
- ✅ 响应式设计
- ✅ 图例交互（显示/隐藏系列）
- ✅ 数据格式化
- ✅ 主题配置

### 开发中
- 🚧 查询历史记录
- 🚧 仪表板导入/导出
- 🚧 用户权限管理

## 📄 License

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

如有问题或建议，请提交 Issue。
