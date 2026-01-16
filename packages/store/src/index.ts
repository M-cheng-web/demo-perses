/**
 * @grafana-fast/store
 *
 * 一个轻量级的 Pinia-like 状态管理实现，目标是：
 * - 让 dashboard/hooks 在不引入真实 Pinia 依赖的情况下，拥有“按 id 的 store 单例 + actions/getters + storeToRefs”
 * - 支持多实例隔离：同一页面挂载多个 Vue App（多个 dashboard）时，store 不应串到同一个全局实例
 *
 * 重要约定：
 * - 组件上下文内优先使用 `inject('pinia')` 获取当前实例（避免依赖全局 activePinia）
 * - 组件上下文外（例如纯模块作用域代码）仍可回退到 activePinia（由 createPinia.install/setActivePinia 设置）
 */
import { computed, getCurrentInstance, inject, reactive, toRef, type App, type ComputedRef, type Ref } from 'vue';

export interface Pinia {
  /**
   * store 容器：key 为 store id，value 为 store 实例
   */
  _s: Map<string, any>;
  /**
   * Vue 插件安装入口：会把 pinia 注入到 app.provide('pinia', pinia)
   */
  install: (app: App) => void;
}

let activePinia: Pinia | undefined;

function getInjectedPinia(): Pinia | undefined {
  // 仅在组件 setup/render 上下文中可用
  if (!getCurrentInstance()) return undefined;
  return inject('pinia', undefined) as Pinia | undefined;
}

/**
 * 创建一个 pinia 实例（轻量实现）
 */
export const createPinia = (): Pinia => {
  const pinia: Pinia = {
    _s: new Map(),
    install(app: App) {
      // 将当前 pinia 设为激活，供子组件使用
      setActivePinia(pinia);
      app.provide('pinia', pinia);
    },
  };
  return pinia;
};

/**
 * 设置全局激活 pinia（用于组件上下文外的兜底）
 */
export const setActivePinia = (pinia?: Pinia) => {
  activePinia = pinia;
};

/**
 * 获取当前激活 pinia
 * - 组件上下文内：优先 injected pinia（多实例隔离关键）
 * - 否则：回退到 activePinia
 */
export const getActivePinia = () => getInjectedPinia() ?? activePinia;

type StateTree = Record<string, any>;
type StoreGetter<S extends StateTree> = (state: S) => any;

type StoreAction = (...args: any[]) => any;

type StoreGettersResult<S extends StateTree, G extends Record<string, StoreGetter<S>>> = {
  [K in keyof G]: ReturnType<G[K]>;
};

type StoreInstance<S extends StateTree, A extends Record<string, StoreAction>, G extends Record<string, StoreGetter<S>>> = S &
  A &
  StoreGettersResult<S, G> & {
    $id: string;
    $state: S;
  };

export interface DefineStoreOptions<S extends StateTree, A extends Record<string, StoreAction>, G extends Record<string, StoreGetter<S>>> {
  state: () => S;
  actions?: A & ThisType<StoreInstance<S, A, G>>;
  getters?: G & ThisType<StoreInstance<S, A, G>>;
}

export function defineStore<
  Id extends string,
  S extends StateTree,
  A extends Record<string, StoreAction> = Record<string, StoreAction>,
  G extends Record<string, StoreGetter<S>> = Record<string, StoreGetter<S>>,
>(id: Id, options: DefineStoreOptions<S, A, G>) {
  return (pinia?: Pinia) => {
    // 目标优先级：显式传入 pinia > 组件注入 pinia > 全局 activePinia > 新建 pinia（兜底）
    const targetPinia = pinia ?? getInjectedPinia() ?? activePinia ?? createPinia();
    if (!activePinia) {
      activePinia = targetPinia;
    }

    if (targetPinia._s.has(id)) {
      return targetPinia._s.get(id) as StoreInstance<S, A, G>;
    }

    const state = reactive(options.state()) as S;
    const store: any = state;
    store.$id = id;
    store.$state = state;

    // 将 getters 挂到 store 上（以 computed 的形式暴露为只读属性）
    if (options.getters) {
      Object.keys(options.getters).forEach((key) => {
        const getter = options.getters?.[key];
        if (!getter) return;
        const c = computed(() => getter.call(store, store));
        Object.defineProperty(store, key, {
          enumerable: true,
          configurable: true,
          get: () => c.value,
        });
      });
    }

    // 将 actions 绑定到 store 实例（保证 this 指向 store）
    if (options.actions) {
      Object.keys(options.actions).forEach((key) => {
        const action = options.actions?.[key];
        if (action) {
          store[key] = (...args: any[]) => (action as any).apply(store, args);
        }
      });
    }

    targetPinia._s.set(id, store);
    return store as StoreInstance<S, A, G>;
  };
}

type StoreToRefsResult<T extends Record<string, any>> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: T[K] extends Ref<any> ? T[K] : T[K] extends ComputedRef<any> ? T[K] : Ref<T[K]>;
};

export function storeToRefs<T extends Record<string, any>>(store: T): StoreToRefsResult<T> {
  /**
   * 将 store 的 state/getters 变成 Ref（类似 Pinia 的 storeToRefs）
   * - 跳过 actions（函数）
   * - getter（通过 defineProperty 的 get）用 computed 包装
   * - 普通 state 用 toRef 包装
   */
  const refs: Record<string, Ref<any>> = {};
  const descriptors = Object.getOwnPropertyDescriptors(store);

  Object.keys(store).forEach((key) => {
    if (typeof store[key] === 'function') return;
    const descriptor = descriptors[key];
    if (descriptor && typeof descriptor.get === 'function') {
      refs[key] = computed(() => (store as any)[key]);
    } else {
      refs[key] = toRef(store as any, key);
    }
  });

  return refs as StoreToRefsResult<T>;
}
