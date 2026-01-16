/**
 * @grafana-fast/component 包入口
 *
 * 说明：
 * - 这里统一导出所有 UI 组件，并提供 `install(app)` 作为 Vue 插件入口
 * - 业务侧可以按需 import 单个组件，也可以 app.use(Component) 全量注册
 */
import './styles/theme.less';
import './styles/controls.less';
import './styles/message.less';
import type { App, Component } from 'vue';

// 基础组件
export { default as Button } from './components/base/Button.vue';
export { default as Tabs } from './components/base/Tabs.vue';
export { default as TabPane } from './components/base/TabPane.vue';
export { default as Tag } from './components/base/Tag.vue';
export { default as Empty } from './components/base/Empty.vue';
export { default as Loading } from './components/base/Loading.vue';
export { default as Alert } from './components/base/Alert.vue';
export { default as CodeEditor } from './components/base/CodeEditor.vue';

// 表单组件
export { default as Input } from './components/form/Input.vue';
export { default as Textarea } from './components/form/Textarea.vue';
export { default as Select } from './components/form/Select.vue';
export { default as Switch } from './components/form/Switch.vue';
export { default as Checkbox } from './components/form/Checkbox.vue';
export { default as Segmented } from './components/form/Segmented.vue';
export { default as InputNumber } from './components/form/InputNumber.vue';
export { default as Slider } from './components/form/Slider.vue';
export { default as Cascader } from './components/form/Cascader.vue';
export { default as TimeRangePicker } from './components/form/TimeRangePicker.vue';
export { default as DateTimeRangePicker } from './components/form/DateTimeRangePicker.vue';
export { default as Form } from './components/form/Form.vue';
export { default as FormItem } from './components/form/FormItem.vue';

// 布局组件
export { default as Space } from './components/layout/Space.vue';
export { default as Flex } from './components/layout/Flex.vue';
export { default as Row } from './components/layout/Row.vue';
export { default as Col } from './components/layout/Col.vue';
export { default as Divider } from './components/layout/Divider.vue';
export { default as ConfigProvider } from './components/layout/ConfigProvider.vue';
export { default as Panel } from './components/layout/Panel.vue';

// 导航组件
export { default as Dropdown } from './components/navigation/Dropdown.vue';
export { default as Menu } from './components/navigation/Menu.vue';
export { default as MenuItem } from './components/navigation/MenuItem.vue';

// 反馈组件
export { default as Modal } from './components/feedback/Modal.vue';
export { default as Drawer } from './components/feedback/Drawer.vue';
export { default as Popconfirm } from './components/feedback/Popconfirm.vue';
export { default as Tooltip } from './components/feedback/Tooltip.vue';
export { default as Spin } from './components/feedback/Spin.vue';

// 数据展示组件
export { default as Table } from './components/data/Table.vue';
export { default as VirtualList } from './components/data/VirtualList.vue';
export { default as VirtualTable } from './components/data/VirtualTable.vue';
export { default as Card } from './components/data/Card.vue';
export { default as List } from './components/data/List.vue';

export { message } from './message';
export * from './types';
export { gfAntdTokensCssVar } from './theme/antdTokens';
export { default as gfAntdTokensCssVarJson } from './theme/antdTokens.cssvar.json';

import ButtonComp from './components/base/Button.vue';
import TabsComp from './components/base/Tabs.vue';
import TabPaneComp from './components/base/TabPane.vue';
import TagComp from './components/base/Tag.vue';
import EmptyComp from './components/base/Empty.vue';
import LoadingComp from './components/base/Loading.vue';
import AlertComp from './components/base/Alert.vue';
import CodeEditorComp from './components/base/CodeEditor.vue';
import InputComp from './components/form/Input.vue';
import TextareaComp from './components/form/Textarea.vue';
import SelectComp from './components/form/Select.vue';
import SwitchComp from './components/form/Switch.vue';
import CheckboxComp from './components/form/Checkbox.vue';
import SegmentedComp from './components/form/Segmented.vue';
import InputNumberComp from './components/form/InputNumber.vue';
import SliderComp from './components/form/Slider.vue';
import CascaderComp from './components/form/Cascader.vue';
import TimeRangePickerComp from './components/form/TimeRangePicker.vue';
import DateTimeRangePickerComp from './components/form/DateTimeRangePicker.vue';
import FormComp from './components/form/Form.vue';
import FormItemComp from './components/form/FormItem.vue';
import SpaceComp from './components/layout/Space.vue';
import FlexComp from './components/layout/Flex.vue';
import RowComp from './components/layout/Row.vue';
import ColComp from './components/layout/Col.vue';
import DividerComp from './components/layout/Divider.vue';
import ConfigProviderComp from './components/layout/ConfigProvider.vue';
import PanelComp from './components/layout/Panel.vue';
import DropdownComp from './components/navigation/Dropdown.vue';
import MenuComp from './components/navigation/Menu.vue';
import MenuItemComp from './components/navigation/MenuItem.vue';
import ModalComp from './components/feedback/Modal.vue';
import DrawerComp from './components/feedback/Drawer.vue';
import PopconfirmComp from './components/feedback/Popconfirm.vue';
import TooltipComp from './components/feedback/Tooltip.vue';
import SpinComp from './components/feedback/Spin.vue';
import TableComp from './components/data/Table.vue';
import VirtualListComp from './components/data/VirtualList.vue';
import VirtualTableComp from './components/data/VirtualTable.vue';
import CardComp from './components/data/Card.vue';
import ListComp from './components/data/List.vue';

const exportedComponents = {
  Button: ButtonComp,
  Tabs: TabsComp,
  TabPane: TabPaneComp,
  Tag: TagComp,
  Empty: EmptyComp,
  Loading: LoadingComp,
  Alert: AlertComp,
  CodeEditor: CodeEditorComp,
  Input: InputComp,
  Textarea: TextareaComp,
  Select: SelectComp,
  Switch: SwitchComp,
  Checkbox: CheckboxComp,
  Segmented: SegmentedComp,
  InputNumber: InputNumberComp,
  Slider: SliderComp,
  Cascader: CascaderComp,
  TimeRangePicker: TimeRangePickerComp,
  DateTimeRangePicker: DateTimeRangePickerComp,
  Form: FormComp,
  FormItem: FormItemComp,
  Space: SpaceComp,
  Flex: FlexComp,
  Row: RowComp,
  Col: ColComp,
  Divider: DividerComp,
  ConfigProvider: ConfigProviderComp,
  Panel: PanelComp,
  Dropdown: DropdownComp,
  Menu: MenuComp,
  MenuItem: MenuItemComp,
  Modal: ModalComp,
  Drawer: DrawerComp,
  Popconfirm: PopconfirmComp,
  Tooltip: TooltipComp,
  Spin: SpinComp,
  Table: TableComp,
  VirtualList: VirtualListComp,
  VirtualTable: VirtualTableComp,
  Card: CardComp,
  List: ListComp,
} as const;

// 避免因大量 SFC 导入导致的复杂递归类型推导（Volar `__VLS_WithSlots...`）
// 这里显式把 components 的元素类型拓宽为 Component。
const components: Component[] = Object.values(exportedComponents);

/**
 * Vue 插件安装入口：注册所有组件为全局组件
 */
export const install = (app: App) => {
  components.forEach((comp) => {
    const name = (comp as any).name;
    if (name) app.component(name, comp);
  });
  Object.entries(exportedComponents).forEach(([exportName, comp]) => {
    if (!exportName) return;
    app.component(exportName, comp);
  });
  return app;
};

export default {
  install,
};
