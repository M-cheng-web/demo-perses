# Dashboard SDK 流程（方案 A：`dashboardId` 与 Dashboard JSON 内容分离）

本文用于把“宿主应用如何集成 + 终端用户如何使用 UI + 新/老用户与 JSON 传入的四种组合场景”梳理清楚，并明确 **方案 A** 的边界与推荐实践。

> 适用范围：`@grafana-fast/hooks` 的 `useDashboardSdk(ref, options)` 接入方式（本仓库已禁用直接 `<DashboardView />` 挂载）。

---

## 1. 一句话结论

- `dashboardId`：**资源标识**（外部传入，来自路由/业务接口/数据库主键等），用于 `load/save/delete` 定位资源。
- `DashboardContent`：**纯内容 JSON**（可导入/导出/复制粘贴），**不包含** `dashboardId`。
- SDK 不关心“用户是谁”：用户身份由 **宿主的鉴权机制**（cookie / bearer token / 签名 header 等）决定，并体现在 `apiClient` 的请求里。

---

## 2. 关键边界（谁负责什么）

### 2.1 宿主应用（你的业务系统）负责

1. 决定 `dashboardId`（可能需要先请求业务接口）
2. 提供鉴权能力（token/cookie/header），让后端知道“是谁在访问”
3. 决定新用户/空状态的策略（默认模板？空白？强制导入 JSON？）
4. 挂载容器、控制生命周期（组件卸载时要释放）

### 2.2 Dashboard SDK（`useDashboardSdk`）负责

1. 创建隔离的 Pinia（防止宿主直接篡改内部 store）
2. 挂载/卸载 Dashboard（创建内部 `createApp()`）
3. 暴露统一的命令式 `actions.*` 与事件 `on('change'|'error')`
4. 内部只处理：
   - 以 `dashboardId` 调用 `api.dashboard.loadDashboard(dashboardId)`
   - 以 `dashboardId` + `DashboardContent` 调用 `api.dashboard.saveDashboard(dashboardId, content)`

### 2.3 后端负责

1. `dashboardId` → 查/写对应的内容 JSON
2. 根据鉴权上下文（token/cookie）判断访问权限与归属
3. 返回/保存 **内容 JSON**（不需要在 JSON 里放 `dashboardId`）

---

## 3. 宿主开发者接入流程（推荐）

### 3.1 决定 `dashboardId`（资源标识）

`dashboardId` 的来源应是 **业务域稳定** 的，例如：

- 路由：`/projects/:projectId/dashboard` → `dashboardId = projectId`
- 业务接口：`GET /projects/:id/dashboard` → `{ dashboardId: 'biz-dashboard-001' }`
- 组合键映射：`dashboardId = "project:" + projectId + ":overview"`

约束：

- 必须稳定（刷新/回到页面应仍然一致）
- 不会因为用户导入/导出 JSON 而变化
- 不需要在导出的 JSON 中暴露（避免资源泄漏与耦合）

### 3.2 挂载（必须使用 hook + ref）

推荐写法（`dashboardId` 需要异步获取时）：

```ts
import { ref, onMounted } from 'vue';
import { useDashboardSdk } from '@grafana-fast/hooks';
import { createHttpApiClient } from '@grafana-fast/api';

const containerRef = ref<HTMLElement | null>(null);

const { on, getState, actions } = useDashboardSdk(containerRef, {
  autoLoad: false, // 等业务拿到 dashboardId 后再 load
  apiClient: createHttpApiClient({
    apiConfig: {
      baseUrl: '/api',
      auth: {
        getBearerToken: async () => localStorage.getItem('token') ?? '',
      },
    },
  }),
});

on('change', ({ state }) => {
  // 注意：state 是快照，可渲染 UI，但不要当成“可修改引用”
  console.log('changed:', state.dashboard?.id, state.dashboard?.name);
});

onMounted(async () => {
  const dashboardId = await fetchDashboardIdFromBizApi(); // 你的业务接口
  await actions.loadDashboard(dashboardId);
});
```

如果你的 `dashboardId` 同步可得，可以直接传 `dashboardId`，并保持默认 `autoLoad=true`：

```ts
useDashboardSdk(containerRef, { dashboardId: 'default' });
```

### 3.3 外部控制（宿主想“达到自己目的”）

宿主控制 dashboard 的方式只有两类：

1. **命令式**：调用 `actions.*`
2. **可观测**：订阅 `on('change')` / `on('error')`，拿到快照

常用命令：

- 数据：
  - `actions.loadDashboard(dashboardId)`
  - `actions.saveDashboard()`
  - `actions.setDashboard(dashboardContent, { markAsSynced?: boolean })`
- 时间/刷新：
  - `actions.setTimeRange({ from, to })`
  - `actions.setRefreshInterval(ms)`
  - `actions.refreshTimeRange()`
- UI 辅助：
  - `actions.openSettings()` / `actions.closeSettings()`
  - `actions.toolbar.viewJson()` / `actions.toolbar.importJson()` / `actions.toolbar.applyJson()` 等
- 能力开关：
  - `actions.setReadOnly(true/false)`

### 3.4 保存策略（为什么 `dashboardId` 必须先绑定）

在方案 A 中，保存动作的语义是：

> **保存 = `dashboardId`（定位资源） + `DashboardContent`（内容 JSON）**

因此：

- **如果没有先 `loadDashboard(dashboardId)` 绑定 `dashboardId`**：
  - 手动保存会抛错（提示缺少 dashboardId）
  - 自动同步会 no-op（避免后台无限重试）

> 推荐：任何“要编辑并持久化”的页面都应先 resolve 出 `dashboardId` 再进入编辑流程。

### 3.5 导入/导出 JSON（不会泄露 `dashboardId`）

- 导出：SDK/store 会构造“可持久化快照”（合并 timeRange/refreshInterval/variables 的运行时值），然后 stringify。
- 导入：导入 JSON 只会替换“内容 JSON”；不会改 `dashboardId`。

安全约束：

- 即便导入了历史/外部 JSON 带 `id/createdAt/updatedAt` 等字段，store 会在内部做字段白名单化，只保留 `DashboardContent` 允许的字段，避免导出时泄露资源标识。

---

## 4. 终端用户体验流程（页面上怎么“控制”）

终端用户进入 A 页面后，一般会经历：

1. **加载态**：显示 boot/loading（fetching → initializing）
2. **渲染态**：按 `DashboardContent.panelGroups` 渲染面板组与面板
3. **交互态**：
   - 调整时间范围（立即影响查询）
   - 设置自动刷新间隔（已在全局设置补 UI）
   - 进入设置侧边栏（工具入口）
   - 通过 JSON 弹窗导入/查看/应用/导出
   - 新建面板组/编辑面板（若未开启 readOnly）
4. **持久化**：编辑类操作会触发 debounce auto-sync（或用户手动点保存）

> 核心点：Dashboard 有几个面板组、每组有哪些面板，完全由加载到的 `DashboardContent` 决定。

---

## 5. A 页面四种场景清单（新用户/历史用户 × 是否传入 JSON）

为了避免“我不知道该按什么标准”，这里给出一个可落地的决策清单。

### 定义（建议统一口径）

- **新用户**（对 SDK 而言）：后端对该 `dashboardId` 没有内容（可能返回 `404` 或空内容）。
- **历史用户**：后端对该 `dashboardId` 已有内容，`loadDashboard(dashboardId)` 返回可渲染的 `DashboardContent`。
- **传入 JSON**：指 “宿主或终端用户提供了一份 `DashboardContent` JSON，希望作为初始化/覆盖内容”。

> 注意：方案 A 里 SDK 不区分 userId。所谓“新/老用户”本质是“该 dashboardId 是否已存在内容”。

---

### 场景 1：新用户 + 不传入 JSON

目标：让用户第一次进入也能“看到东西”或“明确知道如何开始”。

推荐实现（两选一）：

1. **后端 get-or-create（最省心）**
   - `GET /dashboards/:id` 若不存在则创建默认内容并返回（类似 mock 行为）
   - 用户第一次进入不会是空白
2. **严格 REST + 宿主兜底（更可控）**
   - `GET /dashboards/:id` 不存在返回 `404`
   - 宿主捕获 `404` 后做决策：
     - 显示空状态（提示“新建面板组/导入 JSON”）
     - 或调用 `api.dashboard.getDefaultDashboard()` 取模板，再 `actions.setDashboard(template)` 并提示用户保存

不需要传 userId：

- 后端通过 cookie/token 识别当前用户（或租户），决定是否允许创建/访问该 `dashboardId`

---

### 场景 2：新用户 + 传入 JSON

目标：以“外部给定的一份 JSON”作为初始内容，绑定到 `dashboardId`。

推荐流程：

1. 宿主 resolve 出 `dashboardId`
2. 宿主拿到 JSON（文件上传/业务返回/本地模板）
3. 校验通过后：
   - `actions.setDashboard(content, { markAsSynced: false })`
   - `await actions.saveDashboard()`（让后端建立该 id 的内容）

建议 UI/交互：

- 若用户上传 JSON，需要明确提示：这是“初始化内容”，后续保存仍然写回同一个 `dashboardId`

---

### 场景 3：历史用户 + 不传入 JSON

目标：最标准的“进入即恢复上次状态”。

流程：

1. 宿主 resolve `dashboardId`
2. `await actions.loadDashboard(dashboardId)`
3. 用户编辑/新增/拖拽等 → 自动同步保存（或用户手动保存）

---

### 场景 4：历史用户 + 传入 JSON

目标：允许用户用一份 JSON **覆盖** 当前 dashboard 内容，但 `dashboardId` 不变。

推荐流程：

1. 先 `loadDashboard(dashboardId)`（让用户看到当前内容）
2. 用户选择“导入 JSON”（或宿主提供“从文件/模板替换”能力）
3. 覆盖前弹确认：
   - “这会替换当前 Dashboard 内容（面板/变量/时间/刷新策略等），dashboardId 不会改变，保存后会覆盖远端内容”
4. `apply` 后建议立即提示用户“保存”或直接自动保存

重要约束：

- **导出 JSON 不包含 dashboardId**
- 覆盖后 `dashboardId` 仍然是同一个（资源定位稳定）

---

## 6. 鉴权与 `apiClient`：怎么告诉后端“用户是谁”

方案 A 的关键点是：SDK 不传 userId，但后端仍然需要知道调用者身份。

做法是把“身份”放到请求里（由宿主控制）：

### 6.1 Bearer Token（推荐）

```ts
import { createHttpApiClient } from '@grafana-fast/api';

const apiClient = createHttpApiClient({
  apiConfig: {
    baseUrl: '/api',
    auth: {
      getBearerToken: async () => sessionStorage.getItem('token') ?? '',
    },
  },
});
```

### 6.2 Cookie（同站/SSO 常见）

```ts
const apiClient = createHttpApiClient({
  apiConfig: {
    baseUrl: '/api',
    credentials: 'include',
  },
});
```

### 6.3 自定义 headers（签名/trace/多 header）

```ts
const apiClient = createHttpApiClient({
  apiConfig: {
    baseUrl: '/api',
    getHeaders: async () => ({
      'X-Trace-Id': crypto.randomUUID(),
      'X-Signature': await signSomehow(),
    }),
  },
});
```

后端再根据鉴权上下文决定：

- 该用户是否可访问这个 `dashboardId`
- 这个 `dashboardId` 对应的数据属于哪个项目/租户/用户空间

---

## 7. 当前实现对照（是否满足需求）

已满足：

- ✅ 不支持直接 `<DashboardView />` 挂载：会 warn 且阻止加载（只能用 `useDashboardSdk + ref`）
- ✅ `dashboardId` 外置：SDK/store 绑定资源标识并用于 load/save
- ✅ Dashboard JSON 纯内容化：导入/导出/保存的 JSON 不包含 `dashboardId`
- ✅ 防呆：即使导入老 JSON 带 `id/createdAt/updatedAt`，也会被剥离
- ✅ 全局设置弹窗补了 `refreshInterval`（自动刷新间隔）UI 控制入口

仍需宿主或后端明确策略的点：

- ⚠️ “新用户第一次进入”的空状态策略：
  - 由后端决定是否 get-or-create，或由宿主捕获 404 后兜底
- ⚠️ “导入 JSON 覆盖”强提示/二次确认：
  - 当前建议宿主产品化时加确认（避免误覆盖）

---

## 8. 参考实现（仓库内）

- Demo：`packages/app/src/views/DashboardView.vue`
  - 演示 `autoLoad: false` + 异步获取 `dashboardId` 再 `loadDashboard`
- Hook：`packages/hook/src/useDashboardSdk.ts`
- Dashboard store：`packages/dashboard/src/stores/dashboard.ts`
- HTTP 鉴权配置：`packages/api/src/impl/http/config.ts`
