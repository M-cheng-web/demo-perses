# @grafana-fast/monorepo

原 `demo-perses` 项目已重构为 pnpm monorepo，提供可复用的 Dashboard 组件、对外 SDK hooks、类型包与演示站点。

## ✨ 概览

- 多图表类型的仪表板体验（Dashboard）
- QueryBuilder（PromQL 可视化构建 + 智能提示）
- 可复用的 UI 组件库、SDK hooks、类型包

## 🚀 快速开始

需要 Node.js `>=20.19.0`（Vite 7 的最低要求），并使用 pnpm 安装依赖。

```bash
pnpm install
pnpm dev   # 运行演示站点（packages/app）
pnpm build # 构建可发布包（dist）并生成 release/ 离线产物
pnpm app-release # 启动最小 demo，验证 release/ 可被真实消费
```

演示站点默认运行在 http://localhost:5173 。

## 🔌 后端接口对接

- 接口清单（逐项入参/出参 + 约定）：`API_REQUIREMENTS.md`

## 🧰 命令说明（根目录 `package.json#scripts`）

> 说明：本仓库的脚本组织方式参考 morehook：常用入口尽量少，组合用 `nr xxx && esno scripts/*.ts` 串起来。
>
> - `nr`：本仓库内置的小工具（`pnpm install` 后由 `postinstall` 自动生成到 `node_modules/.bin/nr`）。
> - `meta/packages.ts`：工作区包的“单一数据源”，打包/发布脚本会以它为准。

| 命令              | 含义                            | 备注                                                                              |
| ----------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`        | 启动演示站点                    | 先 `nr update`，再 `nr -C packages/app dev`                                       |
| `pnpm build`      | 构建可发布包 + 生成 release/    | `nr update && esno scripts/build.ts && pnpm dist:validate && pnpm dist:pack`      |
| `pnpm app-release`| 启动离线消费演示                | 先执行 `pnpm build`，再启动 `packages/app-release`（从 `release/` 直接引用 SDK） |
| `pnpm update`     | 同步工作区包版本/依赖协议       | 基于 `meta/packages.ts`，把内部依赖统一为 `workspace:*`，并对齐版本号             |
| `pnpm clean`      | 清理构建产物                    | 清理各包 `dist/` 与增量编译缓存                                                   |
| `pnpm types:fix`  | 同步 dist 内元信息              | 把各包 `package.json/README.md` 同步到 `dist/`，并把 `workspace:*` 改写为实际版本 |
| `pnpm publish`    | 发布（从 dist 发布）            | 先校验 `exports/main/module/types` 指向文件存在，再 `npm publish`                 |
| `pnpm lint`       | ESLint 检查                     | 使用 `--cache` 提速                                                               |
| `pnpm lint:fix`   | ESLint 自动修复                 | 等价于 `nr lint --fix`                                                            |
| `pnpm format`     | Prettier 检查                   | 仅检查，不会写文件                                                                |
| `preinstall`      | 安装前校验 pnpm                 | 内部脚本：确保使用 pnpm                                                           |
| `postinstall`     | 安装后准备 `nr` 命令            | 内部脚本：生成本地 `nr` 到 `node_modules/.bin/`                                   |

## ✅ 发布形态（dist）校验

本地开发时 `packages/app` 默认通过 Vite alias 指向各包源码。要模拟发布后的真实消费形态（走 `dist` + `exports`），建议定期做一次 smoke test：

```bash
pnpm build
GF_USE_DIST=1 pnpm -C packages/app dev
```

## 📁 项目结构

```
demo-perses/
├── packages/
│   ├── app/         # 演示站点（消费组件与 hooks）
│   ├── app-release/  # 离线消费演示（直接使用 release/ 产物）
│   ├── component/   # 自研 UI 组件包 @grafana-fast/component（取代 Ant Design Vue）
│   ├── dashboard/   # Dashboard 体验包 @grafana-fast/dashboard
│   ├── hook/        # SDK hooks 包 @grafana-fast/hooks（依赖 dashboard）
│   ├── types/       # 类型包 @grafana-fast/types
├── scripts/         # 打包/发布辅助脚本（参考 morehook 的 build/publish）
├── release/         # 可直接拷贝分发的离线产物（单入口 index.mjs）
├── tsconfig.base.json  # 统一别名与编译配置，提供 /#/ 与 @grafana-fast/* 路径
├── pnpm-workspace.yaml
└── README.md
```

别名说明：

- `/#/`：指向 dashboard 包源码的内部别名（仅建议在 `@grafana-fast/dashboard` 包内部使用）。
- `@grafana-fast/component` / `@grafana-fast/dashboard` / `@grafana-fast/hooks` / `@grafana-fast/types`：工作区内的各子包入口。

## 📌 外部目录维护边界

以下目录属于外部工程/上游镜像，不纳入主线包（`packages/*`）的质量指标和重构范围：

- `nginxpulse/`
- `vue-grid-layout-v3/`

维护约束：

- 除非是“上游同步”或“明确的本地兼容补丁”，否则不在这些目录内做功能开发。
- 质量指标与路线图里提到的类型债/测试覆盖/重构目标，默认只覆盖 `packages/*` 与 `scripts/*`。
