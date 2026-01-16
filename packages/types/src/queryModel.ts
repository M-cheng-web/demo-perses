/**
 * 查询模型（存储/传输层）
 *
 * 说明：
 * - 这里的类型用于 Dashboard JSON 持久化与跨页面传输
 * - 与 UI 内部的“可视化 QueryBuilder 模型”解耦
 */
import type { DatasourceType } from './datasource';
import type { ID } from './common';

/**
 * Datasource 轻量引用（用于 Dashboard JSON / 查询存储）
 * - uid: 用于唯一定位 datasource（mock/http/prom-direct 均可复用）
 * - type: datasource 类型（prometheus / influxdb / elasticsearch...）
 */
export interface DatasourceRef {
  type: DatasourceType;
  uid: ID;
}
