<!--
  组件说明：JsonEditorLite（轻量 JSON 编辑器）

  定位：
  - 一个“通用 JSON 文本编辑器”，用于粘贴/少量编辑 JSON
  - 提供基础工具：格式化 / 压缩 / 复制
  - 提供清晰校验：JSON 是否合法 + 错误行/列定位

  注意：
  - 本组件默认采用“仅在合法时才向外同步”的策略：
    用户输入非法 JSON 时，编辑器内部会显示错误，但不会 emit update:modelValue 影响外部状态。
  - Dashboard 场景请使用 DashboardJsonEditor（在此基础上增加了 Dashboard 摘要与更明确的阻断提示）
-->
<template>
  <div :class="[bem(), themeClass]" :data-gf-theme="themeDataAttr">
    <Flex v-if="showToolbar" justify="between" align="center" :gap="10" style="margin-bottom: 10px">
      <Space :size="8">
        <Tag :variant="tagVariant" :color="tagColor" radius="pill">
          {{ tagText }}
        </Tag>
        <span v-if="!diagnostics.ok && diagnostics.error" :class="bem('pos')">
          第 {{ diagnostics.error.line }} 行，第 {{ diagnostics.error.column }} 列
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
      v-if="!diagnostics.ok && diagnostics.error"
      type="error"
      show-icon
      message="JSON 不合法"
      :description="`${diagnostics.error.message}（第 ${diagnostics.error.line} 行，第 ${diagnostics.error.column} 列）`"
      style="margin-top: 10px"
    />

    <Alert v-else-if="validatorErrors.length > 0" type="error" show-icon message="校验未通过" style="margin-top: 10px">
      <template #description>
        <div v-for="(line, idx) in validatorErrors" :key="idx" style="margin: 2px 0">
          {{ line }}
        </div>
      </template>
    </Alert>
  </div>
</template>

<script setup lang="ts">
  /**
   * 说明：
   * - 这里的逻辑刻意保持“轻量但产品化”
   * - 校验与错误定位由 jsonc-parser 支持（utils/analyzeJsonText）
   *
   * 核心策略（按你最新需求）：
   * - 用户输入的内容先落在 draftText（内部草稿）里；
   * - 当 JSON 不合法 / 外部校验不通过时，不会 emit update:modelValue，避免外部状态被污染；
   * - 只有当“JSON 语法合法 + 外部校验通过”时，才会把 draftText 同步到外部 modelValue。
   */
  import { computed, ref, watch } from 'vue';
  import { Alert, Button, Flex, Space, Tag, message } from '@grafana-fast/component';
  import type { JsonTextDiagnostics, JsonTextValidator } from '../types';
  import JsonTextArea from '../components/JsonTextArea.vue';
  import { analyzeJsonText } from '../utils/jsonDiagnostics';
  import { createNamespace } from '../utils/bem';

  defineOptions({ name: 'GfJsonEditorLite' });

  const [_, bem] = createNamespace('json-editor-lite');

  const props = withDefaults(
    defineProps<{
      /**
       * JSON 文本（受控，外部只会拿到“最后一次合法通过校验”的内容）
       *
       * 说明：
       * - 编辑器内部会维护 draftText，用户输入会先写入 draftText
       * - 只有当校验通过时才会 emit update:modelValue
       */
      modelValue?: string;
      /** 只读模式 */
      readOnly?: boolean;
      /** 编辑器高度 */
      height?: string | number;
      /** 是否显示工具栏 */
      showToolbar?: boolean;
      /**
       * 外部校验钩子（每次输入都会调用）
       *
       * 典型用途：
       * - 外部判断“是否符合当前业务定义/结构约束”
       *
       * 重要：
       * - 当返回错误时，编辑器只展示错误，不会把 draft 同步到外部 modelValue
       */
      validate?: JsonTextValidator;
      /**
       * 外部校验防抖（毫秒）
       * - 默认 0：每次输入都触发（严格符合“每次更改都校验”的语义）
       * - 若外部校验较重，可由宿主显式设置为 100~300ms
       */
      validateDebounceMs?: number;
      /**
       * 超过一定长度后强制只读（避免大文本编辑导致卡顿/卡死）
       *
       * 说明：
       * - 这里只做“编辑能力”的限制，仍然支持查看/复制/校验
       * - 设为 0 表示不限制（不推荐）
       */
      maxEditableChars?: number;
      /**
       * 主题（仅支持 light/dark/inherit）
       *
       * 说明：
       * - 默认 `inherit`：继承宿主/页面的主题（通常由 dashboard theme 或 ConfigProvider 控制）
       * - 设置为 `light`/`dark`：仅对编辑器自身生效（通过 data-gf-theme 局部覆盖 token）
       */
      theme?: 'light' | 'dark' | 'inherit';
    }>(),
    {
      modelValue: '',
      readOnly: false,
      height: 420,
      showToolbar: true,
      validate: undefined,
      validateDebounceMs: 0,
      theme: 'inherit',
      maxEditableChars: 1_048_576,
    }
  );

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'change', value: string): void;
    (e: 'validate', ok: boolean): void;
  }>();

  const normalizedHeight = computed(() => (typeof props.height === 'number' ? `${props.height}px` : props.height));
  const diagnostics = ref<JsonTextDiagnostics>({ ok: true, value: null });
  const draftText = ref(props.modelValue ?? '');
  const validatorErrors = ref<string[]>([]);
  const validating = ref(false);
  let validateSeq = 0;
  let validateTimer: number | null = null;

  const themeDataAttr = computed(() => (props.theme === 'inherit' ? undefined : props.theme));
  const themeClass = computed(() => {
    if (props.theme === 'inherit') return undefined;
    return props.theme === 'dark' ? 'gf-theme-dark' : 'gf-theme-blue';
  });

  const errorLine = computed(() => (diagnostics.value.ok ? null : (diagnostics.value.error?.line ?? null)));
  const isTooLargeToEdit = computed(() => {
    const limit = Math.max(0, Math.floor(props.maxEditableChars ?? 0));
    if (limit <= 0) return false;
    return (draftText.value ?? '').length > limit;
  });

  const effectiveReadOnly = computed(() => Boolean(props.readOnly) || isTooLargeToEdit.value);
  const textAreaRef = ref<null | { scrollToLine?: (line: number) => void }>(null);

  const recompute = (text: string) => {
    const d = analyzeJsonText(text ?? '');
    diagnostics.value = d;
  };

  // 对外暴露：上层需要时可读取诊断结果（例如展示在 Modal footer）
  defineExpose({
    getDiagnostics: () => diagnostics.value,
    getDraftText: () => draftText.value,
  });

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

      // 外部校验结束后，如果此时内容仍然是当前 draft，且校验通过，则将其同步到外部
      const d = diagnostics.value;
      const ok = d.ok && validatorErrors.value.length === 0;
      if (ok && draftText.value === text && text !== (props.modelValue ?? '')) {
        emit('update:modelValue', text);
      }
      emit('validate', ok);
    }
  };

  const scheduleExternalValidate = (text: string, parsedValue: unknown | undefined) => {
    if (validateTimer != null) window.clearTimeout(validateTimer);
    const delay = Math.max(0, Math.floor(props.validateDebounceMs ?? 0));
    // 有外部校验器时：一旦内容变动就进入“校验中”状态，阻断向外同步
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
    // validating 时，先阻断同步，避免外部收到“校验中”的内容
    if (validating.value) return false;
    return diagnostics.value.ok && validatorErrors.value.length === 0;
  });

  const setDraft = (value: string) => {
    draftText.value = value;
    emit('change', value);

    const d = analyzeJsonText(value ?? '');
    diagnostics.value = d;

    // 每次输入都触发外部校验钩子（即便 JSON 不合法，也会把 raw text 传给外部）
    scheduleExternalValidate(value, d.ok ? d.value : undefined);

    // 没有外部校验器时：可以在本次输入内直接决定是否同步（更跟手）
    if (!props.validate) {
      const ok = d.ok;
      if (ok && value !== (props.modelValue ?? '')) emit('update:modelValue', value);
      emit('validate', ok);
      return;
    }

    // 有外部校验器时：同步由 runExternalValidate 的 finally 统一决定
    emit('validate', false);
  };

  const handleFormat = () => {
    try {
      const d = analyzeJsonText(draftText.value ?? '');
      if (!d.ok) {
        message.error('无法格式化：JSON 不合法');
        return;
      }
      setDraft(JSON.stringify(d.value, null, 2));
    } catch (error) {
      message.error(`格式化失败：${(error as Error)?.message ?? String(error)}`);
    }
  };

  const handleMinify = () => {
    try {
      const d = analyzeJsonText(draftText.value ?? '');
      if (!d.ok) {
        message.error('无法压缩：JSON 不合法');
        return;
      }
      setDraft(JSON.stringify(d.value));
    } catch (error) {
      message.error(`压缩失败：${(error as Error)?.message ?? String(error)}`);
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

  const tagText = computed(() => {
    if (!diagnostics.value.ok) return 'JSON 错误';
    if (validating.value) return '校验中...';
    if (validatorErrors.value.length > 0) return '校验未通过';
    if (isTooLargeToEdit.value && !props.readOnly) return '只读（内容过大）';
    return '合法 JSON';
  });

  const tagVariant = computed(() => (canSyncToOuter.value ? 'color' : 'neutral'));
  const tagColor = computed(() => {
    if (!diagnostics.value.ok) return 'var(--gf-color-danger)';
    if (validating.value) return 'var(--gf-color-primary)';
    if (validatorErrors.value.length > 0) return 'var(--gf-color-danger)';
    return 'var(--gf-color-success)';
  });

  watch(errorLine, (n) => {
    if (n == null) return;
    if (!isTooLargeToEdit.value) return;
    textAreaRef.value?.scrollToLine?.(n);
  });

  // 外部 modelValue 更新时，同步到内部 draft
  watch(
    () => props.modelValue,
    (v) => {
      draftText.value = v ?? '';
      recompute(draftText.value);
      // 外部变更同样触发外部校验（例如外部“加载示例 JSON”）
      scheduleExternalValidate(draftText.value, diagnostics.value.ok ? diagnostics.value.value : undefined);
    },
    { immediate: true }
  );
</script>

<style scoped>
  .gf-json-editor-lite__pos {
    color: var(--gf-color-danger);
    font-size: 12px;
  }
</style>
