/**
 * @grafana-fast/api 包入口
 *
 * 分层说明：
 * - contracts：接口契约层（稳定对外暴露面）
 * - impl：实现层（mock/http/prometheus-direct）
 *
 * 推荐用法：
 * - UI/核心包只依赖 contracts 暴露的能力（通过 createXxxApiClient() 得到 client）
 * - 后端未就绪时使用 mock；后续切换实现层时，调用方方法名保持一致
 */
export * from './contracts';
export * from './impl/mock';
export * from './impl/http';
export * from './impl/prometheusDirect';
