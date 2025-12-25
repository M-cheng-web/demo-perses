<!-- 图表样式配置 - 仪表盘 -->
<template>
  <div class="gauge-chart-styles">
    <div class="styles-grid">
      <!-- 左侧列：格式配置 -->
      <div class="styles-column">
        <div class="section">
          <div class="section-header">格式</div>
          <div class="section-content">
            <div class="style-row">
              <span class="style-label">缩写数值</span>
              <Switch v-model:checked="localOptions.format.shortValues" size="small" />
            </div>

            <div class="style-row">
              <span class="style-label">单位</span>
              <Select
                :options="[
                  { label: '无', value: 'none' },
                  { label: '百分比 (0-100)', value: 'percent' },
                  { label: '百分比 (0.0-1.0)', value: 'percent-decimal' },
                  { label: '字节', value: 'bytes' },
                  { label: '毫秒', value: 'milliseconds' },
                  { label: '秒', value: 'seconds' },
                ]"
                v-model:value="localOptions.format.unit"
                size="small"
                style="width: 200px"
              />
            </div>

            <div class="style-row">
              <span class="style-label">小数位数</span>
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

            <div class="style-row">
              <span class="style-label">计算方式</span>
              <Select
                :options="[
                  { label: '最新值 *', value: 'last' },
                  { label: '首值', value: 'first' },
                  { label: '平均值', value: 'mean' },
                  { label: '最小值', value: 'min' },
                  { label: '最大值', value: 'max' },
                ]"
                v-model:value="localOptions.specific.calculation"
                size="small"
                style="width: 200px"
              />
            </div>

            <div class="style-row">
              <span class="style-label">最大值</span>
              <InputNumber v-model:value="localOptions.specific.max" size="small" style="width: 200px" placeholder="100" />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧列：阈值配置 -->
      <div class="styles-column">
        <div class="section">
          <div class="section-header">阈值</div>
          <div class="section-content">
            <div class="style-row">
              <span class="style-label">模式</span>
              <Segmented
                v-model:value="localOptions.thresholds.mode"
                :options="[
                  { label: '绝对值', value: 'absolute' },
                  { label: '百分比', value: 'percent' },
                ]"
                size="small"
              />
            </div>

            <div class="threshold-list">
              <div v-for="(threshold, index) in localOptions.thresholds.steps" :key="index" class="threshold-item">
                <span class="threshold-color" :style="{ backgroundColor: threshold.color }"></span>
                <span class="threshold-name">{{ threshold.name || `T${localOptions.thresholds.steps.length - index}` }}</span>
                <InputNumber
                  v-model:value="threshold.value"
                  size="small"
                  style="width: 130px"
                  :placeholder="threshold.name === 'Default' ? '' : '10'"
                />
                <Button v-if="index > 0" type="text" size="small" @click="removeThreshold(index)">
                  <template #icon><DeleteOutlined /></template>
                </Button>
              </div>
            </div>

            <Button type="dashed" size="small" block @click="addThreshold">
              <template #icon><PlusOutlined /></template>
              添加阈值
            </Button>

            <div class="style-row" style="margin-top: 12px">
              <span class="style-label">显示图例</span>
              <Switch v-model:checked="localOptions.thresholds.showLegend" size="small" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
  import { deepClone } from '@/utils';
  import { getDefaultGaugeChartOptions } from '../ChartStylesDefaultOptions/gaugeChartDefaultOptions';
  import { Switch, Segmented, Button, InputNumber, Select } from 'ant-design-vue';

  interface Props {
    options: any;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    (e: 'update:options', options: any): void;
  }>();

  const localOptions = ref(
    deepClone({
      ...getDefaultGaugeChartOptions(),
      ...props.options,
    })
  );

  const addThreshold = () => {
    const newIndex = localOptions.value.thresholds.steps.length;
    localOptions.value.thresholds.steps.splice(localOptions.value.thresholds.steps.length - 1, 0, {
      name: `T${newIndex}`,
      value: null,
      color: newIndex === 1 ? '#faad14' : '#f5222d',
    });
  };

  const removeThreshold = (index: number) => {
    localOptions.value.thresholds.steps.splice(index, 1);
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
          ...getDefaultGaugeChartOptions(),
          ...newVal,
        });
      }
    },
    { deep: true }
  );
</script>

<style scoped lang="less">
  .gauge-chart-styles {
    padding: 16px;
    height: 100%;
    overflow-y: auto;

    .styles-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }

    .styles-column {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .section {
      border: 1px solid @border-color;
      border-radius: 4px;
      overflow: hidden;
      background: @background-light;

      .section-header {
        padding: 12px 16px;
        border-bottom: 1px solid @border-color;
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.5px;
        color: @text-color-secondary;
        text-transform: uppercase;
        background: @background-base;
      }

      .section-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    }

    .style-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      .style-label {
        font-size: 13px;
        color: @text-color;
        flex-shrink: 0;
        min-width: 90px;
        font-weight: 500;
      }
    }

    .threshold-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 8px;
    }

    .threshold-item {
      display: flex;
      align-items: center;
      gap: 8px;

      .threshold-color {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .threshold-name {
        font-size: 13px;
        min-width: 50px;
        flex-shrink: 0;
      }

      :deep(.ant-input-number) {
        flex: 1;
      }
    }
  }
</style>
