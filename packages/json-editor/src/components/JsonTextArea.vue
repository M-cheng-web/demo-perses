<!--
  组件说明：JsonTextArea（带行号的轻量文本编辑器）

  为什么要在 json-editor 内实现（而不是用组件库的 CodeEditor）：
  - 这里需要“行号 + 错误行高亮”，而 textarea 本身无法只对某一行做样式标记；
  - 我们采用“背景层 + textarea 前景层”的方式：背景层负责高亮，textarea 负责输入与光标；
  - 整体保持轻量：不引入 Monaco / CodeMirror，避免体积与初始化成本。

  能力：
  - 每行行号（从 1 开始）
  - 通过 errorLine 高亮某一行（用于 JSON 语法错误定位）

  注意：
  - 为了保证“行号/高亮行”稳定对齐，这里强制使用不自动换行（wrap=off），
    长行通过横向滚动查看，这对 JSON 这种结构化文本更可控。
-->
<template>
  <div :class="bem()" :style="{ height: normalizedHeight }">
    <div :class="bem('gutter')">
      <div :class="bem('gutterInner')" :style="translateStyle">
        <div v-for="n in visibleLineNos" :key="n" :class="[bem('lineNo'), { 'is-error': n === errorLine }]">
          {{ n }}
        </div>
      </div>
    </div>

    <div :class="bem('main')">
      <!-- 背景高亮层：只负责“错误行背景色”，不渲染文本（避免与 textarea 的字体/选区冲突） -->
      <div :class="bem('highlight')">
        <div :class="bem('highlightInner')" :style="translateStyle">
          <div v-for="n in visibleLineNos" :key="n" :class="[bem('highlightLine'), { 'is-error': n === errorLine }]"> &nbsp; </div>
        </div>
      </div>

      <textarea
        ref="textareaRef"
        :class="bem('textarea')"
        :value="modelValue"
        :readonly="readOnly"
        wrap="off"
        spellcheck="false"
        @input="handleInput"
        @scroll="handleScroll"
      ></textarea>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * 说明：
   * - 这个组件只做“文本输入 + 行号 + 高亮行”，不关心 JSON 语义；
   * - JSON 合法性、错误行列、外部校验等逻辑由上层（JsonEditorLite / DashboardJsonEditor）负责。
   */
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { createNamespace } from '../utils/bem';

  defineOptions({ name: 'GfJsonTextArea' });

  const [_, bem] = createNamespace('json-textarea');

  const props = withDefaults(
    defineProps<{
      /** 文本内容（受控） */
      modelValue?: string;
      /** 只读模式 */
      readOnly?: boolean;
      /** 高度（number 表示 px） */
      height?: string | number;
      /**
       * 错误行（从 1 开始）
       * - 当为 undefined/null 时不高亮
       */
      errorLine?: number | null;
    }>(),
    {
      modelValue: '',
      readOnly: false,
      height: 420,
      errorLine: null,
    }
  );

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'change', value: string): void;
    (e: 'scroll', payload: { top: number; left: number }): void;
  }>();

  const textareaRef = ref<HTMLTextAreaElement | null>(null);
  const scrollTop = ref(0);
  const scrollLeft = ref(0);
  const textareaHeight = ref(0);

  const normalizedHeight = computed(() => (typeof props.height === 'number' ? `${props.height}px` : props.height));

  const FALLBACK_HEIGHT_PX = 420;
  const fallbackHeightPx = computed(() => {
    if (typeof props.height === 'number') return Math.max(1, Math.floor(props.height));
    const raw = String(props.height ?? '');
    const match = /^([0-9]+(?:\\.[0-9]+)?)px$/.exec(raw);
    if (match) return Math.max(1, Math.floor(Number(match[1])));
    return FALLBACK_HEIGHT_PX;
  });

  const LINE_HEIGHT_PX = 18;
  const PAD_Y_PX = 10;
  const OVERSCAN_LINES = 20;

  const errorLine = computed(() => {
    const n = props.errorLine;
    if (n == null) return null;
    if (!Number.isFinite(n)) return null;
    return Math.max(1, Math.floor(n));
  });

  const viewportHeightPx = computed(() => {
    const h = textareaHeight.value;
    if (h > 0) return h;
    return fallbackHeightPx.value;
  });

  const visibleLineCapacity = computed(() => {
    const content = Math.max(0, viewportHeightPx.value - PAD_Y_PX * 2);
    return Math.max(1, Math.ceil(content / LINE_HEIGHT_PX));
  });

  const baseVisibleLine = computed(() => {
    const contentScrollTop = Math.max(0, scrollTop.value - PAD_Y_PX);
    return Math.floor(contentScrollTop / LINE_HEIGHT_PX) + 1;
  });

  const startLine = computed(() => Math.max(1, baseVisibleLine.value - OVERSCAN_LINES));
  const endLine = computed(() => baseVisibleLine.value + visibleLineCapacity.value + OVERSCAN_LINES);

  const visibleLineNos = computed(() => {
    const start = startLine.value;
    const end = endLine.value;
    const size = Math.max(0, end - start + 1);
    const out = new Array<number>(size);
    for (let i = 0; i < size; i++) out[i] = start + i;
    return out;
  });

  const translateStyle = computed(() => {
    const yOffset = (startLine.value - 1) * LINE_HEIGHT_PX;
    return {
      transform: `translate(${-scrollLeft.value}px, ${-scrollTop.value + yOffset}px)`,
    };
  });

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement | null;
    const value = target?.value ?? '';
    emit('update:modelValue', value);
    emit('change', value);
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLTextAreaElement | null;
    scrollTop.value = target?.scrollTop ?? 0;
    scrollLeft.value = target?.scrollLeft ?? 0;
    emit('scroll', { top: scrollTop.value, left: scrollLeft.value });
  };

  let resizeObserver: ResizeObserver | null = null;
  const updateTextareaHeight = () => {
    const el = textareaRef.value;
    if (!el) return;
    textareaHeight.value = Math.max(1, Math.floor(el.clientHeight));
  };

  const scrollToTop = () => {
    const el = textareaRef.value;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
    scrollTop.value = 0;
    scrollLeft.value = 0;
  };

  const scrollToLine = (line: number) => {
    const el = textareaRef.value;
    if (!el) return;
    const n = Math.max(1, Math.floor(Number(line)));
    const nextTop = Math.max(0, (n - 1) * LINE_HEIGHT_PX);
    el.scrollTop = nextTop;
    scrollTop.value = nextTop;
  };

  defineExpose({
    scrollToTop,
    scrollToLine,
  });

  onMounted(() => {
    updateTextareaHeight();
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateTextareaHeight());
      if (textareaRef.value) resizeObserver.observe(textareaRef.value);
    }
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
  });

  // 当外部 modelValue 被重置（例如“加载示例 JSON”）时，同步滚动位置到顶部，体验更直观。
  watch(
    () => props.modelValue,
    () => {
      scrollToTop();
      updateTextareaHeight();
    }
  );
</script>

<style scoped lang="less">
  // 这些数值必须在 gutter/highlight/textarea 三者保持一致，否则行号与高亮会错位
  @line-height: 18px;
  @pad-y: 10px;
  @pad-x: 12px;

  .gf-json-textarea {
    display: flex;
    width: 100%;
    border: 1px solid var(--gf-color-border);
    border-radius: var(--gf-radius-md);
    overflow: hidden;
    background: var(--gf-color-surface);
  }

  .gf-json-textarea__gutter {
    width: 56px;
    flex: 0 0 56px;
    border-right: 1px solid var(--gf-color-border-muted);
    background: var(--gf-color-surface-muted);
    color: var(--gf-color-text-secondary);
    overflow: hidden;
    position: relative;
  }

  .gf-json-textarea__gutterInner {
    padding: @pad-y 10px;
    line-height: @line-height;
    font-size: 12px;
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    will-change: transform;
  }

  .gf-json-textarea__lineNo {
    height: @line-height;
    user-select: none;

    &.is-error {
      color: var(--gf-color-danger);
      font-weight: 650;
    }
  }

  .gf-json-textarea__main {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
  }

  .gf-json-textarea__highlight {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .gf-json-textarea__highlightInner {
    padding: @pad-y @pad-x;
    line-height: @line-height;
    will-change: transform;
  }

  .gf-json-textarea__highlightLine {
    height: @line-height;
    border-radius: 4px;

    &.is-error {
      background: rgba(255, 77, 79, 0.16);
      outline: 1px solid rgba(255, 77, 79, 0.28);
    }
  }

  .gf-json-textarea__textarea {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    resize: none;
    border: 0;
    outline: 0;
    padding: @pad-y @pad-x;
    background: transparent;
    color: var(--gf-color-text);
    font-size: 12px;
    line-height: @line-height;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    overflow: auto;
  }
</style>
