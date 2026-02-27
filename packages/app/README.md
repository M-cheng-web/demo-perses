# demo app

本目录是 grafana-fast 的本地开发/演示应用，用于调试 `@grafana-fast/dashboard` 在真实宿主环境中的运行效果。

## Development

```bash
pnpm dev
```

## Development (consume dist)

用于验证“宿主消费发布产物”的集成形态（通过 dist 产物运行）。

```bash
pnpm dev:prod
```

## Build

默认以 production mode 构建（消费 dist 产物）。

```bash
pnpm build
```

## License

MIT
