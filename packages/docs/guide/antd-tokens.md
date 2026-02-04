# AntD Tokens 注入

`@grafana-fast/component` 提供了一份 Ant Design（v5 token 体系）兼容的 token map：`gfAntdTokensCssVar`。

它的价值是：**让 Ant Design / Ant Design Vue 的视觉变量直接指向 grafana-fast 的 CSS Variables**，这样宿主应用在同时使用 AntD 组件时，能尽量保持视觉一致。

## 用法示例（Ant Design Vue）

```ts
import { createApp } from 'vue';
import { ConfigProvider as AntdConfigProvider } from 'ant-design-vue';
import { gfAntdTokensCssVar } from '@grafana-fast/component';

// 伪代码：将 token 注入 AntD（具体字段以你实际使用的 AntD Vue 版本为准）
const antdTheme = {
  token: gfAntdTokensCssVar,
};
```

建议策略：

- grafana-fast 的组件内部继续只消费 `--gf-*` tokens
- 宿主应用如果还用到 AntD，则通过 `gfAntdTokensCssVar` 让 AntD 视觉尽量与 grafana-fast 对齐
