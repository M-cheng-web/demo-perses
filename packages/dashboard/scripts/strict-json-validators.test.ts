import assert from 'node:assert/strict';
import type { DashboardContent } from '@grafana-fast/types';
import { validateDashboardStrict } from '../src/utils/strictJsonValidators';

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

async function validateDashboard(value: unknown): Promise<string[]> {
  return await validateDashboardStrict('', value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const validDashboard = (): DashboardContent => ({
  schemaVersion: 1,
  name: 'test-dashboard',
  panelGroups: [
    {
      id: 'group-1',
      title: 'Group 1',
      description: '',
      isCollapsed: false,
      order: 0,
      panels: [
        {
          id: 'panel-1',
          name: 'CPU',
          description: '',
          type: 'timeseries',
          queries: [
            {
              id: 'query-1',
              refId: 'A',
              datasourceRef: { type: 'prometheus', uid: 'mock' },
              expr: 'up',
              format: 'time_series',
            },
          ],
          options: {},
        },
      ],
      layout: [{ i: 'panel-1', x: 0, y: 0, w: 24, h: 8 }],
    },
  ],
  timeRange: { from: 'now-1h', to: 'now' },
  refreshInterval: 0,
  variables: [
    {
      id: 'var-1',
      name: 'job',
      label: 'job',
      type: 'select',
      current: 'api',
      options: [{ text: 'api', value: 'api' }],
    },
  ],
});

await test('accepts a valid dashboard payload', async () => {
  const errors = await validateDashboard(validDashboard());
  assert.deepEqual(errors, []);
});

await test('rejects unsupported panel types', async () => {
  const dashboard = deepClone(validDashboard()) as DashboardContent;
  dashboard.panelGroups[0]!.panels[0]!.type = 'custom-panel' as DashboardContent['panelGroups'][number]['panels'][number]['type'];
  const errors = await validateDashboard(dashboard);
  assert.ok(errors.some((line) => line.includes('panelGroups[0].panels[0].type 不支持：custom-panel')));
});

await test('rejects malformed panel queries and negative refresh interval', async () => {
  const dashboard = deepClone(validDashboard()) as DashboardContent;
  dashboard.refreshInterval = -1;
  dashboard.panelGroups[0]!.panels[0]!.queries = {} as unknown as DashboardContent['panelGroups'][number]['panels'][number]['queries'];

  const errors = await validateDashboard(dashboard);
  assert.ok(errors.includes('dashboard.refreshInterval 不能为负数'));
  assert.ok(errors.includes('panelGroups[0].panels[0].queries 必须是数组'));
});

await test('rejects invalid variables payload and duplicate names', async () => {
  const dashboard = deepClone(validDashboard()) as DashboardContent;
  dashboard.variables = [
    {
      id: 'var-1',
      name: 'dup',
      label: 'dup',
      type: 'select',
      current: 'a',
      options: [{ text: 'a', value: 'a' }],
    },
    {
      id: 'var-2',
      name: 'dup',
      label: 'dup2',
      type: 'query',
      current: 123 as unknown as string,
      options: {} as unknown as Array<{ text: string; value: string }>,
    },
  ];

  const errors = await validateDashboard(dashboard);
  assert.ok(errors.some((line) => line.includes('dashboard.variables[1].name 重复：dup')));
  assert.ok(errors.some((line) => line.includes('dashboard.variables[1].current 在 multi=false 时必须是 string 或 string[]')));
  assert.ok(errors.some((line) => line.includes('dashboard.variables[1].options 必须是数组')));
});

await test('rejects non-array panelGroups payload', async () => {
  const dashboard = deepClone(validDashboard()) as DashboardContent;
  (dashboard as unknown as { panelGroups: unknown }).panelGroups = {};
  const errors = await validateDashboard(dashboard);
  assert.ok(errors.includes('dashboard.panelGroups 必须是数组'));
});
