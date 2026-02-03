<!-- 组件说明：分段控制器，用于少量选项的快速切换 (AntD-inspired) -->
<template>
  <div
    ref="rootRef"
    :class="[bem(), bem({ [`size-${size}`]: true }), { 'is-disabled': disabled, 'is-block': block }]"
    role="radiogroup"
    @keydown="handleKeydown"
  >
    <div v-if="thumbVisible" :class="bem('thumb')" :style="thumbStyle" aria-hidden="true"></div>
    <button
      v-for="(option, idx) in normalizedOptions"
      :key="option.key"
      :ref="(el) => setItemRef(el, idx)"
      :class="[bem('item'), { 'is-active': option.value === value, 'is-disabled': option.disabled }]"
      type="button"
      role="radio"
      :aria-checked="option.value === value"
      :disabled="disabled || option.disabled"
      @click="handleSelect(option.value)"
    >
      <span v-if="option.icon" :class="bem('item-icon')">
        <component :is="option.icon" />
      </span>
      <span :class="bem('item-label')">{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { createNamespace } from '../../utils';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfSegmented' });

  type SegmentedValue = string | number;
  type SegmentedOption =
    | SegmentedValue
    | {
        label: string;
        value: SegmentedValue;
        disabled?: boolean;
        icon?: any;
      };

  const props = withDefaults(
    defineProps<{
      /** 当前选中值 */
      value?: SegmentedValue;
      /** 选项列表 */
      options: ReadonlyArray<SegmentedOption>;
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
      /** 禁用状态 */
      disabled?: boolean;
      /** 是否撑满容器 */
      block?: boolean;
    }>(),
    {
      value: '',
      size: 'middle',
      disabled: false,
      block: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: SegmentedValue): void;
    (e: 'change', value: SegmentedValue): void;
  }>();

  const [_, bem] = createNamespace('segmented');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);

  const normalizedOptions = computed(() => {
    return (props.options ?? []).map((opt, idx) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { key: `${String(opt)}-${idx}`, label: String(opt), value: opt, disabled: false, icon: undefined };
      }
      return { key: `${String(opt.value)}-${idx}`, label: opt.label, value: opt.value, disabled: !!opt.disabled, icon: opt.icon };
    });
  });

  const handleSelect = (val: SegmentedValue) => {
    if (props.disabled) return;
    const target = normalizedOptions.value.find((o) => o.value === val);
    if (!target || target.disabled) return;
    emit('update:value', val);
    emit('change', val);
    formItem?.onFieldChange();
  };

  const rootRef = ref<HTMLElement | null>(null);
  const itemRefs = ref<Array<HTMLElement | null>>([]);

  const setItemRef = (el: unknown, idx: number) => {
    itemRefs.value[idx] = (el as HTMLElement | null) ?? null;
  };

  const thumbStyle = ref<Record<string, string>>({});
  const thumbVisible = ref(false);

  const updateThumb = async () => {
    await nextTick();
    const root = rootRef.value;
    if (!root) return;

    const activeIdx = normalizedOptions.value.findIndex((o) => o.value === props.value);
    const activeEl = activeIdx >= 0 ? itemRefs.value[activeIdx] : null;
    if (!activeEl) {
      thumbVisible.value = false;
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const rect = activeEl.getBoundingClientRect();
    const left = rect.left - rootRect.left;
    const width = rect.width;

    thumbVisible.value = true;
    thumbStyle.value = {
      transform: `translateX(${left}px)`,
      width: `${width}px`,
    };
  };

  const findNextEnabledIndex = (from: number, dir: -1 | 1) => {
    const opts = normalizedOptions.value;
    if (!opts.length) return -1;
    let idx = from;
    for (let i = 0; i < opts.length; i++) {
      idx = idx + dir;
      if (idx < 0) idx = opts.length - 1;
      if (idx >= opts.length) idx = 0;
      if (!opts[idx]?.disabled) return idx;
    }
    return -1;
  };

  const handleKeydown = (evt: KeyboardEvent) => {
    if (props.disabled) return;
    if (evt.key !== 'ArrowLeft' && evt.key !== 'ArrowRight' && evt.key !== 'Enter') return;

    const opts = normalizedOptions.value;
    const currentIdx = Math.max(
      0,
      opts.findIndex((o) => o.value === props.value)
    );

    if (evt.key === 'Enter') {
      const current = opts[currentIdx];
      if (current && !current.disabled) handleSelect(current.value);
      return;
    }

    evt.preventDefault();
    const dir: -1 | 1 = evt.key === 'ArrowLeft' ? -1 : 1;
    const nextIdx = findNextEnabledIndex(currentIdx, dir);
    if (nextIdx < 0) return;
    const next = opts[nextIdx];
    if (!next) return;
    handleSelect(next.value);
    itemRefs.value[nextIdx]?.focus?.();
  };

  onMounted(() => {
    updateThumb();
    window.addEventListener('resize', updateThumb);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateThumb);
  });

  watch([() => props.value, () => props.options, () => props.size], () => updateThumb(), { deep: true });
</script>

<style scoped lang="less">
  .gf-segmented {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: auto;
    padding: 2px;
    background: var(--gf-color-fill);
    border-radius: var(--gf-radius-sm);
    gap: 0;
    user-select: none;

    &__item {
      background: transparent;
      border: none;
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 0;
      padding: 4px 11px;
      height: 28px;
      border-radius: var(--gf-radius-xs);
      color: var(--gf-color-text);
      cursor: pointer;
      white-space: nowrap;
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      transition:
        color var(--gf-motion-fast) var(--gf-easing),
        background var(--gf-motion-fast) var(--gf-easing);

      &.is-active {
        color: var(--gf-color-text);
        font-weight: 500;
      }

      &:hover:not(.is-active):not(.is-disabled) {
        color: var(--gf-color-text);
      }

      &:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--gf-color-primary-soft);
      }

      &.is-disabled {
        color: var(--gf-color-text-tertiary);
        cursor: not-allowed;
      }
    }

    &__item-icon {
      display: inline-flex;
      align-items: center;
      font-size: 14px;
    }

    &__item-label {
      display: inline-block;
    }

    &__thumb {
      position: absolute;
      top: 2px;
      bottom: 2px;
      left: 0;
      border-radius: var(--gf-radius-xs);
      background: var(--gf-color-surface);
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02);
      transition:
        transform 200ms cubic-bezier(0.645, 0.045, 0.355, 1),
        width 200ms cubic-bezier(0.645, 0.045, 0.355, 1);
      will-change: transform, width;
    }

    &--size-small {
      padding: 2px;

      .gf-segmented__item {
        padding: 0 10px;
        height: 24px;
        font-size: var(--gf-font-size-xs);
      }

      .gf-segmented__thumb {
        top: 2px;
        bottom: 2px;
      }
    }

    &--size-large {
      padding: 2px;

      .gf-segmented__item {
        padding: 6px 14px;
        height: 36px;
        font-size: var(--gf-font-size-md);
      }

      .gf-segmented__thumb {
        top: 2px;
        bottom: 2px;
      }
    }

    &.is-block {
      width: 100%;
      display: flex;

      .gf-segmented__item {
        flex: 1;
        min-width: 0;
        justify-content: center;
      }
    }

    &.is-disabled {
      cursor: not-allowed;

      .gf-segmented__item {
        color: var(--gf-color-text-tertiary);
        cursor: not-allowed;
      }

      .gf-segmented__thumb {
        background: var(--gf-color-fill-secondary);
      }
    }
  }
</style>
