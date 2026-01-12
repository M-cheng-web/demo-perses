# 发布形态（dist）校验

工作区内默认的开发体验会更偏向“源码联调”：演示站点通过 Vite alias 直接指向各包的 `src`，这样不需要每次改代码都先 build 一轮。

但源码联调会掩盖一个风险：**发布后的真实消费形态**是走每个包的 `dist` 与 `package.json#exports/types`。为了避免“本地能跑但发布翻车”，建议在开发/CI 中定期跑一次 dist 模式的 smoke test。

## 如何运行 dist 模式

根目录提供了两个命令：

```bash
# 先 build 各包，再让 app 走 dist/exports 构建
pnpm build:dist

# 直接启动 app，但让 app 走 dist/exports（要求你已提前 build packages）
pnpm dev:dist
```

其中 `pnpm dev:dist` / `pnpm build:dist` 会通过环境变量 `GF_USE_DIST=1` 关闭 `packages/app/vite.config.ts` 的源码 alias。

## 发布前校验

`scripts/publish.ts` 在 `npm publish` 前会先校验：

- `dist/package.json` 是否存在
- `main/module/types/exports` 指向的文件是否真实存在
- 是否还残留 `workspace:*` 版本号

这样可以在发布前更早发现 “dist 缺文件/exports 配错” 这类问题。

