<template>
  <div :class="[bem(), 'cc-textarea-wrapper']">
    <textarea
      ref="textareaRef"
      :class="['cc-textarea', 'ant-input']"
      :value="value"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
      @change="onChange"
    />
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref, watch } from 'vue';
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      value?: string;
      placeholder?: string;
      rows?: number;
      disabled?: boolean;
      autoSize?: { minRows?: number; maxRows?: number };
    }>(),
    {
      value: '',
      placeholder: '',
      rows: 3,
      disabled: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', val: string): void;
    (e: 'change', val: string): void;
  }>();

  const [_, bem] = createNamespace('textarea');
  const textareaRef = ref<HTMLTextAreaElement>();

  const resize = () => {
    const el = textareaRef.value;
    if (!el || !props.autoSize) return;

    const lineHeight = 20;
    const minH = (props.autoSize.minRows ?? props.rows) * lineHeight;
    const maxH = (props.autoSize.maxRows ?? props.rows) * lineHeight;

    el.style.height = 'auto';
    const newHeight = Math.min(maxH, Math.max(minH, el.scrollHeight));
    el.style.height = `${newHeight}px`;
  };

  const onInput = (evt: Event) => {
    const target = evt.target as HTMLTextAreaElement;
    emit('update:value', target.value);
    resize();
  };

  const onChange = (evt: Event) => {
    const target = evt.target as HTMLTextAreaElement;
    emit('update:value', target.value);
    emit('change', target.value);
    resize();
  };

  watch(
    () => props.value,
    () => resize()
  );

  onMounted(() => resize());
</script>

<style scoped lang="less">
  .dp-textarea-wrapper {
    width: 100%;
  }

  .cc-textarea {
    width: 100%;
    resize: vertical;
    line-height: 1.5;
  }
</style>
