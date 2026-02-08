<template>
  <div :class="bem('header')">
    <h2 :class="bem('title')">{{ dashboardName }}</h2>
    <div :class="bem('actions')">
      <Button :disabled="isBooting" @click="emit('toggle-panels-view')">
        {{ isAllPanelsView ? '分组视图' : '全部面板' }}
      </Button>

      <TimeRangePicker
        :value="selectedTimeRange"
        :disabled="isBooting"
        @update:value="(value: string) => emit('update:selected-time-range', value)"
        @change="(value: string) => emit('time-range-change', value)"
      />

      <Button type="primary" :loading="isSaving" :disabled="isBooting || isReadOnly" @click="emit('save')"> 保存 </Button>

      <Dropdown>
        <Button :icon="h(MoreOutlined)" :disabled="isBooting" />
        <template #overlay>
          <Menu
            :items="[
              { key: 'export', label: '导出 JSON', icon: h(DownloadOutlined) },
              { key: 'import', label: '导入 JSON', icon: h(UploadOutlined), disabled: isReadOnly },
              { key: 'viewJson', label: '查看 JSON', icon: h(FileTextOutlined) },
            ]"
            @click="(payload: { key: string | number }) => emit('menu-click', payload)"
          />
        </template>
      </Dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { h } from 'vue';
  import { Button, Dropdown, Menu, TimeRangePicker } from '@grafana-fast/component';
  import { MoreOutlined, DownloadOutlined, UploadOutlined, FileTextOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('dashboard-toolbar');

  defineProps<{
    dashboardName: string;
    isAllPanelsView: boolean;
    isBooting: boolean;
    isReadOnly: boolean;
    isSaving: boolean;
    selectedTimeRange: string;
  }>();

  const emit = defineEmits<{
    (e: 'toggle-panels-view'): void;
    (e: 'update:selected-time-range', value: string): void;
    (e: 'time-range-change', value: string): void;
    (e: 'save'): void;
    (e: 'menu-click', payload: { key: string | number }): void;
  }>();
</script>
