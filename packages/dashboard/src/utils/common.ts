/**
 * dashboard 内部通用工具
 *
 * 说明：
 * - 实现收敛到 @grafana-fast/utils，避免在多个包内重复维护
 * - 该文件仅作为 dashboard 包内部的导出路径（/#+/utils/common）
 */

export {
  generateId,
  createPrefixedId,
  deepClone,
  deepCloneStructured,
  debounce,
  debounceCancellable,
  throttle,
  throttleCancellable,
  sleep,
  get,
  isEmpty,
  removeUndefined,
} from '@grafana-fast/utils';
