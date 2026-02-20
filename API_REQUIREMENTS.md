# API_REQUIREMENTS（Dashboard 后端接口需求，按功能模块）

目标：接口按此文档约定实现后，`@grafana-fast/dashboard` 可以在“只拉一次 Dashboard JSON + 局部增删改 + 失败回滚”的产品约束下完整跑通（含 QueryBuilder / 变量 / 查询执行）。

本文档特点：
- 不标注具体代码调用位置，只描述：场景/调用时机/用途/严格入参出参
- HTTP 路径与 `@grafana-fast/api` 默认 endpoints 对齐；如需对接现有服务路由，在 http 实现层集中映射
- 本期对接约定：
  - **所有接口统一使用 `POST` + JSON body**（`Content-Type: application/json`）
  - 不使用 URL path params 传递业务 id（panelId/groupId 等）
  - Dashboard 资源定位不使用 `dashboardId`：前端只持有 **`dashboardSessionKey`**，并通过 header `X-Dashboard-Session-Key` 传递（详见 B1）

## 0. 接口总览（Dashboard 子项目实际会用到）

> 说明：
> - Dashboard 子项目的所有网络请求都通过 `@grafana-fast/api`（HTTP 实现层）发出；以下清单与其默认 endpoints 对齐。
> - 本清单只列 dashboard 子项目实际会调用的接口（因此清单内全部都是必需接口）。

- Dashboard JSON（整盘）
  - `POST /dashboards/session/resolve`：根据宿主业务参数解析并签发 `dashboardSessionKey`（前端不知真实 dashboardId）
  - `POST /dashboards/load`：进入时加载整盘 `DashboardContent`（只拉一次；依赖 header `X-Dashboard-Session-Key`）
  - `POST /dashboards/save`：全量保存 `DashboardContent`（JSON 导入/应用后的持久化兜底；也用于“整盘覆盖保存”；依赖 header）
- 面板组 PanelGroup（局部写）
  - `POST /dashboards/panel-groups/create`：创建面板组
  - `POST /dashboards/panel-groups/update`：更新面板组元信息（标题/描述）
  - `POST /dashboards/panel-groups/delete`：删除面板组
  - `POST /dashboards/panel-groups/reorder`：面板组排序（拖拽）
- 面板 Panel（局部写）
  - `POST /dashboards/panels/create`：新增面板（生成 id）
  - `POST /dashboards/panels/update`：更新面板（编辑器保存）
  - `POST /dashboards/panels/delete`：删除面板
  - `POST /dashboards/panels/duplicate`：复制面板（生成新 id）
- 布局 Layout（局部写，分页固定 20/页）
  - `POST /dashboards/panel-groups/layout/patch-page`：提交“当前页全部面板”的 `{i,x,y,w,h}`（不是增量）
- 查询 Query（面板取数唯一入口）
  - `POST /queries/execute`：执行查询（面板渲染/刷新/时间变化/变量变化）
- 变量 Variables（query 型变量 options）
  - `POST /variables/values`：解析 query 型变量的 options（例如 `label_values(...)`）
- QueryBuilder 联想（Prometheus-like）
  - `POST /query/metrics`
  - `POST /query/label-keys`
  - `POST /query/label-values`

---

## A. 核心产品约束（必须满足）

1. **Dashboard JSON 只在进入时拉一次**：`POST /dashboards/load` 返回完整 `DashboardContent`；前端后续不做“全量自动保存/全量重新拉取”。
2. **所有编辑类操作采用 optimistic update + 失败回滚**：
   - 前端会先修改本地 JSON，再调用局部接口
   - 任一接口返回非 2xx / 超时 / 网络错误：前端会把本地 JSON 回滚到最近一次“远端确认快照”（synced snapshot）
   - 写接口原子性：**任何一个写接口要么全成功，要么不落库**
3. **面板组分页固定 20 条/页**（重要）：
   - UI 展示/编辑以 `panels[]` 的数组顺序做分页切片
   - 拖拽/缩放布局持久化时：前端每次只提交“当前页（最多 20 个面板）”的布局
4. **布局 patch 的提交规则**（重要）：
   - 触发拖拽/缩放时，前端提交的 `items` **必须包含当前页全部面板**的 `{panelId,x,y,w,h}`，而不是只提交变动项
   - 布局写入以“这一页提交的 items”为一个事务原子写入
5. **新增/复制面板的分页行为**（重要）：
   - 创建/复制接口成功后，前端会把该面板追加到本地 JSON，并**自动跳转到该组最后一页**
   - 新面板顺序语义：追加到该组 `panels[]` 末尾
6. **本期范围（明确不做，因此无需接口）**：
   - 不做并发控制（revision/etag/If-Match 等）
   - 不支持面板跨组移动、也不支持面板跨页移动（分页固定 20/页，切片基于 `panels[]` 顺序）

---

## B. 通用约定（所有模块通用）

### B1. 鉴权与上下文

本文档不约束鉴权/多租户的 header/cookie/session 形态；由宿主统一实现。
本文档只约束：接口 method/path/body/response/状态码与关键业务语义。

#### B1.1 DashboardSessionKey（资源定位，必需）

本期开始 **Dashboard 资源定位不再使用 `dashboardId`**（真实 id 不对前端暴露）。
前端只持有一个临时的 `dashboardSessionKey`，并在请求头中携带：

- Header: `X-Dashboard-Session-Key: <dashboardSessionKey>`

约束：

- 除 `POST /dashboards/session/resolve` 外，本文件内所有**会话内请求**都必须携带该 header（即使接口不在 `/dashboards/*` 路径下），包括：
  - Dashboard 资源读写：`/dashboards/*`
  - 查询执行：`/queries/*`
  - 变量 options 解析：`/variables/*`
  - QueryBuilder 联想：`/query/*`
- 后端通过 `dashboardSessionKey` 映射到真实 dashboard 资源并完成读写（并据此做权限校验与续租/过期控制）

#### B1.2 过期与续租（后端必须实现）

目标语义（偏用户体验）：

- `dashboardSessionKey` 的有效期 **默认最少 10 小时**
- 当用户持续操作时，应保持“不断线”：**1 小时内有操作则续 10 小时**

推荐实现（便于落地与测试）：

- 初次签发：`expiresAt = now + 10h`
- 续租（滑动续期 + 写入节流）：
  - 任意成功请求（含读/写）视为一次“操作”
  - 若 `now - lastRenewAt >= 1h`：则更新 `expiresAt = now + 10h`，并更新 `lastRenewAt = now`
  - 若小于 1h：不更新（避免高频写）
- 过期：当 `now > expiresAt`，后端必须对任意接口返回：
  - HTTP `401`
  - `ErrorResponse(error.code="DASHBOARD_SESSION_EXPIRED")`

#### B1.3 安全模型（本期约定，给后端提示）

`dashboardSessionKey` 属于“会话级访问 key”，语义更接近 **bearer token**：

- 本期 **不要求** 做来源绑定（IP / UA / 设备指纹 / referer 等）与 PoP（proof-of-possession）
- 安全依赖宿主鉴权（cookie / bearer token / 签名 header 等）+ HTTPS 传输
- 后端仍需基于鉴权上下文校验该用户是否可访问该 `dashboardSessionKey` 对应资源（否则仍可能被越权调用）
  - 若未来确实有“key 被复制到其它终端仍可用”的安全诉求，再在后端升级来源绑定/PoP 即可（不影响本文档主体流程）

### B2. 基础类型（契约）

```ts
type ID = string;
type DashboardSessionKey = string; // 真实 dashboardId 仅后端内部使用，不在 API 中出现

type TimestampMs = number;

type TimeRange = {
  // 允许两种形态：
  // 1) number：绝对时间戳（毫秒）
  // 2) string：相对时间（如 "now-1h" / "now"），由查询/变量解析服务解释
  from: number | string;
  to: number | string;
};
```

### B3. 错误返回（统一结构）

- 任意非 2xx 视为失败。
- 非 2xx 的 Response Body（JSON）：

```ts
type ErrorResponse = {
  error: {
    code: string; // e.g. "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | ...
    message: string;
    details?: any;
  };
};
```

### B4. 数组响应（严格）

- 当接口契约约定返回数组（例如 `QueryResult[]` / `string[]` / `Array<{text,value}>`）时：
  - 必须直接返回 **JSON Array**：`[...]`
  - 不要再额外包一层：`{ items: [...] }` / `{ data: [...] }` / `{ results: [...] }`
  - 返回包装结构一律视为契约错误（不做兼容）

---

## C. 模块：Dashboard Session（dashboardSessionKey）

### C1. 解析并签发 dashboardSessionKey（业务接口）

- Method: `POST`
- Path: `/dashboards/session/resolve`
- 场景/时机：
  - 宿主系统进入 dashboard 页面前（首次进入/刷新/切换业务上下文）
  - `dashboardSessionKey` 过期后，宿主/SDK 重新获取 sessionKey 并整盘重载
- 用途：
  - 根据宿主传入的一系列业务参数定位“真实 dashboard 资源”（真实 `dashboardId` 仅后端内部存在）
  - 必要时完成初始化（get-or-create），确保后续 `POST /dashboards/load` 必然可用
  - 签发并返回一个新的 `dashboardSessionKey`
- Request Body（严格）：

```ts
type ResolveDashboardSessionRequest = {
  /**
   * 业务自定义参数（保持自由度）
   *
   * 示例（仅示意）：
   * - { projectId, spaceId }
   * - { scene: "overview", tenantId }
   * - { dashboardTemplate: "cpu", cluster, namespace }
   */
  params: Record<string, any>;
};
```

- Response `200`：

```ts
type ResolveDashboardSessionResponse = {
  dashboardSessionKey: DashboardSessionKey;
};
```

- 约束：
  - `dashboardSessionKey` 必须是后端生成的 opaque string（不可被前端解析出真实 id）
  - 后端不得在任何 response 中返回真实 `dashboardId`
  - 该接口应负责“首次初始化”：避免前端通过 `404 → save → load` 的方式创建资源（前端无真实 id）

## D. 模块：Dashboard（JSON 资源）

### D1. 加载 Dashboard（只拉一次 JSON）

- Method: `POST`
- Path: `/dashboards/load`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：
  - 进入 dashboard 页面
  - 或切换 `dashboardSessionKey`
- 用途：获取完整 `DashboardContent`（前端后续所有展示/编辑都以此为单一真相来源）
- Request Body（严格）：

```ts
type LoadDashboardRequest = {};
```
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

  // options/transformations 属于“面板配置 JSON”，要求 round-trip（存什么回什么）
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

- Session Expired（严格）
  - 返回 `401` + `ErrorResponse(code="DASHBOARD_SESSION_EXPIRED")`
  - 说明：前端会重新调用 `POST /dashboards/session/resolve` 获取新的 `dashboardSessionKey` 并整盘重载（本期不要求自动重试触发请求）

- Not Found（严格）
  - 返回 `404` + `ErrorResponse(code="NOT_FOUND")`
  - 说明：正常情况下不应发生；首次初始化应由 `POST /dashboards/session/resolve` 完成（get-or-create）

- 约束：
  - `panelGroups[].panels[].id` 与 `panelGroups[].layout[].i` 一一对应（同一组内）
  - `panelGroups[].panels` 的数组顺序是分页与“新增/复制追加到末尾”的依据

### D2. 全量保存 Dashboard（兜底）

- Method: `POST`
- Path: `/dashboards/save`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：
  - 用户通过“导入 JSON（文件/粘贴）→ 应用”覆盖整盘配置（前端不提供在线编辑 JSON）
  - 需要“整盘覆盖保存”时
- 用途：把当前 `DashboardContent` 覆盖保存到远端
- Request Body：

```ts
type SaveDashboardRequest = {
  content: DashboardContent;
};
```
- Response：`204 No Content`
- 说明：日常拖拽/增删改面板不调用该接口（使用局部接口）
- 重要约束（导入兜底校验）：后端必须校验 `content` 未修改服务端管理/不可变字段（例如 panelGroupId/panelId 等）；若发现越权或非法变更，必须返回非 2xx 且不应用该 JSON。

---

## E. 模块：面板组 PanelGroup（局部编辑接口）

> 说明：PanelGroup 的“内容（panels/layout）”来自 `POST /dashboards/load` 的 `DashboardContent`；
> 面板组接口只负责元信息与结构性变更（增删改/排序），避免走全量 save。

### E1. 创建面板组

- Method: `POST`
- Path: `/dashboards/panel-groups/create`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
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
  - `group.id` 为服务端生成值
  - `group.panels` 与 `group.layout` 必须存在（空数组）
  - `group.order` 与 `panelGroups[]` 数组顺序一致，新 group 追加到末尾

### E2. 更新面板组元信息（标题/描述）

- Method: `POST`
- Path: `/dashboards/panel-groups/update`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：编辑面板组标题/描述保存
- Request Body：

```ts
type UpdatePanelGroupRequest = {
  groupId: ID;
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

- 约束：该接口只修改 `group.title/group.description`，不修改 `panels/layout/order`。

### E3. 删除面板组

- Method: `POST`
- Path: `/dashboards/panel-groups/delete`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：用户删除面板组
- Request Body：

```ts
type DeletePanelGroupRequest = {
  groupId: ID;
};
```
- Response：`204 No Content`
- 约束：删除该组时同时删除该组下的 `panels/layout`。

### E4. 面板组排序（拖拽排序）

- Method: `POST`
- Path: `/dashboards/panel-groups/reorder`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：用户拖拽调整面板组顺序并释放
- Request Body：

```ts
type ReorderPanelGroupsRequest = {
  order: ID[]; // panelGroupId 的顺序数组
};
```

- Response：`204 No Content`
- 约束：按该顺序更新 `panelGroups[]` 的数组顺序与每个 group 的 `order`。

---

## F. 模块：面板 Panel（局部编辑接口）

> 说明：面板的“配置”完全来自 Dashboard JSON（不再有“打开面板详情再拉面板配置”的接口）。
> 所谓“面板数据”统一由查询执行接口提供。

### F1. 新增面板（编辑态按钮：新增面板）

- Method: `POST`
- Path: `/dashboards/panels/create`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：
  - 面板组处于编辑态
  - 点击“新增面板”并在编辑器保存
- 用途：创建面板并生成新 `panelId`，返回完整 panel（layout 字段可省略）
- Request Body：

```ts
type CreatePanelRequest = {
  groupId: ID;
  // 前端发送“完整面板内容”（不含 id）
  panel: Omit<Panel, 'id'>;
};
```

- Response `200`：

```ts
type CreatePanelResponse = {
  panel: Panel; // 必须包含生成的 id
  layout?: PanelLayout;
};
```

- 关键约束（与分页逻辑强相关）：
  - 新面板的“顺序语义”必须是追加到该组 `panels[]` 末尾
  - 前端固定 20/页：若创建后总数从 20 → 21，前端会自动跳到第 2 页展示新面板

### F2. 更新面板（编辑器保存）

- Method: `POST`
- Path: `/dashboards/panels/update`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：面板编辑器点击“保存”
- Request Body：

```ts
type UpdatePanelRequest = {
  groupId: ID;
  panelId: ID;
  panel: Omit<Panel, 'id'>; // 前端发送“完整面板内容”（不含 id）
};
```

- Response `200`：

```ts
type UpdatePanelResponse = {
  panel: Panel; // 保存后的最终面板（含 id）
};
```

- 约束：面板内容 round-trip（前端保存什么，`POST /dashboards/load` 回来一致）。

### F3. 删除面板

- Method: `POST`
- Path: `/dashboards/panels/delete`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：用户点击删除面板并确认
- Request Body：

```ts
type DeletePanelRequest = {
  groupId: ID;
  panelId: ID;
};
```
- Response：`204 No Content`
- 约束：必须同时删除该面板对应的 layout 项（`layout[i==panelId]`）。

### F4. 复制面板

- Method: `POST`
- Path: `/dashboards/panels/duplicate`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：用户点击复制面板
- Request Body：

```ts
type DuplicatePanelRequest = {
  groupId: ID;
  panelId: ID;
};
```
- Response `200`：

```ts
type DuplicatePanelResponse = {
  panel: Panel; // 新面板（新 id）
  layout?: PanelLayout; // 可选：新面板初始布局
};
```

- 关键约束：
  - 新面板必须追加到 `panels[]` 末尾（保证分页与“跳到最后一页”一致）
  - 若响应未返回 layout，前端会在本地生成默认 layout

---

## G. 模块：布局 Layout（分页固定 20，局部 patch）

### G1. 更新面板组“当前页”布局（拖拽/缩放）

- Method: `POST`
- Path: `/dashboards/panel-groups/layout/patch-page`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：用户拖拽/缩放面板后停止（前端 debounce 合并）
- 用途：把“当前页（最多 20 个面板）”的布局持久化到远端
- Request Body（严格）：

```ts
type PatchPanelGroupLayoutPageRequest = {
  groupId: ID;
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
  - 把这一组 items 作为一个事务原子更新（避免部分成功导致前端回滚后与远端不一致）
- Response `200`：

```ts
type PatchPanelGroupLayoutPageResponse = {
  items?: PanelLayout[];
};
```

---

## H. 模块：查询执行 Query（面板取数的唯一入口）

### H1. 执行查询（面板渲染/刷新/时间变化/变量变化）

- Method: `POST`
- Path: `/queries/execute`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
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
  // 注意：前端不传 datasource 信息；由后端按租户/环境/默认配置选择查询数据源。

  expr: string; // PromQL（前端已完成变量插值）
  visualQuery?: Record<string, any>; // 可视化 QueryBuilder 模型（用于 QueryBuilder 反显与 round-trip）

  legendFormat?: string;
  minStep: number; // seconds
  format: 'time_series';
  instant: boolean;
  hide: boolean;
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
  - 单 query 失败：使用 `QueryResult.error` 返回错误信息，不影响同一批次的其他 query
  - 请求整体失败（鉴权失败/参数非法等）：返回非 2xx + `ErrorResponse`

---

## I. 模块：变量 Variables（query 型变量 options 解析）

> 变量定义在 Dashboard JSON（`DashboardContent.variables`）中；
> 前端会在初始化后、以及用户手动触发时刷新 query 型变量 options。

### I1. 解析 query 型变量 options

- Method: `POST`
- Path: `/variables/values`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：
  - Dashboard 初始化后（异步，不阻塞首屏）
  - 用户修改 timeRange/变量值并“应用设置”后（用于让 options 与当前时间范围保持一致）
- Request Body：

```ts
type FetchVariableValuesRequest = {
  /**
   * 变量查询表达式（例如 label_values(...)）
   *
   * 注意：expr 在请求前已完成变量插值（$var / ${var} / [[var]] 已被替换）。
   */
  expr: string;
  timeRange: TimeRange;
};
```

- Response `200`：

```ts
type FetchVariableValuesResponse = Array<{ text: string; value: string }>;
```

---

## J. 模块：QueryBuilder 联想（指标/标签）

这组接口用于“可视化 QueryBuilder”的联想提示。

### J1. 指标联想（metrics）

- Method: `POST`
- Path: `/query/metrics`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- Request Body（可选参数全部放 body；为空等价于默认列表）：

```ts
type FetchMetricsRequest = {
  search?: string;
};
```
- Response `200`：

```ts
type FetchMetricsResponse = string[];
```

- 场景/时机：
  - MetricSelector 打开时会预拉一次（`search` 为空）
  - 用户输入时（debounce）会带 `search`

### J2. Label Keys 联想

- Method: `POST`
- Path: `/query/label-keys`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- Request Body：

```ts
type FetchLabelKeysRequest = {
  metric: string;
};
```
- Response `200`：

```ts
type FetchLabelKeysResponse = string[];
```

### J3. Label Values 联想（支持 otherLabels 过滤）

- Method: `POST`
- Path: `/query/label-values`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- Request Body（严格）：

```ts
type FetchLabelValuesRequest = {
  metric: string; // 必填；若为空字符串，返回 400 + ErrorResponse(code="VALIDATION_ERROR")
  labelKey: string; // 必填
  otherLabels?: Record<string, string>; // 可选：其他 label 条件（前端会跳过含变量引用的条件）
};
```
- Response `200`：

```ts
type FetchLabelValuesResponse = string[];
```

- 约束：
  - 当前前端会跳过包含变量引用（如 `$var`）的 otherLabels 条件
