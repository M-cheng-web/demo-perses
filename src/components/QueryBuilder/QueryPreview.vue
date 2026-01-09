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
      <a-alert v-for="(error, index) in errors" :key="index" :message="error" type="error" show-icon closable style="margin-bottom: 8px" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Button } from '@/component-common';
  import { CopyOutlined } from '@ant-design/icons-vue';
  import { message } from '@/component-common';
  import { createNamespace } from '@/utils';

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
      color: #8c8c8c;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #e0e0e0;

      &:hover {
        color: #1890ff;
        background: #ffffff;
      }
    }

    &__code {
      margin: 0;
      padding: 6px 8px;
      padding-right: 60px;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 2px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
      font-size: 11px;
      line-height: 1.5;
      color: #000000d9;
      white-space: pre-wrap;
      word-break: break-all;
    }

    &__errors {
      padding: 8px;
      background: #fff;
    }
  }
</style>
