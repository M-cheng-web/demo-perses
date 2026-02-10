# API_REQUIREMENTS（Dashboard 后端接口需求，按功能模块）

目标：后端按此文档实现接口后，`@grafana-fast/dashboard` 可以在“只拉一次 Dashboard JSON + 局部增删改 + 失败回滚”的产品约束下完整跑通（含 QueryBuilder / 变量 / 查询执行）。

本文档特点：
- 不标注具体代码调用位置，只描述：场景/调用时机/用途/严格入参出参
- HTTP 路径为建议值（与 `@grafana-fast/api` 默认 endpoints 保持一致）；如后端已有路径，可在 http 实现层集中映射
- 所有接口默认 JSON（`Content-Type: application/json`）

---

## A. 核心产品约束（必须满足）

1. **Dashboard JSON 只在进入时拉一次**：`GET /dashboards/:id` 返回完整 `DashboardContent`；前端后续不做“全量自动保存/全量重新拉取”。
2. **所有编辑类操作采用 optimistic update + 失败回滚**：
   - 前端会先修改本地 JSON，再调用局部接口
   - 任一接口返回非 2xx / 超时 / 网络错误：前端会把本地 JSON 回滚到最近一次“远端确认快照”（synced snapshot）
   - 因此后端必须保证：**任何一个写接口要么全成功，要么不落库（原子性）**
3. **面板组分页固定 20 条/页**（重要）：
   - UI 展示/编辑以 `panels[]` 的数组顺序做分页切片
   - 拖拽/缩放布局持久化时：前端每次只提交“当前页（最多 20 个面板）”的布局
4. **布局 patch 的提交规则**（重要）：
   - 触发拖拽/缩放时，前端提交的 `items` **必须包含当前页全部面板**的 `{panelId,x,y,w,h}`，而不是只提交变动项
   - 后端应以“这一页提交的 items”作为一个事务原子写入
5. **新增/复制面板的分页行为**（重要）：
   - 后端创建/复制成功后，前端会把该面板追加到本地 JSON，并**自动跳转到该组最后一页**
   - 为了保证行为一致，后端也应保证：新面板的顺序语义是“追加到该组末尾”
6. **本期范围（明确不做，因此无需接口）**：
   - 不做并发控制（revision/etag/If-Match 等）
   - 不支持面板跨组移动、也不支持面板跨页移动（分页固定 20/页，切片基于 `panels[]` 顺序）

---

## B. 通用约定（所有模块通用）

### B1. 鉴权与上下文

- 推荐 Header：
  - `Authorization: Bearer <token>`（或宿主自定义的 cookie/session 方式）
  - `X-Org-Id` / `X-Tenant-Id`（如你的后端有多租户需求）
- 本仓库前端不会强依赖某一种鉴权方式，但需要后端能区分用户与权限（只读/可编辑）。

### B2. 基础类型（建议按此实现）

```ts
type ID = string;
type DashboardId = string;

type TimestampMs = number;

type TimeRange = {
  // 允许两种形态：
  // 1) number：绝对时间戳（毫秒）
  // 2) string：相对时间（如 "now-1h" / "now"），由后端自行解释（变量接口会用到）
  from: number | string;
  to: number | string;
};

type DatasourceType = 'prometheus' | 'influxdb' | 'elasticsearch';

type DatasourceRef = {
  type: DatasourceType;
  uid: ID; // datasource id/uid
};
```

### B3. 错误返回（建议统一）

- 任意非 2xx 视为失败，前端会回滚本地 JSON。
- 建议错误体（便于排查）：

```ts
type ErrorResponse = {
  error: {
    code: string; // e.g. "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | ...
    message: string;
    details?: any;
  };
};
```

---

## C. 模块：用户/权限（宿主全局）

> 这部分通常不放进 `@grafana-fast/api` contracts，但产品落地必须要有。

### C1. 获取当前用户与权限

- Method: `GET`
- Path: `/me`（或 `/users/me`）
- 场景/时机：应用启动后、进入 Dashboard 前
- 用途：判定只读/可编辑、以及后端鉴权上下文是否准备好
- Response `200`：

```ts
type MeResponse = {
  id: ID;
  name?: string;
  permissions?: string[]; // e.g. ["dashboard:read","dashboard:write"]
  // 可选：后端也可以直接给一个布尔值
  canEditDashboard?: boolean;
};
```

### C2. 全局设置（可选）

- Method: `GET`
- Path: `/settings`
- 场景/时机：应用启动后（可并行于 /me）
- 用途：主题/时区/默认 dashboardId/特性开关
- Response `200`（示例）：

```ts
type SettingsResponse = {
  timezone?: string; // e.g. "Asia/Shanghai"
  theme?: 'light' | 'dark';
  defaultDashboardId?: DashboardId;
  featureFlags?: Record<string, boolean>;
};
```

---

## D. 模块：Dashboard（JSON 资源）

### D1. 加载 Dashboard（只拉一次 JSON）

- Method: `GET`
- Path: `/dashboards/:dashboardId`
- 场景/时机：
  - 进入 dashboard 页面
  - 或切换 dashboardId
- 用途：获取完整 `DashboardContent`（前端后续所有展示/编辑都以此为单一真相来源）
- Response `200`：

```ts
type DashboardContent = {
  schemaVersion: number;
  name: string;
  description?: string;

  timeRange: TimeRange;
  refreshInterval: number; // ms，0 表示不自动刷新

  panelGroups: PanelGroup[];

  variables?: DashboardVariable[];
};

type PanelGroup = {
  id: ID;
  title: string;
  description?: string;

  // 目前前端约定统一折叠（该字段仍会在 JSON 中出现，但 UI 不再维护其状态）
  isCollapsed: boolean;

  // 排序字段（与数组顺序一致）
  order: number;

  panels: Panel[];
  layout: PanelLayout[];
};

type PanelLayout = {
  i: ID; // panelId
  x: number;
  y: number;
  w: number;
  h: number;

  // 可选：约束（后端可原样存储并回传）
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
};

type CorePanelType = 'timeseries' | 'pie' | 'bar' | 'table' | 'stat' | 'gauge' | 'heatmap';

type Panel = {
  id: ID;
  name: string;
  description?: string;
  type: CorePanelType;

  queries: CanonicalQuery[];

  // options/transformations 属于“面板配置 JSON”，后端建议按 JSON Blob 原样存储与回传
  options: Record<string, any>;
  transformations?: Array<{ id: string; options?: Record<string, any> }>;
};

type DashboardVariable = {
  id: ID;
  name: string;
  label: string;
  type: 'select' | 'input' | 'constant' | 'query';

  query?: string;
  options?: VariableOption[];

  current: string | string[];
  multi?: boolean;
  includeAll?: boolean;
  allValue?: string;
};

type VariableOption = { text: string; value: string };
```

- 约束（后端必须保证）：
  - `panelGroups[].panels[].id` 与 `panelGroups[].layout[].i` 应能一一对应（缺失时前端会补，但最好后端确保一致）
  - `panelGroups[].panels` 的数组顺序是分页与“新增/复制追加到末尾”的依据

### D2. 全量保存 Dashboard（兜底）

- Method: `PUT`
- Path: `/dashboards/:dashboardId`
- 场景/时机：
  - 用户在 JSON 编辑器里“导入/应用 JSON”
  - 或未来需要“整盘覆盖保存”
- 用途：把当前 `DashboardContent` 覆盖保存到后端
- Request Body：`DashboardContent`
- Response：建议 `204 No Content`
- 注意：
  - 日常拖拽/增删改面板不会走这条（已改为局部接口）

### D3. Dashboard 列表（可选）

- Method: `GET`
- Path: `/dashboards`
- 场景/时机：列表页/选择器（演示站点可能用到）
- Response `200`：

```ts
type DashboardListItem = {
  id: DashboardId;
  name: string;
  description?: string;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
};
type ListDashboardsResponse = DashboardListItem[];
```

### D4. 默认 Dashboard（可选）

- Method: `GET`
- Path: `/dashboards/default`
- 场景/时机：空状态/首次进入（演示站点用）
- Response `200`：`DashboardContent`

### D5. 删除 Dashboard（可选）

- Method: `DELETE`
- Path: `/dashboards/:dashboardId`
- Response：建议 `204`

---

## E. 模块：面板组 PanelGroup（局部编辑接口）

> 说明：PanelGroup 的“内容（panels/layout）”来自 `GET /dashboards/:id` 的 JSON；
> 面板组接口只负责元信息与结构性变更（增删改/排序），避免走全量 save。

### E1. 创建面板组

- Method: `POST`
- Path: `/dashboards/:dashboardId/panel-groups`
- 场景/时机：用户点击“创建面板组”
- Request Body：

```ts
type CreatePanelGroupRequest = {
  group: {
    title: string;
    description?: string;
  };
};
```

- Response `200`：

```ts
type CreatePanelGroupResponse = {
  group: PanelGroup;
};
```

- 约束：
  - `group.id` 由后端生成
  - `group.panels` 与 `group.layout` 必须存在（空数组即可）
  - `group.order` 建议为“追加到末尾”的顺序（与前端一致）

### E2. 更新面板组元信息（标题/描述）

- Method: `PATCH`
- Path: `/dashboards/:dashboardId/panel-groups/:groupId`
- 场景/时机：编辑面板组标题/描述保存
- Request Body：

```ts
type UpdatePanelGroupRequest = {
  group: {
    title: string;
    description?: string;
  };
};
```

- Response `200`：

```ts
type UpdatePanelGroupResponse = {
  group: PanelGroup;
};
```

- 注意：后端不应在此接口里重排/重写 `panels/layout`（避免与前端本地状态冲突）。

### E3. 删除面板组

- Method: `DELETE`
- Path: `/dashboards/:dashboardId/panel-groups/:groupId`
- 场景/时机：用户删除面板组
- Response：建议 `204`
- 约束：应同时删除该组下的 panels/layout（或做级联删除）。

### E4. 面板组排序（拖拽排序）

- Method: `PATCH`
- Path: `/dashboards/:dashboardId/panel-groups/order`
- 场景/时机：用户拖拽调整面板组顺序并释放
- Request Body：

```ts
type ReorderPanelGroupsRequest = {
  order: ID[]; // panelGroupId 的顺序数组
};
```

- Response：建议 `204`
- 约束：后端应按该顺序更新每个 group 的 order（或等价规则）。

---

## F. 模块：面板 Panel（局部编辑接口）

> 说明：面板的“配置”完全来自 Dashboard JSON（不再有“打开面板详情再拉面板配置”的接口）。
> 所谓“面板数据”统一由查询执行接口提供。

### F1. 新增面板（编辑态按钮：新增面板）

- Method: `POST`
- Path: `/dashboards/:dashboardId/panel-groups/:groupId/panels`
- 场景/时机：
  - 面板组处于编辑态
  - 点击“新增面板”并在编辑器保存
- 用途：后端生成新 `panelId`，返回完整 panel（以及可选 layout）
- Request Body：

```ts
type CreatePanelRequest = {
  // 前端会发送 panel（不含 id）；后端可自行补默认值
  panel?: Partial<Omit<Panel, 'id'>>;
};
```

- Response `200`：

```ts
type CreatePanelResponse = {
  panel: Panel; // 必须包含后端生成的 id
  layout?: PanelLayout; // 可选：后端若生成/修正初始布局可回传
};
```

- 关键约束（与分页逻辑强相关）：
  - 新面板的“顺序语义”必须是追加到该组 `panels[]` 末尾
  - 前端固定 20/页：若创建后总数从 20 → 21，前端会自动跳到第 2 页展示新面板

### F2. 更新面板（编辑器保存）

- Method: `PUT`
- Path: `/dashboards/:dashboardId/panel-groups/:groupId/panels/:panelId`
- 场景/时机：面板编辑器点击“保存”
- Request Body：

```ts
type UpdatePanelRequest = {
  panel: Omit<Panel, 'id'>; // 前端发送“完整面板内容”（不含 id）
};
```

- Response `200`：

```ts
type UpdatePanelResponse = {
  panel: Panel; // 后端保存后的最终面板（含 id）
};
```

- 约束：后端应做字段白名单或 JSON blob 存储，但必须保持 round-trip（前端保存什么，后端能回传/加载一致）。

### F3. 删除面板

- Method: `DELETE`
- Path: `/dashboards/:dashboardId/panel-groups/:groupId/panels/:panelId`
- 场景/时机：用户点击删除面板并确认
- Response：建议 `204`
- 约束：必须同时删除该面板对应的 layout 项（`layout[i==panelId]`）。

### F4. 复制面板

- Method: `POST`
- Path: `/dashboards/:dashboardId/panel-groups/:groupId/panels/:panelId/duplicate`
- 场景/时机：用户点击复制面板
- Response `200`：

```ts
type DuplicatePanelResponse = {
  panel: Panel; // 新面板（新 id）
  layout?: PanelLayout; // 可选：新面板初始布局
};
```

- 关键约束：
  - 新面板必须追加到 `panels[]` 末尾（保证分页与“跳到最后一页”一致）
  - 若后端未返回 layout，前端会在本地生成默认 layout

---

## G. 模块：布局 Layout（分页固定 20，局部 patch）

### G1. 更新面板组“当前页”布局（拖拽/缩放）

- Method: `PATCH`
- Path: `/dashboards/:dashboardId/panel-groups/:groupId/layout`
- 场景/时机：用户拖拽/缩放面板后停止（前端 debounce 合并）
- 用途：把“当前页（最多 20 个面板）”的布局持久化到后端
- Request Body（严格）：

```ts
type PatchPanelGroupLayoutPageRequest = {
  items: Array<{
    i: ID; // panelId
    x: number; // grid units
    y: number; // grid units（全局 y，非页内 y）
    w: number; // grid units
    h: number; // grid units
  }>;
};
```

- 关键约束（必须满足）：
  - `items.length` ∈ `[1, 20]`
  - `items` 必须包含“当前页全部面板”的 layout（不是增量 patch）
  - 后端必须把这一组 items 作为一个事务原子更新（避免部分成功导致前端回滚后与后端不一致）
- Response `200`（可选回传最终 layout；不回传也允许）：

```ts
type PatchPanelGroupLayoutPageResponse = {
  // 可选：后端若做了 compact/冲突修正，可回传最终 layout 覆盖前端本地结果
  items?: PanelLayout[];
};
```

---

## H. 模块：查询执行 Query（面板取数的唯一入口）

### H1. 执行查询（面板渲染/刷新/时间变化/变量变化）

- Method: `POST`
- Path: `/queries/execute`
- 场景/时机：
  - 打开面板组后渲染可见面板
  - 用户点击刷新
  - timeRange 变化 / auto refresh tick
  - variables 值变化（前端先做插值再执行）
- Request Body：

```ts
type ExecuteQueriesRequest = {
  queries: CanonicalQuery[];
  context: QueryContext;
};

type CanonicalQuery = {
  id: ID; // 用于结果对齐（必须原样回传到 QueryResult.queryId）
  refId: string; // A/B/C...
  datasourceRef: DatasourceRef;

  expr: string; // PromQL（前端已完成变量插值）
  visualQuery?: Record<string, any>; // 可视化 QueryBuilder 模型（后端可忽略但建议原样存储）

  legendFormat?: string;
  minStep?: number; // seconds
  /**
   * 当前阶段约定：
   * - v1 只要求后端支持 time_series
   * - 若收到 table/heatmap，可返回 QueryResult.error 或按 time_series 处理（任选其一，但需稳定）
   */
  format?: 'time_series' | 'table' | 'heatmap';
  instant?: boolean;
  hide?: boolean;
};

type QueryContext = {
  timeRange: TimeRange;
  suggestedStepMs?: number;
};
```

- Response `200`（严格：与 queries 一一对应；顺序可不严格，但必须包含 queryId）：

```ts
type QueryResult = {
  queryId: ID; // 必须等于输入 CanonicalQuery.id
  refId?: string;
  expr: string;

  // v1 仅要求 time_series 结构（table/heatmap 暂不要求后端实现）
  data: Array<{
    metric: Record<string, string>;
    values: Array<[TimestampMs, number]>; // [ts,value]
  }>;

  error?: string; // 单 query 失败时填充（不要让整个接口 500）
  meta?: Record<string, any>;
};
type ExecuteQueriesResponse = QueryResult[];
```

- 行为约定：
  - 后端应尽量做到“单 query 错误不影响其他 query”：
    - 例如返回 `QueryResult.error`，而不是整批请求 500
  - 若请求整体不可用（鉴权失败/参数非法等），返回非 2xx 即可

---

## I. 模块：变量 Variables（query 型变量 options 解析）

> 变量定义在 Dashboard JSON（`DashboardContent.variables`）中；
> 前端会在初始化后、以及用户手动触发时刷新 query 型变量 options。

### I1. 解析 query 型变量 options

- Method: `POST`
- Path: `/variables/values`
- 场景/时机：
  - Dashboard 初始化后（异步，不阻塞首屏）
  - 用户修改 timeRange/变量值并“应用设置”后（用于让 options 与当前时间范围保持一致）
  - （可选增强）提供“刷新变量选项”按钮时
- Request Body：

```ts
type FetchVariableValuesRequest = {
  /**
   * 变量查询表达式（例如 label_values(...)）
   *
   * 推荐约定（与面板查询一致）：
   * - 前端会先用当前变量值对表达式做插值（$var / ${var} / [[var]]），再把最终 expr 发送给后端；
   * - 后端不需要理解/替换 $var 语法（避免后端重复实现插值规则）。
   */
  expr: string;
  timeRange: TimeRange;
  // 可选：若你的变量解析依赖 datasource，可加；前端实现层可映射
  datasourceRef?: DatasourceRef;
};
```

- Response `200`：

```ts
type FetchVariableValuesResponse = Array<{ text: string; value: string }>;
```

- 注意（现状/预留口子）：
  - 产品决策（已确认）：变量 options **需要**跟随 dashboard 当前 timeRange（更科学、更可解释）
  - 后端建议实现策略：
    - 支持 `TimeRange.from/to` 为相对时间字符串（如 `now-1h` / `now`）或绝对时间戳
    - 若 expr 语义不依赖时间（例如某些 label values 查询），可选择忽略 timeRange，但仍需接收该字段
  - 前端实现层现状：timeRange 仍可能是占位值（对接阶段会切换为真实 timeRange），因此后端实现请勿假定固定窗口

---

## J. 模块：QueryBuilder 联想（指标/标签）

> 说明：这组接口用于“可视化 QueryBuilder”的联想提示；
> 即便你暂时不实现 QueryBuilder，也建议先把接口预留出来（返回空数组即可），避免后续改动影响前端联调节奏。
>
> v1 约定：
> - 联想接口**不按 datasourceRef 区分**，默认按“当前/默认 Prometheus 数据源”返回即可
> - 未来如需要多数据源联想，可在 querystring 增加 `datasourceUid`（或改为 POST 带 body）

### J1. 指标联想（metrics）

- Method: `GET`
- Path: `/query/metrics`
- Query:
  - `search?: string`（可选；为空表示拉取默认列表）
- Response `200`：

```ts
type FetchMetricsResponse = string[];
```

- 场景/时机：
  - MetricSelector 打开时会预拉一次（`search` 为空）
  - 用户输入时（debounce）会带 `search`

### J2. Label Keys 联想

- Method: `GET`
- Path: `/query/label-keys`
- Query:
  - `metric: string`（必填）
- Response `200`：

```ts
type FetchLabelKeysResponse = string[];
```

### J3. Label Values 联想（支持 otherLabels 过滤）

- Method: `GET`
- Path: `/query/label-values`
- Query（严格）：
  - `metric: string`（必填；若为空字符串，建议直接返回空数组 `[]`，避免 Builder 初始态误触发报错）
  - `labelKey: string`（必填）
  - `otherLabels?: Record<string,string>`（可选；会被前端扁平化到 querystring）
    - 例如：`/query/label-values?metric=up&labelKey=job&instance=1.1.1.1:9100`
- Response `200`：

```ts
type FetchLabelValuesResponse = string[];
```

- 约束：
  - 后端需要区分保留参数（`metric`/`labelKey`）与其他标签条件（其余 querystring key/value）
  - 当前前端会跳过包含变量引用（如 `$var`）的 otherLabels 条件，避免误导后端

### J4.（可选增强）指标元数据

- 现状：前端 MetricsModal 里 type/help 为本地“模拟推断”，并非后端返回
- 若你希望真实展示，可新增：
  - `GET /query/metrics/meta?names=...` 或 `POST /query/metrics/meta`
  - 返回：`Array<{ name: string; type?: string; help?: string }>`
- 该接口当前前端未接入，仅作为产品增强建议。

---

## K. 模块：数据源 Datasource（可选但建议预留）

> 说明：当前 Dashboard 编辑器里 datasource 仍有 mock 默认值（`prometheus-mock`）。
> 若要做成完整产品，建议后端提供数据源列表/默认数据源，前端后续会接入选择器。

### K1. 获取默认数据源

- Method: `GET`
- Path: `/datasources/default`
- Response `200`：

```ts
type Datasource = {
  id: ID;
  name: string;
  type: 'prometheus' | 'influxdb' | 'elasticsearch';
  url: string;
  isDefault: boolean;
  description?: string;
  config?: Record<string, any>;
};
type GetDefaultDatasourceResponse = Datasource;
```

### K2. 列出全部数据源

- Method: `GET`
- Path: `/datasources`
- Response `200`：`Datasource[]`

### K3. 获取数据源详情

- Method: `GET`
- Path: `/datasources/:id`
- Response `200`：`Datasource`
- 找不到：建议 `404`
