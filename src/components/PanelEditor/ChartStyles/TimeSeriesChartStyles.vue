<template>
  <div class="timeseries-chart-styles">
    <!-- Legend 配置 -->
    <a-collapse :bordered="false" default-active-key="legend" expand-icon-position="end">
      <a-collapse-panel key="legend" header="图例">
        <div class="style-section">
          <div class="style-row">
            <span class="style-label">显示</span>
            <a-switch v-model:checked="localOptions.legend.show" size="small" />
          </div>

          <div class="style-row">
            <span class="style-label">位置</span>
            <a-select v-model:value="localOptions.legend.position" size="small" style="width: 200px">
              <a-select-option value="bottom">底部</a-select-option>
              <a-select-option value="top">顶部</a-select-option>
              <a-select-option value="left">左侧</a-select-option>
              <a-select-option value="right">右侧</a-select-option>
            </a-select>
          </div>

          <div class="style-row">
            <span class="style-label">模式</span>
            <a-segmented
              v-model:value="localOptions.legend.mode"
              :options="[
                { label: '列表', value: 'list' },
                { label: '表格', value: 'table' },
              ]"
              size="small"
            />
          </div>

          <div class="style-row">
            <span class="style-label">大小</span>
            <a-select v-model:value="localOptions.legend.size" size="small" style="width: 200px">
              <a-select-option value="small">小</a-select-option>
              <a-select-option value="medium">中</a-select-option>
            </a-select>
          </div>

          <div class="style-row">
            <span class="style-label">显示值</span>
            <a-select v-model:value="localOptions.legend.values" mode="multiple" size="small" style="width: 200px" placeholder="最小值 +2">
              <a-select-option value="min">最小值</a-select-option>
              <a-select-option value="max">最大值</a-select-option>
              <a-select-option value="mean">平均值</a-select-option>
              <a-select-option value="last">最新值</a-select-option>
              <a-select-option value="first">首值</a-select-option>
            </a-select>
          </div>
        </div>
      </a-collapse-panel>

      <!-- Y Axis 配置 -->
      <a-collapse-panel key="yaxis" header="Y 轴">
        <div class="style-section">
          <div class="style-row">
            <span class="style-label">显示</span>
            <a-switch v-model:checked="localOptions.axis.yAxis.show" size="small" />
          </div>

          <div class="style-row">
            <span class="style-label">缩写数值</span>
            <a-switch v-model:checked="localOptions.format.shortValues" size="small" />
          </div>

          <div class="style-row">
            <span class="style-label">单位</span>
            <a-select v-model:value="localOptions.format.unit" size="small" style="width: 200px">
              <a-select-option value="none">无</a-select-option>
              <a-select-option value="percent">百分比 (0.0-1.0)</a-select-option>
              <a-select-option value="percent-decimal">百分比 (0-100)</a-select-option>
              <a-select-option value="bytes">字节</a-select-option>
              <a-select-option value="milliseconds">毫秒</a-select-option>
              <a-select-option value="seconds">秒</a-select-option>
            </a-select>
          </div>

          <div class="style-row">
            <span class="style-label">小数位数</span>
            <a-select v-model:value="localOptions.format.decimals" size="small" style="width: 200px">
              <a-select-option value="default">默认</a-select-option>
              <a-select-option :value="0">0</a-select-option>
              <a-select-option :value="1">1</a-select-option>
              <a-select-option :value="2">2</a-select-option>
              <a-select-option :value="3">3</a-select-option>
              <a-select-option :value="4">4</a-select-option>
            </a-select>
          </div>

          <div class="style-row">
            <span class="style-label">标签</span>
            <a-input v-model:value="localOptions.axis.yAxis.name" size="small" placeholder="出 (-) / 入 (+)" />
          </div>

          <div class="style-row">
            <span class="style-label">最小值</span>
            <a-input-number v-model:value="localOptions.axis.yAxis.min" size="small" style="width: 200px" placeholder="默认" />
          </div>

          <div class="style-row">
            <span class="style-label">最大值</span>
            <a-input-number v-model:value="localOptions.axis.yAxis.max" size="small" style="width: 200px" placeholder="默认" />
          </div>
        </div>
      </a-collapse-panel>

      <!-- Thresholds 配置 -->
      <a-collapse-panel key="thresholds" header="阈值">
        <div class="style-section">
          <div class="style-row">
            <span class="style-label">模式</span>
            <a-segmented
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
              <a-input-number
                v-model:value="threshold.value"
                size="small"
                style="width: 200px"
                :placeholder="threshold.name === 'Default' ? '' : '25'"
              />
              <a-button v-if="index > 0" type="text" size="small" @click="removeThreshold(index)">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
          </div>

          <a-button type="dashed" size="small" block @click="addThreshold">
            <template #icon><PlusOutlined /></template>
            添加阈值
          </a-button>

          <div class="style-row" style="margin-top: 16px">
            <span class="style-label">显示图例</span>
            <a-switch v-model:checked="localOptions.thresholds.showLegend" size="small" />
          </div>
        </div>
      </a-collapse-panel>

      <!-- Visual 配置 -->
      <a-collapse-panel key="visual" header="视觉">
        <div class="style-section">
          <div class="style-row">
            <span class="style-label">堆叠模式</span>
            <a-select v-model:value="localOptions.specific.stackMode" size="small" style="width: 200px">
              <a-select-option value="none">无</a-select-option>
              <a-select-option value="normal">普通</a-select-option>
              <a-select-option value="percent">百分比</a-select-option>
            </a-select>
          </div>

          <div class="style-row">
            <span class="style-label">显示类型</span>
            <a-segmented
              v-model:value="localOptions.specific.mode"
              :options="[
                { label: '折线', value: 'line' },
                { label: '柱状', value: 'bar' },
              ]"
              size="small"
            />
          </div>

          <div class="style-row">
            <span class="style-label">线宽</span>
            <a-slider v-model:value="localOptions.chart.line.width" :min="1" :max="10" :step="0.5" style="width: 250px" />
          </div>

          <div class="style-row">
            <span class="style-label">线条样式</span>
            <a-segmented
              v-model:value="localOptions.chart.line.type"
              :options="[
                { label: '实线', value: 'solid' },
                { label: '虚线', value: 'dashed' },
                { label: '点线', value: 'dotted' },
              ]"
              size="small"
            />
          </div>

          <div class="style-row">
            <span class="style-label">区域透明度</span>
            <a-slider v-model:value="localOptions.specific.fillOpacity" :min="0" :max="1" :step="0.1" style="width: 250px" />
          </div>

          <div class="style-row">
            <span class="style-label">连接空值</span>
            <a-switch v-model:checked="localOptions.chart.connectNulls" size="small" />
          </div>
        </div>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
  import { deepClone } from '@/utils';

  interface Props {
    options: any;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    (e: 'update:options', options: any): void;
  }>();

  const localOptions = ref(
    deepClone({
      legend: {
        show: true,
        position: 'bottom',
        mode: 'list',
        size: 'medium',
        values: [],
      },
      axis: {
        yAxis: {
          show: true,
          name: '',
          min: undefined,
          max: undefined,
        },
      },
      format: {
        unit: 'none',
        decimals: 'default',
        shortValues: false,
      },
      thresholds: {
        mode: 'absolute',
        steps: [{ name: 'Default', value: null, color: '#52c41a' }],
        showLegend: true,
      },
      chart: {
        line: {
          width: 2,
          type: 'solid',
        },
        connectNulls: false,
      },
      specific: {
        mode: 'line',
        stackMode: 'none',
        fillOpacity: 0.3,
      },
      ...props.options,
    })
  );

  const addThreshold = () => {
    const newIndex = localOptions.value.thresholds.steps.length;
    localOptions.value.thresholds.steps.push({
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
  .timeseries-chart-styles {
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
