<!-- 组件说明：表单项，负责标签与控件区域的布局 -->
<template>
  <div
    :class="[
      bem(),
      {
        'is-required': computedRequired,
        'is-vertical': layout === 'vertical',
        'is-error': computedStatus === 'error',
        'is-warning': computedStatus === 'warning',
        'is-success': computedStatus === 'success',
      },
    ]"
    :style="inlineStyle"
  >
    <label v-if="label" :class="bem('label')">
      {{ label }}
      <span v-if="computedRequired" :class="bem('asterisk')">*</span>
    </label>
    <div :class="bem('control')">
      <slot></slot>
      <p v-if="messageText" :class="[bem('message'), messageStatus ? bem('message', messageStatus) : undefined]">{{ messageText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';
  import { inject, computed, onBeforeUnmount, onMounted, provide, ref } from 'vue';
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
      /** 是否必填，展示星号 */
      required?: boolean;
      /**
       * 表单项状态（外部可控）
       * - 不传：由内部校验结果决定（error/空）
       * - warning：用于“提示但不阻塞”的校验/业务规则
       */
      status?: '' | 'error' | 'warning' | 'success';
      /** 辅助说明 */
      help?: string;
      /** 字段名（用于从 Form model / rules 中读取） */
      prop?: string;
      /** 当前字段的校验规则（优先级高于 Form.rules[prop]） */
      rules?: GfFormRule | GfFormRule[];
      /**
       * 默认校验触发时机（当 rule.trigger 未指定时使用）
       * 不传时继承 Form.validateTrigger（默认 change）
       */
      validateTrigger?: GfFormValidateTrigger | GfFormValidateTrigger[];
    }>(),
    {
      label: '',
      required: false,
      status: '',
      help: '',
      prop: undefined,
      rules: undefined,
      validateTrigger: undefined,
    }
  );

  const [_, bem] = createNamespace('form-item');
  const layout = inject<'horizontal' | 'vertical'>(gfFormLayoutKey, 'vertical');
  const labelSpan = inject<number>(gfFormLabelSpanKey, 24);
  const form = inject<GfFormContext | null>(gfFormContextKey, null);
  const formValidateTrigger = inject<GfFormValidateTrigger | GfFormValidateTrigger[]>(gfFormValidateTriggerKey, 'change');

  const validateMessage = ref('');

  const computedStatus = computed<'' | 'error' | 'warning' | 'success'>(() => {
    if (props.status) return props.status;
    if (validateMessage.value) return 'error';
    return '';
  });

  const messageText = computed(() => validateMessage.value || props.help || '');
  const messageStatus = computed(() => {
    if (validateMessage.value) return 'error';
    if (props.status === 'warning') return 'warning';
    if (props.status === 'success') return 'success';
    if (props.status === 'error') return 'error';
    return '';
  });

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
    /* Default control states (used by `.gf-control` and other controls that opt-in) */
    --gf-control-border-color: var(--gf-color-border);
    --gf-control-border-color-hover: var(--gf-color-border-strong);
    --gf-control-border-color-focus: var(--gf-color-focus-border);
    --gf-control-shadow-hover: 0 0 0 2px var(--gf-color-primary-soft);
    --gf-control-shadow-focus: var(--gf-focus-ring);
    --gf-control-bg: var(--gf-color-surface);
    --gf-control-bg-hover: var(--gf-color-surface);
    --gf-control-bg-focus: var(--gf-color-surface);

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
      color: var(--gf-color-form-error);
      font-weight: 600;
    }

    &__control {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    &__message {
      margin: 0;
      font-size: 12px;
      line-height: 1.35;
      color: var(--gf-text-secondary);
    }

    &__message--error {
      color: var(--gf-color-form-error);
    }

    &__message--warning {
      color: var(--gf-color-form-warning);
    }

    &__message--success {
      color: var(--gf-color-success);
    }
  }

  .gf-form-item.is-vertical {
    grid-template-columns: 1fr;

    .gf-form-item__label {
      margin-bottom: 4px;
    }
  }

  .gf-form-item.is-error {
    --gf-control-border-color: var(--gf-color-form-error-border);
    --gf-control-border-color-hover: var(--gf-color-form-error);
    --gf-control-border-color-focus: var(--gf-color-form-error);
    --gf-control-shadow-hover: var(--gf-form-error-ring);
    --gf-control-shadow-focus: var(--gf-form-error-ring);
    --gf-control-bg: var(--gf-color-form-error-bg);
    --gf-control-bg-hover: var(--gf-color-form-error-bg);
    --gf-control-bg-focus: var(--gf-color-form-error-bg);
  }

  .gf-form-item.is-warning {
    --gf-control-border-color: var(--gf-color-form-warning-border);
    --gf-control-border-color-hover: var(--gf-color-form-warning);
    --gf-control-border-color-focus: var(--gf-color-form-warning);
    --gf-control-shadow-hover: var(--gf-form-warning-ring);
    --gf-control-shadow-focus: var(--gf-form-warning-ring);
    --gf-control-bg: var(--gf-color-form-warning-bg);
    --gf-control-bg-hover: var(--gf-color-form-warning-bg);
    --gf-control-bg-focus: var(--gf-color-form-warning-bg);
  }

  @media (max-width: 720px) {
    .gf-form-item {
      grid-template-columns: 1fr;
    }
  }
</style>
