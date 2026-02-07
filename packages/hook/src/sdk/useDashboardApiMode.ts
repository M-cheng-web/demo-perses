import { computed, ref, type Ref } from 'vue';
import type { GrafanaFastApiClient } from '@grafana-fast/api';
import type { Pinia } from '@grafana-fast/store';
import type { DashboardSdkOptions } from './types';

export type ApiMode = 'remote' | 'mock';

export interface ApiModeRuntimeBindings {
  attachApiClient: (pinia: Pinia, api: GrafanaFastApiClient) => void;
  disposeQueryScheduler: (pinia: Pinia) => void;
}

interface UseDashboardApiModeOptions {
  sdkOptions: DashboardSdkOptions;
  pinia: Pinia;
  runtimeBindings: ApiModeRuntimeBindings;
  isDashboardMounted: Ref<boolean>;
  mountDashboard: () => void;
  unmountDashboard: () => void;
  onApplied?: () => void;
}

export const resolveInitialApiMode = (sdkOptions: DashboardSdkOptions, isMockEnabled: boolean): ApiMode => {
  const preferred = sdkOptions.defaultApiMode;
  const hasRemote = Boolean(sdkOptions.apiClient);

  if (preferred === 'mock') {
    return isMockEnabled ? 'mock' : 'remote';
  }
  if (preferred === 'remote') {
    return hasRemote ? 'remote' : isMockEnabled ? 'mock' : 'remote';
  }
  // Default strategy: remote first, then mock.
  return hasRemote ? 'remote' : isMockEnabled ? 'mock' : 'remote';
};

export function useDashboardApiMode(options: UseDashboardApiModeOptions) {
  const { sdkOptions, runtimeBindings } = options;
  const remoteApiClient = sdkOptions.apiClient;
  const isMockEnabled = sdkOptions.enableMock === true && typeof sdkOptions.createMockApiClient === 'function';

  const apiSwitching = ref(false);
  const apiMode = ref<ApiMode>(resolveInitialApiMode(sdkOptions, isMockEnabled));
  const activeApiClient = ref<GrafanaFastApiClient | undefined>(remoteApiClient);
  const hasApiSource = Boolean(remoteApiClient) || isMockEnabled;

  let mockApiClientCache: GrafanaFastApiClient | null = null;

  const resolveApiClientForMode = async (mode: ApiMode): Promise<GrafanaFastApiClient> => {
    if (mode === 'remote') {
      if (!remoteApiClient) {
        throw new Error('[grafana-fast] Remote mode requires `apiClient`.');
      }
      return remoteApiClient;
    }

    if (!isMockEnabled || !sdkOptions.createMockApiClient) {
      throw new Error('[grafana-fast] Mock mode is disabled. Set `enableMock=true` and provide `createMockApiClient()`.');
    }

    if (mockApiClientCache) return mockApiClientCache;
    mockApiClientCache = await sdkOptions.createMockApiClient();
    return mockApiClientCache;
  };

  const applyApiMode = async (mode: ApiMode, opts: { remount?: boolean } = {}) => {
    const client = await resolveApiClientForMode(mode);
    activeApiClient.value = client;
    apiMode.value = mode;
    // Attach runtime deps to pinia so dashboard stores/scheduler can access it.
    runtimeBindings.attachApiClient(options.pinia, client);

    if (opts.remount !== false) {
      try {
        runtimeBindings.disposeQueryScheduler(options.pinia);
      } catch {
        // ignore
      }

      if (options.isDashboardMounted.value) {
        options.unmountDashboard();
        options.mountDashboard();
      }
    }

    options.onApplied?.();
  };

  const requestApiModeChange = async (mode: ApiMode) => {
    if (mode === apiMode.value) return;
    if (apiSwitching.value) return;

    apiSwitching.value = true;
    try {
      await applyApiMode(mode);
    } finally {
      apiSwitching.value = false;
    }
  };

  const apiModeOptions = computed(() => {
    if (sdkOptions.enableMock !== true) return undefined;
    return [
      { label: '远程', value: 'remote' as const, disabled: !remoteApiClient },
      { label: '本地 Mock', value: 'mock' as const, disabled: !isMockEnabled },
    ];
  });

  return {
    activeApiClient,
    apiMode,
    apiModeOptions,
    apiSwitching,
    hasApiSource,
    applyApiMode,
    requestApiModeChange,
  };
}
