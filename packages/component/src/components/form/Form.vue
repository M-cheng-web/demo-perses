<!-- 组件说明：表单容器，提供布局上下文（横向/纵向） -->
<template>
  <form :class="[bem(), bem({ [`layout-${layout}`]: true })]">
    <slot></slot>
  </form>
</template>

<script setup lang="ts">
  import { provide, ref, toRef } from 'vue';
  import { createNamespace } from '../../utils';
  import {
    gfFormContextKey,
    gfFormLabelSpanKey,
    gfFormLayoutKey,
    gfFormValidateTriggerKey,
    type GfFormContext,
    type GfFormItemInstance,
    type GfFormValidateTrigger,
  } from './context';
  import type { GfFormRules } from '../../types';

  defineOptions({ name: 'GfForm' });

  const props = withDefaults(
    defineProps<{
      /** 表单数据模型（仅透传上下文） */
      model?: Record<string, any>;
      /** 表单校验规则（key 为字段 prop） */
      rules?: GfFormRules;
      /** 布局方向 */
      layout?: 'horizontal' | 'vertical';
      /**
       * 默认校验触发时机（当 rule.trigger 未指定时使用）
       *
       * 与 AntD 对齐的建议值：
       * - Input/Textarea：change
       * - Select/Cascader：change
       * - 需要“失焦才校验”的场景：blur
       */
      validateTrigger?: GfFormValidateTrigger | GfFormValidateTrigger[];
      /** 标签列占比（仅横向） */
      labelCol?: { span: number };
    }>(),
    {
      model: undefined,
      rules: undefined,
      layout: 'vertical',
      validateTrigger: () => ['change'],
      labelCol: () => ({ span: 24 }),
    }
  );

  const [_, bem] = createNamespace('form');

  const modelRef = toRef(props, 'model');
  const rulesRef = toRef(props, 'rules');
  const fields = ref<GfFormItemInstance[]>([]);

  const addField: GfFormContext['addField'] = (field) => {
    if (!field?.prop) return;
    const idx = fields.value.findIndex((f) => f.prop === field.prop);
    if (idx > -1) fields.value[idx] = field;
    else fields.value.push(field);
  };

  const removeField: GfFormContext['removeField'] = (prop) => {
    fields.value = fields.value.filter((f) => f.prop !== prop);
  };

  const validate = async () => {
    const results = await Promise.all(fields.value.map((f) => f.validate('submit')));
    return results.every(Boolean);
  };

  const validateField = async (propsOrProps: string | string[]) => {
    const targets = Array.isArray(propsOrProps) ? propsOrProps : [propsOrProps];
    const picked = fields.value.filter((f) => targets.includes(f.prop));
    const results = await Promise.all(picked.map((f) => f.validate('submit')));
    return results.every(Boolean);
  };

  const resetFields = () => {
    fields.value.forEach((f) => f.resetField());
  };

  const clearValidate = (propsOrProps?: string | string[]) => {
    if (!propsOrProps) {
      fields.value.forEach((f) => f.clearValidate());
      return;
    }
    const targets = Array.isArray(propsOrProps) ? propsOrProps : [propsOrProps];
    fields.value.forEach((f) => {
      if (targets.includes(f.prop)) f.clearValidate();
    });
  };

  defineExpose({ validate, validateField, resetFields, clearValidate });

  provide(gfFormLayoutKey, props.layout);
  provide(gfFormLabelSpanKey, props.labelCol?.span ?? 24);
  provide(gfFormValidateTriggerKey, props.validateTrigger);
  provide(gfFormContextKey, { model: modelRef, rules: rulesRef, addField, removeField });
</script>

<style scoped lang="less">
  .gf-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gf-form--layout-horizontal {
    gap: 10px;
  }
</style>
