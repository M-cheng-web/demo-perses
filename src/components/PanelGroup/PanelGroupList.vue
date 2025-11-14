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

    <!-- 面板组编辑对话框 -->
    <PanelGroupDialog ref="panelGroupDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { PanelGroup } from '@/types';
import PanelGroupItem from './PanelGroupItem.vue';
import PanelGroupDialog from './PanelGroupDialog.vue';

defineProps<{
  panelGroups: PanelGroup[];
}>();

const panelGroupDialogRef = ref<InstanceType<typeof PanelGroupDialog>>();

const handleEditGroup = (group: PanelGroup) => {
  panelGroupDialogRef.value?.openEdit(group);
};
</script>

<style scoped lang="less">
.panel-group-list {
  display: flex;
  flex-direction: column;
  gap: @spacing-md;
}
</style>
