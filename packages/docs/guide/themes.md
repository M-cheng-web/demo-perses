# 主题与 Design Tokens

`@grafana-fast/component` 通过 CSS Variables（Design Tokens）提供统一的视觉基线，组件内部应尽量只消费“语义 tokens”（例如 `--gf-text`、`--gf-border`），避免直接绑定到具体色值。

## 主题切换（推荐方式）

组件库内置了 `data-gf-theme` 约定：

- `data-gf-theme="light"`
- `data-gf-theme="dark"`

你可以在应用根节点上切换这个属性来实现暗黑/明亮主题切换（CSS 变量会随之生效）。

如果你使用 `@grafana-fast/component` 的 `ConfigProvider`，可以直接传 `theme`：

```vue
<template>
  <ConfigProvider theme="dark">
    <App />
  </ConfigProvider>
</template>

<script setup lang="ts">
import { ConfigProvider } from '@grafana-fast/component';
</script>
```

也可以在任意容器上手动控制：

```html
<div id="app" data-gf-theme="dark"></div>
```

## 与按需导入配合

如果你采用按需导入（更好的 tree-shaking），记得显式引入组件库全局样式：

```ts
import '@grafana-fast/component/styles';
```

