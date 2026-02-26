# API_REQUIREMENTS（Dashboard 后端接口需求，按功能模块）

目标：接口按此文档约定实现后，`@grafana-fast/dashboard` 可以在“只拉一次 Dashboard JSON + 局部增删改 + 失败回滚”的产品约束下完整跑通（含 QueryBuilder / 变量 / 查询执行）。

本文档特点：
- 不标注具体代码调用位置，只描述：场景/调用时机/用途/严格入参出参
- HTTP 路径与 `@grafana-fast/api` 默认 endpoints 对齐；如需对接现有服务路由，在 http 实现层集中映射

> 注意：本文档中的 path **不包含**前端默认的 `baseUrl=/api` 前缀。若宿主未改 baseUrl，则实际请求为：`/api{path}`。
- 对接约定：
  - **所有接口统一使用 `POST` + JSON body**（`Content-Type: application/json`）
  - **Body 统一为 JSON 对象**：即便无参数也发送 `{}`（不要省略请求体）
  - 不使用 URL path params 传递业务 id（panelId/groupId 等）
  - Dashboard 资源定位不使用 `dashboardId`：前端只持有 **`dashboardSessionKey`**，并通过 header `X-Dashboard-Session-Key` 传递（详见 B1）

## 0. 接口总览（Dashboard 子项目实际会用到）

> 说明：
> - Dashboard 子项目的所有网络请求都通过 `@grafana-fast/api`（HTTP 实现层）发出；以下清单与其默认 endpoints 对齐。
> - 本清单只列 dashboard 子项目实际会调用的接口（因此清单内全部都是必需接口）。

- Dashboard JSON（整盘）
  - `POST /dashboards/session/resolve`：根据宿主业务参数解析并签发 `dashboardSessionKey`（前端不知真实 dashboardId）
  - `POST /dashboards/load`：进入时加载整盘 `DashboardContent`
  - `POST /dashboards/save`：全量保存 `DashboardContent`（JSON 导入/应用后的持久化兜底；也用于“整盘覆盖保存”）
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
- 变量 Variables（后端全量下发，全局变量）
  - `POST /variables/load`：按 `dashboardSessionKey` 加载整份变量定义（含 options + 默认值）
  - `POST /variables/apply`：用户“应用设置”后把变量值回写并返回整份变量（后端可持久化默认值）
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
   - 除拖拽/缩放外：**新增 / 复制 / 删除面板成功后，前端也会对“所在页”补一次 `patch-page`**，把该页的最终布局作为真相提交给后端（后端无需推断 CRUD 引起的 layout 重排）
5. **新增/复制面板的分页行为**（重要）：
   - 创建/复制接口成功后，前端会把该面板追加到本地 JSON，并**自动跳转到该组最后一页**
   - 新面板顺序语义：追加到该组 `panels[]` 末尾
6. **明确不做（因此无需接口）**：
   - 不做并发控制（revision/etag/If-Match 等）
   - 不支持面板跨组移动、也不支持面板跨页移动（分页固定 20/页，切片基于 `panels[]` 顺序）

---

## B. 通用约定（所有模块通用）

### B1. 鉴权与上下文

本文档不约束鉴权/多租户的 header/cookie/session 形态；由宿主统一实现。
本文档只约束：接口 method/path/body/response/状态码与关键业务语义。

#### B1.1 DashboardSessionKey（资源定位，必需）

**Dashboard 资源定位不再使用 `dashboardId`**（真实 id 不对前端暴露）。
前端只持有一个临时的 `dashboardSessionKey`，并在请求头中携带：

- Header: `X-Dashboard-Session-Key: <dashboardSessionKey>`

约束：

- 除 `POST /dashboards/session/resolve` 外，本文件内所有接口都必须携带该 header（含查询/变量/QueryBuilder 等非 `/dashboards/*` 路径）。
- 后端以 `dashboardSessionKey` 作为“会话内资源定位”与权限/过期校验的上下文来源。
- 当 `dashboardSessionKey` 过期：后端对任意接口返回 `401` + `ErrorResponse(error.code="DASHBOARD_SESSION_EXPIRED")`。

### B2. 基础类型（契约）

```ts
type ID = string; // 后端生成的业务 ID（panelId/groupId/variableId 等）
type DashboardSessionKey = string; // 会话级资源定位 key（真实 dashboardId 仅后端内部使用，不在 API 中出现）

type TimestampMs = number; // 毫秒时间戳（Unix epoch, ms）

type TimeRange = {
  // 允许两种形态：
  // 1) number：绝对时间戳（毫秒）
  // 2) string：相对时间（如 "now-1h" / "now"），由查询/变量解析服务解释
  from: number | string; // 起始时间
  to: number | string; // 结束时间
};
```

### B3. 错误返回（统一结构）

- 任意非 2xx 视为失败。
- 非 2xx 的 Response Body（JSON）：

```ts
type ErrorResponse = {
  error: {
    code: string; // e.g. "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | ...
    message: string; // 人类可读错误信息（用于 toast/alert 展示）
    details?: any; // 可选：调试信息/字段级错误
  };
};
```

### B4. 数组响应（严格）

- 当接口契约约定返回数组（例如 `QueryResult[]` / `string[]` / `Array<{text,value}>`）时：
  - 必须直接返回 **JSON Array**：`[...]`
  - 不要再额外包一层：`{ items: [...] }` / `{ data: [...] }` / `{ results: [...] }`
  - 返回包装结构一律视为契约错误（不做兼容）

---

### B5. 状态码约定（建议）

- `200`：有 JSON 返回体
- `204 No Content`：无返回体（body 为空）
- `400`：参数非法（返回 `ErrorResponse`）
- `401`：sessionKey 失效（返回 `ErrorResponse(code="DASHBOARD_SESSION_EXPIRED")`）
- `404`：资源不存在（返回 `ErrorResponse(code="NOT_FOUND")`）

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
  params: Record<string, any>; // 宿主业务参数（透传给后端用于定位真实资源）
};
```

- Response `200`：

```ts
type ResolveDashboardSessionResponse = {
  dashboardSessionKey: DashboardSessionKey; // 后端签发的 sessionKey（后续请求通过 header 透传）
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
type LoadDashboardRequest = {}; // body 为空（资源定位完全依赖 header: X-Dashboard-Session-Key）
```
- Response `200`：

```ts
type DashboardContent = {
  schemaVersion: number; // Dashboard JSON schema 版本号（仅持久化）
  name: string; // Dashboard 名称
  description?: string; // Dashboard 描述

  panelGroups: PanelGroup[]; // 面板组列表
};

type PanelGroup = {
  id: ID; // 面板组 ID（服务端生成）
  title: string; // 面板组标题
  description?: string; // 面板组描述

  order: number; // 排序字段（与 panelGroups[] 数组顺序一致）

  panels: Panel[]; // 面板列表（数组顺序用于分页与新增/复制追加语义）
  layout: PanelLayout[]; // 该组所有面板的布局信息（i=panelId；patch-page 每次只更新“当前页”子集）
};

type PanelLayout = {
  i: ID; // panelId（必须与 panels[].id 一一对应）
  x: number; // grid x（单位：grid）
  y: number; // grid y（单位：grid，全局 y，非“页内 y”）
  w: number; // grid width（单位：grid）
  h: number; // grid height（单位：grid）
};

type CorePanelType = 'timeseries' | 'pie' | 'bar' | 'table' | 'stat' | 'gauge' | 'heatmap'; // 内置面板类型

type Panel = {
  id: ID; // 面板 ID（服务端生成）
  name: string; // 面板标题/名称
  description?: string; // 面板描述
  type: CorePanelType; // 面板类型

  queries: CanonicalQuery[]; // 查询列表（面板取数入口）

  // options/transformations 属于“面板配置 JSON”，要求 round-trip（存什么回什么）
  options: Record<string, any>; // 面板配置（要求 round-trip）
  transformations?: Array<{ id: string; options?: Record<string, any> }>; // 可选：数据变换链
};

type CanonicalQuery = {
  id: ID; // 查询 ID（用于结果对齐：QueryResult.queryId 必须等于它）

  expr: string; // PromQL（存储态；执行前前端会结合变量做插值）

  // 可选：可视化 QueryBuilder 模型（用于编辑器反显与 round-trip；不进入 /queries/execute）
  visualQuery?: Record<string, any>;

  // 以下字段属于“用户可配置项”，建议落库以保证反显一致；缺失时前端会补齐默认值
  legendFormat?: string; // 图例格式（如 {{instance}}）
  minStep?: number; // 最小步长（秒；缺失默认 15）
  format?: 'time_series'; // 返回格式（当前仅支持 time_series）
  instant?: boolean; // 是否 instant query（缺失默认 false）
  hide?: boolean; // 是否隐藏（缺失默认 false）
};

type DashboardVariable = {
  id: ID; // 变量 ID（用于 key；由后端决定是否稳定）
  name: string; // 变量名（用于 expr 插值，如 $cluster）
  label: string; // 展示名称
  type: 'select' | 'input' | 'constant' | 'query'; // 变量类型（决定渲染/插值策略）

  query?: string; // query 型变量：解析 options 的表达式（由实现层解释）
  options?: VariableOption[]; // 下拉选项列表（select/query 常用；后端全量下发）

  current: string | string[]; // 当前选中值（multi=true 时为数组）
  multi?: boolean; // 是否多选（多选通常在标签过滤里用 =~）
  includeAll?: boolean; // 是否包含 “All” 选项
  allValue?: string; // All 的实际值（常见：'.*'）
};

type VariableOption = {
  text: string; // 展示文本
  value: string; // 实际值（写入 current/用于插值）
};
```

> 说明（重要）：`timeRange` 与“自动刷新间隔”属于运行时全局状态，不存入 Dashboard JSON（`DashboardContent`）。
> - 前端会在每次加载/整盘重载时重置为默认值；
> - 查询执行会在请求里显式携带 `timeRange`（见 H 模块）。

- Session Expired（严格）
  - 返回 `401` + `ErrorResponse(code="DASHBOARD_SESSION_EXPIRED")`
  - 说明：前端会重新调用 `POST /dashboards/session/resolve` 获取新的 `dashboardSessionKey` 并整盘重载（不要求自动重试触发当前失败的请求）

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
  content: DashboardContent; // 要保存的整盘 Dashboard JSON
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
    title: string; // 面板组标题
    description?: string; // 面板组描述
  };
};
```

- Response `200`：

```ts
type CreatePanelGroupResponse = {
  group: PanelGroup; // 创建后的面板组（包含 id / panels / layout / order）
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
  groupId: ID; // 目标面板组 id
  group: {
    title: string; // 新标题
    description?: string; // 新描述
  };
};
```

- Response `200`：

```ts
type UpdatePanelGroupResponse = {
  group: PanelGroup; // 更新后的面板组（仅 title/description 变化；其他字段保持一致）
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
  groupId: ID; // 目标面板组 id
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
  order: ID[]; // panelGroupId 的顺序数组（拖拽后的最终顺序）
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
  groupId: ID; // 目标面板组 id
  // 前端发送“完整面板内容”（不含 id）
  panel: Omit<Panel, 'id'>; // 新面板内容（不含 id）
};
```

- Response `200`：

```ts
type CreatePanelResponse = {
  panel: Panel; // 新面板（必须包含生成的 id）
  layout?: PanelLayout; // 可选：新面板初始布局（若不返回，前端会生成默认布局并随后 patch-page）
};
```

- 关键约束（与分页逻辑强相关）：
  - 新面板的“顺序语义”必须是追加到该组 `panels[]` 末尾
  - 前端固定 20/页：若创建后总数从 20 → 21，前端会自动跳到第 2 页展示新面板
  - 创建成功后：前端会对“新面板所在页（通常为最后一页）”补一次 `POST /dashboards/panel-groups/layout/patch-page`，提交该页全部面板最终 layout（后端无需在 create 接口内推断/重排布局）

### F2. 更新面板（编辑器保存）

- Method: `POST`
- Path: `/dashboards/panels/update`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：面板编辑器点击“保存”
- Request Body：

```ts
type UpdatePanelRequest = {
  groupId: ID; // 面板组 id（用于定位所属组）
  panelId: ID; // 目标面板 id
  panel: Omit<Panel, 'id'>; // 面板完整内容（不含 id，要求 round-trip）
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
  groupId: ID; // 面板组 id
  panelId: ID; // 目标面板 id
};
```
- Response：`204 No Content`
- 约束：必须同时删除该面板对应的 layout 项（`layout[i==panelId]`）。
  - 删除成功后：前端会对“当前所在页”补一次 `POST /dashboards/panel-groups/layout/patch-page`，把删除后的最终布局提交给后端（用于锁定 compact/reflow 结果；后端无需自行推断）

### F4. 复制面板

- Method: `POST`
- Path: `/dashboards/panels/duplicate`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：用户点击复制面板
- Request Body：

```ts
type DuplicatePanelRequest = {
  groupId: ID; // 面板组 id
  panelId: ID; // 被复制的面板 id
};
```
- Response `200`：

```ts
type DuplicatePanelResponse = {
  panel: Panel; // 新面板（新 id）
  layout?: PanelLayout; // 可选：新面板初始布局（若不返回，前端会生成默认布局并随后 patch-page）
};
```

- 关键约束：
  - 新面板必须追加到 `panels[]` 末尾（保证分页与“跳到最后一页”一致）
  - 若响应未返回 layout，前端会在本地生成默认 layout
  - 复制成功后：前端会对“新面板所在页（通常为最后一页）”补一次 `POST /dashboards/panel-groups/layout/patch-page`，提交该页全部面板最终 layout（后端无需在 duplicate 接口内推断/重排布局）

---

## G. 模块：布局 Layout（分页固定 20，局部 patch）

### G1. 更新面板组“当前页”布局（拖拽/缩放）

- Method: `POST`
- Path: `/dashboards/panel-groups/layout/patch-page`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：用户拖拽/缩放面板后停止（前端 debounce 合并）
- 用途：把“当前页（最多 20 个面板）”的布局持久化到远端
- 补充说明：
  - 除拖拽/缩放外：前端也会在新增/复制/删除面板成功后，对“所在页”调用该接口以锁定最终布局（后端无需推断 CRUD 引起的 layout 重排）
- Request Body（严格）：

```ts
type PatchPanelGroupLayoutPageRequest = {
  groupId: ID; // 面板组 id
  items: Array<{
    i: ID; // panelId
    x: number; // grid units
    y: number; // grid units（全局 y，非页内 y）
    w: number; // grid units
    h: number; // grid units
  }>; // 当前页全部面板的最终 layout（最多 20 个；不是增量 patch）
};
```

- 关键约束（必须满足）：
  - `items.length` ∈ `[1, 20]`
  - `items` 必须包含“当前页全部面板”的 layout（不是增量 patch）
  - 把这一组 items 作为一个事务原子更新（避免部分成功导致前端回滚后与远端不一致）
- Response `200`：

```ts
type PatchPanelGroupLayoutPageResponse = {
  items?: PanelLayout[]; // 可选：后端保存后的 layout 回显（通常为该页 items）
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
  queries: QueryExecuteDTO[]; // 本次要执行的查询列表（前端已补齐默认值）
  context: QueryContext; // 本次查询的公共上下文（timeRange）
};

type QueryExecuteDTO = {
  id: ID; // 用于结果对齐（必须原样回传到 QueryResult.queryId）
  // 注意：前端不传 datasource 信息；由后端按租户/环境/默认配置选择查询数据源。

  expr: string; // PromQL（前端已完成变量插值）
  // 注意：visualQuery（可视化 QueryBuilder 模型）仅用于面板编辑器反显/round-trip，属于落库字段，不进入该执行接口。

  legendFormat: string; // 图例格式（如 {{instance}}；默认 ''）
  minStep: number; // 最小步长（秒）
  format: 'time_series'; // 返回格式（当前仅支持 time_series）
  instant: boolean; // 是否 instant query（通常为 false）
  hide: boolean; // 是否隐藏该 query（execute 时可跳过隐藏 query）
};

type QueryContext = {
  timeRange: TimeRange; // 本次查询时间范围
};
```

- Response `200`（严格：与 queries 一一对应；顺序可不严格，但必须包含 queryId）：

```ts
type QueryResult = {
  queryId: ID; // 必须等于输入 QueryExecuteDTO.id
  expr: string; // 最终执行的表达式（用于回显/调试）

  data: Array<{
    metric: Record<string, string>; // 标签集（包含 __name__/instance/job 等）
    values: Array<[TimestampMs, number]>; // 时序点：[ts,value]
  }>;

  error?: string; // 单 query 失败时填充（不要让整个接口 500）
  meta?: Record<string, any>; // 可选：额外信息（step/from/to 等）
};
type ExecuteQueriesResponse = QueryResult[];
```

- 行为约定：
  - 单 query 失败：使用 `QueryResult.error` 返回错误信息，不影响同一批次的其他 query
  - 请求整体失败（鉴权失败/参数非法等）：返回非 2xx + `ErrorResponse`

---

## I. 模块：变量 Variables（后端全量下发）

> 本项目采用“后端全量下发变量”的模式：
> - Dashboard JSON 不承载 variables（不导入/导出，不随 `/dashboards/load` round-trip）
> - 后端根据 `dashboardSessionKey` 返回该 dashboard 需要的“全局变量定义 + options + 默认值”
> - 前端在 Dashboard 初始化阶段必须先加载变量，再展示面板组（避免首屏查询出现 `$cluster` 未替换等问题）
> - 用户修改变量值后，前端会调用接口回写；后端可选择把该值持久化为默认值，并返回更新后的整份变量列表

### I1. 加载全局变量（整份）

- Method: `POST`
- Path: `/variables/load`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：
  - Dashboard 初始化阶段（必须等待完成后再进入 ready）
- Request Body（可为空对象）：

```ts
type LoadVariablesRequest = {}; // body 可为空（变量作用域由 header sessionKey 决定）
```

- Response `200`：

```ts
type LoadVariablesResponse = DashboardVariable[]; // 整份变量列表（定义 + options + current）
```

---

### I2. 应用变量值（回写默认值，整份返回）

- Method: `POST`
- Path: `/variables/apply`
- Headers（严格）：
  - `X-Dashboard-Session-Key: <dashboardSessionKey>`
- 场景/时机：
  - 用户在“全局设置/变量”面板点击“应用设置/确定”
  - （可选）宿主希望在 timeRange 变化后同步更新变量 options 时，也可复用该接口
- Request Body：

```ts
type ApplyVariablesRequest = {
  values: Record<string, string | string[]>; // 变量值 patch（key 为变量 name；multi 变量用数组）
};
```

- Response `200`：

```ts
type ApplyVariablesResponse = DashboardVariable[]; // 应用后的整份变量列表（后端可更新 options/current）
```

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
  search?: string; // 可选：模糊搜索关键字；为空等价于“默认列表”
};
```
- Response `200`：

```ts
type FetchMetricsResponse = string[]; // 指标名列表（Prometheus metric names）
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
  metric: string; // 指标名（用于限定 label keys 范围）
};
```
- Response `200`：

```ts
type FetchLabelKeysResponse = string[]; // label key 列表（如 instance/job/namespace）
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
  labelKey: string; // 必填：要联想的 label key
  otherLabels?: Record<string, string>; // 可选：其他 label 过滤条件（用于缩小 label value 联想范围）
};
```
- Response `200`：

```ts
type FetchLabelValuesResponse = string[]; // label value 列表
```

- 约束：
  - 当前前端会跳过包含变量引用（如 `$var`）的 otherLabels 条件
