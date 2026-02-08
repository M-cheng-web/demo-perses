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
      <Button block :class="bem('add-btn')" @click="addFilter">
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
          style="width: 140px"
          :options="labelOptions"
          @change="() => handleLabelChange(index)"
        />

        <Select v-model:value="filter.op" style="width: 124px" :options="operatorOptions" @change="handleFilterChange" />

        <Select
          :value="filter.value ? [filter.value] : []"
          mode="tags"
          :max-tag-count="1"
          placeholder="标签值（可输入 $var）"
          show-search
          style="width: 180px"
          :loading="loadingValues[index]"
          :options="labelValueOptions[index] || []"
          @dropdown-visible-change="handleValueDropdownVisibleChange(index, $event)"
          @update:value="handleValueChange(index, $event)"
        />

        <Button type="text" danger @click="removeFilter(index)">
          <CloseOutlined />
        </Button>
      </div>

      <Button :class="bem('add-btn')" @click="addFilter">
        <PlusOutlined />
        添加过滤条件
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Button, Select } from '@grafana-fast/component';
  import { ref, watch, onMounted } from 'vue';
  import { PlusOutlined, CloseOutlined } from '@ant-design/icons-vue';
  import type { QueryBuilderLabelFilter } from '@grafana-fast/utils';
  import { useApiClient } from '/#/runtime/useInjected';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('label-filters');
  const api = useApiClient();

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
      const keys = await api.query.fetchLabelKeys(props.metric);
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
      label: '',
      op: '=',
      value: '',
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
    filter.value = '';

    if (filter.label) {
      await loadLabelValues(index, filter.label);
    }
    handleFilterChange();
  };

  const handleValueChange = (index: number, value: unknown) => {
    const filter = filters.value[index];
    if (!filter) return;
    const values = Array.isArray(value) ? value : [];
    const last = values.length ? values[values.length - 1] : '';
    filter.value = last == null ? '' : String(last);
    handleFilterChange();
  };

  const handleValueDropdownVisibleChange = (index: number, open: boolean) => {
    if (!open) return;
    const filter = filters.value[index];
    if (!filter?.label) return;
    void loadLabelValues(index, filter.label);
  };

  const handleFilterChange = () => {
    emit('update:modelValue', filters.value);
  };

  const loadLabelValues = async (index: number, labelName: string) => {
    if (!labelName) return;

    loadingValues.value[index] = true;
    try {
      const looksLikeVariableRef = (value: string) => /\$\{|\[\[|\$[A-Za-z_]/.test(value);

      // 构建其他标签的键值对
      const otherLabels: Record<string, string> = {};
      filters.value.forEach((f, i) => {
        if (i !== index && f.label && f.value) {
          // 当 otherLabels 里含有变量引用（$var）时，后端通常无法识别；
          // 这里跳过它们，避免 fetchLabelValues 被“未解析变量”误导。
          const v = String(f.value);
          if (!looksLikeVariableRef(v)) otherLabels[f.label] = v;
        }
      });

      const values = await api.query.fetchLabelValues(props.metric || '', labelName, otherLabels);
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
      gap: 8px;
    }

    &__item {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 10px;
      background: var(--gf-color-surface-muted);
      border: 1px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-md);
      transition: all var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        background: var(--gf-color-fill);
        border-color: var(--gf-color-border);
      }
    }

    &__add-btn {
      width: fit-content !important;
      margin-top: 4px;
    }
  }
</style>
