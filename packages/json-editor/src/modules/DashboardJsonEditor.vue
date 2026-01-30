<!--
  组件说明：DashboardJsonEditor（Dashboard JSON 专用编辑器）

  目标（按当前阶段需求）：
  1) 基本能力：格式化 / 压缩 / 复制
  2) JSON 不合法时：只在编辑器内部报错，不会把内容同步到外部（避免污染外部状态）
  3) 支持外部校验钩子：每次输入变化都会调用；若不通过，编辑器展示错误且不向外同步
  4) 提供精简摘要：面板组数量、面板数量、变量数量（便于用户快速确认“粘贴对了”）
  5) 行号 + 错误行高亮：帮助用户定位语法错误

  说明：
  - 本组件不做 schemaVersion migration、不做“缺插件”检查（按你最新要求）
  - 外部只会拿到“最后一次通过校验的 JSON 文本”；草稿状态完全留在组件内部
-->
<template>
  <div :class="[bem(), themeClass]" :data-gf-theme="themeDataAttr">
    <Flex v-if="showToolbar" justify="between" align="center" :gap="10" style="margin-bottom: 10px">
      <Space :size="8">
        <Tag :variant="tagVariant" :color="tagColor" radius="pill">{{ tagText }}</Tag>
        <span v-if="!diagnostics.json.ok && diagnostics.json.error" :class="bem('pos')">
          第 {{ diagnostics.json.error.line }} 行，第 {{ diagnostics.json.error.column }} 列
        </span>
      </Space>

      <Space :size="8">
        <Button size="small" :disabled="effectiveReadOnly" @click="handleFormat">格式化</Button>
        <Button size="small" :disabled="effectiveReadOnly" @click="handleMinify">压缩</Button>
        <Button size="small" @click="handleCopy">复制</Button>
      </Space>
    </Flex>

    <JsonTextArea
      ref="textAreaRef"
      :model-value="draftText"
      :read-only="effectiveReadOnly"
      :height="normalizedHeight"
      :error-line="errorLine"
      @update:model-value="setDraft"
    />

    <Alert
      v-if="isTooLargeToEdit && !readOnly"
      type="warning"
      show-icon
      message="内容较大，已切换为只读"
      description="为避免卡顿，当前仅支持查看/复制；如需修改建议在外部编辑后重新导入。"
      style="margin-top: 10px"
    />

    <Alert
      v-if="!diagnostics.json.ok && diagnostics.json.error"
      type="error"
      show-icon
      message="JSON 不合法"
      :description="`${diagnostics.json.error.message}（第 ${diagnostics.json.error.line} 行，第 ${diagnostics.json.error.column} 列）`"
      style="margin-top: 10px"
    />

    <Alert
      v-else-if="diagnostics.json.ok && !diagnostics.looksLikeDashboard"
      type="warning"
      show-icon
      message="JSON 合法，但不是 Dashboard JSON"
      description="需要包含 panelGroups 等字段。该内容不会同步到外部。"
      style="margin-top: 10px"
    />

    <Alert
      v-else-if="diagnostics.json.ok && diagnostics.looksLikeDashboard && diagnostics.schemaVersionOk === false"
      type="error"
      show-icon
      message="Dashboard schemaVersion 不匹配"
      :description="diagnostics.schemaVersionError || 'schemaVersion 不匹配。该内容不会同步到外部。'"
      style="margin-top: 10px"
    />

    <Alert v-else-if="validatorErrors.length > 0" type="error" show-icon message="Dashboard 校验未通过" style="margin-top: 10px">
      <template #description>
        <div v-for="(line, idx) in validatorErrors" :key="idx" style="margin: 2px 0">
          {{ line }}
        </div>
      </template>
    </Alert>

    <Alert v-else-if="diagnostics.looksLikeDashboard && summaryLines.length > 0" type="success" show-icon message="摘要" style="margin-top: 10px">
      <template #description>
        <div v-for="(line, idx) in summaryLines" :key="idx" style="margin: 2px 0">
          {{ line }}
        </div>
      </template>
    </Alert>
  </div>
</template>

<script setup lang="ts">
  /**
   * 说明：
   * - 内部使用 draftText 承接用户输入；
   * - 仅当 “JSON parse ok + looksLikeDashboard + 外部校验通过” 时，才 emit update:modelValue；
   * - 外部校验钩子会在每次输入变化时触发（包含 JSON 不合法的情况）。
   */
  import { computed, ref, watch } from 'vue';
  import type { Dashboard } from '@grafana-fast/types';
  import { Alert, Button, Flex, Space, Tag, message } from '@grafana-fast/component';
  import type { JsonTextValidator } from '../types';
  import JsonTextArea from '../components/JsonTextArea.vue';
  import { analyzeDashboardText } from '../utils/dashboardDiagnostics';
  import { createNamespace } from '../utils/bem';

  defineOptions({ name: 'GfDashboardJsonEditor' });

  const [_, bem] = createNamespace('dashboard-json-editor');

  const props = withDefaults(
    defineProps<{
      /** Dashboard JSON 文本（受控，外部只会拿到“最后一次合法通过校验”的内容） */
      modelValue?: string;
      /** 只读模式 */
      readOnly?: boolean;
      /** 编辑器高度 */
      height?: string | number;
      /** 是否显示工具栏 */
      showToolbar?: boolean;
      /**
       * 主题（仅支持 light/dark/inherit）
       *
       * 说明：
       * - 默认 `inherit`：继承宿主/页面的主题（通常由 dashboard theme 或 ConfigProvider 控制）
       * - 设置为 `light`/`dark`：仅对编辑器自身生效（通过 data-gf-theme 局部覆盖 token）
       */
      theme?: 'light' | 'dark' | 'inherit';
      /**
       * 外部校验钩子（每次输入都会调用）
       *
       * 典型用途：
       * - 校验 “是否符合当前 dashboard 定义/业务约束”
       * - 例如：必填字段、panel/layout 一致性、变量 current 类型、refreshInterval 范围等
       *
       * 返回：
       * - [] 表示通过；非空数组表示错误列表（会展示，并阻断向外同步）
       */
      validate?: JsonTextValidator;
      /** 外部校验防抖（毫秒） */
      validateDebounceMs?: number;
      /**
       * 超过一定长度后强制只读（避免大文本编辑导致卡顿/卡死）
       *
       * 说明：
       * - 这里只做“编辑能力”的限制，仍然支持查看/复制/校验/应用
       * - 设为 0 表示不限制（不推荐）
       */
      maxEditableChars?: number;
    }>(),
    {
      modelValue: '',
      readOnly: false,
      height: 520,
      showToolbar: true,
      theme: 'inherit',
      validate: undefined,
      validateDebounceMs: 0,
      maxEditableChars: 1_048_576,
    }
  );

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'change', value: string): void;
    (e: 'validate', ok: boolean): void;
  }>();

  const normalizedHeight = computed(() => (typeof props.height === 'number' ? `${props.height}px` : props.height));

  const themeDataAttr = computed(() => (props.theme === 'inherit' ? undefined : props.theme));
  const themeClass = computed(() => {
    if (props.theme === 'inherit') return undefined;
    return props.theme === 'dark' ? 'gf-theme-dark' : 'gf-theme-blue';
  });

  const draftText = ref(props.modelValue ?? '');
  const maxEditableCharsLimit = computed(() => Math.max(0, Math.floor(props.maxEditableChars ?? 0)));
  const shouldSkipDiagnostics = (text: string) => {
    // 只读 + 无外部校验器场景：文本只用于“查看”，没必要为摘要/启发式判断做一次完整 parse
    // 这能显著缓解“大 JSON 查看时打开即卡顿”的问题。
    if (!props.readOnly) return false;
    if (props.validate) return false;
    const limit = maxEditableCharsLimit.value;
    if (!limit || limit <= 0) return false;
    return (text ?? '').length > limit;
  };

  const computeDiagnostics = (text: string) => {
    if (shouldSkipDiagnostics(text)) {
      return {
        json: { ok: true, value: undefined },
        looksLikeDashboard: true,
      } as ReturnType<typeof analyzeDashboardText>;
    }
    return analyzeDashboardText(text);
  };

  const diagnostics = ref(computeDiagnostics(draftText.value));
  const validatorErrors = ref<string[]>([]);
  const validating = ref(false);
  let validateSeq = 0;
  let validateTimer: number | null = null;

  const errorLine = computed(() => (diagnostics.value.json.ok ? null : (diagnostics.value.json.error?.line ?? null)));
  const isTooLargeToEdit = computed(() => {
    const limit = Math.max(0, Math.floor(props.maxEditableChars ?? 0));
    if (limit <= 0) return false;
    return (draftText.value ?? '').length > limit;
  });

  const effectiveReadOnly = computed(() => Boolean(props.readOnly) || isTooLargeToEdit.value);

  const textAreaRef = ref<null | {
    scrollToLine?: (line: number) => void;
  }>(null);

  const runExternalValidate = async (text: string, parsedValue: unknown | undefined) => {
    const fn = props.validate;
    if (!fn) {
      validatorErrors.value = [];
      validating.value = false;
      return;
    }

    const seq = ++validateSeq;
    validating.value = true;
    validatorErrors.value = [];

    try {
      const res = await fn(text, parsedValue);
      if (seq !== validateSeq) return;
      validatorErrors.value = (res ?? []).map((s) => String(s)).filter((s) => s.trim().length > 0);
    } catch (e) {
      if (seq !== validateSeq) return;
      validatorErrors.value = [`外部校验执行异常：${(e as Error)?.message ?? String(e)}`];
    } finally {
      if (seq !== validateSeq) return;
      validating.value = false;

      const d = diagnostics.value;
      const ok = d.json.ok && d.looksLikeDashboard && d.schemaVersionOk !== false && validatorErrors.value.length === 0;

      // 外部校验结束后，如果此时内容仍然是当前 draft，且校验通过，则将其同步到外部
      if (ok && draftText.value === text && text !== (props.modelValue ?? '')) {
        emit('update:modelValue', text);
      }
      emit('validate', ok);
    }
  };

  const scheduleExternalValidate = (text: string, parsedValue: unknown | undefined) => {
    if (validateTimer != null) window.clearTimeout(validateTimer);
    const delay = Math.max(0, Math.floor(props.validateDebounceMs ?? 0));

    if (props.validate) {
      validating.value = true;
      validatorErrors.value = [];
    }

    validateTimer = window.setTimeout(() => {
      validateTimer = null;
      void runExternalValidate(text, parsedValue);
    }, delay);
  };

  const canSyncToOuter = computed(() => {
    if (validating.value) return false;
    const d = diagnostics.value;
    return d.json.ok && d.looksLikeDashboard && d.schemaVersionOk !== false && validatorErrors.value.length === 0;
  });

  const setDraft = (value: string) => {
    draftText.value = value;
    emit('change', value);

    const d = analyzeDashboardText(value ?? '');
    diagnostics.value = d;

    // 每次输入都触发外部校验钩子（包含 JSON 不合法情况）
    if (props.validate) {
      scheduleExternalValidate(value, d.json.ok ? d.json.value : undefined);
    }

    // 没有外部校验器时：可以在本次输入内直接决定是否同步（更跟手）
    if (!props.validate) {
      const ok = d.json.ok && d.looksLikeDashboard && d.schemaVersionOk !== false;
      if (ok && value !== (props.modelValue ?? '')) emit('update:modelValue', value);
      emit('validate', ok);
      return;
    }

    emit('validate', false);
  };

  const summaryLines = computed(() => {
    const d = diagnostics.value;
    if (!d.looksLikeDashboard || !d.summary) return [];
    return [`面板组：${d.summary.panelGroupCount}`, `面板：${d.summary.panelCount}`, `变量：${d.summary.variableCount}`];
  });

  const tagText = computed(() => {
    const d = diagnostics.value;
    if (!d.json.ok) return 'JSON 错误';
    if (!d.looksLikeDashboard) return '不是 Dashboard';
    if (validating.value) return '校验中...';
    if (validatorErrors.value.length > 0) return '校验未通过';
    if (isTooLargeToEdit.value && !props.readOnly) return '只读（内容过大）';
    return '可应用';
  });

  const tagVariant = computed(() => (canSyncToOuter.value ? 'color' : 'neutral'));
  const tagColor = computed(() => {
    const d = diagnostics.value;
    if (!d.json.ok) return 'var(--gf-color-danger)';
    if (!d.looksLikeDashboard) return 'var(--gf-color-warning)';
    if (validating.value) return 'var(--gf-color-primary)';
    if (validatorErrors.value.length > 0) return 'var(--gf-color-danger)';
    return 'var(--gf-color-success)';
  });

  const handleFormat = () => {
    const d = diagnostics.value;
    if (!d.json.ok) {
      message.error('无法格式化：JSON 不合法');
      return;
    }
    try {
      setDraft(JSON.stringify(d.json.value, null, 2));
    } catch (e) {
      message.error(`格式化失败：${(e as Error)?.message ?? String(e)}`);
    }
  };

  const handleMinify = () => {
    const d = diagnostics.value;
    if (!d.json.ok) {
      message.error('无法压缩：JSON 不合法');
      return;
    }
    try {
      setDraft(JSON.stringify(d.json.value));
    } catch (e) {
      message.error(`压缩失败：${(e as Error)?.message ?? String(e)}`);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftText.value ?? '');
      message.success('已复制');
    } catch {
      message.error('复制失败（浏览器可能不允许）');
    }
  };

  defineExpose({
    /** 仅用于需要“点击应用”时拿到解析后的 dashboard */
    getDashboard: (): Dashboard => {
      const d = diagnostics.value;
      if (!d.json.ok) throw new Error(d.json.error?.message ?? 'JSON 不合法');
      if (!d.looksLikeDashboard) throw new Error('JSON 合法，但不是 Dashboard JSON');
      return (d.dashboard ?? (d.json.value as Dashboard)) as Dashboard;
    },
    getDraftText: () => draftText.value,
  });

  watch(
    errorLine,
    (n) => {
      if (n == null) return;
      if (!isTooLargeToEdit.value) return;
      textAreaRef.value?.scrollToLine?.(n);
    },
    { immediate: false }
  );

  watch(
    () => props.modelValue,
    (v) => {
      draftText.value = v ?? '';
      const d = computeDiagnostics(draftText.value);
      diagnostics.value = d;
      if (props.validate) {
        scheduleExternalValidate(draftText.value, d.json.ok ? d.json.value : undefined);
      }
    },
    { immediate: true }
  );
</script>

<style scoped>
  .gf-dashboard-json-editor__pos {
    color: var(--gf-color-danger);
    font-size: 12px;
  }
</style>
