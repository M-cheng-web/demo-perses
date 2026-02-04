/**
 * @grafana-fast/utils
 *
 * 说明：
 * - 该包用于承载 monorepo 内多个子包都会用到的“纯工具”能力
 * - 为了避免循环依赖，这里尽量只放无业务语义的基础设施（bem/time/http/common/dom 等）
 *
 * 导出策略（单入口 + 命名空间）：
 * - 基础/通用能力：继续以具名 export 方式导出（便于 tree-shaking / 兼容旧代码）
 * - 领域/集中能力：额外提供短命名的“命名空间对象”（例如 http.xxx / promql.xxx / echarts.xxx）
 *   方便 IDE 提示与发现能力
 */

// ----------------------------
// Base (general-purpose)
// ----------------------------
export * from './bem';
export * from './time';
export * from './format';
export * from './color';
export * from './storage';
import { createPrefixedStorage } from './storage';
export * from './common';
export * from './object';
export * from './url';
export * from './dom/cssVar';
export * from './dom/scrollLock';
export * from './events/windowEvents';

// ----------------------------
// Storage
// ----------------------------
export const storage = {
  createPrefixed: createPrefixedStorage,
} as const;

// ----------------------------
// HTTP
// ----------------------------
export * from './http/fetchClient';
import {
  createFetchHttpClient,
  isHttpAbortError,
  isHttpError,
  isHttpTimeoutError,
  HttpAbortError,
  HttpError,
  HttpTimeoutError,
} from './http/fetchClient';

export const http = {
  createClient: createFetchHttpClient,
  isError: isHttpError,
  isTimeout: isHttpTimeoutError,
  isAbort: isHttpAbortError,
  HttpError,
  HttpTimeoutError,
  HttpAbortError,
} as const;

// ----------------------------
// DOM
// ----------------------------
import { isBrowser, readCssVar } from './dom/cssVar';
import { acquireScrollLock, lockBodyScroll, lockScroll, unlockBodyScroll, unlockScroll } from './dom/scrollLock';

export const dom = {
  isBrowser,
  readCssVar,
  acquireScrollLock,
  lockBodyScroll,
  unlockBodyScroll,
  lockScroll,
  unlockScroll,
} as const;

// ----------------------------
// URL
// ----------------------------
import { isAbsoluteUrl, joinUrl, normalizeBaseUrl, resolveEndpointUrl, toQueryString, withQuery } from './url';

export const url = {
  isAbs: isAbsoluteUrl,
  join: joinUrl,
  normalizeBase: normalizeBaseUrl,
  resolveEndpoint: resolveEndpointUrl,
  toQuery: toQueryString,
  withQuery,
} as const;

// ----------------------------
// ECharts (weak-typed helpers)
// ----------------------------
export * from './charts/echartsTheme';
import { getEChartsPalette, getEChartsTheme, getEChartsThemeForTarget } from './charts/echartsTheme';

export const echarts = {
  getPalette: getEChartsPalette,
  getTheme: getEChartsTheme,
  getThemeForTarget: getEChartsThemeForTarget,
} as const;

// ----------------------------
// PromQL / QueryBuilder
// ----------------------------
export * from './promql';
import {
  PromOperationId,
  PromQueryModeller,
  PromQueryPatternType,
  PromVisualQueryOperationCategory,
  getAggregationOperations,
  getOperationDefinitions,
  promQueryModeller,
} from './promql';

export const promql = {
  Modeller: PromQueryModeller,
  modeller: promQueryModeller,
  getOps: getOperationDefinitions,
  getAggs: getAggregationOperations,
  OperationId: PromOperationId,
  Category: PromVisualQueryOperationCategory,
  PatternType: PromQueryPatternType,
} as const;
