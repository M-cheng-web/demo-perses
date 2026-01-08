<template>
  <div class="hook-example">
    <div class="controls">
      <h1>useDashboard Hook 示例</h1>
      <div class="button-group">
        <button :disabled="isMounted" @click="handleMount">挂载 Dashboard</button>
        <button :disabled="!isMounted" @click="handleUnmount">卸载 Dashboard</button>
        <button :disabled="!isMounted" @click="handleRefresh">刷新数据</button>
        <button :disabled="!isMounted" @click="handleUpdateTitle">更新标题</button>
      </div>
      <div class="status">
        状态:
        <span :class="{ mounted: isMounted, unmounted: !isMounted }">
          {{ isMounted ? '已挂载' : '未挂载' }}
        </span>
      </div>
    </div>

    <div ref="containerRef" class="dashboard-container"></div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useDashboard } from '@grafana-fast/hooks';

  const containerRef = ref<HTMLElement>();

  const { mount, unmount, updateDashboard, refresh, isMounted } = useDashboard({
    container: containerRef,
    dashboard: {
      id: 'hook-example-dashboard',
      title: 'Hook 示例仪表板',
    },
    onMounted: () => {
      console.log('Dashboard 已挂载');
    },
    onUnmounted: () => {
      console.log('Dashboard 已卸载');
    },
  });

  const handleMount = () => {
    mount();
  };

  const handleUnmount = () => {
    unmount();
  };

  const handleRefresh = () => {
    refresh();
  };

  const handleUpdateTitle = () => {
    updateDashboard({
      title: `新标题 - ${Date.now()}`,
    });
  };
</script>

<style scoped>
  .hook-example {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 20px;
  }

  .controls {
    margin-bottom: 20px;
  }

  .controls h1 {
    font-size: 24px;
    margin-bottom: 16px;
  }

  .button-group {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }

  .button-group button {
    padding: 8px 16px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    transition: all 0.3s;
  }

  .button-group button:hover:not(:disabled) {
    color: #1890ff;
    border-color: #1890ff;
  }

  .button-group button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .status {
    font-size: 14px;
  }

  .status span {
    font-weight: bold;
  }

  .status .mounted {
    color: #52c41a;
  }

  .status .unmounted {
    color: #ff4d4f;
  }

  .dashboard-container {
    flex: 1;
    border: 2px dashed #d9d9d9;
    border-radius: 4px;
    min-height: 400px;
  }
</style>
