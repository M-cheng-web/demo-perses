/**
 * @grafana-fast/api 包入口
 *
 * 分层说明：
 * - contracts：接口契约层（稳定对外暴露面）
 * - impl：实现层（http / mock / 其它）
 *
 * 推荐用法：
 * - UI/核心包只依赖 contracts 暴露的能力（通过 createXxxApiClient() 得到 client）
 *
 * 说明：
 * - 主入口仅导出 contracts + http 实现，避免生产构建意外打入 mock。
 * - mock 请通过子入口 `@grafana-fast/api/mock` 显式引入（用于本地演示/回归）。
 */
export * from './contracts';
export * from './impl/http';
