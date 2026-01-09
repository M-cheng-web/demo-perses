<!--
  @fileoverview 指标选择器组件
  @description
    用于选择 Prometheus 指标名称。
    主要功能：
    - 下拉选择指标
    - 搜索过滤指标
    - 打开指标浏览器（MetricsModal）
  @reference Grafana 源码
    grafana/public/app/plugins/datasource/prometheus-querybuilder/components/MetricSelect.tsx
  @props
    modelValue: string
  @emits
    update:modelValue, change
-->
<template>
  <div :class="bem()">
    <a-input-group compact style="display: flex">
      <Select
        v-model:value="selectedMetric"
        show-search
        placeholder="选择指标"
        style="flex: 1"
        :options="metricOptions"
        @change="(value: any) => handleChange(value as string)"
        :filter-option="filterOption"
      />
      <Button @click="openMetricsModal">
        <AppstoreOutlined />
        浏览
      </Button>
    </a-input-group>

    <!-- 指标浏览器弹窗 -->
    <MetricsModal v-model:open="modalOpen" @select="handleMetricSelect" />
  </div>
</template>

<script setup lang="ts">
  import { Button, Select } from 'ant-design-vue';
  import { ref, computed, onMounted, watch } from 'vue';
  import { AppstoreOutlined } from '@ant-design/icons-vue';
  import { fetchMetrics } from '/#/api/querybuilder/prometheusApi';
  import MetricsModal from './MetricsModal.vue';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('metric-selector');

  interface Props {
    modelValue?: string;
  }

  interface Emits {
    (e: 'update:modelValue', value: string): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const selectedMetric = ref(props.modelValue || undefined);
  const metrics = ref<string[]>([]);
  const loading = ref(false);
  const modalOpen = ref(false);

  const metricOptions = computed(() => {
    return metrics.value.map((metric) => ({
      label: metric,
      value: metric,
    }));
  });

  const handleChange = (value: string) => {
    emit('update:modelValue', value);
  };

  const filterOption = (input: string, option: any) => {
    return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
  };

  const loadMetrics = async (search?: string) => {
    loading.value = true;
    try {
      metrics.value = await fetchMetrics(search);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      loading.value = false;
    }
  };

  watch(
    () => props.modelValue,
    (newValue) => {
      selectedMetric.value = newValue || undefined;
    }
  );

  const openMetricsModal = () => {
    modalOpen.value = true;
  };

  const handleMetricSelect = (metricName: string) => {
    selectedMetric.value = metricName;
    emit('update:modelValue', metricName);
  };

  onMounted(() => {
    loadMetrics();
  });
</script>

<style scoped lang="less">
  .dp-metric-selector {
    width: 100%;
  }
</style>
