<!-- 组件说明：分页器（复用 Table 的分页样式/交互） -->
<template>
  <div v-if="!hidePager" :class="bem()">
    <span v-if="showTotal" :class="bem('total')">{{ showTotal(total) }}</span>
    <div :class="bem('pager')">
      <Button size="small" type="ghost" @click="prevPage" :disabled="current === 1">上一页</Button>
      <span>{{ current }} / {{ pageCount }}</span>
      <Button size="small" type="ghost" @click="nextPage" :disabled="current === pageCount">下一页</Button>
    </div>
    <Select v-if="showSizeChanger" v-model:value="innerPageSize" size="small" :options="pageSizeSelectOptions" :show-search="false" />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';
  import Button from '../base/Button.vue';
  import Select from '../form/Select.vue';

  export interface PaginationConfig {
    pageSize?: number;
    current?: number;
    total?: number;
    showSizeChanger?: boolean;
    showTotal?: (total: number) => string;
    pageSizeOptions?: Array<string | number>;
    hideOnSinglePage?: boolean;
  }

  defineOptions({ name: 'GfPagination' });

  const props = withDefaults(
    defineProps<{
      total: number;
      current?: number;
      pageSize?: number;
      pageSizeOptions?: Array<string | number>;
      showSizeChanger?: boolean;
      showTotal?: (total: number) => string;
      hideOnSinglePage?: boolean;
    }>(),
    {
      current: 1,
      pageSize: 20,
      pageSizeOptions: () => ['10', '20', '50', '100'],
      showSizeChanger: false,
      showTotal: undefined,
      hideOnSinglePage: true,
    }
  );

  const emit = defineEmits<{
    (e: 'update:current', value: number): void;
    (e: 'update:pageSize', value: number): void;
    (e: 'change', config: PaginationConfig): void;
  }>();

  const [_, bem] = createNamespace('pagination');

  const pageCount = computed(() => Math.max(1, Math.ceil(Math.max(0, props.total) / Math.max(1, props.pageSize))));
  const hidePager = computed(() => Boolean(props.hideOnSinglePage && pageCount.value <= 1));

  const clampPage = (n: number) => Math.min(pageCount.value, Math.max(1, n));

  const applyChange = (nextCurrent: number, nextPageSize: number) => {
    emit('change', { current: nextCurrent, pageSize: nextPageSize, total: props.total });
  };

  const prevPage = () => {
    const next = clampPage(props.current - 1);
    emit('update:current', next);
    applyChange(next, props.pageSize);
  };

  const nextPage = () => {
    const next = clampPage(props.current + 1);
    emit('update:current', next);
    applyChange(next, props.pageSize);
  };

  const pageSizeSelectOptions = computed(() => props.pageSizeOptions.map((v) => ({ label: String(v), value: Number(v) })));

  const innerPageSize = computed<number>({
    get: () => props.pageSize,
    set: (n) => {
      const nextSize = Math.max(1, Number(n));
      emit('update:pageSize', nextSize);
      const nextPage = clampPage(props.current);
      if (nextPage !== props.current) emit('update:current', nextPage);
      applyChange(nextPage, nextSize);
    },
  });
</script>

<style scoped lang="less">
  .gf-pagination {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    color: var(--gf-color-text-secondary);
    font-size: 12px;

    &__total {
      margin-right: auto;
      color: var(--gf-color-text-secondary);
    }

    &__pager {
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
    }
  }
</style>
