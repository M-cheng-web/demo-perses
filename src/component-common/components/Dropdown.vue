<template>
  <div
    ref="triggerRef"
    :class="[bem(), 'cc-dropdown']"
    @click="handleTriggerClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <slot />
  </div>
  <teleport to="body">
    <transition name="cc-tooltip-fade">
      <div v-if="innerOpen" ref="overlayRef" :class="['cc-dropdown__overlay', 'ant-dropdown', bem('overlay')]" :style="overlayStyle">
        <slot name="overlay" />
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      trigger?: Array<'click' | 'hover'>;
      open?: boolean;
    }>(),
    {
      trigger: () => ['hover'],
      open: undefined,
    }
  );

  const emit = defineEmits<{
    (e: 'update:open', val: boolean): void;
  }>();

  const [_, bem] = createNamespace('dropdown');
  const triggerRef = ref<HTMLElement>();
  const overlayRef = ref<HTMLElement>();
  const innerOpen = ref(false);
  const overlayStyle = ref<Record<string, string>>({});

  const isControlled = computed(() => props.open !== undefined);

  const syncOpen = (val: boolean) => {
    if (!isControlled.value) {
      innerOpen.value = val;
    }
    emit('update:open', val);
    if (val) {
      updatePosition();
    }
  };

  const updatePosition = () => {
    nextTick(() => {
      const trigger = triggerRef.value;
      const overlay = overlayRef.value;
      if (!trigger || !overlay) return;
      const rect = trigger.getBoundingClientRect();
      overlayStyle.value = {
        position: 'absolute',
        top: `${rect.bottom + window.scrollY + 6}px`,
        left: `${rect.left + window.scrollX}px`,
        minWidth: `${rect.width}px`,
      };
    });
  };

  const handleDocumentClick = (event: MouseEvent) => {
    if (!innerOpen.value) return;
    const target = event.target as Node;
    if (triggerRef.value?.contains(target) || overlayRef.value?.contains(target)) return;
    syncOpen(false);
  };

  const handleTriggerClick = () => {
    if (!props.trigger.includes('click')) return;
    syncOpen(!innerOpen.value);
  };

  const handleMouseEnter = () => {
    if (props.trigger.includes('hover')) {
      syncOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (props.trigger.includes('hover')) {
      syncOpen(false);
    }
  };

  watch(
    () => props.open,
    (val) => {
      if (isControlled.value) {
        innerOpen.value = !!val;
        if (val) {
          updatePosition();
        }
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick);
  });
</script>

<style scoped lang="less">
  .dp-dropdown {
    display: inline-flex;
  }

  .cc-dropdown__overlay {
    background: var(--cc-surface);
    border: 1px solid var(--cc-border);
    border-radius: var(--cc-radius-sm);
    box-shadow: var(--cc-shadow);
    padding: 6px 0;
    z-index: 2100;
  }
</style>
