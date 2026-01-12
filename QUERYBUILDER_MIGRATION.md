# QueryBuilder 移植说明

这份文档用于记录 QueryBuilder 从上游实现迁移到本仓库（Vue 3 + Vite + pnpm monorepo）的关键点与注意事项。

> 当前版本以“可运行 + 可维护”为目标，后续如果要对齐 Grafana/AntD 生态，建议优先统一 tokens、依赖策略（peer vs dependencies）以及对外 API 边界。

## 迁移边界（建议遵守）

- QueryBuilder 作为 `@grafana-fast/dashboard` 的内部能力，对外不直接暴露“源码级别”模块路径。
- 外部应用通过 `@grafana-fast/hooks` 的 `useDashboardSdk` 使用 Dashboard（包含 QueryBuilder）。
- 仅在 dashboard 包内部使用 `/#/` 源码别名，其它包与宿主应用不要依赖 `/#/`。

## 目录结构建议

- UI 基础组件与 tokens：`@grafana-fast/component`
- Dashboard 体验与 QueryBuilder：`@grafana-fast/dashboard`
- 挂载/SDK 封装：`@grafana-fast/hooks`

## 常见问题

### 1) 发布后找不到文件 / 类型不对

建议在发布前跑一次 dist 模式 smoke test：

```bash
pnpm build:dist
```

并使用 `scripts/publish.ts` 的发布前校验（已内置 dist 文件与 exports 检查）。

