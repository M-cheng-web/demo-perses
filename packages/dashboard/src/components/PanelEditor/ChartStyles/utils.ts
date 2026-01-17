/**
 * 文件说明：ChartStyles 工具函数
 *
 * 这里主要提供深合并能力（deepMerge），用于把“默认 options”与“外部传入的 partial options”合并，
 * 避免浅合并导致嵌套字段丢失（例如 timeseries.specific.fillOpacity 变成 undefined）。
 */
export { deepMerge } from '@grafana-fast/utils';
