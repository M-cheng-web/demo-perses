<!-- 组件说明：用于展示状态/标记的小标签，可自定义颜色 (AntD-inspired) -->
<template>
  <span :class="[bem(), bem({ [`size-${resolvedSize}`]: true, bordered: bordered }), `gf-tag--${actualColor}`]" :style="customColorStyle">
    <span v-if="$slots.icon || icon" :class="bem('icon')">
      <slot name="icon">
        <component :is="icon" v-if="icon" />
      </slot>
    </span>
    <span :class="bem('content')">
      <slot></slot>
    </span>
    <button v-if="closable" type="button" :class="bem('close')" aria-label="关闭" @click.stop="handleClose">
      <CloseOutlined />
    </button>
  </span>
</template>

<script setup lang="ts">
  import { computed, type Component } from 'vue';
  import { CloseOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';
  import { useComponentSize } from '../../context/size';

  defineOptions({ name: 'GfTag' });

  type PresetColor =
    | 'default'
    | 'success'
    | 'processing'
    | 'error'
    | 'warning'
    | 'magenta'
    | 'red'
    | 'volcano'
    | 'orange'
    | 'gold'
    | 'lime'
    | 'green'
    | 'cyan'
    | 'blue'
    | 'geekblue'
    | 'purple';

  const presetColors: PresetColor[] = [
    'default',
    'success',
    'processing',
    'error',
    'warning',
    'magenta',
    'red',
    'volcano',
    'orange',
    'gold',
    'lime',
    'green',
    'cyan',
    'blue',
    'geekblue',
    'purple',
  ];

  const props = withDefaults(
    defineProps<{
      /** 标签颜色：支持预设颜色或自定义颜色值 */
      color?: PresetColor | string;
      /** 是否可关闭 */
      closable?: boolean;
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
      /** 是否有边框 */
      bordered?: boolean;
      /** 图标组件 */
      icon?: Component;
    }>(),
    {
      color: 'default',
      closable: false,
      size: undefined,
      bordered: true,
      icon: undefined,
    }
  );

  const emit = defineEmits<{
    (e: 'close', evt: MouseEvent): void;
  }>();

  const [_, bem] = createNamespace('tag');
  const resolvedSize = useComponentSize(computed(() => props.size));

  const isPresetColor = computed(() => presetColors.includes(props.color as PresetColor));

  const actualColor = computed(() => {
    if (isPresetColor.value) return props.color;
    return 'custom';
  });

  const customColorStyle = computed(() => {
    if (isPresetColor.value) return undefined;
    return {
      '--gf-tag-custom-color': props.color,
      '--gf-tag-custom-bg': `color-mix(in srgb, ${props.color} 15%, transparent)`,
      '--gf-tag-custom-border': `color-mix(in srgb, ${props.color} 40%, transparent)`,
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
    height: 22px;
    padding: 0 7px;
    font-size: var(--gf-font-size-sm);
    line-height: 20px;
    gap: 4px;
    border-radius: var(--gf-radius-xs);
    white-space: nowrap;
    box-sizing: border-box;
    transition: all var(--gf-motion-fast) var(--gf-easing);

    // Default style
    &--default {
      background: var(--gf-color-fill);
      color: var(--gf-color-text);
      border: 1px solid var(--gf-color-border);
    }

    // Preset colors
    &--success {
      color: var(--gf-color-success);
      background: var(--gf-color-success-soft);
      border: 1px solid var(--gf-color-success-border);
    }

    &--processing,
    &--blue {
      color: var(--gf-color-primary);
      background: var(--gf-color-primary-soft);
      border: 1px solid var(--gf-color-primary-border);
    }

    &--error,
    &--red {
      color: var(--gf-color-danger);
      background: var(--gf-color-danger-soft);
      border: 1px solid var(--gf-color-danger-border);
    }

    &--warning,
    &--orange,
    &--gold {
      color: var(--gf-color-warning);
      background: var(--gf-color-warning-soft);
      border: 1px solid var(--gf-color-warning-border);
    }

    &--magenta {
      color: #c41d7f;
      background: #fff0f6;
      border: 1px solid #ffadd2;
    }

    &--volcano {
      color: #d4380d;
      background: #fff2e8;
      border: 1px solid #ffbb96;
    }

    &--lime {
      color: #7cb305;
      background: #fcffe6;
      border: 1px solid #eaff8f;
    }

    &--green {
      color: var(--gf-color-success);
      background: var(--gf-color-success-soft);
      border: 1px solid var(--gf-color-success-border);
    }

    &--cyan {
      color: #08979c;
      background: #e6fffb;
      border: 1px solid #87e8de;
    }

    &--geekblue {
      color: #1d39c4;
      background: #f0f5ff;
      border: 1px solid #adc6ff;
    }

    &--purple {
      color: #531dab;
      background: #f9f0ff;
      border: 1px solid #d3adf7;
    }

    // Custom color
    &--custom {
      color: var(--gf-tag-custom-color);
      background: var(--gf-tag-custom-bg);
      border: 1px solid var(--gf-tag-custom-border);
    }

    // No border variant
    &:not(&--bordered) {
      border-color: transparent;
    }

    &__icon {
      display: inline-flex;
      align-items: center;
      font-size: 12px;
    }

    &__content {
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &__close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: inherit;
      padding: 0;
      margin-left: 3px;
      margin-right: -3px;
      width: 14px;
      height: 14px;
      font-size: 10px;
      border-radius: 50%;
      cursor: pointer;
      opacity: 0.6;
      transition:
        background var(--gf-motion-fast) var(--gf-easing),
        opacity var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.06);
      }
    }

    // Size variants
    &--size-small {
      height: 18px;
      padding: 0 5px;
      font-size: var(--gf-font-size-xs);
      line-height: 16px;
      gap: 3px;

      .gf-tag__icon {
        font-size: 10px;
      }

      .gf-tag__close {
        width: 12px;
        height: 12px;
        font-size: 8px;
        margin-left: 2px;
        margin-right: -2px;
      }
    }

    &--size-large {
      height: 28px;
      padding: 0 10px;
      font-size: var(--gf-font-size-md);
      line-height: 26px;
      gap: 6px;

      .gf-tag__icon {
        font-size: 14px;
      }

      .gf-tag__close {
        width: 16px;
        height: 16px;
        font-size: 12px;
        margin-left: 4px;
        margin-right: -4px;
      }
    }
  }
</style>
