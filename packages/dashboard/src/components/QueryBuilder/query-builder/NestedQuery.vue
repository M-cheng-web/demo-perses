<!--
  @fileoverview 嵌套查询组件（二元运算）
  @description
    用于二元查询的嵌套子查询，支持无限递归嵌套。
    主要功能：
    - 二元运算符选择（+, -, *, /, %, ^, ==, !=, >, <, >=, <=）
    - Vector Matching 配置（on/ignoring + labels）
    - 递归渲染子查询（支持无限嵌套深度）
    - 完整的查询构建器集成
  @reference Grafana 源码
    grafana/public/app/plugins/datasource/prometheus-querybuilder/components/NestedQuery.tsx
  @props
    nestedQuery: PromVisualQueryBinary, datasource: string
  @emits
    update, remove
-->
<template>
  <div class="nested-query">
    <div class="nested-query-header">
      <span class="header-label">运算符</span>
      <Select v-model:value="localQuery.operator" :options="operatorOptions" style="width: 80px" @change="handleOperatorChange" />

      <span class="header-label" style="margin-left: 16px">向量匹配</span>
      <Select v-model:value="vectorMatchType" :options="vectorMatchTypeOptions" style="width: 100px" @change="handleChange" />

      <Input v-model:value="vectorMatchLabels" placeholder="label1, label2" style="width: 200px; margin-left: 8px" @change="handleChange" />

      <div style="flex: 1"></div>

      <Button size="small" type="text" danger @click="handleRemove">
        <template #icon><CloseOutlined /></template>
      </Button>
    </div>

    <div class="nested-query-body">
      <Card :bordered="false">
        <!-- 指标选择 -->
        <div class="section">
          <div class="section-label">指标</div>
          <MetricSelector v-model="localQuery.query.metric" @change="handleChange" />
        </div>

        <!-- 标签过滤器 -->
        <div class="section">
          <LabelFilters v-model="localQuery.query.labels" :metric="localQuery.query.metric" @change="handleChange" />
        </div>

        <!-- 操作列表 -->
        <div class="section">
          <OperationsList
            v-model="localQuery.query.operations"
            :current-query="localQuery.query"
            :datasource="datasource"
            @update:model-value="handleChange"
            @query-update="handleNestedQueryUpdate"
          />
        </div>

        <!-- 查询解释（在 Operations 之后，嵌套二元查询之前）-->
        <QueryExplain v-if="showExplain && localQuery.query.metric" :query="localQuery.query" />

        <!-- 嵌套的二元查询（支持无限嵌套）-->
        <div v-if="localQuery.query.binaryQueries && localQuery.query.binaryQueries.length > 0" class="section">
          <div class="section-label">嵌套二元查询</div>
          <NestedQueryList :query="localQuery.query" :datasource="datasource" :show-explain="showExplain" @update="handleNestedBinaryUpdate" />
        </div>

        <!-- 查询预览 -->
        <div class="section">
          <Alert :message="renderNestedQuery()" type="info" show-icon style="font-family: monospace; font-size: 12px" />
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Button, Card, Input, Select } from '@grafana-fast/component';
  import { ref, watch } from 'vue';
  import { CloseOutlined } from '@ant-design/icons-vue';
  import MetricSelector from '/#/components/QueryBuilder/MetricSelector.vue';
  import LabelFilters from '/#/components/QueryBuilder/LabelFilters.vue';
  import OperationsList from './OperationsList.vue';
  import NestedQueryList from './NestedQueryList.vue';
  import QueryExplain from './QueryExplain.vue';
  import { promQueryModeller } from '@grafana-fast/utils';
  import type { PromVisualQueryBinary, PromVisualQuery } from '@grafana-fast/utils';
  import { Alert } from '@grafana-fast/component';

  interface Props {
    nestedQuery: PromVisualQueryBinary;
    index: number;
    datasource?: unknown;
    showExplain?: boolean;
  }

  interface Emits {
    (e: 'update', index: number, query: PromVisualQueryBinary): void;
    (e: 'remove', index: number): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  type VectorMatchType = 'on' | 'ignoring';

  function normalizeLabelList(value: string): string[] {
    return String(value)
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  function toVectorMatching(type?: VectorMatchType | '', labels?: string) {
    if (!type) return undefined;
    const parsed = normalizeLabelList(labels ?? '');
    if (parsed.length === 0) return undefined;
    return { type, labels: parsed } as const;
  }

  const vectorMatchType = ref<VectorMatchType | ''>((props.nestedQuery.vectorMatching?.type ?? '') as VectorMatchType | '');
  const vectorMatchLabels = ref<string>((props.nestedQuery.vectorMatching?.labels ?? []).join(', '));

  // 初始化 localQuery：仅保留结构化 vectorMatching（项目未上线，无需旧字段兜底）
  const localQuery = ref<PromVisualQueryBinary>({
    ...props.nestedQuery,
    vectorMatching: toVectorMatching(vectorMatchType.value, vectorMatchLabels.value),
  });

  watch(
    () => props.nestedQuery,
    (newValue) => {
      vectorMatchType.value = (newValue.vectorMatching?.type ?? '') as VectorMatchType | '';
      vectorMatchLabels.value = (newValue.vectorMatching?.labels ?? []).join(', ');
      localQuery.value = {
        ...newValue,
        vectorMatching: toVectorMatching(vectorMatchType.value, vectorMatchLabels.value),
      };
    },
    { deep: true }
  );

  // 运算符选项（来自 binaryScalarOperations）
  const operatorOptions = [
    { label: '+', value: '+' },
    { label: '-', value: '-' },
    { label: '*', value: '*' },
    { label: '/', value: '/' },
    { label: '%', value: '%' },
    { label: '^', value: '^' },
    { label: '==', value: '==' },
    { label: '!=', value: '!=' },
    { label: '>', value: '>' },
    { label: '<', value: '<' },
    { label: '>=', value: '>=' },
    { label: '<=', value: '<=' },
  ];

  // 向量匹配类型选项
  const vectorMatchTypeOptions = [
    { label: '-', value: '' },
    { label: 'on', value: 'on' },
    { label: 'ignoring', value: 'ignoring' },
  ];

  const handleOperatorChange = () => {
    handleChange();
  };

  const handleChange = () => {
    localQuery.value = {
      ...localQuery.value,
      vectorMatching: toVectorMatching(vectorMatchType.value, vectorMatchLabels.value),
    };
    emit('update', props.index, localQuery.value);
  };

  const handleRemove = () => {
    emit('remove', props.index);
  };

  // 处理嵌套查询内部的 OperationsList 添加二元查询
  const handleNestedQueryUpdate = (updatedQuery: PromVisualQuery) => {
    localQuery.value.query = {
      ...localQuery.value.query,
      ...updatedQuery,
    };
    handleChange();
  };

  // 处理嵌套的二元查询更新
  const handleNestedBinaryUpdate = (updatedQuery: PromVisualQuery) => {
    localQuery.value.query = updatedQuery;
    handleChange();
  };

  const renderNestedQuery = (): string => {
    try {
      return promQueryModeller.renderQuery(localQuery.value.query);
    } catch {
      return '';
    }
  };
</script>

<style scoped lang="less">
  .nested-query {
    margin-bottom: 12px;
    background: var(--gf-color-surface);
    border-left: 2px solid var(--gf-color-primary-border-strong);
    border-radius: var(--gf-radius-md);
    transition: box-shadow var(--gf-motion-fast) var(--gf-easing);

    &:hover {
      box-shadow: var(--gf-shadow-1);
    }
  }

  .nested-query-header {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    background: var(--gf-color-surface-muted);
    border-bottom: 1px solid var(--gf-color-border-muted);
    gap: 8px;
    border-radius: var(--gf-radius-md) var(--gf-radius-md) 0 0;
  }

  .header-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--gf-color-text-secondary);
    white-space: nowrap;
    line-height: 1.5714285714285714;
  }

  .nested-query-body {
    padding: 12px;
  }

  .section {
    margin-bottom: 12px;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section-label {
    font-weight: 500;
    margin-bottom: 8px;
    color: var(--gf-color-text);
    font-size: 13px;
    line-height: 1.5714285714285714;
  }
</style>
