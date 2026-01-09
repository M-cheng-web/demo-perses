<template>
  <div class="dp-dashboard-view" ref="dashboardRef">
    <div v-if="state.dashboard" class="dp-dashboard-view__meta">
      <div class="dp-dashboard-view__status">
        <span>面板组: {{ state.panelGroups.length }}</span>
        <span>模式: {{ state.isEditMode ? '编辑' : '浏览' }}</span>
      </div>
      <Button size="small" type="default" @click="actions.toggleEditMode">
        {{ state.isEditMode ? '退出编辑' : '进入编辑' }}
      </Button>
    </div>

    <Dashboard />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { Button } from 'ant-design-vue';
  import { Dashboard } from '@grafana-fast/component';
  import { useDashboardSdk } from '@grafana-fast/hooks';

  const dashboardRef = ref<HTMLElement | null>(null);
  const { state, actions } = useDashboardSdk(dashboardRef, { dashboardId: 'default' });
</script>

<style scoped lang="less">
  .dp-dashboard-view {
    width: 100%;
    height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;

    &__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f8f9fb;
      border: 1px solid #e3e6ed;
      border-radius: 8px;
      color: #1f2937;
      font-size: 13px;
    }

    &__status {
      display: flex;
      gap: 12px;
      color: #4b5563;
    }
  }
</style>
