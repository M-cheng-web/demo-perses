<!-- 面板编辑器 -->
<template>
  <a-drawer v-model:open="isOpen" title="面板编辑器" :width="900" @close="handleClose">
    <a-form :model="formData" layout="vertical">
      <!-- 顶部表单 -->
      <div class="editor-header">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="面板组" required>
              <a-select v-model:value="selectedGroupId" placeholder="请选择面板组">
                <a-select-option v-for="group in panelGroups" :key="group.id" :value="group.id">
                  {{ group.title || '未命名面板组' }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="面板名称" required>
              <a-input v-model:value="formData.name" placeholder="请输入面板名称" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="面板描述">
              <a-textarea v-model:value="formData.description" placeholder="请输入面板描述" :rows="1" :auto-size="{ minRows: 1, maxRows: 4 }" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="图表类型" required>
              <a-select v-model:value="formData.type">
                <a-select-option value="timeseries">时间序列图</a-select-option>
                <a-select-option value="bar">柱状图</a-select-option>
                <a-select-option value="pie">饼图</a-select-option>
                <a-select-option value="stat">统计值</a-select-option>
                <a-select-option value="gauge">仪表盘</a-select-option>
                <a-select-option value="table">表格</a-select-option>
                <a-select-option value="heatmap">热力图</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
      </div>

      <!-- 面板预览 -->
      <div class="editor-preview">
        <PanelPreview :panel="formData" />
      </div>

      <!-- Tabs -->
      <a-tabs v-model:activeKey="activeTab" class="editor-tabs">
        <!-- 数据查询 -->
        <a-tab-pane key="query" tab="数据查询">
          <div v-for="(query, index) in formData.queries" :key="query.id" class="query-item">
            <a-card size="small" :title="`查询 ${index + 1}`">
              <template #extra>
                <a-button type="text" danger size="small" @click="removeQuery(index)"> 删除 </a-button>
              </template>

              <a-form-item label="PromQL 表达式">
                <a-textarea v-model:value="query.expr" placeholder="例如：cpu_usage" :rows="2" />
              </a-form-item>

              <a-form-item label="图例格式">
                <a-input v-model:value="query.legendFormat" placeholder="例如：{{instance}}" />
              </a-form-item>

              <a-form-item label="最小步长（秒）">
                <a-input-number v-model:value="query.minStep" :min="1" :max="300" style="width: 100%" />
              </a-form-item>
            </a-card>
          </div>

          <a-button type="dashed" block @click="addQuery">
            <template #icon>
              <PlusOutlined />
            </template>
            添加查询
          </a-button>
        </a-tab-pane>

        <!-- 图表样式 -->
        <a-tab-pane key="style" tab="图表样式">
          <!-- 根据面板类型显示不同的样式配置 -->
          <TimeSeriesChartStyles v-if="formData.type === 'timeseries'" v-model:options="formData.options" />
          <BarChartStyles v-else-if="formData.type === 'bar'" v-model:options="formData.options" />
          <GaugeChartStyles v-else-if="formData.type === 'gauge'" v-model:options="formData.options" />

          <!-- 其他类型暂无特定配置 -->
          <div v-else>
            <a-empty description="此面板类型暂无特定样式配置" />
          </div>
        </a-tab-pane>

        <!-- JSON 编辑器 -->
        <a-tab-pane key="json" tab="JSON 编辑">
          <JsonEditor v-model="jsonValue" @validate="handleJsonValidate" />
        </a-tab-pane>
      </a-tabs>
    </a-form>

    <!-- 底部按钮 -->
    <template #footer>
      <a-flex :gap="16" justify="end">
        <a-button @click="handleClose">取消</a-button>
        <a-button type="primary" @click="handleSave">保存</a-button>
      </a-flex>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
  import { ref, reactive, watch, computed } from 'vue';
  import { storeToRefs } from 'pinia';
  import { PlusOutlined } from '@ant-design/icons-vue';
  import { message } from 'ant-design-vue';
  import { useDashboardStore, useEditorStore } from '@/stores';
  import { generateId, deepClone } from '@/utils';
  import TimeSeriesChartStyles from './ChartStyles/TimeSeriesChartStyles.vue';
  import BarChartStyles from './ChartStyles/BarChartStyles.vue';
  import GaugeChartStyles from './ChartStyles/GaugeChartStyles.vue';
  import type { Panel } from '@/types';
  import JsonEditor from '@/components/Common/JsonEditor.vue';
  import PanelPreview from './PanelPreview.vue';

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();

  const { isDrawerOpen, editingPanel, editingMode, targetGroupId, originalPanelId } = storeToRefs(editorStore);
  const { currentDashboard } = storeToRefs(dashboardStore);

  const isOpen = ref(false);
  const activeTab = ref('query'); // 默认选中数据查询
  const isJsonValid = ref(true);
  const selectedGroupId = ref<string>('');

  // 获取面板组列表
  const panelGroups = computed(() => currentDashboard.value?.panelGroups || []);

  // 表单数据
  const formData = reactive<Panel>({
    id: '',
    name: '',
    description: '',
    type: 'timeseries' as any,
    queries: [],
    options: {
      chart: {
        smooth: true,
        showSymbol: false,
        line: { width: 2, type: 'solid' },
        colors: [],
      },
      legend: { show: true, position: 'bottom', orient: 'horizontal' },
      format: { unit: 'none', decimals: 2 },
    },
  });

  // JSON 编辑器值
  const jsonValue = computed({
    get: () => JSON.stringify(formData, null, 2),
    set: (value: string) => {
      try {
        const parsed = JSON.parse(value);
        Object.assign(formData, parsed);
      } catch (error) {
        // JSON 解析错误，不更新
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
    }
  });

  // 添加查询
  const addQuery = () => {
    formData.queries.push({
      id: generateId(),
      datasource: 'Prometheus',
      expr: '',
      legendFormat: '',
      minStep: 15,
      format: 'time_series',
      instant: false,
    });
  };

  // 删除查询
  const removeQuery = (index: number) => {
    formData.queries.splice(index, 1);
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
  .editor-header {
    margin-bottom: @spacing-lg;
    // padding-bottom: @spacing-md;
    border-bottom: 1px solid @border-color;
  }

  .editor-preview {
    margin-bottom: @spacing-lg;
  }

  .editor-tabs {
    :deep(.ant-tabs-nav) {
      margin-bottom: @spacing-md;
    }
  }

  .query-item {
    margin-bottom: @spacing-md;
  }
</style>
