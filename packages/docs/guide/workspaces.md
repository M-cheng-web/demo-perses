# 工作区说明

- 使用 `pnpm-workspace.yaml` 声明所有 `packages/*` 目录。
- 根目录 `tsconfig.base.json` 提供统一别名：
  - `/#/` 指向组件包源码，方便在包内用绝对路径。
  - `@grafana-fast/*` 别名指向对应子包入口。
- 构建顺序：`types` → `component` → `hooks` → `app`。
- `scripts/` 目录提供集中化的打包、版本同步与元数据复制脚本。

在本地调试时，`packages/app/vite.config.ts` 已将 `@grafana-fast/*` 映射到源码，避免每次都要先构建再预览。
