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
        <!-- 基础信息卡片 -->
        <div :class="[bem('card'), bem('card--info')]">
          <div :class="bem('card-header')">
            <div :class="bem('card-icon')">
              <FormOutlined />
            </div>
            <div :class="bem('card-title')">基础信息</div>
          </div>
          <div :class="bem('card-body')">
            <div :class="bem('form-grid')">
              <FormItem label="面板组" required :class="bem('form-item')">
                <Select :options="panelGroupOptions" v-model:value="selectedGroupId" placeholder="请选择面板组" :disabled="editingMode === 'edit'" />
              </FormItem>
              <FormItem label="面板名称" required :class="bem('form-item')">
                <Input v-model:value="formData.name" placeholder="请输入面板名称" />
              </FormItem>
              <FormItem label="图表类型" required :class="bem('form-item')">
                <Select :options="panelTypeOptions" v-model:value="formData.type" />
              </FormItem>
              <FormItem label="面板描述" :class="bem('form-item')">
                <Textarea
                  v-model:value="formData.description"
                  placeholder="可选：简要描述面板用途"
                  :rows="1"
                  :auto-size="{ minRows: 1, maxRows: 3 }"
                />
              </FormItem>
            </div>
          </div>
        </div>

        <!-- 面板预览卡片 -->
        <div :class="[bem('card'), bem('card--preview')]">
          <div :class="bem('card-header')">
            <div :class="bem('card-icon')">
              <EyeOutlined />
            </div>
            <div :class="bem('card-title')">实时预览</div>
            <div :class="bem('card-subtitle')">查询结果将在此处展示</div>
          </div>
          <div :class="bem('card-body')">
            <div :class="bem('preview-container')">
              <PanelPreview ref="panelPreviewRef" :panel="formData" :auto-execute="false" :show-header="false" />
            </div>
          </div>
        </div>

        <!-- 配置 Tabs 卡片 -->
        <div :class="[bem('card'), bem('card--config')]">
          <div :class="bem('card-header')">
            <div :class="bem('card-icon')">
              <SettingOutlined />
            </div>
            <div :class="bem('card-title')">配置</div>
          </div>
          <div :class="bem('card-body')">
            <Tabs v-model:activeKey="activeTab" :class="bem('tabs')">
              <!-- 数据查询 -->
              <TabPane name="query" tab="数据查询">
                <div :class="bem('tab-content')">
                  <DataQueryTab
                    ref="dataQueryTabRef"
                    :session-key="editorSessionKey"
                    :queries="formData.queries"
                    @update:queries="handleQueriesUpdate"
                    @execute="handleExecuteQuery"
                  />
                </div>
              </TabPane>

              <!-- 图表样式 -->
              <TabPane name="style" tab="图表样式">
                <div :class="bem('tab-content')">
                  <component v-if="styleComponent" :is="styleComponent" v-model:options="formData.options" />
                  <div v-else :class="bem('empty-style')">
                    <div :class="bem('empty-style-icon')">
                      <AppstoreOutlined />
                    </div>
                    <div :class="bem('empty-style-text')">此面板类型暂无特定样式配置</div>
                  </div>
                </div>
              </TabPane>

              <!-- JSON 编辑器 -->
              <!-- 创建面板时隐藏 JSON 编辑：此时还没有稳定的 panel.id，严格校验会导致保存被阻塞 -->
              <TabPane v-if="editingMode !== 'create'" name="json" tab="JSON 编辑">
                <div :class="bem('tab-content')">
                  <div :class="bem('json-editor-wrapper')">
                    <JsonEditorLite v-model="jsonDraft" :height="380" :validate="validatePanelStrict" @validate="handleJsonValidate" />
                  </div>
                </div>
              </TabPane>
            </Tabs>
          </div>
        </div>
      </Form>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div :class="bem('footer')">
        <div :class="bem('footer-hint')">
          <InfoCircleOutlined />
          <span>更改将在保存后生效</span>
        </div>
        <div :class="bem('footer-actions')">
          <Button size="small" @click="handleClose">取消</Button>
          <Button size="small" type="primary" :disabled="isReadOnly || isSaving" :loading="isSaving" @click="handleSave">
            <template #icon><SaveOutlined /></template>
            保存
          </Button>
        </div>
      </div>
    </template>
  </Drawer>
</template>

<script setup lang="ts">
  import { computed, defineAsyncComponent, onBeforeUnmount, reactive, ref, watch } from 'vue';
  import { storeToRefs } from '@grafana-fast/store';
  import { Drawer, Form, FormItem, Select, Input, Textarea, message } from '@grafana-fast/component';
  import { Button, Tabs, TabPane } from '@grafana-fast/component';
  import { AppstoreOutlined, EyeOutlined, FormOutlined, InfoCircleOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons-vue';
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
    const ret = panelPreviewRef.value?.executeQueries();
    if (ret && typeof (ret as PromiseLike<void>).then === 'function') {
      void Promise.resolve(ret).catch(() => {
        // 自动预览执行失败时：错误由 PanelPreview 内部直接展示，这里避免未处理 Promise。
      });
    }
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
        // 每次打开都重置 JSON 校验状态，避免上一次 JSON 编辑的错误“粘住”导致本次无法保存
        isJsonValid.value = true;
        // create 模式下 JSON tab 不渲染；若之前停留在 json tab，这里强制切回数据查询
        if (editingMode.value === 'create' && activeTab.value === 'json') activeTab.value = 'query';

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
      activeTab.value = 'query';
      message.error('请至少添加一个查询');
      return;
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
    gap: 12px;
    padding: 0;

    // ===== 卡片基础样式 =====
    &__card {
      position: relative;
      background: var(--gf-color-surface);
      border-radius: var(--gf-radius-lg);
      overflow: hidden;
      transition: box-shadow var(--gf-motion-normal) var(--gf-easing);

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--gf-color-border);
        transition: background var(--gf-motion-normal) var(--gf-easing);
      }

      // 不同类型卡片的左侧边条颜色
      &--info::before {
        background: linear-gradient(180deg, var(--gf-color-primary) 0%, #69b1ff 100%);
      }

      &--preview::before {
        background: linear-gradient(180deg, #52c41a 0%, #95de64 100%);
      }

      &--config::before {
        background: linear-gradient(180deg, #722ed1 0%, #b37feb 100%);
      }
    }

    &__card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px 10px 16px;
    }

    &__card-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-fill-secondary);
      color: var(--gf-color-text-secondary);
      font-size: 14px;
      flex-shrink: 0;

      .dp-panel-editor-drawer__card--info & {
        background: var(--gf-color-primary-bg);
        color: var(--gf-color-primary);
      }

      .dp-panel-editor-drawer__card--preview & {
        background: color-mix(in srgb, #52c41a, transparent 88%);
        color: #52c41a;
      }

      .dp-panel-editor-drawer__card--config & {
        background: color-mix(in srgb, #722ed1, transparent 88%);
        color: #722ed1;
      }
    }

    &__card-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--gf-color-text-heading);
      line-height: 1.5;
    }

    &__card-subtitle {
      font-size: 12px;
      color: var(--gf-color-text-tertiary);
      margin-left: auto;
    }

    &__card-body {
      padding: 0 16px 12px 16px;
    }

    // ===== 表单网格布局 =====
    &__form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px 16px;
    }

    &__form-item {
      margin-bottom: 0 !important;
    }

    // ===== 预览容器 =====
    &__preview-container {
      position: relative;
      min-height: 200px;
      border-radius: var(--gf-radius-md);
      background: transparent;
      overflow: hidden;

      :deep(.dp-panel-preview) {
        position: relative;
        z-index: 1;
      }

      :deep(.dp-panel-preview__content) {
        border: none;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }

      :deep(.dp-panel-preview__content:hover) {
        border: none;
      }
    }

    // ===== Tabs 样式 =====
    &__tabs {
      :deep(.gf-tabs__nav) {
        padding: 0;
        background: transparent;
        margin-bottom: 0;
        border-bottom: 1px solid var(--gf-color-border-secondary);
      }

      :deep(.gf-tabs__nav-item) {
        padding: 10px 16px;
        font-weight: 500;

        &.is-active {
          font-weight: 600;
        }
      }

      :deep(.gf-tabs__content) {
        padding-top: 12px;
      }
    }

    &__tab-content {
      min-height: 200px;
    }

    // ===== 空样式状态 =====
    &__empty-style {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      gap: 12px;
    }

    &__empty-style-icon {
      font-size: 40px;
      color: var(--gf-color-text-quaternary);
      opacity: 0.6;
    }

    &__empty-style-text {
      font-size: 14px;
      color: var(--gf-color-text-tertiary);
    }

    // ===== JSON 编辑器包装 =====
    &__json-editor-wrapper {
      border-radius: var(--gf-radius-md);
      overflow: hidden;
      border: 1px solid var(--gf-color-border-secondary);
    }

    // ===== 底部区域 =====
    &__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    &__footer-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--gf-color-text-tertiary);
    }

    &__footer-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  }
</style>
