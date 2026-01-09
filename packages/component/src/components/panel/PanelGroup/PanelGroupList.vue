<template>
  <div :class="bem()">
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
  import type { PanelGroup } from '#/types';
  import { createNamespace } from '#/utils';
  import PanelGroupItem from './PanelGroupItem.vue';

  const [_, bem] = createNamespace('panel-group-list');

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
  .dp-panel-group-list {
    display: flex;
    flex-direction: column;
    gap: @spacing-md;
  }
</style>
