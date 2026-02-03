<!-- 组件说明：多行文本域，支持自动高度与禁用状态 (AntD-inspired) -->
<template>
  <div :class="[bem(), { 'is-disabled': disabled, 'is-focused': isFocused }]">
    <textarea
      ref="textareaRef"
      :value="innerValue"
      :rows="rows"
      :placeholder="placeholder"
      :class="bem('textarea')"
      :disabled="disabled"
      :maxlength="maxLength"
      :readonly="readonly"
      @input="handleInput"
      @blur="handleBlur"
      @focus="handleFocus"
    ></textarea>
    <span v-if="showCount && maxLength" :class="bem('count')">
      {{ innerValue.length }} / {{ maxLength }}
    </span>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted, nextTick, inject, computed } from 'vue';
  import { createNamespace } from '../../utils';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfTextarea' });

  const props = withDefaults(
    defineProps<{
      /** 受控值 */
      value?: string;
      /** 占位提示 */
      placeholder?: string;
      /** 默认行数 */
      rows?: number;
      /** 自动高度配置 */
      autoSize?: boolean | { minRows?: number; maxRows?: number };
      /** 禁用状态 */
      disabled?: boolean;
      /** 只读状态 */
      readonly?: boolean;
      /** 最大字符数 */
      maxLength?: number;
      /** 是否展示字数统计 */
      showCount?: boolean;
    }>(),
    {
      value: '',
      placeholder: '',
      rows: 4,
      autoSize: undefined,
      disabled: false,
      readonly: false,
      maxLength: undefined,
      showCount: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: string): void;
    (e: 'change', value: string): void;
    (e: 'focus', evt: FocusEvent): void;
    (e: 'blur', evt: FocusEvent): void;
  }>();

  const [_, bem] = createNamespace('textarea');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);
  const textareaRef = ref<HTMLTextAreaElement>();
  const innerValue = ref(props.value ?? '');
  const isFocused = ref(false);

  const autoSizeConfig = computed(() => {
    if (!props.autoSize) return null;
    if (props.autoSize === true) {
      return { minRows: props.rows, maxRows: undefined };
    }
    return props.autoSize;
  });

  watch(
    () => props.value,
    (val) => {
      innerValue.value = val ?? '';
      resize();
    }
  );

  const resize = async () => {
    if (!autoSizeConfig.value || !textareaRef.value) return;

    await nextTick();

    const el = textareaRef.value;
    // Reset height to calculate scroll height
    el.style.height = 'auto';

    const computed = window.getComputedStyle(el);
    const lineHeight = parseInt(computed.lineHeight) || 22;
    const paddingTop = parseInt(computed.paddingTop) || 0;
    const paddingBottom = parseInt(computed.paddingBottom) || 0;
    const borderTop = parseInt(computed.borderTopWidth) || 0;
    const borderBottom = parseInt(computed.borderBottomWidth) || 0;

    const minRows = autoSizeConfig.value.minRows ?? 2;
    const maxRows = autoSizeConfig.value.maxRows;

    const minHeight = minRows * lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
    const maxHeight = maxRows ? maxRows * lineHeight + paddingTop + paddingBottom + borderTop + borderBottom : Infinity;

    const scrollHeight = el.scrollHeight;
    const targetHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);

    el.style.height = `${targetHeight}px`;
    el.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  onMounted(() => nextTick(resize));

  const handleInput = (evt: Event) => {
    const target = evt.target as HTMLTextAreaElement;
    innerValue.value = target.value;
    emit('update:value', innerValue.value);
    emit('change', innerValue.value);
    resize();
    formItem?.onFieldChange();
  };

  const handleFocus = (evt: FocusEvent) => {
    isFocused.value = true;
    emit('focus', evt);
  };

  const handleBlur = (evt: FocusEvent) => {
    isFocused.value = false;
    emit('blur', evt);
    formItem?.onFieldBlur();
  };

  // Expose
  defineExpose({
    focus: () => textareaRef.value?.focus(),
    blur: () => textareaRef.value?.blur(),
    resize,
  });
</script>

<style scoped lang="less">
  .gf-textarea {
    position: relative;
    width: 100%;

    &__textarea {
      width: 100%;
      min-height: 80px;
      padding: 4px 11px;
      border-radius: var(--gf-radius-sm);
      border: 1px solid var(--gf-control-border-color, var(--gf-border));
      background: var(--gf-control-bg, var(--gf-color-surface));
      color: var(--gf-text);
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      resize: vertical;
      outline: none;
      transition:
        border-color var(--gf-motion-fast) var(--gf-easing),
        box-shadow var(--gf-motion-fast) var(--gf-easing);

      &::placeholder {
        color: var(--gf-color-text-tertiary);
        opacity: 1;
      }

      &:hover:not(:disabled) {
        border-color: var(--gf-color-primary);
      }

      &:focus {
        border-color: var(--gf-color-primary);
        box-shadow: 0 0 0 2px var(--gf-color-primary-soft);
      }

      &:disabled {
        background: var(--gf-color-fill);
        cursor: not-allowed;
        color: var(--gf-color-text-disabled);
        resize: none;

        &::placeholder {
          color: var(--gf-color-text-disabled);
        }
      }
    }

    &__count {
      position: absolute;
      bottom: 4px;
      right: 11px;
      font-size: var(--gf-font-size-xs);
      color: var(--gf-color-text-tertiary);
      pointer-events: none;
      background: var(--gf-color-surface);
      padding: 0 2px;
    }

    &.is-disabled &__textarea {
      background: var(--gf-color-fill);

      &:hover {
        border-color: var(--gf-border);
      }
    }

    &.is-focused &__textarea {
      border-color: var(--gf-color-primary);
      box-shadow: 0 0 0 2px var(--gf-color-primary-soft);
    }
  }
</style>
