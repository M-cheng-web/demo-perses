# 工作区说明

- 使用 `pnpm-workspace.yaml` 声明所有 `packages/*` 目录。
- 根目录 `tsconfig.base.json` 提供统一别名：
  - `/#/` 指向 `packages/dashboard/src`（仅供 dashboard 包内部使用的源码绝对路径别名）。
  - `@grafana-fast/*` 别名指向对应子包入口。
- 构建顺序（推荐）：`types` → `store` → `component` → `dashboard` → `hooks` → `app`。
- `scripts/` 目录提供集中化的打包、版本同步与元数据复制脚本。

在本地调试时，`packages/app/vite.config.ts` 默认将 `@grafana-fast/*` 映射到源码，避免每次都要先构建再预览。需要校验发布形态时请使用 `pnpm dev:dist` / `pnpm build:dist`。
