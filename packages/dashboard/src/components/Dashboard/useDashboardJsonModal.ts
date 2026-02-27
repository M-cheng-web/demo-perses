/**
 * Dashboard JSON 弹窗逻辑：查看、导入与应用（含大对象 stringify 性能保护）。
 */
import { computed, nextTick, ref, watch, type Ref } from 'vue';
import { message } from '@grafana-fast/component';
import type { DashboardContent } from '@grafana-fast/types';

type DashboardStoreLike = {
  getPersistableDashboardSnapshot: () => DashboardContent | null;
  applyDashboardFromJson: (dashboard: DashboardContent, rawText: string) => void | Promise<void>;
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
  jsonFileInputRef?: Ref<HTMLInputElement | undefined>;
}

export function useDashboardJsonModal(options: Options) {
  // 仅用于查看时的性能保护：超过该长度时，DashboardJsonEditor 会跳过昂贵的诊断解析（仍可查看/复制）。
  const MAX_DASHBOARD_JSON_CHARS_FOR_FAST_VIEW = 120_000;

  const jsonModalVisible = ref(false);
  const jsonModalMode = ref<'view' | 'import'>('view');
  const dashboardJson = ref('');
  const isGeneratingJson = ref(false);
  const isApplyingJson = ref(false);
  let generateJsonSeq = 0;
  const jsonFileInputRef = options.jsonFileInputRef ?? ref<HTMLInputElement>();

  const lockScrollEl = computed(() => options.contentEl.value ?? options.rootEl.value ?? null);
  const lockScrollEnabled = computed(() => lockScrollEl.value != null);

  const generateDashboardJsonText = async (dash: DashboardContent) => {
    const seq = ++generateJsonSeq;
    isGeneratingJson.value = true;
    // 避免“点击打开 → stringify 大对象 → 弹窗出现前 UI 卡住”。
    await nextTick();

    // 让出一帧：确保弹窗/加载提示已渲染。
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
      // 取消进行中的生成任务。
      generateJsonSeq++;
      isGeneratingJson.value = false;
    }
  );

  const openJsonModal = () => {
    if (options.isBooting.value) return;
    const dash = options.dashboardStore.getPersistableDashboardSnapshot();
    if (!dash) return;
    jsonModalMode.value = 'view';
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
      // 导入不需要生成：取消进行中的生成任务。
      generateJsonSeq++;
      isGeneratingJson.value = false;
      dashboardJson.value = json;
      jsonModalMode.value = 'import';
      jsonModalVisible.value = true;
      message.success('已加载 JSON，点击“应用”后将提交到服务端校验并覆盖当前配置');
    };
    reader.readAsText(file);

    // 清空 input 值，允许再次导入同一个文件。
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
    if (options.isBooting.value) return;
    if (options.isReadOnly.value) {
      message.warning('当前为只读模式，无法应用 JSON');
      return;
    }
    if (jsonModalMode.value !== 'import') return;
    if (isApplyingJson.value) return;

    const rawText = dashboardJson.value ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      console.error('应用失败：JSON 格式错误', error);
      message.error((error as Error)?.message ?? 'JSON 格式错误');
      return;
    }

    if (!parsed || typeof parsed !== 'object') {
      message.error('JSON 必须是对象');
      return;
    }

    isApplyingJson.value = true;
    const toastKey = 'dashboard-json-apply';
    message.loading({ content: '正在应用（服务端校验中）...', key: toastKey, duration: 0 });
    Promise.resolve(options.dashboardStore.applyDashboardFromJson(parsed as DashboardContent, rawText))
      .then(() => {
        jsonModalVisible.value = false;
        message.success({ content: '应用成功', key: toastKey, duration: 2 });
      })
      .catch((error) => {
        // 失败提示由 store 的 lastError 统一 toast，这里只清理 loading。
        message.destroy(toastKey);
        // 保留 console 输出，便于排查。
        // eslint-disable-next-line no-console -- 导入失败需要可追溯的日志
        console.error('应用导入的 dashboard JSON 失败：', error);
      })
      .finally(() => {
        isApplyingJson.value = false;
      });
  };

  return {
    MAX_DASHBOARD_JSON_CHARS_FOR_FAST_VIEW,
    jsonModalVisible,
    jsonModalMode,
    dashboardJson,
    isGeneratingJson,
    isApplyingJson,
    jsonFileInputRef,
    lockScrollEl,
    lockScrollEnabled,
    openJsonModal,
    closeJsonModal,
    handleJsonFileChange,
    handleImportJson,
    handleApplyJson,
  };
}
