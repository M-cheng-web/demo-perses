/**
 * mock DashboardService
 *
 * 说明：
 * - 提供一个默认 Dashboard（包含多面板/变量等），用于演示与回归验证
 * - 这里的返回结构是“规范化后的 Dashboard schemaVersion=1”
 * - 未来接后端时，只需要替换 dashboard.load/save 实现，不应影响 UI 调用
 */
import type { DashboardService } from '../../contracts';
import type {
  CreatePanelGroupRequest,
  CreatePanelGroupResponse,
  CreatePanelRequest,
  CreatePanelResponse,
  DeletePanelGroupRequest,
  DeletePanelRequest,
  DuplicatePanelRequest,
  DuplicatePanelResponse,
  PatchPanelGroupLayoutPageRequest,
  PatchPanelGroupLayoutPageResponse,
  ReorderPanelGroupsRequest,
  ResolveDashboardSessionRequest,
  ResolveDashboardSessionResponse,
  UpdatePanelGroupRequest,
  UpdatePanelGroupResponse,
  UpdatePanelRequest,
  UpdatePanelResponse,
} from '../../contracts/dashboard';
import type { CorePanelType, DashboardContent, DashboardListItem, DashboardSessionKey, Panel, PanelGroup, PanelLayout } from '@grafana-fast/types';
import { deepCloneStructured } from '@grafana-fast/utils';

function nowTs() {
  return Date.now();
}

function normalizeCanonicalQueriesInPlace(content: DashboardContent) {
  // Keep mock payload aligned with API_REQUIREMENTS + dashboard strict validators.
  // CanonicalQuery is the storage/transport model; the runtime assumes required fields are present.
  const DEFAULT_MIN_STEP = 15;

  for (const group of content.panelGroups ?? []) {
    for (const panel of group.panels ?? []) {
      for (const query of panel.queries ?? []) {
        const q = query as any;
        if (!q || typeof q !== 'object') continue;

        if (q.format !== 'time_series') q.format = 'time_series';
        if (typeof q.minStep !== 'number' || !Number.isFinite(q.minStep) || q.minStep <= 0) q.minStep = DEFAULT_MIN_STEP;
        if (typeof q.instant !== 'boolean') q.instant = false;
        if (typeof q.hide !== 'boolean') q.hide = false;
      }
    }
  }
}

let idSeq = 0;
function createMockId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-mock-${idSeq}`;
}

function getGroupOrThrow(content: DashboardContent, groupId: string): PanelGroup {
  const g = (content.panelGroups ?? []).find((it) => String(it.id) === String(groupId));
  if (!g) throw new Error(`[mockDashboardService] PanelGroup not found: ${String(groupId)}`);
  return g;
}

function getPanelOrThrow(group: PanelGroup, panelId: string): Panel {
  const p = (group.panels ?? []).find((it) => String(it.id) === String(panelId));
  if (!p) throw new Error(`[mockDashboardService] Panel not found: ${String(panelId)}`);
  return p;
}

function computeNewPanelLayout(group: PanelGroup, panelId: string): PanelLayout {
  const maxY = Math.max(...(group.layout ?? []).map((l) => Number(l.y ?? 0) + Number(l.h ?? 0)), 0);
  return { i: panelId, x: 0, y: maxY, w: 24, h: 8, minW: 6, minH: 4 };
}

function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    // LCG (deterministic, fast, good enough for mock variation)
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function buildPanelOptions(type: CorePanelType, rng: () => number): Panel['options'] {
  switch (type) {
    case 'timeseries':
      return {
        legend: { show: true, position: 'bottom' },
        format: { unit: 'percent', decimals: 2 },
        specific: { mode: rng() > 0.6 ? 'area' : 'line', stackMode: 'none', fillOpacity: rng() > 0.6 ? 0.22 : 0.08 },
      };
    case 'stat':
      return {
        format: { unit: 'percent', decimals: 2 },
        specific: { displayMode: 'value-and-name', orientation: 'vertical', textAlign: 'center', showTrend: true },
      };
    case 'bar':
      return {
        legend: { show: true, position: 'bottom' },
        format: { unit: 'percent', decimals: 2 },
        specific: { orientation: rng() > 0.75 ? 'horizontal' : 'vertical', barMode: rng() > 0.7 ? 'stack' : 'group' },
      };
    case 'pie':
      return {
        legend: { show: true, position: 'bottom' },
        format: { unit: 'percent', decimals: 2 },
        specific: { pieType: rng() > 0.65 ? 'doughnut' : 'pie', innerRadius: rng() > 0.65 ? 60 : 0, showPercentage: true },
      };
    case 'table':
      return {
        format: { unit: 'none', decimals: 2 },
        specific: { showPagination: false, pageSize: 10, sortable: true },
      };
    case 'gauge':
      return {
        format: { unit: 'percent', decimals: 2 },
        specific: { calculation: 'last', min: 0, max: 100, splitNumber: 5, pointer: { show: true, length: '65%', width: 4 } },
      };
    case 'heatmap':
      return {
        format: { unit: 'percent', decimals: 2 },
        specific: { colorScheme: 'blue', showValue: false, cellPadding: 1 },
      };
    default:
      return {};
  }
}

function buildGroupLayout(panels: Panel[], rng: () => number): PanelLayout[] {
  const TOTAL_COLS = 48;
  const wCandidates = [12, 12, 16, 24, 24, 48];
  const hCandidates = [6, 8, 8, 10, 12];

  const layout: PanelLayout[] = [];
  let rowX = 0;
  let rowY = 0;
  let rowMaxH = 0;

  for (const p of panels) {
    let w = pick(rng, wCandidates);
    let h = pick(rng, hCandidates);

    if (w >= 24 && rng() > 0.6) h += 2;
    if (w >= 48 && rng() > 0.5) h += 4;

    const remaining = TOTAL_COLS - rowX;
    if (w > remaining) {
      rowY += rowMaxH || 0;
      rowX = 0;
      rowMaxH = 0;
    }

    w = Math.min(w, TOTAL_COLS);
    layout.push({ i: p.id, x: rowX, y: rowY, w, h, minW: 8, minH: 4 });
    rowX += w;
    rowMaxH = Math.max(rowMaxH, h);

    if (rowX >= TOTAL_COLS) {
      rowY += rowMaxH || 0;
      rowX = 0;
      rowMaxH = 0;
    }
  }

  return layout;
}

function createFixedCpuGroup(): PanelGroup {
  const scopeSelector = '{cluster="$cluster",namespace=~"$namespace",service="$service",instance=~"$instance"}';
  return {
    id: 'group-1',
    title: 'CPU 监控',
    description: 'CPU 相关指标监控',
    isCollapsed: false,
    order: 0,
    panels: [
      {
        id: 'panel-1',
        name: 'CPU 使用率',
        type: 'timeseries',
        queries: [
	          {
	            id: 'q-1',
	            refId: 'A',
	            expr: `cpu_usage${scopeSelector}`,
	            legendFormat: 'CPU {{cpu}}',
	            format: 'time_series',
	            instant: false,
            hide: false,
            minStep: 15,
          },
        ],
        options: {
          legend: { show: true, position: 'bottom' },
          format: { unit: 'percent', decimals: 2 },
          specific: { mode: 'line', stackMode: 'none' },
        },
      },
      {
        id: 'panel-2',
        name: 'CPU 平均使用率',
        type: 'stat',
        queries: [
	          {
	            id: 'q-2',
	            refId: 'A',
	            expr: `avg(cpu_usage${scopeSelector})`,
	            format: 'time_series',
	            instant: false,
	            hide: false,
            minStep: 15,
          },
        ],
        options: {
          format: { unit: 'percent', decimals: 2 },
          specific: { displayMode: 'value-and-name', orientation: 'vertical', textAlign: 'center', showTrend: true },
        },
      },
      {
        id: 'panel-3',
        name: 'CPU 最大使用率',
        type: 'stat',
        queries: [
	          {
	            id: 'q-3',
	            refId: 'A',
	            expr: `max(cpu_usage${scopeSelector})`,
	            format: 'time_series',
	            instant: false,
	            hide: false,
            minStep: 15,
          },
        ],
        options: {
          format: { unit: 'percent', decimals: 2 },
          specific: { displayMode: 'value-and-name', orientation: 'vertical', textAlign: 'center', showTrend: true },
        },
      },
      {
        id: 'panel-4',
        name: 'CPU 使用率（副本）',
        type: 'timeseries',
        queries: [
	          {
	            id: 'q-4',
	            refId: 'A',
	            expr: `cpu_usage${scopeSelector}`,
	            legendFormat: 'CPU {{cpu}}',
	            format: 'time_series',
	            instant: false,
            hide: false,
            minStep: 15,
          },
        ],
        options: {
          legend: { show: true, position: 'bottom' },
          format: { unit: 'percent', decimals: 2 },
          specific: { mode: 'area', stackMode: 'none', fillOpacity: 0.25 },
        },
      },
      {
        id: 'panel-5',
        name: 'CPU 核心对比',
        type: 'bar',
        queries: [
	          {
	            id: 'q-5',
	            refId: 'A',
	            expr: `cpu_usage${scopeSelector}`,
	            format: 'time_series',
	            instant: false,
	            hide: false,
            minStep: 15,
          },
        ],
        options: {
          legend: { show: true, position: 'bottom' },
          format: { unit: 'percent', decimals: 2 },
          specific: { orientation: 'vertical' },
        },
      },
    ],
    layout: [
      { i: 'panel-1', x: 0, y: 0, w: 28, h: 8, minW: 12, minH: 6 },
      { i: 'panel-2', x: 28, y: 0, w: 10, h: 5, minW: 6, minH: 4 },
      { i: 'panel-3', x: 38, y: 0, w: 10, h: 5, minW: 6, minH: 4 },
      { i: 'panel-4', x: 0, y: 8, w: 28, h: 8, minW: 12, minH: 6 },
      { i: 'panel-5', x: 28, y: 8, w: 20, h: 11, minW: 8, minH: 6 },
    ],
  };
}

function createLargeGroup(): PanelGroup {
  const totalPanels = 1000;
  const rng = createRng(0x1a2b3c4d);
  const pickLocal = <T>(items: T[]): T => items[Math.floor(rng() * items.length)]!;
  const scopeSelector = '{cluster="$cluster",namespace=~"$namespace",service="$service",instance=~"$instance"}';

  const panels: Panel[] = Array.from({ length: totalPanels }).map((_, idx) => {
    const n = idx + 1;
    const id = `panel-big-${n}`;
    return {
      id,
      name: `Large Panel #${n}`,
      type: 'timeseries',
      queries: [
	        {
	          id: `q-big-${n}`,
	          refId: 'A',
	          expr: `cpu_usage${scopeSelector}`,
	          legendFormat: 'CPU {{cpu}}',
	          format: 'time_series',
	          instant: false,
          hide: false,
          minStep: 15,
        },
      ],
      options: {
        legend: { show: true, position: 'bottom' },
        format: { unit: 'percent', decimals: 2 },
        specific: { mode: 'line', stackMode: 'none' },
      },
    };
  });

  const TOTAL_COLS = 48;
  const wCandidates = [12, 12, 12, 16, 24, 48];
  const hCandidates = [6, 8, 8, 10, 12, 14];

  const layout: PanelLayout[] = [];
  let rowX = 0;
  let rowY = 0;
  let rowMaxH = 0;

  for (const p of panels) {
    let w = pickLocal(wCandidates);
    let h = pickLocal(hCandidates);

    if (w >= 24 && rng() > 0.6) h += 2;
    if (w >= 48 && rng() > 0.5) h += 4;

    const remaining = TOTAL_COLS - rowX;
    if (w > remaining) {
      rowY += rowMaxH || 0;
      rowX = 0;
      rowMaxH = 0;
    }

    w = Math.min(w, TOTAL_COLS);
    layout.push({ i: p.id, x: rowX, y: rowY, w, h, minW: 8, minH: 4 });
    rowX += w;
    rowMaxH = Math.max(rowMaxH, h);

    if (rowX >= TOTAL_COLS) {
      rowY += rowMaxH || 0;
      rowX = 0;
      rowMaxH = 0;
    }
  }

  return {
    id: 'group-large-1k',
    title: '大规模面板组（1k panels / 虚拟化 & 可视刷新验证）',
    description: '用于验证：只渲染/只刷新 viewport + 上下 0.5 屏；滚动时渐进刷新；避免请求风暴。',
    isCollapsed: true,
    order: 99,
    panels,
    layout,
  };
}

function createDefaultDashboardContent(dashboardKey: string): DashboardContent {
  const id = String(dashboardKey ?? '');
  // Demo helper: allow host app to switch to an "empty dashboard" by key.
  // - Used by packages/app DashboardView.vue to verify "dashboardSessionKey changes trigger full refresh".
  // - Any key containing "empty" will be treated as an empty dashboard (no panelGroups).
  if (id.toLowerCase().includes('empty')) {
    return {
      schemaVersion: 1,
      name: `Empty Dashboard（${id || '-'}）`,
      description: 'Mock empty dashboard for session switching demo',
      panelGroups: [],
      timeRange: { from: 'now-1h', to: 'now' },
      refreshInterval: 0,
      variables: [],
    };
  }

  const groupCount = 30;
  const panelsPerGroup = 30;
  const fixedGroups: PanelGroup[] = [createFixedCpuGroup(), createLargeGroup()];

  const panelTypes: CorePanelType[] = ['timeseries', 'stat', 'bar', 'pie', 'table', 'gauge', 'heatmap'];
  // mock 数据池目前对这些 expr 有稳定的返回（见 defaultDataPool.ts）
  const scopeSelector = '{cluster="$cluster",namespace=~"$namespace",service="$service",instance=~"$instance"}';
  const exprCandidates = [
    `cpu_usage${scopeSelector}`,
    `avg(cpu_usage${scopeSelector})`,
    `max(cpu_usage${scopeSelector})`,
    `memory_usage${scopeSelector}`,
    `up${scopeSelector}`,
    // window / rate demo (still matches cpu_usage in defaultDataPool)
    `avg(rate(cpu_usage${scopeSelector}[$window]))`,
  ];

  const remainingGroups = Math.max(0, groupCount - fixedGroups.length);
  const groups: PanelGroup[] = [
    ...fixedGroups,
    ...Array.from({ length: remainingGroups }).map((_, gi) => {
      // 前两个保留固定组，后续从 3 开始编号，避免与 group-1 冲突
      const groupIndex = gi + 3;
      const rng = createRng(0x9e3779b9 ^ (groupIndex * 2654435761));

      const panels: Panel[] = Array.from({ length: panelsPerGroup }).map((__, pi) => {
        const panelIndex = pi + 1;
        const type = panelTypes[(groupIndex + pi) % panelTypes.length]!;
        const expr = exprCandidates[(groupIndex * 7 + panelIndex * 3) % exprCandidates.length]!;
        const id = `g${groupIndex}-p${panelIndex}`;
        // 前端运行时约束：CanonicalQuery.format 必须为 "time_series"（见 API_REQUIREMENTS）。
        // Panel 的展示形态由 panel.type 决定，而不是 query.format。
        const format = 'time_series';

        return {
          id,
          name: `G${String(groupIndex).padStart(2, '0')} · ${type.toUpperCase()} · #${panelIndex}`,
          type,
          queries: [
	            {
	              id: `q-${id}`,
	              refId: 'A',
	              expr,
	              legendFormat: 'series {{instance}}',
	              format,
	              instant: false,
              hide: false,
              minStep: 15,
            },
          ],
          options: buildPanelOptions(type, rng),
        };
      });

      const layout = buildGroupLayout(panels, rng);

      return {
        id: `group-${groupIndex}`,
        title: `面板组 ${String(groupIndex).padStart(2, '0')}`,
        description: `Mock group #${groupIndex}（约 ${panelsPerGroup} panels，混合类型）`,
        isCollapsed: true,
        order: gi + fixedGroups.length,
        panels,
        layout,
      };
    }),
  ];

  return {
    schemaVersion: 1,
    name: `Mock Dashboard（${id}）`,
    description: 'Mock dashboard (built-in) for focus-layer/pagination/virtualization testing',
    panelGroups: groups,
    timeRange: { from: 'now-1h', to: 'now' },
    refreshInterval: 0,
    variables: [
      {
        id: 'var-cluster',
        name: 'cluster',
        label: '集群',
        type: 'select',
        options: [
          { text: 'prod-a', value: 'prod-a' },
          { text: 'prod-b', value: 'prod-b' },
          { text: 'staging', value: 'staging' },
        ],
        current: 'prod-a',
      },
      {
        id: 'var-namespace',
        name: 'namespace',
        label: '命名空间',
        type: 'query',
        query: 'label_values(up, namespace)',
        multi: true,
        options: [],
        current: ['default'],
      },
      {
        id: 'var-service',
        name: 'service',
        label: '服务',
        type: 'query',
        query: 'label_values(http_requests_total, job)',
        multi: false,
        options: [],
        current: 'api',
      },
      {
        id: 'var-instance',
        name: 'instance',
        label: '实例',
        type: 'query',
        query: 'label_values(up, instance)',
        multi: true,
        options: [],
        current: ['server-1'],
      },
      {
        id: 'var-window',
        name: 'window',
        label: '窗口',
        type: 'select',
        options: [
          { text: '1m', value: '1m' },
          { text: '5m', value: '5m' },
          { text: '10m', value: '10m' },
          { text: '15m', value: '15m' },
        ],
        current: '5m',
      },
    ],
  };
}

type StoredMockDashboard = { content: DashboardContent; createdAt: number; updatedAt: number };
type MockDashboardKey = string;

const dashboards = new Map<MockDashboardKey, StoredMockDashboard>();

type StoredMockSession = {
  dashboardKey: MockDashboardKey;
  issuedAt: number;
  expiresAt: number;
  lastRenewAt: number;
};

const sessions = new Map<DashboardSessionKey, StoredMockSession>();

const SESSION_MIN_TTL_MS = 10 * 60 * 60 * 1000;
const SESSION_RENEW_THROTTLE_MS = 60 * 60 * 1000;

class MockDashboardSessionExpiredError extends Error {
  code = 'DASHBOARD_SESSION_EXPIRED';

  constructor(message = '[mockDashboardService] Dashboard session expired') {
    super(message);
    this.name = 'MockDashboardSessionExpiredError';
  }
}

function resolveDashboardKeyFromParams(params: Record<string, any>): MockDashboardKey {
  const p = (params ?? {}) as Record<string, any>;
  const candidates = [p.mockDashboardKey, p.dashboardKey, p.key, p.id, p.dashboardId];
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  try {
    const json = JSON.stringify(params ?? {});
    if (json && json !== '{}' && json !== 'null') return `mock:${json}`;
  } catch {
    // ignore
  }
  return 'default';
}

function getOrCreate(dashboardKey: MockDashboardKey): StoredMockDashboard {
  const existing = dashboards.get(dashboardKey);
  if (existing) {
    normalizeCanonicalQueriesInPlace(existing.content);
    return existing;
  }
  const now = nowTs();
  const content = createDefaultDashboardContent(dashboardKey);
  normalizeCanonicalQueriesInPlace(content);
  const created: StoredMockDashboard = { content, createdAt: now, updatedAt: now };
  dashboards.set(dashboardKey, created);
  return created;
}

function touchSession(dashboardSessionKey: DashboardSessionKey): StoredMockSession {
  const session = sessions.get(dashboardSessionKey);
  if (!session) throw new MockDashboardSessionExpiredError('[mockDashboardService] Dashboard session not found');

  const now = nowTs();
  if (now > session.expiresAt) {
    sessions.delete(dashboardSessionKey);
    throw new MockDashboardSessionExpiredError();
  }

  // Sliding renewal with write throttling: at most once per hour.
  if (now - session.lastRenewAt >= SESSION_RENEW_THROTTLE_MS) {
    session.lastRenewAt = now;
    session.expiresAt = now + SESSION_MIN_TTL_MS;
    sessions.set(dashboardSessionKey, session);
  }

  return session;
}

function getEntryBySessionKey(dashboardSessionKey: DashboardSessionKey): StoredMockDashboard {
  const session = touchSession(dashboardSessionKey);
  return getOrCreate(session.dashboardKey);
}

export function createMockDashboardService(): DashboardService {
  return {
    async resolveDashboardSession(req: ResolveDashboardSessionRequest): Promise<ResolveDashboardSessionResponse> {
      const dashboardKey = resolveDashboardKeyFromParams(req.params);
      // Ensure the dashboard exists (get-or-create).
      getOrCreate(dashboardKey);

      const now = nowTs();
      const dashboardSessionKey = createMockId('dash-session');
      sessions.set(dashboardSessionKey, {
        dashboardKey,
        issuedAt: now,
        lastRenewAt: now,
        expiresAt: now + SESSION_MIN_TTL_MS,
      });

      return { dashboardSessionKey };
    },

    async loadDashboard(dashboardSessionKey: DashboardSessionKey): Promise<DashboardContent> {
      return getEntryBySessionKey(dashboardSessionKey).content;
    },
    async saveDashboard(dashboardSessionKey: DashboardSessionKey, content: DashboardContent): Promise<void> {
      const entry = getEntryBySessionKey(dashboardSessionKey);
      normalizeCanonicalQueriesInPlace(content);
      entry.content = content;
      entry.updatedAt = nowTs();
      dashboards.set(touchSession(dashboardSessionKey).dashboardKey, entry);
    },
    async deleteDashboard(dashboardSessionKey: DashboardSessionKey): Promise<void> {
      const session = touchSession(dashboardSessionKey);
      dashboards.delete(session.dashboardKey);
      sessions.delete(dashboardSessionKey);
    },
    async listDashboards(): Promise<DashboardListItem[]> {
      // Ensure there is always at least one dashboard for demo flows.
      getOrCreate('default');
      return Array.from(dashboards.entries()).map(([id, entry]) => ({
        id,
        name: entry.content.name,
        description: entry.content.description,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }));
    },
    async getDefaultDashboard(): Promise<DashboardContent> {
      return getOrCreate('default').content;
    },

    async patchPanelGroupLayoutPage(req: PatchPanelGroupLayoutPageRequest): Promise<PatchPanelGroupLayoutPageResponse> {
      const entry = getEntryBySessionKey(req.dashboardSessionKey);
      const content = entry.content;
      const group = getGroupOrThrow(content, String(req.groupId));

      // merge by i
      const byId = new Map<string, PanelLayout>();
      (group.layout ?? []).forEach((it) => byId.set(String(it.i), it));

      for (const it of req.items ?? []) {
        const key = String(it.i);
        const existing = byId.get(key);
        if (existing) {
          existing.x = Number(it.x ?? existing.x);
          existing.y = Number(it.y ?? existing.y);
          existing.w = Number(it.w ?? existing.w);
          existing.h = Number(it.h ?? existing.h);
          continue;
        }
        const created: PanelLayout = {
          i: it.i,
          x: Number(it.x ?? 0),
          y: Number(it.y ?? 0),
          w: Number(it.w ?? 24),
          h: Number(it.h ?? 8),
          minW: 6,
          minH: 4,
        };
        group.layout ??= [];
        group.layout.push(created);
        byId.set(key, created);
      }

      entry.updatedAt = nowTs();
      dashboards.set(touchSession(req.dashboardSessionKey).dashboardKey, entry);
      return { items: deepCloneStructured(group.layout ?? []) };
    },

    async createPanel(req: CreatePanelRequest): Promise<CreatePanelResponse> {
      const entry = getEntryBySessionKey(req.dashboardSessionKey);
      const content = entry.content;
      const group = getGroupOrThrow(content, String(req.groupId));

      const panelId = createMockId('panel');
      const base: Panel = {
        id: panelId,
        name: '新面板',
        type: 'timeseries',
        queries: [],
        options: {},
      };
      const panel: Panel = { ...base, ...(req.panel as any), id: panelId };
      group.panels ??= [];
      group.layout ??= [];
      group.panels.push(panel);

      const layout = computeNewPanelLayout(group, panelId);
      group.layout.push(layout);

      entry.updatedAt = nowTs();
      dashboards.set(touchSession(req.dashboardSessionKey).dashboardKey, entry);
      return { panel: deepCloneStructured(panel), layout: deepCloneStructured(layout) };
    },

    async updatePanel(req: UpdatePanelRequest): Promise<UpdatePanelResponse> {
      const entry = getEntryBySessionKey(req.dashboardSessionKey);
      const content = entry.content;
      const group = getGroupOrThrow(content, String(req.groupId));

      const idx = (group.panels ?? []).findIndex((p) => String(p.id) === String(req.panelId));
      if (idx < 0) throw new Error(`[mockDashboardService] Panel not found: ${String(req.panelId)}`);

      const next: Panel = { ...(group.panels[idx] as Panel), ...(req.panel as any), id: String(req.panelId) };
      group.panels[idx] = next;

      entry.updatedAt = nowTs();
      dashboards.set(touchSession(req.dashboardSessionKey).dashboardKey, entry);
      return { panel: deepCloneStructured(next) };
    },

    async deletePanel(req: DeletePanelRequest): Promise<void> {
      const entry = getEntryBySessionKey(req.dashboardSessionKey);
      const content = entry.content;
      const group = getGroupOrThrow(content, String(req.groupId));

      group.panels = (group.panels ?? []).filter((p) => String(p.id) !== String(req.panelId));
      group.layout = (group.layout ?? []).filter((it) => String(it.i) !== String(req.panelId));

      entry.updatedAt = nowTs();
      dashboards.set(touchSession(req.dashboardSessionKey).dashboardKey, entry);
    },

    async duplicatePanel(req: DuplicatePanelRequest): Promise<DuplicatePanelResponse> {
      const entry = getEntryBySessionKey(req.dashboardSessionKey);
      const content = entry.content;
      const group = getGroupOrThrow(content, String(req.groupId));

      const src = getPanelOrThrow(group, String(req.panelId));
      const nextId = createMockId('panel');
      const copied: Panel = { ...deepCloneStructured(src), id: nextId, name: `${src.name} (副本)` };
      group.panels ??= [];
      group.layout ??= [];
      group.panels.push(copied);

      const layout = computeNewPanelLayout(group, nextId);
      group.layout.push(layout);

      entry.updatedAt = nowTs();
      dashboards.set(touchSession(req.dashboardSessionKey).dashboardKey, entry);
      return { panel: deepCloneStructured(copied), layout: deepCloneStructured(layout) };
    },

    async updatePanelGroup(req: UpdatePanelGroupRequest): Promise<UpdatePanelGroupResponse> {
      const entry = getEntryBySessionKey(req.dashboardSessionKey);
      const content = entry.content;
      const group = getGroupOrThrow(content, String(req.groupId));
      group.title = String(req.group.title ?? group.title);
      group.description = req.group.description ?? group.description;
      entry.updatedAt = nowTs();
      dashboards.set(touchSession(req.dashboardSessionKey).dashboardKey, entry);
      return { group: deepCloneStructured(group) };
    },

    async createPanelGroup(req: CreatePanelGroupRequest): Promise<CreatePanelGroupResponse> {
      const entry = getEntryBySessionKey(req.dashboardSessionKey);
      const content = entry.content;
      content.panelGroups ??= [];
      const next: PanelGroup = {
        id: createMockId('group'),
        title: String(req.group.title ?? '新面板组'),
        description: req.group.description,
        isCollapsed: true,
        order: content.panelGroups.length,
        panels: [],
        layout: [],
      };
      content.panelGroups.push(next);
      entry.updatedAt = nowTs();
      dashboards.set(touchSession(req.dashboardSessionKey).dashboardKey, entry);
      return { group: deepCloneStructured(next) };
    },

    async deletePanelGroup(req: DeletePanelGroupRequest): Promise<void> {
      const entry = getEntryBySessionKey(req.dashboardSessionKey);
      const content = entry.content;
      content.panelGroups = (content.panelGroups ?? []).filter((g) => String(g.id) !== String(req.groupId));
      // re-index order
      (content.panelGroups ?? []).forEach((g, idx) => (g.order = idx));
      entry.updatedAt = nowTs();
      dashboards.set(touchSession(req.dashboardSessionKey).dashboardKey, entry);
    },

    async reorderPanelGroups(req: ReorderPanelGroupsRequest): Promise<void> {
      const entry = getEntryBySessionKey(req.dashboardSessionKey);
      const content = entry.content;
      const groups = content.panelGroups ?? [];

      const byId = new Map<string, PanelGroup>();
      for (const g of groups) byId.set(String(g.id), g);

      const used = new Set<string>();
      const next: PanelGroup[] = [];
      for (const id of req.order ?? []) {
        const key = String(id);
        const g = byId.get(key);
        if (!g) continue;
        if (used.has(key)) continue;
        used.add(key);
        next.push(g);
      }
      for (const g of groups) {
        const key = String(g.id);
        if (used.has(key)) continue;
        used.add(key);
        next.push(g);
      }

      next.forEach((g, idx) => (g.order = idx));
      content.panelGroups = next;

      entry.updatedAt = nowTs();
      dashboards.set(touchSession(req.dashboardSessionKey).dashboardKey, entry);
    },
  };
}
