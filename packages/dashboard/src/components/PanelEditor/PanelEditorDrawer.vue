<!-- 面板编辑器 -->
<template>
  <Drawer
    v-model:open="isOpen"
    title="面板编辑器"
    :width="900"
    :maskClosable="false"
    :lock-scroll="lockScrollEnabled"
    :lock-scroll-el="lockScrollEl"
    :class="bem('drawer')"
    @close="handleClose"
  >
    <div :class="bem()">
      <Form :model="formData" layout="vertical">
        <!-- 基础信息 -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">
            <div :class="bem('section-title')">基础信息</div>
          </div>
          <div :class="bem('section-body')">
            <Row :gutter="16">
              <Col :span="12">
                <FormItem label="面板组" required>
                  <Select :options="panelGroupOptions" v-model:value="selectedGroupId" placeholder="请选择面板组" :disabled="editingMode === 'edit'" />
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
        </div>

        <!-- 面板预览 -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">
            <div :class="bem('section-title')">预览</div>
          </div>
          <div :class="bem('section-body')">
            <PanelPreview ref="panelPreviewRef" :panel="formData" :auto-execute="false" :show-header="false" />
          </div>
        </div>

        <!-- Tabs -->
        <div :class="bem('section')">
          <div :class="bem('section-header')">
            <div :class="bem('section-title')">配置</div>
          </div>
          <div :class="bem('section-body')">
            <Tabs v-model:activeKey="activeTab" :class="bem('tabs')">
              <!-- 数据查询 -->
              <TabPane name="query" tab="数据查询">
                <DataQueryTab
                  ref="dataQueryTabRef"
                  :session-key="editorSessionKey"
                  :queries="formData.queries"
                  @update:queries="handleQueriesUpdate"
                  @execute="handleExecuteQuery"
                />
              </TabPane>

              <!-- 图表样式 -->
              <TabPane name="style" tab="图表样式">
                <!-- 根据面板类型显示不同的样式配置 -->
                <component v-if="styleComponent" :is="styleComponent" v-model:options="formData.options" />
                <div v-else>
                  <Empty description="此面板类型暂无特定样式配置" />
                </div>
              </TabPane>

              <!-- JSON 编辑器 -->
              <TabPane name="json" tab="JSON 编辑">
                <JsonEditorLite v-model="jsonDraft" :height="360" :validate="validatePanelStrict" @validate="handleJsonValidate" />
              </TabPane>
            </Tabs>
          </div>
        </div>
      </Form>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <Flex :gap="12" justify="end">
        <Button @click="handleClose">取消</Button>
        <Button type="primary" :disabled="isReadOnly || isSaving" :loading="isSaving" @click="handleSave">保存</Button>
      </Flex>
    </template>
  </Drawer>
</template>

<script setup lang="ts">
  import { computed, defineAsyncComponent, onBeforeUnmount, reactive, ref, watch } from 'vue';
  import { storeToRefs } from '@grafana-fast/store';
  import { Drawer, Form, FormItem, Select, Input, Textarea, Row, Col, Flex, message } from '@grafana-fast/component';
  import { Button, Tabs, TabPane, Empty } from '@grafana-fast/component';
  import { useDashboardStore, useEditorStore } from '/#/stores';
  import { useDashboardRuntime } from '/#/runtime/useInjected';
  import { debounceCancellable, deepClone, createNamespace } from '/#/utils';
  import { getBuiltInPanelDefaultOptions, getBuiltInPanelStyleComponent, getBuiltInPanelTypeOptions } from '/#/panels/builtInPanels';
  import type { CanonicalQuery, Panel } from '@grafana-fast/types';
  import { validatePanelStrict } from '/#/utils/strictJsonValidators';
  import PanelPreview from './PanelPreview.vue';
  import DataQueryTab from './DataQueryTab.vue';

  type JsonEditorModule = typeof import('@grafana-fast/json-editor');
  let jsonEditorModulePromise: Promise<JsonEditorModule> | null = null;

  const loadJsonEditorModule = async (): Promise<JsonEditorModule> => {
    jsonEditorModulePromise ??= import('@grafana-fast/json-editor');
    return jsonEditorModulePromise;
  };

  const JsonEditorLite = defineAsyncComponent({
    loader: async () => (await loadJsonEditorModule()).JsonEditorLite,
    delay: 120,
    timeout: 30_000,
  });

  const [_, bem] = createNamespace('panel-editor-drawer');

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();

  const { isDrawerOpen, editingPanel, editingMode, targetGroupId, originalPanelId } = storeToRefs(editorStore);
  const { panelGroups, isReadOnly } = storeToRefs(dashboardStore);

  const runtime = useDashboardRuntime();
  const lockScrollEl = computed(() => runtime.scrollEl?.value ?? runtime.rootEl?.value ?? null);
  const lockScrollEnabled = computed(() => lockScrollEl.value != null);

  const isOpen = ref(false);
  const activeTab = ref('query'); // 默认选中数据查询
  const isJsonValid = ref(true);
  const selectedGroupId = ref<string>('');
  const panelPreviewRef = ref<InstanceType<typeof PanelPreview>>();
  type DataQueryTabExpose = InstanceType<typeof DataQueryTab> & {
    validateAndGetQueriesForSave: () => { ok: boolean; errors: Array<{ refId: string; message: string }>; queries: CanonicalQuery[] };
    validateAndGetQueriesForExecute: () => { ok: boolean; errors: Array<{ refId: string; message: string }>; queries: CanonicalQuery[] };
  };
  const dataQueryTabRef = ref<DataQueryTabExpose | null>(null);
  const jsonDraft = ref<string>('');
  const isSaving = ref(false);

  // 获取面板组列表
  const panelGroupOptions = computed(() => {
    return (panelGroups.value ?? []).map((group) => ({
      label: group.title,
      value: group.id,
    }));
  });

  // 面板类型选项（当前阶段：仅支持内置类型）
  const panelTypeOptions = computed(() => getBuiltInPanelTypeOptions());

  const getDefaultOptionsByType = (type: string): any => getBuiltInPanelDefaultOptions(type);

  // 表单数据
  const formData = reactive<any>({
    id: '',
    name: '',
    description: '',
    type: 'timeseries' as any,
    queries: [],
    options: deepClone(getDefaultOptionsByType('timeseries')),
  });

  // 根据面板类型获取样式配置组件（仅内置类型）
  const styleComponent = computed(() => getBuiltInPanelStyleComponent(formData.type));

  const handleJsonValidate = (isValid: boolean) => {
    isJsonValid.value = isValid;
  };

  // 当切换到 JSON tab 时，用当前表单值刷新一份草稿（避免在用户编辑时被自动覆盖）
  watch(
    () => activeTab.value,
    (tab) => {
      if (tab !== 'json') return;
      jsonDraft.value = JSON.stringify(formData, null, 2);
      // Prefetch: avoid blocking the first keystroke in JSON editor tab.
      void loadJsonEditorModule();
    }
  );

  // JSON 草稿变更：当草稿成为合法 JSON 时，再写回到 formData（不阻塞用户输入过程）
  let jsonAnalyzeToken = 0;
  watch(
    () => jsonDraft.value,
    (text) => {
      const token = ++jsonAnalyzeToken;
      void (async () => {
        try {
          const { analyzeJsonText } = await loadJsonEditorModule();
          if (token !== jsonAnalyzeToken) return;
          const d = analyzeJsonText(text ?? '');
          if (!d.ok) return;
          if (!d.value || typeof d.value !== 'object') return;
          Object.assign(formData, d.value as any);
        } catch {
          // ignore: JSON editor is an optional UX enhancer; parsing failure should not break panel editing flow
        }
      })();
    }
  );

  // 监听 drawer 打开
  const scheduleExecuteQueries = debounceCancellable(() => {
    panelPreviewRef.value?.executeQueries();
  }, 100);

  onBeforeUnmount(() => {
    scheduleExecuteQueries.cancel();
  });

  watch(
    () => isDrawerOpen.value,
    (open) => {
      isOpen.value = open;
      scheduleExecuteQueries.cancel();
      if (open) {
        if (editingPanel.value) {
          Object.assign(formData, deepClone(editingPanel.value));
        }
        // 初始化选中的面板组
        selectedGroupId.value = targetGroupId.value || '';

        // 如果是编辑模式且有查询配置，初始化时自动执行一次查询
        if (editingMode.value === 'edit' && formData.queries && formData.queries.length > 0) {
          // 延迟执行：避免 drawer 初次打开时 DOM/图表尚未就绪
          scheduleExecuteQueries();
        }
      }
    },
    // 重要：PanelEditorDrawer 由 Dashboard 按“首次打开再加载”延迟挂载；
    // 若组件挂载时 isDrawerOpen 已经是 true（首次点击编辑），必须立刻同步到 isOpen，
    // 否则会出现“第一次点编辑没反应，退出/再进编辑后才生效”的现象。
    { immediate: true }
  );

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
  const handleQueriesUpdate = (queries: CanonicalQuery[]) => {
    formData.queries = queries;
  };

  const editorSessionKey = computed(() => {
    // Any change to this value should force DataQueryTab to rebuild its internal drafts from props.
    // - Open/close changes
    // - Switching between create/edit
    // - Switching between different panels (originalPanelId)
    return [
      isDrawerOpen.value ? 'open' : 'closed',
      editingMode.value,
      originalPanelId?.value ?? 'new',
      editingPanel.value?.id ?? 'no-panel',
      targetGroupId.value ?? 'no-group',
    ].join('::');
  });

  const handleExecuteQuery = () => {
    const result = dataQueryTabRef.value?.validateAndGetQueriesForExecute?.();
    if (!result) {
      message.error('查询编辑器未就绪，请稍后重试');
      return;
    }

    if (!result.ok) {
      activeTab.value = 'query';
      for (const e of result.errors) {
        message.error(`查询 ${e.refId}: ${e.message}`);
      }
      return;
    }

    const queries = result.queries ?? [];
    if (!queries.length) {
      message.warning('请至少添加一个查询');
      return;
    }

    formData.queries = queries;

    message.loading({ content: '正在执行查询...', key: 'executeQuery', duration: 0 });

    panelPreviewRef.value
      ?.executeQueries()
      .then(() => {
        message.success({ content: '查询执行成功', key: 'executeQuery', duration: 2 });
      })
      .catch((error) => {
        message.error({ content: `查询执行失败: ${error.message || '未知错误'}`, key: 'executeQuery', duration: 3 });
      });
  };

  // 关闭
  const handleClose = () => {
    editorStore.closeEditor();
    activeTab.value = 'query';
  };

  // 进入只读时强制关闭编辑器，避免出现“编辑 UI 仍然存在但无法落盘”的困惑
  watch(
    () => isReadOnly.value,
    (ro) => {
      if (!ro) return;
      if (isDrawerOpen.value) handleClose();
    },
    { immediate: true }
  );

  // 保存
  const handleSave = async () => {
    if (isReadOnly.value) {
      message.warning('当前为只读模式，无法保存面板');
      return;
    }
    if (isSaving.value) return;
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

    // 保存前：强制校验并同步 DataQueryTab 的最新编辑结果（不依赖额外手动触发）
    const qres = dataQueryTabRef.value?.validateAndGetQueriesForSave?.();
    if (!qres) {
      message.error('查询编辑器未就绪，请稍后重试');
      return;
    }

    if (!qres.ok) {
      activeTab.value = 'query';
      for (const e of qres.errors) {
        message.error(`查询 ${e.refId}: ${e.message}`);
      }
      return;
    }
    formData.queries = qres.queries ?? [];

    if (formData.queries.length === 0) {
      message.warning('建议至少添加一个查询');
    }

    const toastKey = 'panel-save';
    message.loading({ content: '正在保存...', key: toastKey, duration: 0 });
    isSaving.value = true;
    try {
      if (editingMode.value === 'create') {
        // 创建新面板
        const newPanel: Panel = { ...deepClone(formData), id: '' };
        await dashboardStore.addPanel(selectedGroupId.value, newPanel);
        message.success({ content: '面板创建成功', key: toastKey, duration: 2 });
      } else if (originalPanelId?.value) {
        // 更新面板
        await dashboardStore.updatePanel(selectedGroupId.value, originalPanelId.value, deepClone(formData));
        message.success({ content: '面板更新成功', key: toastKey, duration: 2 });
      }

      handleClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '保存失败';
      message.error({ content: msg, key: toastKey, duration: 3 });
      console.error(error);
    } finally {
      isSaving.value = false;
    }
  };
</script>

<style scoped lang="less">
  .dp-panel-editor-drawer {
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding: 0 2px 6px;

    &__section {
      background: transparent;
      border: none;
      border-radius: 0;
      overflow: visible;
    }

    &__section + &__section {
      padding-top: 16px;
      border-top: 1px solid var(--gf-color-border-secondary);
    }

    &__section-header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      padding: 0;
      margin-bottom: 12px;
      background: transparent;
      border-bottom: none;
    }

    &__section-title {
      font-weight: 600;
      font-size: 15px;
      color: var(--gf-color-text-heading);
      letter-spacing: 0;
      line-height: 1.5;
    }

    &__section-body {
      padding: 0;
    }

    :deep(.gf-row) {
      row-gap: 8px;
    }

    :deep(.gf-form-item) {
      margin-bottom: 16px;
    }

    :deep(.gf-form-item:last-child) {
      margin-bottom: 0;
    }

    :deep(.dp-panel-preview__content) {
      border: none;
      border-radius: var(--gf-radius-md);
      background: transparent;
      box-shadow: none;
    }

    :deep(.dp-panel-preview__content:hover) {
      border: none;
    }

    // Tabs styling
    :deep(.gf-tabs) {
      .gf-tabs__nav {
        padding: 0;
        background: transparent;
        margin-bottom: 14px;
      }
    }
  }
</style>
