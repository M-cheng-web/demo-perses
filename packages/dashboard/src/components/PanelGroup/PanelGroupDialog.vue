<!--
  组件说明：面板组创建/编辑弹窗（PanelGroupDialog）

  用途：
  - 新建/编辑面板组的基础信息：标题、描述
  - 通过 `defineExpose` 暴露 `openCreate/openEdit`，供外部按钮触发打开
-->
<template>
  <Modal
    v-model:open="isOpen"
    :title="isEditMode ? '编辑面板组' : '创建面板组'"
    :width="600"
    :lock-scroll="lockScrollEnabled"
    :lock-scroll-el="lockScrollEl"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <Form :model="formData" layout="vertical" :label-col="{ span: 24 }">
      <FormItem label="标题" required>
        <Input v-model:value="formData.title" placeholder="请输入面板组标题" @press-enter="handleSubmit" />
      </FormItem>

      <FormItem label="描述">
        <Textarea v-model:value="formData.description" placeholder="请输入面板组描述" :rows="3" :auto-size="{ minRows: 3, maxRows: 6 }" />
      </FormItem>
    </Form>
  </Modal>
</template>

<script setup lang="ts">
  import { Modal, Form, FormItem, Input, Textarea } from '@grafana-fast/component';
  import { computed, ref } from 'vue';
  import { message } from '@grafana-fast/component';
  import { useDashboardStore } from '/#/stores';
  import { useDashboardRuntime } from '/#/runtime/useInjected';
  import { createNamespace } from '/#/utils';
  import type { PanelGroup } from '@grafana-fast/types';
  import { storeToRefs } from '@grafana-fast/store';

  const [_, _bem] = createNamespace('panel-group-dialog');

  const dashboardStore = useDashboardStore();
  const { isReadOnly } = storeToRefs(dashboardStore);
  const runtime = useDashboardRuntime();
  const lockScrollEl = computed(() => runtime.scrollEl?.value ?? runtime.rootEl?.value ?? null);
  const lockScrollEnabled = computed(() => lockScrollEl.value != null);

  const isOpen = ref(false);
  const isEditMode = ref(false);
  const editingGroupId = ref<string>();
  const isSubmitting = ref(false);

  const formData = ref<Pick<PanelGroup, 'title' | 'description'>>({
    title: '',
    description: '',
  });

  // 打开创建对话框
  const openCreate = () => {
    if (isReadOnly.value) {
      message.warning('当前为只读模式，无法创建面板组');
      return;
    }
    isEditMode.value = false;
    formData.value = {
      title: '',
      description: '',
    };
    isOpen.value = true;
  };

  // 打开编辑对话框
  const openEdit = (group: PanelGroup) => {
    if (isReadOnly.value) {
      message.warning('当前为只读模式，无法编辑面板组');
      return;
    }
    isEditMode.value = true;
    editingGroupId.value = group.id;
    formData.value = {
      title: group.title,
      description: group.description,
    };
    isOpen.value = true;
  };

  const handleSubmit = async () => {
    if (isReadOnly.value) {
      message.warning('当前为只读模式，无法保存面板组');
      return;
    }
    if (isSubmitting.value) return;
    if (!formData.value.title?.trim()) {
      message.error('请输入面板组标题');
      return;
    }

    const toastKey = isEditMode.value ? `pg-save:${String(editingGroupId.value ?? '')}` : 'pg-create';
    message.loading({ content: '正在保存...', key: toastKey, duration: 0 });
    isSubmitting.value = true;
    try {
      if (isEditMode.value && editingGroupId.value) {
        // 更新
        await dashboardStore.updatePanelGroup(editingGroupId.value, formData.value);
        message.success({ content: '面板组已更新', key: toastKey, duration: 2 });
      } else {
        // 创建
        await dashboardStore.addPanelGroup({
          title: formData.value.title,
          description: formData.value.description || '',
        });
        message.success({ content: '面板组已创建', key: toastKey, duration: 2 });
      }
      handleCancel();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '保存失败';
      message.error({ content: msg, key: toastKey, duration: 3 });
    } finally {
      isSubmitting.value = false;
    }
  };

  const handleCancel = () => {
    isOpen.value = false;
  };

  defineExpose({
    openCreate,
    openEdit,
  });
</script>
