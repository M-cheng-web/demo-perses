/**
 * 组件统一导出
 */

// Dashboard 相关组件
export { default as Dashboard } from './dashboard/Dashboard/Dashboard.vue';
export { default as DashboardToolbar } from './dashboard/Dashboard/DashboardToolbar.vue';
export { default as GridLayout } from './dashboard/GridLayout/GridLayout.vue';

// Panel 相关组件
export { default as Panel } from './panel/Panel/Panel.vue';
export { default as PanelContent } from './panel/Panel/PanelContent.vue';
export { default as PanelFullscreenModal } from './panel/Panel/PanelFullscreenModal.vue';
export { default as PanelHeader } from './panel/Panel/PanelHeader.vue';

// PanelGroup 相关组件
export { default as PanelGroupDialog } from './panel/PanelGroup/PanelGroupDialog.vue';
export { default as PanelGroupHeader } from './panel/PanelGroup/PanelGroupHeader.vue';
export { default as PanelGroupItem } from './panel/PanelGroup/PanelGroupItem.vue';
export { default as PanelGroupList } from './panel/PanelGroup/PanelGroupList.vue';

// 图表组件
export { default as BarChart } from './charts/Charts/BarChart.vue';
export { default as GaugeChart } from './charts/Charts/GaugeChart.vue';
export { default as HeatmapChart } from './charts/Charts/HeatmapChart.vue';
export { default as PieChart } from './charts/Charts/PieChart.vue';
export { default as StatPanel } from './charts/Charts/StatPanel.vue';
export { default as TableChart } from './charts/Charts/TableChart.vue';
export { default as TimeSeriesChart } from './charts/Charts/TimeSeriesChart.vue';

// 图表图例组件
export { default as CompactLegend } from './charts/legend/CompactLegend.vue';
export { default as Legend } from './charts/legend/Legend.vue';
export { default as ListLegend } from './charts/legend/ListLegend.vue';
export { default as TableLegend } from './charts/legend/TableLegend.vue';

// 图表提示框组件
export { default as ChartTooltip } from './charts/tooltip/ChartTooltip.vue';
export { default as GlobalChartTooltip } from './charts/tooltip/GlobalChartTooltip.vue';

// 编辑器相关组件
export { default as PanelEditorDrawer } from './editor/PanelEditor/PanelEditorDrawer.vue';
export { default as PanelPreview } from './editor/PanelEditor/PanelPreview.vue';
export { default as DataQueryTab } from './editor/PanelEditor/DataQueryTab.vue';

// 图表样式编辑器
export { default as BarChartStyles } from './editor/PanelEditor/ChartStyles/BarChartStyles.vue';
export { default as GaugeChartStyles } from './editor/PanelEditor/ChartStyles/GaugeChartStyles.vue';
export { default as HeatmapChartStyles } from './editor/PanelEditor/ChartStyles/HeatmapChartStyles.vue';
export { default as PieChartStyles } from './editor/PanelEditor/ChartStyles/PieChartStyles.vue';
export { default as StatPanelStyles } from './editor/PanelEditor/ChartStyles/StatPanelStyles.vue';
export { default as TableChartStyles } from './editor/PanelEditor/ChartStyles/TableChartStyles.vue';
export { default as TimeSeriesChartStyles } from './editor/PanelEditor/ChartStyles/TimeSeriesChartStyles.vue';

// 查询构建器组件
export { default as LabelFilters } from './query-builder/QueryBuilder/LabelFilters.vue';
export { default as MetricSelector } from './query-builder/QueryBuilder/MetricSelector.vue';
export { default as MetricsModal } from './query-builder/QueryBuilder/MetricsModal.vue';
export { default as QueryPatternsModal } from './query-builder/QueryBuilder/QueryPatternsModal.vue';
export { default as QueryPreview } from './query-builder/QueryBuilder/QueryPreview.vue';

// 嵌套查询组件
export { default as LabelParamEditor } from './query-builder/QueryBuilder/query-builder/LabelParamEditor.vue';
export { default as NestedQuery } from './query-builder/QueryBuilder/query-builder/NestedQuery.vue';
export { default as NestedQueryList } from './query-builder/QueryBuilder/query-builder/NestedQueryList.vue';
export { default as OperationsList } from './query-builder/QueryBuilder/query-builder/OperationsList.vue';
export { default as QueryExplain } from './query-builder/QueryBuilder/query-builder/QueryExplain.vue';
export { default as QueryHints } from './query-builder/QueryBuilder/query-builder/QueryHints.vue';

// 通用组件
export { default as DataTable } from './common/Common/DataTable.vue';
export { default as JsonEditor } from './common/Common/JsonEditor.vue';
export { default as VariableSelector } from './common/Common/VariableSelector.vue';
