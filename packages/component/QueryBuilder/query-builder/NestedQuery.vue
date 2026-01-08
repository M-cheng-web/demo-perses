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
      <Select v-model:value="localQuery.operator" :options="operatorOptions" style="width: 80px" size="small" @change="handleOperatorChange" />

      <span class="header-label" style="margin-left: 16px">向量匹配</span>
      <Select
        v-model:value="localQuery.vectorMatchesType"
        :options="vectorMatchTypeOptions"
        style="width: 100px"
        size="small"
        @change="handleChange"
      />

      <Input
        v-model:value="localQuery.vectorMatches"
        placeholder="label1, label2"
        size="small"
        style="width: 200px; margin-left: 8px"
        @change="handleChange"
      />

      <div style="flex: 1"></div>

      <Button type="text" size="small" danger @click="handleRemove">
        <template #icon><CloseOutlined /></template>
      </Button>
    </div>

    <div class="nested-query-body">
      <Card size="small" :bordered="true">
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
  import { Alert, Button, Card, Input, Select } from 'ant-design-vue';
  import { ref, watch } from 'vue';
  import { CloseOutlined } from '@ant-design/icons-vue';
  import MetricSelector from '@/components/QueryBuilder/MetricSelector.vue';
  import LabelFilters from '@/components/QueryBuilder/LabelFilters.vue';
  import OperationsList from './OperationsList.vue';
  import NestedQueryList from './NestedQueryList.vue';
  import QueryExplain from './QueryExplain.vue';
  import { promQueryModeller } from '@/lib/prometheus-querybuilder/PromQueryModeller';
  import type { PromVisualQueryBinary, PromVisualQuery } from '@/lib/prometheus-querybuilder/types';

  interface Props {
    nestedQuery: PromVisualQueryBinary;
    index: number;
    datasource?: any;
    showExplain?: boolean;
  }

  interface Emits {
    (e: 'update', index: number, query: PromVisualQueryBinary): void;
    (e: 'remove', index: number): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  // 初始化 localQuery，确保可选字段有默认值
  const localQuery = ref<PromVisualQueryBinary>({
    ...props.nestedQuery,
    vectorMatchesType: props.nestedQuery.vectorMatchesType || undefined,
    vectorMatches: props.nestedQuery.vectorMatches || undefined,
  });

  watch(
    () => props.nestedQuery,
    (newValue) => {
      localQuery.value = {
        ...newValue,
        vectorMatchesType: newValue.vectorMatchesType || undefined,
        vectorMatches: newValue.vectorMatches || undefined,
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
    { label: 'on', value: 'on' },
    { label: 'ignoring', value: 'ignoring' },
  ];

  const handleOperatorChange = () => {
    handleChange();
  };

  const handleChange = () => {
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
    } catch (error) {
      return '';
    }
  };
</script>

<style scoped>
  .nested-query {
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    background: #fafafa;
    margin-bottom: 12px;
  }

  .nested-query-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: #f5f5f5;
    border-bottom: 1px solid #d9d9d9;
    gap: 8px;
  }

  .header-label {
    font-size: 13px;
    font-weight: 500;
    color: #595959;
    white-space: nowrap;
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
    color: rgba(0, 0, 0, 0.85);
    font-size: 13px;
  }
</style>
