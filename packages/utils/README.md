# @grafana-fast/utils

提供 grafana-fast 各子包可复用的工具函数（BEM / 时间处理 / fetch HTTP client / 通用工具）。

```bash
pnpm add @grafana-fast/utils
```

## 约定（维护性优先）

- 只从根入口导入：`import { xxx } from '@grafana-fast/utils'`（避免 deep import 导致 API 不稳定/打包差异）
- 领域能力优先用命名空间：例如 `http.xxx`、`promql.xxx`、`echarts.xxx`、`url.xxx`（输入前缀即可获得完整提示）

## BEM

```ts
import { createNamespace } from '@grafana-fast/utils';

const [block, bem] = createNamespace('button');
// block: "gf-button"
// bem(): "gf-button"
// bem('icon'): "gf-button__icon"
// bem({ disabled: true }): "gf-button gf-button--disabled"
```

## 命名空间（可选）

为方便 IDE 提示与发现能力，`@grafana-fast/utils` 额外提供一些“命名空间对象”（不影响你继续按需导入单个函数）：

```ts
import { http, dom, promql, echarts, url } from '@grafana-fast/utils';

const client = http.createClient({ baseUrl: '/api' });
const theme = echarts.getTheme();
const cssText = dom.readCssVar(undefined, '--gf-color-text', '#000');
const categories = promql.modeller.getCategories();
const endpoint = url.resolveEndpoint('/api', '/dashboards');
```

如需自定义命名空间（例如历史样式前缀）：

```ts
import { createNamespace } from '@grafana-fast/utils';

const [block, bem] = createNamespace('button', { namespace: 'dp' });
```

## Time

```ts
import { parseTimeRange, formatTime } from '@grafana-fast/utils';

const abs = parseTimeRange({ from: 'now-1h', to: 'now' });
console.log(formatTime(abs.from));
```

严格模式（用于数据链路/调试场景，非法输入不兜底）：

```ts
import { tryParseTimeRange } from '@grafana-fast/utils';

const abs = tryParseTimeRange({ from: 'now-1h', to: 'now' });
if (!abs) throw new Error('invalid time range');
```

## Format

```ts
import { formatValue } from '@grafana-fast/utils';

formatValue(0.1234, { unit: 'percent', decimals: 2 }); // "0.12%"
formatValue(1024 * 1024, { unit: 'bytes' }); // "1.00 MB"
```

## Storage (prefixed localStorage)

```ts
import { createPrefixedStorage } from '@grafana-fast/utils';

const storage = createPrefixedStorage('my_app_');
storage.setItem('theme', { mode: 'dark' });
const theme = storage.getItem<{ mode: string }>('theme');
```

## Object

```ts
import { deepMerge } from '@grafana-fast/utils';

const defaults = { a: 1, nested: { x: 1, y: 2 } };
const merged = deepMerge(defaults, { nested: { y: 9 } });
// merged.nested.y === 9, merged.nested.x === 1
```

## HTTP (fetch)

```ts
import { createFetchHttpClient, isHttpError } from '@grafana-fast/utils';

const http = createFetchHttpClient({ baseUrl: '/api' });
try {
  const dashboards = await http.get<{ items: unknown[] }>('/dashboards');
  console.log(dashboards.items);
} catch (err) {
  if (isHttpError(err)) {
    console.error(err.status, err.responseText);
  }
}
```
