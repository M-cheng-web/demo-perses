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
              <Switch v-model:checked="localOptions.legend.show" size="small" />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">位置</span>
              <Select
                v-model:value="localOptions.legend.position"
                size="small"
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
                size="small"
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
                size="small"
              />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">柱宽度</span>
              <Input v-model:value="localOptions.specific.barWidth" size="small" placeholder="例如：60% 或 auto" style="width: 200px" />
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
                size="small"
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
                size="small"
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
              <Switch v-model:checked="localOptions.axis.xAxis.show" size="small" />
            </div>

            <div v-if="localOptions.axis.xAxis.show" :class="bem('row')">
              <span :class="bem('label')">X 轴名称</span>
              <Input v-model:value="localOptions.axis.xAxis.name" size="small" placeholder="X 轴名称" style="width: 200px" />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">显示 Y 轴</span>
              <Switch v-model:checked="localOptions.axis.yAxis.show" size="small" />
            </div>

            <div v-if="localOptions.axis.yAxis.show" :class="bem('row')">
              <span :class="bem('label')">Y 轴名称</span>
              <Input v-model:value="localOptions.axis.yAxis.name" size="small" placeholder="Y 轴名称" style="width: 200px" />
            </div>

            <div v-if="localOptions.axis.yAxis.show" :class="bem('row')">
              <span :class="bem('label')">Y 轴最小值</span>
              <InputNumber v-model:value="localOptions.axis.yAxis.min" size="small" style="width: 200px" placeholder="自动" />
            </div>

            <div v-if="localOptions.axis.yAxis.show" :class="bem('row')">
              <span :class="bem('label')">Y 轴最大值</span>
              <InputNumber v-model:value="localOptions.axis.yAxis.max" size="small" style="width: 200px" placeholder="自动" />
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
  import { deepClone, createNamespace } from '#/utils';
  import { getDefaultBarChartOptions } from '../ChartStylesDefaultOptions/barChartDefaultOptions';
  import { Switch, Select, Segmented, Button, Input, InputNumber } from 'ant-design-vue';

  const [_, bem] = createNamespace('bar-chart-styles');

  interface Props {
    options: any;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    (e: 'update:options', options: any): void;
  }>();

  // 合并默认配置和传入的配置
  const localOptions = ref(
    deepClone({
      ...getDefaultBarChartOptions(),
      ...props.options,
    })
  );

  // 恢复默认设置
  const resetToDefaults = () => {
    const defaults = getDefaultBarChartOptions();
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
        localOptions.value = deepClone({
          ...getDefaultBarChartOptions(),
          ...newVal,
        });
      }
    },
    { deep: true }
  );
</script>

<style scoped lang="less">
  .dp-bar-chart-styles {
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
    }

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

    &__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    &__label {
      font-size: 13px;
      color: @text-color;
      flex-shrink: 0;
      min-width: 90px;
      font-weight: 500;
    }
  }
</style>
