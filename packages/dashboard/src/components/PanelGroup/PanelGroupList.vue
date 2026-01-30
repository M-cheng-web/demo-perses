<!--
  组件说明：面板组列表（PanelGroupList）

  用途：
  - 循环渲染 dashboard 的 panelGroups
  - list view 始终只展示标题（不在列表内展开渲染 panels）
  - 点击标题触发 `open-group`，由上层渲染聚焦层（FocusLayer）
  - 编辑模式下展示右侧操作区（添加面板/编辑/排序/删除）
-->
<template>
  <div :class="bem()">
    <div
      v-for="(group, index) in panelGroups"
      :key="group.id"
      :ref="groupRootRef(group.id)"
      :class="[bem('group'), { 'is-focus-source': focusedGroupKey != null && String(group.id) === focusedGroupKey }]"
    >
      <Panel
        :title="group.title || '未命名面板组'"
        :description="group.description"
        size="large"
        :collapsible="!isBooting"
        :collapsed="true"
        :bordered="false"
        :ghost="true"
        :hoverable="false"
        :body-padding="false"
        @update:collapsed="(collapsed: boolean) => handleCollapsedChange(group.id, collapsed)"
      >
        <template #right>
          <PanelGroupRightActions
            v-if="isEditMode"
            :group="group"
            :index="storeIndexById.get(String(group.id)) ?? index"
            :is-last="(storeIndexById.get(String(group.id)) ?? index) === panelGroups.length - 1"
            @edit="() => handleEditGroup(group)"
          />
        </template>
      </Panel>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { ComponentPublicInstance } from 'vue';
  import type { PanelGroup } from '@grafana-fast/types';
  import { storeToRefs } from '@grafana-fast/store';
  import { Panel } from '@grafana-fast/component';
  import { createNamespace } from '/#/utils';
  import { useDashboardStore } from '/#/stores';
  import { useDashboardRuntime } from '/#/runtime/useInjected';
  import PanelGroupRightActions from './PanelGroupRightActions.vue';

  const [_, bem] = createNamespace('panel-group-list');

  const props = defineProps<{
    panelGroups: PanelGroup[];
    /** 当前聚焦层对应的 groupId（用于隐藏 source header，增强“标题浮起/落回”连续感） */
    focusedGroupId?: PanelGroup['id'] | null;
  }>();

  const emit = defineEmits<{
    (e: 'edit-group', group: PanelGroup): void;
    (e: 'open-group', payload: { groupId: PanelGroup['id']; headerOffsetY: number }): void;
  }>();

  const dashboardStore = useDashboardStore();
  const { isEditMode, isBooting } = storeToRefs(dashboardStore);
  const runtime = useDashboardRuntime();

  const groupRootElById = new Map<string, HTMLElement>();
  const focusedGroupKey = computed(() => (props.focusedGroupId == null ? null : String(props.focusedGroupId)));

  const groupRootRef = (groupId: PanelGroup['id']) => (el: Element | ComponentPublicInstance | null) => {
    const key = String(groupId);
    const maybeEl = (el as any)?.$el instanceof HTMLElement ? (el as any).$el : el;
    const node = maybeEl instanceof HTMLElement ? maybeEl : null;
    if (!node) {
      groupRootElById.delete(key);
      return;
    }
    groupRootElById.set(key, node);
  };

  const getHeaderOffsetY = (groupId: PanelGroup['id']): number => {
    const root = runtime.rootEl?.value;
    const wrapper = groupRootElById.get(String(groupId));
    const header = wrapper?.querySelector('.gf-panel__header') as HTMLElement | null;
    if (!root || !header) return 0;
    const headerRect = header.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const raw = headerRect.top - rootRect.top;
    const max = Math.max(0, Math.floor(root.clientHeight));
    return Math.max(0, Math.min(max, Math.floor(raw)));
  };

  const storeIndexById = computed(() => {
    const map = new Map<string, number>();
    const groups = Array.isArray(props.panelGroups) ? props.panelGroups : [];
    groups.forEach((g, idx) => map.set(String(g.id), idx));
    return map;
  });

  const handleEditGroup = (group: PanelGroup) => {
    emit('edit-group', group);
  };

  const handleCollapsedChange = (groupId: PanelGroup['id'], collapsed: boolean) => {
    if (isBooting.value) return;
    // list view 中始终折叠：点击 header 触发 “展开请求” 时打开 focus layer
    if (collapsed) return;
    emit('open-group', { groupId, headerOffsetY: getHeaderOffsetY(groupId) });
  };
</script>

<style scoped lang="less">
  .dp-panel-group-list {
    display: flex;
    flex-direction: column;
    gap: 0;

    &__group.is-focus-source {
      :deep(.gf-panel__header) {
        opacity: 0;
      }
    }

    // 嵌入式：不提供背景，但列表需要一条轻分割线帮助区分组
    :deep(.dp-panel-group-list__group .gf-panel.is-ghost > .gf-panel__header) {
      background: transparent;
      border-bottom: 1px solid var(--gf-color-border-muted);
    }
  }
</style>
