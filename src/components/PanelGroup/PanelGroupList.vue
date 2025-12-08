<template>
  <div class="panel-group-list">
    <PanelGroupItem
      v-for="(group, index) in panelGroups"
      :key="group.id"
      :group="group"
      :index="index"
      :is-last="index === panelGroups.length - 1"
      @edit="handleEditGroup"
    />
  </div>
</template>

<script setup lang="ts">
  import type { PanelGroup } from '@/types';
  import PanelGroupItem from './PanelGroupItem.vue';

  defineProps<{
    panelGroups: PanelGroup[];
  }>();

  const emit = defineEmits<{
    (e: 'edit-group', group: PanelGroup): void;
  }>();

  const handleEditGroup = (group: PanelGroup) => {
    emit('edit-group', group);
  };
</script>

<style scoped lang="less">
  .panel-group-list {
    display: flex;
    flex-direction: column;
    gap: @spacing-md;
  }
</style>
