<template>
  <div :class="bem()">
    <div :class="bem('toolbar')" v-if="showToolbar">
      <Space>
        <Button size="small" @click="formatJson">
          <template #icon><FormatPainterOutlined /></template>
          格式化
        </Button>
        <Button size="small" @click="() => validateJson(true)">
          <template #icon><CheckCircleOutlined /></template>
          验证
        </Button>
        <Button v-if="showCopy" size="small" @click="copyToClipboard">
          <template #icon><CopyOutlined /></template>
          复制
        </Button>
      </Space>
    </div>
    <div ref="editorContainer" :class="bem('container')"></div>
    <div v-if="errorMessage" :class="bem('error')">
      <Alert :message="errorMessage" type="error" closable @close="errorMessage = ''" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch } from 'vue';
  import { message, Button, Space, Alert } from '@/component-common';
  import { FormatPainterOutlined, CheckCircleOutlined, CopyOutlined } from '@ant-design/icons-vue';
  import monaco from '@/monaco-worker';
  import { createNamespace } from '@/utils';

  const [_, bem] = createNamespace('json-editor');

  interface Props {
    modelValue?: string | object;
    height?: string | number;
    language?: string;
    readOnly?: boolean;
    showToolbar?: boolean;
    showCopy?: boolean;
    options?: monaco.editor.IStandaloneEditorConstructionOptions;
  }

  const props = withDefaults(defineProps<Props>(), {
    height: '400px',
    language: 'json',
    readOnly: false,
    showToolbar: true,
    showCopy: true,
  });

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'change', value: string): void;
    (e: 'validate', isValid: boolean): void;
  }>();

  const editorContainer = ref<HTMLElement>();
  let editor: monaco.editor.IStandaloneCodeEditor | null = null;
  const errorMessage = ref('');

  // 将对象转换为 JSON 字符串
  const getValueAsString = (): string => {
    if (typeof props.modelValue === 'string') {
      return props.modelValue;
    }
    if (typeof props.modelValue === 'object' && props.modelValue !== null) {
      return JSON.stringify(props.modelValue, null, 2);
    }
    return '';
  };

  const initEditor = () => {
    if (!editorContainer.value) return;

    const defaultOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
      value: getValueAsString(),
      language: props.language,
      theme: 'vs',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      readOnly: props.readOnly,
      fontSize: 13,
      lineNumbers: 'on',
      roundedSelection: false,
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      formatOnPaste: true,
      formatOnType: true,
      ...props.options,
    };

    editor = monaco.editor.create(editorContainer.value, defaultOptions);

    // 监听内容变化
    editor.onDidChangeModelContent(() => {
      const value = editor?.getValue() || '';
      emit('update:modelValue', value);
      emit('change', value);
    });

    // 自动验证 JSON
    if (props.language === 'json') {
      editor.onDidChangeModelContent(() => {
        validateJson(false);
      });
    }
  };

  const formatJson = () => {
    if (!editor) return;

    try {
      const value = editor.getValue();
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      editor.setValue(formatted);
      message.success('格式化成功');
      errorMessage.value = '';
    } catch (error) {
      const err = error as Error;
      message.error('格式化失败：JSON 格式错误');
      errorMessage.value = `格式化失败: ${err.message}`;
    }
  };

  const validateJson = (showMessage = true) => {
    if (!editor) return;

    try {
      const value = editor.getValue();
      if (value.trim()) {
        JSON.parse(value);
      }
      errorMessage.value = '';
      if (showMessage) {
        message.success('JSON 格式正确');
      }
      emit('validate', true);
    } catch (error) {
      const err = error as Error;
      errorMessage.value = `JSON 格式错误: ${err.message}`;
      if (showMessage) {
        message.error('JSON 格式错误');
      }
      emit('validate', false);
    }
  };

  const copyToClipboard = async () => {
    if (!editor) return;

    try {
      const value = editor.getValue();
      await navigator.clipboard.writeText(value);
      message.success('已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
    }
  };

  watch(
    () => props.modelValue,
    (newValue) => {
      if (!editor) return;
      const currentValue = editor.getValue();
      const newValueString = typeof newValue === 'string' ? newValue : JSON.stringify(newValue, null, 2);
      if (currentValue !== newValueString) {
        editor.setValue(newValueString);
      }
    },
    { deep: true }
  );

  watch(
    () => props.readOnly,
    (newValue) => {
      if (!editor) return;
      editor.updateOptions({ readOnly: newValue });
    }
  );

  onMounted(() => {
    initEditor();
  });

  onUnmounted(() => {
    editor?.dispose();
    editor = null;
  });
</script>

<style scoped lang="less">
  .dp-json-editor {
    display: flex;
    flex-direction: column;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    overflow: hidden;

    &__toolbar {
      padding: 8px 12px;
      background: #fafafa;
      border-bottom: 1px solid #d9d9d9;
    }

    &__container {
      flex: 1;
      min-height: v-bind(height);
      overflow: hidden;
    }

    &__error {
      padding: 8px 12px;
      background: #fff;
      border-top: 1px solid #d9d9d9;
    }
  }
</style>
