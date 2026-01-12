<!--
  @fileoverview 操作列表组件
  @description
    管理和显示 PromQL 操作（聚合、函数、范围函数等）。
    主要功能：
    - 分类展示各类 PromQL 操作（Aggregations、Range Functions、Functions 等）
    - 支持拖拽排序操作
    - 动态添加/删除/修改操作
    - 参数编辑（字符串、数字、布尔、标签）
    - 支持可选参数和 Rest 参数（multiple labels）
    - 动态操作切换（如 sum → sum by → sum without）
  @reference Grafana 源码
    grafana/public/app/plugins/datasource/prometheus-querybuilder/components/PromQueryBuilderOperations.tsx
  @props
    modelValue: QueryBuilderOperation[], currentQuery: PromVisualQuery
  @emits
    update:modelValue, queryUpdate
-->
<template>
  <div :class="bem()">
    <div :class="bem('row')">
      <!-- 操作卡片列表（支持拖拽） -->
      <div :class="bem('items')">
        <div
          v-for="(operation, index) in operations"
          :key="`${operation.id}-${index}`"
          :class="[
            bem('card'),
            {
              [bem('card--highlighted')]: highlightedIndex === index,
              [bem('card--flash')]: shouldFlash(index),
              [bem('card--dragging')]: draggedIndex === index,
            },
          ]"
          draggable="true"
          @dragstart="handleDragStart($event, index)"
          @dragend="handleDragEnd"
          @dragover="handleDragOver($event, index)"
          @drop="handleDrop($event, index)"
        >
          <!-- 操作头部 -->
          <div :class="bem('card-header')">
            <div :class="bem('drag-handle')" title="拖动排序" style="cursor: move">
              <HolderOutlined />
            </div>
            <div :class="bem('card-header-content')">
              <Dropdown :trigger="['click']" v-model:open="operationDropdownOpen[index]">
                <Button size="small" type="text" :class="bem('name-button')">
                  {{ getOperationName(operation.id) }}
                  <DownOutlined style="margin-left: 4px; font-size: 10px" />
                </Button>
                <template #overlay>
                  <Menu @click="(e: any) => handleOperationMenuClick(index, e.key)">
                    <MenuItem v-for="alt in getAlternativeOperations(operation.id)" :key="alt.id">
                      {{ alt.name }}
                    </MenuItem>
                  </Menu>
                </template>
              </Dropdown>
            </div>
            <div :class="bem('card-header-actions')">
              <Tooltip v-if="getOperationDoc(operation)" placement="top">
                <template #title>{{ getOperationDoc(operation) }}</template>
                <Button type="text" size="small">
                  <template #icon><InfoCircleOutlined /></template>
                </Button>
              </Tooltip>
              <Button type="text" size="small" @click="removeOperation(index)">
                <template #icon><CloseOutlined /></template>
              </Button>
            </div>
          </div>

          <!-- 参数编辑区（表格式布局） - 完全匹配 Grafana 逻辑 -->
          <div v-if="hasParamsOrRestParam(operation)" :class="bem('card-body')">
            <!-- 现有参数列表 -->
            <template v-for="(param, paramIndex) in getVisibleParams(operation)" :key="paramIndex">
              <div :class="bem('param-row')">
                <!-- 参数名称列 -->
                <div v-if="!param.hideName" :class="bem('param-name')">{{ param.name }}</div>
                <div v-else :class="bem('param-name')"></div>

                <!-- 参数值列 -->
                <div :class="bem('param-value')">
                  <div :class="bem('param-with-action')">
                    <!-- 标签参数编辑器 -->
                    <LabelParamEditor
                      v-if="param.editor === 'LabelParamEditor'"
                      v-model="operation.params[paramIndex] as string"
                      :index="paramIndex"
                      :query="currentQuery"
                      :datasource="datasource"
                      @change="handleParamChange(index, paramIndex, $event)"
                    />

                    <!-- 字符串输入 -->
                    <Input
                      v-else-if="param.type === 'string' && !param.options"
                      v-model:value="operation.params[paramIndex] as string"
                      :placeholder="param.placeholder || param.name"
                      size="small"
                      style="width: 200px"
                      @change="handleParamChange(index, paramIndex, operation.params[paramIndex])"
                    />

                    <!-- 数字输入 -->
                    <InputNumber
                      v-else-if="param.type === 'number' && !param.options"
                      v-model:value="operation.params[paramIndex] as number"
                      :placeholder="param.placeholder || param.name"
                      size="small"
                      style="width: 120px"
                      @change="handleParamChange(index, paramIndex, operation.params[paramIndex])"
                    />

                    <!-- 布尔输入 -->
                    <Checkbox
                      v-else-if="param.type === 'boolean'"
                      v-model:checked="operation.params[paramIndex] as boolean"
                      @change="handleParamChange(index, paramIndex, operation.params[paramIndex])"
                    >
                      {{ param.name }}
                    </Checkbox>

                    <!-- 下拉选择 -->
                    <Select
                      v-else-if="param.options"
                      v-model:value="operation.params[paramIndex] as string | number"
                      :placeholder="param.placeholder || param.name"
                      size="small"
                      style="width: 200px"
                      :options="formatParamOptions(param.options)"
                      @change="handleParamChange(index, paramIndex, operation.params[paramIndex])"
                    />

                    <!-- 删除 rest 参数按钮（Grafana 条件：restParam && (params.length > def.params.length || optional)） -->
                    <Button
                      v-if="param.restParam && canRemoveRestParam(operation, paramIndex)"
                      type="text"
                      danger
                      size="small"
                      @click="removeRestParam(index, paramIndex)"
                    >
                      <template #icon><CloseOutlined /></template>
                    </Button>
                  </div>
                </div>
              </div>
            </template>

            <!-- Rest 参数添加按钮（独立显示，即使没有参数） -->
            <div v-if="shouldShowAddButton(operation)" :class="[bem('param-row'), bem('param-row--rest')]">
              <div :class="bem('param-name')"></div>
              <div :class="bem('param-value')">
                <Button size="small" type="dashed" @click="addRestParam(index)"> <PlusOutlined /> {{ getRestParamName(operation) }} </Button>
              </div>
            </div>
          </div>

          <!-- 操作之间的箭头连接符 -->
          <div v-if="index < operations.length - 1" :class="bem('arrow')">
            <ArrowRightOutlined />
          </div>
        </div>

        <!-- 添加操作按钮 -->
        <div :class="bem('add-section')">
          <Cascader
            v-model:value="selectedNewOperation"
            :options="cascaderOptions"
            :show-search="{ filter: cascaderFilter }"
            placeholder="搜索操作"
            size="small"
            :class="bem('add-cascader')"
            @change="handleAddOperation"
          >
            <Button size="small">
              <PlusOutlined />
              添加操作
            </Button>
          </Cascader>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Button, Cascader, Checkbox, Dropdown, Input, InputNumber, Menu, MenuItem, Select, Tooltip } from '@grafana-fast/component';
  import { ref, watch, computed, nextTick } from 'vue';
  import { PlusOutlined, CloseOutlined, InfoCircleOutlined, HolderOutlined, DownOutlined, ArrowRightOutlined } from '@ant-design/icons-vue';
  import LabelParamEditor from './LabelParamEditor.vue';
  import { promQueryModeller } from '/#/components/QueryBuilder/lib/PromQueryModeller';
  import type { QueryBuilderOperation } from '/#/components/QueryBuilder/lib/types';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('operations-list');

  interface Props {
    modelValue: QueryBuilderOperation[];
    currentQuery?: any;
    datasource?: any;
    highlightedIndex?: number | null;
  }

  interface Emits {
    (e: 'update:modelValue', value: QueryBuilderOperation[]): void;
    (e: 'queryUpdate', query: any): void; // 用于通知完整查询对象的更新（如 binaryQueries）
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const operations = ref<QueryBuilderOperation[]>([...props.modelValue]);
  const selectedNewOperation = ref<any[]>([]);
  const flashingOperations = ref<Set<number>>(new Set());
  const operationDropdownOpen = ref<Record<number, boolean>>({});
  const draggedIndex = ref<number | null>(null);

  const categories = computed(() => promQueryModeller.getCategories());

  // 构建级联选择器选项（过滤掉 hideFromList 的操作）
  const cascaderOptions = computed(() => {
    return categories.value
      .map((category) => {
        const ops = promQueryModeller.getOperationsForCategory(category);
        return {
          value: category,
          label: category,
          children: ops
            .filter((op) => !op.hideFromList) // 隐藏 hideFromList 的操作
            .map((op) => ({
              value: op.id,
              label: op.name,
            })),
        };
      })
      .filter((category) => category.children.length > 0); // 移除空类别
  });

  watch(
    () => props.modelValue,
    (newValue) => {
      operations.value = [...newValue];
    },
    { deep: true }
  );

  // 级联选择器过滤函数
  const cascaderFilter = (inputValue: string, path: any[]) => {
    return path.some((option) => option.label.toLowerCase().includes(inputValue.toLowerCase()));
  };

  // 添加操作
  const handleAddOperation = (value: any[]) => {
    if (!value || value.length < 2) return;

    const operationId = value[1];
    const opDef = promQueryModeller.getOperationDef(operationId);
    if (!opDef) return;

    const newQuery = {
      ...props.currentQuery,
      operations: operations.value,
    };

    const updatedQuery = opDef.addOperationHandler(opDef, newQuery, promQueryModeller);
    const newOperationIndex = updatedQuery.operations.length - 1;

    operations.value = updatedQuery.operations;

    // 添加闪烁效果
    flashingOperations.value.add(newOperationIndex);
    nextTick(() => {
      setTimeout(() => {
        flashingOperations.value.delete(newOperationIndex);
      }, 1000);
    });

    // 对于二元查询等特殊操作，需要通知父组件整个查询对象已更新
    // 参考 Grafana OperationList.tsx 第 69 行
    if (updatedQuery.binaryQueries !== props.currentQuery?.binaryQueries) {
      emit('update:modelValue', operations.value);
      // 发射整个查询对象的更新
      emit('queryUpdate', updatedQuery);
    } else {
      handleOperationChange();
    }

    selectedNewOperation.value = [];
  };

  // 移除操作
  const removeOperation = (index: number) => {
    operations.value.splice(index, 1);
    handleOperationChange();
  };

  // 获取替代操作列表
  const getAlternativeOperations = (operationId: string) => {
    const opDef = promQueryModeller.getOperationDef(operationId);
    if (!opDef || !opDef.alternativesKey) {
      return [];
    }
    return promQueryModeller.getAlternativeOperations(opDef.alternativesKey);
  };

  // 处理操作菜单点击
  const handleOperationMenuClick = (opIndex: number, newOperationId: string) => {
    const operation = operations.value[opIndex];
    if (!operation) return;

    const currentOpDef = promQueryModeller.getOperationDef(operation.id);
    const newOpDef = promQueryModeller.getOperationDef(newOperationId);

    if (!newOpDef) return;

    // 复制默认参数，并用当前参数覆盖兼容的部分
    const newParams = [...newOpDef.defaultParams];
    for (let i = 0; i < Math.min(operation.params.length, newParams.length); i++) {
      const currentParamDef = currentOpDef?.params[i];
      const newParamDef = newOpDef.params[i];
      if (currentParamDef && newParamDef && newParamDef.type === currentParamDef.type) {
        const paramValue = operation.params[i];
        if (paramValue !== undefined) {
          newParams[i] = paramValue;
        }
      }
    }

    const changedOp = { ...operation, params: newParams, id: newOperationId };
    operations.value[opIndex] = newOpDef.changeTypeHandler ? newOpDef.changeTypeHandler(changedOp, newOpDef) : changedOp;

    handleOperationChange();
    operationDropdownOpen.value[opIndex] = false;
  };

  // 参数变化处理
  const handleParamChange = (opIndex: number, paramIndex: number, value: any) => {
    const operation = operations.value[opIndex];
    if (!operation) return;

    operation.params[paramIndex] = value;

    const opDef = promQueryModeller.getOperationDef(operation.id);

    // 使用参数变化处理器（如果有）
    if (opDef?.paramChangedHandler) {
      const updatedOp = opDef.paramChangedHandler(paramIndex, operation, opDef);
      operations.value[opIndex] = updatedOp;
    }

    handleOperationChange();
  };

  // 不再需要 handleAddOptionalParam，因为 Grafana 不在参数区域显示 "+ By label" 按钮

  // 添加 rest 参数（完全匹配Grafana逻辑）
  const addRestParam = (opIndex: number) => {
    const operation = operations.value[opIndex];
    if (!operation) return;

    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef) return;

    // 添加一个新的空参数
    operation.params.push('');

    // 调用参数变化处理器
    if (opDef.paramChangedHandler) {
      const updatedOp = opDef.paramChangedHandler(operation.params.length - 1, operation, opDef);
      operations.value[opIndex] = updatedOp;
    }

    handleOperationChange();
  };

  // 删除 rest 参数（完全匹配Grafana逻辑）
  const removeRestParam = (opIndex: number, paramIndex: number) => {
    const operation = operations.value[opIndex];
    if (!operation) return;

    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef) return;

    // 删除参数
    operation.params.splice(paramIndex, 1);

    // 调用参数变化处理器（这会在删除最后一个标签时触发切换，如 __sum_by -> sum）
    if (opDef.paramChangedHandler) {
      const updatedOp = opDef.paramChangedHandler(paramIndex, operation, opDef);
      operations.value[opIndex] = updatedOp;
    }

    handleOperationChange();
  };

  // 检查是否可以删除 rest 参数（完全匹配 Grafana 条件）
  const canRemoveRestParam = (operation: QueryBuilderOperation, _paramIndex: number): boolean => {
    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef || !opDef.params || opDef.params.length === 0) return false;

    const lastParamDef = opDef.params[opDef.params.length - 1];
    if (!lastParamDef) return false;

    // Grafana 条件：restParam && (params.length > def.params.length || optional)
    return Boolean(lastParamDef.restParam) && (operation.params.length > opDef.params.length || Boolean(lastParamDef.optional));
  };

  // 检查是否应该显示 "+ Label" 按钮
  const shouldShowAddButton = (operation: QueryBuilderOperation): boolean => {
    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef || !opDef.params || opDef.params.length === 0) return false;

    const lastParamDef = opDef.params[opDef.params.length - 1];
    if (!lastParamDef) return false;

    return Boolean(lastParamDef.restParam);
  };

  // 获取 rest 参数名称
  const getRestParamName = (operation: QueryBuilderOperation): string => {
    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef) return 'Parameter';

    const restParamDef = opDef.params.find((p) => p.restParam);
    return restParamDef?.name || 'Parameter';
  };

  // 检查是否应该显示参数区域（有参数值或有 restParam）
  const hasParamsOrRestParam = (operation: QueryBuilderOperation): boolean => {
    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef || !opDef.params || opDef.params.length === 0) return false;

    // 如果有参数值，显示参数区域
    if (operation.params.length > 0) return true;

    // 如果没有参数值，但有 restParam，也显示参数区域（用于显示 "+ Label" 按钮）
    const lastParamDef = opDef.params[opDef.params.length - 1];
    if (!lastParamDef) return false;

    return Boolean(lastParamDef.restParam);
  };

  // 获取可见的参数（完全匹配 Grafana 逻辑）
  const getVisibleParams = (operation: QueryBuilderOperation): any[] => {
    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef || !opDef.params || opDef.params.length === 0) return [];

    // Grafana 逻辑：直接遍历 operation.params，对每个参数值返回对应的参数定义
    // 如果是 restParam，多个参数值使用同一个参数定义（通过 Math.min 实现）
    const params: any[] = [];
    for (let i = 0; i < operation.params.length; i++) {
      const paramDef = opDef.params[Math.min(opDef.params.length - 1, i)];
      params.push(paramDef);
    }

    return params;
  };

  // 格式化参数选项
  const formatParamOptions = (options: any[]): any[] => {
    if (!options || options.length === 0) return [];

    return options.map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        return opt; // 已经是 { label, value } 格式
      }
      return {
        label: String(opt),
        value: opt,
      };
    });
  };

  // 判断是否应该闪烁
  const shouldFlash = (index: number): boolean => {
    return flashingOperations.value.has(index);
  };

  const handleOperationChange = () => {
    emit('update:modelValue', operations.value);
  };

  const getOperationName = (id: string): string => {
    const opDef = promQueryModeller.getOperationDef(id);
    return opDef?.name || id;
  };

  const getOperationDoc = (operation: QueryBuilderOperation): string => {
    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (opDef?.explainHandler) {
      return opDef.explainHandler(operation, opDef);
    }
    return opDef?.documentation || '';
  };

  // 拖拽功能
  const handleDragStart = (event: DragEvent, index: number) => {
    draggedIndex.value = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', String(index));
    }
  };

  const handleDragEnd = () => {
    draggedIndex.value = null;
  };

  const handleDragOver = (event: DragEvent, _index: number) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (event: DragEvent, targetIndex: number) => {
    event.preventDefault();
    if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
      return;
    }

    // 重新排序操作列表
    const items = [...operations.value];
    const draggedItem = items[draggedIndex.value];
    if (!draggedItem) {
      return;
    }
    items.splice(draggedIndex.value, 1);
    items.splice(targetIndex, 0, draggedItem);
    operations.value = items;

    draggedIndex.value = null;
    handleOperationChange();
  };
</script>

<style scoped lang="less">
  .dp-operations-list {
    width: 100%;

    &__row {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    &__items {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: flex-start;
    }

    &__card {
      position: relative;
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-xs);
      transition: border-color var(--gf-motion-fast) var(--gf-easing), box-shadow var(--gf-motion-fast) var(--gf-easing);
      min-width: 240px;
      max-width: 420px;

      &:hover {
        border-color: var(--gf-color-border-strong);
      }

      &--highlighted {
        border-color: var(--gf-color-primary-border-strong);
        box-shadow: var(--gf-focus-ring);
      }

      &--flash {
        animation: flashAnimation 1s ease-in-out;
      }
    }

    @keyframes flashAnimation {
      0%,
      100% {
        border-color: var(--gf-color-border-muted);
      }
      50% {
        border-color: var(--gf-color-warning-border);
      }
    }

    /* 卡片头部 */
    &__card-header {
      display: flex;
      align-items: center;
      padding: 4px 6px;
      border-bottom: 1px solid var(--gf-color-border-muted);
      background: var(--gf-color-surface-muted);
    }

    &__drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      color: var(--gf-color-text-disabled);
      cursor: grab;
      transition: color 0.2s;
      margin-right: 4px;
      font-size: 12px;

      &:hover {
        color: var(--gf-color-text-secondary);
      }

      &:active {
        cursor: grabbing;
      }
    }

    &__card-header-content {
      flex: 1;
      display: flex;
      align-items: center;
    }

    &__name-button {
      font-weight: 500;
      color: var(--gf-color-text);
      padding: 0 4px;
      font-size: 12px;
      height: auto;
      line-height: 1.5;

      &:hover {
        color: var(--gf-color-primary);
      }
    }

    &__card-header-actions {
      display: flex;
      gap: 2px;
      align-items: center;
    }

    /* 卡片体部（表格式布局） */
    &__card-body {
      display: table;
      width: 100%;
      padding: 6px;
    }

    &__param-row {
      display: table-row;
      vertical-align: middle;

      &--rest {
        margin-top: 2px;
      }
    }

    &__param-name {
      display: table-cell;
      padding: 4px 6px 4px 0;
      font-size: 12px;
      font-weight: 500;
      color: var(--gf-color-text-secondary);
      vertical-align: middle;
      min-width: 70px;
      white-space: nowrap;
    }

    &__param-value {
      display: table-cell;
      padding: 4px 0;
      vertical-align: middle;
    }

    &__param-with-action {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* 操作箭头 */
    &__arrow {
      position: absolute;
      right: -16px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--gf-color-text-disabled);
      font-size: 12px;
      z-index: 1;
    }

    /* 添加操作按钮 */
    &__add-section {
      display: flex;
      align-items: center;
    }

    &__add-cascader {
      width: auto;
    }

    /* 覆盖自定义级联/下拉样式 */
    :deep(.gf-cascader__dropdown) {
      min-width: 160px;
    }

    :deep(.gf-cascader__option) {
      padding: 6px 10px;
      font-size: 12px;
    }

    :deep(.gf-menu__item) {
      font-size: 12px;
    }
  }
</style>
