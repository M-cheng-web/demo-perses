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
              <Switch v-model:checked="localOptions.legend.show" size="small" />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">位置</span>
              <Select
                :options="[
                  { label: '底部', value: 'bottom' },
                  { label: '右侧', value: 'right' },
                ]"
                v-model:value="localOptions.legend.position"
                size="small"
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
                size="small"
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
                size="small"
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
                size="small"
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
              <Switch v-model:checked="localOptions.specific.showPercentage" size="small" />
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
                size="small"
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
                size="small"
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
  import { ref, watch } from 'vue';
  import { deepClone, createNamespace } from '/#/utils';
  import { getDefaultPieChartOptions } from '../ChartStylesDefaultOptions/pieChartDefaultOptions';
  import { deepMerge } from './utils';
  import { Switch, Select, Segmented, Slider, Button } from '@grafana-fast/component';

  const [_, bem] = createNamespace('pie-chart-styles');

  interface Props {
    options: any;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    (e: 'update:options', options: any): void;
  }>();

  // 合并默认配置和传入的配置
  const localOptions = ref(deepClone(deepMerge(getDefaultPieChartOptions(), props.options ?? {})));

  // 恢复默认设置
  const resetToDefaults = () => {
    const defaults = getDefaultPieChartOptions();
    localOptions.value = deepClone(defaults);
    emit('update:options', deepClone(defaults));
  };

  // 监听 localOptions 变化，发送事件更新外部
  watch(
    localOptions,
    (newVal) => {
      emit('update:options', deepClone(newVal));
    },
    { deep: true }
  );

  // 监听外部 props.options 变化，更新 localOptions
  watch(
    () => props.options,
    (newVal) => {
      if (newVal && JSON.stringify(newVal) !== JSON.stringify(localOptions.value)) {
        localOptions.value = deepClone(deepMerge(getDefaultPieChartOptions(), newVal ?? {}));
      }
    },
    { deep: true }
  );
</script>

<style scoped lang="less">
  .dp-pie-chart-styles {
    padding: 16px;
    height: 100%;
    overflow-y: auto;

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
      border: 1px solid @border-color;
      border-radius: 4px;
      overflow: hidden;
      background: @background-light;

      &__section-header {
        padding: 12px 16px;
        border-bottom: 1px solid @border-color;
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.5px;
        color: @text-color-secondary;
        text-transform: uppercase;
        background: @background-base;
      }

      &__section-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    }

    &__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      &__label {
        font-size: 13px;
        color: @text-color;
        flex-shrink: 0;
        min-width: 90px;
        font-weight: 500;
      }

      &__slider-value {
        font-size: 13px;
        color: @text-color-secondary;
        min-width: 40px;
        text-align: right;
      }
    }
  }
</style>
