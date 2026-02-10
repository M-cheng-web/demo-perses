<!-- 图表样式配置 - 柱状图 -->
<template>
  <div :class="bem()">
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
                v-model:value="localOptions.legend.position"
                style="width: 200px"
                :options="[
                  { label: '底部', value: 'bottom' },
                  { label: '右侧', value: 'right' },
                ]"
              />
            </div>
          </div>
        </div>

        <!-- 视觉 -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">视觉</div>
          <div :class="bem('section-content')">
            <div :class="bem('row')">
              <span :class="bem('label')">方向</span>
              <Segmented
                v-model:value="localOptions.specific.orientation"
                :options="[
                  { label: '垂直', value: 'vertical' },
                  { label: '水平', value: 'horizontal' },
                ]"
              />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">柱状图模式</span>
              <Segmented
                v-model:value="localOptions.specific.barMode"
                :options="[
                  { label: '分组', value: 'group' },
                  { label: '堆叠', value: 'stack' },
                ]"
              />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">柱宽度</span>
              <Input v-model:value="localOptions.specific.barWidth" placeholder="例如：60% 或 auto" style="width: 200px" />
            </div>
          </div>
        </div>

        <!-- 格式化 -->
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
      </div>

      <!-- 右侧列：坐标轴 + 格式化 -->
      <div :class="bem('column')">
        <!-- 坐标轴 -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">坐标轴</div>
          <div :class="bem('section-content')">
            <div :class="bem('row')">
              <span :class="bem('label')">显示 X 轴</span>
              <Switch v-model:checked="localOptions.axis.xAxis.show" />
            </div>

            <div v-if="localOptions.axis.xAxis.show" :class="bem('row')">
              <span :class="bem('label')">X 轴名称</span>
              <Input v-model:value="localOptions.axis.xAxis.name" placeholder="X 轴名称" style="width: 200px" />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">显示 Y 轴</span>
              <Switch v-model:checked="localOptions.axis.yAxis.show" />
            </div>

            <div v-if="localOptions.axis.yAxis.show" :class="bem('row')">
              <span :class="bem('label')">Y 轴名称</span>
              <Input v-model:value="localOptions.axis.yAxis.name" placeholder="Y 轴名称" style="width: 200px" />
            </div>

            <div v-if="localOptions.axis.yAxis.show" :class="bem('row')">
              <span :class="bem('label')">Y 轴最小值</span>
              <InputNumber v-model:value="localOptions.axis.yAxis.min" style="width: 200px" placeholder="自动" />
            </div>

            <div v-if="localOptions.axis.yAxis.show" :class="bem('row')">
              <span :class="bem('label')">Y 轴最大值</span>
              <InputNumber v-model:value="localOptions.axis.yAxis.max" style="width: 200px" placeholder="自动" />
            </div>
          </div>
        </div>

        <!-- 重置设置 -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">重置设置</div>
          <div :class="bem('section-content')">
            <Button type="default" block @click="resetToDefaults"> 恢复默认设置 </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '/#/utils';
  import { getDefaultBarChartOptions } from '../ChartStylesDefaultOptions/barChartDefaultOptions';
  import { useChartStyleDraft } from './useChartStyleDraft';
  import { Switch, Select, Segmented, Button, Input, InputNumber } from '@grafana-fast/component';

  const [_, bem] = createNamespace('bar-chart-styles');

  interface Props {
    options: any;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    (e: 'update:options', options: any): void;
  }>();

  const { localOptions, resetToDefaults } = useChartStyleDraft({
    getOptions: () => props.options,
    getDefaults: getDefaultBarChartOptions,
    emitUpdate: (next) => emit('update:options', next),
  });
</script>

<style scoped lang="less">
  .dp-bar-chart-styles {
    padding: 12px;
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
      gap: 16px;
    }

    &__column {
      display: flex;
      flex-direction: column;
      gap: 16px;
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
      padding: 8px 12px;
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
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    &__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    &__label {
      font-size: 12px;
      color: var(--gf-color-text);
      flex-shrink: 0;
      min-width: 80px;
      font-weight: 500;
      line-height: 1.5714285714285714;
    }
  }
</style>
