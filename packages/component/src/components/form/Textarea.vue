<!-- 组件说明：多行文本域，支持自动高度与禁用状态 -->
<template>
  <div :class="[bem(), { 'is-disabled': disabled }]">
    <textarea
      ref="textareaRef"
      :value="innerValue"
      :rows="rows"
      :placeholder="placeholder"
      :class="[bem('control'), 'gf-control', { 'gf-control--disabled': disabled }]"
      :disabled="disabled"
      @input="handleInput"
      @blur="handleBlur"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted, nextTick, inject } from 'vue';
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
      autoSize?: { minRows?: number; maxRows?: number };
      /** 禁用状态 */
      disabled?: boolean;
    }>(),
    {
      value: '',
      placeholder: '',
      rows: 3,
      autoSize: undefined,
      disabled: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: string): void;
    (e: 'change', value: string): void;
  }>();

  const [_, bem] = createNamespace('textarea');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);
  const textareaRef = ref<HTMLTextAreaElement>();
  const innerValue = ref(props.value ?? '');

  watch(
    () => props.value,
    (val) => {
      innerValue.value = val ?? '';
      resize();
    }
  );

  const resize = () => {
    if (!props.autoSize || !textareaRef.value) return;
    const el = textareaRef.value;
    el.style.height = 'auto';
    const lineHeight = 20;
    const minRows = props.autoSize.minRows ?? props.rows ?? 3;
    const maxRows = props.autoSize.maxRows ?? minRows;
    const minHeight = minRows * lineHeight;
    const maxHeight = maxRows * lineHeight;
    const scrollHeight = el.scrollHeight;
    const target = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    el.style.height = `${target}px`;
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

  const handleBlur = () => {
    formItem?.onFieldBlur();
  };
</script>

<style scoped lang="less">
  .gf-textarea {
    width: 100%;

    &__control {
      width: 100%;
      resize: vertical;
      min-height: 80px;
    }

    &.is-disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
  }
</style>
