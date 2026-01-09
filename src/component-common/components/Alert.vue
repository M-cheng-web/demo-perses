<template>
  <div :class="['cc-alert', 'ant-alert', bem(), typeClass]">
    <div :class="bem('content')">
      <slot name="icon" />
      <div :class="['ant-alert-message', bem('message')]">
        <slot>{{ message }}</slot>
      </div>
      <div v-if="description" :class="['ant-alert-description', bem('description')]">
        {{ description }}
      </div>
    </div>
    <button v-if="closable" :class="bem('close')" @click="handleClose">×</button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '@/utils';

  type AlertType = 'info' | 'success' | 'warning' | 'error';

  const props = withDefaults(
    defineProps<{
      type?: AlertType;
      message?: string;
      description?: string;
      showIcon?: boolean;
      closable?: boolean;
    }>(),
    {
      type: 'info',
      message: '',
      description: '',
      showIcon: false,
      closable: false,
    }
  );

  const emit = defineEmits<{
    (e: 'close'): void;
  }>();

  const [_, bem] = createNamespace('alert');

  const typeClass = computed(() => `cc-alert--${props.type}`);

  const handleClose = () => {
    emit('close');
  };
</script>

<style scoped lang="less">
  .dp-alert {
    position: relative;
    padding-right: 28px;

    &__content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    &__message {
      font-weight: 600;
    }

    &__description {
      color: var(--cc-text-secondary);
      font-size: 12px;
      line-height: 1.4;
    }

    &__close {
      position: absolute;
      top: 6px;
      right: 8px;
      background: transparent;
      border: none;
      color: var(--cc-text-secondary);
      cursor: pointer;
    }
  }
</style>
