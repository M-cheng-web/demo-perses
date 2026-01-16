<!-- 组件说明：轻量 CodeEditor（textarea），用于替代 Monaco 的大多数展示/编辑场景 -->
<template>
  <div :class="[bem(), { 'is-readonly': readOnly }]">
    <div v-if="showToolbar" :class="bem('toolbar')">
      <div :class="bem('left')">
        <slot name="toolbar-left"></slot>
      </div>
      <div :class="bem('right')">
        <Button v-if="allowFormat && language === 'json'" size="small" @click="formatJson">格式化</Button>
        <Button v-if="allowValidate && language === 'json'" size="small" @click="validateJson(true)">验证</Button>
        <Button v-if="showCopy" size="small" @click="copyToClipboard">复制</Button>
      </div>
    </div>

    <textarea
      :class="bem('textarea')"
      :value="modelValue"
      :readonly="readOnly"
      :style="{ height: normalizedHeight }"
      spellcheck="false"
      @input="(e: any) => emitValue(e.target?.value ?? '')"
    ></textarea>

    <div v-if="errorMessage" :class="bem('error')">
      <slot name="error">
        <div :class="bem('errorText')">{{ errorMessage }}</div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import Button from './Button.vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfCodeEditor' });

  const [_, bem] = createNamespace('code-editor');

  const props = withDefaults(
    defineProps<{
      modelValue: string;
      language?: 'json' | 'text';
      readOnly?: boolean;
      height?: string | number;
      showToolbar?: boolean;
      showCopy?: boolean;
      allowFormat?: boolean;
      allowValidate?: boolean;
    }>(),
    {
      language: 'text',
      readOnly: false,
      height: 360,
      showToolbar: true,
      showCopy: true,
      allowFormat: true,
      allowValidate: true,
    }
  );

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'change', value: string): void;
    (e: 'validate', isValid: boolean): void;
  }>();

  const normalizedHeight = computed(() => (typeof props.height === 'number' ? `${props.height}px` : props.height));
  const errorMessage = ref('');

  const emitValue = (value: string) => {
    emit('update:modelValue', value);
    emit('change', value);
  };

  const validateJson = (showMessage = false) => {
    if (props.language !== 'json') return;
    try {
      const raw = props.modelValue ?? '';
      if (raw.trim()) JSON.parse(raw);
      errorMessage.value = '';
      emit('validate', true);
      if (showMessage) errorMessage.value = '';
    } catch (err) {
      errorMessage.value = `JSON 格式错误: ${(err as Error).message}`;
      emit('validate', false);
    }
  };

  const formatJson = () => {
    if (props.language !== 'json') return;
    try {
      const parsed = JSON.parse(props.modelValue ?? '');
      const formatted = JSON.stringify(parsed, null, 2);
      emitValue(formatted);
      errorMessage.value = '';
    } catch (err) {
      errorMessage.value = `格式化失败: ${(err as Error).message}`;
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(props.modelValue ?? '');
    } catch {
      // ignore
    }
  };

  watch(
    () => props.modelValue,
    () => {
      if (props.language === 'json') validateJson(false);
    }
  );
</script>

<style scoped lang="less">
  .gf-code-editor {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--gf-color-border);
    border-radius: var(--gf-radius-md);
    overflow: hidden;
    background: var(--gf-color-surface);

    &__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 10px;
      background: var(--gf-color-surface-muted);
      border-bottom: 1px solid var(--gf-color-border-muted);
    }

    &__right {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    &__textarea {
      width: 100%;
      resize: vertical;
      border: 0;
      outline: 0;
      padding: 10px 12px;
      background: transparent;
      color: var(--gf-color-text);
      font-size: 12px;
      line-height: 1.6;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    }

    &__error {
      padding: 8px 12px;
      border-top: 1px solid var(--gf-color-border-muted);
      background: var(--gf-color-surface);
    }

    &__errorText {
      color: var(--gf-color-danger);
      font-size: 12px;
    }
  }
</style>

