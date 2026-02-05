/**
 * @grafana-fast/api/mock
 *
 * mock 实现入口（仅在需要“本地 mock / 演示 / 回归”时显式引入）
 *
 * 重要：
 * - 主入口 `@grafana-fast/api` 不再默认导出 mock，避免生产构建把 mock 数据打包进来
 * - 建议宿主侧按需选择：开发环境/演示页面才 import 该入口
 */
export * from './impl/mock';
