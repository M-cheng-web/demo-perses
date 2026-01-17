/**
 * dashboard 内部格式化工具
 *
 * 说明：
 * - 实现收敛到 @grafana-fast/utils，便于跨包复用与保持行为一致
 * - 该文件仅作为 dashboard 包内部的“稳定导出路径”（/#+/utils/format）
 */

export { formatValue, formatBytes, addThousandsSeparator, formatPercentage, truncateText } from '@grafana-fast/utils';
