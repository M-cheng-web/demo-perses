<!-- 图表预览 -->
<template>
  <div :class="bem()">
    <div :class="bem('content')">
      <div v-if="showHeader" :class="bem('header')">
        <div :class="bem('title')">预览</div>
      </div>
      <div v-if="lastError" :class="bem('error')">
        <Alert type="error" show-icon :message="lastError" />
      </div>
      <component v-if="panel && queryResults.length > 0" :is="chartComponent" :panel="panel" :query-results="queryResults" />
      <Empty v-else description="暂无数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
  import { Alert, Empty } from '@grafana-fast/component';
  import type { Panel, QueryResult, QueryContext } from '@grafana-fast/types';
  import { useTimeRangeStore, useVariablesStore } from '/#/stores';
  import { getPiniaApiClient } from '/#/runtime/piniaAttachments';
  import { QueryRunner } from '/#/query/queryRunner';
  import { interpolateExpr } from '/#/query/interpolate';
  import UnsupportedPanel from '/#/components/Panel/UnsupportedPanel.vue';
  import { getBuiltInPanelComponent } from '/#/panels/builtInPanels';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('panel-preview');

  const props = withDefaults(
    defineProps<{
      panel: Panel;
      autoExecute?: boolean; // 是否自动执行查询
      showHeader?: boolean;
    }>(),
    {
      autoExecute: true, // 默认自动执行
      showHeader: true,
    }
  );

  const timeRangeStore = useTimeRangeStore();
  const variablesStore = useVariablesStore();
  const queryResults = ref<QueryResult[]>([]);
  const isLoading = ref(false);
  const lastError = ref<string>('');
  let abortController: AbortController | null = null;

  // 根据面板类型选择对应的图表组件
  const chartComponent = computed(() => {
    return getBuiltInPanelComponent(props.panel.type) ?? UnsupportedPanel;
  });

  // 执行查询（使用和外部一样的查询逻辑，确保数据一致）
  const executeQueriesInternal = async () => {
    if (!props.panel.queries || props.panel.queries.length === 0) {
      queryResults.value = [];
      lastError.value = '';
      return;
    }

    abortController?.abort();
    abortController = new AbortController();

    isLoading.value = true;
    lastError.value = '';
    try {
      const { start, end } = timeRangeStore.getTimeRangeTimestamps();
      const context: QueryContext = { timeRange: { from: start, to: end } };
      const api = getPiniaApiClient();
      const runner = new QueryRunner(api, { maxConcurrency: 4, cacheTtlMs: 0 });

      const values = (variablesStore.state?.values ?? {}) as Record<string, string | string[]>;
      const resolvedQueries = (props.panel.queries ?? []).map((q) => {
        const rawExpr = String(q.expr ?? '');
        const expr = interpolateExpr(rawExpr, values, { multiFormat: 'regex', unknown: 'keep' });
        return expr === rawExpr ? q : { ...q, expr };
      });

      const results = await runner.executeQueries(resolvedQueries, context, { signal: abortController.signal });

      queryResults.value = results;

      // 严格：任意 query 返回 error 都视为“执行失败”，需要显式暴露给上层与用户。
      const errors = results
        .map((r) => (r.error ? `${String(r.refId || r.queryId || 'query')}: ${String(r.error)}` : ''))
        .filter(Boolean);
      if (errors.length > 0) {
        const msg = errors.length === 1 ? errors[0]! : `${errors[0]} 等 ${errors.length} 个错误`;
        lastError.value = msg;
        throw new Error(msg);
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return;
      const msg = error instanceof Error ? error.message : '查询失败';
      lastError.value = msg;
      console.error('Query execution failed:', error);
      // 保留 queryResults（若已有部分结果/错误信息），不要用“空数据”掩盖错误
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // 监听面板变化（包括查询、选项等）
  watch(
    () => props.panel,
    () => {
      if (props.autoExecute) {
        void executeQueriesInternal().catch(() => {
          // autoExecute 场景不向上抛（避免未处理 Promise），错误通过 lastError 直接展示
        });
      }
    },
    { deep: true, immediate: false }
  );

  // 监听面板类型变化
  watch(
    () => props.panel.type,
    () => {
      if (queryResults.value.length > 0) {
        // 重新渲染
        const temp = queryResults.value;
        queryResults.value = [];
        void nextTick(() => {
          queryResults.value = temp;
        });
      }
    }
  );

  // 监听时间范围变化
  watch(
    () => timeRangeStore.timeRange,
    () => {
      if (props.autoExecute) {
        void executeQueriesInternal().catch(() => {});
      }
    },
    { deep: true }
  );

  // 监听变量变化：预览应与实际运行时一致（变量影响 expr 插值）
  watch(
    () => variablesStore.valuesGeneration,
    () => {
      if (props.autoExecute) {
        void executeQueriesInternal().catch(() => {});
      }
    }
  );

  onMounted(() => {
    if (props.autoExecute) {
      void executeQueriesInternal().catch(() => {});
    }
  });

  onBeforeUnmount(() => {
    abortController?.abort();
    abortController = null;
  });

  // 暴露方法给父组件调用
  defineExpose({
    executeQueries: executeQueriesInternal,
  });
</script>

<style scoped lang="less">
  .dp-panel-preview {
    &__header {
      position: absolute;
      top: 12px;
      left: 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: var(--gf-radius-sm);
      border: 1px solid var(--gf-color-border-muted);
      background: var(--gf-color-surface-raised);
      box-shadow: var(--gf-shadow-1);
      pointer-events: none;
      z-index: 10;
    }

    &__content {
      height: 300px;
      position: relative;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      overflow: hidden;
      transition: border-color var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        border-color: var(--gf-color-border-strong);
      }
    }

    &__title {
      font-size: 12px;
      font-weight: 600;
      color: var(--gf-color-text-secondary);
      line-height: 1.5714285714285714;
    }
  }
</style>
