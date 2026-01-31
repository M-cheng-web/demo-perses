/**
 * Body 滚动锁
 *
 * 典型场景：
 * - Modal / Drawer 打开时锁定 body 滚动，关闭时恢复
 *
 * 注意：
 * - 内部用引用计数（lockCount）避免多个弹层互相干扰
 * - 运行在非浏览器环境（SSR）时会直接 no-op
 */

let bodyLockCount = 0;
let prevBodyOverflow: string | null = null;
let prevBodyPaddingRight: string | null = null;

type ElementLockState = {
  count: number;
  prevOverflow: string | null;
};

const elementLocks = new Map<HTMLElement, ElementLockState>();

function getScrollbarWidth(): number {
  if (typeof window === 'undefined') return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

/**
 * 锁定 body 滚动（可重复调用）
 */
export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;

  bodyLockCount += 1;
  if (bodyLockCount !== 1) return;

  const body = document.body;
  prevBodyOverflow = body.style.overflow;
  prevBodyPaddingRight = body.style.paddingRight;

  const scrollbarWidth = getScrollbarWidth();
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    const base = prevBodyPaddingRight && prevBodyPaddingRight.trim() ? prevBodyPaddingRight : '0px';
    body.style.paddingRight = `calc(${base} + ${scrollbarWidth}px)`;
  }
}

/**
 * 解锁 body 滚动（与 lockBodyScroll 成对使用）
 */
export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (bodyLockCount <= 0) return;

  bodyLockCount -= 1;
  if (bodyLockCount !== 0) return;

  const body = document.body;
  if (prevBodyOverflow !== null) body.style.overflow = prevBodyOverflow;
  if (prevBodyPaddingRight !== null) body.style.paddingRight = prevBodyPaddingRight;
  prevBodyOverflow = null;
  prevBodyPaddingRight = null;
}

/**
 * 锁定滚动（支持任意元素，body 为默认）
 *
 * 说明：
 * - 对嵌入式场景：建议锁定 dashboard 自身的滚动容器，而不是宿主 body
 * - 内部同样使用引用计数，避免多个弹层互相干扰
 */
export function lockScroll(target?: HTMLElement | null): void {
  if (typeof document === 'undefined') return;

  const el = target ?? document.body;
  if (el === document.body || el === document.documentElement) {
    lockBodyScroll();
    return;
  }

  const existing = elementLocks.get(el);
  if (!existing) {
    elementLocks.set(el, { count: 1, prevOverflow: el.style.overflow });
    el.style.overflow = 'hidden';
    return;
  }

  existing.count += 1;
}

export function unlockScroll(target?: HTMLElement | null): void {
  if (typeof document === 'undefined') return;

  const el = target ?? document.body;
  if (el === document.body || el === document.documentElement) {
    unlockBodyScroll();
    return;
  }

  const existing = elementLocks.get(el);
  if (!existing) return;

  existing.count -= 1;
  if (existing.count > 0) return;

  if (existing.prevOverflow !== null) el.style.overflow = existing.prevOverflow;
  elementLocks.delete(el);
}
