<!-- 组件说明：时间范围选择器（相对时间为主），用于 Dashboard 工具栏 -->
<template>
  <Select
    v-model:value="model"
    :options="mergedOptions"
    :size="size"
    :style="style"
    :show-search="false"
    @change="(v: any) => emitChange(v as string)"
  />
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import Select from './Select.vue';

  defineOptions({ name: 'GfTimeRangePicker' });

  export interface TimeRangeOption {
    label: string;
    value: string; // e.g. now-5m
  }

  const props = withDefaults(
    defineProps<{
      value?: string;
      options?: TimeRangeOption[];
      size?: 'small' | 'middle' | 'large';
      style?: any;
    }>(),
    {
      value: 'now-1h',
      options: undefined,
      size: undefined,
      style: () => ({ width: '160px' }),
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: string): void;
    (e: 'change', value: string): void;
  }>();

  const model = computed({
    get: () => props.value,
    set: (v: any) => {
      emitChange(String(v));
    },
  });

  const mergedOptions = computed(() => {
    const defaults: TimeRangeOption[] = [
      { label: '最近 5 分钟', value: 'now-5m' },
      { label: '最近 15 分钟', value: 'now-15m' },
      { label: '最近 1 小时', value: 'now-1h' },
      { label: '最近 6 小时', value: 'now-6h' },
      { label: '最近 24 小时', value: 'now-24h' },
      { label: '最近 7 天', value: 'now-7d' },
    ];
    return (props.options ?? defaults).map((opt) => ({ label: opt.label, value: opt.value }));
  });

  const emitChange = (value: string) => {
    emit('update:value', value);
    emit('change', value);
  };
</script>
