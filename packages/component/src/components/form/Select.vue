<!-- 组件说明：下拉选择器，支持单选/多选、搜索、清空 -->
<template>
  <div
    :class="[
      bem(),
      bem({ [`size-${size}`]: true }),
      { 'is-open': open, 'is-disabled': disabled, 'is-clearable': showClear, 'is-multiple': isMultiple },
    ]"
    ref="rootRef"
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
          v-for="item in selectedOptions"
          :key="item.value"
          :class="bem('tag')"
          :size="size === 'small' ? 'small' : 'middle'"
          variant="neutral"
          radius="sm"
          closable
          @close="() => removeValue(item.value)"
        >
          {{ item.label }}
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
      <span :class="bem('suffix')" aria-hidden="true">
        <button v-if="showClear" type="button" :class="bem('clear')" tabindex="-1" aria-label="清空" @click.stop="clearValue">
          <CloseOutlined />
        </button>
        <span :class="bem('arrow')">
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
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { CheckOutlined, CloseOutlined, DownOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';
  import Tag from '../base/Tag.vue';

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
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: any): void;
    (e: 'change', value: any): void;
  }>();

  const [_, bem] = createNamespace('select');

  const rootRef = ref<HTMLElement>();
  const controlRef = ref<HTMLElement>();
  const dropdownRef = ref<HTMLElement>();
  const searchInputRef = ref<HTMLInputElement>();
  const open = ref(false);
  const search = ref('');
  const activeIndex = ref(0);
  let openedByFocusIn = false;
  let pointerDownInside = false;
  let clearPointerDownTimer: number | null = null;
  const controlSizeClass = computed(() => {
    if (props.size === 'small') return 'gf-control--size-small';
    if (props.size === 'large') return 'gf-control--size-large';
    return undefined;
  });

  const isMultiple = computed(() => props.mode === 'multiple' || props.mode === 'tags');
  const isTags = computed(() => props.mode === 'tags');
  const showClear = computed(() => !isMultiple.value && props.allowClear && hasValue.value);

  const selectedOptions = computed<Option[]>(() => {
    if (isMultiple.value) {
      const values: any[] = Array.isArray(props.value) ? props.value : [];
      return values.map((val) => props.options.find((opt) => opt.value === val) ?? { label: String(val), value: val });
    }
    const found = props.options.find((opt) => opt.value === props.value);
    return found ? [found] : [];
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
    if (clearPointerDownTimer != null) window.clearTimeout(clearPointerDownTimer);
    clearPointerDownTimer = window.setTimeout(() => {
      pointerDownInside = false;
      clearPointerDownTimer = null;
    }, 0);
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
  let resizeObserver: ResizeObserver | null = null;

  const scheduleSyncDropdownPosition = () => {
    if (!open.value) return;
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      syncDropdownPosition();
    });
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
      });
      if (controlRef.value) resizeObserver.observe(controlRef.value);
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', syncDropdownPosition);
    window.removeEventListener('scroll', scheduleSyncDropdownPosition, true);
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    if (rafId != null) cancelAnimationFrame(rafId);
    if (clearPointerDownTimer != null) window.clearTimeout(clearPointerDownTimer);
    clearPointerDownTimer = null;
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
</script>

<style scoped lang="less">
  .gf-select {
    position: relative;
    width: 100%;
    font-size: var(--gf-font-size-sm);

    &__control {
      display: inline-flex;
      align-items: center;
      width: 100%;
      gap: 6px;
      cursor: pointer;
    }

    /* Keep the outer control height consistent between single/multiple when selected:
     * multiple tags are taller than plain text, so we reduce vertical padding to stay within control height tokens.
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
