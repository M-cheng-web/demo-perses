<!-- 组件说明：分页器（复用 Table 的分页样式/交互） -->
<template>
  <div v-if="!hidePager" :class="bem()">
    <span v-if="showTotal" :class="bem('total')">{{ showTotal(total) }}</span>
    <div :class="bem('pager')">
      <Button size="small" type="ghost" @click="prevPage" :disabled="disabled || currentPage <= 1">上一页</Button>

      <div :class="bem('pages')">
        <template v-for="it in pagerItems" :key="it.key">
          <span v-if="it.type === 'ellipsis'" :class="bem('ellipsis')">…</span>
          <Button
            v-else
            size="small"
            :type="it.page === currentPage ? 'primary' : 'ghost'"
            :disabled="disabled"
            :class="bem('page')"
            :aria-current="it.page === currentPage ? 'page' : undefined"
            @click="() => goPage(it.page)"
          >
            {{ it.page }}
          </Button>
        </template>
      </div>

      <span :class="bem('info')">{{ currentPage }} / {{ pageCount }}</span>
      <Button size="small" type="ghost" @click="nextPage" :disabled="disabled || currentPage >= pageCount">下一页</Button>
    </div>
    <div v-if="showSizeChanger" :class="bem('size')">
      <Select
        v-model:value="innerPageSize"
        size="small"
        :options="pageSizeSelectOptions"
        :show-search="false"
        :disabled="disabled"
      />
    </div>
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
    disabled?: boolean;
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
      disabled?: boolean;
    }>(),
    {
      current: 1,
      pageSize: 20,
      pageSizeOptions: () => ['10', '20', '50', '100'],
      showSizeChanger: false,
      showTotal: undefined,
      hideOnSinglePage: true,
      disabled: false,
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
  const currentPage = computed(() => clampPage(props.current));

  const applyChange = (nextCurrent: number, nextPageSize: number) => {
    emit('change', { current: nextCurrent, pageSize: nextPageSize, total: props.total });
  };

  const prevPage = () => {
    if (props.disabled) return;
    const next = clampPage(currentPage.value - 1);
    emit('update:current', next);
    applyChange(next, props.pageSize);
  };

  const nextPage = () => {
    if (props.disabled) return;
    const next = clampPage(currentPage.value + 1);
    emit('update:current', next);
    applyChange(next, props.pageSize);
  };

  const goPage = (page: number) => {
    if (props.disabled) return;
    const next = clampPage(page);
    if (next === currentPage.value) return;
    emit('update:current', next);
    applyChange(next, props.pageSize);
  };

  type PagerItem =
    | { type: 'page'; key: string; page: number }
    | {
        type: 'ellipsis';
        key: string;
      };

  const pagerItems = computed<PagerItem[]>(() => {
    const totalPages = pageCount.value;
    const current = currentPage.value;

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, idx) => {
        const page = idx + 1;
        return { type: 'page', key: String(page), page };
      });
    }

    const selected = new Set<number>();
    selected.add(1);
    selected.add(totalPages);
    for (let delta = -1; delta <= 1; delta++) {
      const p = current + delta;
      if (p > 1 && p < totalPages) selected.add(p);
    }

    const sorted = Array.from(selected).sort((a, b) => a - b);
    const items: PagerItem[] = [];
    let prev: number | null = null;
    for (const page of sorted) {
      if (prev != null && page - prev > 1) {
        items.push({ type: 'ellipsis', key: `ellipsis-${prev}-${page}` });
      }
      items.push({ type: 'page', key: String(page), page });
      prev = page;
    }
    return items;
  });

  const pageSizeSelectOptions = computed(() => props.pageSizeOptions.map((v) => ({ label: String(v), value: Number(v) })));

  const innerPageSize = computed<number>({
    get: () => props.pageSize,
    set: (n) => {
      if (props.disabled) return;
      const nextSize = Math.max(1, Number(n));
      emit('update:pageSize', nextSize);
      const nextCurrent = clampPage(currentPage.value);
      if (nextCurrent !== props.current) emit('update:current', nextCurrent);
      applyChange(nextCurrent, nextSize);
    },
  });
</script>

<style scoped lang="less">
  .gf-pagination {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
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
      min-width: 0;
    }

    &__pages {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    &__page {
      min-width: 28px;
      padding-left: 0;
      padding-right: 0;
    }

    &__ellipsis {
      padding: 0 4px;
      color: var(--gf-color-text-secondary);
      user-select: none;
    }

    &__info {
      color: var(--gf-color-text-secondary);
      user-select: none;
      margin: 0 2px;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    &__size {
      flex: 0 0 auto;
      width: 88px;
    }
  }
</style>
