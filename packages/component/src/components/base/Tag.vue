<!-- 组件说明：用于展示状态/标记的小标签，可自定义颜色 -->
<template>
  <span :class="[bem(), bem({ [`size-${size}`]: true, [`variant-${variant}`]: true, [`radius-${radius}`]: true })]" :style="tagStyle">
    <slot></slot>
    <button v-if="closable" type="button" :class="bem('close')" aria-label="关闭" @click.stop="handleClose">
      <CloseOutlined />
    </button>
  </span>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { CloseOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfTag' });

  const props = withDefaults(
    defineProps<{
      /** 标签主色，影响背景/描边/文字 */
      color?: string;
      /** 是否可关闭 */
      closable?: boolean;
      /** 尺寸 */
      size?: 'small' | 'middle';
      /** 样式变体 */
      variant?: 'color' | 'neutral';
      /** 圆角风格 */
      radius?: 'pill' | 'sm';
    }>(),
    { color: 'var(--gf-color-primary)', closable: false, size: 'middle', variant: 'color', radius: 'pill' }
  );

  const emit = defineEmits<{
    (e: 'close', evt: MouseEvent): void;
  }>();

  const [_, bem] = createNamespace('tag');

  const tagStyle = computed(() => {
    if (props.variant === 'neutral') {
      return {
        '--gf-tag-text': 'var(--gf-color-text-secondary)',
        '--gf-tag-bg': 'var(--gf-color-fill)',
        '--gf-tag-border': 'var(--gf-color-border-muted)',
        '--gf-tag-close-bg': 'color-mix(in srgb, var(--gf-color-text-secondary) 12%, transparent)',
      };
    }
    return {
      '--gf-tag-color': props.color,
    };
  });

  const handleClose = (evt: MouseEvent) => {
    emit('close', evt);
  };
</script>

<style scoped lang="less">
  .gf-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    font-size: var(--gf-font-size-sm);
    line-height: 1.35;
    gap: 6px;
    border: 1px solid var(--gf-tag-border);
    background: var(--gf-tag-bg);
    color: var(--gf-tag-text);
    box-shadow: none;

    &--variant-color {
      --gf-tag-text: var(--gf-tag-color);
      --gf-tag-bg: color-mix(in srgb, var(--gf-tag-color) 14%, transparent);
      --gf-tag-border: color-mix(in srgb, var(--gf-tag-color) 42%, transparent);
      --gf-tag-close-bg: color-mix(in srgb, var(--gf-tag-color) 18%, transparent);
    }

    &--variant-neutral {
      /* vars are injected by inline style for consistent runtime behavior */
    }

    &--radius-pill {
      border-radius: 999px;
    }

    &--radius-sm {
      border-radius: var(--gf-radius-sm);
    }

    &__close {
      border: none;
      background: transparent;
      color: inherit;
      padding: 0;
      width: 16px;
      height: 16px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      cursor: pointer;
      opacity: 0.85;
      transition:
        background var(--gf-motion-fast) var(--gf-easing),
        opacity var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        opacity: 1;
        background: var(--gf-tag-close-bg);
      }
    }

    &--size-small {
      padding: 1px 8px;
      font-size: var(--gf-font-size-xs);
    }
  }
</style>
