<!-- 图表样式配置 - 表格 -->
<template>
  <div class="table-chart-styles">
    <div :class="bem('grid')">
      <!-- 左侧列：表格配置 -->
      <div :class="bem('column')">
        <div :class="bem('section')">
          <div :class="bem('section-header')">表格配置</div>
          <div :class="bem('section-content')">
            <div :class="bem('row')">
              <span :class="bem('label')">显示分页</span>
              <Switch v-model:checked="localOptions.specific.showPagination" />
            </div>

            <div v-if="localOptions.specific.showPagination" :class="bem('row')">
              <span :class="bem('label')">每页行数</span>
              <Select
                v-model:value="localOptions.specific.pageSize"
                style="width: 200px"
                :options="[
                  { label: '10', value: 10 },
                  { label: '20', value: 20 },
                  { label: '50', value: 50 },
                  { label: '100', value: 100 },
                ]"
              />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">可排序</span>
              <Switch v-model:checked="localOptions.specific.sortable" />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧列：格式化 -->
      <div :class="bem('column')">
        <div :class="bem('section')">
          <div :class="bem('section-header')">格式化</div>
          <div :class="bem('section-content')">
            <div :class="bem('row')">
              <span :class="bem('label')">单位</span>
              <Select
                v-model:value="localOptions.format.unit"
                style="width: 200px"
                :options="[
                  { label: '无', value: 'none' },
                  { label: '百分比 (0.0-1.0)', value: 'percent' },
                  { label: '百分比 (0-100)', value: 'percent-decimal' },
                  { label: '字节', value: 'bytes' },
                  { label: '毫秒', value: 'milliseconds' },
                  { label: '秒', value: 'seconds' },
                ]"
              />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">小数位数</span>
              <Select
                v-model:value="localOptions.format.decimals"
                style="width: 200px"
                :options="[
                  { label: '默认', value: 'default' },
                  { label: '0', value: 0 },
                  { label: '1', value: 1 },
                  { label: '2', value: 2 },
                  { label: '3', value: 3 },
                  { label: '4', value: 4 },
                ]"
              />
            </div>
          </div>
        </div>

        <!-- 重置设置 -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">重置设置</div>
          <div :class="bem('section-content')">
            <Button type="default" size="middle" block @click="resetToDefaults"> 恢复默认设置 </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '/#/utils';
  import { getDefaultTableChartOptions } from '../ChartStylesDefaultOptions/tableChartDefaultOptions';
  import { useChartStyleDraft } from './useChartStyleDraft';
  import { Switch, Select, Button } from '@grafana-fast/component';

  const [_, bem] = createNamespace('table-chart-styles');

  interface Props {
    options: any;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    (e: 'update:options', options: any): void;
  }>();

  const { localOptions, resetToDefaults } = useChartStyleDraft({
    getOptions: () => props.options,
    getDefaults: getDefaultTableChartOptions,
    emitUpdate: (next) => emit('update:options', next),
  });
</script>

<style scoped lang="less">
  .dp-table-chart-styles {
    padding: 16px;
    height: 100%;
    overflow-y: auto;

    /* Scrollbar styling */
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--gf-color-fill-secondary);
      border-radius: 3px;

      &:hover {
        background: var(--gf-color-fill);
      }
    }

    &__grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }

    &__column {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    &__section {
      border: 1px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-md);
      overflow: hidden;
      background: var(--gf-color-surface);
      transition: border-color var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        border-color: var(--gf-color-border);
      }
    }

    &__section-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--gf-color-border-muted);
      font-weight: 600;
      font-size: 12px;
      letter-spacing: 0.5px;
      color: var(--gf-color-text-secondary);
      text-transform: uppercase;
      background: var(--gf-color-surface-muted);
      line-height: 1.5714285714285714;
    }

    &__section-content {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    &__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    &__label {
      font-size: 13px;
      color: var(--gf-color-text);
      flex-shrink: 0;
      min-width: 90px;
      font-weight: 500;
      line-height: 1.5714285714285714;
    }
  }
</style>
