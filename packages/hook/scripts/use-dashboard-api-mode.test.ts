import assert from 'node:assert/strict';
import { ref } from 'vue';
import type { GrafanaFastApiClient } from '@grafana-fast/api';
import type { Pinia } from '@grafana-fast/store';
import { resolveInitialApiMode, useDashboardApiMode } from '../src/sdk/useDashboardApiMode';

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    // eslint-disable-next-line no-console -- test script output is allowed
    console.log(`✓ ${name}`);
  } catch (error) {
    // eslint-disable-next-line no-console -- test script output is allowed
    console.error(`✗ ${name}`);
    throw error;
  }
}

function createPiniaStub(): Pinia {
  return {
    _s: new Map(),
    install: () => {},
  } as unknown as Pinia;
}

function createApiClient(kind: 'mock' | 'http' = 'mock'): GrafanaFastApiClient {
  return {
    kind,
    dashboard: {} as never,
    datasource: {} as never,
    variable: {} as never,
    query: {} as never,
  } as unknown as GrafanaFastApiClient;
}

await test('resolveInitialApiMode prefers configured and available mode', () => {
  const remote = createApiClient('http');

  assert.equal(resolveInitialApiMode({ apiClient: remote, defaultApiMode: 'remote' }, true), 'remote');
  assert.equal(resolveInitialApiMode({ apiClient: remote, defaultApiMode: 'mock' }, true), 'mock');
  assert.equal(resolveInitialApiMode({ apiClient: remote }, false), 'remote');
  assert.equal(resolveInitialApiMode({ defaultApiMode: 'mock' }, false), 'remote');
  assert.equal(resolveInitialApiMode({ enableMock: true, createMockApiClient: async () => createApiClient('mock') }, true), 'mock');
});

await test('applyApiMode attaches runtime api client and remounts once', async () => {
  const remote = createApiClient('http');
  const mock = createApiClient('mock');
  const pinia = createPiniaStub();
  const isMounted = ref(true);

  let attachedClient: GrafanaFastApiClient | null = null;
  let disposeCount = 0;
  let mountCount = 0;
  let unmountCount = 0;

  const apiMode = useDashboardApiMode({
    sdkOptions: {
      apiClient: remote,
      enableMock: true,
      createMockApiClient: async () => mock,
      defaultApiMode: 'remote',
    },
    pinia,
    runtimeBindings: {
      attachApiClient: (_pinia, client) => {
        attachedClient = client;
      },
      disposeQueryScheduler: () => {
        disposeCount++;
      },
    },
    isDashboardMounted: isMounted,
    mountDashboard: () => {
      mountCount++;
    },
    unmountDashboard: () => {
      unmountCount++;
    },
  });

  await apiMode.applyApiMode('mock');
  assert.equal(apiMode.apiMode.value, 'mock');
  assert.equal(apiMode.activeApiClient.value?.kind, 'mock');
  assert.ok(attachedClient);
  assert.equal((attachedClient as GrafanaFastApiClient).kind, 'mock');
  assert.equal(disposeCount, 1);
  assert.equal(unmountCount, 1);
  assert.equal(mountCount, 1);
});

await test('requestApiModeChange ignores duplicate requests while switching', async () => {
  const remote = createApiClient('http');
  const mock = createApiClient('mock');
  const pinia = createPiniaStub();

  let createMockCount = 0;
  let resolveMock!: () => void;
  const mockGate = new Promise<void>((resolve) => {
    resolveMock = () => resolve();
  });

  const apiMode = useDashboardApiMode({
    sdkOptions: {
      apiClient: remote,
      enableMock: true,
      createMockApiClient: async () => {
        createMockCount++;
        await mockGate;
        return mock;
      },
      defaultApiMode: 'remote',
    },
    pinia,
    runtimeBindings: {
      attachApiClient: () => {},
      disposeQueryScheduler: () => {},
    },
    isDashboardMounted: ref(false),
    mountDashboard: () => {},
    unmountDashboard: () => {},
  });

  const first = apiMode.requestApiModeChange('mock');
  const second = apiMode.requestApiModeChange('mock');
  assert.equal(apiMode.apiSwitching.value, true);

  resolveMock();
  await Promise.all([first, second]);

  assert.equal(createMockCount, 1);
  assert.equal(apiMode.apiMode.value, 'mock');
  assert.equal(apiMode.apiSwitching.value, false);
});
