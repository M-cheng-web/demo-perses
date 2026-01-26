<!--
  文件说明：UnsupportedPanel（缺失插件占位面板）

  目标：
  - 当 dashboard JSON 中出现未注册的 panel.type 时，不丢信息
  - 用占位 UI 提示“缺少插件：xxx”，并展示原始 options JSON（可复制）
  - 保留在 dashboard 结构中，未来注册对应插件后可恢复
-->
<template>
  <div :class="bem()">
    <div :class="bem('header')">
      <Alert
        type="warning"
        show-icon
        :message="`缺少插件：${missingType}`"
        description="当前环境未注册该面板类型。面板数据已保留，待安装/注册对应插件后可恢复。"
      />
    </div>

    <div :class="bem('body')">
      <div :class="bem('row')">
        <div :class="bem('label')">面板类型</div>
        <div :class="bem('value')">
          <code>{{ missingType }}</code>
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

  const missingType = computed(() => props.panel.type || '(未知)');
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
    gap: 10px;
    padding: 12px;

    &__body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    &__row {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
    }

    &__label {
      font-size: 12px;
      color: var(--gf-color-text-secondary);
      padding-top: 2px;
    }

    &__value {
      min-width: 0;
    }

    &__code {
      margin: 0;
      padding: 8px;
      border: 1px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-sm);
      background: var(--gf-color-surface-muted);
      color: var(--gf-color-text);
      font-size: 11px;
      line-height: 1.5;
      max-height: 220px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    &__copy {
      margin-top: 8px;
    }
  }
</style>
