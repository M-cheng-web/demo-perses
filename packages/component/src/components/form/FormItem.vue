<!-- 组件说明：表单项，负责标签与控件区域的布局 -->
<template>
  <div :class="[bem(), { 'is-required': required, 'is-vertical': layout === 'vertical' }]" :style="inlineStyle">
    <label v-if="label" :class="bem('label')">
      {{ label }}
      <span v-if="required" :class="bem('asterisk')">*</span>
    </label>
    <div :class="bem('control')">
      <slot />
      <p v-if="help" :class="bem('help')">{{ help }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';
  import { inject, computed } from 'vue';

  defineOptions({ name: 'GfFormItem' });

  const props = withDefaults(
    defineProps<{
      /** 标签文本 */
      label?: string;
      /** 是否必填，展示星号 */
      required?: boolean;
      /** 辅助说明 */
      help?: string;
    }>(),
    {
      label: '',
      required: false,
      help: '',
    }
  );

  const [_, bem] = createNamespace('form-item');
  const layout = inject<'horizontal' | 'vertical'>('gf-form-layout', 'vertical');
  const labelSpan = inject<number>('gf-form-label-span', 24);
  const inlineStyle = computed(() => {
    if (layout === 'vertical') return {};
    const percent = Math.min(100, Math.max(0, (labelSpan / 24) * 100));
    return {
      gridTemplateColumns: `${percent}% 1fr`,
    };
  });
</script>

<style scoped lang="less">
  .gf-form-item {
    display: grid;
    grid-template-columns: 40% 1fr;
    gap: 10px;
    align-items: center;

    &__label {
      font-size: 13px;
      color: var(--gf-text-secondary);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    &__asterisk {
      color: #ff6b6b;
      font-weight: 600;
    }

    &__control {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    &__help {
      margin: 0;
      font-size: 12px;
      color: var(--gf-text-secondary);
    }
  }

  .gf-form-item.is-vertical {
    grid-template-columns: 1fr;

    .gf-form-item__label {
      margin-bottom: 4px;
    }
  }

  @media (max-width: 720px) {
    .gf-form-item {
      grid-template-columns: 1fr;
    }
  }
</style>
