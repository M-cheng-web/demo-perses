<!-- 图表样式配置 - 时间序列图 -->
<template>
  <div class="timeseries-chart-styles">
    <div class="styles-grid">
      <!-- 左侧列：图例 + 视觉 -->
      <div class="styles-column">
        <!-- 图例 -->
        <div class="section">
          <div class="section-header">图例</div>
          <div class="section-content">
            <div class="style-row">
              <span class="style-label">显示</span>
              <a-switch v-model:checked="localOptions.legend.show" size="small" />
            </div>

            <div class="style-row">
              <span class="style-label">位置</span>
              <a-select v-model:value="localOptions.legend.position" size="small" style="width: 200px">
                <a-select-option value="bottom">底部</a-select-option>
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

            <!-- 表格模式下显示"显示值"选项 -->
            <div v-if="localOptions.legend.mode === 'table'" class="style-row">
              <span class="style-label">显示值</span>
              <a-select v-model:value="localOptions.legend.values" mode="multiple" size="small" style="width: 200px" placeholder="请选择">
                <a-select-option value="min">最小值</a-select-option>
                <a-select-option value="max">最大值</a-select-option>
                <a-select-option value="mean">平均值</a-select-option>
                <a-select-option value="last">最新值</a-select-option>
                <a-select-option value="first">首值</a-select-option>
              </a-select>
            </div>
          </div>
        </div>

        <!-- 视觉 -->
        <div class="section">
          <div class="section-header">视觉</div>
          <div class="section-content">
            <!-- 显示类型 - 放在第一行 -->
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

            <!-- 柱状图模式：显示堆叠开关 -->
            <template v-if="localOptions.specific.mode === 'bar'">
              <div class="style-row">
                <span class="style-label">开启堆叠</span>
                <a-switch
                  :checked="localOptions.specific.stackMode !== 'none'"
                  @change="(checked: boolean) => (localOptions.specific.stackMode = checked ? 'normal' : 'none')"
                  size="small"
                />
              </div>
            </template>

            <!-- 折线图模式：显示线条相关配置 -->
            <template v-else>
              <div class="style-row">
                <span class="style-label">线宽</span>
                <div style="flex: 1; display: flex; align-items: center; gap: 12px">
                  <a-slider v-model:value="localOptions.chart.line.width" :min="1" :max="10" :step="0.5" style="flex: 1" />
                  <span class="slider-value">{{ localOptions.chart.line.width }}</span>
                </div>
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
                <div style="flex: 1; display: flex; align-items: center; gap: 12px">
                  <a-slider v-model:value="localOptions.specific.fillOpacity" :min="0" :max="1" :step="0.1" style="flex: 1" />
                  <span class="slider-value">{{ localOptions.specific.fillOpacity.toFixed(1) }}</span>
                </div>
              </div>

              <div class="style-row">
                <span class="style-label">连接空值</span>
                <a-switch v-model:checked="localOptions.chart.connectNulls" size="small" />
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 右侧列：Y 轴 -->
      <div class="styles-column">
        <div class="section">
          <div class="section-header">Y 轴</div>
          <div class="section-content">
            <div class="style-row">
              <span class="style-label">显示</span>
              <a-switch v-model:checked="localOptions.axis.yAxis.show" size="small" />
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
              <a-input v-model:value="localOptions.axis.yAxis.name" size="small" placeholder="Y 轴标签" style="width: 200px" />
            </div>

            <div class="style-row">
              <span class="style-label">最小值</span>
              <a-input-number v-model:value="localOptions.axis.yAxis.min" size="small" style="width: 200px" placeholder="自动" />
            </div>

            <div class="style-row">
              <span class="style-label">最大值</span>
              <a-input-number v-model:value="localOptions.axis.yAxis.max" size="small" style="width: 200px" placeholder="自动" />
            </div>
          </div>
        </div>

        <!-- 重置设置 -->
        <div class="section">
          <div class="section-header">重置设置</div>
          <div class="section-content">
            <a-button type="default" size="middle" block @click="resetToDefaults"> 恢复默认设置 </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { deepClone } from '@/utils';
  import { getDefaultTimeSeriesOptions } from './timeSeriesDefaultOptions';

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
      ...getDefaultTimeSeriesOptions(),
      ...props.options,
    })
  );

  // 恢复默认设置
  const resetToDefaults = () => {
    const defaults = getDefaultTimeSeriesOptions();
    localOptions.value = deepClone(defaults);
    emit('update:options', deepClone(defaults));
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

      .slider-value {
        font-size: 13px;
        color: @text-color-secondary;
        min-width: 30px;
        text-align: right;
      }
    }
  }
</style>
