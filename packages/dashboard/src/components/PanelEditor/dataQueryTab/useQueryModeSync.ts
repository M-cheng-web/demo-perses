import { watch, type Ref } from 'vue';
import { parsePromqlToVisualQuery } from '@grafana-fast/utils';
import { deepClone } from '/#/utils';
import { emptyVisualQuery, renderPromql } from './helpers';
import type { QueryDraft, QueryMode } from './types';

/**
 * 负责 Code <-> Builder 的状态同步。
 *
 * 约束：
 * - 这是“编辑器专用”逻辑（会按需加载 @grafana-fast/promql AST 模块）
 * - 只在 queryMode 切换时触发同步；不会自动执行查询
 */
export function useQueryModeSync(options: { queryMode: Ref<QueryMode>; queryDrafts: Ref<QueryDraft[]> }) {
  const { queryMode, queryDrafts } = options;

  let promqlAstModulePromise: Promise<any> | null = null;

  // 说明：按需加载 PromQL AST 模块（编辑器专用），避免把解析重依赖拉进运行时链路
  const loadPromqlAstModule = async () => {
    if (!promqlAstModulePromise) {
      // 注意：这是编辑器专用模块（包含 AST + Code<->Builder 转换）
      promqlAstModulePromise = import('@grafana-fast/promql');
    }
    return promqlAstModulePromise;
  };

  const syncAllBuilderToCode = () => {
    for (const d of queryDrafts.value) {
      if (d.builder.status !== 'ok') continue;
      d.code.expr = renderPromql(d.builder.visualQuery);
    }
  };

  const syncAllCodeToBuilder = () => {
    // 说明：这是一个异步流程（按需加载 AST 模块），但调用方不需要 await
    const tasks = queryDrafts.value.map(async (d) => {
      if (d.builder.status === 'ok') return;

      // 优先使用 AST 入口：语法层更可靠（能区分 syntax error vs unsupported）
      try {
        const mod = await loadPromqlAstModule();
        const res = mod.parsePromqlToVisualQueryAst(d.code.expr);
        if (res.ok) {
          d.builder.status = 'ok';
          d.builder.issueType = undefined;
          d.builder.message = undefined;
          d.builder.visualQuery = deepClone(res.value);
          d.builder.parseWarnings = res.warnings ? [...res.warnings] : [];
          d.builder.diagnostics = res.diagnostics ? [...res.diagnostics] : [];
          d.builder.confidence = res.confidence;
          // partial 默认只预览，避免隐式覆盖
          d.builder.acceptedPartial = res.confidence === 'exact';
          return;
        }

        d.builder.status = 'unsupported';
        d.builder.issueType = res.diagnostics && res.diagnostics.length > 0 ? 'syntax' : 'unsupported';
        d.builder.message = res.error || '该 PromQL 暂无法转换为 Builder';
        d.builder.parseWarnings = [];
        d.builder.diagnostics = res.diagnostics ? [...res.diagnostics] : [];
        d.builder.confidence = undefined;
        d.builder.acceptedPartial = false;
        d.builder.visualQuery = emptyVisualQuery();
        return;
      } catch (error) {
        // 降级：AST 模块加载失败时，回退到 utils best-effort 解析（保证可用）
        const parsed = parsePromqlToVisualQuery(d.code.expr);
        if (parsed.ok && (parsed.confidence === 'exact' || parsed.confidence === 'partial')) {
          d.builder.status = 'ok';
          d.builder.issueType = undefined;
          d.builder.message = undefined;
          d.builder.visualQuery = deepClone(parsed.value);
          d.builder.parseWarnings = parsed.warnings ? [...parsed.warnings] : [];
          d.builder.diagnostics = [];
          d.builder.confidence = parsed.confidence;
          d.builder.acceptedPartial = parsed.confidence === 'exact';
          return;
        }
        if (parsed.ok && parsed.confidence === 'selector-only') {
          d.builder.status = 'unsupported';
          d.builder.issueType = 'unsupported';
          d.builder.message = parsed.warnings?.[0]?.message ?? '该表达式过于复杂，Builder 仅能提取部分信息；请使用 Code 模式编辑。';
          d.builder.visualQuery = deepClone(parsed.value);
          d.builder.parseWarnings = parsed.warnings ? [...parsed.warnings] : [];
          d.builder.diagnostics = [];
          d.builder.confidence = parsed.confidence;
          d.builder.acceptedPartial = false;
          return;
        }
        d.builder.status = 'unsupported';
        d.builder.issueType = 'unsupported';
        d.builder.message = '该 PromQL 暂无法转换为 Builder（best-effort 解析失败），请使用 Code 模式编辑。';
        d.builder.parseWarnings = [];
        d.builder.diagnostics = [];
        d.builder.confidence = undefined;
        d.builder.acceptedPartial = false;
        d.builder.visualQuery = emptyVisualQuery();
        // eslint-disable-next-line no-console
        console.warn('PromQL AST 模块加载失败，已降级到 best-effort parser：', error);
      }
    });

    return Promise.all(tasks);
  };

  watch(
    () => queryMode.value,
    (mode) => {
      // 切换模式只做模型同步，不应触发执行查询
      if (mode === 'code') syncAllBuilderToCode();
      if (mode === 'builder') void syncAllCodeToBuilder();
    }
  );

  return {
    syncAllBuilderToCode,
    syncAllCodeToBuilder,
  };
}
