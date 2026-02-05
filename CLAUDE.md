# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@grafana-fast/monorepo` is a pnpm monorepo providing reusable Dashboard components, SDK hooks, and a type system for building Grafana-like monitoring dashboards. Built with Vue 3, TypeScript, and ECharts.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Run demo site (packages/app) at http://localhost:5173
pnpm build            # Build all packages in dependency order
pnpm docs             # Run VitePress docs at http://localhost:4173
pnpm lint             # ESLint check with cache
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier check
pnpm typecheck        # Run type-check across all packages
pnpm test             # Run tests across all packages
pnpm ci               # Full CI pipeline (lint, format, build, typecheck, test, validate)
```

### Testing Published Form

To test the actual published package behavior (using `dist` instead of source):
```bash
pnpm build
GF_USE_DIST=1 pnpm -C packages/app dev
```

## Build Order

Packages must be built in dependency order: `types` → `utils` → `promql` → `api` → `store` → `component` → `json-editor` → `dashboard` → `hooks`

The `scripts/build.ts` orchestrates this sequence.

## Package Architecture

### Core Packages (publishable)
- **@grafana-fast/types** - Shared TypeScript type definitions
- **@grafana-fast/utils** - Common utilities (bem, time, http, etc.)
- **@grafana-fast/store** - Lightweight Pinia-like state management with multi-instance isolation
- **@grafana-fast/api** - Data access layer (contract + implementation)
- **@grafana-fast/promql** - PromQL parsing (AST/diagnostics) and Code ↔ Builder transformations
- **@grafana-fast/component** - UI component library (Vue plugin with `install()`)
- **@grafana-fast/json-editor** - Lightweight JSON editor with validation
- **@grafana-fast/dashboard** - Main dashboard experience package
- **@grafana-fast/hooks** - SDK hooks for embedding dashboards (`useDashboardSdk`)

### Apps (non-publishable)
- **@grafana-fast/app** - Demo site consuming all packages
- **@grafana-fast/docs** - VitePress documentation

## Key Architectural Patterns

### Path Aliases
- `/#/*` → `packages/dashboard/src/*` (internal dashboard alias)
- `@grafana-fast/*` → workspace package sources (via tsconfig.base.json paths)

### SDK Integration Pattern
The primary integration point is `useDashboardSdk()` from `@grafana-fast/hooks`:
- Creates isolated Pinia instance per dashboard (multi-instance safe)
- Mounts `DashboardView` to target container
- Exposes state snapshot via `getState()` and actions via `actions.*`
- Emits events: `change`, `error`

Direct component usage of `DashboardView` is blocked - must go through SDK.

### State Management
Custom lightweight Pinia implementation in `@grafana-fast/store`:
- Supports `defineStore()` with state, actions, getters
- Multi-instance isolation via injected pinia context
- `storeToRefs()` for reactive references

### Dashboard Stores
Located in `packages/dashboard/src/stores/`:
- `dashboard` - Main dashboard state, load/save operations
- `timeRange` - Time range and auto-refresh
- `variables` - Template variables
- `editor` - Panel editing state
- `tooltip` - Chart tooltip coordination

## Configuration

### Package Metadata
`meta/packages.ts` is the single source of truth for:
- Package names and npm publish names
- Build order and external dependencies
- Category (library/app/docs)

### Scripts
The `nr` command (generated at postinstall) is a local runner used by npm scripts.
`esno` is used for running TypeScript scripts directly.

## Tech Stack
- **Node**: >=20.19.0 (required for Vite 7)
- **Vue**: 3.5+
- **TypeScript**: 5.9+
- **Vite**: 7.x for component/dashboard packages
- **Rollup**: For library packages (hooks, api, etc.)
- **ECharts**: 6.x for chart rendering
- **Less/Sass**: For component styles
