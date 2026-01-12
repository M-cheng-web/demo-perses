<!-- 组件说明：下拉选择器，支持单选/多选、搜索、清空 -->
<template>
  <div :class="[bem(), bem(`size-${size}`), { 'is-open': open, 'is-disabled': disabled }]" ref="rootRef">
    <div :class="bem('control')" @click="toggle">
      <div v-if="isMultiple" :class="bem('tags')">
        <span v-for="item in selectedOptions" :key="item.value" :class="bem('tag')">
          {{ item.label }}
          <button type="button" :class="bem('tag-close')" @click.stop="removeValue(item.value)">×</button>
        </span>
        <input
          v-if="showSearch"
          v-model="search"
          :class="bem('search-input')"
          type="text"
          :placeholder="selectedOptions.length === 0 ? placeholder : ''"
          @click.stop
        />
      </div>
      <template v-else>
        <span v-if="selectedOptions[0]" :class="bem('value')">{{ selectedOptions[0].label }}</span>
        <span v-else :class="bem('placeholder')">{{ placeholder }}</span>
      </template>
      <span v-if="allowClear && hasValue" :class="bem('clear')" @click.stop="clearValue">×</span>
      <span :class="bem('arrow')">▾</span>
    </div>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="open" :class="bem('dropdown')" :style="dropdownStyle" ref="dropdownRef">
          <div v-if="showSearch && !isMultiple" :class="bem('search-bar')">
            <input v-model="search" :placeholder="'搜索...'" />
          </div>
          <div :class="bem('options')">
            <div
              v-for="option in filteredOptions"
              :key="option.value"
              :class="[bem('option'), { 'is-active': isSelected(option.value), 'is-disabled': option.disabled }]"
              @click="selectOption(option)"
            >
              <span>{{ option.label }}</span>
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
  import { createNamespace } from '../../utils';

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
      mode?: 'multiple';
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
      /** 开启搜索过滤 */
      showSearch?: boolean;
    }>(),
    {
      options: () => [],
      placeholder: '请选择',
      disabled: false,
      allowClear: false,
      mode: undefined,
      size: 'middle',
      showSearch: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: any): void;
    (e: 'change', value: any): void;
  }>();

  const [_, bem] = createNamespace('select');

  const rootRef = ref<HTMLElement>();
  const dropdownRef = ref<HTMLElement>();
  const open = ref(false);
  const search = ref('');

  const isMultiple = computed(() => props.mode === 'multiple');

  const selectedOptions = computed<Option[]>(() => {
    if (isMultiple.value) {
      const values: any[] = Array.isArray(props.value) ? props.value : [];
      return props.options.filter((opt) => values.includes(opt.value));
    }
    const found = props.options.find((opt) => opt.value === props.value);
    return found ? [found] : [];
  });

  const hasValue = computed(() =>
    isMultiple.value ? (props.value as any[])?.length > 0 : props.value !== undefined && props.value !== null && props.value !== ''
  );

  const filteredOptions = computed(() => {
    if (!props.showSearch || !search.value) return props.options;
    return props.options.filter((opt) => String(opt.label).toLowerCase().includes(search.value.toLowerCase()));
  });

  const toggle = () => {
    if (props.disabled) return;
    open.value = !open.value;
    if (open.value) {
      search.value = '';
      syncDropdownPosition();
    }
  };

  const close = () => {
    open.value = false;
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

  const dropdownStyle = ref<Record<string, string>>({});

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const syncDropdownPosition = async () => {
    if (!rootRef.value) return;
    const rect = rootRef.value.getBoundingClientRect();
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
    close();
  };

  onMounted(() => {
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', syncDropdownPosition);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', syncDropdownPosition);
  });

  watch(
    () => open.value,
    (val) => {
      if (val) {
        syncDropdownPosition();
      }
    }
  );
</script>

<style scoped lang="less">
  .gf-select {
    position: relative;
    width: 100%;
    font-size: 13px;

    &__control {
      display: inline-flex;
      align-items: center;
      width: 100%;
      min-height: var(--gf-control-height-md);
      padding: 8px 12px;
      border-radius: var(--gf-radius-sm);
      border: 1px solid var(--gf-border);
      background: var(--gf-color-surface);
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s var(--gf-easing);

      &:hover {
        border-color: var(--gf-border-strong);
        box-shadow: var(--gf-shadow-soft);
      }
    }

    &__value {
      color: var(--gf-text);
    }

    &__placeholder {
      color: var(--gf-text-secondary);
    }

    &__arrow {
      margin-left: auto;
      color: var(--gf-text-secondary);
      font-size: 10px;
    }

    &__clear {
      color: var(--gf-text-secondary);
      font-size: 12px;
      padding: 2px 4px;
      border-radius: var(--gf-radius-sm);
      transition: all 0.2s var(--gf-easing);

      &:hover {
        color: var(--gf-primary-strong);
        background: var(--gf-primary-soft);
      }
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
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: var(--gf-radius-sm);
      background: var(--gf-primary-soft);
      color: var(--gf-primary-strong);
    }

    &__tag-close {
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    &__search-input {
      flex: 1;
      border: none;
      outline: none;
      min-width: 80px;
      font-size: var(--gf-font-size-md);
      background: transparent;
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

    &__search-bar {
      padding: 8px 10px;
      border-bottom: 1px solid var(--gf-border);

      input {
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        color: var(--gf-text);
      }
    }

    &__options {
      max-height: 280px;
      overflow: auto;
      padding: 6px;
    }

    &__option {
      padding: 8px 10px;
      border-radius: var(--gf-radius-sm);
      cursor: pointer;
      color: var(--gf-text);
      transition: background var(--gf-motion-fast) var(--gf-easing), color var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        background: var(--gf-color-primary-soft);
        color: var(--gf-color-primary);
      }

      &.is-active {
        background: var(--gf-primary-soft);
        color: var(--gf-primary-strong);
        box-shadow: inset 0 0 0 1px var(--gf-border-strong);
      }

      &.is-disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    &__empty {
      padding: 12px;
      text-align: center;
      color: var(--gf-text-secondary);
    }

    &--size-small &__control {
      min-height: var(--gf-control-height-sm);
      padding: 6px 10px;
    }

    &--size-large &__control {
      min-height: var(--gf-control-height-lg);
      padding: 10px 14px;
    }

    &.is-disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
</style>
