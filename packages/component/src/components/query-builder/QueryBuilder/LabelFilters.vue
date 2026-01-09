<!--
  @fileoverview 标签过滤器组件
  @description
    管理查询的标签过滤条件。
    主要功能：
    - 添加/删除标签过滤器
    - 选择标签键和值
    - 选择操作符（=, !=, =~, !~）
    - 支持正则表达式匹配
  @reference Grafana 源码
    grafana/public/app/plugins/datasource/prometheus-querybuilder/components/LabelFilters.tsx
  @props
    modelValue: QueryBuilderLabelFilter[], metric: string
  @emits
    update:modelValue, change
-->
<template>
  <div :class="bem()">
    <div v-if="filters.length === 0" :class="bem('empty')">
      <Button size="small" block :class="bem('add-btn')" @click="addFilter">
        <PlusOutlined />
        添加过滤条件
      </Button>
    </div>

    <div v-else :class="bem('list')">
      <div v-for="(filter, index) in filters" :key="index" :class="bem('item')">
        <Select
          v-model:value="filter.label"
          placeholder="标签名"
          show-search
          size="small"
          style="width: 140px"
          :options="labelOptions"
          @change="() => handleLabelChange(index)"
        />

        <Select v-model:value="filter.op" size="small" style="width: 124px" :options="operatorOptions" @change="handleFilterChange" />

        <Select
          v-model:value="filter.value"
          placeholder="标签值"
          show-search
          size="small"
          style="width: 140px"
          :loading="loadingValues[index]"
          :options="labelValueOptions[index] || []"
          @focus="() => loadLabelValues(index, filter.label)"
          @change="handleFilterChange"
        />

        <Button type="text" danger size="small" @click="removeFilter(index)">
          <CloseOutlined />
        </Button>
      </div>

      <Button size="small" :class="bem('add-btn')" @click="addFilter">
        <PlusOutlined />
        添加过滤条件
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Button, Select } from 'ant-design-vue';
  import { ref, watch, onMounted } from 'vue';
  import { PlusOutlined, CloseOutlined } from '@ant-design/icons-vue';
  import type { QueryBuilderLabelFilter } from '#/lib/prometheus-querybuilder/types';
  import { fetchLabelKeys, fetchLabelValues } from '#/api/querybuilder/prometheusApi';
  import { createNamespace } from '#/utils';

  const [_, bem] = createNamespace('label-filters');

  interface Props {
    modelValue: QueryBuilderLabelFilter[];
    metric?: string;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'update:modelValue', value: QueryBuilderLabelFilter[]): void;
  }>();

  const filters = ref<QueryBuilderLabelFilter[]>([...props.modelValue]);
  const labelOptions = ref<Array<{ label: string; value: string }>>([]);
  const labelValueOptions = ref<Record<number, Array<{ label: string; value: string }>>>({});
  const loadingKeys = ref(false);
  const loadingValues = ref<Record<number, boolean>>({});

  const operatorOptions = [
    { label: '= 等于', value: '=' },
    { label: '!= 不等于', value: '!=' },
    { label: '=~ 正则匹配', value: '=~' },
    { label: '!~ 正则不匹配', value: '!~' },
  ];

  // 加载标签键
  const loadLabelKeys = async () => {
    if (!props.metric) {
      labelOptions.value = [
        { label: 'instance', value: 'instance' },
        { label: 'job', value: 'job' },
      ];
      return;
    }

    loadingKeys.value = true;
    try {
      const keys = await fetchLabelKeys(props.metric);
      labelOptions.value = keys.map((k) => ({ label: k, value: k }));
    } catch (error) {
      console.error('Failed to load label keys:', error);
    } finally {
      loadingKeys.value = false;
    }
  };

  // 监听指标变化
  watch(
    () => props.metric,
    () => {
      loadLabelKeys();
    }
  );

  watch(
    () => props.modelValue,
    (newValue) => {
      filters.value = [...newValue];
    },
    { deep: true }
  );

  const addFilter = () => {
    filters.value.push({
      label: undefined as any,
      op: '=',
      value: undefined as any,
    });
    handleFilterChange();
  };

  const removeFilter = (index: number) => {
    filters.value.splice(index, 1);
    delete labelValueOptions.value[index];
    delete loadingValues.value[index];
    handleFilterChange();
  };

  const handleLabelChange = async (index: number) => {
    const filter = filters.value[index];
    if (!filter) return;

    // 清空值
    filter.value = undefined as any;

    if (filter.label) {
      await loadLabelValues(index, filter.label);
    }
    handleFilterChange();
  };

  const handleFilterChange = () => {
    emit('update:modelValue', filters.value);
  };

  const loadLabelValues = async (index: number, labelName: string) => {
    if (!labelName) return;

    loadingValues.value[index] = true;
    try {
      // 构建其他标签的键值对
      const otherLabels: Record<string, string> = {};
      filters.value.forEach((f, i) => {
        if (i !== index && f.label && f.value) {
          otherLabels[f.label] = f.value;
        }
      });

      const values = await fetchLabelValues(props.metric || '', labelName, otherLabels);
      labelValueOptions.value[index] = values.map((v) => ({ label: v, value: v }));
    } catch (error) {
      console.error('Failed to load label values:', error);
    } finally {
      loadingValues.value[index] = false;
    }
  };

  // 初始化
  onMounted(async () => {
    await loadLabelKeys();

    // 初始加载已有标签的值
    filters.value.forEach((filter, index) => {
      if (filter.label) {
        loadLabelValues(index, filter.label);
      }
    });
  });
</script>

<style scoped lang="less">
  .dp-label-filters {
    width: 100%;

    &__empty {
      width: 100%;
    }

    &__list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    &__item {
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 4px;
      background: #fafafa;
      border-radius: 2px;

      &:hover {
        background: #f5f5f5;
      }
    }

    &__add-btn {
      width: fit-content !important;
    }
  }
</style>
