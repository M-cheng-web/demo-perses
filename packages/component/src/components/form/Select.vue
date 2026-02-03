<!-- 组件说明：下拉选择器，支持单选/多选、搜索、清空 (AntD-inspired) -->
<template>
  <div
    :class="[
      bem(),
      bem({ [`size-${size}`]: true }),
      { 'is-open': open, 'is-disabled': disabled, 'is-clearable': showClear, 'is-multiple': isMultiple, 'is-focused': isFocused },
    ]"
    ref="rootRef"
    :style="rootStyle"
  >
    <div
      ref="controlRef"
      :class="[
        bem('selector'),
        variant === 'text' ? bem('selector--text') : '',
        { 'is-disabled': disabled },
      ]"
      tabindex="0"
      @click="handleTriggerClick"
      @pointerdown="handlePointerDownInside"
      @focusin="handleFocusIn"
      @focusout="handleFocusOut"
      @keydown="handleKeydown"
    >
      <div v-if="isMultiple" :class="bem('selection')">
        <span
          v-for="(item, idx) in selectedOptions"
          :key="item.value"
          v-show="idx < visibleTagCount"
          :data-gf-value="String(item.value)"
          :class="[bem('item'), 'gf-select-item']"
        >
          <span :class="bem('item-content')">{{ formatTagLabel(item.label) }}</span>
          <span :class="bem('item-remove')" @click.stop="() => removeValue(item.value)">
            <CloseOutlined />
          </span>
        </span>
        <span
          v-if="collapsedTagCount > 0"
          :class="[bem('item'), bem('item-rest')]"
        >
          +{{ collapsedTagCount }}
        </span>
        <span :class="bem('search-mirror')" ref="searchMirrorRef">{{ search }}&nbsp;</span>
        <input
          v-if="showSearch"
          ref="searchInputRef"
          v-model="search"
          :class="bem('search')"
          type="text"
          :placeholder="selectedOptions.length === 0 ? placeholder : ''"
          :style="searchInputStyle"
          @click.stop="handleSearchClick"
          @keydown.stop="handleSearchKeydown"
        />
      </div>
      <template v-else>
        <span :class="bem('selection')">
          <template v-if="selectedOptions[0]">
            <slot name="value" :option="selectedOptions[0]" :value="selectedOptions[0].value" :label="selectedOptions[0].label" :open="open">
              <span :class="bem('selection-item')">{{ selectedOptions[0].label }}</span>
            </slot>
          </template>
          <span v-else :class="bem('placeholder')">{{ placeholder }}</span>
          <input
            v-if="showSearch && !isMultiple"
            ref="searchInputRef"
            v-model="search"
            :class="bem('search')"
            type="text"
            :style="{ opacity: open ? 1 : 0, width: open ? '100%' : 0 }"
            @click.stop
            @keydown.stop="handleSearchKeydown"
          />
        </span>
      </template>
      <span :class="bem('arrow')">
        <span :class="[bem('arrow-icon'), { 'is-open': open }]">
          <DownOutlined />
        </span>
        <Transition name="gf-zoom-in">
          <span v-if="showClear" :class="bem('clear')" @click.stop="clearValue">
            <CloseCircleFilled />
          </span>
        </Transition>
      </span>
    </div>

    <Teleport :to="portalTarget">
      <Transition name="gf-slide-up">
        <div v-if="open" :class="[bem('dropdown'), themeClass]" :data-gf-theme="colorScheme" :style="dropdownStyle" ref="dropdownRef">
          <div v-if="showSearch && !isMultiple" :class="bem('dropdown-search')" @click.stop>
            <input
              ref="dropdownSearchRef"
              v-model="search"
              :class="bem('dropdown-search-input')"
              type="text"
              :placeholder="'搜索...'"
              @keydown.stop="handleSearchKeydown"
            />
          </div>
          <div :class="bem('dropdown-content')" :style="optionsStyle">
            <div
              v-for="(option, idx) in filteredOptions"
              :key="option.value"
              :class="[
                bem('option'),
                { 'is-selected': isSelected(option.value), 'is-active': idx === activeIndex, 'is-disabled': option.disabled }
              ]"
              @click="selectOption(option)"
              @mouseenter="setActiveIndex(idx)"
            >
              <span :class="bem('option-content')">{{ option.label }}</span>
              <Transition name="gf-zoom-in">
                <span v-if="isSelected(option.value)" :class="bem('option-state')">
                  <CheckOutlined />
                </span>
              </Transition>
            </div>
            <div v-if="filteredOptions.length === 0" :class="bem('empty')">
              <span>{{ emptyText }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { CheckOutlined, CloseOutlined, CloseCircleFilled, DownOutlined } from '@ant-design/icons-vue';
  import { createNamespace, debounceCancellable } from '../../utils';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';
  import { GF_PORTAL_CONTEXT_KEY } from '../../context/portal';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfSelect' });

  interface Option {
    label: string;
    value: any;
    disabled?: boolean;
  }

  const props = withDefaults(
    defineProps<{
      /** 受控值，单选为任意类型，多选为数组 */
      value?: any;
      /** 选项列表 */
      options?: Option[];
      /** 是否加载中（用于异步 options） */
      loading?: boolean;
      /** 空状态文案（当 filteredOptions 为空时展示） */
      notFoundContent?: string;
      /** 占位提示 */
      placeholder?: string;
      /** 禁用状态 */
      disabled?: boolean;
      /** 是否允许清空 */
      allowClear?: boolean;
      /** 多选模式 */
      mode?: 'multiple' | 'tags';
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
      /** 开启搜索过滤 */
      showSearch?: boolean;
      /** 搜索过滤策略（默认 label includes） */
      filterOption?: boolean | ((input: string, option: Option) => boolean);
      /**
       * 多选时最多展示多少个 tag：
       * - number：固定显示前 N 个
       * - 'responsive'：根据容器宽度自动计算可显示的数量
       */
      maxTagCount?: number | 'responsive';
      /**
       * 多选 tag 文案最大长度（超过后截断并加 …）
       */
      maxTagTextLength?: number;
      /**
       * 组件宽度：
       * - 不传：默认跟随父容器（在 flex 场景下可占据剩余空间）
       * - 传入 number：按 px
       * - 传入 string：例如 '240px' / '50%' / 'auto'
       */
      width?: number | string;
      /**
       * 下拉弹窗的最大高度（options 区域），超出后滚动。
       * - number: px
       * - string: 例如 '240px'
       */
      dropdownMaxHeight?: number | string;
      /**
       * 展示样式：
       * - default: 带边框的标准表单控件
       * - text: 纯文本触发器（无边框），用于 toolbar / inline 场景
       */
      variant?: 'default' | 'text';
    }>(),
    {
      options: () => [],
      loading: false,
      notFoundContent: undefined,
      placeholder: '请选择',
      disabled: false,
      allowClear: false,
      mode: undefined,
      size: 'middle',
      showSearch: false,
      filterOption: true,
      maxTagCount: undefined,
      maxTagTextLength: undefined,
      width: undefined,
      dropdownMaxHeight: 256,
      variant: 'default',
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: any): void;
    (e: 'change', value: any): void;
    (e: 'dropdown-visible-change', visible: boolean): void;
    (e: 'search', value: string): void;
  }>();

  const [_, bem] = createNamespace('select');
  const themeContext = inject(GF_THEME_CONTEXT_KEY, null);
  const themeClass = computed(() => themeContext?.themeClass.value);
  const colorScheme = computed(() => themeContext?.colorScheme.value);
  const portalContext = inject(GF_PORTAL_CONTEXT_KEY, null);
  const portalTarget = computed(() => portalContext?.target.value ?? 'body');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);

  const rootRef = ref<HTMLElement>();
  const controlRef = ref<HTMLElement>();
  const dropdownRef = ref<HTMLElement>();
  const searchInputRef = ref<HTMLInputElement>();
  const dropdownSearchRef = ref<HTMLInputElement>();
  const searchMirrorRef = ref<HTMLElement>();
  const open = ref(false);
  const search = ref('');
  const activeIndex = ref(0);
  const responsiveTagCount = ref<number>(Number.POSITIVE_INFINITY);
  const isFocused = ref(false);
  let openedByFocusIn = false;
  let pointerDownInside = false;
  const clearPointerDownInside = debounceCancellable(() => {
    pointerDownInside = false;
  }, 0);

  const isMultiple = computed(() => props.mode === 'multiple' || props.mode === 'tags');
  const isTags = computed(() => props.mode === 'tags');
  const showClear = computed(() => props.allowClear && hasValue.value && !props.disabled);

  const searchInputStyle = computed(() => {
    if (!searchMirrorRef.value) return { width: '4px' };
    const mirrorWidth = searchMirrorRef.value.offsetWidth;
    return { width: `${Math.max(4, mirrorWidth)}px` };
  });

  const rootStyle = computed<Record<string, string> | undefined>(() => {
    if (props.width === undefined || props.width === null || props.width === '') return undefined;
    const w = typeof props.width === 'number' ? `${props.width}px` : String(props.width);
    return { width: w };
  });

  const selectedOptions = computed<Option[]>(() => {
    if (isMultiple.value) {
      const values: any[] = Array.isArray(props.value) ? props.value : [];
      return values.map((val) => props.options.find((opt) => opt.value === val) ?? { label: String(val), value: val });
    }
    const found = props.options.find((opt) => opt.value === props.value);
    return found ? [found] : [];
  });

  const formatTagLabel = (label: string) => {
    const maxLen = props.maxTagTextLength;
    const raw = String(label ?? '');
    if (!maxLen || maxLen <= 0) return raw;
    if (raw.length <= maxLen) return raw;
    return `${raw.slice(0, maxLen)}…`;
  };

  const visibleTagCount = computed(() => {
    if (!isMultiple.value) return Number.POSITIVE_INFINITY;
    if (props.maxTagCount === 'responsive') return responsiveTagCount.value;
    if (typeof props.maxTagCount === 'number') return Math.max(0, props.maxTagCount);
    return Number.POSITIVE_INFINITY;
  });

  const collapsedTagCount = computed(() => {
    if (!isMultiple.value) return 0;
    const total = selectedOptions.value.length;
    const visible = Number.isFinite(visibleTagCount.value) ? visibleTagCount.value : total;
    return Math.max(0, total - visible);
  });

  const hasValue = computed(() =>
    isMultiple.value ? (props.value as any[])?.length > 0 : props.value !== undefined && props.value !== null && props.value !== ''
  );

  const filterFn = computed(() => {
    if (!props.filterOption || typeof props.filterOption === 'boolean') {
      return (input: string, opt: Option) => String(opt.label).toLowerCase().includes(input.toLowerCase());
    }
    return props.filterOption;
  });

  const filteredOptions = computed(() => {
    if (!props.showSearch || !search.value) return props.options;
    if (props.filterOption === false) return props.options;
    return props.options.filter((opt) => filterFn.value(search.value, opt));
  });

  const optionsStyle = computed<Record<string, string> | undefined>(() => {
    const h = props.dropdownMaxHeight;
    if (h === undefined || h === null || h === '') return undefined;
    const v = typeof h === 'number' ? `${h}px` : String(h);
    return { maxHeight: v };
  });

  const emptyText = computed(() => {
    if (typeof props.notFoundContent === 'string' && props.notFoundContent.length > 0) return props.notFoundContent;
    if (props.loading) return '加载中...';
    return '暂无数据';
  });

  const setActiveIndex = (idx: number) => {
    activeIndex.value = idx;
  };

  const focusSearch = async () => {
    await nextTick();
    if (isMultiple.value) {
      searchInputRef.value?.focus?.();
    } else {
      dropdownSearchRef.value?.focus?.();
    }
  };

  const findFirstEnabledIndex = () => {
    const opts = filteredOptions.value;
    return Math.max(
      0,
      opts.findIndex((o) => !o.disabled)
    );
  };

  const openDropdown = async (source: 'click' | 'focusin-pointer' | 'focusin' = 'click') => {
    if (props.disabled) return;
    if (open.value) return;
    openedByFocusIn = source === 'focusin-pointer';
    open.value = true;
    search.value = '';
    activeIndex.value = findFirstEnabledIndex();
    syncDropdownPosition();
    if (props.showSearch) await focusSearch();
  };

  const handlePointerDownInside = () => {
    if (props.disabled) return;
    pointerDownInside = true;
    clearPointerDownInside.cancel();
    clearPointerDownInside();
  };

  const handleFocusIn = (evt: FocusEvent) => {
    if (props.disabled) return;
    isFocused.value = true;
    const target = evt.target as HTMLElement | null;
    if (target?.closest?.('.gf-select__clear')) return;
    if (target?.closest?.('.gf-select__item-remove')) return;
    void openDropdown(pointerDownInside ? 'focusin-pointer' : 'focusin');
  };

  const handleFocusOut = (evt: FocusEvent) => {
    const relatedTarget = evt.relatedTarget as HTMLElement | null;
    // Check if focus is moving to dropdown or staying within component
    if (rootRef.value?.contains(relatedTarget) || dropdownRef.value?.contains(relatedTarget)) {
      return;
    }
    isFocused.value = false;
  };

  const handleTriggerClick = () => {
    if (props.disabled) return;
    if (open.value) {
      if (openedByFocusIn) {
        openedByFocusIn = false;
        return;
      }
      close();
      return;
    }
    void openDropdown('click');
  };

  const close = () => {
    if (!open.value) return;
    open.value = false;
    openedByFocusIn = false;
    search.value = '';
    // Treat "dropdown closed" as finishing interaction (AntD-ish blur validation).
    formItem?.onFieldBlur();
  };

  watch(open, (v) => emit('dropdown-visible-change', v));
  watch(search, (v) => emit('search', v));

  const handleSearchClick = () => {
    if (props.disabled) return;
    if (open.value) {
      if (openedByFocusIn) {
        openedByFocusIn = false;
        return;
      }
      close();
      return;
    }
    void openDropdown('click');
  };

  const handleKeydown = (evt: KeyboardEvent) => {
    if (props.disabled) return;
    if (!open.value && (evt.key === 'ArrowDown' || evt.key === 'Enter' || evt.key === ' ')) {
      evt.preventDefault();
      openDropdown();
      return;
    }

    if (!open.value) return;

    if (evt.key === 'Escape') {
      close();
      return;
    }

    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      evt.preventDefault();
      const dir = evt.key === 'ArrowDown' ? 1 : -1;
      const opts = filteredOptions.value;
      if (!opts.length) return;
      let idx = activeIndex.value;
      for (let i = 0; i < opts.length; i++) {
        idx = idx + dir;
        if (idx < 0) idx = opts.length - 1;
        if (idx >= opts.length) idx = 0;
        if (!opts[idx]?.disabled) break;
      }
      activeIndex.value = idx;
      return;
    }

    if (evt.key === 'Enter') {
      evt.preventDefault();
      const opt = filteredOptions.value[activeIndex.value];
      if (opt) selectOption(opt);
    }
  };

  const updateValue = (val: any) => {
    emit('update:value', val);
    emit('change', val);
    formItem?.onFieldChange();
  };

  const isSelected = (val: any) => {
    if (isMultiple.value) {
      return Array.isArray(props.value) && props.value.includes(val);
    }
    return props.value === val;
  };

  const selectOption = (option: Option) => {
    if (props.loading) return;
    if (option.disabled) return;
    if (isMultiple.value) {
      const current = Array.isArray(props.value) ? [...props.value] : [];
      const idx = current.findIndex((val) => val === option.value);
      if (idx > -1) {
        current.splice(idx, 1);
      } else {
        current.push(option.value);
      }
      updateValue(current);
      if (props.showSearch) {
        search.value = '';
        void focusSearch();
      }
    } else {
      updateValue(option.value);
      close();
    }
  };

  const clearValue = () => {
    updateValue(isMultiple.value ? [] : undefined);
    search.value = '';
    close();
  };

  const removeValue = (val: any) => {
    if (!isMultiple.value) return;
    const current = Array.isArray(props.value) ? [...props.value] : [];
    updateValue(current.filter((v) => v !== val));
  };

  const handleSearchKeydown = (evt: KeyboardEvent) => {
    if (evt.key === 'Escape') {
      close();
      return;
    }

    if (evt.key === 'Backspace' && isMultiple.value && !search.value) {
      const values: any[] = Array.isArray(props.value) ? props.value : [];
      const last = values[values.length - 1];
      if (last !== undefined) removeValue(last);
      return;
    }

    if (evt.key === 'Enter' && isTags.value && search.value.trim()) {
      const raw = search.value.trim();
      const values: any[] = Array.isArray(props.value) ? props.value : [];
      if (!values.includes(raw)) updateValue([...values, raw]);
      search.value = '';
    }

    // Pass arrow keys to main keydown handler
    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp' || evt.key === 'Enter') {
      handleKeydown(evt);
    }
  };

  const dropdownStyle = ref<Record<string, string>>({});

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  let rafId: number | null = null;
  let tagRafId: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const tagWidthCache = new Map<string, number>();

  const estimateTagWidth = (tagEl: HTMLElement) => {
    const text = (tagEl.textContent ?? '').trim();
    const perChar = 7;
    const base = 34;
    const estimated = text.length * perChar + base;
    return clamp(estimated, 36, 260);
  };

  const scheduleSyncDropdownPosition = () => {
    if (!open.value) return;
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      syncDropdownPosition();
    });
  };

  const scheduleSyncTagCount = () => {
    if (!isMultiple.value) return;
    if (props.maxTagCount !== 'responsive') return;
    if (tagRafId != null) return;
    tagRafId = requestAnimationFrame(() => {
      tagRafId = null;
      syncResponsiveTagCount();
    });
  };

  const syncResponsiveTagCount = async () => {
    if (!isMultiple.value) return;
    if (props.maxTagCount !== 'responsive') return;
    const control = controlRef.value;
    if (!control) return;

    await nextTick();

    const tagsWrap = control.querySelector(`.${bem('selection')}`) as HTMLElement | null;
    if (!tagsWrap) return;

    const allTags = Array.from(tagsWrap.querySelectorAll(`.${bem('item')}`)).filter(
      (el) => !(el as HTMLElement).classList.contains(bem('item-rest'))
    ) as HTMLElement[];
    const total = allTags.length;
    if (!total) {
      responsiveTagCount.value = Number.POSITIVE_INFINITY;
      return;
    }

    const wrapWidth = tagsWrap.clientWidth;
    const suffixWidth = 0;
    const inputReserve = props.showSearch ? 50 : 0;
    const paddingReserve = 12;
    const summaryReserve = 44;

    const available = Math.max(0, wrapWidth - suffixWidth - inputReserve - paddingReserve);

    let used = 0;
    let fit = 0;
    for (let i = 0; i < allTags.length; i++) {
      const el = allTags[i];
      if (!el) break;
      const key = el?.dataset?.gfValue;
      const measured = el?.offsetWidth ?? 0;
      const w = measured > 0 ? measured : ((key ? tagWidthCache.get(key) : undefined) ?? estimateTagWidth(el));
      if (measured > 0 && key) tagWidthCache.set(key, measured);
      if (used + w <= available) {
        used += w;
        fit++;
      } else {
        break;
      }
    }

    if (fit >= total) {
      responsiveTagCount.value = total;
      return;
    }

    used = 0;
    fit = 0;
    const availableWithSummary = Math.max(0, available - summaryReserve);
    for (let i = 0; i < allTags.length; i++) {
      const el = allTags[i];
      if (!el) break;
      const key = el?.dataset?.gfValue;
      const measured = el?.offsetWidth ?? 0;
      const w = measured > 0 ? measured : ((key ? tagWidthCache.get(key) : undefined) ?? estimateTagWidth(el));
      if (measured > 0 && key) tagWidthCache.set(key, measured);
      if (used + w <= availableWithSummary) {
        used += w;
        fit++;
      } else {
        break;
      }
    }
    responsiveTagCount.value = Math.max(0, fit);
  };

  const syncDropdownPosition = async () => {
    const trigger = controlRef.value ?? rootRef.value;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    await nextTick();
    const menu = dropdownRef.value;
    const menuWidth = menu?.offsetWidth || rect.width;
    const menuHeight = menu?.offsetHeight || 0;
    const padding = 4;
    let left = rect.left;
    let top = rect.bottom + 4;

    left = clamp(left, padding, window.innerWidth - menuWidth - padding);
    if (top + menuHeight > window.innerHeight - padding) {
      top = rect.top - menuHeight - 4;
      if (top < padding) top = padding;
    }

    dropdownStyle.value = {
      minWidth: `${rect.width}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  const handleClickOutside = (evt: MouseEvent) => {
    if (!rootRef.value) return;
    if (rootRef.value.contains(evt.target as Node)) return;
    if (dropdownRef.value?.contains(evt.target as Node)) return;
    close();
  };

  onMounted(() => {
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', syncDropdownPosition);

    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        scheduleSyncDropdownPosition();
        scheduleSyncTagCount();
      });
      if (controlRef.value) resizeObserver.observe(controlRef.value);
    }
    scheduleSyncTagCount();
  });

  onBeforeUnmount(() => {
    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', syncDropdownPosition);
    window.removeEventListener('scroll', scheduleSyncDropdownPosition, true);
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    if (rafId != null) cancelAnimationFrame(rafId);
    if (tagRafId != null) cancelAnimationFrame(tagRafId);
    clearPointerDownInside.cancel();
  });

  watch(
    () => open.value,
    (val) => {
      if (val) {
        syncDropdownPosition();
        window.addEventListener('scroll', scheduleSyncDropdownPosition, true);
      } else {
        window.removeEventListener('scroll', scheduleSyncDropdownPosition, true);
      }
    }
  );

  watch(
    () => filteredOptions.value,
    (opts) => {
      if (!open.value) return;
      if (!opts.length) {
        activeIndex.value = 0;
        return;
      }
      if (activeIndex.value >= opts.length || opts[activeIndex.value]?.disabled) {
        activeIndex.value = findFirstEnabledIndex();
      }
    }
  );

  watch(
    () => props.value,
    async () => {
      if (!open.value) return;
      await nextTick();
      scheduleSyncDropdownPosition();
    },
    { deep: true }
  );

  watch(
    () => selectedOptions.value.map((v) => v.value).join('|'),
    async () => {
      await nextTick();
      scheduleSyncTagCount();
    }
  );
</script>

<style scoped lang="less">
  .gf-select {
    position: relative;
    width: 100%;
    font-size: var(--gf-font-size-sm);
    min-width: 0;
    flex: 1 1 auto;

    &__selector {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      min-height: var(--gf-control-height-md);
      padding: 0 11px;
      padding-right: 30px;
      border-radius: var(--gf-radius-sm);
      border: 1px solid var(--gf-control-border-color, var(--gf-border));
      background: var(--gf-control-bg, var(--gf-color-surface));
      cursor: pointer;
      transition:
        border-color var(--gf-motion-fast) var(--gf-easing),
        box-shadow var(--gf-motion-fast) var(--gf-easing),
        background var(--gf-motion-fast) var(--gf-easing);

      &:hover:not(.is-disabled) {
        border-color: var(--gf-color-primary);
      }

      &.is-disabled {
        background: var(--gf-color-fill);
        cursor: not-allowed;
      }
    }

    &.is-focused:not(.is-disabled) &__selector,
    &.is-open:not(.is-disabled) &__selector {
      border-color: var(--gf-color-primary);
      box-shadow: 0 0 0 2px var(--gf-color-primary-soft);
    }

    &__selector--text {
      border: none;
      background: transparent;
      padding: 0;
      min-height: auto;
      box-shadow: none !important;
    }

    // Multi-select with tags
    &.is-multiple &__selector {
      padding: 1px 30px 1px 4px;
      flex-wrap: wrap;
      gap: 2px;
      min-height: var(--gf-control-height-md);
    }

    &__selection {
      display: flex;
      flex-wrap: wrap;
      flex: 1;
      min-width: 0;
      align-items: center;
      gap: 2px;
      position: relative;
      overflow: hidden;
    }

    &__selection-item {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--gf-text);
      line-height: 1.5714285714285714;
    }

    &__placeholder {
      color: var(--gf-color-text-tertiary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    // Tag item (multi-select)
    &__item {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 4px 0 8px;
      margin: 2px 0;
      max-width: 100%;
      background: var(--gf-color-fill-secondary);
      border-radius: var(--gf-radius-xs);
      font-size: var(--gf-font-size-sm);
      line-height: 20px;
      transition: background var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        background: var(--gf-color-fill-tertiary);
      }
    }

    &__item-content {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 2px;
    }

    &__item-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      margin-left: 2px;
      font-size: 10px;
      color: var(--gf-color-text-tertiary);
      cursor: pointer;
      border-radius: 50%;
      transition:
        color var(--gf-motion-fast) var(--gf-easing),
        background var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        color: var(--gf-color-text);
        background: var(--gf-color-fill-tertiary);
      }
    }

    &__item-rest {
      padding: 0 8px;
      background: var(--gf-color-fill);
    }

    &__search-mirror {
      position: absolute;
      left: 0;
      top: 0;
      visibility: hidden;
      white-space: pre;
      pointer-events: none;
    }

    &__search {
      flex: 1;
      min-width: 4px;
      max-width: 100%;
      margin: 2px 0;
      padding: 0;
      border: none;
      outline: none;
      background: transparent;
      font-size: inherit;
      line-height: 20px;
      color: var(--gf-text);

      &::placeholder {
        color: var(--gf-color-text-tertiary);
      }
    }

    // Arrow & Clear
    &__arrow {
      position: absolute;
      right: 11px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gf-color-text-tertiary);
      font-size: 12px;
      pointer-events: none;
    }

    &__arrow-icon {
      display: flex;
      transition: transform var(--gf-motion-fast) var(--gf-easing);

      &.is-open {
        transform: rotate(180deg);
      }
    }

    &__clear {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gf-color-text-tertiary);
      cursor: pointer;
      pointer-events: auto;
      transition: color var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        color: var(--gf-color-text-secondary);
      }
    }

    &.is-clearable:not(.is-disabled):hover &__arrow-icon {
      opacity: 0;
    }

    &.is-clearable:not(.is-disabled) &__clear {
      opacity: 0;
    }

    &.is-clearable:not(.is-disabled):hover &__clear {
      opacity: 1;
    }

    // Dropdown
    &__dropdown {
      position: fixed;
      z-index: var(--gf-z-popover);
      background: var(--gf-color-surface);
      border-radius: var(--gf-radius-md);
      box-shadow: var(--gf-shadow-2);
      overflow: hidden;
    }

    &__dropdown-search {
      padding: 8px 12px 4px;
    }

    &__dropdown-search-input {
      width: 100%;
      padding: 4px 11px;
      border: 1px solid var(--gf-border);
      border-radius: var(--gf-radius-sm);
      background: var(--gf-color-surface);
      color: var(--gf-text);
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      outline: none;
      transition:
        border-color var(--gf-motion-fast) var(--gf-easing),
        box-shadow var(--gf-motion-fast) var(--gf-easing);

      &:focus {
        border-color: var(--gf-color-primary);
        box-shadow: 0 0 0 2px var(--gf-color-primary-soft);
      }

      &::placeholder {
        color: var(--gf-color-text-tertiary);
      }
    }

    &__dropdown-content {
      padding: 4px;
      overflow: auto;
    }

    &__option {
      display: flex;
      align-items: center;
      min-height: 32px;
      padding: 5px 12px;
      border-radius: var(--gf-radius-sm);
      cursor: pointer;
      color: var(--gf-text);
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      transition: background var(--gf-motion-fast) var(--gf-easing);

      &:hover,
      &.is-active {
        background: var(--gf-color-fill);
      }

      &.is-selected {
        color: var(--gf-text);
        font-weight: 600;
        background: var(--gf-color-primary-soft);
      }

      &.is-disabled {
        color: var(--gf-color-text-disabled);
        cursor: not-allowed;

        &:hover {
          background: transparent;
        }
      }
    }

    &__option-content {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__option-state {
      margin-left: 8px;
      color: var(--gf-color-primary);
      font-size: 12px;
    }

    &__empty {
      padding: 8px 12px;
      text-align: center;
      color: var(--gf-color-text-tertiary);
      font-size: var(--gf-font-size-sm);
    }

    // Size variants
    &--size-small {
      .gf-select__selector {
        min-height: var(--gf-control-height-sm);
        padding: 0 7px;
        padding-right: 26px;
      }

      .gf-select__option {
        min-height: 24px;
        padding: 1px 8px;
        font-size: var(--gf-font-size-sm);
      }

      .gf-select__item {
        height: 18px;
        line-height: 16px;
        font-size: 11px;
      }
    }

    &--size-large {
      .gf-select__selector {
        min-height: var(--gf-control-height-lg);
        padding: 0 11px;
        padding-right: 34px;
        font-size: var(--gf-font-size-md);
      }

      .gf-select__option {
        min-height: 40px;
        font-size: var(--gf-font-size-md);
      }

      .gf-select__item {
        height: 26px;
        line-height: 24px;
      }
    }

    &.is-disabled {
      .gf-select__placeholder {
        color: var(--gf-color-text-disabled);
      }
    }
  }

  // Transition animations
  .gf-slide-up-enter-active,
  .gf-slide-up-leave-active {
    transition:
      opacity var(--gf-motion-fast) var(--gf-easing),
      transform var(--gf-motion-fast) var(--gf-easing);
  }

  .gf-slide-up-enter-from,
  .gf-slide-up-leave-to {
    opacity: 0;
    transform: translateY(-4px) scaleY(0.98);
  }

  .gf-zoom-in-enter-active,
  .gf-zoom-in-leave-active {
    transition:
      opacity var(--gf-motion-fast) var(--gf-easing),
      transform var(--gf-motion-fast) var(--gf-easing);
  }

  .gf-zoom-in-enter-from,
  .gf-zoom-in-leave-to {
    opacity: 0;
    transform: scale(0.8);
  }
</style>
