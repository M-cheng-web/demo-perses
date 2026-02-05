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
 * - mock 能力既可通过子入口 `@grafana-fast/api/mock` 引入，也可从主入口直接 import。
 * - 若你不希望生产构建打入 mock，请避免在生产代码中引用 `createMockApiClient`。
 */
export * from './contracts';
export * from './impl/http';
export * from './impl/mock';
