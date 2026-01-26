export type AntdTokenValue = string | number;

export type AntdTokenMap = Record<string, AntdTokenValue>;

/**
 * 面向 Ant Design v5 的 token 映射表（值指向 @grafana-fast/component 的 CSS 变量）。
 *
 * 目的：
 * - 组件库继续作为唯一的 token 真相来源
 * - 下游应用仍可把这些 token 传给 Ant Design / Ant Design Vue 的 ConfigProvider
 */
export const gfAntdTokensCssVar: AntdTokenMap = {
  // 品牌 / 状态色
  colorPrimary: 'var(--gf-color-primary)',
  colorInfo: 'var(--gf-color-primary)',
  colorSuccess: 'var(--gf-color-success)',
  colorWarning: 'var(--gf-color-warning)',
  colorError: 'var(--gf-color-danger)',

  // 链接
  colorLink: 'var(--gf-color-primary)',
  colorLinkHover: 'var(--gf-color-primary-hover)',
  colorLinkActive: 'var(--gf-color-primary-active)',

  // 文本
  colorTextBase: 'var(--gf-color-text)',
  colorText: 'var(--gf-color-text)',
  colorTextSecondary: 'var(--gf-color-text-secondary)',
  colorTextTertiary: 'var(--gf-color-text-tertiary)',
  colorTextQuaternary: 'var(--gf-color-text-disabled)',
  colorTextDisabled: 'var(--gf-color-text-disabled)',

  // 背景
  colorBgBase: 'var(--gf-color-bg)',
  colorBgLayout: 'var(--gf-color-bg)',
  colorBgContainer: 'var(--gf-color-surface)',
  colorBgElevated: 'var(--gf-color-surface-raised)',
  colorBgSpotlight: 'var(--gf-color-tooltip-bg)',
  colorBgMask: 'var(--gf-color-mask)',

  // 边框
  colorBorder: 'var(--gf-color-border)',
  colorBorderSecondary: 'var(--gf-color-border-muted)',

  // 填充（hover/选中）
  colorFill: 'var(--gf-color-fill)',
  colorFillSecondary: 'var(--gf-color-fill-secondary)',
  colorFillTertiary: 'var(--gf-color-fill-tertiary)',
  colorFillQuaternary: 'var(--gf-color-fill-quaternary)',

  // 圆角
  borderRadius: 'var(--gf-radius-md)',
  borderRadiusSM: 'var(--gf-radius-sm)',
  borderRadiusLG: 'var(--gf-radius-lg)',

  // 排版
  fontFamily: 'var(--gf-font-family)',
  fontSize: 'var(--gf-font-size-md)',
  fontSizeSM: 'var(--gf-font-size-sm)',
  fontSizeLG: 'var(--gf-font-size-lg)',
  lineHeight: 'var(--gf-line-height)',

  // 控件
  controlHeight: 'var(--gf-control-height-md)',
  controlHeightSM: 'var(--gf-control-height-sm)',
  controlHeightLG: 'var(--gf-control-height-lg)',

  // 阴影（谨慎使用；遵循“克制阴影”的 ops 风格）
  boxShadow: 'var(--gf-shadow-2)',
  boxShadowSecondary: 'var(--gf-shadow-1)',

  // 动效
  motionDurationFast: 'var(--gf-motion-fast)',
  motionDurationMid: 'var(--gf-motion-normal)',
  motionEaseInOut: 'var(--gf-easing)',
};
