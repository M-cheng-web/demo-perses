<template>
  <div v-show="isActive" :class="bem()">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, onBeforeUnmount, onMounted, type Ref } from 'vue';
  import { createNamespace } from '/#/utils';

  const props = defineProps<{
    name: string;
    tab: string;
  }>();

  const [_, bem] = createNamespace('tab-pane');
  const active = inject<Ref<string>>('gf-tabs-active');
  const register = inject<(pane: { key: string; label: string }) => void>('gf-tabs-register');
  const unregister = inject<(key: string) => void>('gf-tabs-unregister');

  const isActive = computed(() => active?.value === props.name);

  onMounted(() => {
    register?.({ key: props.name, label: props.tab });
  });

  onBeforeUnmount(() => {
    unregister?.(props.name);
  });
</script>

<style scoped>
  .dp-tab-pane {
    width: 100%;
  }
</style>
