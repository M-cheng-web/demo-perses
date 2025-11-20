<template>
  <div class="panel-group-item">
    <PanelGroupHeader :group="group" :index="index" :is-last="isLast" @edit="$emit('edit', group)" />

    <Transition name="collapse">
      <div v-if="!group.isCollapsed" class="panel-group-content">
        <GridLayout :group-id="group.id" :panels="group.panels" :layout="group.layout" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
  import type { PanelGroup } from '@/types';
  import PanelGroupHeader from './PanelGroupHeader.vue';
  import GridLayout from '@/components/GridLayout/GridLayout.vue';

  defineProps<{
    group: PanelGroup;
    index: number;
    isLast?: boolean;
  }>();

  defineEmits<{
    (e: 'edit', group: PanelGroup): void;
  }>();
</script>

<style scoped lang="less">
  .panel-group-item {
    background-color: @background-base;
    border-radius: @border-radius-base;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .panel-group-content {
    padding: @spacing-md;
  }

  // 折叠过渡动画
  .collapse-enter-active,
  .collapse-leave-active {
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .collapse-enter-from,
  .collapse-leave-to {
    max-height: 0;
    opacity: 0;
    padding-top: 0;
    padding-bottom: 0;
  }

  .collapse-enter-to,
  .collapse-leave-from {
    max-height: 2000px;
    opacity: 1;
  }
</style>
