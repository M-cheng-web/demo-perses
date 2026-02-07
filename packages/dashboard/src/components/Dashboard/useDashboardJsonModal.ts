import { computed, nextTick, ref, watch, type Ref } from 'vue';
import { message } from '@grafana-fast/component';
import type { DashboardContent } from '@grafana-fast/types';

type DashboardStoreLike = {
  getPersistableDashboardSnapshot: () => DashboardContent | null;
  applyDashboardFromJson: (dashboard: DashboardContent, rawText: string) => void | Promise<void>;
};

export type DashboardJsonEditorExpose = {
  getDraftText?: () => string;
  getDashboard: () => DashboardContent;
};

interface Options {
  isBooting: Ref<boolean>;
  isReadOnly: Ref<boolean>;
  isLargeDashboard: Ref<boolean>;
  rootEl: Ref<HTMLElement | null>;
  contentEl: Ref<HTMLElement | null>;
  dashboardStore: DashboardStoreLike;
  /**
   * 可选：外部传入 template refs（用于避免 build 模式下的 noUnusedLocals 误判）
   * - 若不传，hook 内部会自行创建
   */
  dashboardJsonEditorRef?: Ref<DashboardJsonEditorExpose | null>;
  jsonFileInputRef?: Ref<HTMLInputElement | undefined>;
}

export function useDashboardJsonModal(options: Options) {
  const MAX_EDITABLE_DASHBOARD_JSON_CHARS = 120_000;

  const jsonModalVisible = ref(false);
  const jsonModalMode = ref<'view' | 'edit'>('view');
  const dashboardJson = ref('');
  const isJsonValid = ref(true);
  const isGeneratingJson = ref(false);
  let generateJsonSeq = 0;

  const dashboardJsonEditorRef = options.dashboardJsonEditorRef ?? ref<DashboardJsonEditorExpose | null>(null);
  const jsonFileInputRef = options.jsonFileInputRef ?? ref<HTMLInputElement>();

  const lockScrollEl = computed(() => options.contentEl.value ?? options.rootEl.value ?? null);
  const lockScrollEnabled = computed(() => lockScrollEl.value != null);

  const handleJsonValidate = (ok: boolean) => {
    isJsonValid.value = ok;
  };

  const generateDashboardJsonText = async (dash: DashboardContent) => {
    const seq = ++generateJsonSeq;
    isGeneratingJson.value = true;
    // Avoid “open click → stringify big object → UI frozen before modal appears”.
    await nextTick();

    // Yield a frame to make sure modal/loading hint is rendered.
    await new Promise<void>((r) => window.setTimeout(r, 0));
    if (seq !== generateJsonSeq) return;
    if (!jsonModalVisible.value) return;

    try {
      const indent = options.isLargeDashboard.value ? 1 : 2;
      const text = JSON.stringify(dash, null, indent);
      if (seq !== generateJsonSeq) return;
      if (!jsonModalVisible.value) return;
      dashboardJson.value = text;
    } finally {
      if (seq !== generateJsonSeq) return;
      isGeneratingJson.value = false;
    }
  };

  watch(
    () => jsonModalVisible.value,
    (open) => {
      if (open) return;
      // Cancel any in-flight generation.
      generateJsonSeq++;
      isGeneratingJson.value = false;
    }
  );

  const openJsonModal = (mode: 'view' | 'edit' = 'view') => {
    if (options.isBooting.value) return;
    const dash = options.dashboardStore.getPersistableDashboardSnapshot();
    if (!dash) return;
    jsonModalMode.value = options.isReadOnly.value && mode === 'edit' ? 'view' : mode;
    jsonModalVisible.value = true;
    void generateDashboardJsonText(dash);
  };

  const closeJsonModal = () => {
    jsonModalVisible.value = false;
  };

  const handleJsonFileChange = (event: Event) => {
    if (options.isReadOnly.value) {
      const target = event.target as HTMLInputElement;
      target.value = '';
      message.warning('当前为只读模式，无法导入/应用 JSON');
      return;
    }
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const json = String(reader.result ?? '');
      // Importing does not need generation: cancel any in-flight generation.
      generateJsonSeq++;
      isGeneratingJson.value = false;
      dashboardJson.value = json;
      jsonModalMode.value = 'edit';
      jsonModalVisible.value = true;
      message.success('已加载 JSON，请检查并点击“应用”');
    };
    reader.readAsText(file);

    // Clear input so the same file can be imported again.
    target.value = '';
  };

  const handleImportJson = () => {
    if (options.isBooting.value) return;
    if (options.isReadOnly.value) {
      message.warning('当前为只读模式，无法导入/应用 JSON');
      return;
    }
    jsonFileInputRef.value?.click();
  };

  const handleApplyJson = () => {
    try {
      if (options.isBooting.value) return;
      if (options.isReadOnly.value) {
        message.warning('当前为只读模式，无法应用 JSON');
        return;
      }
      const dashboard = dashboardJsonEditorRef.value?.getDashboard();
      if (!dashboard) {
        message.error('无法应用：Dashboard JSON 不合法');
        return;
      }
      const rawText = dashboardJsonEditorRef.value?.getDraftText?.() ?? dashboardJson.value;
      void options.dashboardStore.applyDashboardFromJson(dashboard, rawText);
      jsonModalVisible.value = false;
      message.success('应用成功');
    } catch (error) {
      console.error('应用失败：JSON 格式错误', error);
      message.error((error as Error)?.message ?? '应用失败');
    }
  };

  return {
    MAX_EDITABLE_DASHBOARD_JSON_CHARS,
    jsonModalVisible,
    jsonModalMode,
    dashboardJson,
    isJsonValid,
    isGeneratingJson,
    dashboardJsonEditorRef,
    jsonFileInputRef,
    lockScrollEl,
    lockScrollEnabled,
    openJsonModal,
    closeJsonModal,
    handleJsonValidate,
    handleJsonFileChange,
    handleImportJson,
    handleApplyJson,
  };
}
