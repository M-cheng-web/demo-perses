<!-- 组件说明：分段控制器，用于少量选项的快速切换 -->
<template>
  <div :class="[bem(), bem(`size-${size}`)]">
    <button
      v-for="option in options"
      :key="option.value"
      :class="[bem('item'), { 'is-active': option.value === value }]"
      type="button"
      @click="handleSelect(option.value)"
    >
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfSegmented' });

  const props = withDefaults(
    defineProps<{
      /** 当前选中值 */
      value?: string | number;
      /** 选项列表 */
      options: { label: string; value: string | number }[];
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
    }>(),
    {
      value: '',
      size: 'middle',
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: string | number): void;
    (e: 'change', value: string | number): void;
  }>();

  const [_, bem] = createNamespace('segmented');

  const handleSelect = (val: string | number) => {
    emit('update:value', val);
    emit('change', val);
  };
</script>

<style scoped lang="less">
  .gf-segmented {
    display: inline-flex;
    padding: var(--gf-space-1);
    background: var(--gf-color-surface);
    border: 1px solid var(--gf-border);
    border-radius: var(--gf-radius-md);
    gap: var(--gf-space-1);

    &__item {
      border: none;
      background: transparent;
      padding: 7px 10px;
      border-radius: var(--gf-radius-sm);
      color: var(--gf-text-secondary);
      cursor: pointer;
      transition: background var(--gf-motion-fast) var(--gf-easing), color var(--gf-motion-fast) var(--gf-easing),
        border-color var(--gf-motion-fast) var(--gf-easing);
      min-width: 72px;
      border: 1px solid transparent;
      font-size: var(--gf-font-size-sm);

      &.is-active {
        background: var(--gf-color-primary-soft);
        color: var(--gf-color-primary);
        border: 1px solid var(--gf-border-strong);
      }

      &:hover {
        background: var(--gf-color-surface-muted);
        border-color: var(--gf-border);
      }
    }

    &--size-small .gf-segmented__item {
      padding: 6px 10px;
      font-size: var(--gf-font-size-xs);
      min-width: 60px;
    }

    &--size-large .gf-segmented__item {
      padding: 10px 14px;
      font-size: var(--gf-font-size-lg);
    }
  }
</style>
