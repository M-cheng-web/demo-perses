<!-- 图表样式配置 - 饼图 -->
<template>
  <div class="pie-chart-styles">
    <div :class="bem('grid')">
      <!-- 左侧列：图例 + 视觉 -->
      <div :class="bem('column')">
        <!-- 图例 -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">图例</div>
          <div :class="bem('section-content')">
            <div :class="bem('row')">
              <span :class="bem('label')">显示</span>
              <Switch v-model:checked="localOptions.legend.show" />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">位置</span>
              <Select
                :options="[
                  { label: '底部', value: 'bottom' },
                  { label: '右侧', value: 'right' },
                ]"
                v-model:value="localOptions.legend.position"
                style="width: 200px"
              />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">模式</span>
              <Segmented
                v-model:value="localOptions.legend.mode"
                :options="[
                  { label: '列表', value: 'list' },
                  { label: '表格', value: 'table' },
                ]"
              />
            </div>

            <!-- 表格模式下显示"显示值"选项 -->
            <div v-if="localOptions.legend.mode === 'table'" :class="bem('row')">
              <span :class="bem('label')">显示值</span>
              <Select
                :options="[
                  { label: '最小值', value: 'min' },
                  { label: '最大值', value: 'max' },
                  { label: '平均值', value: 'mean' },
                  { label: '最新值', value: 'last' },
                  { label: '首值', value: 'first' },
                ]"
                v-model:value="localOptions.legend.values"
                mode="multiple"
                style="width: 200px"
                placeholder="请选择"
              />
            </div>
          </div>
        </div>

        <!-- 视觉 -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">视觉</div>
          <div :class="bem('section-content')">
            <div :class="bem('row')">
              <span :class="bem('label')">饼图类型</span>
              <Segmented
                v-model:value="localOptions.specific.pieType"
                :options="[
                  { label: '饼图', value: 'pie' },
                  { label: '环形图', value: 'doughnut' },
                ]"
              />
            </div>

            <div v-if="localOptions.specific.pieType === 'doughnut'" :class="bem('row')">
              <span :class="bem('label')">内圆半径</span>
              <div style="flex: 1; display: flex; align-items: center; gap: 12px">
                <Slider v-model:value="localOptions.specific.innerRadius" :min="0" :max="80" :step="5" style="flex: 1" />
                <span class="slider-value">{{ localOptions.specific.innerRadius }}%</span>
              </div>
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">显示百分比</span>
              <Switch v-model:checked="localOptions.specific.showPercentage" />
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
                :options="[
                  { label: '无', value: 'none' },
                  { label: '百分比 (0.0-1.0)', value: 'percent-decimal' },
                  { label: '百分比 (0-100)', value: 'percent' },
                  { label: '字节', value: 'bytes' },
                  { label: '毫秒', value: 'milliseconds' },
                  { label: '秒', value: 'seconds' },
                ]"
                v-model:value="localOptions.format.unit"
                style="width: 200px"
              />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">小数位数</span>
              <Select
                :options="[
                  { label: '默认', value: 'default' },
                  { label: '0', value: 0 },
                  { label: '1', value: 1 },
                  { label: '2', value: 2 },
                  { label: '3', value: 3 },
                  { label: '4', value: 4 },
                ]"
                v-model:value="localOptions.format.decimals"
                style="width: 200px"
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
  import { getDefaultPieChartOptions } from '../ChartStylesDefaultOptions/pieChartDefaultOptions';
  import { useChartStyleDraft } from './useChartStyleDraft';
  import { Switch, Select, Segmented, Slider, Button } from '@grafana-fast/component';

  const [_, bem] = createNamespace('pie-chart-styles');

  interface Props {
    options: any;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    (e: 'update:options', options: any): void;
  }>();

  const { localOptions, resetToDefaults } = useChartStyleDraft({
    getOptions: () => props.options,
    getDefaults: getDefaultPieChartOptions,
    emitUpdate: (next) => emit('update:options', next),
  });
</script>

<style scoped lang="less">
  .dp-pie-chart-styles {
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

    .slider-value {
      font-size: 13px;
      color: var(--gf-color-text-secondary);
      min-width: 40px;
      text-align: right;
      font-feature-settings: 'tnum';
    }
  }
</style>
