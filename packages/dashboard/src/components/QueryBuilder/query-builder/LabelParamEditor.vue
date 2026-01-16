<!--
  @fileoverview 标签参数编辑器
  @description
    用于编辑聚合操作的标签参数（如 sum by(label)）。
    主要功能：
    - 下拉选择可用标签
    - 异步加载标签列表
    - 基于当前查询上下文过滤标签
  @reference Grafana 源码
    grafana/public/app/plugins/datasource/prometheus-querybuilder/components/PromQueryBuilderOptions.tsx
  @props
    modelValue: string, queryString: string
  @emits
    update:modelValue
-->
<template>
  <Select
    v-model:value="localValue"
    :options="labelOptions"
    :loading="loading"
    placeholder="选择标签"
    show-search
    allow-clear
    :filter-option="filterOption"
    :not-found-content="loading ? '加载中...' : '未找到标签'"
    @change="(value: any) => handleChange(value as string)"
    @dropdown-visible-change="handleDropdownVisibleChange"
    size="small"
    style="min-width: 120px"
  />
</template>

<script setup lang="ts">
  import { Select } from '@grafana-fast/component';
  import { ref, watch } from 'vue';
  import { useApiClient } from '/#/runtime/useInjected';
  import { promQueryModeller } from '/#/components/QueryBuilder/lib/PromQueryModeller';

  interface Props {
    modelValue: string;
    index: number;
    query?: any;
    datasource?: any;
  }

  interface Emits {
    (e: 'update:modelValue', value: string): void;
    (e: 'change', value: string): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const localValue = ref(props.modelValue);
  const labelOptions = ref<{ label: string; value: string }[]>([]);
  const loading = ref(false);
  const labelsLoaded = ref(false);
  const api = useApiClient();

  watch(
    () => props.modelValue,
    (newValue) => {
      localValue.value = newValue;
    }
  );

  // 当下拉框打开时加载标签
  const handleDropdownVisibleChange = async (visible: boolean) => {
    if (visible && !labelsLoaded.value) {
      await loadLabels();
    }
  };

  // 加载标签列表
  const loadLabels = async () => {
    loading.value = true;
    try {
      // 构建当前查询的标签选择器表达式
      const expr = buildLabelSelectorExpr();
      const metricFromSelector = expr.match(/__name__\\s*=\\s*\"([^\"]+)\"/)?.[1];
      const metric = metricFromSelector || props.query?.metric || '';

      // 获取可用的标签键（Prometheus-like）
      const labels = metric ? await api.query.fetchLabelKeys(metric) : ['instance', 'job'];

      labelOptions.value = labels.map((label) => ({
        label,
        value: label,
      }));

      labelsLoaded.value = true;
    } catch (error) {
      console.error('Failed to load labels:', error);
      // 失败时使用默认标签
      labelOptions.value = [
        { label: 'instance', value: 'instance' },
        { label: 'job', value: 'job' },
        { label: 'pod', value: 'pod' },
        { label: 'namespace', value: 'namespace' },
      ];
    } finally {
      loading.value = false;
    }
  };

  // 构建标签选择器表达式（用于查询可用标签）
  const buildLabelSelectorExpr = (): string => {
    if (!props.query) {
      return '';
    }

    try {
      // 构建包含 __name__ 和现有标签的选择器
      const labels = [{ label: '__name__', op: '=', value: props.query.metric }, ...props.query.labels];

      // 渲染标签选择器
      return promQueryModeller.renderLabels(labels);
    } catch (error) {
      console.error('Failed to build label selector:', error);
      return '';
    }
  };

  const handleChange = (value: string) => {
    emit('update:modelValue', value);
    emit('change', value);
  };

  const filterOption = (input: string, option: any) => {
    return option.value.toLowerCase().includes(input.toLowerCase());
  };
</script>

<style scoped></style>
