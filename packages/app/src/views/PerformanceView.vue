<!--
  文件说明：演示站点 - 性能压测页

  作用：
  - 生成大量 panel（默认 100）用于验证渲染性能与 QueryRunner 的并发/缓存策略
  - 方便在真实 Prometheus 接入前先做前端侧性能基线
-->
<template>
  <div class="dp-perf">
    <div class="dp-perf__header">
      <div class="dp-perf__title">Dashboard 性能压测</div>
      <div class="dp-perf__sub">生成大量 panel（默认 100）用于验证 QueryRunner 并发/缓存与渲染性能。</div>
      <div class="dp-perf__actions">
        <InputNumber v-model:value="panelCount" :min="1" :max="400" />
        <Button type="primary" size="small" @click="apply">生成并应用</Button>
        <Button size="small" type="ghost" @click="goHome">返回</Button>
      </div>
    </div>

    <div class="dp-perf__canvas" ref="dashboardRef"></div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Button, InputNumber } from '@grafana-fast/component';
  import { useDashboardSdk } from '@grafana-fast/hooks';
  import type { Dashboard } from '@grafana-fast/types';
  import { PanelPlugins } from '@grafana-fast/panels';

  const router = useRouter();
  const dashboardRef = ref<HTMLElement | null>(null);
  const panelCount = ref(100);

  const panelRegistry = PanelPlugins.all().build();
  const { actions } = useDashboardSdk(dashboardRef, {
    dashboardId: 'default',
    panelRegistry,
  });

  const generateDashboard = (count: number): Dashboard => {
    const now = Date.now();
    const panels = Array.from({ length: count }).map((_, i) => {
      const id = `p-${i + 1}`;
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = col * 16;
      const y = row * 10;
      return {
        id,
        name: `Panel ${i + 1}`,
        type: 'timeseries',
        queries: [
          {
            id: `q-${i + 1}`,
            refId: 'A',
            datasourceRef: { type: 'prometheus', uid: 'prometheus-mock' },
            expr: i % 2 === 0 ? 'cpu_usage' : 'memory_usage',
            legendFormat: '',
            minStep: 15,
            format: 'time_series',
            instant: false,
            hide: false,
          },
        ],
        options: {},
      };
    });

    return {
      schemaVersion: 1,
      id: `perf-${count}`,
      name: `Perf Dashboard (${count})`,
      description: 'Generated dashboard for performance testing',
      panelGroups: [
        {
          id: 'perf-group-1',
          title: 'Perf Panels',
          isCollapsed: false,
          order: 0,
          panels: panels as any,
          layout: panels.map((p: any, i: number) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            return { i: p.id, x: col * 16, y: row * 10, w: 16, h: 10, minW: 8, minH: 6 };
          }),
        },
      ],
      timeRange: { from: 'now-1h', to: 'now' },
      refreshInterval: 0,
      variables: [],
      createdAt: now,
      updatedAt: now,
    };
  };

  const apply = () => {
    actions.setDashboard(generateDashboard(panelCount.value));
  };

  const goHome = () => router.push('/home');

  onMounted(() => {
    apply();
  });
</script>

<style scoped lang="less">
  .dp-perf {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;

    &__header {
      padding: 12px 16px;
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
    }

    &__title {
      font-size: 14px;
      font-weight: 700;
      color: var(--gf-color-text);
    }

    &__sub {
      margin-top: 4px;
      font-size: 12px;
      color: var(--gf-color-text-secondary);
    }

    &__actions {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    &__canvas {
      flex: 1;
      min-height: 560px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-surface-muted);
      border: 1px solid var(--gf-color-border-muted);
      overflow: hidden;
    }
  }
</style>
