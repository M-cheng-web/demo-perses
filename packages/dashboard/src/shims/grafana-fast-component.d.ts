declare module '@grafana-fast/component' {
  import type { ComputedRef, InjectionKey } from 'vue';

  const defaultExport: any;
  export default defaultExport;

  export const install: any;
  export const message: any;

  export const Alert: any;
  export const Button: any;
  export const Card: any;
  export const Cascader: any;
  export const Checkbox: any;
  export const CodeEditor: any;
  export const Col: any;
  export const ConfigProvider: any;
  export const DateTimeRangePicker: any;
  export const Divider: any;
  export const Drawer: any;
  export const Dropdown: any;
  export const Empty: any;
  export const Flex: any;
  export const Form: any;
  export const FormItem: any;
  export const Input: any;
  export const InputNumber: any;
  export const List: any;
  export const Loading: any;
  export const Menu: any;
  export const MenuItem: any;
  export const Modal: any;
  export const Pagination: any;
  export const Panel: any;
  export const Popconfirm: any;
  export const Row: any;
  export const Segmented: any;
  export const Select: any;
  export const Slider: any;
  export const Space: any;
  export const Spin: any;
  export const Switch: any;
  export const TabPane: any;
  export const Table: any;
  export const Tabs: any;
  export const Tag: any;
  export const Skeleton: any;
  export const Textarea: any;
  export const TimeRangePicker: any;
  export const Tooltip: any;
  export const VirtualList: any;
  export const VirtualTable: any;

  export const gfAntdTokensCssVar: any;
  export const gfAntdTokensCssVarJson: any;

  export const usePagination: any;

  export type TableProps = any;
  export type TableColumnType = any;

  export type GfTheme = 'light' | 'dark';
  export type GfColorScheme = 'light' | 'dark' | undefined;
  export interface GfThemeContext {
    theme: ComputedRef<GfTheme>;
    colorScheme: ComputedRef<GfColorScheme>;
    themeClass: ComputedRef<string | undefined>;
  }

  export const GF_THEME_CONTEXT_KEY: InjectionKey<GfThemeContext>;
}
