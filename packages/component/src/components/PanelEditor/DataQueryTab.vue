<!-- 数据查询标签页 - 支持 QueryBuilder 和手动 PromQL 两种模式 -->
<template>
  <div :class="bem()">
    <!-- 顶部操作栏 -->
    <div :class="bem('header')">
      <div :class="bem('header-left')">
        <div :class="bem('title-block')">
          <div :class="bem('title')">数据查询</div>
          <div :class="bem('controls')">
            <!-- 模式切换 -->
            <div :class="bem('control-chip')">
              <span :class="bem('chip-label')">模式</span>
              <RadioGroup v-model:value="queryMode" button-style="solid" size="small">
                <RadioButton value="builder">
                  <BlockOutlined />
                  QueryBuilder
                </RadioButton>
                <RadioButton value="code">
                  <CodeOutlined />
                  Code
                </RadioButton>
              </RadioGroup>
            </div>

            <!-- 查询解释开关 -->
            <div v-if="queryMode === 'builder'" :class="bem('control-chip')">
              <span :class="bem('chip-label')">解释</span>
              <Switch v-model:checked="showExplain" size="small" checked-children="开" un-checked-children="关" />
            </div>
          </div>
        </div>
      </div>

      <!-- 执行查询按钮 -->
      <div :class="bem('header-actions')">
        <Button type="primary" size="middle" :class="bem('run-btn')" @click="handleExecuteQuery">
          <template #icon><SearchOutlined /></template>
          执行查询
        </Button>
      </div>
    </div>

    <!-- 查询列表 -->
    <div :class="bem('queries')">
      <div v-for="(queryPanel, index) in queryPanels" :key="queryPanel.refId" :class="bem('query-item')">
        <div :class="bem('query-wrapper', { collapsed: isPanelCollapsed(queryPanel.refId) })">
          <!-- 查询标题区 -->
          <div :class="bem('query-header')">
            <div :class="bem('query-title')">
              <span :class="bem('query-pill')">{{ queryPanel.refId }}</span>
              <div :class="bem('query-text')">
                <div :class="bem('query-label')">查询 {{ queryPanel.refId }}</div>
                <div :class="bem('query-subtitle')">紧凑构建并自动转 PromQL</div>
              </div>
              <Tag v-if="queryPanel.hide" color="orange">已隐藏</Tag>
            </div>
            <div :class="bem('query-actions')">
              <div :class="bem('action-chip')">
                <Switch
                  :checked="!queryPanel.hide"
                  size="small"
                  checked-children="可见"
                  un-checked-children="隐藏"
                  @change="(visible) => setQueryVisibility(index, visible)"
                />
                <span :class="bem('action-label')">{{ queryPanel.hide ? '已隐藏' : '可见' }}</span>
              </div>
              <div :class="bem('action-buttons')">
                <Button type="text" size="small" :class="bem('action-btn')" @click="togglePanelCollapsed(queryPanel.refId)">
                  <template #icon>
                    <UpOutlined v-if="!isPanelCollapsed(queryPanel.refId)" />
                    <DownOutlined v-else />
                  </template>
                  {{ isPanelCollapsed(queryPanel.refId) ? '展开' : '折叠' }}
                </Button>
                <!-- 模版填充按钮（仅在 builder 模式显示） -->
                <Button v-if="queryMode === 'builder'" type="text" size="small" :class="bem('action-btn')" @click="openQueryPatterns(index)">
                  <template #icon><ThunderboltOutlined /></template>
                  模版填充
                </Button>
                <!-- 删除查询 -->
                <Button
                  v-if="queryPanels.length > 1"
                  type="text"
                  danger
                  size="small"
                  :class="bem('action-btn', 'danger')"
                  @click="removeQuery(index)"
                >
                  删除
                </Button>
              </div>
            </div>
          </div>

          <!-- 查询内容区 -->
          <Transition name="fade-collapse">
            <div v-show="!isPanelCollapsed(queryPanel.refId)" :class="bem('query-content')">
              <!-- QueryBuilder 模式 -->
              <div v-if="queryMode === 'builder'" :class="bem('builder-mode')">
                <Space direction="vertical" :size="10" style="width: 100%">
                  <!-- 指标选择 -->
                  <div :class="[bem('section'), bem('section--metric')]">
                    <div :class="bem('section-header')">
                      <span :class="bem('section-title')">指标</span>
                    </div>
                    <div :class="bem('section-content')">
                      <MetricSelector :class="bem('metric-selector')" v-model="queryPanel.query.metric" :datasource="datasource" />
                    </div>
                  </div>

                  <!-- 标签过滤器 -->
                  <div :class="[bem('section'), bem('section--filters')]">
                    <div :class="bem('section-header')">
                      <span :class="bem('section-title')">标签过滤</span>
                    </div>
                    <div :class="bem('section-content')">
                      <LabelFilters
                        :class="bem('label-filters')"
                        v-model="queryPanel.query.labels"
                        :metric="queryPanel.query.metric"
                        :datasource="datasource"
                      />
                    </div>
                  </div>

                  <!-- 操作列表 -->
                  <div :class="[bem('section'), bem('section--operations')]">
                    <div :class="bem('section-header')">
                      <span :class="bem('section-title')">操作</span>
                    </div>
                    <div :class="bem('section-content')">
                      <OperationsList
                        :class="bem('operations-list')"
                        v-model="queryPanel.query.operations"
                        :query="queryPanel.query"
                        :datasource="datasource"
                        :highlighted-index="highlightedOpIndex"
                      />
                    </div>
                  </div>

                  <!-- 二元查询 -->
                  <div
                    v-if="queryPanel.query.binaryQueries && queryPanel.query.binaryQueries.length > 0"
                    :class="[bem('section'), bem('section--binary')]"
                  >
                    <div :class="bem('section-header')">
                      <span :class="bem('section-title')">二元查询</span>
                    </div>
                    <div :class="bem('section-content')">
                      <NestedQueryList
                        :class="bem('nested-query-list')"
                        :query="queryPanel.query"
                        :datasource="datasource"
                        @update="handleNestedQueryUpdate(index, $event)"
                      />
                    </div>
                  </div>

                  <!-- 查询提示 -->
                  <QueryHints
                    v-if="queryPanel.query.metric"
                    :query="queryPanel.query"
                    :datasource="datasource"
                    @apply-fix="handleApplyFix(index, $event)"
                  />

                  <!-- 查询预览 -->
                  <div :class="bem('section')">
                    <div :class="bem('section-header')">
                      <span :class="bem('section-title')">查询预览</span>
                    </div>
                    <div :class="bem('section-content')">
                      <QueryPreview :class="bem('query-preview')" :promql="getPromQLForQuery(queryPanel.query)" />
                    </div>
                  </div>

                  <!-- 查询解释 -->
                  <div v-if="showExplain && queryPanel.query.metric" :class="bem('section')">
                    <div :class="bem('section-header')">
                      <span :class="bem('section-title')">查询解释</span>
                    </div>
                    <div :class="bem('section-content')">
                      <QueryExplain :class="bem('query-explain')" :query="queryPanel.query" @highlight="handleHighlightOperation" />
                    </div>
                  </div>
                </Space>
              </div>

              <!-- PromQL 代码模式 -->
              <div v-else :class="bem('code-mode')">
                <div :class="bem('code-grid')">
                  <FormItem :class="bem('code-item', 'wide')" label="PromQL 表达式">
                    <Textarea v-model:value="codePromQLs[index]" placeholder="例如：cpu_usage" :rows="3" @change="handleCodeChange(index)" />
                  </FormItem>

                  <FormItem :class="bem('code-item')" label="图例格式">
                    <Input v-model:value="legendFormats[index]" placeholder="例如：{{instance}}" />
                  </FormItem>

                  <FormItem :class="bem('code-item')" label="最小步长（秒）">
                    <InputNumber v-model:value="minSteps[index]" :min="1" :max="300" style="width: 100%" />
                  </FormItem>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 添加查询按钮 -->
      <Button type="primary" :class="bem('add-btn')" block @click="addQuery">
        <template #icon><PlusOutlined /></template>
        添加查询
      </Button>
    </div>

    <!-- 查询模板弹窗 -->
    <QueryPatternsModal v-model:open="patternsModalOpen" @select="handlePatternSelect" />
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, computed } from 'vue';
  import { Space, Button, RadioGroup, RadioButton, Switch, Tag, FormItem, Input, Textarea, InputNumber, message } from 'ant-design-vue';
  import { BlockOutlined, CodeOutlined, ThunderboltOutlined, SearchOutlined, PlusOutlined, UpOutlined, DownOutlined } from '@ant-design/icons-vue';
  import MetricSelector from '/#/components/QueryBuilder/MetricSelector.vue';
  import LabelFilters from '/#/components/QueryBuilder/LabelFilters.vue';
  import OperationsList from '/#/components/QueryBuilder/query-builder/OperationsList.vue';
  import NestedQueryList from '/#/components/QueryBuilder/query-builder/NestedQueryList.vue';
  import QueryHints from '/#/components/QueryBuilder/query-builder/QueryHints.vue';
  import QueryPreview from '/#/components/QueryBuilder/QueryPreview.vue';
  import QueryExplain from '/#/components/QueryBuilder/query-builder/QueryExplain.vue';
  import QueryPatternsModal from '/#/components/QueryBuilder/QueryPatternsModal.vue';
  import { promQueryModeller } from '/#/components/QueryBuilder/lib/PromQueryModeller';
  import { getDefaultDataSource } from '/#/api/querybuilder/datasource';
  import { createNamespace } from '/#/utils';
  import type { PromVisualQuery, QueryPanel } from '@grafana-fast/types';

  const [_, bem] = createNamespace('data-query-tab');

  // Props
  interface Props {
    queries?: any[]; // 原始查询列表（旧格式：Query 接口，包含 id, datasource, expr, legendFormat, minStep, format, instant 等字段）
    datasource?: any; // Prometheus 数据源
  }

  const props = withDefaults(defineProps<Props>(), {
    queries: () => [],
    datasource: () => getDefaultDataSource(),
  });

  // Emits
  const emit = defineEmits<{
    'update:queries': [queries: any[]];
    execute: [];
  }>();

  // 状态
  const queryMode = ref<'builder' | 'code'>('builder');
  const showExplain = ref(false);
  const patternsModalOpen = ref(false);
  const currentPatternQueryIndex = ref<number>(0); // 记录当前要填充模板的查询索引
  const highlightedOpIndex = ref<number>();
  const isInitialized = ref(false); // 标记是否已初始化，避免重复初始化

  // Builder 模式的状态（独立维护）
  const builderQueryPanels = ref<QueryPanel[]>([]);

  // Code 模式的状态（独立维护）
  const codeQueryPanels = ref<QueryPanel[]>([]);
  const codePromQLs = ref<string[]>([]);
  const legendFormats = ref<string[]>([]);
  const minSteps = ref<number[]>([]);
  const collapsedPanels = ref<Record<string, boolean>>({});

  // 当前激活的 queryPanels（根据模式切换）
  const queryPanels = computed(() => {
    return queryMode.value === 'builder' ? builderQueryPanels.value : codeQueryPanels.value;
  });

  const isPanelCollapsed = (refId: string) => !!collapsedPanels.value[refId];

  const togglePanelCollapsed = (refId: string) => {
    collapsedPanels.value = {
      ...collapsedPanels.value,
      [refId]: !collapsedPanels.value[refId],
    };
  };

  // 切换查询可见性
  const setQueryVisibility = (index: number, visible: any) => {
    const panels = queryMode.value === 'builder' ? builderQueryPanels.value : codeQueryPanels.value;
    const panel = panels[index];
    if (panel) {
      panel.hide = !visible;
    }
  };

  // 初始化 QueryPanels（只在首次初始化时调用）
  const initializeQueryPanels = () => {
    if (isInitialized.value) {
      return; // 已经初始化过，避免重复初始化
    }

    if (props.queries && props.queries.length > 0) {
      // 从旧格式转换 - Builder 模式
      builderQueryPanels.value = props.queries.map((_q, index) => ({
        refId: String.fromCharCode(65 + index), // A, B, C...
        query: {
          metric: '',
          labels: [],
          operations: [],
        },
        hide: _q.hide || false,
        datasource: 'prometheus',
      }));

      // 从旧格式转换 - Code 模式
      codeQueryPanels.value = props.queries.map((_q, index) => ({
        refId: String.fromCharCode(65 + index),
        query: {
          metric: '',
          labels: [],
          operations: [],
        },
        hide: _q.hide || false,
        datasource: 'prometheus',
      }));

      // 初始化代码模式的值
      codePromQLs.value = props.queries.map((q) => q.expr || '');
      legendFormats.value = props.queries.map((q) => q.legendFormat || '');
      minSteps.value = props.queries.map((q) => q.minStep || 15);
    } else {
      // 创建默认查询 - Builder 模式
      builderQueryPanels.value = [
        {
          refId: 'A',
          query: {
            metric: '',
            labels: [],
            operations: [],
          },
          hide: false,
          datasource: 'prometheus',
        },
      ];

      // 创建默认查询 - Code 模式
      codeQueryPanels.value = [
        {
          refId: 'A',
          query: {
            metric: '',
            labels: [],
            operations: [],
          },
          hide: false,
          datasource: 'prometheus',
        },
      ];

      codePromQLs.value = [''];
      legendFormats.value = [''];
      minSteps.value = [15];
    }

    isInitialized.value = true;
  };

  // 初始化
  initializeQueryPanels();

  // 监听 props.queries 变化（仅在未初始化时才初始化）
  watch(
    () => props.queries,
    () => {
      if (!isInitialized.value && props.queries && props.queries.length > 0) {
        initializeQueryPanels();
      }
    },
    { deep: true, immediate: true }
  );

  // 生成 PromQL
  const getPromQLForQuery = (query: PromVisualQuery): string => {
    try {
      return promQueryModeller.renderQuery(query);
    } catch (error) {
      console.error('Failed to render PromQL:', error);
      return '';
    }
  };

  // 添加查询
  const addQuery = () => {
    if (queryMode.value === 'builder') {
      const newRefId = String.fromCharCode(65 + builderQueryPanels.value.length);
      builderQueryPanels.value.push({
        refId: newRefId,
        query: {
          metric: '',
          labels: [],
          operations: [],
        },
        hide: false,
        datasource: 'prometheus',
      });
    } else {
      const newRefId = String.fromCharCode(65 + codeQueryPanels.value.length);
      codeQueryPanels.value.push({
        refId: newRefId,
        query: {
          metric: '',
          labels: [],
          operations: [],
        },
        hide: false,
        datasource: 'prometheus',
      });
      codePromQLs.value.push('');
      legendFormats.value.push('');
      minSteps.value.push(15);
    }
  };

  // 删除查询
  const removeQuery = (index: number) => {
    const panels = queryMode.value === 'builder' ? builderQueryPanels.value : codeQueryPanels.value;
    const removedPanel = panels[index];
    if (!removedPanel) {
      return;
    }

    const refId = removedPanel.refId;

    if (queryMode.value === 'builder') {
      builderQueryPanels.value.splice(index, 1);
    } else {
      codeQueryPanels.value.splice(index, 1);
      codePromQLs.value.splice(index, 1);
      legendFormats.value.splice(index, 1);
      minSteps.value.splice(index, 1);
    }

    const { [refId]: _omit, ...rest } = collapsedPanels.value;
    collapsedPanels.value = rest;
  };

  // 执行查询
  const handleExecuteQuery = () => {
    // 根据当前模式转换查询
    const queries = convertQueriesToOldFormat();

    // 验证
    const invalidQueries = queries.filter((q: any, index: number) => {
      if (!q.expr || q.expr.trim() === '') {
        message.error(`查询 ${String.fromCharCode(65 + index)} 的表达式不能为空`);
        return true;
      }
      return false;
    });

    if (invalidQueries.length > 0) {
      return;
    }

    // 更新并触发执行
    emit('update:queries', queries);
    emit('execute');
  };

  // 将 QueryPanel 转换为旧格式
  const convertQueriesToOldFormat = () => {
    if (queryMode.value === 'builder') {
      return builderQueryPanels.value.map((panel) => ({
        id: `query-${panel.refId}`,
        datasource: 'Prometheus',
        expr: getPromQLForQuery(panel.query),
        legendFormat: '',
        minStep: 15,
        format: 'time_series',
        instant: false,
        hide: panel.hide,
      }));
    } else {
      return codeQueryPanels.value.map((panel, index) => ({
        id: `query-${panel.refId}`,
        datasource: 'Prometheus',
        expr: codePromQLs.value[index] || '',
        legendFormat: legendFormats.value[index] || '',
        minStep: minSteps.value[index] || 15,
        format: 'time_series',
        instant: false,
        hide: panel.hide,
      }));
    }
  };

  // 打开查询模板
  const openQueryPatterns = (index: number) => {
    currentPatternQueryIndex.value = index;
    patternsModalOpen.value = true;
  };

  // 选择查询模板
  const handlePatternSelect = (query: PromVisualQuery) => {
    const targetPanel = builderQueryPanels.value[currentPatternQueryIndex.value];
    if (targetPanel) {
      // 应用到指定索引的查询
      targetPanel.query.operations = [...query.operations];
      if (query.binaryQueries) {
        targetPanel.query.binaryQueries = [...query.binaryQueries];
      }
    }
    patternsModalOpen.value = false;
  };

  // 应用修复建议
  const handleApplyFix = (_index: number, fix: any) => {
    if (fix && typeof fix === 'function') {
      fix();
    }
  };

  // 高亮操作
  const handleHighlightOperation = (index: number | null) => {
    highlightedOpIndex.value = index ?? undefined;
    if (index !== null) {
      setTimeout(() => {
        highlightedOpIndex.value = undefined;
      }, 2000);
    }
  };

  // 代码模式变化
  const handleCodeChange = (_index: number) => {
    // 代码模式下，直接使用文本框的值
  };

  // 处理嵌套查询更新
  const handleNestedQueryUpdate = (index: number, updatedQuery: PromVisualQuery) => {
    const panels = queryMode.value === 'builder' ? builderQueryPanels.value : codeQueryPanels.value;
    const panel = panels[index];
    if (panel) {
      panel.query = updatedQuery;
    }
  };

  // 对外暴露方法
  defineExpose({
    getQueries: convertQueriesToOldFormat,
  });
</script>

<style scoped lang="less">
  .dp-data-query-tab {
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: @text-color;

    &__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      border: 1px solid fade(@border-color, 60%);
      border-radius: 8px;
      background: linear-gradient(120deg, fade(@primary-color, 8%), @background-light);
      box-shadow: 0 6px 18px -12px rgba(0, 0, 0, 0.18);
      gap: 12px;
      flex-wrap: wrap;
    }

    &__header-left {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      min-width: 0;
    }

    &__title-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 220px;
    }

    &__title {
      font-weight: 700;
      font-size: 16px;
      color: @text-color;
      letter-spacing: 0.3px;
      line-height: 1.3;
    }

    &__controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    &__control-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid fade(@border-color, 55%);
      border-radius: 10px;
      background: fade(@background-light, 90%);
      box-shadow: inset 0 1px 0 fade(@border-color, 35%);
    }

    &__chip-label {
      font-size: 12px;
      color: fade(@text-color, 60%);
      letter-spacing: 0.2px;
    }

    &__header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;

      .ant-btn-primary {
        box-shadow: 0 4px 10px -6px @primary-color;
      }
    }

    &__run-btn {
      border-radius: 8px;
      padding: 4px 16px;
      font-weight: 700;
      background: linear-gradient(120deg, @primary-color, lighten(@primary-color, 8%));
      border: none;
      height: 36px;
    }

    &__queries {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    &__add-btn {
      margin-top: 4px;
      height: 32px;
      font-weight: 600;
      border-radius: 8px;
      box-shadow: 0 6px 14px -10px @primary-color;

      &:hover {
        box-shadow: 0 10px 18px -12px @primary-color;
      }
    }

    &__query-item {
      width: 100%;
    }

    &__query-wrapper {
      border: 1px solid fade(@border-color, 70%);
      border-radius: 10px;
      overflow: hidden;
      background: @background-light;
      box-shadow: 0 10px 24px -22px rgba(0, 0, 0, 0.35);
      transition:
        box-shadow 0.2s ease,
        transform 0.2s ease,
        border-color 0.2s ease;

      &:hover {
        box-shadow: 0 16px 28px -20px rgba(0, 0, 0, 0.38);
        border-color: fade(@primary-color, 50%);
        transform: translateY(-1px);
      }

      &--collapsed {
        border-color: fade(@border-color, 50%);

        .dp-data-query-tab__query-content {
          border-top: 1px dashed fade(@border-color, 60%);
        }
      }
    }

    &__query-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 12px 16px;
      background: linear-gradient(120deg, @background-base, fade(@background-light, 80%));
      border-bottom: 1px solid fade(@border-color, 60%);
      gap: 12px;
      flex-wrap: wrap;
    }

    &__query-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }

    &__query-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    &__query-label {
      font-weight: 700;
      font-size: 13px;
      color: @text-color;
    }

    &__query-subtitle {
      font-size: 12px;
      color: fade(@text-color, 60%);
    }

    &__query-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: fade(@primary-color, 12%);
      color: @primary-color;
      font-weight: 700;
      font-size: 12px;
      border: 1px solid fade(@primary-color, 30%);
      flex-shrink: 0;
    }

    &__query-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;

      .ant-switch {
        background-color: fade(@primary-color, 16%);
      }
    }

    &__action-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: fade(@primary-color, 6%);
      border: 1px solid fade(@primary-color, 20%);
      border-radius: 999px;
      color: @text-color;
      font-size: 12px;
    }

    &__action-label {
      color: fade(@text-color, 70%);
    }

    &__action-buttons {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    &__action-btn {
      border-radius: 8px;
      color: fade(@text-color, 80%);
      background: fade(@primary-color, 4%);
      border-color: transparent;

      &:hover {
        color: @primary-color;
        background: fade(@primary-color, 12%);
      }

      &--danger {
        background: fade(@error-color, 6%);
        color: @error-color;

        &:hover {
          background: fade(@error-color, 12%);
          color: darken(@error-color, 5%);
        }
      }
    }

    &__query-content {
      padding: 14px 16px 16px;
      background: @background-base;
    }

    &__builder-mode,
    &__code-mode {
      width: 100%;
    }

    &__section {
      width: 100%;
      border: 1px solid fade(@border-color, 70%);
      border-radius: 8px;
      overflow: hidden;
      background: @background-light;
      box-shadow: inset 0 1px 0 fade(@border-color, 40%);
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;

      // 不同区块的左边框强调色
      &--metric {
        border-left: 3px solid @primary-color;
      }

      &--filters {
        border-left: 3px solid #52c41a;
      }

      &--operations {
        border-left: 3px solid #faad14;
      }

      &--binary {
        border-left: 3px solid #722ed1;
      }

      &:hover {
        border-color: fade(@primary-color, 35%);
        box-shadow: 0 8px 20px -18px rgba(0, 0, 0, 0.45);
      }
    }

    &__section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid fade(@border-color, 70%);
      background: fade(@background-base, 90%);
    }

    &__section-title {
      font-weight: 600;
      font-size: 12px;
      color: @text-color;
      line-height: 1.5;
      letter-spacing: 0.1px;
    }

    &__section-content {
      padding: 12px;
    }

    &__code-mode {
      background: @background-light;
      border: 1px solid fade(@border-color, 70%);
      border-radius: 8px;
      padding: 12px;
    }

    &__code-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px 16px;
    }

    &__code-item--wide {
      grid-column: 1 / -1;
    }

    // 子组件样式
    &__metric-selector,
    &__label-filters,
    &__operations-list,
    &__nested-query-list,
    &__query-hints,
    &__query-preview,
    &__query-explain {
      width: 100%;
    }
  }

  .fade-collapse-enter-active,
  .fade-collapse-leave-active {
    transition: all 0.2s ease;
  }

  .fade-collapse-enter-from,
  .fade-collapse-leave-to {
    opacity: 0;
    transform: translateY(-6px);
  }
</style>
