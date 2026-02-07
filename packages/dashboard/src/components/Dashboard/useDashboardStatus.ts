import { computed, ref, watch, type Ref } from 'vue';
import { message } from '@grafana-fast/component';
import { ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons-vue';

type DashboardStatusKind = 'waiting' | 'loading' | 'error';

interface BootStatsLike {
  groupCount: number | null;
  panelCount: number | null;
  jsonBytes: number | null;
  source: 'remote' | 'import' | null;
}

interface UseDashboardStatusOptions {
  dashboardId: Ref<string | number | null | undefined>;
  currentDashboard: Ref<unknown | null>;
  isBooting: Ref<boolean>;
  bootStage: Ref<'idle' | 'fetching' | 'parsing' | 'initializing' | 'ready' | 'error'>;
  bootStats: Ref<BootStatsLike>;
  isLargeDashboard: Ref<boolean>;
  isSaving: Ref<boolean>;
  isSyncing: Ref<boolean>;
  lastError: Ref<string | null>;
}

export function useDashboardStatus(options: UseDashboardStatusOptions) {
  const { dashboardId, currentDashboard, isBooting, bootStage, bootStats, isLargeDashboard, isSaving, isSyncing, lastError } = options;

  // ---------------------------
  // 乐观同步的反馈提示
  // ---------------------------
  // 自动同步失败时 store 会回滚到 syncedDashboard，这在 UI 上会表现为“刚改完又变回去了”。
  // 这里提供 toast 提示，避免误解为问题/丢数据。
  const lastErrorToastAt = ref(0);
  const lastErrorToastMessage = ref<string | null>(null);
  const ERROR_TOAST_COOLDOWN_MS = 2_500;

  watch(lastError, (err) => {
    if (!err) return;
    const now = Date.now();
    const isCooldown = now - lastErrorToastAt.value < ERROR_TOAST_COOLDOWN_MS;
    if (isCooldown && lastErrorToastMessage.value === err) return;
    lastErrorToastAt.value = now;
    lastErrorToastMessage.value = err;

    if (bootStage.value === 'error') {
      message.error(`仪表盘加载失败：${err}`);
      return;
    }

    // 手动保存失败：明确告诉用户（上层可能也会捕获 error，但不一定 toast）
    if (isSaving.value) {
      message.error(`保存失败：${err}`);
      return;
    }

    // 自动同步失败：提示已回滚到上一次成功版本
    if (isSyncing.value) {
      message.error(`同步失败，已回滚到上次保存版本：${err}`);
      return;
    }

    message.error(err);
  });

  const bootTitle = computed(() => {
    switch (bootStage.value) {
      case 'fetching':
        return '正在加载仪表盘配置...';
      case 'parsing':
        return '正在解析仪表盘 JSON...';
      case 'initializing':
        return '正在初始化面板...';
      default:
        return '正在加载...';
    }
  });

  const bootDetail = computed(() => {
    const parts: string[] = [];
    const src = bootStats.value.source === 'import' ? '导入' : '加载';
    parts.push(`来源：${src}`);
    if (dashboardId.value) parts.push(`dashboardId：${String(dashboardId.value)}`);
    if (typeof bootStats.value.groupCount === 'number') parts.push(`面板组：${bootStats.value.groupCount}`);
    if (typeof bootStats.value.panelCount === 'number') parts.push(`面板：${bootStats.value.panelCount}`);
    if (typeof bootStats.value.jsonBytes === 'number') {
      const mb = (bootStats.value.jsonBytes / 1024 / 1024).toFixed(2);
      parts.push(`JSON：${mb}MB`);
    }
    return parts.join(' / ');
  });

  const statusKind = computed<DashboardStatusKind | null>(() => {
    if (isBooting.value) return 'loading';
    if (currentDashboard.value) return null;
    if (bootStage.value === 'error') return 'error';
    // currentDashboard 为空且不在 boot：典型为宿主正在远程获取 dashboardId
    return 'waiting';
  });

  const statusTitle = computed(() => {
    switch (statusKind.value) {
      case 'loading':
        return bootTitle.value;
      case 'error':
        if (bootStats.value.source === 'import') return '导入失败';
        if (bootStats.value.source === 'remote') return '加载失败';
        return '初始化失败';
      case 'waiting':
        return '正在准备仪表盘...';
      default:
        return '';
    }
  });

  const statusDetail = computed(() => {
    switch (statusKind.value) {
      case 'loading':
        return bootDetail.value;
      case 'error': {
        const idText = dashboardId.value ? `dashboardId：${String(dashboardId.value)}` : '';
        const errText = lastError.value ? `错误：${String(lastError.value)}` : '错误：未知错误';
        const hint = '可稍后重试或导入 JSON';
        return idText ? `${idText} / ${errText}（${hint}）` : `${errText}（${hint}）`;
      }
      case 'waiting':
        return '等待宿主获取 dashboardId 并调用 loadDashboard(dashboardId) 后加载远端 JSON...';
      default:
        return '';
    }
  });

  const statusHint = computed(() => {
    if (statusKind.value === 'loading' && isLargeDashboard.value) {
      return '检测到数据量较大，首次加载可能需要更久，请耐心等待';
    }
    return '';
  });

  const statusIcon = computed(() => {
    switch (statusKind.value) {
      case 'error':
        return CloseCircleOutlined;
      case 'waiting':
        return ClockCircleOutlined;
      default:
        return ClockCircleOutlined;
    }
  });

  const handleStatusMaskWheel = (event: WheelEvent) => {
    event.preventDefault();
  };

  const handleStatusMaskTouchMove = (event: TouchEvent) => {
    event.preventDefault();
  };

  return {
    statusKind,
    statusTitle,
    statusDetail,
    statusHint,
    statusIcon,
    handleStatusMaskWheel,
    handleStatusMaskTouchMove,
  };
}
