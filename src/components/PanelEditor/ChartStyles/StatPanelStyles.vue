<!-- 图表样式配置 - 统计面板 -->
<template>
  <div class="stat-panel-styles">
    <div class="styles-grid">
      <!-- 左侧列：显示 -->
      <div class="styles-column">
        <div class="section">
          <div class="section-header">显示</div>
          <div class="section-content">
            <div class="style-row">
              <span class="style-label">显示模式</span>
              <Segmented
                v-model:value="localOptions.specific.displayMode"
                :options="[
                  { label: '仅值', value: 'value-only' },
                  { label: '值和名称', value: 'value-and-name' },
                ]"
                size="small"
              />
            </div>

            <div class="style-row">
              <span class="style-label">方向</span>
              <Segmented
                v-model:value="localOptions.specific.orientation"
                :options="[
                  { label: '垂直', value: 'vertical' },
                  { label: '水平', value: 'horizontal' },
                ]"
                size="small"
              />
            </div>

            <div class="style-row">
              <span class="style-label">文本对齐</span>
              <Segmented
                v-model:value="localOptions.specific.textAlign"
                :options="[
                  { label: '左', value: 'left' },
                  { label: '中', value: 'center' },
                  { label: '右', value: 'right' },
                ]"
                size="small"
              />
            </div>

            <div class="style-row">
              <span class="style-label">显示趋势</span>
              <Switch v-model:checked="localOptions.specific.showTrend" size="small" />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧列：格式化 -->
      <div class="styles-column">
        <div class="section">
          <div class="section-header">格式化</div>
          <div class="section-content">
            <div class="style-row">
              <span class="style-label">单位</span>
              <Select
                :options="[
                  { label: '无', value: 'none' },
                  { label: '百分比 (0.0-1.0)', value: 'percent' },
                  { label: '百分比 (0-100)', value: 'percent-decimal' },
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
          </div>
        </div>

        <!-- 重置设置 -->
        <div class="section">
          <div class="section-header">重置设置</div>
          <div class="section-content">
            <Button type="default" size="middle" block @click="resetToDefaults"> 恢复默认设置 </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { deepClone } from '@/utils';
  import { getDefaultStatPanelOptions } from '../ChartStylesDefaultOptions/statPanelDefaultOptions';
  import { Switch, Select, Segmented, Button } from 'ant-design-vue';

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
      ...getDefaultStatPanelOptions(),
      ...props.options,
    })
  );

  // 恢复默认设置
  const resetToDefaults = () => {
    const defaults = getDefaultStatPanelOptions();
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
          ...getDefaultStatPanelOptions(),
          ...newVal,
        });
      }
    },
    { deep: true }
  );
</script>

<style scoped lang="less">
  .stat-panel-styles {
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
  }
</style>
