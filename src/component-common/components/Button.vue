<template>
  <button
    :class="[
      bem(),
      'cc-btn',
      'ant-btn',
      sizeClass,
      typeClass,
      {
        'ant-btn-block': block,
        'is-danger': danger,
        'is-disabled': disabled || loading,
      },
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="cc-spin__dot" />
    <span v-else-if="icon" class="cc-button__icon">
      <component :is="icon" />
    </span>
    <span v-else-if="$slots.icon" class="cc-button__icon">
      <slot name="icon" />
    </span>
    <span class="cc-button__content"><slot /></span>
  </button>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '@/utils';

  type ButtonType = 'primary' | 'default' | 'dashed' | 'text' | 'link';
  type ButtonSize = 'small' | 'middle' | 'large';

  const props = withDefaults(
    defineProps<{
      type?: ButtonType;
      size?: ButtonSize;
      block?: boolean;
      danger?: boolean;
      loading?: boolean;
      disabled?: boolean;
      icon?: any;
    }>(),
    {
      type: 'default',
      size: 'middle',
      block: false,
      danger: false,
      loading: false,
      disabled: false,
    }
  );

  const emit = defineEmits<{
    (e: 'click', evt: MouseEvent): void;
  }>();

  const [_, bem] = createNamespace('button');

  const sizeClass = computed(() => {
    if (props.size === 'small') return 'ant-btn-sm';
    if (props.size === 'large') return 'ant-btn-lg';
    return '';
  });

  const typeClass = computed(() => (props.type ? `ant-btn-${props.type}` : 'ant-btn-default'));

  const handleClick = (evt: MouseEvent) => {
    if (props.disabled || props.loading) return;
    emit('click', evt);
  };
</script>

<style scoped lang="less">
  .dp-button {
    &__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }

    &__content {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
  }
</style>
