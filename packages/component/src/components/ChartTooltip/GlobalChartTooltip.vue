<template>
  <Teleport to="body">
    <div v-if="isVisible" ref="tooltipRef" :class="[bem(), bem({ pinned: isPinned })]" :style="tooltipStyle">
      <!-- Tooltip 头部 -->
      <div :class="bem('header')">
        <span :class="bem('time')">{{ formattedTime }}</span>
        <div :class="bem('actions')">
          <Button v-if="isPinned" type="text" size="small" :class="bem('unpin-btn')" @click="handleUnpin">
            <PushpinFilled />
          </Button>
          <span v-else :class="bem('hint')">点击图表固定</span>
          <Button v-if="totalSeries > visibleSeriesCount && !showAllSeries" type="text" size="small" @click="showAllSeries = true">
            显示全部 ({{ totalSeries }})
          </Button>
        </div>
      </div>

      <!-- Tooltip 内容 -->
      <div :class="bem('content')">
        <div v-for="series in displayedSeries" :key="series.id" :class="bem('series-item')">
          <span :class="bem('series-color')" :style="{ backgroundColor: series.color }"></span>
          <span :class="bem('series-label')" :title="series.label">{{ series.label }}</span>
          <span :class="bem('series-value')">{{ series.formattedValue }}</span>
        </div>
        <div v-if="displayedSeries.length === 0" :class="bem('empty')">暂无数据</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { Button } from 'ant-design-vue';
  import { storeToRefs } from '@grafana-fast/store';
  import { PushpinFilled } from '@ant-design/icons-vue';
  import { useTooltipStore } from '/#/stores';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('chart-tooltip');

  const tooltipStore = useTooltipStore();
  const { pinnedChartId, activeChartId, currentPosition, currentTooltipData } = storeToRefs(tooltipStore);

  // State
  const tooltipRef = ref<HTMLElement>();
  const showAllSeries = ref(false);
  const maxVisibleSeries = 10;

  // Computed
  const isPinned = computed(() => pinnedChartId.value !== null);

  const totalSeries = computed(() => {
    return currentTooltipData.value?.series?.length || 0;
  });

  const visibleSeriesCount = computed(() => (showAllSeries.value ? totalSeries.value : Math.min(maxVisibleSeries, totalSeries.value)));

  const displayedSeries = computed(() => {
    const series = currentTooltipData.value?.series || [];
    const count = visibleSeriesCount.value;
    return series.slice(0, count);
  });

  const isVisible = computed(() => {
    // 必须同时满足：有位置信息 && 有数据内容 && (已固定 || 有活跃图表)
    return !!currentPosition.value && !!currentTooltipData.value && (isPinned.value || activeChartId.value !== null);
  });

  const formattedTime = computed(() => {
    return currentTooltipData.value?.time || '';
  });

  const tooltipStyle = computed(() => {
    const pos = currentPosition.value;

    if (!pos) return { visibility: 'hidden' as const };

    const padding = 16;
    let x = pos.pageX + padding;
    let y = pos.pageY + padding;

    // 确保不超出屏幕
    if (tooltipRef.value) {
      const rect = tooltipRef.value.getBoundingClientRect();
      if (x + rect.width > window.innerWidth) {
        x = pos.pageX - rect.width - padding;
      }
      if (y + rect.height > window.innerHeight) {
        y = window.innerHeight - rect.height - padding;
      }
      if (x < padding) {
        x = padding;
      }
      if (y < padding) {
        y = padding;
      }
    }

    return {
      transform: `translate3d(${x}px, ${y}px, 0)`,
      visibility: 'visible' as const,
    };
  });

  /**
   * 滚动时取消固定
   */
  const handleScroll = () => {
    if (isPinned.value) {
      handleUnpin();
    }
  };

  /**
   * 取消固定
   */
  const handleUnpin = () => {
    tooltipStore.unpinTooltip();
    showAllSeries.value = false;
  };

  // Lifecycle
  onMounted(() => {
    // 只监听滚动事件（用于取消固定）
    window.addEventListener('scroll', handleScroll, true);
  });

  onUnmounted(() => {
    // 清理事件
    window.removeEventListener('scroll', handleScroll, true);
  });
</script>

<style scoped lang="less">
  .dp-chart-tooltip {
    position: fixed;
    top: 0;
    left: 0;
    min-width: 240px;
    max-width: 450px;
    background-color: rgba(40, 40, 40, 0.96);
    color: #fff;
    border-radius: 6px;
    font-size: 12px;
    pointer-events: none;
    z-index: 9999;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    transition: transform 0.1s ease-out;

    &.dp-chart-tooltip--pinned {
      pointer-events: auto;
      background-color: rgba(40, 40, 40, 0.98);
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 40px;
      padding: 0 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      gap: 8px;
    }

    &__time {
      font-weight: 500;
      font-size: 13px;
      flex-shrink: 0;
    }

    &__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;

      :deep(.ant-btn) {
        color: #fff;
        padding: 0 4px;
        height: 20px;
        font-size: 11px;

        &:hover {
          color: @primary-color;
          background-color: rgba(255, 255, 255, 0.1);
        }
      }
    }

    &__hint {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      white-space: nowrap;
    }

    &__unpin-btn {
      :deep(.ant-btn) {
        padding: 0;
        width: 20px;
      }
    }

    &__content {
      padding: 8px 12px;
      max-height: 400px;
      overflow-y: auto;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;

        &:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      }
    }

    &__series-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 0;
      transition: background-color 0.2s;
      cursor: pointer;

      &:hover {
        background-color: rgba(255, 255, 255, 0.05);
        margin: 0 -4px;
        padding: 5px 4px;
        border-radius: 3px;
      }
    }

    &__series-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    &__series-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      min-width: 0;
    }

    &__series-value {
      font-weight: 600;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-size: 12px;
      color: #fff;
      flex-shrink: 0;
    }

    &__empty {
      padding: 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      font-size: 12px;
    }
  }
</style>
