import { promQueryModeller } from '@grafana-fast/utils';
import type { PromVisualQuery, QueryBuilderOperationDef, QueryBuilderOperationParamValue } from '@grafana-fast/utils';

export interface BaseExplainStep {
  stepNumber: 1;
  promql: string;
  description: string;
}

export interface ExplainParamItem {
  name: string;
  value: QueryBuilderOperationParamValue;
}

export interface ExplainStep {
  stepNumber: number;
  title: string;
  promqlFragment: string;
  description: string;
  category: string;
  categoryLabel: string;
  operationIndex: number;
  params?: ExplainParamItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  aggregations: '聚合',
  'range functions': '范围函数',
  functions: '函数',
  'trigonometric functions': '三角函数',
  'time functions': '时间函数',
  'binary operations': '二元运算',
  other: '其他',
};

const CATEGORY_COLORS: Record<string, string> = {
  aggregations: 'blue',
  'range functions': 'green',
  functions: 'cyan',
  'trigonometric functions': 'purple',
  'time functions': 'orange',
  'binary operations': 'red',
  other: 'default',
};

export function getOperationColor(category: string): string {
  return CATEGORY_COLORS[String(category ?? '').toLowerCase()] || 'default';
}

export function getOperationCategoryLabel(category: string): string {
  const key = String(category ?? '').toLowerCase();
  return CATEGORY_LABELS[key] || category || '其他';
}

export function buildBaseExplainStep(query: PromVisualQuery): BaseExplainStep | null {
  if (!query.metric && query.labels.length === 0) {
    return null;
  }

  let promql = query.metric || '';
  let description = '获取匹配指标名称的所有时间序列';

  if (query.labels.length > 0) {
    promql += promQueryModeller.renderLabels(query.labels);
    description = `获取匹配指标名称和 ${query.labels.length} 个标签过滤条件的所有时间序列。标签过滤器用于精确筛选需要查询的数据。`;
  }

  return {
    stepNumber: 1,
    promql,
    description,
  };
}

function getOperationDescription(operation: PromVisualQuery['operations'][number], opDef: QueryBuilderOperationDef): string {
  if (opDef.explainHandler) return opDef.explainHandler(operation, opDef);
  if (opDef.documentation) return opDef.documentation;
  return '应用此操作到查询结果';
}

function extractOperationParams(operation: PromVisualQuery['operations'][number], opDef: QueryBuilderOperationDef): ExplainParamItem[] | undefined {
  if (!operation.params?.length) return undefined;
  if (!opDef.params?.length) return undefined;

  const params: ExplainParamItem[] = [];
  let paramIndex = 0;

  opDef.params.forEach((paramDef) => {
    if (paramIndex >= operation.params.length) return;

    if (paramDef.restParam) {
      const restValues: QueryBuilderOperationParamValue[] = [];
      while (paramIndex < operation.params.length) {
        const value = operation.params[paramIndex];
        if (value !== undefined && value !== '') {
          restValues.push(value);
        }
        paramIndex++;
      }

      if (restValues.length > 0) {
        restValues.forEach((value, index) => {
          params.push({
            name: `${paramDef.name || 'Label'} ${index + 1}`,
            value,
          });
        });
      }
      return;
    }

    const value = operation.params[paramIndex];
    if (value !== undefined && value !== '') {
      params.push({
        name: paramDef.name || `参数 ${paramIndex + 1}`,
        value,
      });
    }
    paramIndex++;
  });

  return params.length > 0 ? params : undefined;
}

export function buildOperationExplainSteps(query: PromVisualQuery): ExplainStep[] {
  const steps: ExplainStep[] = [];
  let stepNumber = 2; // 从 2 开始，因为 1 是基础查询

  for (const [index, operation] of query.operations.entries()) {
    const opDef = promQueryModeller.getOperationDef(operation.id);
    if (!opDef) {
      steps.push({
        stepNumber,
        title: `未知操作: ${operation.id}`,
        promqlFragment: operation.id,
        description: '操作定义未找到',
        category: 'unknown',
        categoryLabel: '未知',
        operationIndex: index,
      });
      stepNumber++;
      continue;
    }

    // 使用 renderer 生成此步骤的 PromQL 片段
    const promqlFragment = opDef.renderer(operation, opDef, '<expr>');
    const description = getOperationDescription(operation, opDef);
    const params = extractOperationParams(operation, opDef);

    const category = opDef.category || 'other';
    steps.push({
      stepNumber,
      title: opDef.name || operation.id,
      promqlFragment,
      description,
      category,
      categoryLabel: getOperationCategoryLabel(category),
      operationIndex: index,
      params,
    });

    stepNumber++;
  }

  return steps;
}

// 简化的 Markdown 渲染（实际应使用 marked 或 markdown-it 库）
export function renderExplainMarkdown(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // 粗体
    .replace(/\*(.+?)\*/g, '<em>$1</em>') // 斜体
    .replace(/`(.+?)`/g, '<code>$1</code>') // 行内代码
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>') // 链接
    .replace(/\n/g, '<br>'); // 换行
}
