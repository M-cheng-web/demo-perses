<!-- 组件说明：绝对时间范围选择器（轻量版），用于 Dashboard 工具栏 -->
<template>
  <div :class="bem()">
    <input
      :class="bem('input')"
      type="datetime-local"
      :value="fromModel"
      @change="(e: any) => setFrom(e.target?.value)"
      @blur="handleBlur"
    />
    <span :class="bem('sep')">—</span>
    <input
      :class="bem('input')"
      type="datetime-local"
      :value="toModel"
      @change="(e: any) => setTo(e.target?.value)"
      @blur="handleBlur"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, inject } from 'vue';
  import { createNamespace } from '../../utils';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfDateTimeRangePicker' });

  interface TimeRange {
    from: string | number;
    to: string | number;
  }

  const [_, bem] = createNamespace('datetime-range-picker');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);

  const props = withDefaults(
    defineProps<{
      value?: TimeRange;
    }>(),
    {
      value: () => ({ from: Date.now() - 60 * 60 * 1000, to: Date.now() }),
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: TimeRange): void;
    (e: 'change', value: TimeRange): void;
  }>();

  const toLocalInputValue = (v: string | number) => {
    const d = typeof v === 'number' ? new Date(v) : new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const fromModel = computed(() => toLocalInputValue(props.value?.from ?? Date.now() - 60 * 60 * 1000));
  const toModel = computed(() => toLocalInputValue(props.value?.to ?? Date.now()));

  const setFrom = (localValue: string) => {
    const ts = new Date(localValue).getTime();
    const next = { ...(props.value ?? { from: Date.now() - 60 * 60 * 1000, to: Date.now() }), from: Number.isNaN(ts) ? localValue : ts };
    emit('update:value', next);
    emit('change', next);
    formItem?.onFieldChange();
  };

  const setTo = (localValue: string) => {
    const ts = new Date(localValue).getTime();
    const next = { ...(props.value ?? { from: Date.now() - 60 * 60 * 1000, to: Date.now() }), to: Number.isNaN(ts) ? localValue : ts };
    emit('update:value', next);
    emit('change', next);
    formItem?.onFieldChange();
  };

  const handleBlur = () => {
    formItem?.onFieldBlur();
  };
</script>

<style scoped lang="less">
  .gf-datetime-range-picker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid var(--gf-control-border-color, var(--gf-color-border));
    border-radius: var(--gf-radius-sm);
    background: var(--gf-control-bg, var(--gf-color-surface));
    color: var(--gf-color-text);
    transition:
      border-color var(--gf-motion-normal) var(--gf-easing),
      box-shadow var(--gf-motion-normal) var(--gf-easing),
      background var(--gf-motion-normal) var(--gf-easing);

    &:hover {
      border-color: var(--gf-control-border-color-hover, var(--gf-color-border-strong));
      box-shadow: var(--gf-control-shadow-hover, 0 0 0 2px var(--gf-color-primary-soft));
      background: var(--gf-control-bg-hover, var(--gf-color-surface));
    }

    &:focus-within {
      border-color: var(--gf-control-border-color-focus, var(--gf-color-focus-border));
      box-shadow: var(--gf-control-shadow-focus, var(--gf-focus-ring));
      background: var(--gf-control-bg-focus, var(--gf-color-surface));
    }

    &__input {
      border: 0;
      outline: 0;
      background: transparent;
      color: inherit;
      font-size: 12px;
      font-family: inherit;
      min-width: 160px;
    }

    &__sep {
      color: var(--gf-color-text-tertiary);
      user-select: none;
    }
  }
</style>
