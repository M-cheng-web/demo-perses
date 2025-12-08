<!-- 图表样式配置 - 柱状图 -->
<template>
  <div class="bar-chart-styles">
    <Divider>柱状图配置</Divider>

    <!-- 方向 -->
    <FormItem label="方向">
      <RadioGroup
        :options="[
          { label: '垂直', value: 'vertical' },
          { label: '水平', value: 'horizontal' },
        ]"
        v-model:value="specificOptions.orientation"
      />
    </FormItem>

    <!-- 柱状图模式 -->
    <FormItem mItem label="柱状图模式">
      <RadioGroup
        :options="[
          { label: '分组', value: 'group' },
          { label: '堆叠', value: 'stack' },
        ]"
        v-model:value="specificOptions.barMode"
      />
    </FormItem>

    <!-- 柱宽度 -->
    <FormItem label="柱宽度">
      <Input v-model:value="specificOptions.barWidth" placeholder="例如：60% 或 auto" />
    </FormItem>

    <Divider>坐标轴配置</Divider>

    <!-- X 轴 -->
    <FormItem label="显示 X 轴">
      <Switch v-model:checked="axisOptions.xAxis.show" />
    </FormItem>

    <FormItem v-if="axisOptions.xAxis.show" label="X 轴名称">
      <Input v-model:value="axisOptions.xAxis.name" placeholder="X 轴名称" />
    </FormItem>

    <!-- Y 轴 -->
    <FormItem label="显示 Y 轴">
      <Switch v-model:checked="axisOptions.yAxis.show" />
    </FormItem>

    <FormItem v-if="axisOptions.yAxis.show" label="Y 轴名称">
      <Input v-model:value="axisOptions.yAxis.name" placeholder="Y 轴名称" />
    </FormItem>

    <Row v-if="axisOptions.yAxis.show" :gutter="16">
      <Col :span="12">
        <FormItem label="Y 轴最小值">
          <InputNumber v-model:value="axisOptions.yAxis.min" style="width: 100%" placeholder="自动" />
        </FormItem>
      </Col>
      <Col :span="12">
        <FormItem label="Y 轴最大值">
          <InputNumber v-model:value="axisOptions.yAxis.max" style="width: 100%" placeholder="自动" />
        </FormItem>
      </Col>
    </Row>

    <Divider>图例配置</Divider>

    <!-- 图例显示 -->
    <FormItem label="显示图例">
      <Switch v-model:checked="legendOptions.show" />
    </FormItem>

    <FormItem v-if="legendOptions.show" label="图例位置">
      <Select
        :options="[
          { label: '顶部', value: 'top' },
          { label: '底部', value: 'bottom' },
          { label: '左侧', value: 'left' },
          { label: '右侧', value: 'right' },
        ]"
        v-model:value="legendOptions.position"
      />
    </FormItem>

    <Divider>格式化配置</Divider>

    <!-- 单位 -->
    <FormItem label="数值单位">
      <Select
        :options="[
          { label: '无', value: 'none' },
          { label: '百分比', value: 'percent' },
          { label: '字节', value: 'bytes' },
          { label: '短单位', value: 'short' },
          { label: '毫秒', value: 'ms' },
          { label: '秒', value: 's' },
        ]"
        v-model:value="formatOptions.unit"
      />
    </FormItem>

    <!-- 小数位数 -->
    <FormItem label="小数位数">
      <InputNumber v-model:value="formatOptions.decimals" :min="0" :max="6" style="width: 100%" />
    </FormItem>

    <Divider>颜色配置</Divider>

    <!-- 自定义颜色 -->
    <FormItem label="颜色列表（每行一个颜色）">
      <Textarea v-model:value="colorsText" placeholder="#5470c6&#10;#91cc75&#10;#fac858" :rows="4" />
    </FormItem>
  </div>
</template>

<script setup lang="ts">
  import { reactive, watch, computed } from 'vue';
  import type { PanelOptions } from '@/types';
  import { FormItem, RadioGroup, Input, InputNumber, Select, Textarea, Row, Col, Divider } from 'ant-design-vue';

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
