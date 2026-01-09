import { computed, reactive, toRef, type App, type Ref } from 'vue';

export interface Pinia {
  _s: Map<string, any>;
  install: (app: App) => void;
}

let activePinia: Pinia | undefined;

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

export const setActivePinia = (pinia?: Pinia) => {
  activePinia = pinia;
};

export const getActivePinia = () => activePinia;

type StateTree = Record<string, any>;
type StoreGetter<S extends StateTree> = (state: S) => any;

type StoreAction<S extends StateTree> = (this: S & Record<string, any>, ...args: any[]) => any;

export interface DefineStoreOptions<S extends StateTree, A extends Record<string, StoreAction<S>>, G extends Record<string, StoreGetter<S>>> {
  state: () => S;
  actions?: A;
  getters?: G;
}

export function defineStore<
  Id extends string,
  S extends StateTree,
  A extends Record<string, StoreAction<S>> = Record<string, StoreAction<S>>,
  G extends Record<string, StoreGetter<S>> = Record<string, StoreGetter<S>>,
>(id: Id, options: DefineStoreOptions<S, A, G>) {
  return (pinia?: Pinia) => {
    const targetPinia = pinia ?? activePinia ?? createPinia();
    if (!activePinia) {
      activePinia = targetPinia;
    }

    if (targetPinia._s.has(id)) {
      return targetPinia._s.get(id) as S & A & G;
    }

    const state = reactive(options.state()) as S;
    const store: any = state;
    store.$id = id;
    store.$state = state;

    // attach getters as computed properties
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

    // bind actions to store instance
    if (options.actions) {
      Object.keys(options.actions).forEach((key) => {
        const action = options.actions?.[key];
        if (action) {
          store[key] = (...args: any[]) => action.apply(store, args);
        }
      });
    }

    targetPinia._s.set(id, store);
    return store as S & A & G;
  };
}

export function storeToRefs<T extends Record<string, any>>(store: T): Record<string, Ref<any>> {
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

  return refs;
}
