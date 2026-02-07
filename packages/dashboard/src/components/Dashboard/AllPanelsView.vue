<!--
  组件说明：全部面板视图（AllPanelsView）

  目标：
  - 展示一个不分组的“大列表”，顺序按“组顺序 -> panels 数组顺序”
  - 只读：不支持编辑/拖拽/缩放（进入该视图会由 store 自动清空面板组编辑态）
  - 继续沿用当前的“滚动停留才加载内容”策略（VirtualList + QueryScheduler 可视范围上报）

  实现说明：
  - 复用 `/#/components/GridLayout/VirtualList.vue` 的 windowing + active 请求窗口机制
  - 不使用 vue-grid-layout：这里用“绝对定位 + 预估高度”做列表窗口化渲染
  - 每个 item 的高度按原 layout.h 映射（rowHeight=30，marginY=10）
-->
<template>
  <div :class="bem()">
    <VirtualList
      scope-id="all-panels"
      scroll-mode="runtime"
      :idle-ms="200"
      :row-height="ROW_HEIGHT"
      :margin-y="MARGIN_Y"
      :hot-overscan-screens="0.5"
      :keep-alive-count="keepAliveCount"
      :items="virtualItems"
      v-slot="{ dataList, renderList }"
    >
      <template v-if="dataList.length > 0">
        <div :class="bem('list')" :style="{ height: `${totalHeightPx}px` }">
          <div v-for="layoutItem in renderList" :key="layoutItem.i" :class="bem('item')" :style="getItemStyle(layoutItem)">
            <Panel
              v-if="panelById.get(String(layoutItem.i))"
              :title="panelById.get(String(layoutItem.i))?.name"
              :description="panelDescriptions.get(String(layoutItem.i))"
              size="small"
              :hoverable="true"
              :body-padding="false"
              :style="{ height: '100%' }"
            >
              <template #right>
                <Tooltip title="全屏查看">
                  <Button icon-only type="text" size="small" :icon="h(FullscreenOutlined)" @click="handleFullscreen(String(layoutItem.i))" />
                </Tooltip>
              </template>

              <PanelContent :panel="panelById.get(String(layoutItem.i))!" />
            </Panel>

            <Panel v-else size="small" :hoverable="false" :body-padding="true" title="面板加载失败" :style="{ height: '100%' }">
              <div :class="bem('panel-error')">
                <Alert type="error" show-icon message="面板加载失败" description="未找到面板数据" />
              </div>
            </Panel>
          </div>
        </div>
      </template>

      <template v-else>
        <Empty description="暂无面板" />
      </template>
    </VirtualList>
  </div>
</template>

<script setup lang="ts">
  import { computed, h } from 'vue';
  import type { PanelGroup, PanelLayout, Panel as PanelType, ID } from '@grafana-fast/types';
  import { Alert, Button, Empty, Panel, Tooltip } from '@grafana-fast/component';
  import { FullscreenOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '/#/utils';
  import { useDashboardStore } from '/#/stores';
  import PanelContent from '/#/components/Panel/PanelContent.vue';
  import VirtualList from '/#/components/GridLayout/VirtualList.vue';

  const [_, bem] = createNamespace('all-panels-view');

  const props = defineProps<{
    panelGroups: PanelGroup[];
  }>();

  const dashboardStore = useDashboardStore();

  const ROW_HEIGHT = 30;
  const MARGIN_Y = 10;
  const ROW_UNIT = ROW_HEIGHT + MARGIN_Y;
  const DEFAULT_H = 8;

  const flat = computed(() => {
    const groups = Array.isArray(props.panelGroups) ? props.panelGroups : [];

    const panelById = new Map<string, PanelType>();
    const groupByPanelId = new Map<string, { groupId: ID; groupTitle: string; panelDescription?: string }>();
    const virtualItems: PanelLayout[] = [];

    let y = 0;
    for (const group of groups) {
      const groupTitle = group.title || '未命名面板组';

      const layoutById = new Map<string, PanelLayout>();
      (group.layout ?? []).forEach((it) => layoutById.set(String(it.i), it));

      const panels = group.panels ?? [];
      for (const p of panels) {
        const pid = String(p.id);
        panelById.set(pid, p);
        groupByPanelId.set(pid, { groupId: group.id, groupTitle, panelDescription: p.description });

        const srcLayout = layoutById.get(pid);
        const h = Math.max(1, Math.floor(Number(srcLayout?.h ?? DEFAULT_H)));

        virtualItems.push({
          i: p.id,
          x: 0,
          y,
          w: 48,
          h,
          minW: 6,
          minH: 4,
        });
        y += h;
      }
    }

    const totalRows = y;
    const totalHeightPx = totalRows * ROW_UNIT + MARGIN_Y;

    const panelDescriptions = new Map<string, string>();
    for (const [pid, meta] of groupByPanelId.entries()) {
      const descParts = [meta.groupTitle, meta.panelDescription].filter(Boolean);
      panelDescriptions.set(pid, descParts.join(' · '));
    }

    return { panelById, groupByPanelId, panelDescriptions, virtualItems, totalHeightPx };
  });

  const panelById = computed(() => flat.value.panelById);
  const groupByPanelId = computed(() => flat.value.groupByPanelId);
  const panelDescriptions = computed(() => flat.value.panelDescriptions);
  const virtualItems = computed(() => flat.value.virtualItems);
  const totalHeightPx = computed(() => flat.value.totalHeightPx);

  const keepAliveCount = computed(() => {
    // 只读列表：缓存适当放大，减少频繁卸载/重建导致的重画感
    const total = virtualItems.value.length;
    if (total >= 800) return 120;
    if (total >= 200) return 80;
    return 60;
  });

  const getItemStyle = (it: PanelLayout) => {
    const y = Math.max(0, Number(it.y ?? 0));
    const h = Math.max(1, Number(it.h ?? 1));
    const topPx = MARGIN_Y + y * ROW_UNIT;
    const heightPx = h * ROW_HEIGHT + Math.max(0, h - 1) * MARGIN_Y;
    return {
      position: 'absolute',
      left: '0',
      right: '0',
      top: `${topPx}px`,
      height: `${heightPx}px`,
    } as Record<string, string>;
  };

  const handleFullscreen = (panelId: string) => {
    const meta = groupByPanelId.value.get(panelId);
    if (!meta) return;
    dashboardStore.togglePanelView(meta.groupId, panelId);
  };
</script>

<style scoped lang="less">
  .dp-all-panels-view {
    width: 100%;
    min-height: 200px;

    &__list {
      position: relative;
      width: 100%;
    }

    &__item {
      width: 100%;
      box-sizing: border-box;
      transition: transform var(--gf-motion-fast) var(--gf-easing);
    }

    &__panel-error {
      height: 100%;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
  }
</style>
