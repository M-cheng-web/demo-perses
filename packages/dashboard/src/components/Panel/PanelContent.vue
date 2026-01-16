<!--
  文件说明：面板内容渲染容器

  说明：
  - 负责把 panel.type 映射到具体渲染组件（通过 PanelRegistry）
  - 负责向 QueryScheduler 注册 panel，并拿到 loading/error/results
  - 负责在渲染前应用 transformations（数据变换层）
-->
<template>
  <div :class="bem()">
    <div v-if="loading" :class="bem('loading')">
      <Loading text="加载中..." />
    </div>

    <div :class="bem('wrapper')">
      <div v-if="error" :class="bem('error')">
        <Alert type="error" show-icon :message="error" />
      </div>
      <component v-else-if="chartComponent" :is="chartComponent" :panel="panel" :query-results="displayResults" />
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
  import { usePanelRegistry } from '/#/runtime/useInjected';
  import { getPiniaQueryScheduler } from '/#/runtime/piniaAttachments';
  import UnsupportedPanel from '/#/components/Panel/UnsupportedPanel.vue';
  import { applyTransformations } from '/#/transformations';

  const [_, bem] = createNamespace('panel-content');

  const props = defineProps<{
    panel: Panel;
  }>();

  const registry = usePanelRegistry();

  const scheduler = getPiniaQueryScheduler();
  const panelRef = computed<Panel>(() => props.panel);
  const { loading, error, results: queryResults } = scheduler.registerPanel(props.panel.id, panelRef);
  const displayResults = computed(() => applyTransformations(queryResults.value, props.panel.transformations));

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

    &__loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10;
    }

    &__wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      width: 100%;
      height: 100%;
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
