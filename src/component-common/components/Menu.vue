<template>
  <ul :class="['cc-menu', 'ant-dropdown-menu', bem()]">
    <slot />
  </ul>
</template>

<script setup lang="ts">
  import { provide } from 'vue';
  import { createNamespace } from '@/utils';

  const emit = defineEmits<{
    (e: 'click', info: { key: string | number }): void;
  }>();

  const [_, bem] = createNamespace('menu');

  const handleItemClick = (key: string | number) => {
    emit('click', { key });
  };

  provide('cc-menu-click', handleItemClick);
</script>

<style scoped lang="less">
  .dp-menu {
    list-style: none;
    padding: 4px 0;
    margin: 0;
  }
</style>
