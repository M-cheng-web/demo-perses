<!-- 组件说明：表单项，负责标签与控件区域的布局 (AntD-inspired) -->
<template>
  <div
    :class="[
      bem(),
      {
        'is-required': computedRequired,
        'is-vertical': layout === 'vertical',
        'is-horizontal': layout === 'horizontal',
        'is-error': computedStatus === 'error',
        'is-warning': computedStatus === 'warning',
        'is-success': computedStatus === 'success',
        'has-feedback': hasFeedback,
      },
    ]"
    :style="inlineStyle"
  >
    <div v-if="label || $slots.label" :class="bem('label')" :style="labelStyle">
      <label :for="htmlFor">
        <slot name="label">
          {{ label }}
        </slot>
        <span v-if="computedRequired && !hideRequiredMark" :class="bem('required')">*</span>
      </label>
      <slot name="tooltip"></slot>
    </div>
    <div :class="bem('control')">
      <div :class="bem('control-input')">
        <div :class="bem('control-input-content')">
          <slot></slot>
        </div>
        <span v-if="hasFeedback && computedStatus" :class="bem('feedback-icon')">
          <CheckCircleFilled v-if="computedStatus === 'success'" />
          <CloseCircleFilled v-else-if="computedStatus === 'error'" />
          <ExclamationCircleFilled v-else-if="computedStatus === 'warning'" />
          <LoadingOutlined v-else-if="computedStatus === 'validating'" class="gf-spin" />
        </span>
      </div>
      <Transition name="gf-show-help">
        <div v-if="messageText" :class="bem('explain')">
          <span :class="bem('explain-text')">{{ messageText }}</span>
        </div>
      </Transition>
      <div v-if="extra" :class="bem('extra')">
        <slot name="extra">{{ extra }}</slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';
  import { inject, computed, onBeforeUnmount, onMounted, provide, ref } from 'vue';
  import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled, LoadingOutlined } from '@ant-design/icons-vue';
  import type { GfFormRule } from '../../types';
  import {
    gfFormContextKey,
    gfFormItemContextKey,
    gfFormLabelSpanKey,
    gfFormLayoutKey,
    gfFormValidateTriggerKey,
    type GfFormContext,
    type GfFormItemContext,
    type GfFormValidateTrigger,
  } from './context';

  defineOptions({ name: 'GfFormItem' });

  const props = withDefaults(
    defineProps<{
      /** 标签文本 */
      label?: string;
      /** 标签对应的 html for 属性 */
      htmlFor?: string;
      /** 是否必填，展示星号 */
      required?: boolean;
      /** 是否隐藏必填标记 */
      hideRequiredMark?: boolean;
      /**
       * 表单项状态（外部可控）
       */
      status?: '' | 'error' | 'warning' | 'success' | 'validating';
      /** 辅助说明 */
      help?: string;
      /** 额外提示信息 */
      extra?: string;
      /** 是否显示校验状态图标 */
      hasFeedback?: boolean;
      /** 字段名（用于从 Form model / rules 中读取） */
      prop?: string;
      /** 当前字段的校验规则（优先级高于 Form.rules[prop]） */
      rules?: GfFormRule | GfFormRule[];
      /**
       * 默认校验触发时机（当 rule.trigger 未指定时使用）
       */
      validateTrigger?: GfFormValidateTrigger | GfFormValidateTrigger[];
      /** 标签宽度 */
      labelWidth?: string | number;
      /** 标签对齐方式 */
      labelAlign?: 'left' | 'right';
    }>(),
    {
      label: '',
      htmlFor: undefined,
      required: false,
      hideRequiredMark: false,
      status: '',
      help: '',
      extra: '',
      hasFeedback: false,
      prop: undefined,
      rules: undefined,
      validateTrigger: undefined,
      labelWidth: undefined,
      labelAlign: undefined,
    }
  );

  const [_, bem] = createNamespace('form-item');
  const layout = inject<'horizontal' | 'vertical'>(gfFormLayoutKey, 'vertical');
  const labelSpan = inject<number>(gfFormLabelSpanKey, 24);
  const form = inject<GfFormContext | null>(gfFormContextKey, null);
  const formValidateTrigger = inject<GfFormValidateTrigger | GfFormValidateTrigger[]>(gfFormValidateTriggerKey, 'change');

  const validateMessage = ref('');

  const computedStatus = computed<'' | 'error' | 'warning' | 'success' | 'validating'>(() => {
    if (props.status) return props.status;
    if (validateMessage.value) return 'error';
    return '';
  });

  const messageText = computed(() => validateMessage.value || props.help || '');

  const normalizeTriggers = (t: GfFormValidateTrigger | GfFormValidateTrigger[] | undefined) => {
    if (!t) return [];
    return Array.isArray(t) ? t : [t];
  };

  const resolvedValidateTriggers = computed<GfFormValidateTrigger[]>(() => {
    const local = props.validateTrigger;
    const fromForm = formValidateTrigger;
    const picked = local === undefined ? fromForm : local;
    const normalized = normalizeTriggers(picked);
    return normalized.length ? normalized : ['change'];
  });

  const normalizeRules = (rules?: GfFormRule | GfFormRule[]) => {
    if (!rules) return [];
    return Array.isArray(rules) ? rules : [rules];
  };

  const getPropValue = (model: Record<string, any> | undefined, prop: string) => {
    if (!model) return undefined;
    const parts = prop.split('.');
    let cur: any = model;
    for (const key of parts) {
      if (cur == null) return undefined;
      cur = cur[key];
    }
    return cur;
  };

  const setPropValue = (model: Record<string, any> | undefined, prop: string, value: any) => {
    if (!model) return;
    const parts = prop.split('.');
    let cur: any = model;
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i]!;
      if (i === parts.length - 1) {
        cur[key] = value;
        return;
      }
      if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
      cur = cur[key];
    }
  };

  const mergedRules = computed<GfFormRule[]>(() => {
    const local = normalizeRules(props.rules);
    if (local.length) return local;
    const fromForm = props.prop ? form?.rules.value?.[props.prop] : undefined;
    return normalizeRules(fromForm as any);
  });

  const computedRequired = computed(() => {
    if (props.required) return true;
    return mergedRules.value.some((r) => !!r.required);
  });

  const initialValue = ref<any>(undefined);
  const takeInitialSnapshot = () => {
    if (!props.prop) return;
    initialValue.value = getPropValue(form?.model.value, props.prop);
  };

  const isEmptyValue = (val: any) => {
    if (val === undefined || val === null) return true;
    if (typeof val === 'string') return val.trim() === '';
    if (Array.isArray(val)) return val.length === 0;
    return false;
  };

  const ruleMatchesTrigger = (rule: GfFormRule, trigger: GfFormValidateTrigger) => {
    if (trigger === 'submit') return true;
    const triggers = rule.trigger ? normalizeTriggers(rule.trigger) : resolvedValidateTriggers.value;
    return triggers.includes(trigger);
  };

  const runRule = async (rule: GfFormRule, value: any) => {
    const message = rule.message ?? '校验未通过';

    if (rule.required) {
      if (isEmptyValue(value)) return message || '该字段为必填项';
    }

    if (!rule.required && isEmptyValue(value)) {
      const hasOtherConstraints = rule.min !== undefined || rule.max !== undefined || !!rule.pattern || !!rule.validator;
      if (!hasOtherConstraints) return '';
    }

    if (rule.min !== undefined || rule.max !== undefined) {
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) return message || `最小值为 ${rule.min}`;
        if (rule.max !== undefined && value > rule.max) return message || `最大值为 ${rule.max}`;
      } else if (typeof value === 'string' || Array.isArray(value)) {
        const len = value.length;
        if (rule.min !== undefined && len < rule.min) return message || `长度至少为 ${rule.min}`;
        if (rule.max !== undefined && len > rule.max) return message || `长度不能超过 ${rule.max}`;
      }
    }

    if (rule.pattern) {
      const str = String(value ?? '');
      if (!rule.pattern.test(str)) return message || '格式不正确';
    }

    if (rule.validator) {
      const out = await rule.validator(value, form?.model.value);
      if (typeof out === 'string') return out;
      if (out === false) return message || '校验未通过';
    }

    return '';
  };

  const validate = async (trigger: GfFormValidateTrigger = 'submit', options?: { force?: boolean }) => {
    validateMessage.value = '';
    if (!props.prop) return true;

    const allRules = mergedRules.value;
    const applicable = trigger === 'submit' || options?.force ? allRules : allRules.filter((r) => ruleMatchesTrigger(r, trigger));
    if (!applicable.length) return true;

    const value = getPropValue(form?.model.value, props.prop);
    for (const rule of applicable) {
      const msg = await runRule(rule, value);
      if (msg) {
        validateMessage.value = msg;
        return false;
      }
    }
    return true;
  };

  const clearValidate = () => {
    validateMessage.value = '';
  };

  const resetField = () => {
    if (!props.prop) return;
    setPropValue(form?.model.value, props.prop, initialValue.value);
    clearValidate();
  };

  const onFieldChange = () => {
    if (!props.prop) return;
    void validate('change', { force: !!validateMessage.value });
  };

  const onFieldBlur = () => {
    if (!props.prop) return;
    void validate('blur', { force: !!validateMessage.value });
  };

  provide<GfFormItemContext>(gfFormItemContextKey, {
    prop: props.prop,
    onFieldChange,
    onFieldBlur,
    clearValidate,
  });

  onMounted(() => {
    takeInitialSnapshot();
    if (props.prop) form?.addField({ prop: props.prop, validate, resetField, clearValidate });
  });

  onBeforeUnmount(() => {
    if (props.prop) form?.removeField(props.prop);
  });

  const labelStyle = computed(() => {
    const style: Record<string, string> = {};
    if (props.labelWidth) {
      style.width = typeof props.labelWidth === 'number' ? `${props.labelWidth}px` : props.labelWidth;
      style.flex = `0 0 ${style.width}`;
    }
    if (props.labelAlign) {
      style.textAlign = props.labelAlign;
    }
    return style;
  });

  const inlineStyle = computed(() => {
    if (layout === 'vertical') return {};
    const percent = Math.min(100, Math.max(0, (labelSpan / 24) * 100));
    return {
      gridTemplateColumns: props.labelWidth ? 'auto 1fr' : `${percent}% 1fr`,
    };
  });
</script>

<style scoped lang="less">
  .gf-form-item {
    /* Default control states */
    --gf-control-border-color: var(--gf-color-border);
    --gf-control-border-color-hover: var(--gf-color-primary);
    --gf-control-border-color-focus: var(--gf-color-primary);
    --gf-control-shadow-hover: none;
    --gf-control-shadow-focus: 0 0 0 2px var(--gf-color-primary-soft);
    --gf-control-bg: var(--gf-color-surface);
    --gf-control-bg-hover: var(--gf-color-surface);
    --gf-control-bg-focus: var(--gf-color-surface);

    display: flex;
    margin-bottom: 24px;

    &.is-horizontal {
      flex-direction: row;
    }

    &.is-vertical {
      flex-direction: column;
    }

    &__label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--gf-font-size-sm);
      color: var(--gf-text);
      line-height: 1.5714285714285714;
      text-align: right;
      white-space: nowrap;

      label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
    }

    &.is-horizontal &__label {
      height: var(--gf-control-height-md);
      padding-right: 12px;
    }

    &.is-vertical &__label {
      padding: 0 0 8px;
      text-align: left;
    }

    &__required {
      color: var(--gf-color-danger);
      font-family: inherit;
      line-height: 1;
    }

    &__control {
      flex: 1;
      min-width: 0;
      position: relative;
    }

    &__control-input {
      position: relative;
      display: flex;
      align-items: center;
      min-height: var(--gf-control-height-md);
    }

    &__control-input-content {
      flex: 1;
      min-width: 0;
      max-width: 100%;
    }

    &__feedback-icon {
      position: absolute;
      right: 0;
      top: 0;
      height: var(--gf-control-height-md);
      padding-right: 12px;
      display: flex;
      align-items: center;
      font-size: 14px;
      pointer-events: none;
      z-index: 1;
    }

    &.is-success &__feedback-icon {
      color: var(--gf-color-success);
    }

    &.is-error &__feedback-icon {
      color: var(--gf-color-danger);
    }

    &.is-warning &__feedback-icon {
      color: var(--gf-color-warning);
    }

    &.has-feedback &__control-input-content {
      padding-right: 24px;
    }

    &__explain {
      min-height: 22px;
      line-height: 22px;
      font-size: var(--gf-font-size-xs);
      color: var(--gf-color-text-secondary);
    }

    &.is-error &__explain {
      color: var(--gf-color-danger);
    }

    &.is-warning &__explain {
      color: var(--gf-color-warning);
    }

    &__explain-text {
      display: block;
    }

    &__extra {
      font-size: var(--gf-font-size-xs);
      color: var(--gf-color-text-tertiary);
      line-height: 1.5714285714285714;
      margin-top: 4px;
    }
  }

  // Error state
  .gf-form-item.is-error {
    --gf-control-border-color: var(--gf-color-danger);
    --gf-control-border-color-hover: var(--gf-color-danger);
    --gf-control-border-color-focus: var(--gf-color-danger);
    --gf-control-shadow-focus: 0 0 0 2px var(--gf-color-danger-soft);
  }

  // Warning state
  .gf-form-item.is-warning {
    --gf-control-border-color: var(--gf-color-warning);
    --gf-control-border-color-hover: var(--gf-color-warning);
    --gf-control-border-color-focus: var(--gf-color-warning);
    --gf-control-shadow-focus: 0 0 0 2px var(--gf-color-warning-soft);
  }

  // Animation
  .gf-show-help-enter-active,
  .gf-show-help-leave-active {
    transition:
      opacity var(--gf-motion-fast) var(--gf-easing),
      height var(--gf-motion-fast) var(--gf-easing),
      transform var(--gf-motion-fast) var(--gf-easing);
  }

  .gf-show-help-enter-from,
  .gf-show-help-leave-to {
    opacity: 0;
    transform: translateY(-5px);
  }

  // Spinning animation for loading icon
  .gf-spin {
    animation: gf-spin 1s linear infinite;
  }

  @keyframes gf-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
