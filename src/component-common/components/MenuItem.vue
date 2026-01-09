<template>
  <li :class="['cc-menu-item', 'ant-dropdown-menu-item', bem()]" @click="handleClick">
    <slot />
  </li>
</template>

<script setup lang="ts">
  import { inject } from 'vue';
  import { createNamespace } from '@/utils';

  const props = defineProps<{
    itemKey: string | number;
  }>();

  const [_, bem] = createNamespace('menu-item');
  const menuClick = inject<(key: string | number) => void>('cc-menu-click');

  const handleClick = () => {
    menuClick?.(props.itemKey);
  };
</script>

<style scoped lang="less">
  .dp-menu-item {
    padding: 8px 14px;
    cursor: pointer;
    color: var(--cc-text);

    &:hover {
      background: var(--cc-primary-weak);
    }
  }
</style>
