/**
 * dashboard 内部 BEM 工具
 *
 * 说明：
 * - 实现收敛到 @grafana-fast/utils（统一 BEM 行为/类型提示）
 * - dashboard 内部固定使用 `namespace: 'dp'`（用于样式命名空间隔离）
 */

import { createNamespace as _createNamespace } from '@grafana-fast/utils';
import type { BEM, CreateNamespaceOptions, Mod, Mods } from '@grafana-fast/utils';

export type { BEM, CreateNamespaceOptions, Mod, Mods };

const DASHBOARD_NAMESPACE = 'dp';

export function createNamespace(blockName: string): [string, BEM] {
  return _createNamespace(blockName, { namespace: DASHBOARD_NAMESPACE });
}
