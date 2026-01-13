let lockCount = 0;
let prevOverflow: string | null = null;
let prevPaddingRight: string | null = null;

const getScrollbarWidth = () => {
  if (typeof window === 'undefined') return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
};

export const lockBodyScroll = () => {
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
};

export const unlockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  if (lockCount <= 0) return;

  lockCount -= 1;
  if (lockCount !== 0) return;

  const body = document.body;
  if (prevOverflow !== null) body.style.overflow = prevOverflow;
  if (prevPaddingRight !== null) body.style.paddingRight = prevPaddingRight;
  prevOverflow = null;
  prevPaddingRight = null;
};
