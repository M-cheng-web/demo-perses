/**
 * @fileoverview PromQL 标签渲染逻辑
 * @description
 *   渲染标签过滤器为 PromQL 标签选择器。
 *       主要功能：
 *       - renderLabels: 渲染标签列表为 {label1="value1", label2=~"regex"}
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/shared/renderUtils.ts
 */
/**
 * 标签渲染工具
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/shared/rendering/labels.ts
 */
import type { QueryBuilderLabelFilter } from '../types';
import { quotePromqlString } from './escape';

/**
 * 渲染标签过滤器为 PromQL 格式: {label1="value1", label2="value2"}
 */
export function renderLabels(labels: QueryBuilderLabelFilter[]): string {
  if (labels.length === 0) return '';
  return `{${renderLabelsWithoutBrackets(labels).join(', ')}}`;
}

/**
 * 渲染标签过滤器（不带花括号）
 */
export function renderLabelsWithoutBrackets(labels: QueryBuilderLabelFilter[]): string[] {
  if (labels.length === 0) return [];
  return labels.map((filter) => `${filter.label}${filter.op}${quotePromqlString(filter.value)}`);
}
