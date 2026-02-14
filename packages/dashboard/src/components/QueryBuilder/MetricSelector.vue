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
        :loading="loading"
        @change="handleSelectChange"
        @search="handleSearch"
        :filter-option="filterOption"
      />
      <Button size="middle" :class="bem('btn')" @click="openMetricsModal">
        <AppstoreOutlined />
        浏览
      </Button>
    </div>

    <!-- 指标浏览器弹窗 -->
    <MetricsModal v-model:open="modalOpen" @select="handleMetricSelect" />
  </div>
</template>

<script setup lang="ts">
  import { Button, Select, message } from '@grafana-fast/component';
  import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue';
  import { AppstoreOutlined } from '@ant-design/icons-vue';
  import { useApiClient } from '/#/runtime/useInjected';
  import MetricsModal from './MetricsModal.vue';
  import { createNamespace, debounceCancellable } from '/#/utils';

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
  const api = useApiClient();
  let requestToken = 0;

  const metricOptions = computed(() => {
    return metrics.value.map((metric) => ({
      label: metric,
      value: metric,
    }));
  });

  const handleChange = (value: string) => {
    emit('update:modelValue', value);
  };

  const handleSelectChange = (value: unknown) => {
    const next = typeof value === 'string' ? value : String(value ?? '');
    handleChange(next);
  };

  const filterOption = (input: string, option: unknown) => {
    const label = String((option as { label?: unknown } | null)?.label ?? '');
    return label.toLowerCase().includes(input.toLowerCase());
  };

  const loadMetrics = async (search?: string) => {
    const token = (requestToken = requestToken + 1);
    loading.value = true;
    try {
      const list = await api.query.fetchMetrics(search);
      if (token !== requestToken) return;
      metrics.value = list;
    } catch (error) {
      if (token !== requestToken) return;
      metrics.value = [];
      const msg = error instanceof Error ? error.message : String(error);
      message.error({ content: `加载指标失败：${msg}`, key: 'querybuilder:metrics', duration: 3 });
      console.error('Failed to load metrics:', error);
    } finally {
      if (token === requestToken) loading.value = false;
    }
  };

  const debouncedLoadMetrics = debounceCancellable((search?: string) => {
    const q = typeof search === 'string' ? search.trim() : undefined;
    void loadMetrics(q || undefined);
  }, 260);

  const handleSearch = (value: string) => {
    debouncedLoadMetrics(value);
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

  onBeforeUnmount(() => {
    debouncedLoadMetrics.cancel();
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
    gap: 8px;
  }

  .dp-metric-selector__select {
    flex: 1;
    min-width: 0;
  }

  .dp-metric-selector__btn {
    flex-shrink: 0;
  }
</style>
