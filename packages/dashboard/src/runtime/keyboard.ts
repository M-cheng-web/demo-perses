/**
 * 键盘事件作用域管理（多实例隔离）
 *
 * 背景：
 * - dashboard 可能在一个页面中被挂载多次（多个 Vue app / 多个 runtimeId）
 * - 若直接全局监听 window.keydown，会导致热键串到其他实例
 *
 * 这里的做法：
 * - 仍然只绑定一次 window 监听，但通过 runtime.rootEl 判断事件是否发生在该实例范围内
 * - 支持“后注册优先”（类似栈）：最后注册的 scope 最先处理事件
 *
 * 说明：
 * - 这是一个通用工具；业务层是否启用热键由上层组件决定
 */
import type { DashboardRuntimeContext } from './keys';

export interface KeyboardScope {
  /** scope 唯一 id（用于调试） */
  id: string;
  /** 绑定的 dashboard runtime（用于作用域过滤） */
  runtime?: DashboardRuntimeContext;
  /** 可选：scope 是否处于激活状态（例如 Drawer 打开时才生效） */
  isActive?: () => boolean;
  /**
   * keydown 回调：
   * - 返回 true 表示已处理，后续 scope 不再处理
   * - 返回 void/false 则继续向下传递
   */
  onKeydown: (event: KeyboardEvent) => boolean | void;
}

const scopes: KeyboardScope[] = [];
let bound = false;

function isEventWithinRuntime(event: KeyboardEvent, runtime?: DashboardRuntimeContext): boolean {
  const root = runtime?.rootEl?.value;
  if (!root) return true;

  const activeEl = document.activeElement;
  if (activeEl && root.contains(activeEl)) return true;

  // Best-effort: composedPath is widely supported in modern browsers.
  const path = (event as any).composedPath?.() as EventTarget[] | undefined;
  if (path && path.includes(root)) return true;

  return false;
}

function ensureListener() {
  if (bound) return;
  bound = true;
  window.addEventListener(
    'keydown',
    (event) => {
      // Iterate from the end: last registered wins.
      for (let i = scopes.length - 1; i >= 0; i--) {
        const scope = scopes[i];
        if (!scope) continue;
        if (scope.runtime && !isEventWithinRuntime(event, scope.runtime)) continue;
        if (scope.isActive && !scope.isActive()) continue;

        const handled = scope.onKeydown(event);
        if (handled) return;
      }
    },
    { capture: true }
  );
}

/**
 * 注册一个键盘 scope，并返回解绑函数
 */
export function registerKeyboardScope(scope: KeyboardScope) {
  ensureListener();
  scopes.push(scope);

  return () => {
    const idx = scopes.indexOf(scope);
    if (idx >= 0) scopes.splice(idx, 1);
  };
}
