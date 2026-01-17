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

let lockCount = 0;
let prevOverflow: string | null = null;
let prevPaddingRight: string | null = null;

function getScrollbarWidth(): number {
  if (typeof window === 'undefined') return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

/**
 * 锁定 body 滚动（可重复调用）
 */
export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;

  lockCount += 1;
  if (lockCount !== 1) return;

  const body = document.body;
  prevOverflow = body.style.overflow;
  prevPaddingRight = body.style.paddingRight;

  const scrollbarWidth = getScrollbarWidth();
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    const base = prevPaddingRight && prevPaddingRight.trim() ? prevPaddingRight : '0px';
    body.style.paddingRight = `calc(${base} + ${scrollbarWidth}px)`;
  }
}

/**
 * 解锁 body 滚动（与 lockBodyScroll 成对使用）
 */
export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount <= 0) return;

  lockCount -= 1;
  if (lockCount !== 0) return;

  const body = document.body;
  if (prevOverflow !== null) body.style.overflow = prevOverflow;
  if (prevPaddingRight !== null) body.style.paddingRight = prevPaddingRight;
  prevOverflow = null;
  prevPaddingRight = null;
}
