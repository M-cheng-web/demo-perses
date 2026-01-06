<!-- 面板编辑器 -->
<template>
  <Drawer v-model:open="isOpen" title="面板编辑器" :width="900" :keyboard="false" :maskClosable="false" @close="handleClose">
    <Form :model="formData" layout="vertical">
      <!-- 顶部表单 -->
      <div :class="bem('header')">
        <Row :gutter="16">
          <Col :span="12">
            <FormItem label="面板组" required>
              <Select :options="panelGroups" v-model:value="selectedGroupId" placeholder="请选择面板组" />
            </FormItem>
          </Col>
          <Col :span="12">
            <FormItem label="面板名称" required>
              <Input v-model:value="formData.name" placeholder="请输入面板名称" />
            </FormItem>
          </Col>
        </Row>
        <Row :gutter="16">
          <Col :span="12">
            <FormItem label="面板描述">
              <Textarea v-model:value="formData.description" placeholder="请输入面板描述" :rows="1" :auto-size="{ minRows: 1, maxRows: 4 }" />
            </FormItem>
          </Col>
          <Col :span="12">
            <FormItem label="图表类型" required>
              <Select :options="panelTypeOptions" v-model:value="formData.type" />
            </FormItem>
          </Col>
        </Row>
      </div>

      <!-- 面板预览 -->
      <div :class="bem('preview')">
        <PanelPreview ref="panelPreviewRef" :panel="formData" :auto-execute="false" />
      </div>

      <!-- Tabs -->
      <Tabs v-model:activeKey="activeTab" :class="bem('tabs')">
        <!-- 数据查询 -->
        <TabPane key="query" tab="数据查询">
          <DataQueryTab ref="dataQueryTabRef" :queries="formData.queries" @update:queries="handleQueriesUpdate" @execute="handleExecuteQuery" />
        </TabPane>

        <!-- 图表样式 -->
        <TabPane key="style" tab="图表样式">
          <!-- 根据面板类型显示不同的样式配置 -->
          <component v-if="styleComponent" :is="styleComponent" v-model:options="formData.options" />
          <div v-else>
            <Empty description="此面板类型暂无特定样式配置" />
          </div>
        </TabPane>

        <!-- JSON 编辑器 -->
        <TabPane key="json" tab="JSON 编辑">
          <JsonEditor v-model="jsonValue" @validate="handleJsonValidate" />
        </TabPane>
      </Tabs>
    </Form>

    <!-- 底部按钮 -->
    <template #footer>
      <Flex :gap="16" justify="end">
        <Button @click="handleClose">取消</Button>
        <Button type="primary" @click="handleSave">保存</Button>
      </Flex>
    </template>
  </Drawer>
</template>

<script setup lang="ts">
  import { ref, reactive, watch, computed } from 'vue';
  import { storeToRefs } from 'pinia';
  import { Drawer, Form, FormItem, Select, Input, Textarea, Button, Tabs, TabPane, Empty, Row, Col, Flex, message } from 'ant-design-vue';
  import { useDashboardStore, useEditorStore } from '@/stores';
  import { generateId, deepClone, createNamespace } from '@/utils';
  import { PanelType, PANEL_TYPE_OPTIONS } from '@/enums/panelType';
  import TimeSeriesChartStyles from './ChartStyles/TimeSeriesChartStyles.vue';
  import BarChartStyles from './ChartStyles/BarChartStyles.vue';
  import PieChartStyles from './ChartStyles/PieChartStyles.vue';
  import GaugeChartStyles from './ChartStyles/GaugeChartStyles.vue';
  import HeatmapChartStyles from './ChartStyles/HeatmapChartStyles.vue';
  import StatPanelStyles from './ChartStyles/StatPanelStyles.vue';
  import TableChartStyles from './ChartStyles/TableChartStyles.vue';
  import type { Panel } from '@/types';
  import JsonEditor from '@/components/Common/JsonEditor.vue';
  import PanelPreview from './PanelPreview.vue';
  import DataQueryTab from './DataQueryTab.vue';
  import { getDefaultTimeSeriesOptions } from './ChartStylesDefaultOptions/timeSeriesDefaultOptions';
  import { getDefaultBarChartOptions } from './ChartStylesDefaultOptions/barChartDefaultOptions';
  import { getDefaultPieChartOptions } from './ChartStylesDefaultOptions/pieChartDefaultOptions';
  import { getDefaultGaugeChartOptions } from './ChartStylesDefaultOptions/gaugeChartDefaultOptions';
  import { getDefaultStatPanelOptions } from './ChartStylesDefaultOptions/statPanelDefaultOptions';
  import { getDefaultTableChartOptions } from './ChartStylesDefaultOptions/tableChartDefaultOptions';
  import { getDefaultHeatmapChartOptions } from './ChartStylesDefaultOptions/heatmapChartDefaultOptions';

  const [_, bem] = createNamespace('panel-editor-drawer');

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();

  const { isDrawerOpen, editingPanel, editingMode, targetGroupId, originalPanelId } = storeToRefs(editorStore);
  const { currentDashboard } = storeToRefs(dashboardStore);

  const isOpen = ref(false);
  const activeTab = ref('query'); // 默认选中数据查询
  const isJsonValid = ref(true);
  const selectedGroupId = ref<string>('');
  const panelPreviewRef = ref<InstanceType<typeof PanelPreview>>();
  const dataQueryTabRef = ref<InstanceType<typeof DataQueryTab>>();

  // 获取面板组列表
  const panelGroups = computed(() => currentDashboard.value?.panelGroups || []);

  // 面板类型选项
  const panelTypeOptions = PANEL_TYPE_OPTIONS;

  // 样式配置组件映射
  const styleComponentMap: Record<string, any> = {
    [PanelType.TIMESERIES]: TimeSeriesChartStyles,
    [PanelType.BAR]: BarChartStyles,
    [PanelType.PIE]: PieChartStyles,
    [PanelType.STAT]: StatPanelStyles,
    [PanelType.TABLE]: TableChartStyles,
    [PanelType.GAUGE]: GaugeChartStyles,
    [PanelType.HEATMAP]: HeatmapChartStyles,
  };

  // 根据面板类型获取样式配置组件
  const styleComponent = computed(() => styleComponentMap[formData.type]);

  // 根据面板类型获取默认配置
  const getDefaultOptionsByType = (type: string): any => {
    const defaultOptionsMap: Record<string, any> = {
      [PanelType.TIMESERIES]: getDefaultTimeSeriesOptions,
      [PanelType.BAR]: getDefaultBarChartOptions,
      [PanelType.PIE]: getDefaultPieChartOptions,
      [PanelType.STAT]: getDefaultStatPanelOptions,
      [PanelType.TABLE]: getDefaultTableChartOptions,
      [PanelType.GAUGE]: getDefaultGaugeChartOptions,
      [PanelType.HEATMAP]: getDefaultHeatmapChartOptions,
    };

    const getDefaultFn = defaultOptionsMap[type];
    return getDefaultFn ? getDefaultFn() : {};
  };

  // 表单数据
  const formData = reactive<any>({
    id: '',
    name: '',
    description: '',
    type: 'timeseries' as any,
    queries: [],
    options: {
      ...deepClone(getDefaultTimeSeriesOptions()),
    },
  });

  // JSON 编辑器值 - 优化为实时双向绑定
  const jsonValue = computed({
    get: () => JSON.stringify(formData, null, 2),
    set: (value: string) => {
      try {
        const parsed = JSON.parse(value);
        // 直接更新 formData，触发预览更新
        Object.assign(formData, parsed);
        isJsonValid.value = true;
      } catch (error) {
        // JSON 解析错误，设置验证状态为无效
        isJsonValid.value = false;
      }
    },
  });

  const handleJsonValidate = (isValid: boolean) => {
    isJsonValid.value = isValid;
  };

  // 监听 drawer 打开
  watch(isDrawerOpen, (open) => {
    isOpen.value = open;
    if (open) {
      if (editingPanel.value) {
        Object.assign(formData, deepClone(editingPanel.value));
      }
      // 初始化选中的面板组
      selectedGroupId.value = targetGroupId.value || '';

      // 如果是编辑模式且有查询配置，初始化时自动执行一次查询
      if (editingMode.value === 'edit' && formData.queries && formData.queries.length > 0) {
        // 使用 nextTick 确保组件已完全渲染
        setTimeout(() => {
          panelPreviewRef.value?.executeQueries();
        }, 100);
      }
    }
  });

  // 监听面板类型变化，自动切换到对应的默认配置
  watch(
    () => formData.type,
    (newType, oldType) => {
      // 只有在类型真正改变时才重置配置
      if (newType && newType !== oldType) {
        const defaultOptions = getDefaultOptionsByType(newType);
        // 使用 deepClone 确保是独立的对象
        formData.options = deepClone(defaultOptions);
      }
    }
  );

  // 处理查询更新
  const handleQueriesUpdate = (queries: any[]) => {
    formData.queries = queries;
  };

  // 执行查询
  const handleExecuteQuery = () => {
    // 获取最新的查询数据（但不更新 formData.queries，避免触发重新初始化）
    let queries: any[] = [];
    if (dataQueryTabRef.value) {
      queries = dataQueryTabRef.value.getQueries();
    }

    // 基本校验
    if (!queries || queries.length === 0) {
      message.warning('请至少添加一个查询');
      return;
    }

    // 临时更新 formData.queries 用于查询执行，但不触发 watch
    // 使用 Object.defineProperty 直接赋值，避免响应式触发
    const tempQueries = formData.queries;
    formData.queries = queries;

    // 执行查询并更新预览
    message.loading({ content: '正在执行查询...', key: 'executeQuery', duration: 0 });

    // 调用预览组件的查询方法
    panelPreviewRef.value
      ?.executeQueries()
      .then(() => {
        message.success({ content: '查询执行成功', key: 'executeQuery', duration: 2 });
        // 查询成功后，保留更新的 queries
      })
      .catch((error) => {
        message.error({ content: `查询执行失败: ${error.message || '未知错误'}`, key: 'executeQuery', duration: 3 });
        // 查询失败时，恢复原来的 queries
        formData.queries = tempQueries;
      });
  };

  // 关闭
  const handleClose = () => {
    editorStore.closeEditor();
    activeTab.value = 'query';
  };

  // 保存
  const handleSave = () => {
    // 验证
    if (!formData.name) {
      message.error('请输入面板名称');
      return;
    }

    if (!selectedGroupId.value) {
      message.error('请选择面板组');
      return;
    }

    if (!isJsonValid.value) {
      message.error('JSON 格式错误，请检查');
      return;
    }

    if (formData.queries.length === 0) {
      message.warning('建议至少添加一个查询');
    }

    try {
      if (editingMode.value === 'create') {
        // 创建新面板
        const newPanel: Panel = {
          ...deepClone(formData),
          id: generateId(),
        };
        dashboardStore.addPanel(selectedGroupId.value, newPanel);
        message.success('面板创建成功');
      } else if (originalPanelId?.value) {
        // 更新面板
        dashboardStore.updatePanel(selectedGroupId.value, originalPanelId.value, formData);
        message.success('面板更新成功');
      }

      handleClose();
    } catch (error) {
      message.error('保存失败');
      console.error(error);
    }
  };
</script>

<style scoped lang="less">
  .dp-panel-editor-drawer {
    &__header {
      margin-bottom: @spacing-lg;
      // padding-bottom: @spacing-md;
      border-bottom: 1px solid @border-color;
    }

    &__preview {
      margin-bottom: @spacing-lg;
    }

    &__tabs {
      :deep(.ant-tabs-nav) {
        margin-bottom: @spacing-md;
      }
    }
  }
</style>
