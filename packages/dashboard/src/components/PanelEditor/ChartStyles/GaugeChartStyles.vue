<!-- 图表样式配置 - 仪表盘 -->
<template>
  <div :class="bem()">
    <div :class="bem('grid')">
      <!-- 左侧列：格式配置 & 仪表盘配置 -->
      <div :class="bem('column')">
        <!-- 格式配置 -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">格式</div>
          <div :class="bem('section-content')">
            <div :class="bem('row')">
              <span :class="bem('label')">缩写数值</span>
              <Switch v-model:checked="localOptions.format.shortValues" />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">单位</span>
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

            <div :class="bem('row')">
              <span :class="bem('label')">计算方式</span>
              <Select
                :options="[
                  { label: '最新值 *', value: 'last' },
                  { label: '首值', value: 'first' },
                  { label: '平均值', value: 'mean' },
                  { label: '最小值', value: 'min' },
                  { label: '最大值', value: 'max' },
                ]"
                v-model:value="localOptions.specific.calculation"
                style="width: 200px"
              />
            </div>
          </div>
        </div>

        <!-- 仪表盘配置 -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">仪表盘</div>
          <div :class="bem('section-content')">
            <div :class="bem('row')">
              <span :class="bem('label')">最小值</span>
              <InputNumber v-model:value="localOptions.specific.min" style="width: 200px" placeholder="0" />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">最大值</span>
              <InputNumber v-model:value="localOptions.specific.max" style="width: 200px" placeholder="100" />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">起始角度</span>
              <InputNumber
                v-model:value="localOptions.specific.startAngle"
                :min="-360"
                :max="360"
                style="width: 200px"
                placeholder="225"
              />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">结束角度</span>
              <InputNumber
                v-model:value="localOptions.specific.endAngle"
                :min="-360"
                :max="360"
                style="width: 200px"
                placeholder="-45"
              />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">刻度数量</span>
              <InputNumber v-model:value="localOptions.specific.splitNumber" :min="2" :max="20" style="width: 200px" placeholder="10" />
            </div>

            <div :class="bem('row')">
              <span :class="bem('label')">显示指针</span>
              <Switch v-model:checked="localOptions.specific.pointer.show" />
            </div>

            <div v-if="localOptions.specific.pointer.show" :class="bem('row')">
              <span :class="bem('label')">指针长度</span>
              <Select
                :options="[
                  { label: '40%', value: '40%' },
                  { label: '50%', value: '50%' },
                  { label: '60%', value: '60%' },
                  { label: '70%', value: '70%' },
                  { label: '80%', value: '80%' },
                ]"
                v-model:value="localOptions.specific.pointer.length"
                style="width: 200px"
              />
            </div>

            <div v-if="localOptions.specific.pointer.show" :class="bem('row')">
              <span :class="bem('label')">指针宽度</span>
              <InputNumber v-model:value="localOptions.specific.pointer.width" :min="2" :max="20" style="width: 200px" placeholder="8" />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧列：阈值配置 -->
      <div :class="bem('column')">
        <div :class="bem('section')">
          <div :class="bem('section-header')">阈值</div>
          <div :class="bem('section-content')">
            <div :class="bem('row')">
              <span :class="bem('label')">模式</span>
              <Segmented
                v-model:value="localOptions.thresholds.mode"
                :options="[
                  { label: '绝对值', value: 'absolute' },
                  { label: '百分比', value: 'percent' },
                ]"
              />
            </div>

            <div :class="bem('threshold-list')">
              <div :class="bem('threshold-header')">
                <span style="width: 28px"></span>
                <span style="width: 80px; font-size: 12px; color: #999">名称</span>
                <span style="width: 110px; font-size: 12px; color: #999">颜色</span>
                <span style="width: 110px; font-size: 12px; color: #999">阈值</span>
                <span style="width: 32px"></span>
              </div>
              <div v-for="(threshold, index) in localOptions.thresholds.steps" :key="index" :class="bem('threshold-item')">
                <span :class="bem('threshold-color')" :style="{ backgroundColor: threshold.color }"></span>
                <Input v-model:value="threshold.name" placeholder="阈值名称" style="width: 80px" :class="bem('threshold-control')" />
                <Input v-model:value="threshold.color" placeholder="#52c41a" style="width: 110px" :class="bem('threshold-control')" />
                <InputNumber
                  :value="threshold.value ?? undefined"
                  style="width: 110px"
                  :class="bem('threshold-control')"
                  placeholder="0"
                  @update:value="(v: number | null | undefined) => (threshold.value = v ?? null)"
                />
                <Button v-if="localOptions.thresholds.steps.length > 1" type="text" danger @click="removeThreshold(index)">
                  <template #icon><DeleteOutlined /></template>
                </Button>
              </div>
            </div>

            <Button type="dashed" block @click="addThreshold">
              <template #icon><PlusOutlined /></template>
              添加阈值
            </Button>
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
  import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
  import { getDefaultGaugeChartOptions } from '../ChartStylesDefaultOptions/gaugeChartDefaultOptions';
  import { useChartStyleDraft } from './useChartStyleDraft';
  import { Switch, Segmented, Button, InputNumber, Select, Input } from '@grafana-fast/component';

  const [_, bem] = createNamespace('gauge-chart-styles');

  interface Props {
    options: any;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    (e: 'update:options', options: any): void;
  }>();

  const { localOptions, resetToDefaults } = useChartStyleDraft({
    getOptions: () => props.options,
    getDefaults: getDefaultGaugeChartOptions,
    emitUpdate: (next) => emit('update:options', next),
  });

  /**
   * 将颜色从一种色调偏移到另一种色调（往危险色偏移）
   * @param color - 当前颜色（hex格式）
   * @returns 偏移后的颜色
   */
  const shiftColorToDanger = (color: string): string => {
    // 将 hex 转换为 RGB
    const hex = color.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // 往红色方向偏移：增加红色，减少绿色和蓝色
    r = Math.min(255, r + 40);
    g = Math.max(0, g - 25);
    b = Math.max(0, b - 25);

    // 转换回 hex
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const addThreshold = () => {
    const steps = localOptions.value.thresholds.steps;

    // 获取最后一个阈值的颜色和数值
    const lastThreshold = steps[steps.length - 1];
    let newColor = '#52c41a'; // 默认绿色
    let newValue = 0;

    if (lastThreshold) {
      // 基于最后一个阈值的颜色加深（往危险色偏移）
      newColor = shiftColorToDanger(lastThreshold.color);
      // 基于最后一个阈值的数值增加
      if (lastThreshold.value !== null && lastThreshold.value !== undefined) {
        newValue = lastThreshold.value + 20; // 增加20作为新阈值
      }
    }

    // 添加新阈值到列表末尾
    localOptions.value.thresholds.steps.push({
      name: `阈值${steps.length + 1}`,
      value: newValue,
      color: newColor,
    });
  };

  const removeThreshold = (index: number | string) => {
    const numericIndex = typeof index === 'string' ? Number(index) : index;
    if (!Number.isFinite(numericIndex)) {
      return;
    }
    // 确保至少保留一个阈值
    if (localOptions.value.thresholds.steps.length > 1) {
      localOptions.value.thresholds.steps.splice(numericIndex, 1);
    }
  };
</script>

<style scoped lang="less">
  .dp-gauge-chart-styles {
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

    &__threshold-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 8px;
    }

    &__threshold-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-weight: 500;
    }

    &__threshold-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    &__threshold-control {
      flex-shrink: 0;
    }

    &__threshold-color {
      width: 20px;
      height: 20px;
      border-radius: var(--gf-radius-sm);
      flex-shrink: 0;
      border: 1px solid var(--gf-color-border-muted);
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
    }
  }
</style>
