<template>
  <div class="dashboard-view">
    <Dashboard />
  </div>
</template>

<script setup lang="ts">
  import { onMounted } from 'vue';
  import Dashboard from '@/components/Dashboard/Dashboard.vue';
  import { useDashboardStore } from '@/stores';

  const dashboardStore = useDashboardStore();

  onMounted(async () => {
    // 加载默认 Dashboard
    await dashboardStore.loadDashboard('default');
  });
</script>

<style scoped lang="less">
  .dashboard-view {
    width: 100%;
    height: 100%;
    overflow: auto;
  }
</style>
