<!--
  文件说明：JSON 编辑器（Dashboard 内部使用）

  设计目标：
  - 用轻量的 CodeEditor 替代 monaco 的重型依赖（提升启动/打包体验）
  - 提供 v-model 双向绑定 + 基础校验/复制能力
-->
<template>
  <div :class="bem()">
    <CodeEditor
      v-model="valueString"
      :language="language === 'json' ? 'json' : 'text'"
      :read-only="readOnly"
      :height="height"
      :show-toolbar="showToolbar"
      :show-copy="showCopy"
      @validate="(ok: boolean) => emit('validate', ok)"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { CodeEditor } from '@grafana-fast/component';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('json-editor');

  interface Props {
    modelValue?: string | object;
    height?: string | number;
    language?: string;
    readOnly?: boolean;
    showToolbar?: boolean;
    showCopy?: boolean;
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

  const valueString = computed({
    get: () => {
      if (typeof props.modelValue === 'string') return props.modelValue;
      if (typeof props.modelValue === 'object' && props.modelValue !== null) {
        try {
          return JSON.stringify(props.modelValue, null, 2);
        } catch {
          return String(props.modelValue);
        }
      }
      return '';
    },
    set: (value: string) => {
      emit('update:modelValue', value);
      emit('change', value);
    },
  });
</script>

<style scoped lang="less">
  .dp-json-editor {
    width: 100%;
  }
</style>
