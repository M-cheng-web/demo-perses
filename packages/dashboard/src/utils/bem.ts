/**
 * dashboard 内部 BEM 工具
 *
 * 说明：
 * - 实现收敛到 @grafana-fast/utils（统一 BEM 行为/类型提示）
 * - 为保持 dashboard 历史样式前缀不变，这里固定使用 `namespace: 'dp'`
 */

import { createNamespace as _createNamespace } from '@grafana-fast/utils';
import type { BEM, CreateNamespaceOptions, Mod, Mods } from '@grafana-fast/utils';

export type { BEM, CreateNamespaceOptions, Mod, Mods };

const DASHBOARD_NAMESPACE = 'dp';

export function createNamespace(blockName: string): [string, BEM] {
  return _createNamespace(blockName, { namespace: DASHBOARD_NAMESPACE });
}
