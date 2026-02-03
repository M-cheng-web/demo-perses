<!--
  文件说明：UnsupportedPanel（不支持的面板类型占位面板）

  目标：
  - 当 dashboard JSON 中出现不支持的 panel.type 时，不丢信息
  - 用占位 UI 展示类型与原始 options JSON（可复制），避免渲染阶段崩溃
-->
<template>
  <div :class="bem()">
    <div :class="bem('header')">
      <Alert
        type="warning"
        show-icon
        :message="`不支持的面板类型：${panelType}`"
        description="当前环境不支持该面板类型。面板配置已保留，请检查数据来源或切换为受支持的类型。"
      />
    </div>

    <div :class="bem('body')">
      <div :class="bem('row')">
        <div :class="bem('label')">面板类型</div>
        <div :class="bem('value')">
          <code>{{ panelType }}</code>
        </div>
      </div>

      <div :class="bem('row')">
        <div :class="bem('label')">原始配置</div>
        <div :class="bem('value')">
          <pre :class="bem('code')">{{ optionsJson }}</pre>
          <Button size="small" type="ghost" :class="bem('copy')" @click="copyOptions">复制配置（options）JSON</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Alert, Button, message } from '@grafana-fast/component';
  import type { Panel } from '@grafana-fast/types';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('unsupported-panel');

  const props = defineProps<{
    panel: Panel;
  }>();

  const panelType = computed(() => props.panel.type || '(未知)');
  const optionsJson = computed(() => {
    try {
      return JSON.stringify(props.panel.options ?? {}, null, 2);
    } catch {
      return String(props.panel.options ?? '');
    }
  });

  const copyOptions = async () => {
    try {
      await navigator.clipboard.writeText(optionsJson.value);
      message.success('已复制');
    } catch {
      message.error('复制失败');
    }
  };
</script>

<style scoped lang="less">
  .dp-unsupported-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;

    &__body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    &__row {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }

    &__label {
      font-size: 13px;
      line-height: 1.5714285714285714;
      color: var(--gf-color-text-secondary);
      padding-top: 2px;
    }

    &__value {
      min-width: 0;
    }

    &__code {
      margin: 0;
      padding: 10px 12px;
      border: 1px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-sm);
      background: var(--gf-color-surface-muted);
      color: var(--gf-color-text);
      font-size: 12px;
      line-height: 1.5714285714285714;
      max-height: 220px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;

      /* Scrollbar styling */
      &::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
        border-radius: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: var(--gf-color-fill-secondary);
        border-radius: 3px;

        &:hover {
          background: var(--gf-color-fill);
        }
      }
    }

    &__copy {
      margin-top: 8px;
    }
  }
</style>
