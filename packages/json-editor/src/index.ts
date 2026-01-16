/**
 * @grafana-fast/json-editor 包入口
 *
 * 目标：
 * - 提供一个“专为 Dashboard JSON 场景设计”的轻量 JSON 编辑器
 * - 覆盖核心需求：复制粘贴导入、少量编辑、复制导出、明确诊断（合法性/错误位置/导入影响）
 * - 不依赖 Monaco（避免体积与初始化成本）
 *
 * 设计原则：
 * - 只做“最基础但可产品化”的能力：格式化/压缩/复制/校验/导入预检（迁移/缺插件）
 * - 诊断必须清晰：要告诉用户“哪里错了”和“导入后会发生什么”
 * - 严格模式：非法 JSON 只在编辑器内部提示，不会把非法内容同步到外部（避免污染外部状态）
 * - 不与 @grafana-fast/dashboard 产生依赖（避免循环依赖）
 *
 * 实现风格：
 * - 组件使用 `.vue` SFC（<template>）实现，保持与仓库其它 UI 的风格一致
 */
export { default as DashboardJsonEditor } from './modules/DashboardJsonEditor.vue';
export { default as JsonEditorLite } from './modules/JsonEditorLite.vue';

export type { JsonParseError, JsonTextDiagnostics, JsonTextValidator, DashboardSummary } from './types';

export { analyzeJsonText } from './utils/jsonDiagnostics';
export { analyzeDashboardText } from './utils/dashboardDiagnostics';
