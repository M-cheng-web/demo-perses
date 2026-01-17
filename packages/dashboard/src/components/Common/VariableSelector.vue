<!--
  文件说明：变量选择器（Dashboard 工具栏中的变量 UI）

  说明：
  - 这个组件只负责渲染与触发 change
  - 变量 options/当前值的归一化与 query-based options 解析由 variables store + @grafana-fast/api 实现层负责
-->
<template>
  <div v-if="variables && variables.length > 0" :class="bem()">
    <div v-for="variable in variables" :key="variable.id" :class="bem('item')">
      <label :class="bem('label')">{{ variable.label }}:</label>

      <!-- 选择 -->
      <Select
        v-if="variable.type === 'select' || variable.type === 'query'"
        v-model:value="variableValues[variable.name]"
        :mode="variable.multi ? 'multiple' : undefined"
        :style="{ minWidth: '200px' }"
        :placeholder="`请选择 ${variable.label}`"
        :options="formatOptions(variable)"
        :max-tag-count="2"
        @change="(value: any) => handleVariableChange(variable.name, value)"
      />

      <!-- 输入 -->
      <Input
        v-else-if="variable.type === 'input'"
        v-model:value="variableValues[variable.name]"
        :style="{ width: '150px' }"
        :placeholder="`请输入 ${variable.label}`"
        @change="(value: any) => handleVariableChange(variable.name, value)"
      />

      <!-- 常量 -->
      <span v-else-if="variable.type === 'constant'" :class="bem('constant')">
        {{ variable.current }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import type { DashboardVariable } from '@grafana-fast/types';
  import { Select, Input } from '@grafana-fast/component';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('variable-selector');

  const props = defineProps<{
    variables?: DashboardVariable[];
  }>();

  const emit = defineEmits<{
    (e: 'change', variables: Record<string, string | string[]>): void;
  }>();

  const variableValues = ref<Record<string, string | string[] | any>>({});

  // 将变量 options 规范化为 Select 组件支持的 { label, value }，并处理 includeAll
  const formatOptions = (variable: DashboardVariable) => {
    const options = (variable.options ?? []).map((opt: any) => ({
      label: opt.label ?? opt.text ?? opt.value ?? '',
      value: opt.value ?? opt.label ?? opt.text ?? '',
      disabled: opt.disabled ?? false,
    }));
    if (variable.includeAll) {
      return [{ label: 'All', value: 'all' }, ...options];
    }
    return options;
  };

  // 初始化变量值
  const initializeValues = () => {
    if (!props.variables) return;

    const values: Record<string, string | string[]> = {};
    props.variables.forEach((variable) => {
      // 如果是多选模式，确保值是数组
      if (variable.multi) {
        if (Array.isArray(variable.current)) values[variable.name] = variable.current;
        else if (typeof variable.current === 'string' && variable.current) values[variable.name] = [variable.current];
        else values[variable.name] = [];
      } else {
        values[variable.name] = variable.current || '';
      }
    });
    variableValues.value = values;
  };

  const handleVariableChange = (name: string, value: string | string[]) => {
    variableValues.value[name] = value;
    emit('change', { ...variableValues.value });
  };

  watch(
    () => props.variables,
    () => {
      initializeValues();
    },
    { immediate: true, deep: true }
  );
</script>

<style scoped lang="less">
  .dp-variable-selector {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;

    &__item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    &__label {
      font-size: 13px;
      color: var(--gf-color-text-secondary);
      white-space: nowrap;
    }

    &__constant {
      padding: 4px 11px;
      font-size: 13px;
      color: var(--gf-color-text-tertiary);
      background: var(--gf-color-surface-muted);
      border: 1px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-sm);
    }
  }
</style>
