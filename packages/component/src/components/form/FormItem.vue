<!-- 组件说明：表单项，负责标签与控件区域的布局 -->
<template>
  <div :class="[bem(), { 'is-required': computedRequired, 'is-vertical': layout === 'vertical', 'is-error': hasError }]" :style="inlineStyle">
    <label v-if="label" :class="bem('label')">
      {{ label }}
      <span v-if="computedRequired" :class="bem('asterisk')">*</span>
    </label>
    <div :class="bem('control')">
      <slot></slot>
      <p v-if="hasError" :class="bem('error')">{{ validateMessage }}</p>
      <p v-if="help" :class="bem('help')">{{ help }}</p>
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
      /** 辅助说明 */
      help?: string;
      /** 字段名（用于从 Form model / rules 中读取） */
      prop?: string;
      /** 当前字段的校验规则（优先级高于 Form.rules[prop]） */
      rules?: GfFormRule | GfFormRule[];
    }>(),
    {
      label: '',
      required: false,
      help: '',
      prop: undefined,
      rules: undefined,
    }
  );

  const [_, bem] = createNamespace('form-item');
  const layout = inject<'horizontal' | 'vertical'>(gfFormLayoutKey, 'vertical');
  const labelSpan = inject<number>(gfFormLabelSpanKey, 24);
  const form = inject<GfFormContext | null>(gfFormContextKey, null);

  const validateMessage = ref('');
  const hasError = computed(() => !!validateMessage.value);

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
    if (!rule.trigger) return trigger === 'change';
    if (Array.isArray(rule.trigger)) return rule.trigger.includes(trigger);
    return rule.trigger === trigger;
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

  const validate = async (trigger: GfFormValidateTrigger = 'submit') => {
    validateMessage.value = '';
    if (!props.prop) return true;

    const allRules = mergedRules.value;
    const applicable = trigger === 'submit' ? allRules : allRules.filter((r) => ruleMatchesTrigger(r, trigger));
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
    if (hasError.value) void validate('change');
    else clearValidate();
  };

  const onFieldBlur = () => {
    if (hasError.value) void validate('blur');
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

    &__error {
      margin: 0;
      font-size: 12px;
      color: #ff4d4f;
      line-height: 1.35;
    }
  }

  .gf-form-item.is-vertical {
    grid-template-columns: 1fr;

    .gf-form-item__label {
      margin-bottom: 4px;
    }
  }

  .gf-form-item.is-error {
    :deep(.gf-control) {
      border-color: #ff4d4f;
      box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.2);
    }

    :deep(.gf-input-number),
    :deep(.gf-input-number:hover),
    :deep(.gf-input-number:focus-within) {
      border-color: #ff4d4f;
      box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.2);
    }
  }

  @media (max-width: 720px) {
    .gf-form-item {
      grid-template-columns: 1fr;
    }
  }
</style>
