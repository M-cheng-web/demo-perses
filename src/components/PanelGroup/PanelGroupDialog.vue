<template>
  <a-modal v-model:open="isOpen" :title="isEditMode ? '编辑面板组' : '创建面板组'" :width="600" @ok="handleSubmit" @cancel="handleCancel">
    <a-form :model="formData" layout="vertical" :label-col="{ span: 24 }">
      <a-form-item label="标题" required>
        <a-input v-model:value="formData.title" placeholder="请输入面板组标题" @press-enter="handleSubmit" />
      </a-form-item>

      <a-form-item label="描述">
        <a-textarea v-model:value="formData.description" placeholder="请输入面板组描述" :rows="3" :auto-size="{ minRows: 3, maxRows: 6 }" />
      </a-form-item>

      <a-form-item label="默认折叠">
        <a-switch v-model:checked="formData.isCollapsed" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { message } from 'ant-design-vue';
  import { useDashboardStore } from '@/stores';
  import type { PanelGroup } from '@/types';

  const dashboardStore = useDashboardStore();

  const isOpen = ref(false);
  const isEditMode = ref(false);
  const editingGroupId = ref<string>();

  const formData = ref<Partial<PanelGroup>>({
    title: '',
    description: '',
    isCollapsed: false,
  });

  // 打开创建对话框
  const openCreate = () => {
    isEditMode.value = false;
    formData.value = {
      title: '',
      description: '',
      isCollapsed: false,
    };
    isOpen.value = true;
  };

  // 打开编辑对话框
  const openEdit = (group: PanelGroup) => {
    isEditMode.value = true;
    editingGroupId.value = group.id;
    formData.value = {
      title: group.title,
      description: group.description,
      isCollapsed: group.isCollapsed,
    };
    isOpen.value = true;
  };

  const handleSubmit = () => {
    if (!formData.value.title?.trim()) {
      message.error('请输入面板组标题');
      return;
    }

    if (isEditMode.value && editingGroupId.value) {
      // 更新
      dashboardStore.updatePanelGroup(editingGroupId.value, formData.value);
      message.success('面板组已更新');
    } else {
      // 创建
      dashboardStore.addPanelGroup({
        title: formData.value.title,
        description: formData.value.description || '',
        isCollapsed: formData.value.isCollapsed || false,
      });
      message.success('面板组已创建');
    }

    handleCancel();
  };

  const handleCancel = () => {
    isOpen.value = false;
  };

  defineExpose({
    openCreate,
    openEdit,
  });
</script>
