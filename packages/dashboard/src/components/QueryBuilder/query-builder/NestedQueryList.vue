<!--
  @fileoverview 嵌套查询列表组件
  @description
    管理多个嵌套二元查询的列表容器。
    主要功能：
    - 渲染嵌套查询列表
    - 支持添加/删除嵌套查询
  @reference Grafana 源码
    grafana/public/app/plugins/datasource/prometheus-querybuilder/components/NestedQueryList.tsx
  @props
    query: PromVisualQuery, datasource: string
  @emits
    update
-->
<template>
  <div :class="bem()">
    <!-- 只渲染现有的二元查询，不提供添加按钮 -->
    <!-- 添加二元查询只能通过 Operations 下拉列表 -->
    <div v-if="nestedQueries.length > 0" :class="bem('container')">
      <NestedQuery
        v-for="(nestedQuery, index) in nestedQueries"
        :key="index"
        :nested-query="nestedQuery"
        :index="index"
        :datasource="datasource"
        :show-explain="showExplain"
        @update="handleUpdate"
        @remove="handleRemove"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import NestedQuery from './NestedQuery.vue';
  import type { PromVisualQuery, PromVisualQueryBinary } from '@grafana-fast/utils';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('nested-query-list');

  interface Props {
    query: PromVisualQuery;
    datasource?: any;
    showExplain?: boolean;
  }

  interface Emits {
    (e: 'update', query: PromVisualQuery): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const nestedQueries = ref<PromVisualQueryBinary[]>(props.query.binaryQueries || []);

  watch(
    () => props.query.binaryQueries,
    (newValue) => {
      nestedQueries.value = newValue || [];
    },
    { deep: true }
  );

  const handleUpdate = (index: number, updatedQuery: PromVisualQueryBinary) => {
    const updatedList = [...nestedQueries.value];
    updatedList[index] = updatedQuery;
    nestedQueries.value = updatedList;

    emit('update', {
      ...props.query,
      binaryQueries: updatedList,
    });
  };

  const handleRemove = (index: number) => {
    const updatedList = [...nestedQueries.value.slice(0, index), ...nestedQueries.value.slice(index + 1)];
    nestedQueries.value = updatedList;

    emit('update', {
      ...props.query,
      binaryQueries: updatedList.length > 0 ? updatedList : undefined,
    });
  };
</script>

<style scoped lang="less">
  .dp-nested-query-list {
    margin-top: 16px;

    &__container {
      display: flex;
      flex-direction: column;
    }
  }
</style>
