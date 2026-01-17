<!-- 组件说明：轻量虚拟表格（固定行高），用于大数据表格 -->
<template>
  <div :class="bem()">
    <div :class="bem('header')" :style="{ gridTemplateColumns }">
      <div v-for="col in columns" :key="col.key || col.dataIndex" :class="[bem('cell'), bem('th')]">
        {{ col.title }}
      </div>
    </div>

    <VirtualList :items="dataSource" :height="height" :item-height="rowHeight" :row-key="rowKey">
      <template #default="{ item, index }">
        <div :class="bem('row')" :style="{ gridTemplateColumns }">
          <div v-for="col in columns" :key="col.key || col.dataIndex" :class="bem('cell')">
            <slot name="bodyCell" :column="col" :record="item" :text="item[col.dataIndex || '']" :index="index">
              {{ item[col.dataIndex || ''] }}
            </slot>
          </div>
        </div>
      </template>
    </VirtualList>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';
  import VirtualList from './VirtualList.vue';

  defineOptions({ name: 'GfVirtualTable' });

  interface Column {
    title: string;
    dataIndex?: string;
    key?: string;
    width?: number;
  }

  const [_, bem] = createNamespace('virtual-table');

  const props = withDefaults(
    defineProps<{
      columns: Column[];
      dataSource: any[];
      height?: number | string;
      rowHeight?: number;
      rowKey?: string | ((record: any, index: number) => string | number);
    }>(),
    {
      columns: () => [],
      dataSource: () => [],
      height: 360,
      rowHeight: 32,
      rowKey: undefined,
    }
  );

  const gridTemplateColumns = computed(() => {
    if (!props.columns?.length) return '1fr';
    return props.columns.map((col) => (col.width ? `${col.width}px` : 'minmax(120px, 1fr)')).join(' ');
  });
</script>

<style scoped lang="less">
  .gf-virtual-table {
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 1px solid var(--gf-color-border);
    border-radius: var(--gf-radius-md);
    overflow: hidden;
    background: var(--gf-color-surface);

    &__header {
      display: grid;
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--gf-color-surface-muted);
      border-bottom: 1px solid var(--gf-color-border-muted);
    }

    &__row {
      display: grid;
      border-bottom: 1px solid var(--gf-color-border-muted);
    }

    &__cell {
      padding: 8px 10px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      color: var(--gf-color-text);
    }

    &__th {
      font-weight: 650;
      color: var(--gf-color-text-secondary);
    }
  }
</style>
