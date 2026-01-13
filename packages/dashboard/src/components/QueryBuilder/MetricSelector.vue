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
    <div :class="bem('group')">
      <Select
        v-model:value="selectedMetric"
        show-search
        placeholder="选择指标"
        :class="bem('select')"
        :options="metricOptions"
        @change="(value: any) => handleChange(value as string)"
        :filter-option="filterOption"
      />
      <Button :class="bem('btn')" @click="openMetricsModal">
        <AppstoreOutlined />
        浏览
      </Button>
    </div>

    <!-- 指标浏览器弹窗 -->
    <MetricsModal v-model:open="modalOpen" @select="handleMetricSelect" />
  </div>
</template>

<script setup lang="ts">
  import { Button, Select } from '@grafana-fast/component';
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

  .dp-metric-selector__group {
    width: 100%;
    display: flex;
    align-items: stretch;
  }

  .dp-metric-selector__select {
    flex: 1;
    min-width: 0;
  }

  .dp-metric-selector__group :deep(.gf-select__control) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .dp-metric-selector__btn {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    margin-left: -1px;
  }
</style>
