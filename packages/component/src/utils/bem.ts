/**
 * BEM naming helper for the UI kit
 *
 * 注意：
 * - 真实实现收敛到 @grafana-fast/utils，避免多处重复实现导致行为细节不一致
 * - 这里保留原导出路径，避免组件内部 import 全量改动
 */

export { createNamespace, DEFAULT_BEM_NAMESPACE, type BEM, type CreateNamespaceOptions, type Mod, type Mods } from '@grafana-fast/utils';
