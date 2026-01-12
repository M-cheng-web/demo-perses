<!-- 组件说明：结果状态展示，支持 success/error/warning/info/404 -->
<template>
  <div :class="[bem(), bem(`status-${status}`)]">
    <div :class="bem('icon')">{{ iconText }}</div>
    <div :class="bem('title')">{{ title }}</div>
    <div v-if="subTitle" :class="bem('subtitle')">{{ subTitle }}</div>
    <div v-if="$slots.extra" :class="bem('extra')">
      <slot name="extra"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfResult' });

  const props = withDefaults(
    defineProps<{
      /** 结果状态类型 */
      status?: 'success' | 'error' | 'warning' | 'info' | '404';
      /** 主标题 */
      title?: string;
      /** 副标题 */
      subTitle?: string;
    }>(),
    {
      status: 'info',
      title: '提示',
      subTitle: '',
    }
  );

  const [_, bem] = createNamespace('result');

  const iconText = computed(() => {
    switch (props.status) {
      case 'success':
        return '✔';
      case 'error':
        return '✖';
      case 'warning':
        return '!';
      case '404':
        return '404';
      default:
        return 'ℹ';
    }
  });
</script>

<style scoped lang="less">
  .gf-result {
    padding: var(--gf-space-4);
    background: var(--gf-color-surface);
    border: 1px dashed var(--gf-border);
    border-radius: var(--gf-radius-md);
    text-align: center;
    color: var(--gf-text);
    box-shadow: none;

    &__icon {
      font-size: 20px;
      margin-bottom: 8px;
    }

    &__title {
      font-weight: 600;
      font-size: 15px;
      margin-bottom: 4px;
    }

    &__subtitle {
      color: var(--gf-text-secondary);
      font-size: 13px;
    }

    &__extra {
      margin-top: 12px;
    }
  }
</style>
