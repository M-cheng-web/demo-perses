/**
 * 文件说明：DatasourceService 契约
 *
 * 用于屏蔽数据源获取方式（mock/http）的差异，给 QueryRunner/QueryBuilder 提供统一入口。
 */
import type { Datasource, ID } from '@grafana-fast/types';

/**
 * DatasourceService（契约层）
 *
 * 设计意图：
 * - 屏蔽数据源获取方式的差异（mock / HTTP / 未来更多）
 * - UI 存储层用 datasourceRef（types 中的 DatasourceRef）引用数据源
 * - 具体“数据源详情字段结构/后端 DTO”变更，优先由实现层适配
 */
export interface DatasourceService {
  /**
   * 获取默认数据源
   * - Dashboard 未显式指定 datasourceRef 时，QueryRunner/实现层可选择默认数据源
   */
  getDefaultDatasource: () => Promise<Datasource>;

  /**
   * 通过 id 获取数据源（找不到返回 null）
   */
  getDatasourceById: (id: ID) => Promise<Datasource | null>;

  /**
   * 列出全部数据源
   */
  listDatasources: () => Promise<Datasource[]>;
}
