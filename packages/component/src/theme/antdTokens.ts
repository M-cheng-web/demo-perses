export type AntdTokenValue = string | number;

export type AntdTokenMap = Record<string, AntdTokenValue>;

/**
 * Ant Design v5-compatible token map that points to @grafana-fast/component CSS variables.
 *
 * This keeps the component library as the single source of truth while allowing downstream
 * apps to pass these tokens into Ant Design / Ant Design Vue ConfigProvider.
 */
export const gfAntdTokensCssVar: AntdTokenMap = {
  // Brand / status
  colorPrimary: 'var(--gf-color-primary)',
  colorInfo: 'var(--gf-color-primary)',
  colorSuccess: 'var(--gf-color-success)',
  colorWarning: 'var(--gf-color-warning)',
  colorError: 'var(--gf-color-danger)',

  // Link
  colorLink: 'var(--gf-color-primary)',
  colorLinkHover: 'var(--gf-color-primary-hover)',
  colorLinkActive: 'var(--gf-color-primary-active)',

  // Text
  colorTextBase: 'var(--gf-color-text)',
  colorText: 'var(--gf-color-text)',
  colorTextSecondary: 'var(--gf-color-text-secondary)',
  colorTextTertiary: 'var(--gf-color-text-tertiary)',
  colorTextQuaternary: 'var(--gf-color-text-disabled)',
  colorTextDisabled: 'var(--gf-color-text-disabled)',

  // Backgrounds
  colorBgBase: 'var(--gf-color-bg)',
  colorBgLayout: 'var(--gf-color-bg)',
  colorBgContainer: 'var(--gf-color-surface)',
  colorBgElevated: 'var(--gf-color-surface-raised)',
  colorBgSpotlight: 'var(--gf-color-tooltip-bg)',
  colorBgMask: 'var(--gf-color-mask)',

  // Borders
  colorBorder: 'var(--gf-color-border)',
  colorBorderSecondary: 'var(--gf-color-border-muted)',

  // Fills (hover/selected)
  colorFill: 'var(--gf-color-fill)',
  colorFillSecondary: 'var(--gf-color-fill-secondary)',
  colorFillTertiary: 'var(--gf-color-fill-tertiary)',
  colorFillQuaternary: 'var(--gf-color-fill-quaternary)',

  // Radius
  borderRadius: 'var(--gf-radius-md)',
  borderRadiusSM: 'var(--gf-radius-sm)',
  borderRadiusLG: 'var(--gf-radius-lg)',

  // Typography
  fontFamily: 'var(--gf-font-family)',
  fontSize: 'var(--gf-font-size-md)',
  fontSizeSM: 'var(--gf-font-size-sm)',
  fontSizeLG: 'var(--gf-font-size-lg)',
  lineHeight: 'var(--gf-line-height)',

  // Controls
  controlHeight: 'var(--gf-control-height-md)',
  controlHeightSM: 'var(--gf-control-height-sm)',
  controlHeightLG: 'var(--gf-control-height-lg)',

  // Shadow (use sparingly; align with ops "restrained shadow" guideline)
  boxShadow: 'var(--gf-shadow-2)',
  boxShadowSecondary: 'var(--gf-shadow-1)',

  // Motion
  motionDurationFast: 'var(--gf-motion-fast)',
  motionDurationMid: 'var(--gf-motion-normal)',
  motionEaseInOut: 'var(--gf-easing)',
};
