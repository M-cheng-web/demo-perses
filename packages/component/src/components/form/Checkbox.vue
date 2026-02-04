<!-- 组件说明：复选框，支持半选、受控选中与禁用 (AntD-inspired) -->
<template>
  <label :class="[bem(), bem({ [`size-${size}`]: true }), { 'is-checked': isChecked, 'is-disabled': disabled, 'is-indeterminate': indeterminate }]">
    <span :class="bem('input')">
      <input ref="inputRef" type="checkbox" :checked="isChecked" :disabled="disabled" :value="value" @change="handleChange" />
      <span :class="bem('inner')">
        <Transition name="gf-checkbox-icon">
          <svg v-if="isChecked && !indeterminate" :class="bem('check-icon')" viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor">
            <path
              d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 0 0-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z"
            />
          </svg>
          <span v-else-if="indeterminate" :class="bem('indeterminate-icon')"></span>
        </Transition>
      </span>
    </span>
    <span v-if="$slots.default" :class="bem('label')">
      <slot></slot>
    </span>
  </label>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';
  import { ref, onMounted, watch, computed, inject } from 'vue';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfCheckbox' });

  const props = withDefaults(
    defineProps<{
      /** 受控值（v-model） */
      modelValue?: boolean;
      /** 直接传入受控 checked */
      checked?: boolean;
      /** 禁用状态 */
      disabled?: boolean;
      /** 自定义 value（透传给表单场景） */
      value?: any;
      /** 半选状态 */
      indeterminate?: boolean;
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
    }>(),
    {
      modelValue: false,
      checked: undefined,
      disabled: false,
      value: undefined,
      indeterminate: false,
      size: 'middle',
    }
  );

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'update:checked', value: boolean): void;
    (e: 'change', value: boolean): void;
  }>();

  const [_, bem] = createNamespace('checkbox');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);
  const inputRef = ref<HTMLInputElement>();

  const syncIndeterminate = () => {
    if (inputRef.value) {
      inputRef.value.indeterminate = props.indeterminate;
    }
  };

  onMounted(syncIndeterminate);
  watch(
    () => props.indeterminate,
    () => syncIndeterminate()
  );

  const isChecked = computed(() => (props.checked !== undefined ? props.checked : props.modelValue));

  const handleChange = (event: Event) => {
    if (props.disabled) return;
    const target = event.target as HTMLInputElement;
    emit('update:modelValue', target.checked);
    emit('update:checked', target.checked);
    emit('change', target.checked);
    formItem?.onFieldChange();
  };
</script>

<style scoped lang="less">
  .gf-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: var(--gf-text);
    font-size: var(--gf-font-size-sm);
    line-height: 1.5714285714285714;
    transition: color var(--gf-motion-fast) var(--gf-easing);

    &:hover:not(.is-disabled) &__inner {
      border-color: var(--gf-color-primary);
    }

    &__input {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      input {
        position: absolute;
        inset: 0;
        z-index: 1;
        width: 100%;
        height: 100%;
        cursor: inherit;
        opacity: 0;
        margin: 0;
        padding: 0;
      }
    }

    &__inner {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: var(--gf-radius-xs);
      border: 1px solid var(--gf-control-border-color, var(--gf-border));
      background: var(--gf-control-bg, var(--gf-color-surface));
      transition:
        all var(--gf-motion-fast) var(--gf-easing),
        border-color var(--gf-motion-fast) var(--gf-easing),
        background var(--gf-motion-fast) var(--gf-easing);

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        opacity: 0;
        transition: opacity var(--gf-motion-fast) var(--gf-easing);
      }
    }

    &__check-icon {
      color: #fff;
      font-size: 12px;
      transform: scale(1);
      transition: transform var(--gf-motion-fast) var(--gf-easing);
    }

    &__indeterminate-icon {
      width: 8px;
      height: 2px;
      background: #fff;
      border-radius: 1px;
    }

    &__label {
      user-select: none;
    }

    // Checked state
    &.is-checked &__inner,
    &.is-indeterminate &__inner {
      background: var(--gf-color-primary);
      border-color: var(--gf-color-primary);
    }

    &.is-checked:hover:not(.is-disabled) &__inner,
    &.is-indeterminate:hover:not(.is-disabled) &__inner {
      background: var(--gf-color-primary-hover);
      border-color: var(--gf-color-primary-hover);
    }

    // Disabled state
    &.is-disabled {
      cursor: not-allowed;
      color: var(--gf-color-text-disabled);
    }

    &.is-disabled &__inner {
      background: var(--gf-color-fill);
      border-color: var(--gf-border);
    }

    &.is-disabled.is-checked &__inner,
    &.is-disabled.is-indeterminate &__inner {
      background: var(--gf-color-fill-tertiary);
      border-color: var(--gf-border);

      .gf-checkbox__check-icon,
      .gf-checkbox__indeterminate-icon {
        color: var(--gf-color-text-disabled);
        background: var(--gf-color-text-disabled);
      }
    }

    // Size variants
    &--size-small {
      font-size: var(--gf-font-size-xs);
      gap: 6px;

      .gf-checkbox__inner {
        width: 14px;
        height: 14px;
      }

      .gf-checkbox__check-icon {
        font-size: 10px;
      }

      .gf-checkbox__indeterminate-icon {
        width: 6px;
      }
    }

    &--size-large {
      font-size: var(--gf-font-size-md);
      gap: 10px;

      .gf-checkbox__inner {
        width: 18px;
        height: 18px;
      }

      .gf-checkbox__check-icon {
        font-size: 14px;
      }

      .gf-checkbox__indeterminate-icon {
        width: 10px;
        height: 3px;
      }
    }
  }

  // Animation
  .gf-checkbox-icon-enter-active,
  .gf-checkbox-icon-leave-active {
    transition:
      opacity var(--gf-motion-fast) var(--gf-easing),
      transform var(--gf-motion-fast) var(--gf-easing);
  }

  .gf-checkbox-icon-enter-from,
  .gf-checkbox-icon-leave-to {
    opacity: 0;
    transform: scale(0.5);
  }
</style>
