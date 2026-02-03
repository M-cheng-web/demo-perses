<!-- 组件说明：二次确认气泡，包含确认/取消操作 (AntD-inspired) -->
<template>
  <div :class="bem()" ref="triggerRef">
    <span @click="toggle">
      <slot></slot>
    </span>
    <Teleport :to="portalTarget">
      <Transition name="gf-zoom-big-fast">
        <div v-if="open" :class="[bem('content'), themeClass]" :data-gf-theme="colorScheme" :style="popupStyle" ref="popupRef">
          <div :class="bem('arrow')"></div>
          <div :class="bem('inner')">
            <div :class="bem('message')">
              <span :class="bem('icon')">
                <ExclamationCircleFilled />
              </span>
              <div :class="bem('title')">
                <slot name="title">{{ title }}</slot>
              </div>
            </div>
            <div v-if="description" :class="bem('description')">{{ description }}</div>
            <div :class="bem('actions')">
              <Button size="small" @click="handleCancel">{{ cancelText }}</Button>
              <Button size="small" type="primary" :danger="okDanger" @click="handleConfirm">{{ okText }}</Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
  import { ExclamationCircleFilled } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';
  import Button from '../base/Button.vue';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';
  import { GF_PORTAL_CONTEXT_KEY } from '../../context/portal';

  defineOptions({ name: 'GfPopconfirm' });

  const props = withDefaults(
    defineProps<{
      /** 确认提示文案 */
      title?: string;
      /** 详细描述 */
      description?: string;
      /** 确认按钮文字 */
      okText?: string;
      /** 取消按钮文字 */
      cancelText?: string;
      /** 确认按钮是否为危险按钮 */
      okDanger?: boolean;
      /** 气泡位置 */
      placement?: 'top' | 'bottom' | 'left' | 'right';
    }>(),
    {
      title: '确认执行该操作？',
      description: '',
      okText: '确定',
      cancelText: '取消',
      okDanger: false,
      placement: 'top',
    }
  );

  const emit = defineEmits<{
    (e: 'confirm'): void;
    (e: 'cancel'): void;
  }>();

  const [_, bem] = createNamespace('popconfirm');
  const themeContext = inject(GF_THEME_CONTEXT_KEY, null);
  const themeClass = computed(() => themeContext?.themeClass.value);
  const colorScheme = computed(() => themeContext?.colorScheme.value);
  const portalContext = inject(GF_PORTAL_CONTEXT_KEY, null);
  const portalTarget = computed(() => portalContext?.target.value ?? 'body');
  const triggerRef = ref<HTMLElement>();
  const popupRef = ref<HTMLElement>();
  const open = ref(false);
  const popupStyle = ref<Record<string, string>>({});

  const toggle = () => {
    open.value = !open.value;
    if (open.value) updatePosition();
  };

  const close = () => (open.value = false);

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const updatePosition = async () => {
    const trigger = triggerRef.value;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    await nextTick();
    const popup = popupRef.value;
    const popupRect = popup?.getBoundingClientRect();
    const width = popupRect?.width || 0;
    const height = popupRect?.height || 0;
    const padding = 8;
    let left = rect.left + rect.width / 2;
    let top = rect.top - 10;

    left = clamp(left, padding + width / 2, window.innerWidth - padding - width / 2);
    if (top - height < padding) {
      top = rect.bottom + height + 10;
    }

    popupStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  const handleOutside = (evt: MouseEvent) => {
    if (!triggerRef.value) return;
    if (triggerRef.value.contains(evt.target as Node)) return;
    close();
  };

  onMounted(() => {
    window.addEventListener('click', handleOutside);
    window.addEventListener('resize', updatePosition);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('click', handleOutside);
    window.removeEventListener('resize', updatePosition);
  });

  const handleConfirm = () => {
    emit('confirm');
    close();
  };

  const handleCancel = () => {
    emit('cancel');
    close();
  };
</script>

<style scoped lang="less">
  .gf-popconfirm {
    display: inline-flex;
    position: relative;
  }

  .gf-popconfirm__content {
    position: fixed;
    transform: translate(-50%, -100%);
    z-index: var(--gf-z-popover);
  }

  .gf-popconfirm__arrow {
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 16px;
    height: 16px;
    pointer-events: none;

    &::before {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      bottom: 6px;
      left: 4px;
      background: var(--gf-color-surface);
      transform: rotate(45deg);
      box-shadow: 3px 3px 7px rgba(0, 0, 0, 0.07);
    }
  }

  .gf-popconfirm__inner {
    background: var(--gf-color-surface);
    border-radius: var(--gf-radius-lg);
    box-shadow: var(--gf-shadow-2);
    padding: 12px 16px;
    min-width: 200px;
    max-width: 300px;
  }

  .gf-popconfirm__message {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .gf-popconfirm__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 14px;
    color: var(--gf-color-warning);
    margin-top: 1px;
  }

  .gf-popconfirm__title {
    font-size: var(--gf-font-size-sm);
    line-height: 1.5714285714285714;
    color: var(--gf-color-text);
    font-weight: 600;
  }

  .gf-popconfirm__description {
    font-size: var(--gf-font-size-sm);
    line-height: 1.5714285714285714;
    color: var(--gf-color-text-secondary);
    margin-top: 4px;
    margin-left: 22px;
  }

  .gf-popconfirm__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  // Animation
  .gf-zoom-big-fast-enter-active,
  .gf-zoom-big-fast-leave-active {
    transition:
      opacity 0.1s var(--gf-easing),
      transform 0.1s var(--gf-easing);
  }

  .gf-zoom-big-fast-enter-from,
  .gf-zoom-big-fast-leave-to {
    opacity: 0;
    transform: translate(-50%, -100%) scale(0.8);
  }
</style>
