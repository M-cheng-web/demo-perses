<!-- 图表样式配置 - 仪表盘 -->
<template>
  <div class="gauge-chart-styles">
    <!-- Misc 配置 -->
    <Collapse :bordered="false" default-active-key="misc" expand-icon-position="end">
      <CollapsePanel key="misc" header="其他">
        <div class="style-section">
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
      </CollapsePanel>

      <!-- Thresholds 配置 -->
      <CollapsePanel key="thresholds" header="阈值">
        <div class="style-section">
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
                style="width: 200px"
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

          <div class="style-row" style="margin-top: 16px">
            <span class="style-label">显示图例</span>
            <Switch v-model:checked="localOptions.thresholds.showLegend" size="small" />
          </div>
        </div>
      </CollapsePanel>
    </Collapse>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
  import { deepClone } from '@/utils';
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
      format: {
        unit: 'percent',
        decimals: 1,
        shortValues: false,
      },
      thresholds: {
        mode: 'percent',
        steps: [
          { name: 'T2', value: 25, color: '#f5222d' },
          { name: 'T1', value: 10, color: '#faad14' },
          { name: 'Default', value: null, color: '#52c41a' },
        ],
        showLegend: true,
      },
      specific: {
        calculation: 'last',
        max: 100,
      },
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

  watch(
    localOptions,
    (newVal) => {
      emit('update:options', deepClone(newVal));
    },
    { deep: true }
  );
</script>

<style scoped lang="less">
  .gauge-chart-styles {
    :deep(.ant-collapse) {
      background: transparent;
      border: none;

      .ant-collapse-item {
        border-bottom: 1px solid @border-color;

        &:last-child {
          border-bottom: none;
        }
      }

      .ant-collapse-header {
        padding: 12px 16px !important;
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.5px;
        color: @text-color-secondary;
      }

      .ant-collapse-content-box {
        padding: 12px 16px !important;
      }
    }

    .style-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
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
        min-width: 100px;
      }
    }

    .threshold-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }

    .threshold-item {
      display: flex;
      align-items: center;
      gap: 12px;

      .threshold-color {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .threshold-name {
        font-size: 13px;
        min-width: 60px;
        flex-shrink: 0;
      }

      :deep(.ant-input-number) {
        flex: 1;
      }
    }
  }
</style>
