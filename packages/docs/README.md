# @grafana-fast/docs

本包是本仓库的文档站点（VitePress）工程，用于本地开发时快速查阅关键入口。

当前仓库已将更细的说明收敛到各包的 README 与根目录接口契约文档：

- 后端接口契约：根目录 `API_REQUIREMENTS.md`
- Dashboard 接入：`packages/dashboard/README.md`
- SDK 示例：`packages/app/src/views/DashboardView.vue`

## Development

```bash
pnpm -C packages/docs docs:dev
```

