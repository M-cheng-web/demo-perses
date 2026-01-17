import { computed, isRef, ref, watch, type ComputedRef, type Ref } from 'vue';

export interface UsePaginationOptions {
  total: number | Ref<number> | ComputedRef<number>;
  initialPage?: number;
  initialPageSize?: number;
}

export interface UsePaginationResult {
  page: Ref<number>;
  pageSize: Ref<number>;
  pageCount: ComputedRef<number>;
  start: ComputedRef<number>;
  end: ComputedRef<number>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  reset: () => void;
}

function toNumberSource(v: number | Ref<number> | ComputedRef<number>): ComputedRef<number> {
  if (typeof v === 'number') return computed(() => v);
  if (isRef(v)) return computed(() => Number(v.value));
  return computed(() => Number(v));
}

export function usePagination(options: UsePaginationOptions): UsePaginationResult {
  const total = toNumberSource(options.total);
  const page = ref(Math.max(1, options.initialPage ?? 1));
  const pageSize = ref(Math.max(1, options.initialPageSize ?? 20));

  const pageCount = computed(() => Math.max(1, Math.ceil(Math.max(0, total.value) / Math.max(1, pageSize.value))));

  const clampPage = (n: number) => Math.min(pageCount.value, Math.max(1, Math.floor(n)));

  const setPage = (n: number) => {
    page.value = clampPage(n);
  };

  const setPageSize = (n: number) => {
    pageSize.value = Math.max(1, Math.floor(n));
    page.value = clampPage(page.value);
  };

  const reset = () => {
    page.value = Math.max(1, options.initialPage ?? 1);
    pageSize.value = Math.max(1, options.initialPageSize ?? 20);
    page.value = clampPage(page.value);
  };

  watch([total, pageSize], () => {
    page.value = clampPage(page.value);
  });

  const start = computed(() => (page.value - 1) * pageSize.value);
  const end = computed(() => Math.min(start.value + pageSize.value, total.value));

  return { page, pageSize, pageCount, start, end, setPage, setPageSize, reset };
}
