<template>
  <div :class="bem()">
    <div :class="bem('content')">
      <pre :class="bem('code')">{{ promql || '(无查询)' }}</pre>
      <Button type="text" size="small" :class="bem('copy-btn')" @click="copyToClipboard">
        <CopyOutlined />
        复制
      </Button>
    </div>
    <div v-if="errors && errors.length > 0" :class="bem('errors')">
      <Alert v-for="(error, index) in errors" :key="index" :message="error" type="error" show-icon closable style="margin-bottom: 8px" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Button } from '@grafana-fast/component';
  import { CopyOutlined } from '@ant-design/icons-vue';
  import { message } from '@grafana-fast/component';
  import { createNamespace } from '/#/utils';
  import { Alert } from '@grafana-fast/component';

  const [_, bem] = createNamespace('query-preview');

  interface Props {
    promql: string;
    errors?: string[];
  }

  const props = defineProps<Props>();

  const copyToClipboard = async () => {
    if (!props.promql) {
      message.warning('没有可复制的查询');
      return;
    }

    try {
      await navigator.clipboard.writeText(props.promql);
      message.success('已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
    }
  };
</script>

<style scoped lang="less">
  .dp-query-preview {
    &__content {
      position: relative;
      max-height: 150px;
      overflow: auto;
    }

    &__copy-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      padding: 0 4px;
      height: 20px;
      font-size: 12px;
      color: var(--gf-color-text-tertiary);
      background: var(--gf-color-surface-raised);
      border: 1px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-xs);

      &:hover {
        color: var(--gf-color-primary);
        background: var(--gf-color-surface);
        border-color: var(--gf-color-primary-border);
      }
    }

    &__code {
      margin: 0;
      padding: 6px 8px;
      padding-right: 60px;
      background: var(--gf-color-surface-muted);
      border: 1px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-xs);
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
      font-size: 11px;
      line-height: 1.5;
      color: var(--gf-color-text);
      white-space: pre-wrap;
      word-break: break-all;
    }

    &__errors {
      padding: 8px;
      background: var(--gf-color-surface);
    }
  }
</style>
