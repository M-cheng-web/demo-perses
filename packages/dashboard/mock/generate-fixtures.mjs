import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('packages/dashboard/mock');

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function makePanels({ count, idPrefix, heavy, heavyTextRepeat = 12 }) {
  const rng = createRng(0x12345678);

  const panels = [];
  for (let i = 1; i <= count; i++) {
    const id = `${idPrefix}-${i}`;

    const base = {
      id,
      name: `${heavy ? 'Heavy' : 'Import'} Panel #${i}`,
      type: 'timeseries',
      queries: [
        {
          id: `q-${id}`,
          refId: 'A',
          expr: heavy ? `sum(rate(container_cpu_usage_seconds_total{job=\"node\", instance=\"$instance\"}[5m])) by (cpu)` : 'cpu_usage',
          legendFormat: heavy ? 'CPU {{cpu}} / {{instance}}' : 'CPU {{cpu}}',
          format: 'time_series',
          instant: false,
          hide: false,
          minStep: 15,
        },
      ],
      options: {
        legend: { show: true, position: 'bottom' },
      },
    };

    if (heavy) {
      // extra config fields to increase JSON size and simulate real dashboards
      base.transformations = [
        { id: 'reduce', options: { reducers: ['lastNotNull', 'mean'], fields: '' } },
        { id: 'renameByRegex', options: { regex: '(.*)', renamePattern: '$1' } },
      ];
      base.fieldConfig = {
        defaults: {
          unit: 'percent',
          decimals: 2,
          min: 0,
          max: 100,
          thresholds: {
            mode: 'absolute',
            steps: [
              { color: 'green', value: null },
              { color: 'yellow', value: 70 },
              { color: 'red', value: 90 },
            ],
          },
        },
        overrides: Array.from({ length: 6 }).map((_, idx) => ({
          matcher: { id: 'byName', options: `series-${idx}` },
          properties: [
            { id: 'color', value: pick(rng, ['blue', 'green', 'red', 'orange', 'purple']) },
            { id: 'custom.lineWidth', value: 2 },
          ],
        })),
      };
      base.options = {
        ...base.options,
        tooltip: { mode: 'single', sort: 'desc' },
        display: { lineInterpolation: 'smooth', fillOpacity: 15, showPoints: 'auto' },
        annotations: {
          list: Array.from({ length: 5 }).map((_, ai) => ({
            name: `anno-${i}-${ai}`,
            datasource: 'prometheus',
            enable: true,
            expr: 'up == 0',
          })),
        },
        meta: {
          description: 'This is a heavy fixture to simulate large JSON payloads. '.repeat(Math.max(1, heavyTextRepeat)).trim(),
        },
      };
    }

    panels.push(base);
  }
  return panels;
}

function makeLayoutPacked({ panels, seed }) {
  const rng = createRng(seed);
  const TOTAL_COLS = 48;
  const wCandidates = [12, 12, 16, 24, 24, 48];
  const hCandidates = [6, 8, 8, 10, 12, 14];

  const layout = [];
  let rowX = 0;
  let rowY = 0;
  let rowMaxH = 0;

  for (const p of panels) {
    let w = pick(rng, wCandidates);
    let h = pick(rng, hCandidates);

    if (w >= 48 && rng() > 0.4) h += 4;
    if (w >= 24 && rng() > 0.7) h += 2;

    if (w > TOTAL_COLS - rowX) {
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

function makeLayoutVertical({ panels, seed }) {
  const rng = createRng(seed);
  const layout = [];
  let y = 0;
  for (const p of panels) {
    const h = pick(rng, [6, 8, 10, 12, 14, 18]);
    layout.push({ i: p.id, x: 0, y, w: 48, h, minW: 8, minH: 4 });
    y += h;
  }
  return layout;
}

function makeDashboard({ id, name, description, groups }) {
  const now = Date.now();
  return {
    schemaVersion: 1,
    id,
    name,
    description,
    panelGroups: groups,
    timeRange: { from: 'now-1h', to: 'now' },
    refreshInterval: 0,
    variables: [],
    createdAt: now,
    updatedAt: now,
  };
}

function writeJson(filename, obj) {
  const text = JSON.stringify(obj, null, 2) + '\n';
  const file = path.join(OUT_DIR, filename);
  fs.writeFileSync(file, text, 'utf8');
  const bytes = Buffer.byteLength(text, 'utf8');
  return { file, bytes };
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Huge fixtures can bloat the git repo quickly; keep them opt-in.
  // Usage:
  //   GF_GENERATE_HUGE_FIXTURES=1 node packages/dashboard/mock/generate-fixtures.mjs
  const generateHuge = process.env.GF_GENERATE_HUGE_FIXTURES === '1';

  const outputs = [];

  // small 9
  {
    const panels = makePanels({ count: 9, idPrefix: 'panel-import-small', heavy: false });
    const layout = makeLayoutPacked({ panels, seed: 0x11111111 });
    const d = makeDashboard({
      id: 'import-small-9',
      name: '导入测试 Dashboard（9 panels）',
      description: '小数据量：应不启用虚拟化，直接全量渲染',
      groups: [
        {
          id: 'group-import-small',
          title: '导入测试面板组（9 panels）',
          description: '用于验证：<=阈值直接全量渲染',
          isCollapsed: false,
          order: 0,
          panels,
          layout,
        },
      ],
    });
    outputs.push(writeJson('dashboard-import-small-9.json', d));
  }

  // threshold 10
  {
    const panels = makePanels({ count: 10, idPrefix: 'panel-import-threshold', heavy: false });
    const layout = makeLayoutPacked({ panels, seed: 0x22222222 });
    const d = makeDashboard({
      id: 'import-threshold-10',
      name: '导入测试 Dashboard（10 panels）',
      description: '等于阈值：应不启用虚拟化，直接全量渲染',
      groups: [
        {
          id: 'group-import-threshold',
          title: '导入测试面板组（10 panels）',
          description: '用于验证：=阈值不虚拟化',
          isCollapsed: false,
          order: 0,
          panels,
          layout,
        },
      ],
    });
    outputs.push(writeJson('dashboard-import-threshold-10.json', d));
  }

  // medium 60
  {
    const panels = makePanels({ count: 60, idPrefix: 'panel-import-medium', heavy: false });
    const layout = makeLayoutPacked({ panels, seed: 0x33333333 });
    const d = makeDashboard({
      id: 'import-medium-60',
      name: '导入测试 Dashboard（60 panels）',
      description: '中等数据量：应启用 VirtualList 分页/窗口化',
      groups: [
        {
          id: 'group-import-medium',
          title: '导入测试面板组（60 panels）',
          description: '用于验证：触底加载 + 窗口化渲染',
          isCollapsed: false,
          order: 0,
          panels,
          layout,
        },
      ],
    });
    outputs.push(writeJson('dashboard-import-medium-60.json', d));
  }

  // large 240 (same idea as previous file, but deterministic generation)
  {
    const panels = makePanels({ count: 240, idPrefix: 'panel-import', heavy: false });
    const layout = makeLayoutPacked({ panels, seed: 0x44444444 });
    const d = makeDashboard({
      id: 'import-large-240',
      name: '导入测试 Dashboard（240 panels）',
      description: '用于测试：导入大 JSON + VirtualList 渐进渲染 + 交互锁定',
      groups: [
        {
          id: 'group-import-large',
          title: '导入测试面板组（240 panels）',
          description: '大量 panels（随机大小），用于验证滚动/触底/窗口化渲染',
          isCollapsed: false,
          order: 0,
          panels,
          layout,
        },
      ],
    });
    outputs.push(writeJson('dashboard-import-large-240.json', d));
  }

  // vertical 240
  {
    const panels = makePanels({ count: 240, idPrefix: 'panel-import-vertical', heavy: false });
    const layout = makeLayoutVertical({ panels, seed: 0x55555555 });
    const d = makeDashboard({
      id: 'import-vertical-240',
      name: '导入测试 Dashboard（垂直 240 panels）',
      description: '极端布局：全部 w=48 垂直堆叠，用于验证高度估算/分页策略',
      groups: [
        {
          id: 'group-import-vertical',
          title: '导入测试面板组（垂直 240 panels）',
          description: '极端：全部垂直堆叠',
          isCollapsed: false,
          order: 0,
          panels,
          layout,
        },
      ],
    });
    outputs.push(writeJson('dashboard-import-vertical-240.json', d));
  }

  // multi groups 3x120
  {
    const groups = [];
    for (let gi = 1; gi <= 3; gi++) {
      const panels = makePanels({ count: 120, idPrefix: `panel-import-g${gi}`, heavy: false });
      const layout = makeLayoutPacked({ panels, seed: 0x60000000 + gi });
      groups.push({
        id: `group-import-${gi}`,
        title: `导入测试面板组 #${gi}（120 panels）`,
        description: '多组验证：每组独立 VirtualList/触底加载',
        isCollapsed: false,
        order: gi - 1,
        panels,
        layout,
      });
    }

    const d = makeDashboard({
      id: 'import-multi-groups-3x120',
      name: '导入测试 Dashboard（3 组 x 120 panels）',
      description: '多面板组场景：验证组间滚动/触底/窗口化行为',
      groups,
    });

    outputs.push(writeJson('dashboard-import-multi-groups-3x120.json', d));
  }

  // heavy 240
  {
    const panels = makePanels({ count: 240, idPrefix: 'panel-import-heavy', heavy: true, heavyTextRepeat: 12 });
    const layout = makeLayoutPacked({ panels, seed: 0x77777777 });
    const d = makeDashboard({
      id: 'import-heavy-240',
      name: '导入测试 Dashboard（heavy 240 panels）',
      description: '重配置：压测 JSON 体积/解析耗时/交互锁定提示',
      groups: [
        {
          id: 'group-import-heavy',
          title: '导入测试面板组（heavy 240 panels）',
          description: '每个 panel 配置更重（transformations/fieldConfig/annotations）',
          isCollapsed: false,
          order: 0,
          panels,
          layout,
        },
      ],
    });
    outputs.push(writeJson('dashboard-import-heavy-240.json', d));
  }

  // heavy 240 ~5MB
  if (generateHuge) {
    const panels = makePanels({ count: 240, idPrefix: 'panel-import-heavy-5mb', heavy: true, heavyTextRepeat: 350 });
    const layout = makeLayoutPacked({ panels, seed: 0x78787878 });
    const d = makeDashboard({
      id: 'import-heavy-240-5mb',
      name: '导入测试 Dashboard（heavy 240 panels / ~5MB）',
      description: '重配置（更大体积）：用于模拟需要明显等待提示的导入场景',
      groups: [
        {
          id: 'group-import-heavy-5mb',
          title: '导入测试面板组（heavy 240 panels / ~5MB）',
          description: '每个 panel 配置更重（更长文本），用于压测导入 JSON 体积/解析耗时',
          isCollapsed: false,
          order: 0,
          panels,
          layout,
        },
      ],
    });
    outputs.push(writeJson('dashboard-import-heavy-240-5mb.json', d));
  }

  // heavy 240 ~10MB
  if (generateHuge) {
    const panels = makePanels({ count: 240, idPrefix: 'panel-import-heavy-10mb', heavy: true, heavyTextRepeat: 700 });
    const layout = makeLayoutPacked({ panels, seed: 0x79797979 });
    const d = makeDashboard({
      id: 'import-heavy-240-10mb',
      name: '导入测试 Dashboard（heavy 240 panels / ~10MB）',
      description: '超大配置：用于模拟弱网/低端机下的长等待导入场景',
      groups: [
        {
          id: 'group-import-heavy-10mb',
          title: '导入测试面板组（heavy 240 panels / ~10MB）',
          description: '每个 panel 配置超重（更长文本），用于验证 loading mask 与禁用交互稳定性',
          isCollapsed: false,
          order: 0,
          panels,
          layout,
        },
      ],
    });
    outputs.push(writeJson('dashboard-import-heavy-240-10mb.json', d));
  }

  // heavy 1000 >10MB (extreme scrolling)
  if (generateHuge) {
    // 240@repeat700 ~= 10MB -> scale down repeat for 1000 to keep size around 10~20MB
    const panels = makePanels({ count: 1000, idPrefix: 'panel-import-heavy-1k', heavy: true, heavyTextRepeat: 220 });
    const layout = makeLayoutPacked({ panels, seed: 0x8a8a8a8a });
    const d = makeDashboard({
      id: 'import-heavy-1000-10mb',
      name: '导入测试 Dashboard（heavy 1000 panels / >10MB）',
      description: '极限场景：1000 panels（重配置），用于验证虚拟滚动/窗口化渲染/触底加载与交互锁定稳定性',
      groups: [
        {
          id: 'group-import-heavy-1k',
          title: '导入测试面板组（heavy 1000 panels / >10MB）',
          description: '极限场景：1000 panels（重配置）',
          isCollapsed: false,
          order: 0,
          panels,
          layout,
        },
      ],
    });
    outputs.push(writeJson('dashboard-import-heavy-1000-10mb.json', d));
  }

  // print summary
  const summary = outputs.map((o) => `- ${path.basename(o.file)}: ${mb(o.bytes)}`).join('\n');
  console.log('Generated fixtures:');
  console.log(summary);
}

main();
