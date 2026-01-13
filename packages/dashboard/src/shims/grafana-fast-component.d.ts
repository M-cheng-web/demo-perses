declare module '@grafana-fast/component' {
  import type { Plugin } from 'vue';

  export const Button: any;
  export const Tabs: any;
  export const TabPane: any;
  export const Tag: any;
  export const Empty: any;
  export const Loading: any;
  export const Alert: any;

  export const Input: any;
  export const Textarea: any;
  export const Select: any;
  export const Switch: any;
  export const Checkbox: any;
  export const Segmented: any;
  export const InputNumber: any;
  export const Slider: any;
  export const Cascader: any;
  export const Form: any;
  export const FormItem: any;

  export const Space: any;
  export const Flex: any;
  export const Row: any;
  export const Col: any;
  export const Divider: any;
  export const ConfigProvider: any;

  export const Dropdown: any;
  export const Menu: any;
  export const MenuItem: any;

  export const Modal: any;
  export const Drawer: any;
  export const Popconfirm: any;
  export const Tooltip: any;
  export const Spin: any;
  export const Result: any;

  export const Table: any;
  export const Card: any;

  export type TableColumnType = any;
  export type TableProps = any;

  export const message: {
    success: (content: any) => void;
    error: (content: any) => void;
    warning: (content: any) => void;
    info: (content: any) => void;
    loading: (options: any) => void;
  };

  const plugin: Plugin;
  export default plugin;
}
