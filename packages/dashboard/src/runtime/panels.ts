/**
 * Panel Registry（面板插件注册表）
 *
 * 背景：
 * - Dashboard JSON 中的 panel.type 是字符串（例如 'timeseries'/'stat'/'x-company:topology'）
 * - 运行时需要根据 type 找到对应的 Vue 渲染组件
 *
 * 设计目标：
 * - 支持“插件化”：宿主应用可注入自定义面板，也可替换/裁剪内置面板
 * - 支持“宽松模式”：当 type 未注册时，UI 使用 UnsupportedPanel 占位并保留原始 options
 */
import type { Component } from 'vue';
import TimeSeriesChart from '/#/components/Charts/TimeSeriesChart.vue';
import PieChart from '/#/components/Charts/PieChart.vue';
import BarChart from '/#/components/Charts/BarChart.vue';
import StatPanel from '/#/components/Charts/StatPanel.vue';
import TableChart from '/#/components/Charts/TableChart.vue';
import GaugeChart from '/#/components/Charts/GaugeChart.vue';
import HeatmapChart from '/#/components/Charts/HeatmapChart.vue';

export interface PanelPlugin {
  /**
   * 面板类型（写入 Dashboard JSON 的 `panel.type` 字段）。
   * 示例：`timeseries` / `stat` / `x-company:topology`
   */
  type: string;
  /**
   * 在 UI 中展示的名称（用于下拉选择、面板创建等）
   */
  displayName: string;
  /**
   * 面板渲染组件（Vue Component）
   *
   * 约定：
   * - 组件 props 需要与当前内置图表保持一致（至少包含 `panel` 与 `queryResults`）
   * - 如果宿主应用要完全自定义渲染，可以自行定义组件并注册到 registry
   */
  component: Component;
}

export interface PanelRegistry {
  /**
   * 判断某个 type 是否已注册
   */
  has: (type: string) => boolean;
  /**
   * 获取某个 type 对应的插件定义（不存在则返回 undefined）
   */
  get: (type: string) => PanelPlugin | undefined;
  /**
   * 列出所有已注册插件（用于 UI 选择器等）
   */
  list: () => PanelPlugin[];
}

/**
 * 由插件列表构建一个 registry
 * - 内部用 Map 做 O(1) 查找
 * - 同 type 后写入会覆盖前写入（由调用方决定顺序）
 */
export function createPanelRegistry(plugins: PanelPlugin[]): PanelRegistry {
  const map = new Map<string, PanelPlugin>();
  for (const p of plugins) {
    if (!p?.type) continue;
    map.set(p.type, p);
  }
  return {
    has: (type: string) => map.has(type),
    get: (type: string) => map.get(type),
    list: () => Array.from(map.values()),
  };
}

/**
 * 内置面板 registry（默认能力）
 *
 * 说明：
 * - 宿主应用可以通过 `provide(GF_PANEL_REGISTRY_KEY, registry)` 覆盖它
 * - 如果宿主没有注入 registry，则 dashboard 仍可运行（保证开箱即用）
 */
export function createBuiltInPanelRegistry(): PanelRegistry {
  return createPanelRegistry([
    { type: 'timeseries', displayName: '时间序列图', component: TimeSeriesChart },
    { type: 'bar', displayName: '柱状图', component: BarChart },
    { type: 'pie', displayName: '饼图', component: PieChart },
    { type: 'stat', displayName: '统计值', component: StatPanel },
    { type: 'table', displayName: '表格', component: TableChart },
    { type: 'gauge', displayName: '仪表盘', component: GaugeChart },
    { type: 'heatmap', displayName: '热力图', component: HeatmapChart },
  ]);
}
