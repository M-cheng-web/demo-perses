<!-- 组件说明：状态提示，支持图标、关闭操作与多种状态样式 -->
<template>
  <div v-if="visible" :class="[bem(), `gf-alert--${type}`]">
    <div v-if="showIcon" :class="bem('icon')" :data-symbol="iconSymbol" aria-hidden="true"></div>
    <div :class="bem('body')">
      <div v-if="message" :class="bem('message')">{{ message }}</div>
      <div v-if="description || $slots.description" :class="bem('description')">
        <slot name="description">
          {{ description }}
        </slot>
      </div>
    </div>
    <button v-if="closable" type="button" :class="bem('close')" aria-label="关闭" @click="handleClose">x</button>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { createNamespace } from '../../utils';

  type AlertType = 'info' | 'success' | 'warning' | 'error';

  defineOptions({ name: 'GfAlert' });

  const props = withDefaults(
    defineProps<{
      /** 警告类型样式 */
      type?: AlertType;
      /** 简短标题文案 */
      message?: string;
      /** 详细描述文案 */
      description?: string;
      /** 是否显示状态图标 */
      showIcon?: boolean;
      /** 是否显示关闭按钮 */
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
  const visible = ref(true);

  const iconSymbol = computed(() => {
    const map: Record<AlertType, string> = {
      info: 'i',
      success: 'ok',
      warning: '!',
      error: 'x',
    };
    return map[props.type];
  });

  const type = computed<AlertType>(() => props.type);

  const handleClose = () => {
    visible.value = false;
    emit('close');
  };

  watch(
    () => [props.message, props.description, props.type],
    () => {
      visible.value = true;
    }
  );
</script>

<style scoped lang="less">
  .gf-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--gf-radius-md);
    border: 1px solid var(--gf-border);
    background: var(--gf-color-surface);
    color: var(--gf-text);
    position: relative;

    &__icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
      background: var(--gf-primary-soft);
      color: var(--gf-primary-strong);

      &::before {
        content: attr(data-symbol);
      }
    }

    &__body {
      flex: 1;
      display: grid;
      gap: 4px;
    }

    &__message {
      font-weight: 700;
      font-size: var(--gf-font-size-md);
    }

    &__description {
      font-size: var(--gf-font-size-sm);
      color: var(--gf-text-secondary);
      line-height: 1.5;
    }

    &__close {
      border: none;
      background: transparent;
      color: var(--gf-text-secondary);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 14px;
      line-height: 1;
    }

    &.gf-alert--success {
      border-color: var(--gf-color-success-border);
      background: var(--gf-color-success-soft);

      .gf-alert__icon {
        background: var(--gf-color-success-soft);
        color: var(--gf-color-success);
      }
    }

    &.gf-alert--warning {
      border-color: var(--gf-color-warning-border);
      background: var(--gf-color-warning-soft);

      .gf-alert__icon {
        background: var(--gf-color-warning-soft);
        color: var(--gf-color-warning);
      }
    }

    &.gf-alert--error {
      border-color: var(--gf-color-danger-border);
      background: var(--gf-color-danger-soft);

      .gf-alert__icon {
        background: var(--gf-color-danger-soft);
        color: var(--gf-color-danger);
      }
    }
  }
</style>
