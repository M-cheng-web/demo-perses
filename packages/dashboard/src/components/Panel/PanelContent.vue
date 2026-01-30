<!--
  文件说明：面板内容渲染容器

  说明：
  - 负责把 panel.type 映射到具体渲染组件（内置 panels）
  - 负责向 QueryScheduler 注册 panel，并拿到 loading/error/results
  - 负责在渲染前应用 transformations（数据变换层）
-->
<template>
  <div :class="bem()">
    <div :class="bem('wrapper')">
      <div v-if="fatalError" :class="bem('error')">
        <Alert type="error" show-icon :message="fatalError" />
      </div>
      <div v-else-if="!hasVisibleQueries" :class="bem('empty')">
        <Empty description="未配置查询" />
      </div>
      <div v-else-if="chartComponent" :class="bem('content')">
        <div v-if="queryErrorText && !loading" :class="bem('warning')">
          <Alert type="warning" show-icon :message="queryErrorText" />
        </div>
        <div :class="bem('chart')">
          <div v-if="loading" :class="bem('loading')">
            <Loading text="加载中..." />
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
  import { computed } from 'vue';
  import { Alert, Loading, Empty } from '@grafana-fast/component';
  import type { Panel } from '@grafana-fast/types';
  import { createNamespace } from '/#/utils';
  import { getBuiltInPanelRegistry } from '/#/runtime/panels';
  import { getPiniaQueryScheduler } from '/#/runtime/piniaAttachments';
  import { useDashboardRuntime } from '/#/runtime/useInjected';
  import UnsupportedPanel from '/#/components/Panel/UnsupportedPanel.vue';
  import { applyTransformations } from '/#/transformations';

  const [_, bem] = createNamespace('panel-content');

  const props = defineProps<{
    panel: Panel;
  }>();

  const registry = getBuiltInPanelRegistry();

  const scheduler = getPiniaQueryScheduler();
  const runtime = useDashboardRuntime();
  const panelRef = computed<Panel>(() => props.panel);
  // QueryScheduler 内部使用的 panelId 需要做实例隔离（同页多 dashboard + shared pinia 时避免串台）
  const schedulerPanelId = `${runtime.id}:${String(props.panel.id)}`;
  const { loading, error, results: queryResults } = scheduler.registerPanel(schedulerPanelId, panelRef);
  const displayResults = computed(() => applyTransformations(queryResults.value, props.panel.transformations));

  const hasVisibleQueries = computed(() => (props.panel.queries ?? []).some((q) => !q.hide));

  const fatalError = computed(() => error.value);

  const queryErrorText = computed(() => {
    const errors = displayResults.value
      .map((r) => {
        const msg = (r as any)?.error;
        if (!msg) return '';
        const refId = (r as any)?.refId || (r as any)?.queryId || 'query';
        return `${refId}: ${String(msg)}`;
      })
      .filter(Boolean);

    if (!errors.length) return '';
    // Keep it short; detailed view belongs in a future Query Inspector.
    const uniq = Array.from(new Set(errors));
    return uniq.length === 1 ? uniq[0]! : `${uniq[0]} 等 ${uniq.length} 个错误`;
  });

  // 根据面板类型选择组件
  const chartComponent = computed(() => {
    const type = props.panel.type;
    if (!type) return null;
    const plugin = registry.get(type);
    return plugin?.component ?? UnsupportedPanel;
  });

  // 查询执行由中心调度器统一管理（timeRange + variables + panel queries）。
</script>

<style scoped lang="less">
  .dp-panel-content {
    position: relative;
    flex: 1;
    padding: @spacing-sm-2;
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
      background: color-mix(in srgb, var(--gf-color-surface), transparent 45%);
      backdrop-filter: blur(1px);
      pointer-events: all;
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
      padding: @spacing-sm-2;
    }

    &__error,
    &__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    }
  }
</style>
