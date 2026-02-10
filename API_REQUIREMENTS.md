# 接口审核清单（按业务流程）

用于快速审核：为了把当前 Dashboard 子项目跑通（含编辑/变量/查询），后端需要提供哪些接口、各自做什么。

说明：

- 不标注代码调用位置，只列“接口 + 用途 + 最小入参/出参”
- 路径仅作占位示例；实际路径可通过 `@grafana-fast/api` 的 http endpoints 映射适配

---

## 0) 宿主启动（全局信息：通常不放进 @grafana-fast/api）

- 获取当前用户/租户/权限：`GET /me`（或 `/users/me`）
  - 用途：拿到 userId + permissions，决定只读/可编辑、默认 dashboardId、鉴权方式等
  - 出参（最小）：`{ id: string; permissions?: string[] }`
- 获取全局设置（可选）：`GET /settings`
  - 用途：主题/时区/功能开关/默认时间范围等（你也可以不做这条，直接前端默认）
  - 出参（示例）：`{ timezone?: string; theme?: 'light'|'dark'; defaultDashboardId?: string }`

---

## 1) 进入 Dashboard（拿到 dashboardId 之后：只拉一次 JSON）

- 加载 Dashboard 内容：`GET /dashboards/:id`
  - 用途：进入/切换 dashboard 时加载 Dashboard JSON
  - 出参：`DashboardContent`
- （兜底）全量保存 Dashboard：`PUT /dashboards/:id`
  - 用途：仅用于“导入/应用 JSON”“整盘覆盖”这类场景（正常拖拽/增删改不建议走全量）
  - 入参：`DashboardContent`（建议返回 `204`）
- （可选）默认 Dashboard：`GET /dashboards/default` → `DashboardContent`
- （可选）Dashboard 列表：`GET /dashboards` → `DashboardListItem[]`
- （可选）删除 Dashboard：`DELETE /dashboards/:id`（建议 `204`）

---

## 2) 打开面板组 / 首屏渲染（不再额外拉“面板详情”）

约定（产品流）：

- `GET /dashboards/:id` 返回的 JSON 内包含：
  - 面板组列表、每个面板的**基础信息**（标题、类型、查询参数、位置/大小等）
  - 面板渲染所需的 queries/options（即“点开详情不需要再请求面板配置”）
- 用户点开面板组时：
  - 前端会基于这些基础信息直接执行查询获取数据
  - **不会**再请求“面板详情配置”接口

需要的核心接口：

- 执行面板查询：`POST /queries/execute`
  - 用途：首次渲染、时间范围变化、刷新、变量变化时执行查询
  - 入参（最小）：`{ queries: CanonicalQuery[]; context: QueryContext }`
  - 出参（最小）：`QueryResult[]`

---

## 3) 编辑（只做局部持久化；失败要可回滚）

> 重要：Dashboard JSON 只在进入时拉一次；之后所有编辑都走“局部接口”，前端本地 JSON 先乐观变更，接口失败则回滚到上一次成功快照。

### 3.1 拖拽/缩放布局（分页固定 20/页）

- 更新某个面板组“当前页布局”：`PATCH /dashboards/:id/panel-groups/:groupId/layout`
  - 用途：拖拽/缩放面板时持久化布局
  - 关键约定：
    - 前端分页**固定 20 条/页**
    - 每次触发布局更新时，必须提交**当前页全部面板**的 `{panelId,x,y,w,h}`（最多 20 条），而不是只提交变动的那一条
    - 后端落库应以“这一页为原子单元”处理（便于保持一致性）
  - 入参（最小）：
    - `{ items: Array<{ i: string; x:number; y:number; w:number; h:number }> }`
  - 出参（可选）：`{ items?: PanelLayout[] }`
    - 用途：后端如做了 compact/冲突修正，可把最终 layout 回传给前端覆盖本地结果

### 3.2 面板 CRUD（针对某个面板组）

- 新增面板：`POST /dashboards/:id/panel-groups/:groupId/panels`
  - 用途：创建面板（后端生成 `panelId` 并返回）
  - 入参（最小）：`{ panel?: { name; type; queries; options; description? } }`
  - 出参（最小）：`{ panel: Panel; layout?: PanelLayout }`
  - 关键约定：
    - 若当前页刚好 20 条，新增后面板应出现在下一页；前端会默认跳到最后一页展示
- 更新面板（保存）：`PUT /dashboards/:id/panel-groups/:groupId/panels/:panelId`
  - 用途：面板编辑器点击保存
  - 入参（最小）：`{ panel: Omit<Panel,'id'> }`
  - 出参（最小）：`{ panel: Panel }`
- 删除面板：`DELETE /dashboards/:id/panel-groups/:groupId/panels/:panelId`（建议 `204`）
  - 用途：删除面板（同时应删除其 layout 记录）
- 复制面板：`POST /dashboards/:id/panel-groups/:groupId/panels/:panelId/duplicate`
  - 用途：后端复制并生成新 `panelId`
  - 出参（最小）：`{ panel: Panel; layout?: PanelLayout }`

### 3.3 面板组 CRUD / 排序（建议补齐，避免走全量 save）

- 创建面板组：`POST /dashboards/:id/panel-groups`
  - 入参（最小）：`{ group: { title; description? } }`
  - 出参：`{ group: PanelGroup }`
- 更新面板组元信息：`PATCH /dashboards/:id/panel-groups/:groupId`
  - 入参（最小）：`{ group: { title; description? } }`
  - 出参：`{ group: PanelGroup }`
- 删除面板组：`DELETE /dashboards/:id/panel-groups/:groupId`（建议 `204`）
- 面板组排序：`PATCH /dashboards/:id/panel-groups/order`
  - 入参（最小）：`{ order: string[] }`（面板组 id 顺序）
  - 出参：`204` 或 `{ ok:true }`

---

## 4) 变量（主要是 query 型变量的 options）

- 解析 query 型变量 options：`POST /variables/values`
  - 用途：变量下拉选项、变量联动刷新（例如 `label_values(...)`）
  - 入参（最小）：`{ expr: string; timeRange: { from: string|number; to: string|number } }`
  - 出参（最小）：`Array<{ text: string; value: string }>`

---

## 5) 编辑查询（QueryBuilder 联想）

> 如果你短期不做“可视化 QueryBuilder”，这组接口可以先不接（保留口子即可）。

- 指标联想：`GET /query/metrics?search=...` → `string[]`
- Label Keys：`GET /query/label-keys?metric=...` → `string[]`
- Label Values：`GET /query/label-values?metric=...&labelKey=...&...` → `string[]`

（对应 `@grafana-fast/api`：`QueryService.fetchMetrics` / `fetchLabelKeys` / `fetchLabelValues`）

建议统一操作流程（触发时机 → 调用接口）：

- 打开/聚焦指标选择器（可选预拉）：`GET /query/metrics`（`search` 为空）
  - 用途：填充指标下拉；也可以改成“用户输入时再拉”，避免一次性拉全量
- 用户输入搜索词（建议 debounce 200~400ms）：`GET /query/metrics?search=xxx`
  - 用途：指标名联想（返回前 N 条即可）
- 选择指标后：`GET /query/label-keys?metric=<metric>`
  - 用途：填充标签名下拉（instance/job/...）
- 选择某个 labelKey / 展开 labelValue 下拉时：`GET /query/label-values?metric=<metric>&labelKey=<key>&...otherLabels`
  - 用途：填充该 label 的候选值
  - 说明：`otherLabels` 建议携带“其它已选标签过滤条件”（便于后端做更精确的 label values 过滤）
  - 注意：当其它标签值里包含变量引用（如 `$var` / `${var}` / `[[var]]`）时，前端可能会跳过这些条件，避免后端无法解析
- 点击“执行查询/预览”（最终仍走查询执行接口）：`POST /queries/execute`
  - 用途：QueryBuilder 只是生成 PromQL；真正取数还是统一走 execute

不需要后端接口的部分（前端本地即可）：

- 操作列表（rate/sum/avg 等）与参数表单（OperationsList）
- 查询模板（QueryPatterns）
- 查询解释（Explain）

---

## 6) 数据源（当前 UI 可先弱依赖，但建议预留）

- 默认数据源：`GET /datasources/default` → `Datasource`
- （可选）数据源列表：`GET /datasources` → `Datasource[]`
- （可选）数据源详情：`GET /datasources/:id` → `Datasource`（找不到建议 404）
  - 约定：前端 contract 语义是“找不到返回 null”（对接时实现层会把 404 映射为 null）

---

## 最小闭环（回答“需要这么多接口吗？”）

如果你只想先跑通“加载 → 打开面板组渲染 → 局部编辑”，最小需要：

- `GET /me`（或等价鉴权上下文）
- `GET /dashboards/:id`
- `POST /queries/execute`
- 以及编辑相关至少一条（建议从布局 patch 开始）：
  - `PATCH /dashboards/:id/panel-groups/:groupId/layout`

其余（变量/QueryBuilder/面板 CRUD/面板组 CRUD/数据源等）都可以按你后端节奏逐步补齐。

---

## 可能遗漏/需要你确认的点（方便后端一次性补齐）

- 是否需要“并发控制/版本号”（建议）：例如在 `DashboardContent` 或局部接口中带 `revision` / `etag`，避免多人同时编辑互相覆盖
- 面板组内是否需要“面板排序/移动到其它组”的能力（当前 UI 暂未实现，但产品常见）
- 是否需要“批量删除/批量移动”的接口（暂未实现）
