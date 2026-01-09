<template>
  <div v-if="variables && variables.length > 0" :class="bem()">
    <div v-for="variable in variables" :key="variable.id" :class="bem('item')">
      <label :class="bem('label')">{{ variable.label }}:</label>

      <!-- 选择 -->
      <Select
        v-if="variable.type === 'select'"
        v-model:value="variableValues[variable.name]"
        :mode="variable.multi ? 'multiple' : undefined"
        :style="{ minWidth: '150px' }"
        :placeholder="`请选择 ${variable.label}`"
        :options="variable.options"
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
  import type { DashboardVariable } from '#/types';
  import { Select, Input } from 'ant-design-vue';
  import { createNamespace } from '#/utils';

  const [_, bem] = createNamespace('variable-selector');

  const props = defineProps<{
    variables?: DashboardVariable[];
  }>();

  const emit = defineEmits<{
    (e: 'change', variables: Record<string, string | string[]>): void;
  }>();

  const variableValues = ref<Record<string, string | string[] | any>>({});

  // 初始化变量值
  const initializeValues = () => {
    if (!props.variables) return;

    const values: Record<string, string | string[]> = {};
    props.variables.forEach((variable) => {
      // 如果是多选模式，确保值是数组
      if (variable.multi) {
        values[variable.name] = variable.current || [];
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
      color: rgba(0, 0, 0, 0.65);
      white-space: nowrap;
    }

    &__constant {
      padding: 4px 11px;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.45);
      background: #fafafa;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
    }
  }
</style>
