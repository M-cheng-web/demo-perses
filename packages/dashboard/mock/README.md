# Dashboard 导入测试 JSON（fixtures）

此目录用于存放“导入 JSON”功能的测试用 Dashboard 文件，便于验证：

- 大 JSON 导入时的全局 loading mask（锁交互/禁止滚动/禁止折叠）
- VirtualList 的分页加载、触底加载与窗口化渲染
- 极端布局（全部垂直/超大高度/多面板组）

## 文件说明

- `dashboard-import-small-9.json`
  - 9 个 panels（小数据量：应不启用虚拟化，直接全量渲染）
- `dashboard-import-threshold-10.json`
  - 10 个 panels（等于阈值：应不启用虚拟化，直接全量渲染）
- `dashboard-import-medium-60.json`
  - 60 个 panels（中等数据量：应启用 VirtualList 分页/窗口化）
- `dashboard-import-large-240.json`
  - 240 个 panels（大数据量：应出现“数据量较大”提示，并启用虚拟化）
- `dashboard-import-vertical-240.json`
  - 240 个 panels（极端：全部 `w=48` 垂直堆叠，验证自适应分页/高度估算）
- `dashboard-import-multi-groups-3x120.json`
  - 3 个面板组，每组 120 个 panels（验证多组的独立 VirtualList 行为）
- `dashboard-import-heavy-240.json`
  - 240 个 panels（每个 panel 配置更“重”，用于压测导入 JSON 体积/解析耗时）
- （可选）超大 fixtures（默认不生成）
  - `dashboard-import-heavy-240-5mb.json`
  - `dashboard-import-heavy-240-10mb.json`
  - `dashboard-import-heavy-1000-10mb.json`
  - 说明：这些文件体积很大（5~20MB），默认不纳入 git；需要时请按下方“生成方式”启用。

## 生成方式（可重复生成）

运行：

```bash
node packages/dashboard/mock/generate-fixtures.mjs
```

它会覆盖（重写）上述 json 文件，确保内容 deterministic（可复现）。

如需生成“超大 fixtures”（5~20MB），执行：

```bash
GF_GENERATE_HUGE_FIXTURES=1 node packages/dashboard/mock/generate-fixtures.mjs
```
