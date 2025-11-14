/**
 * 系列选中管理 Composable
 * 用于 Legend 交互
 */

import { ref, computed } from 'vue';
import type { LegendSelection } from '@/types/legend';

export function useSeriesSelection() {
  const selectedItems = ref<LegendSelection>('ALL');

  const isSeriesSelected = (id: string): boolean => {
    if (selectedItems.value === 'ALL') return true;
    return !!selectedItems.value[id];
  };

  const toggleSeries = (id: string, isModified: boolean) => {
    if (isModified) {
      // Shift/Ctrl/Meta 键被按下：多选模式
      if (selectedItems.value === 'ALL') {
        // 如果当前是全选，切换为只选中点击的项
        selectedItems.value = { [id]: true };
      } else {
        // 如果已经是多选状态，切换当前项的选中状态
        const newSelection = { ...selectedItems.value };
        if (newSelection[id]) {
          delete newSelection[id];
          // 如果没有任何项被选中，则恢复全选
          if (Object.keys(newSelection).length === 0) {
            selectedItems.value = 'ALL';
          } else {
            selectedItems.value = newSelection;
          }
        } else {
          newSelection[id] = true;
          selectedItems.value = newSelection;
        }
      }
    } else {
      // 没有修饰键：单选模式
      if (selectedItems.value === 'ALL') {
        // 如果当前是全选，切换为只选中点击的项
        selectedItems.value = { [id]: true };
      } else if (selectedItems.value[id] && Object.keys(selectedItems.value).length === 1) {
        // 如果只有一个项被选中且就是当前项，恢复全选
        selectedItems.value = 'ALL';
      } else {
        // 否则，只选中点击的项
        selectedItems.value = { [id]: true };
      }
    }
  };

  const resetSelection = () => {
    selectedItems.value = 'ALL';
  };

  const getSelectedIds = computed((): string[] => {
    if (selectedItems.value === 'ALL') return [];
    return Object.keys(selectedItems.value).filter(id => selectedItems.value[id]);
  });

  return {
    selectedItems,
    isSeriesSelected,
    toggleSeries,
    resetSelection,
    getSelectedIds,
  };
}
