<!-- 组件说明：分页器（AntD-inspired） -->
<template>
  <div v-if="!hidePager" :class="[bem(), bem({ [`size-${size}`]: true })]">
    <span v-if="showTotal" :class="bem('total')">{{ showTotal(total) }}</span>
    <ul :class="bem('pager')">
      <li :class="[bem('item'), bem('item-prev'), { 'is-disabled': disabled || currentPage <= 1 }]" @click="prevPage">
        <LeftOutlined />
      </li>
      <template v-for="it in pagerItems" :key="it.key">
        <li v-if="it.type === 'ellipsis'" :class="bem('item-ellipsis')">
          <EllipsisOutlined />
        </li>
        <li v-else :class="[bem('item'), { 'is-active': it.page === currentPage, 'is-disabled': disabled }]" @click="() => goPage(it.page)">
          {{ it.page }}
        </li>
      </template>
      <li :class="[bem('item'), bem('item-next'), { 'is-disabled': disabled || currentPage >= pageCount }]" @click="nextPage">
        <RightOutlined />
      </li>
    </ul>
    <div v-if="showSizeChanger" :class="bem('size')">
      <Select v-model:value="innerPageSize" size="small" :options="pageSizeSelectOptions" :show-search="false" :disabled="disabled" />
    </div>
    <div v-if="showQuickJumper" :class="bem('jumper')">
      <span>跳至</span>
      <input
        type="text"
        :class="bem('jumper-input')"
        :value="jumpValue"
        @change="handleJump"
        @input="(e) => (jumpValue = (e.target as HTMLInputElement).value)"
      />
      <span>页</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { LeftOutlined, RightOutlined, EllipsisOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';
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
      /** 是否显示快速跳转 */
      showQuickJumper?: boolean;
      /** 尺寸 */
      size?: 'small' | 'default';
    }>(),
    {
      current: 1,
      pageSize: 20,
      pageSizeOptions: () => ['10', '20', '50', '100'],
      showSizeChanger: false,
      showTotal: undefined,
      hideOnSinglePage: true,
      disabled: false,
      showQuickJumper: false,
      size: 'default',
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

  const jumpValue = ref('');

  const handleJump = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val)) {
      goPage(val);
    }
    jumpValue.value = '';
  };
</script>

<style scoped lang="less">
  .gf-pagination {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: var(--gf-font-size-sm);
    line-height: 1.5714285714285714;

    &__total {
      color: var(--gf-color-text);
    }

    &__pager {
      display: flex;
      align-items: center;
      gap: 0;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    &__item {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 6px;
      margin: 0 4px;
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-sm);
      background: var(--gf-color-surface);
      color: var(--gf-color-text);
      cursor: pointer;
      user-select: none;
      transition:
        border-color var(--gf-motion-fast) var(--gf-easing),
        color var(--gf-motion-fast) var(--gf-easing);

      &:hover:not(.is-disabled):not(.is-active) {
        border-color: var(--gf-color-primary);
        color: var(--gf-color-primary);
      }

      &.is-active {
        border-color: var(--gf-color-primary);
        color: var(--gf-color-primary);
        font-weight: 500;
      }

      &.is-disabled {
        color: var(--gf-color-text-tertiary);
        cursor: not-allowed;
        border-color: var(--gf-color-border);
      }
    }

    &__item-prev,
    &__item-next {
      font-size: 12px;
    }

    &__item-ellipsis {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      color: var(--gf-color-text-tertiary);
      font-size: 12px;
      cursor: default;
    }

    &__size {
      flex: 0 0 auto;
      width: 100px;
    }

    &__jumper {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--gf-color-text);
    }

    &__jumper-input {
      width: 50px;
      height: 32px;
      padding: 4px 11px;
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-sm);
      background: var(--gf-color-surface);
      color: var(--gf-color-text);
      font-size: var(--gf-font-size-sm);
      outline: none;
      transition:
        border-color var(--gf-motion-fast) var(--gf-easing),
        box-shadow var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        border-color: var(--gf-color-primary);
      }

      &:focus {
        border-color: var(--gf-color-primary);
        box-shadow: 0 0 0 2px var(--gf-color-primary-soft);
      }
    }

    // Size small
    &--size-small &__item {
      min-width: 24px;
      height: 24px;
      margin: 0 2px;
      font-size: var(--gf-font-size-xs);
    }

    &--size-small &__item-ellipsis {
      min-width: 24px;
      height: 24px;
    }

    &--size-small &__jumper-input {
      width: 40px;
      height: 24px;
      padding: 2px 7px;
    }
  }
</style>
