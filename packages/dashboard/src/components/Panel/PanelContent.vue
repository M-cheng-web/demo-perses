<!-- 文件说明：面板内容渲染容器 -->
<template>
  <div :class="bem()">
    <div :class="bem('wrapper')">
      <div v-if="fatalError" :class="bem('error')">
        <Alert type="error" show-icon :message="fatalError" />
      </div>
      <div v-else-if="panelRuntimeError" :class="bem('error')">
        <Alert type="error" show-icon message="该面板渲染失败" :description="panelRuntimeError" />
      </div>
      <div v-else-if="!hasVisibleQueries" :class="bem('empty')">
        <Empty description="未配置查询" />
      </div>
      <div v-else-if="chartComponent" :class="bem('content')">
        <div v-if="queryErrorText && !showBlockingLoading" :class="bem('warning')">
          <Alert type="warning" show-icon :message="queryErrorText" />
        </div>
        <div :class="bem('chart')">
          <div :class="[bem('loading'), { 'is-visible': showBlockingLoading }]">
            <div :class="bem('loading-spinner')"></div>
          </div>
          <div :class="[bem('refreshing'), { 'is-visible': showRefreshing }]">
            <div :class="bem('refreshing-spinner')"></div>
          </div>
          <component :is="chartComponent" :panel="panel" :query-results="displayResults" />
        </div>
      </div>
      <div v-else :class="bem('empty')">
        <Empty description="未配置图表类型" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onErrorCaptured, onUnmounted, ref, watch } from 'vue';
  import { Alert, Empty } from '@grafana-fast/component';
  import type { Panel } from '@grafana-fast/types';
  import { createNamespace } from '/#/utils';
  import { getPiniaQueryScheduler } from '/#/runtime/piniaAttachments';
  import { useDashboardRuntime } from '/#/runtime/useInjected';
  import UnsupportedPanel from '/#/components/Panel/UnsupportedPanel.vue';
  import { usePanelQueryViewState } from '/#/components/Panel/usePanelQueryViewState';
  import { getBuiltInPanelComponent } from '/#/panels/builtInPanels';
  import { applyTransformations } from '/#/transformations';

  const [_, bem] = createNamespace('panel-content');

  const props = defineProps<{
    panel: Panel;
  }>();

  const scheduler = getPiniaQueryScheduler();
  const runtime = useDashboardRuntime();
  const panelRef = computed<Panel>(() => props.panel);
  // QueryScheduler 内部使用的 panelId 需要做实例隔离（同页多 dashboard + shared pinia 时避免串台）
  const schedulerPanelId = `${runtime.id}:${String(props.panel.id)}`;
  const { phase, loadingKind, hasSnapshot, error, results: queryResults } = scheduler.registerPanel(schedulerPanelId, panelRef);
  const displayResults = computed(() => applyTransformations(queryResults.value, props.panel.transformations));

  const hasVisibleQueries = computed(() => (props.panel.queries ?? []).some((q) => !q.hide));

  // 根据面板类型选择组件
  const chartComponent = computed(() => {
    const type = props.panel.type;
    if (!type) return null;
    return getBuiltInPanelComponent(type) ?? UnsupportedPanel;
  });

  const { showBlockingLoading, showRefreshing } = usePanelQueryViewState({
    hasVisibleQueries,
    hasChartComponent: computed(() => Boolean(chartComponent.value)),
    phase,
    loadingKind,
    hasSnapshot,
  });

  const fatalError = computed(() => error.value);
  const panelRuntimeError = ref<string | null>(null);

  // 当 panel 变化时（切换类型/重建），清理上一次渲染错误，允许重试。
  watch(
    () => `${String(props.panel.id)}::${String(props.panel.type)}`,
    () => {
      panelRuntimeError.value = null;
    }
  );

  // 捕获子组件（面板插件）渲染错误，避免整页白屏。
  onErrorCaptured((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    panelRuntimeError.value = `panelId=${String(props.panel.id)}, type=${String(props.panel.type)}：${msg}`;
    // 阻止错误继续向上抛，避免影响整个 dashboard。
    return false;
  });

  const queryErrorText = computed(() => {
    const errors = displayResults.value
      .map((r) => {
        const msg = r.error;
        if (!msg) return '';
        const refId = r.refId || String(r.queryId) || 'query';
        return `${refId}: ${String(msg)}`;
      })
      .filter(Boolean);

    if (!errors.length) return '';
    const uniq = Array.from(new Set(errors));
    return uniq.length === 1 ? uniq[0]! : `${uniq[0]} 等 ${uniq.length} 个错误`;
  });

  // 查询执行由中心调度器统一管理（timeRange + variables + panel queries）。

  onUnmounted(() => {
    scheduler.unregisterPanel(schedulerPanelId);
  });
</script>

<style scoped lang="less">
  .dp-panel-content {
    position: relative;
    flex: 1;
    padding: 8px;
    overflow: hidden;
    min-height: 0;
    display: flex;
    flex-direction: column;
    height: 100%;

    &__chart {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    &__loading {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gf-color-surface);
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition:
        opacity 0.12s var(--gf-easing),
        visibility 0.12s var(--gf-easing);

      &.is-visible {
        opacity: 1;
        visibility: visible;
      }
    }

    &__loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--gf-color-fill-tertiary);
      border-top-color: var(--gf-color-primary);
      border-radius: 50%;
      animation: gf-spin 0.8s linear infinite;
    }

    &__refreshing {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 11;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--gf-color-surface) 92%, transparent);
      border: 1px solid var(--gf-color-border-muted);
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition:
        opacity 0.12s var(--gf-easing),
        visibility 0.12s var(--gf-easing);

      &.is-visible {
        opacity: 1;
        visibility: visible;
      }
    }

    &__refreshing-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid var(--gf-color-fill-tertiary);
      border-top-color: var(--gf-color-primary);
      border-radius: 50%;
      animation: gf-spin 0.8s linear infinite;
    }

    &__wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      width: 100%;
      height: 100%;
    }

    &__content {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    &__warning {
      padding: 8px;
      margin-bottom: 8px;

      :deep(.gf-alert) {
        margin: 0;
      }
    }

    &__error,
    &__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 16px;
    }
  }

  @keyframes gf-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
