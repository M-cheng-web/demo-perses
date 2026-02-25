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
              expr: 'up',
              minStep: 15,
              format: 'time_series',
              instant: false,
              hide: false,
            },
          ],
          options: {},
        },
      ],
      layout: [{ i: 'panel-1', x: 0, y: 0, w: 24, h: 8 }],
    },
  ],
});

await test('accepts a valid dashboard payload', async () => {
  const errors = await validateDashboard(validDashboard());
  assert.deepEqual(errors, []);
});

await test('allows unknown panel types (required fields only)', async () => {
  const dashboard = deepClone(validDashboard()) as DashboardContent;
  dashboard.panelGroups[0]!.panels[0]!.type = 'custom-panel' as DashboardContent['panelGroups'][number]['panels'][number]['type'];
  const errors = await validateDashboard(dashboard);
  assert.deepEqual(errors, []);
});

await test('rejects malformed panel queries and ignores extra fields', async () => {
  const dashboard = deepClone(validDashboard()) as DashboardContent & { refreshInterval?: number };
  dashboard.refreshInterval = 5_000;
  dashboard.panelGroups[0]!.panels[0]!.queries = {} as unknown as DashboardContent['panelGroups'][number]['panels'][number]['queries'];

  const errors = await validateDashboard(dashboard);
  assert.ok(errors.includes('panelGroups[0].panels[0].queries 必须是数组'));
  assert.ok(!errors.some((line) => line.includes('refreshInterval')));
});

await test('ignores dashboard.variables payload', async () => {
  const dashboard = deepClone(validDashboard()) as any;
  dashboard.variables = [
    {
      id: 'var-1',
      name: 'job',
      label: 'job',
      type: 'select',
      current: 'api',
      options: [{ text: 'api', value: 'api' }],
    },
  ];

  const errors = await validateDashboard(dashboard);
  assert.deepEqual(errors, []);
});

await test('rejects non-array panelGroups payload', async () => {
  const dashboard = deepClone(validDashboard()) as DashboardContent;
  (dashboard as unknown as { panelGroups: unknown }).panelGroups = {};
  const errors = await validateDashboard(dashboard);
  assert.ok(errors.includes('dashboard.panelGroups 必须是数组'));
});
