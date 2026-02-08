<!-- 组件说明：状态提示，支持图标、关闭操作与多种状态样式 (AntD-inspired) -->
<template>
  <Transition name="gf-slide-up">
    <div
      v-if="visible"
      :class="[bem(), bem({ [`size-${resolvedSize}`]: true }), `gf-alert--${type}`, { 'is-with-description': hasDescription, 'is-banner': banner }]"
    >
      <span v-if="showIcon" :class="bem('icon')">
        <InfoCircleFilled v-if="type === 'info'" />
        <CheckCircleFilled v-else-if="type === 'success'" />
        <ExclamationCircleFilled v-else-if="type === 'warning'" />
        <CloseCircleFilled v-else-if="type === 'error'" />
      </span>
      <div :class="bem('body')">
        <div v-if="message" :class="bem('message')">{{ message }}</div>
        <div v-if="description || $slots.description" :class="bem('description')">
          <slot name="description">
            {{ description }}
          </slot>
        </div>
      </div>
      <button v-if="closable" type="button" :class="bem('close')" aria-label="关闭" @click="handleClose">
        <CloseOutlined />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { computed, ref, useSlots, watch } from 'vue';
  import { InfoCircleFilled, CheckCircleFilled, ExclamationCircleFilled, CloseCircleFilled, CloseOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';
  import { useComponentSize } from '../../context/size';

  type AlertType = 'info' | 'success' | 'warning' | 'error';

  defineOptions({ name: 'GfAlert' });

  const props = withDefaults(
    defineProps<{
      /** 警告类型样式 */
      type?: AlertType;
      /** 尺寸（影响 padding / 字号密度） */
      size?: 'small' | 'middle';
      /** 简短标题文案 */
      message?: string;
      /** 详细描述文案 */
      description?: string;
      /** 是否显示状态图标 */
      showIcon?: boolean;
      /** 是否显示关闭按钮 */
      closable?: boolean;
      /** 是否为顶部通栏模式 */
      banner?: boolean;
    }>(),
    {
      type: 'info',
      size: undefined,
      message: '',
      description: '',
      showIcon: false,
      closable: false,
      banner: false,
    }
  );

  const emit = defineEmits<{
    (e: 'close'): void;
  }>();

  const [_, bem] = createNamespace('alert');
  const globalSize = useComponentSize(computed(() => props.size));
  // Alert only supports 'small' | 'middle'; map 'large' → 'middle'
  const resolvedSize = computed(() => (globalSize.value === 'small' ? 'small' : 'middle'));
  const visible = ref(true);
  const slots = useSlots();
  const hasDescription = computed(() => !!(props.description || slots.description));

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
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--gf-radius-lg);
    font-size: var(--gf-font-size-sm);
    line-height: 1.5714285714285714;
    position: relative;

    &:not(.is-with-description) {
      align-items: center;
    }

    // Info (default)
    &--info {
      background: var(--gf-color-primary-soft);
      border: 1px solid var(--gf-color-primary-border);
    }

    &--info &__icon {
      color: var(--gf-color-primary);
    }

    // Success
    &--success {
      background: var(--gf-color-success-soft);
      border: 1px solid var(--gf-color-success-border);
    }

    &--success &__icon {
      color: var(--gf-color-success);
    }

    // Warning
    &--warning {
      background: var(--gf-color-warning-soft);
      border: 1px solid var(--gf-color-warning-border);
    }

    &--warning &__icon {
      color: var(--gf-color-warning);
    }

    // Error
    &--error {
      background: var(--gf-color-danger-soft);
      border: 1px solid var(--gf-color-danger-border);
    }

    &--error &__icon {
      color: var(--gf-color-danger);
    }

    &__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
      line-height: 1;
    }

    &.is-with-description &__icon {
      font-size: 24px;
      margin-top: 1px;
    }

    &__body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      min-width: 0;
    }

    &__message {
      font-weight: 500;
      color: var(--gf-color-text);
    }

    &.is-with-description &__message {
      font-size: var(--gf-font-size-md);
      font-weight: 600;
    }

    &__description {
      color: var(--gf-color-text-secondary);
    }

    &__close {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--gf-color-text-tertiary);
      cursor: pointer;
      border-radius: var(--gf-radius-xs);
      transition:
        color var(--gf-motion-fast) var(--gf-easing),
        background var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        color: var(--gf-color-text-secondary);
        background: rgba(0, 0, 0, 0.06);
      }
    }

    // Size small
    &--size-small {
      padding: 6px 10px;

      .gf-alert__icon {
        font-size: 12px;
      }

      .gf-alert__message {
        font-size: var(--gf-font-size-sm);
        font-weight: 500;
      }
    }

    // Banner mode
    &.is-banner {
      border-radius: 0;
      border-left: none;
      border-right: none;
    }
  }

  // Animation
  .gf-slide-up-enter-active,
  .gf-slide-up-leave-active {
    transition:
      opacity var(--gf-motion-normal) var(--gf-easing),
      max-height var(--gf-motion-normal) var(--gf-easing),
      padding var(--gf-motion-normal) var(--gf-easing),
      margin var(--gf-motion-normal) var(--gf-easing);
  }

  .gf-slide-up-enter-from,
  .gf-slide-up-leave-to {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    margin-top: 0;
    margin-bottom: 0;
  }
</style>
