# Dashboard SDK 流程（方案：`dashboardSessionKey` + Dashboard JSON 内容分离）

本文用于把“宿主应用如何集成 + Dashboard SDK 内部职责 + 后端接口语义”梳理清楚，并明确当前方案的边界与推荐实践。

> 适用范围：`@grafana-fast/hooks` 的 `useDashboardSdk(ref, options)` 接入方式。

---

## 1. 一句话结论

- `dashboardSessionKey`：**会话级访问 Key**（opaque string），由宿主/后端签发；前端不应知道真实 `dashboardId`（资源标识）。
- `DashboardContent`：**纯内容 JSON**（可导入/导出/复制粘贴），**不包含**任何资源标识（不包含 dashboardId / sessionKey）。
- SDK 不关心“用户是谁”：用户身份由 **宿主鉴权机制**（cookie / bearer token / 签名 header 等）决定，并体现在 `apiClient` 的请求里。

---

## 2. 关键边界（谁负责什么）

### 2.1 宿主应用（你的业务系统）负责

1. 组装一系列业务参数（`params: Record<string, any>`），用于定位“同一份 dashboard”
2. 通过业务接口 **resolve** 得到 `dashboardSessionKey`
3. 提供鉴权能力（token/cookie/header），让后端知道“是谁在访问”
4. 挂载容器、控制生命周期（组件卸载时释放）

### 2.2 Dashboard SDK（`useDashboardSdk`）负责

1. 创建隔离的 Pinia（防止宿主直接篡改内部 store）
2. 挂载/卸载 Dashboard（内部 `createApp()`）
3. 暴露统一的命令式 `actions.*` 与事件 `on('change'|'error')`
4. 内部只处理：
   - 调用 `getDashboardSessionKey()` 拿到 sessionKey（可异步）
   - 在所有请求中携带 sessionKey（dashboard/query/variable/querybuilder），HTTP 实现层映射为 header `X-Dashboard-Session-Key`
   - 以 sessionKey 调用 `api.dashboard.loadDashboard(sessionKey)` 加载整盘 JSON
   - 以 sessionKey 调用 `api.dashboard.saveDashboard(sessionKey, content)` 做兜底全量保存

### 2.3 后端负责

1. `POST /dashboards/session/resolve`：`params` → 定位真实 dashboard（内部 id）→ 签发 `dashboardSessionKey`
2. `dashboardSessionKey` → 真实 dashboard（内部 id）映射与续租/过期控制
3. 返回/保存 **内容 JSON**（不需要、也不允许在 JSON 中放资源标识）

---

## 3. 宿主开发者接入流程（推荐）

### 3.1 提供 `getDashboardSessionKey()`（支持异步）

宿主的核心任务是：**把业务上下文参数换成 sessionKey**。SDK 只依赖这一点。

推荐写法（示例：通过业务接口换 key）：

```ts
import { ref } from 'vue';
import { useDashboardSdk } from '@grafana-fast/hooks';
import { createHttpApiClient } from '@grafana-fast/api';

const containerRef = ref<HTMLElement | null>(null);

const apiClient = createHttpApiClient({
  apiConfig: {
    baseUrl: '/api',
    auth: {
      getBearerToken: async () => localStorage.getItem('token') ?? '',
    },
  },
});

const getDashboardSessionKey = async () => {
  const res = await fetch('/api/dashboards/session/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params: { projectId: 'p-1', scene: 'overview' } }),
  });
  const json = await res.json();
  return json.dashboardSessionKey as string;
};

const { on, getState, actions } = useDashboardSdk(containerRef, {
  apiClient,
  getDashboardSessionKey,
});

on('change', ({ state }) => {
  // 注意：state 是快照，可渲染 UI，但不要当成“可修改引用”
  console.log('changed:', state.dashboard?.name, state.dashboard?.groupCount);
});
```

### 3.2 触发加载（autoLoad / 手动）

- 默认 `autoLoad=true`：SDK 挂载后会自动调用 `getDashboardSessionKey()` 并加载。
- 若你希望自行控制加载时机：设置 `autoLoad: false`，然后手动调用：

```ts
await actions.loadDashboard();
```

### 3.3 过期策略（SDK 行为）

当后端返回 `401` + `ErrorResponse(code="DASHBOARD_SESSION_EXPIRED")` 时：

- SDK 会触发 **single-flight** 的重新 resolve（只会跑一次）
- 然后 **整盘重载**（本期不要求自动重试触发请求）
  - 说明：该规则适用于任意接口（包含 queries / variables / querybuilder），只要命中该错误码就会触发整盘重载

---

## 4. 导入/导出 JSON（不会泄露资源标识）

- 导出：SDK/store 会构造“可持久化快照”（合并 timeRange/refreshInterval/variables 的运行时值），然后 stringify。
- 导入：导入 JSON 只会替换“内容 JSON”；不会影响 sessionKey 的语义。

安全约束：

- 即便导入了历史/外部 JSON 带 `id/createdAt/updatedAt` 等字段，store 会在内部做字段白名单化，只保留 `DashboardContent` 允许的字段，避免导出时泄露资源标识。

---

## 5. 后端实现建议（便于对齐）

- `POST /dashboards/session/resolve` 应负责 get-or-create：避免前端用 `404 → save → load` 初始化（前端无真实 id）。
- `dashboardSessionKey` 的有效期与续租语义见 `API_REQUIREMENTS.md`（推荐：最少 10h + 1h 写入节流续租）。

典型流程（宿主视角）：

1. 宿主决定业务 `params`（自由结构）
2. SDK 调用 `getDashboardSessionKey()` → 后端签发 `dashboardSessionKey`
3. SDK 调用 `actions.loadDashboard()` 加载整盘 JSON 并进入 ready
4. 用户编辑/新增/拖拽等 → 局部接口写入；必要时兜底全量 save

---

## 6. 鉴权与 `apiClient`：怎么告诉后端“用户是谁”

当前方案的关键点是：SDK 不传 userId，但后端仍然需要知道调用者身份。

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

- 该用户是否可访问该 `dashboardSessionKey` 对应的资源
- 该资源属于哪个项目/租户/用户空间

---

## 7. 当前实现对照（是否满足需求）

已满足：

- ✅ 不支持直接 `<DashboardView />` 挂载：会 warn 且阻止加载（只能用 `useDashboardSdk + ref`）
- ✅ `dashboardSessionKey` 外置：宿主/SDK 先 resolve，再由 store 绑定 key 并用于读写
- ✅ Dashboard JSON 纯内容化：导入/导出/保存的 JSON 不包含任何资源标识
- ✅ 防呆：即使导入老 JSON 带 `id/createdAt/updatedAt`，也会被剥离

仍需宿主或后端明确策略的点：

- ⚠️ `params` 的标准化：字段命名/必填/权限规则由业务决定
- ⚠️ sessionKey 的 TTL 与续租：按 `API_REQUIREMENTS.md` 对齐

---

## 8. 参考实现（仓库内）

- Demo：`packages/app/src/views/DashboardView.vue`（演示异步 resolve sessionKey + 整盘重载）
- Hook：`packages/hook/src/useDashboardSdk.ts`
- Dashboard store：`packages/dashboard/src/stores/dashboard.ts`
- HTTP 鉴权配置：`packages/api/src/impl/http/config.ts`
