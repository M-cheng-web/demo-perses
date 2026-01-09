/**
 * @fileoverview 操作工具函数库
 * @description
 *   提供操作定义和处理的核心工具函数。
 *       主要功能：
 *       - createAggregationOperation: 创建聚合操作（自动生成三个变体）
 *       - getPromOperationDisplayName: 获取操作的显示名称
 *       - defaultAddOperationHandler: 默认的添加操作处理器
 *       - getLastLabelRemovedHandler: 标签移除时的处理（切换操作变体）
 *       - getOnLabelAddedHandler: 标签添加时的处理（切换操作变体）
 *       - addNestedQueryHandler: 添加嵌套二元查询（深拷贝当前查询）
 *       - rangeRendererWithParams: 渲染带参数的范围函数
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/operationUtils.ts
 */
/**
 * 操作工具函数
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/operationUtils.ts
 */
import type {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  QueryBuilderOperationParamValue,
  QueryWithOperations,
} from './shared/types';
import { PromVisualQueryOperationCategory } from './types';

/**
 * 左侧函数渲染器: func(innerExpr, param1, param2)
 */
export function functionRendererLeft(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string): string {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.push(innerExpr);
  }

  return str + params.join(', ') + ')';
}

/**
 * 右侧函数渲染器: func(param1, param2, innerExpr)
 */
export function functionRendererRight(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string): string {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.unshift(innerExpr);
  }

  return str + params.join(', ') + ')';
}

/**
 * 带参数的范围向量渲染器（左侧）
 */
export function rangeRendererLeftWithParams(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string): string {
  return rangeRendererWithParams(model, def, innerExpr, true);
}

/**
 * 带参数的范围向量渲染器（右侧）
 */
export function rangeRendererRightWithParams(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string): string {
  return rangeRendererWithParams(model, def, innerExpr, false);
}

/**
 * 带参数的范围向量渲染器核心实现
 */
function rangeRendererWithParams(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string, renderLeft: boolean): string {
  if (def.params.length < 2) {
    throw `Cannot render a function with params of length [${def.params.length}]`;
  }

  const rangeVector = (model.params ?? [])[0] ?? '5m';

  // 渲染剩余参数（去掉第一个范围参数）
  const params = renderParams(
    {
      ...model,
      params: model.params.slice(1),
    },
    {
      ...def,
      params: def.params.slice(1),
      defaultParams: def.defaultParams.slice(1),
    },
    innerExpr
  );

  const str = model.id + '(';

  // 根据 renderLeft 决定范围向量的位置
  if (innerExpr) {
    renderLeft ? params.push(`${innerExpr}[${rangeVector}]`) : params.unshift(`${innerExpr}[${rangeVector}]`);
  }

  return str + params.join(', ') + ')';
}

/**
 * 渲染参数
 */
function renderParams(model: QueryBuilderOperation, def: QueryBuilderOperationDef, _innerExpr: string) {
  return (model.params ?? []).map((value, index) => {
    const paramDef = def.params[index];
    if (paramDef?.type === 'string') {
      return `"${value}"`;
    }
    return value;
  });
}

/**
 * 默认添加操作处理器
 */
export function defaultAddOperationHandler<T extends QueryWithOperations>(def: QueryBuilderOperationDef, query: T): T {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: [...def.defaultParams],
  };

  return {
    ...query,
    operations: [...query.operations, newOperation],
  } as T;
}

/**
 * 获取 PromQL 操作显示名称
 */
export function getPromOperationDisplayName(funcName: string): string {
  return capitalize(funcName.replace(/_/g, ' '));
}

/**
 * 首字母大写
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 获取范围向量参数定义
 */
export function getRangeVectorParamDef(withRateInterval: boolean = false): QueryBuilderOperationParamDef {
  const options: Array<{ label: string; value: string }> = [
    { label: '$__interval', value: '$__interval' },
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '10m', value: '10m' },
    { label: '1h', value: '1h' },
    { label: '24h', value: '24h' },
  ];

  if (withRateInterval) {
    options.unshift({
      label: '$__rate_interval',
      value: '$__rate_interval',
    });
  }

  return {
    name: 'Range',
    type: 'string',
    options,
  };
}

/**
 * 创建聚合操作（包含普通、by、without 三种变体）
 */
export function createAggregationOperation(name: string, overrides: Partial<QueryBuilderOperationDef> = {}): QueryBuilderOperationDef[] {
  const operations: QueryBuilderOperationDef[] = [
    // 1. 普通聚合: sum(metric)
    {
      id: name,
      name: getPromOperationDisplayName(name),
      params: [
        {
          name: 'By label',
          type: 'string',
          restParam: true,
          optional: true,
        },
      ],
      defaultParams: [],
      alternativesKey: 'plain aggregations',
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      paramChangedHandler: getOnLabelAddedHandler(`__${name}_by`),
      explainHandler: getAggregationExplainer(name, ''),
      addOperationHandler: defaultAddOperationHandler,
      ...overrides,
    },
    // 2. By 聚合: sum by(label1, label2)(metric)
    {
      id: `__${name}_by`,
      name: `${getPromOperationDisplayName(name)} by`,
      params: [
        {
          name: 'Label',
          type: 'string',
          restParam: true,
          optional: true,
          editor: 'LabelParamEditor',
        },
      ],
      defaultParams: [''],
      alternativesKey: 'aggregations by',
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: getAggregationByRenderer(name),
      paramChangedHandler: getLastLabelRemovedHandler(name),
      explainHandler: getAggregationExplainer(name, 'by'),
      addOperationHandler: defaultAddOperationHandler,
      hideFromList: true,
      ...overrides,
    },
    // 3. Without 聚合: sum without(label1)(metric)
    {
      id: `__${name}_without`,
      name: `${getPromOperationDisplayName(name)} without`,
      params: [
        {
          name: 'Label',
          type: 'string',
          restParam: true,
          optional: true,
          editor: 'LabelParamEditor',
        },
      ],
      defaultParams: [''],
      alternativesKey: 'aggregations by',
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: getAggregationWithoutRenderer(name),
      paramChangedHandler: getLastLabelRemovedHandler(name),
      explainHandler: getAggregationExplainer(name, 'without'),
      addOperationHandler: defaultAddOperationHandler,
      hideFromList: true,
      ...overrides,
    },
  ];

  return operations;
}

/**
 * 创建带参数的聚合操作
 */
export function createAggregationOperationWithParam(
  name: string,
  paramsDef: {
    params: QueryBuilderOperationParamDef[];
    defaultParams: QueryBuilderOperationParamValue[];
  },
  overrides: Partial<QueryBuilderOperationDef> = {}
): QueryBuilderOperationDef[] {
  const operations = createAggregationOperation(name, overrides);

  if (operations[0] && operations[1] && operations[2]) {
    operations[0].params.unshift(...paramsDef.params);
    operations[1].params.unshift(...paramsDef.params);
    operations[2].params.unshift(...paramsDef.params);
    operations[0].defaultParams = paramsDef.defaultParams;
    operations[1].defaultParams = [...paramsDef.defaultParams, ''];
    operations[2].defaultParams = [...paramsDef.defaultParams, ''];
    operations[1].renderer = getAggregationByRendererWithParameter(name);
    operations[2].renderer = getAggregationByRendererWithParameter(name);
  }
  return operations;
}

/**
 * 获取聚合 by 渲染器
 */
export function getAggregationByRenderer(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, _def: QueryBuilderOperationDef, innerExpr: string): string {
    const labels = model.params.filter((p) => p !== '').join(', ');
    if (!labels) {
      return `${aggregation}(${innerExpr})`;
    }
    return `${aggregation} by(${labels}) (${innerExpr})`;
  };
}

/**
 * 获取聚合 without 渲染器
 */
function getAggregationWithoutRenderer(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, _def: QueryBuilderOperationDef, innerExpr: string): string {
    const labels = model.params.filter((p) => p !== '').join(', ');
    if (!labels) {
      return `${aggregation}(${innerExpr})`;
    }
    return `${aggregation} without(${labels}) (${innerExpr})`;
  };
}

/**
 * 带参数的聚合渲染器
 */
function getAggregationByRendererWithParameter(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string): string {
    const restParamIndex = def.params.findIndex((param) => param.restParam);
    const params = model.params.slice(0, restParamIndex);
    const restParams = model.params.slice(restParamIndex).filter((p) => p !== '');

    const renderedParams = params.map((param, idx) => (def.params[idx]?.type === 'string' ? `"${param}"` : param)).join(', ');

    if (restParams.length === 0) {
      return `${aggregation}(${renderedParams}, ${innerExpr})`;
    }

    return `${aggregation} by(${restParams.join(', ')}) (${renderedParams}, ${innerExpr})`;
  };
}

/**
 * 获取聚合解释器
 */
export function getAggregationExplainer(aggregationName: string, mode: 'by' | 'without' | '') {
  return function aggregationExplainer(model: QueryBuilderOperation): string {
    const labels = model.params
      .filter((p) => p !== '')
      .map((label) => `\`${label}\``)
      .join(' 和 ');
    const labelWord = model.params.length > 1 ? '标签' : '标签';

    switch (mode) {
      case 'by':
        return labels ? `按 ${labels} ${labelWord}分组计算 ${aggregationName}，保留这些标签` : `计算所有维度的 ${aggregationName}`;
      case 'without':
        return labels ? `计算 ${aggregationName}，排除 ${labels} ${labelWord}，保留其他所有标签` : `计算所有维度的 ${aggregationName}`;
      default:
        return `计算所有维度的 ${aggregationName}`;
    }
  };
}

/**
 * 当移除最后一个标签时，切换回普通聚合
 */
export function getLastLabelRemovedHandler(changeToOperationId: string) {
  return function onParamChanged(_index: number, op: QueryBuilderOperation, _def: QueryBuilderOperationDef): QueryBuilderOperation {
    const validParams = op.params.filter((p) => p !== '');
    // 如果没有有效参数了，切换回普通聚合
    if (validParams.length === 0) {
      return {
        ...op,
        id: changeToOperationId,
        params: [],
      };
    }
    return op;
  };
}

/**
 * 当添加标签时，切换到 by 版本
 */
export function getOnLabelAddedHandler(changeToOperationId: string) {
  return function onParamChanged(_index: number, op: QueryBuilderOperation, _def: QueryBuilderOperationDef): QueryBuilderOperation {
    const validParams = op.params.filter((p) => p !== '');
    // 如果有有效参数，切换到 by 版本
    if (validParams.length > 0 && op.id !== changeToOperationId) {
      return {
        ...op,
        id: changeToOperationId,
      };
    }
    return op;
  };
}

/**
 * 添加嵌套查询（二元查询）的处理器
 * 参考 Grafana 的 addNestedQueryHandler
 * packages/grafana-prometheus/src/querybuilder/operations.ts 第 367-378 行
 *
 * 关键：新的二元查询会复制当前查询作为默认值！
 * 这样用户不需要重新输入 metric、labels、operations
 *
 * 注意：必须进行深拷贝，避免数据共享问题
 */
export function addNestedQueryHandler(_def: QueryBuilderOperationDef, query: any): any {
  return {
    ...query,
    binaryQueries: [
      ...(query.binaryQueries ?? []),
      {
        operator: '/',
        query: JSON.parse(JSON.stringify(query)), // 深拷贝，避免引用共享
      },
    ],
  };
}
