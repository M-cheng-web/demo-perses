/**
 * 文件说明：面板插件选择器（@grafana-fast/panels）
 *
 * 这个包为宿主应用提供 `.all().exclude().insert().build()` 的链式 API，
 * 用于构建 PanelRegistry 并注入到 @grafana-fast/dashboard 运行时。
 */
import { createBuiltInPanelRegistry, createPanelRegistry, type PanelPlugin, type PanelRegistry } from '@grafana-fast/dashboard';

/**
 * @grafana-fast/panels
 *
 * 这是一个“面板插件选择器”的小工具包，解决两个问题：
 * 1) Dashboard 内置了一批基础面板（timeseries/stat/table/...），但宿主应用可能希望增删/替换
 * 2) 需要提供一个链式 API，让注册过程更直观：`.all().exclude(...).insert(...).build()`
 *
 * 注意：
 * - 这里不直接“加载插件代码”，只负责把 PanelPlugin 列表整理成 PanelRegistry
 * - 真正的面板渲染由 @grafana-fast/dashboard 根据 panel.type 在 registry 中查找组件完成
 */
function uniqByType(list: PanelPlugin[]): PanelPlugin[] {
  const map = new Map<string, PanelPlugin>();
  for (const p of list) {
    if (!p?.type) continue;
    map.set(p.type, p);
  }
  return Array.from(map.values());
}

/**
 * 面板插件选择器（链式 API）
 *
 * 用法示例：
 * ```ts
 * const registry = PanelPlugins
 *   .all()
 *   .exclude(['heatmap'])
 *   .insert({ type: 'x-company:topology', displayName: '拓扑图', component: TopologyPanel })
 *   .build()
 * ```
 */
export class PanelPluginSelector {
  private plugins: PanelPlugin[];

  constructor(initial: PanelPlugin[] = []) {
    this.plugins = [...initial];
  }

  /**
   * 从内置面板集合开始（@grafana-fast/dashboard 内置的基础面板）。
   * - 这是最常见的入口：先 all() 拿到默认能力，再按需 exclude/insert
   */
  static all(): PanelPluginSelector {
    const builtIn = createBuiltInPanelRegistry().list();
    return new PanelPluginSelector(builtIn);
  }

  /**
   * 插入（或替换）面板插件。
   * - 当 type 重复时：后插入的会覆盖之前的（方便宿主“替换内置实现”）
   */
  insert(plugin: PanelPlugin | PanelPlugin[]): PanelPluginSelector {
    const next = Array.isArray(plugin) ? plugin : [plugin];
    this.plugins = uniqByType([...this.plugins, ...next]);
    return this;
  }

  /**
   * 从选择结果中排除某些面板类型。
   * - 用于宿主应用“禁用某些内置面板”
   */
  exclude(types: string[] | string): PanelPluginSelector {
    const set = new Set(Array.isArray(types) ? types : [types]);
    this.plugins = this.plugins.filter((p) => !set.has(p.type));
    return this;
  }

  /**
   * 只保留指定类型的面板（白名单模式）。
   * - 典型用于“按产品线裁剪能力”
   */
  only(types: string[] | string): PanelPluginSelector {
    const set = new Set(Array.isArray(types) ? types : [types]);
    this.plugins = this.plugins.filter((p) => set.has(p.type));
    return this;
  }

  /**
   * 构建 PanelRegistry（最终给 @grafana-fast/dashboard runtime 消费）。
   * - build() 之后得到的是一个“查找器”：has/get/list
   */
  build(): PanelRegistry {
    return createPanelRegistry(this.plugins);
  }
}

/**
 * 对外暴露的入口对象。
 * - 保持 `PanelPlugins.all()` 这种调用形式，便于后续扩展更多 selector（例如 fromEmpty/fromBuiltInOnly 等）
 */
export const PanelPlugins = {
  all: () => PanelPluginSelector.all(),
};
