<!-- 组件说明：滑动输入条，支持最小/最大/步长控制、刻度、提示 (AntD-inspired) -->
<template>
  <div
    :class="[bem(), { 'is-disabled': disabled, 'is-dragging': isDragging }]"
    ref="sliderRef"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
  >
    <div :class="bem('rail')"></div>
    <div :class="bem('track')" :style="trackStyle"></div>
    <div
      ref="handleRef"
      :class="bem('handle')"
      :style="handleStyle"
      tabindex="0"
      role="slider"
      :aria-valuenow="innerValue"
      :aria-valuemin="min"
      :aria-valuemax="max"
      @keydown="handleKeyDown"
      @focus="handleFocus"
      @blur="handleBlur"
    >
      <div v-if="tooltip" :class="[bem('tooltip'), { 'is-visible': showTooltip }]">
        <span :class="bem('tooltip-content')">{{ tipFormatter ? tipFormatter(innerValue) : innerValue }}</span>
        <span :class="bem('tooltip-arrow')"></span>
      </div>
    </div>
    <div v-if="marks && Object.keys(marks).length > 0" :class="bem('marks')">
      <span
        v-for="(label, val) in marks"
        :key="val"
        :class="[bem('mark'), { 'is-active': Number(val) <= innerValue }]"
        :style="{ left: `${getMarkPercent(Number(val))}%` }"
      >
        {{ label }}
      </span>
    </div>
    <div v-if="showDots && step" :class="bem('dots')">
      <span
        v-for="dot in dotPositions"
        :key="dot"
        :class="[bem('dot'), { 'is-active': dot <= innerValue }]"
        :style="{ left: `${getMarkPercent(dot)}%` }"
      ></span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, ref, watch } from 'vue';
  import { subscribeWindowEvent, type Unsubscribe } from '@grafana-fast/utils';
  import { createNamespace } from '../../utils';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfSlider' });

  const props = withDefaults(
    defineProps<{
      /** 当前值 */
      value?: number;
      /** 最小值 */
      min?: number;
      /** 最大值 */
      max?: number;
      /** 步长 */
      step?: number;
      /** 禁用状态 */
      disabled?: boolean;
      /** 是否显示 tooltip */
      tooltip?: boolean;
      /** tooltip 格式化函数 */
      tipFormatter?: (value: number) => string | number;
      /** 刻度标记 */
      marks?: Record<number, string>;
      /** 是否显示刻度点 */
      showDots?: boolean;
    }>(),
    {
      value: 0,
      min: 0,
      max: 100,
      step: 1,
      disabled: false,
      tooltip: true,
      tipFormatter: undefined,
      marks: undefined,
      showDots: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: number): void;
    (e: 'change', value: number): void;
    (e: 'afterChange', value: number): void;
  }>();

  const [_, bem] = createNamespace('slider');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);

  const sliderRef = ref<HTMLElement>();
  const handleRef = ref<HTMLElement>();
  const innerValue = ref(props.value);
  const isDragging = ref(false);
  const showTooltip = ref(false);

  watch(
    () => props.value,
    (val) => {
      innerValue.value = val;
    }
  );

  const getPercent = (val: number) => {
    return ((val - props.min) / (props.max - props.min)) * 100;
  };

  const getMarkPercent = (val: number) => {
    return getPercent(val);
  };

  const trackStyle = computed(() => ({
    width: `${getPercent(innerValue.value)}%`,
  }));

  const handleStyle = computed(() => ({
    left: `${getPercent(innerValue.value)}%`,
  }));

  const dotPositions = computed(() => {
    if (!props.step || props.step <= 0) return [];
    const positions: number[] = [];
    for (let i = props.min; i <= props.max; i += props.step) {
      positions.push(i);
    }
    return positions;
  });

  const clampValue = (val: number) => {
    val = Math.max(props.min, Math.min(props.max, val));
    if (props.step && props.step > 0) {
      const steps = Math.round((val - props.min) / props.step);
      val = props.min + steps * props.step;
      val = Math.max(props.min, Math.min(props.max, val));
    }
    return val;
  };

  const updateValueFromPosition = (clientX: number) => {
    if (!sliderRef.value || props.disabled) return;

    const rect = sliderRef.value.getBoundingClientRect();
    const percent = (clientX - rect.left) / rect.width;
    const rawValue = props.min + percent * (props.max - props.min);
    const clampedValue = clampValue(rawValue);

    if (clampedValue !== innerValue.value) {
      innerValue.value = clampedValue;
      emit('update:value', clampedValue);
      emit('change', clampedValue);
      formItem?.onFieldChange();
    }
  };

  const handleMouseDown = (evt: MouseEvent) => {
    if (props.disabled) return;
    evt.preventDefault();
    isDragging.value = true;
    showTooltip.value = true;
    updateValueFromPosition(evt.clientX);

    let unsubscribeMove: Unsubscribe | null = null;
    let unsubscribeUp: Unsubscribe | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      updateValueFromPosition(e.clientX);
    };

    const handleMouseUp = () => {
      isDragging.value = false;
      showTooltip.value = false;
      emit('afterChange', innerValue.value);
      unsubscribeMove?.();
      unsubscribeUp?.();
      unsubscribeMove = null;
      unsubscribeUp = null;
    };

    unsubscribeMove = subscribeWindowEvent('mousemove', handleMouseMove);
    unsubscribeUp = subscribeWindowEvent('mouseup', handleMouseUp);
  };

  const handleTouchStart = (evt: TouchEvent) => {
    if (props.disabled) return;
    evt.preventDefault();
    isDragging.value = true;
    showTooltip.value = true;
    const touch = evt.touches[0];
    if (touch) updateValueFromPosition(touch.clientX);

    let unsubscribeMove: Unsubscribe | null = null;
    let unsubscribeEnd: Unsubscribe | null = null;

    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) updateValueFromPosition(t.clientX);
    };

    const handleTouchEnd = () => {
      isDragging.value = false;
      showTooltip.value = false;
      emit('afterChange', innerValue.value);
      unsubscribeMove?.();
      unsubscribeEnd?.();
      unsubscribeMove = null;
      unsubscribeEnd = null;
    };

    unsubscribeMove = subscribeWindowEvent('touchmove', handleTouchMove, { passive: false });
    unsubscribeEnd = subscribeWindowEvent('touchend', handleTouchEnd);
  };

  const handleKeyDown = (evt: KeyboardEvent) => {
    if (props.disabled) return;

    let newValue = innerValue.value;
    const step = props.step || 1;

    switch (evt.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        evt.preventDefault();
        newValue = clampValue(innerValue.value + step);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        evt.preventDefault();
        newValue = clampValue(innerValue.value - step);
        break;
      case 'Home':
        evt.preventDefault();
        newValue = props.min;
        break;
      case 'End':
        evt.preventDefault();
        newValue = props.max;
        break;
      default:
        return;
    }

    if (newValue !== innerValue.value) {
      innerValue.value = newValue;
      emit('update:value', newValue);
      emit('change', newValue);
      emit('afterChange', newValue);
      formItem?.onFieldChange();
    }
  };

  const handleFocus = () => {
    if (!isDragging.value) {
      showTooltip.value = true;
    }
  };

  const handleBlur = () => {
    if (!isDragging.value) {
      showTooltip.value = false;
    }
  };
</script>

<style scoped lang="less">
  .gf-slider {
    position: relative;
    width: 100%;
    height: 12px;
    padding: 4px 0;
    cursor: pointer;
    touch-action: none;

    &__rail {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      left: 0;
      right: 0;
      height: 4px;
      background: var(--gf-color-fill-tertiary);
      border-radius: 2px;
    }

    &__track {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      left: 0;
      height: 4px;
      background: var(--gf-color-primary);
      border-radius: 2px;
      transition: width 0s;
    }

    &__handle {
      position: absolute;
      top: 50%;
      width: 14px;
      height: 14px;
      margin-top: -7px;
      margin-left: -7px;
      background: #fff;
      border: 2px solid var(--gf-color-primary);
      border-radius: 50%;
      cursor: grab;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition:
        border-color var(--gf-motion-fast) var(--gf-easing),
        box-shadow var(--gf-motion-fast) var(--gf-easing),
        transform var(--gf-motion-fast) var(--gf-easing);
      outline: none;

      &:hover {
        border-color: var(--gf-color-primary-hover);
        transform: scale(1.1);
      }

      &:focus-visible {
        box-shadow:
          0 0 0 4px var(--gf-color-primary-soft),
          0 2px 4px rgba(0, 0, 0, 0.1);
      }
    }

    &.is-dragging &__handle {
      cursor: grabbing;
      border-color: var(--gf-color-primary-hover);
      box-shadow:
        0 0 0 4px var(--gf-color-primary-soft),
        0 2px 4px rgba(0, 0, 0, 0.1);
    }

    &__tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 8px;
      padding: 4px 8px;
      background: var(--gf-color-tooltip-bg);
      border-radius: var(--gf-radius-xs);
      font-size: var(--gf-font-size-xs);
      color: var(--gf-color-tooltip-text);
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition:
        opacity var(--gf-motion-fast) var(--gf-easing),
        visibility var(--gf-motion-fast) var(--gf-easing);

      &.is-visible {
        opacity: 1;
        visibility: visible;
      }
    }

    &__tooltip-content {
      display: block;
    }

    &__tooltip-arrow {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: var(--gf-color-tooltip-bg);
    }

    &__marks {
      position: absolute;
      top: 20px;
      left: 0;
      right: 0;
    }

    &__mark {
      position: absolute;
      transform: translateX(-50%);
      font-size: var(--gf-font-size-xs);
      color: var(--gf-color-text-tertiary);
      white-space: nowrap;

      &.is-active {
        color: var(--gf-color-text-secondary);
      }
    }

    &__dots {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      left: 0;
      right: 0;
    }

    &__dot {
      position: absolute;
      width: 8px;
      height: 8px;
      margin-left: -4px;
      background: #fff;
      border: 2px solid var(--gf-color-fill-tertiary);
      border-radius: 50%;
      transform: translateY(-50%);

      &.is-active {
        border-color: var(--gf-color-primary);
      }
    }

    &.is-disabled {
      cursor: not-allowed;

      .gf-slider__track {
        background: var(--gf-color-fill-tertiary);
      }

      .gf-slider__handle {
        border-color: var(--gf-color-fill-tertiary);
        cursor: not-allowed;
        box-shadow: none;

        &:hover {
          transform: none;
        }
      }
    }
  }
</style>
