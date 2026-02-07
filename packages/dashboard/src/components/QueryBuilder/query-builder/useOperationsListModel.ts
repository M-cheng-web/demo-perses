import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { promQueryModeller } from '@grafana-fast/utils';
import type { PromVisualQuery, QueryBuilderOperation, QueryBuilderOperationParamDef, QueryBuilderOperationParamValue } from '@grafana-fast/utils';
import { getOperationCascaderOptions } from './operationsCatalog';

interface UseOperationsListModelOptions {
  getModelValue: () => QueryBuilderOperation[];
  getCurrentQuery: () => PromVisualQuery;
  emitUpdateModelValue: (value: QueryBuilderOperation[]) => void;
  emitQueryUpdate: (query: PromVisualQuery) => void;
}

export function useOperationsListModel(options: UseOperationsListModelOptions) {
  const operations = ref<QueryBuilderOperation[]>([...options.getModelValue()]);
  const selectedNewOperation = ref<Array<string | number>>([]);
  const draggedIndex = ref<number | null>(null);

  const flashingOperations = ref<Set<number>>(new Set());
  const flashTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

  const cascaderOptions = computed(() => getOperationCascaderOptions());

  const clearFlashTimer = (index: number) => {
    const timer = flashTimeouts.get(index);
    if (timer) {
      clearTimeout(timer);
      flashTimeouts.delete(index);
    }
  };

  const scheduleUnflash = (index: number) => {
    clearFlashTimer(index);
    const timer = setTimeout(() => {
      flashingOperations.value.delete(index);
      flashTimeouts.delete(index);
    }, 1000);
    flashTimeouts.set(index, timer);
  };

  const shouldFlash = (index: number): boolean => flashingOperations.value.has(index);

  onBeforeUnmount(() => {
    for (const timer of flashTimeouts.values()) clearTimeout(timer);
    flashTimeouts.clear();
  });

  watch(
    () => options.getModelValue(),
    (newValue) => {
      operations.value = [...newValue];
    },
    { deep: true }
  );

  const handleOperationChange = () => {
    options.emitUpdateModelValue(operations.value);
  };

  // 添加操作
  const handleAddOperation = (value: Array<string | number>) => {
    if (!value || value.length < 2) return;

    const operationId = String(value[1] ?? '').trim();
    if (!operationId) return;
    const opDef = promQueryModeller.getOperationDef(operationId);
    if (!opDef) return;

    const currentQuery = options.getCurrentQuery();
    const newQuery: PromVisualQuery = {
      ...currentQuery,
      operations: operations.value,
    };

    const updatedQuery = opDef.addOperationHandler(opDef, newQuery, promQueryModeller);
    const newOperationIndex = updatedQuery.operations.length - 1;

    operations.value = updatedQuery.operations;

    // 添加闪烁效果（等待 DOM 更新后再启动计时器，保证动画可见）
    flashingOperations.value.add(newOperationIndex);
    nextTick(() => scheduleUnflash(newOperationIndex));

    // 对于二元查询等特殊操作，需要通知父组件整个查询对象已更新
    // 参考 Grafana OperationList.tsx 第 69 行
    if (updatedQuery.binaryQueries !== currentQuery.binaryQueries) {
      options.emitUpdateModelValue(operations.value);
      options.emitQueryUpdate(updatedQuery);
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

  // 参数变化处理
  const handleParamChange = (opIndex: number, paramIndex: number, value: QueryBuilderOperationParamValue | undefined) => {
    const operation = operations.value[opIndex];
    if (!operation) return;

    const nextValue: QueryBuilderOperationParamValue = value ?? '';
    operation.params[paramIndex] = nextValue;

    const opDef = promQueryModeller.getOperationDef(operation.id);
    const paramDef = opDef?.params?.[Math.min((opDef?.params?.length ?? 1) - 1, paramIndex)];

    if (paramDef?.editor === 'LabelParamEditor' && paramDef.restParam) {
      const normalized = String(nextValue ?? '').trim();
      if (!normalized) {
        operation.params.splice(paramIndex, 1);
      }
    }

    // 使用参数变化处理器（如果有）
    if (opDef?.paramChangedHandler) {
      const updatedOp = opDef.paramChangedHandler(paramIndex, operation, opDef);
      operations.value[opIndex] = updatedOp;
    }

    handleOperationChange();
  };

  // 添加 rest 参数（完全匹配 Grafana 逻辑）
  const addRestParam = (opIndex: number) => {
    const operation = operations.value[opIndex];
    if (!operation) return;

    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef) return;

    operation.params.push('');

    if (opDef.paramChangedHandler) {
      const updatedOp = opDef.paramChangedHandler(operation.params.length - 1, operation, opDef);
      operations.value[opIndex] = updatedOp;
    }

    handleOperationChange();
  };

  // 删除 rest 参数（完全匹配 Grafana 逻辑）
  const removeRestParam = (opIndex: number, paramIndex: number) => {
    const operation = operations.value[opIndex];
    if (!operation) return;

    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef) return;

    operation.params.splice(paramIndex, 1);

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

    if (operation.params.length > 0) return true;

    const lastParamDef = opDef.params[opDef.params.length - 1];
    if (!lastParamDef) return false;

    return Boolean(lastParamDef.restParam);
  };

  // 获取可见的参数（完全匹配 Grafana 逻辑）
  const getVisibleParams = (operation: QueryBuilderOperation): QueryBuilderOperationParamDef[] => {
    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef || !opDef.params || opDef.params.length === 0) return [];

    if (operation.params.length === 0) {
      const first = opDef.params[0];
      if (first && first.restParam && first.optional && first.editor === 'LabelParamEditor') {
        return [first];
      }
    }

    const params: QueryBuilderOperationParamDef[] = [];
    for (let i = 0; i < operation.params.length; i++) {
      const paramDef = opDef.params[Math.min(opDef.params.length - 1, i)];
      if (paramDef) params.push(paramDef);
    }

    return params;
  };

  // 格式化参数选项
  const formatParamOptions = (options: QueryBuilderOperationParamDef['options']): Array<{ label: string; value: string | number }> => {
    if (!options || options.length === 0) return [];

    return options
      .map((opt) => {
        if (typeof opt === 'object' && opt !== null) {
          const maybe = opt as { label?: unknown; value?: unknown };
          const value = maybe.value;
          if (typeof value === 'string' || typeof value === 'number') {
            const label = String(maybe.label ?? value);
            return { label, value };
          }
          return null;
        }
        if (typeof opt === 'string' || typeof opt === 'number') {
          return { label: String(opt), value: opt };
        }
        return null;
      })
      .filter((x): x is { label: string; value: string | number } => x != null);
  };

  const getOperationName = (id: string): string => {
    const opDef = promQueryModeller.getOperationDef(id);
    return opDef?.name || id;
  };

  const getOperationDoc = (operation: QueryBuilderOperation): string => {
    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (opDef?.explainHandler) return opDef.explainHandler(operation, opDef);
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
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event: DragEvent, targetIndex: number) => {
    event.preventDefault();
    if (draggedIndex.value === null || draggedIndex.value === targetIndex) return;

    const items = [...operations.value];
    const draggedItem = items[draggedIndex.value];
    if (!draggedItem) return;

    items.splice(draggedIndex.value, 1);
    items.splice(targetIndex, 0, draggedItem);
    operations.value = items;

    draggedIndex.value = null;
    handleOperationChange();
  };

  return {
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
  };
}
