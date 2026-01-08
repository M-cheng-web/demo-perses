<template>
  <div class="dashboard-view">
    <Dashboard />
  </div>
</template>

<script setup lang="ts">
  import { Dashboard } from '@grafana-fast/component';
</script>

<style scoped>
  .dashboard-view {
    width: 100%;
    height: 100%;
  }
</style>
