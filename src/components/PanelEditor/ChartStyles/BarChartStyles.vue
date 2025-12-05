<!-- 图表样式配置 - 柱状图 -->
<template>
  <div class="bar-chart-styles">
    <a-divider>柱状图配置</a-divider>

    <!-- 方向 -->
    <a-form-item label="方向">
      <a-radio-group v-model:value="specificOptions.orientation">
        <a-radio-button value="vertical">垂直</a-radio-button>
        <a-radio-button value="horizontal">水平</a-radio-button>
      </a-radio-group>
    </a-form-item>

    <!-- 柱状图模式 -->
    <a-form-item label="柱状图模式">
      <a-radio-group v-model:value="specificOptions.barMode">
        <a-radio-button value="group">分组</a-radio-button>
        <a-radio-button value="stack">堆叠</a-radio-button>
      </a-radio-group>
    </a-form-item>

    <!-- 柱宽度 -->
    <a-form-item label="柱宽度">
      <a-input v-model:value="specificOptions.barWidth" placeholder="例如：60% 或 auto" />
    </a-form-item>

    <a-divider>坐标轴配置</a-divider>

    <!-- X 轴 -->
    <a-form-item label="显示 X 轴">
      <a-switch v-model:checked="axisOptions.xAxis.show" />
    </a-form-item>

    <a-form-item v-if="axisOptions.xAxis.show" label="X 轴名称">
      <a-input v-model:value="axisOptions.xAxis.name" placeholder="X 轴名称" />
    </a-form-item>

    <!-- Y 轴 -->
    <a-form-item label="显示 Y 轴">
      <a-switch v-model:checked="axisOptions.yAxis.show" />
    </a-form-item>

    <a-form-item v-if="axisOptions.yAxis.show" label="Y 轴名称">
      <a-input v-model:value="axisOptions.yAxis.name" placeholder="Y 轴名称" />
    </a-form-item>

    <a-row v-if="axisOptions.yAxis.show" :gutter="16">
      <a-col :span="12">
        <a-form-item label="Y 轴最小值">
          <a-input-number v-model:value="axisOptions.yAxis.min" style="width: 100%" placeholder="自动" />
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <a-form-item label="Y 轴最大值">
          <a-input-number v-model:value="axisOptions.yAxis.max" style="width: 100%" placeholder="自动" />
        </a-form-item>
      </a-col>
    </a-row>

    <a-divider>图例配置</a-divider>

    <!-- 图例显示 -->
    <a-form-item label="显示图例">
      <a-switch v-model:checked="legendOptions.show" />
    </a-form-item>

    <a-form-item v-if="legendOptions.show" label="图例位置">
      <a-select v-model:value="legendOptions.position">
        <a-select-option value="top">顶部</a-select-option>
        <a-select-option value="bottom">底部</a-select-option>
        <a-select-option value="left">左侧</a-select-option>
        <a-select-option value="right">右侧</a-select-option>
      </a-select>
    </a-form-item>

    <a-divider>格式化配置</a-divider>

    <!-- 单位 -->
    <a-form-item label="数值单位">
      <a-select v-model:value="formatOptions.unit">
        <a-select-option value="none">无</a-select-option>
        <a-select-option value="percent">百分比 (%)</a-select-option>
        <a-select-option value="bytes">字节 (B)</a-select-option>
        <a-select-option value="short">短单位 (K/M/B)</a-select-option>
        <a-select-option value="ms">毫秒 (ms)</a-select-option>
        <a-select-option value="s">秒 (s)</a-select-option>
      </a-select>
    </a-form-item>

    <!-- 小数位数 -->
    <a-form-item label="小数位数">
      <a-input-number v-model:value="formatOptions.decimals" :min="0" :max="6" style="width: 100%" />
    </a-form-item>

    <a-divider>颜色配置</a-divider>

    <!-- 自定义颜色 -->
    <a-form-item label="颜色列表（每行一个颜色）">
      <a-textarea v-model:value="colorsText" placeholder="#5470c6&#10;#91cc75&#10;#fac858" :rows="4" />
    </a-form-item>
  </div>
</template>

<script setup lang="ts">
  import { reactive, watch, computed } from 'vue';
  import type { PanelOptions } from '@/types';

  const props = defineProps<{
    options: PanelOptions;
  }>();

  const emit = defineEmits<{
    (e: 'update:options', value: PanelOptions): void;
  }>();

  // 初始化配置
  const specificOptions = reactive({
    orientation: (props.options.specific as any)?.orientation || 'vertical',
    barMode: (props.options.specific as any)?.barMode || 'group',
    barWidth: (props.options.specific as any)?.barWidth || '60%',
  });

  const axisOptions = reactive({
    xAxis: {
      show: props.options.axis?.xAxis?.show ?? true,
      name: props.options.axis?.xAxis?.name || '',
    },
    yAxis: {
      show: props.options.axis?.yAxis?.show ?? true,
      name: props.options.axis?.yAxis?.name || '',
      min: props.options.axis?.yAxis?.min,
      max: props.options.axis?.yAxis?.max,
    },
  });

  const legendOptions = reactive({
    show: props.options.legend?.show ?? true,
    position: props.options.legend?.position || 'bottom',
  });

  const formatOptions = reactive({
    unit: props.options.format?.unit || 'none',
    decimals: props.options.format?.decimals ?? 2,
  });

  // 颜色列表文本
  const colorsText = computed({
    get: () => (props.options.chart?.colors || []).join('\n'),
    set: (value: string) => {
      const colors = value.split('\n').filter((c) => c.trim());
      updateOptions({ chart: { ...props.options.chart, colors } });
    },
  });

  // 更新配置
  const updateOptions = (updates: Partial<PanelOptions>) => {
    emit('update:options', {
      ...props.options,
      ...updates,
    });
  };

  // 监听配置变化
  watch(
    [specificOptions, axisOptions, legendOptions, formatOptions],
    () => {
      updateOptions({
        specific: { ...specificOptions },
        axis: { ...axisOptions },
        legend: { ...legendOptions },
        format: { ...formatOptions },
      });
    },
    { deep: true }
  );
</script>

<style scoped lang="less">
  .bar-chart-styles {
    :deep(.ant-divider) {
      margin: @spacing-md 0;
    }
  }
</style>
