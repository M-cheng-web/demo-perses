/**
 * json-editor 的 BEM 工具
 *
 * 说明：
 * - 真实实现收敛到 @grafana-fast/utils，避免多处重复实现导致行为差异
 * - json-editor 的 namespace 使用默认值（gf）
 */

export { createNamespace, DEFAULT_BEM_NAMESPACE, type BEM, type CreateNamespaceOptions, type Mod, type Mods } from '@grafana-fast/utils';
