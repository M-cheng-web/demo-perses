/**
 * Panel Registry（面板插件注册表）
 *
 * 背景：
 * - Dashboard JSON 中的 panel.type 是字符串（例如 'timeseries'/'stat'/'x-company:topology'）
 * - 运行时需要根据 type 找到对应的 Vue 渲染组件
 *
 * 设计目标：
 * - 当前阶段：dashboard 内置全部 Panel（不提供 “all/exclude/insert” 这类对外筛选 API）
 * - 当 type 未注册时：渲染层仍需兜底（例如用 UnsupportedPanel），避免运行时崩溃
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
 * 内置面板 registry 的单例实例
 *
 * 说明：
 * - 当前阶段 dashboard 内置全部面板类型，因此无需外部注入 registry
 * - 这里提供一个单例，避免在多个组件中反复 new Map
 */
let builtInRegistrySingleton: PanelRegistry | null = null;

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
 * - 当前阶段不支持外部注入/裁剪：dashboard 内置全部面板，保证开箱即用
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

/**
 * 获取内置面板 registry（单例）
 */
export function getBuiltInPanelRegistry(): PanelRegistry {
  if (!builtInRegistrySingleton) builtInRegistrySingleton = createBuiltInPanelRegistry();
  return builtInRegistrySingleton;
}
