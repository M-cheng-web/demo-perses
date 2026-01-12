import './styles/theme.less';
import './styles/controls.less';
import './styles/message.less';
import type { App, Component } from 'vue';

// base
export { default as Button } from './components/base/Button.vue';
export { default as Tabs } from './components/base/Tabs.vue';
export { default as TabPane } from './components/base/TabPane.vue';
export { default as Tag } from './components/base/Tag.vue';
export { default as Empty } from './components/base/Empty.vue';
export { default as Loading } from './components/base/Loading.vue';
export { default as InputGroup } from './components/base/InputGroup.vue';
export { default as Alert } from './components/base/Alert.vue';

// form
export { default as Input } from './components/form/Input.vue';
export { default as Textarea } from './components/form/Textarea.vue';
export { default as Select } from './components/form/Select.vue';
export { default as Switch } from './components/form/Switch.vue';
export { default as Checkbox } from './components/form/Checkbox.vue';
export { default as Segmented } from './components/form/Segmented.vue';
export { default as InputNumber } from './components/form/InputNumber.vue';
export { default as Slider } from './components/form/Slider.vue';
export { default as Cascader } from './components/form/Cascader.vue';
export { default as Form } from './components/form/Form.vue';
export { default as FormItem } from './components/form/FormItem.vue';

// layout
export { default as Space } from './components/layout/Space.vue';
export { default as Flex } from './components/layout/Flex.vue';
export { default as Row } from './components/layout/Row.vue';
export { default as Col } from './components/layout/Col.vue';
export { default as Divider } from './components/layout/Divider.vue';
export { default as ConfigProvider } from './components/layout/ConfigProvider.vue';

// navigation
export { default as Dropdown } from './components/navigation/Dropdown.vue';
export { default as Menu } from './components/navigation/Menu.vue';
export { default as MenuItem } from './components/navigation/MenuItem.vue';

// feedback
export { default as Modal } from './components/feedback/Modal.vue';
export { default as Drawer } from './components/feedback/Drawer.vue';
export { default as Popconfirm } from './components/feedback/Popconfirm.vue';
export { default as Tooltip } from './components/feedback/Tooltip.vue';
export { default as Spin } from './components/feedback/Spin.vue';
export { default as Result } from './components/feedback/Result.vue';

// data display
export { default as Table } from './components/data/Table.vue';
export { default as Card } from './components/data/Card.vue';

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
import InputGroupComp from './components/base/InputGroup.vue';
import AlertComp from './components/base/Alert.vue';
import InputComp from './components/form/Input.vue';
import TextareaComp from './components/form/Textarea.vue';
import SelectComp from './components/form/Select.vue';
import SwitchComp from './components/form/Switch.vue';
import CheckboxComp from './components/form/Checkbox.vue';
import SegmentedComp from './components/form/Segmented.vue';
import InputNumberComp from './components/form/InputNumber.vue';
import SliderComp from './components/form/Slider.vue';
import CascaderComp from './components/form/Cascader.vue';
import FormComp from './components/form/Form.vue';
import FormItemComp from './components/form/FormItem.vue';
import SpaceComp from './components/layout/Space.vue';
import FlexComp from './components/layout/Flex.vue';
import RowComp from './components/layout/Row.vue';
import ColComp from './components/layout/Col.vue';
import DividerComp from './components/layout/Divider.vue';
import ConfigProviderComp from './components/layout/ConfigProvider.vue';
import DropdownComp from './components/navigation/Dropdown.vue';
import MenuComp from './components/navigation/Menu.vue';
import MenuItemComp from './components/navigation/MenuItem.vue';
import ModalComp from './components/feedback/Modal.vue';
import DrawerComp from './components/feedback/Drawer.vue';
import PopconfirmComp from './components/feedback/Popconfirm.vue';
import TooltipComp from './components/feedback/Tooltip.vue';
import SpinComp from './components/feedback/Spin.vue';
import ResultComp from './components/feedback/Result.vue';
import TableComp from './components/data/Table.vue';
import CardComp from './components/data/Card.vue';

// Avoid deep/recursive inferred union types from many SFC imports (Volar `__VLS_WithSlots...`)
// by widening the array element type explicitly.
const components: Component[] = [
  ButtonComp,
  TabsComp,
  TabPaneComp,
  TagComp,
  EmptyComp,
  LoadingComp,
  InputGroupComp,
  AlertComp,
  InputComp,
  TextareaComp,
  SelectComp,
  SwitchComp,
  CheckboxComp,
  SegmentedComp,
  InputNumberComp,
  SliderComp,
  CascaderComp,
  FormComp,
  FormItemComp,
  SpaceComp,
  FlexComp,
  RowComp,
  ColComp,
  DividerComp,
  ConfigProviderComp,
  DropdownComp,
  MenuComp,
  MenuItemComp,
  ModalComp,
  DrawerComp,
  PopconfirmComp,
  TooltipComp,
  SpinComp,
  ResultComp,
  TableComp,
  CardComp,
];

export const install = (app: App) => {
  components.forEach((comp) => {
    const name = (comp as any).name;
    if (name) {
      app.component(name, comp);
    }
  });
  return app;
};

export default {
  install,
};
