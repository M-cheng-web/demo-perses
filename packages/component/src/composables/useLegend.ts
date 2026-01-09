/**
 * Legend 管理 Composable
 * 整合 Legend 相关的所有逻辑：items、options、selection、交互
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type { ECharts } from 'echarts';
import type { Panel, QueryResult, LegendItem, LegendSelection } from '#/types';

export interface UseLegendOptions {
  /** 面板配置 */
  panel: ComputedRef<Panel> | Ref<Panel>;
  /** 查询结果 */
  queryResults: ComputedRef<QueryResult[]> | Ref<QueryResult[]>;
  /** 图表实例（用于交互） */
  chartInstance: Ref<ECharts | null>;
  /** 更新图表的回调 */
  updateChart: () => void;
}

export function useLegend(options: UseLegendOptions) {
  const { panel, queryResults, updateChart } = options;

  // ============ 选中状态管理 ============
  // 'ALL' 表示所有项都显示，对象表示只有对象中 value 为 true 的项显示
  const selectedItems = ref<LegendSelection>('ALL');

  // 悬停状态：记录当前悬停的项
  const hoveredItem = ref<string | null>(null);

  /**
   * 检查系列是否被选中（应该显示）
   */
  function isSeriesSelected(id: string): boolean {
    if (selectedItems.value === 'ALL') return true;
    return !!selectedItems.value[id];
  }

  /**
   * 切换系列选中状态
   * 优化后的点击逻辑：
   * 1. 全选状态下，点击某个 label，只激活该 label，其他取消
   * 2. 部分选中状态下，点击未激活的 label，激活该 label（保持其他状态）
   * 3. 部分选中状态下，点击已激活的 label，取消该 label（保持其他状态）
   */
  function toggleSeries(id: string) {
    if (selectedItems.value === 'ALL') {
      // 全选状态：点击某个 label，只激活该 label
      const newSelection: Record<string, boolean> = {
        [id]: true,
      };
      selectedItems.value = newSelection;
    } else {
      // 部分选中状态：切换该项的状态
      const newSelection = { ...selectedItems.value };

      if (newSelection[id]) {
        // 当前是激活的，点击后取消激活
        delete newSelection[id];
      } else {
        // 当前是未激活的，点击后激活
        newSelection[id] = true;
      }

      // 检查是否所有项都被选中了
      const allIds = legendItems.value.map((item) => item.id);
      const allSelected = allIds.every((itemId) => newSelection[itemId]);

      if (allSelected) {
        selectedItems.value = 'ALL';
      } else if (Object.keys(newSelection).length === 0) {
        // 所有项都被取消选中，保持空对象状态
        selectedItems.value = newSelection;
      } else {
        selectedItems.value = newSelection;
      }
    }
  }

  /**
   * 重置选中状态
   */
  function resetSelection() {
    selectedItems.value = 'ALL';
  }

  /**
   * 获取选中系列 ID 列表
   */
  const getSelectedIds = computed((): string[] => {
    if (selectedItems.value === 'ALL') return [];
    const selection = selectedItems.value;
    return Object.keys(selection).filter((id) => selection[id]);
  });

  // ============ 全局选择状态管理 ============
  /**
   * 计算全局选择状态
   * @returns 'all' | 'none' | 'indeterminate'
   */
  const globalSelectionState = computed((): 'all' | 'none' | 'indeterminate' => {
    if (selectedItems.value === 'ALL') {
      return 'all';
    }

    const selectedCount = Object.values(selectedItems.value).filter(Boolean).length;
    const totalCount = legendItems.value.length;

    if (selectedCount === 0) {
      return 'none';
    } else if (selectedCount === totalCount) {
      return 'all';
    } else {
      return 'indeterminate';
    }
  });

  /**
   * 切换全局选择状态
   * 点击行为：
   * - 如果当前是全选 -> 变成全不选
   * - 如果当前是部分选中或全不选 -> 变成全选
   */
  function toggleGlobalSelection() {
    if (globalSelectionState.value === 'all') {
      // 全选 -> 全不选
      selectedItems.value = {};
    } else {
      // 部分选中或全不选 -> 全选
      selectedItems.value = 'ALL';
    }
    updateChart();
  }

  // ============ Legend Items 计算 ============
  const legendItems = computed((): LegendItem[] => {
    const items: LegendItem[] = [];
    const colors = panel.value.options.chart?.colors || [];
    let colorIndex = 0;

    queryResults.value.forEach((result) => {
      if (!result.data) return;

      result.data.forEach((timeSeries, index) => {
        const label = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || `Series ${index + 1}`;

        const color = colors[colorIndex % colors.length] || `hsl(${(colorIndex * 137.5) % 360}, 70%, 50%)`;

        items.push({
          id: `series-${colorIndex}`,
          label,
          color,
        });

        colorIndex++;
      });
    });

    return items;
  });

  // ============ Legend Options 计算 ============
  const legendOptions = computed(() => ({
    show: panel.value.options.legend?.show !== false,
    mode: (panel.value.options.legend as any)?.mode || 'list',
    position: (panel.value.options.legend?.position || 'bottom') as 'bottom' | 'right',
    size: 'medium' as const,
    values: (panel.value.options.legend as any)?.values || [], // 表格模式下显示的列
  }));

  // ============ Legend 交互处理 ============
  /**
   * 处理 Legend 项点击
   */
  function handleLegendClick(id: string, _isModified: boolean) {
    toggleSeries(id);
    updateChart();
  }

  /**
   * 处理 Legend 项悬停
   * 悬停时，该项正常显示，其他项降低透明度
   * 如果该项处于取消显示状态，则不执行任何操作
   */
  function handleLegendHover(id: string) {
    // 只有当该项被选中（显示中）时，才执行悬停逻辑
    if (!isSeriesSelected(id)) {
      return;
    }
    hoveredItem.value = id;
    updateChart();
  }

  /**
   * 处理 Legend 项离开
   * 离开时，恢复到根据选中状态显示
   */
  function handleLegendLeave() {
    // 清除悬停状态前，检查是否有悬停项
    if (hoveredItem.value === null) {
      return;
    }
    hoveredItem.value = null;
    updateChart();
  }

  /**
   * 获取系列的显示状态
   * @returns 'visible' | 'dimmed' | 'hidden'
   */
  function getSeriesVisibility(id: string): 'visible' | 'dimmed' | 'hidden' {
    // 如果该系列未被选中，则隐藏
    if (!isSeriesSelected(id)) {
      return 'hidden';
    }

    // 如果有悬停项
    if (hoveredItem.value) {
      // 只有被选中的项才参与悬停高亮逻辑
      // 悬停项正常显示，其他已选中项降低透明度
      return hoveredItem.value === id ? 'visible' : 'dimmed';
    }

    // 默认正常显示
    return 'visible';
  }

  return {
    // 状态
    selectedItems,
    legendItems,
    legendOptions,
    hoveredItem,

    // 选中管理
    isSeriesSelected,
    toggleSeries,
    resetSelection,
    getSelectedIds,

    // 全局选择
    globalSelectionState,
    toggleGlobalSelection,

    // 可见性管理
    getSeriesVisibility,

    // 交互处理
    handleLegendClick,
    handleLegendHover,
    handleLegendLeave,
  };
}
