/**
 * dashboard 内部 ECharts Theme 工具
 *
 * 说明：
 * - 实现收敛到 @grafana-fast/utils（弱类型返回，避免 utils 引入 echarts 依赖）
 * - 该文件仅作为 dashboard 包内部的导出路径（/#+/utils/echartsTheme）
 */

export { getEChartsPalette, getEChartsTheme, getEChartsThemeForTarget } from '@grafana-fast/utils';

