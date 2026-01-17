<!-- 组件说明：下拉选择器，支持单选/多选、搜索、清空 -->
<template>
  <div
    :class="[
      bem(),
      bem({ [`size-${size}`]: true }),
      { 'is-open': open, 'is-disabled': disabled, 'is-clearable': showClear, 'is-multiple': isMultiple },
    ]"
    ref="rootRef"
    :style="rootStyle"
  >
    <div
      ref="controlRef"
      :class="[bem('control'), 'gf-control', controlSizeClass, { 'gf-control--disabled': disabled }]"
      tabindex="0"
      @click="handleTriggerClick"
      @pointerdown="handlePointerDownInside"
      @focusin="handleFocusIn"
      @keydown="handleKeydown"
    >
      <div v-if="isMultiple" :class="bem('tags')">
        <Tag
          v-for="(item, idx) in selectedOptions"
          :key="item.value"
          v-show="idx < visibleTagCount"
          :data-gf-value="String(item.value)"
          :class="bem('tag')"
          :size="size === 'small' ? 'small' : 'middle'"
          variant="neutral"
          radius="sm"
          closable
          @close="() => removeValue(item.value)"
        >
          {{ formatTagLabel(item.label) }}
        </Tag>
        <Tag
          v-if="collapsedTagCount > 0"
          :class="[bem('tag'), bem('tag-summary')]"
          :size="size === 'small' ? 'small' : 'middle'"
          variant="neutral"
          radius="sm"
        >
          +{{ collapsedTagCount }}
        </Tag>
        <input
          v-if="showSearch"
          ref="searchInputRef"
          v-model="search"
          :class="bem('search-input')"
          type="text"
          :placeholder="selectedOptions.length === 0 ? placeholder : ''"
          @click.stop="handleSearchClick"
          @keydown.stop="handleSearchKeydown"
        />
      </div>
      <template v-else>
        <span v-if="selectedOptions[0] && !(showSearch && open)" :class="bem('value')">{{ selectedOptions[0].label }}</span>
        <span v-else-if="!(showSearch && open)" :class="bem('placeholder')">{{ placeholder }}</span>
        <input
          v-if="showSearch"
          v-show="open"
          ref="searchInputRef"
          v-model="search"
          :class="bem('search-input')"
          type="text"
          :placeholder="selectedOptions[0] ? '搜索...' : placeholder"
          @click.stop="handleSearchClick"
          @keydown.stop="handleSearchKeydown"
        />
      </template>
      <span :class="bem('suffix')">
        <button v-if="showClear" type="button" :class="bem('clear')" tabindex="-1" aria-label="清空" @click.stop="clearValue">
          <CloseOutlined />
        </button>
        <span :class="bem('arrow')" aria-hidden="true">
          <DownOutlined />
        </span>
      </span>
    </div>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="open" :class="bem('dropdown')" :style="dropdownStyle" ref="dropdownRef">
          <div :class="bem('options')">
            <div
              v-for="(option, idx) in filteredOptions"
              :key="option.value"
              :class="[bem('option'), { 'is-selected': isSelected(option.value), 'is-active': idx === activeIndex, 'is-disabled': option.disabled }]"
              @click="selectOption(option)"
              @mouseenter="setActiveIndex(idx)"
            >
              <span :class="bem('option-label')">{{ option.label }}</span>
              <span :class="[bem('check'), { 'is-visible': isSelected(option.value) }]" aria-hidden="true">
                <CheckOutlined />
              </span>
            </div>
            <div v-if="filteredOptions.length === 0" :class="bem('empty')">无可选项</div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { CheckOutlined, CloseOutlined, DownOutlined } from '@ant-design/icons-vue';
  import { createNamespace, debounceCancellable } from '../../utils';
  import Tag from '../base/Tag.vue';
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
    }>(),
    {
      options: () => [],
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
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: any): void;
    (e: 'change', value: any): void;
  }>();

  const [_, bem] = createNamespace('select');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);

  const rootRef = ref<HTMLElement>();
  const controlRef = ref<HTMLElement>();
  const dropdownRef = ref<HTMLElement>();
  const searchInputRef = ref<HTMLInputElement>();
  const open = ref(false);
  const search = ref('');
  const activeIndex = ref(0);
  const responsiveTagCount = ref<number>(Number.POSITIVE_INFINITY);
  let openedByFocusIn = false;
  let pointerDownInside = false;
  const clearPointerDownInside = debounceCancellable(() => {
    pointerDownInside = false;
  }, 0);
  const controlSizeClass = computed(() => {
    if (props.size === 'small') return 'gf-control--size-small';
    if (props.size === 'large') return 'gf-control--size-large';
    return undefined;
  });

  const isMultiple = computed(() => props.mode === 'multiple' || props.mode === 'tags');
  const isTags = computed(() => props.mode === 'tags');
  const showClear = computed(() => props.allowClear && hasValue.value);

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

  const setActiveIndex = (idx: number) => {
    activeIndex.value = idx;
  };

  const focusSearch = async () => {
    await nextTick();
    searchInputRef.value?.focus?.();
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
    const target = evt.target as HTMLElement | null;
    if (target?.closest?.('.gf-select__clear')) return;
    if (target?.closest?.('.gf-tag__close')) return;
    void openDropdown(pointerDownInside ? 'focusin-pointer' : 'focusin');
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
    open.value = false;
    openedByFocusIn = false;
  };

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
  };

  const dropdownStyle = ref<Record<string, string>>({});

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  let rafId: number | null = null;
  let tagRafId: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const tagWidthCache = new Map<string, number>();

  const estimateTagWidth = (tagEl: HTMLElement) => {
    // 一个非常粗略的估算：用于无法测量宽度（display:none）时的兜底
    // 注意：tag 内部还包含关闭按钮，因此用 textContent 只能近似估计。
    const text = (tagEl.textContent ?? '').trim();
    const perChar = 7; // 经验值：中文/英文平均宽度
    const base = 34; // padding/border/close button 的保守预留
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

    // 这里采用一个相对保守的估算：
    // - 控制区右侧有 suffix（清空按钮 + 箭头），需要预留空间
    // - 多选 tag 容器会包含一个搜索 input（如果开启），也需要预留
    //
    // 该逻辑的目标是“足够好用”，而不是像 antd 一样做极端精确的像素级对齐。
    await nextTick();

    const tagsWrap = control.querySelector(`.${bem('tags')}`) as HTMLElement | null;
    if (!tagsWrap) return;

    const allTags = Array.from(tagsWrap.querySelectorAll(`.${bem('tag')}`)).filter(
      (el) => !(el as HTMLElement).classList.contains(bem('tag-summary'))
    ) as HTMLElement[];
    const total = allTags.length;
    if (!total) {
      responsiveTagCount.value = Number.POSITIVE_INFINITY;
      return;
    }

    const wrapWidth = tagsWrap.clientWidth;
    // 这里取的是 tags 容器自身的宽度（flex: 1 的区域），它已经不包含右侧 suffix 区域，
    // 因此不需要再额外扣除 clear/arrow 的宽度，否则会过于保守。
    const suffixWidth = 0;
    const inputReserve = props.showSearch ? 50 : 0; // 预留一点给输入框/光标
    const paddingReserve = 12; // 左右 padding/gap 的保守预留

    // “+N” 汇总 tag 的预留宽度（保守值，避免频繁抖动）
    const summaryReserve = 44;

    // 可用于 tag 的宽度
    const available = Math.max(0, wrapWidth - suffixWidth - inputReserve - paddingReserve);

    // 先假设不需要 summary，尝试放下全部
    let used = 0;
    let fit = 0;
    for (let i = 0; i < allTags.length; i++) {
      const el = allTags[i];
      if (!el) break;
      const key = el?.dataset?.gfValue;
      const measured = el?.offsetWidth ?? 0;
      const w = measured > 0 ? measured : (key ? tagWidthCache.get(key) : undefined) ?? estimateTagWidth(el);
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

    // 需要 summary 时，重新计算：预留 summaryReserve
    used = 0;
    fit = 0;
    const availableWithSummary = Math.max(0, available - summaryReserve);
    for (let i = 0; i < allTags.length; i++) {
      const el = allTags[i];
      if (!el) break;
      const key = el?.dataset?.gfValue;
      const measured = el?.offsetWidth ?? 0;
      const w = measured > 0 ? measured : (key ? tagWidthCache.get(key) : undefined) ?? estimateTagWidth(el);
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
    const padding = 8;
    let left = rect.left;
    let top = rect.bottom + 6;

    left = clamp(left, padding, window.innerWidth - menuWidth - padding);
    if (top + menuHeight > window.innerHeight - padding) {
      top = rect.top - menuHeight - 6;
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

    &__control {
      display: inline-flex;
      align-items: center;
      width: 100%;
      gap: 6px;
      cursor: pointer;
    }

    /*
     * 说明：保持单选/多选在“已选择”状态下的控件高度一致
     * - 多选的 tag 容器通常会比纯文本更高
     * - 因此这里会稍微减小 vertical padding，让整体落在统一的 control height token 内
     */
    &.is-multiple &__control.gf-control {
      padding-top: 2px;
      padding-bottom: 2px;
    }

    &.is-multiple&--size-small &__control.gf-control {
      padding-top: 2px;
      padding-bottom: 2px;
    }

    &.is-multiple&--size-large &__control.gf-control {
      padding-top: 4px;
      padding-bottom: 4px;
    }

    &__value {
      color: var(--gf-text);
      line-height: 1.35;
      display: inline-flex;
      align-items: center;
    }

    &__placeholder {
      color: var(--gf-text-secondary);
      line-height: 1.35;
      display: inline-flex;
      align-items: center;
    }

    &__arrow {
      color: var(--gf-text-secondary);
      display: grid;
      place-items: center;
    }

    &__clear {
      border: none;
      background: transparent;
      color: var(--gf-text-secondary);
      width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.2s var(--gf-easing);
    }

    &__suffix {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      position: relative;
      flex: 0 0 18px;
      font-size: 12px;
    }

    &__arrow {
      position: absolute;
      inset: 0;
      opacity: 1;
      transition: opacity var(--gf-motion-fast) var(--gf-easing);
      pointer-events: none;
    }

    &__clear {
      position: absolute;
      inset: 0;
      opacity: 0;
      pointer-events: none;
      transition:
        opacity var(--gf-motion-fast) var(--gf-easing),
        background var(--gf-motion-fast) var(--gf-easing),
        color var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        color: var(--gf-primary-strong);
        background: var(--gf-primary-soft);
      }
    }

    &.is-clearable:not(.is-disabled):hover &__clear {
      opacity: 1;
      pointer-events: auto;
    }

    &.is-clearable:not(.is-disabled):hover &__arrow {
      opacity: 0;
    }

    &__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      flex: 1;
      min-width: 0;
      align-items: center;
    }

    &__tag {
      max-width: 100%;
    }

    &__search-input {
      flex: 1;
      border: none;
      outline: none;
      min-width: 80px;
      font-size: var(--gf-font-size-sm);
      background: transparent;
      padding: 0;
      line-height: 1.35;
      height: 18px;
    }

    &__dropdown {
      position: fixed;
      z-index: var(--gf-z-popover);
      background: var(--gf-surface);
      border: 1px solid var(--gf-border);
      border-radius: var(--gf-radius-md);
      box-shadow: var(--gf-shadow-2);
      overflow: hidden;
    }

    &__options {
      max-height: 280px;
      overflow: auto;
      padding: 6px;
    }

    &__option {
      padding: 0 10px;
      border-radius: var(--gf-radius-sm);
      cursor: pointer;
      color: var(--gf-text);
      min-height: var(--gf-control-height-md);
      display: flex;
      align-items: center;
      gap: 8px;
      transition:
        background var(--gf-motion-fast) var(--gf-easing),
        color var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        background: var(--gf-color-primary-soft);
        color: var(--gf-color-primary);
      }

      &.is-active {
        background: var(--gf-color-fill);
      }

      &.is-selected {
        background: var(--gf-primary-soft);
        color: var(--gf-primary-strong);
        box-shadow: inset 0 0 0 1px var(--gf-border-strong);
      }

      &.is-disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    &__option-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__check {
      width: 16px;
      height: 16px;
      display: grid;
      place-items: center;
      color: var(--gf-primary-strong);
      font-size: 12px;
      opacity: 0;
      transition: opacity var(--gf-motion-fast) var(--gf-easing);

      &.is-visible {
        opacity: 1;
      }
    }

    &__empty {
      padding: 12px;
      text-align: center;
      color: var(--gf-text-secondary);
    }

    &--size-small &__option {
      min-height: var(--gf-control-height-sm);
      font-size: var(--gf-font-size-sm);
    }

    &--size-large &__option {
      min-height: var(--gf-control-height-lg);
      font-size: var(--gf-font-size-lg);
    }

    &.is-disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
</style>
