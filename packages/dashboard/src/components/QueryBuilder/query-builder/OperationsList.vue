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
    update:modelValue, query-update
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
              <Button size="small" type="text" :class="bem('name-button')">
                {{ getOperationName(operation.id) }}
              </Button>
            </div>
            <div :class="bem('card-header-actions')">
              <Tooltip v-if="getOperationDoc(operation)" :title="getOperationDoc(operation)">
                <Button size="small" type="text">
                  <template #icon><InfoCircleOutlined /></template>
                </Button>
              </Tooltip>
              <Button size="small" type="text" @click="removeOperation(index)">
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
                      style="width: 200px"
                      @change="handleParamChange(index, paramIndex, operation.params[paramIndex])"
                    />

                    <!-- 数字输入 -->
                    <InputNumber
                      v-else-if="param.type === 'number' && !param.options"
                      v-model:value="operation.params[paramIndex] as number"
                      :placeholder="param.placeholder || param.name"
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
                      style="width: 200px"
                      :options="formatParamOptions(param.options)"
                      @change="handleParamChange(index, paramIndex, operation.params[paramIndex])"
                    />

                    <!-- 删除 rest 参数按钮（Grafana 条件：restParam && (params.length > def.params.length || optional)） -->
                    <Button
                      v-if="param.restParam && canRemoveRestParam(operation, paramIndex)"
                      size="small"
                      type="text"
                      danger
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
            placeholder="选择操作"
            :dropdownMinWidth="160"
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
  import { Button, Cascader, Checkbox, Input, InputNumber, Select, Tooltip } from '@grafana-fast/component';
  import { computed } from 'vue';
  import { PlusOutlined, CloseOutlined, InfoCircleOutlined, HolderOutlined, ArrowRightOutlined } from '@ant-design/icons-vue';
  import LabelParamEditor from './LabelParamEditor.vue';
  import type { PromVisualQuery, QueryBuilderOperation } from '@grafana-fast/utils';
  import { createNamespace } from '/#/utils';
  import { useOperationsListModel } from './useOperationsListModel';

  const [_, bem] = createNamespace('operations-list');

  interface Props {
    modelValue: QueryBuilderOperation[];
    currentQuery: PromVisualQuery;
    datasource?: unknown;
    highlightedIndex?: number | null;
  }

  interface Emits {
    (e: 'update:modelValue', value: QueryBuilderOperation[]): void;
    /**
     * 当需要更新整份 query 对象时触发（例如 binaryQueries 发生变化）
     */
    (e: 'query-update', query: PromVisualQuery): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const highlightedIndex = computed(() => (props.highlightedIndex == null ? null : props.highlightedIndex));

  const {
    operations,
    selectedNewOperation,
    cascaderOptions,
    draggedIndex,
    shouldFlash,
    handleAddOperation,
    removeOperation,
    handleParamChange,
    addRestParam,
    removeRestParam,
    canRemoveRestParam,
    shouldShowAddButton,
    getRestParamName,
    hasParamsOrRestParam,
    getVisibleParams,
    formatParamOptions,
    getOperationName,
    getOperationDoc,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  } = useOperationsListModel({
    getModelValue: () => props.modelValue,
    getCurrentQuery: () => props.currentQuery,
    emitUpdateModelValue: (value) => emit('update:modelValue', value),
    emitQueryUpdate: (query) => emit('query-update', query),
  });
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
      transition:
        border-color var(--gf-motion-fast) var(--gf-easing),
        box-shadow var(--gf-motion-fast) var(--gf-easing);
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
      transition: color var(--gf-motion-fast) var(--gf-easing);
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
      line-height: 1.5714285714285714;
      transition: color var(--gf-motion-fast) var(--gf-easing);

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
      padding: 8px;
    }

    &__param-row {
      display: table-row;
      vertical-align: middle;

      &--rest {
        margin-top: 4px;
      }
    }

    &__param-name {
      display: table-cell;
      padding: 4px 8px 4px 0;
      font-size: 12px;
      font-weight: 500;
      color: var(--gf-color-text-secondary);
      vertical-align: middle;
      min-width: 70px;
      white-space: nowrap;
      line-height: 1.5714285714285714;
    }

    &__param-value {
      display: table-cell;
      padding: 4px 0;
      vertical-align: middle;
    }

    &__param-with-action {
      display: flex;
      align-items: center;
      gap: 6px;
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

    /* Cascader 下拉样式统一由组件本身 + props 控制（避免 deep 覆写） */
  }
</style>
