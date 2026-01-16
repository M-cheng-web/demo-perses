/**
 * 文件说明：DashboardService 契约
 *
 * 这是 UI/核心包访问 Dashboard 数据的唯一入口契约。实现层可对接本地 mock 或后端 HTTP，
 * 调用方不关心具体接口路径/DTO 细节。
 */
import type { Dashboard, DashboardListItem, ID } from '@grafana-fast/types';

/**
 * DashboardService（契约层）
 *
 * 设计意图：
 * - 这是 UI/核心包唯一依赖的“Dashboard 数据读写入口”
 * - 真实后端的 URL、请求方法、DTO 结构等都应被实现层吸收
 * - contracts 的方法名/语义尽量稳定：除非新增/删除能力，否则不轻易变动
 */
export interface DashboardService {
  /**
   * 加载单个 Dashboard
   * @param id Dashboard 唯一标识（可为 'default'）
   */
  loadDashboard: (id: ID) => Promise<Dashboard>;

  /**
   * 保存 Dashboard
   * - 注意：契约层只定义“保存”语义，不约束具体存储方式（本地、服务端、云端等）
   */
  saveDashboard: (dashboard: Dashboard) => Promise<void>;

  /**
   * 删除 Dashboard
   */
  deleteDashboard: (id: ID) => Promise<void>;

  /**
   * 列出 Dashboard（用于列表页）
   * - 返回轻量摘要，避免一次性拉取完整 JSON
   */
  listDashboards: () => Promise<DashboardListItem[]>;

  /**
   * 获取默认 Dashboard
   * - 典型用于“首次进入”或“空状态初始化”
   */
  getDefaultDashboard: () => Promise<Dashboard>;
}
