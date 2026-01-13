<!-- 组件说明：复选框，支持半选、受控选中与禁用 -->
<template>
  <label :class="[bem(), { 'is-checked': isChecked, 'is-disabled': disabled, 'is-indeterminate': indeterminate }]">
    <input ref="inputRef" type="checkbox" :checked="isChecked" :disabled="disabled" :value="value" @change="handleChange" />
    <span :class="bem('box')">
      <span :class="bem('indicator')"></span>
    </span>
    <span :class="bem('label')">
      <slot></slot>
    </span>
  </label>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';
  import { ref, onMounted, watch, computed } from 'vue';

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
    }>(),
    {
      modelValue: false,
      checked: undefined,
      disabled: false,
      value: undefined,
      indeterminate: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'update:checked', value: boolean): void;
    (e: 'change', value: boolean): void;
  }>();

  const [_, bem] = createNamespace('checkbox');
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
    transition: color 0.2s var(--gf-easing);

    input {
      display: none;
    }

    &__box {
      width: 16px;
      height: 16px;
      border-radius: var(--gf-radius-sm);
      border: 1px solid var(--gf-border);
      background: var(--gf-color-surface);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: none;
      transition: all 0.2s var(--gf-easing);
    }

    &__indicator {
      width: 8px;
      height: 8px;
      background: transparent;
      border-radius: 4px;
      transition:
        background 0.2s var(--gf-easing),
        transform 0.2s var(--gf-easing);
      transform: scale(0.6);
    }

    &.is-checked {
      color: var(--gf-primary-strong);

      .gf-checkbox__box {
        border-color: var(--gf-border-strong);
        background: var(--gf-primary-soft);
        box-shadow: inset 0 0 0 1px var(--gf-border-strong);
      }

      .gf-checkbox__indicator {
        background: var(--gf-primary-strong);
        transform: scale(1);
      }
    }

    &.is-indeterminate .gf-checkbox__indicator {
      background: var(--gf-primary-strong);
      width: 10px;
      height: 2px;
      border-radius: 2px;
      transform: none;
    }

    &.is-disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
</style>
