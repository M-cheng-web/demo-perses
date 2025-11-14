<template>
  <div v-if="variables && variables.length > 0" class="variable-selector">
    <div v-for="variable in variables" :key="variable.id" class="variable-item">
      <label class="variable-label">{{ variable.label }}:</label>

      <!-- 自定义选择 / 查询选择 -->
      <a-select
        v-if="variable.type === 'custom' || variable.type === 'query'"
        v-model:value="variableValues[variable.name]"
        :mode="variable.multi ? 'multiple' : undefined"
        :style="{ minWidth: '150px' }"
        :placeholder="`选择 ${variable.label}`"
        @change="handleVariableChange(variable.name, $event)"
      >
        <a-select-option v-if="variable.includeAll" :value="variable.allValue || '*'"> 全部 </a-select-option>
        <a-select-option v-for="option in variable.options" :key="option.value" :value="option.value">
          {{ option.text }}
        </a-select-option>
      </a-select>

      <!-- 文本输入 -->
      <a-input
        v-else-if="variable.type === 'textbox'"
        v-model:value="variableValues[variable.name]"
        :style="{ width: '150px' }"
        :placeholder="`输入 ${variable.label}`"
        @change="handleVariableChange(variable.name, $event.target.value)"
      />

      <!-- 常量（只读） -->
      <span v-else-if="variable.type === 'constant'" class="variable-constant">
        {{ variable.current }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted } from 'vue';
  import type { DashboardVariable } from '@/types';

  const props = defineProps<{
    variables?: DashboardVariable[];
  }>();

  const emit = defineEmits<{
    (e: 'change', variables: Record<string, string | string[]>): void;
  }>();

  const variableValues = ref<Record<string, string | string[]>>({});

  // 初始化变量值
  const initializeValues = () => {
    if (!props.variables) return;

    const values: Record<string, string | string[]> = {};
    props.variables.forEach((variable) => {
      // 如果是多选模式，确保值是数组
      if (variable.multi) {
        values[variable.name] = Array.isArray(variable.current) ? variable.current : variable.current ? [variable.current as string] : [];
      } else {
        values[variable.name] = Array.isArray(variable.current) ? variable.current[0] || '' : variable.current || '';
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

  onMounted(() => {
    initializeValues();
  });
</script>

<style scoped lang="less">
  .variable-selector {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .variable-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .variable-label {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.65);
    white-space: nowrap;
  }

  .variable-constant {
    padding: 4px 11px;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.45);
    background: #fafafa;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
  }
</style>
