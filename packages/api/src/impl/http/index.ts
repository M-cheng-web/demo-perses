/**
 * 文件说明：HTTP 实现入口
 *
 * 说明：
 * - 这里对外导出 createHttpApiClient（HTTP 实现）以及 fetch 封装与配置类型
 * - 内部实现按 service（dashboard/datasource/query/variable）拆分，便于后续接入真实后端时维护
 */

export * from './createHttpApiClient';
export * from './config';
export * from './endpoints';

/**
 * fetch 封装导出
 *
 * 说明：
 * - 这是 http 实现层的基础设施：baseURL、headers、超时/取消、错误归一化等
 * - 不会影响 contracts 的稳定性；未来接入真实后端时，将在 createHttpApiClient 内部使用
 */
export * from './fetchClient';
