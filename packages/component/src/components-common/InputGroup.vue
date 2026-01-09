<template>
  <div :class="[bem(), { 'is-compact': props.compact }]">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '/#/utils';

  const props = withDefaults(
    defineProps<{
      compact?: boolean;
    }>(),
    {
      compact: false,
    }
  );

  const [_, bem] = createNamespace('input-group');
</script>

<style scoped lang="less">
  .dp-input-group {
    display: flex;
    align-items: stretch;
    width: 100%;
    gap: 8px;

    &.is-compact {
      gap: 0;

      ::v-deep(> *) {
        border-radius: 0;
      }

      ::v-deep(> *:first-child) {
        border-top-left-radius: 8px;
        border-bottom-left-radius: 8px;
      }

      ::v-deep(> *:last-child) {
        border-top-right-radius: 8px;
        border-bottom-right-radius: 8px;
      }

      ::v-deep(> * + *) {
        margin-left: -1px;
      }
    }
  }
</style>
