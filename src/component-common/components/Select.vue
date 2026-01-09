<template>
  <div
    ref="triggerRef"
    :class="[
      bem(),
      'cc-select',
      'ant-select',
      size === 'small' ? 'ant-select-sm' : '',
      { 'ant-select-open': open, 'ant-select-disabled': disabled },
    ]"
    @click="toggleOpen"
  >
    <div class="cc-select-trigger ant-select-selector">
      <div v-if="isMultiple" class="cc-select__tags">
        <span v-for="item in multipleItems" :key="item.value" class="cc-tag ant-tag">
          {{ item.label }}
          <span class="cc-select__remove" @click.stop="remove(item.value)">×</span>
        </span>
      </div>
      <span v-else class="cc-select__value">
        {{ singleLabel || placeholder }}
      </span>
      <input
        v-if="showSearch"
        v-model="searchValue"
        :class="bem('search')"
        class="cc-input"
        :placeholder="open ? '' : undefined"
        @click.stop
        @input.stop
      />
      <span class="cc-select__suffix">
        <slot name="suffixIcon">⌄</slot>
      </span>
      <span v-if="allowClear && hasValue" class="cc-select__clear" @click.stop="clearValue">×</span>
    </div>
    <teleport to="body">
      <transition name="cc-tooltip-fade">
        <div v-if="open" :class="['cc-select__dropdown', 'ant-select-dropdown']" :style="dropdownStyle">
          <ul class="cc-select__options">
            <li
              v-for="option in filteredOptions"
              :key="option.value"
              :class="['cc-select__option', 'ant-select-item', { 'is-active': isSelected(option.value) }]"
              @click.stop="selectOption(option.value)"
            >
              {{ option.label }}
            </li>
            <li v-if="!filteredOptions.length" class="cc-select__empty">暂无选项</li>
          </ul>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { createNamespace } from '@/utils';

  interface SelectOption {
    label: string;
    value: string | number;
  }

  const props = withDefaults(
    defineProps<{
      value?: string | number | Array<string | number>;
      options?: SelectOption[];
      mode?: 'multiple';
      placeholder?: string;
      allowClear?: boolean;
      size?: 'small' | 'middle' | 'large';
      disabled?: boolean;
      showSearch?: boolean;
    }>(),
    {
      value: undefined,
      options: () => [],
      mode: undefined,
      placeholder: '请选择',
      allowClear: false,
      size: 'middle',
      disabled: false,
      showSearch: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', val: any): void;
    (e: 'change', val: any): void;
  }>();

  const [_, bem] = createNamespace('select');
  const open = ref(false);
  const triggerRef = ref<HTMLElement>();
  const dropdownStyle = ref<Record<string, string>>({});
  const searchValue = ref('');

  const isMultiple = computed(() => props.mode === 'multiple');

  const hasValue = computed(() => {
    if (isMultiple.value) {
      return Array.isArray(props.value) && props.value.length > 0;
    }
    return props.value !== undefined && props.value !== null && props.value !== '';
  });

  const optionMap = computed(() => {
    const map = new Map<string | number, string>();
    props.options.forEach((opt) => map.set(opt.value, opt.label));
    return map;
  });

  const singleLabel = computed(() => (props.value !== undefined ? optionMap.value.get(props.value as any) : ''));

  const multipleItems = computed(() => {
    if (!Array.isArray(props.value)) return [];
    return props.value.map((val) => ({ value: val, label: optionMap.value.get(val) || String(val) }));
  });

  const filteredOptions = computed(() => {
    if (!searchValue.value) return props.options;
    const lower = searchValue.value.toLowerCase();
    return props.options.filter((opt) => opt.label.toLowerCase().includes(lower));
  });

  const setDropdownPosition = () => {
    nextTick(() => {
      const trigger = triggerRef.value;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      dropdownStyle.value = {
        position: 'absolute',
        top: `${rect.bottom + window.scrollY + 4}px`,
        left: `${rect.left + window.scrollX}px`,
        minWidth: `${rect.width}px`,
        zIndex: '2500',
      };
    });
  };

  const toggleOpen = () => {
    if (props.disabled) return;
    open.value = !open.value;
    if (open.value) {
      searchValue.value = '';
      setDropdownPosition();
    }
  };

  const selectOption = (val: string | number) => {
    if (isMultiple.value) {
      const current = Array.isArray(props.value) ? [...props.value] : [];
      const exists = current.includes(val);
      const next = exists ? current.filter((v) => v !== val) : [...current, val];
      emit('update:value', next);
      emit('change', next);
    } else {
      emit('update:value', val);
      emit('change', val);
      open.value = false;
    }
  };

  const isSelected = (val: string | number) => {
    return isMultiple.value ? Array.isArray(props.value) && props.value.includes(val) : props.value === val;
  };

  const remove = (val: string | number) => {
    if (!isMultiple.value) return;
    const current = Array.isArray(props.value) ? props.value : [];
    const next = current.filter((item) => item !== val);
    emit('update:value', next);
    emit('change', next);
  };

  const clearValue = () => {
    emit('update:value', isMultiple.value ? [] : undefined);
    emit('change', isMultiple.value ? [] : undefined);
  };

  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as Node;
    if (triggerRef.value?.contains(target)) return;
    open.value = false;
  };

  watch(
    () => props.value,
    () => {
      if (!isMultiple.value) {
        searchValue.value = '';
      }
    }
  );

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick);
  });
</script>

<style scoped lang="less">
  .dp-select {
    position: relative;
    min-width: 120px;

    &__value {
      color: var(--cc-text);
    }

    &__tags {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-height: 26px;
    }

    &__remove {
      margin-left: 6px;
      cursor: pointer;
    }

    &__suffix {
      margin-left: auto;
      color: var(--cc-text-secondary);
      font-size: 10px;
    }

    &__clear {
      margin-left: 6px;
      color: var(--cc-text-secondary);
      cursor: pointer;
    }

    &__dropdown {
      background: var(--cc-surface);
      border: 1px solid var(--cc-border);
      border-radius: var(--cc-radius-sm);
      box-shadow: var(--cc-shadow);
      margin-top: 2px;
    }

    &__options {
      list-style: none;
      margin: 0;
      padding: 6px 0;
      max-height: 280px;
      overflow: auto;
    }

    &__option {
      padding: 8px 12px;
      cursor: pointer;

      &.is-active {
        background: var(--cc-primary-weak);
        color: var(--cc-primary-strong);
      }

      &:hover {
        background: rgba(232, 243, 255, 0.7);
      }
    }

    &__empty {
      padding: 8px 12px;
      color: var(--cc-text-secondary);
    }

    &__search {
      border: none;
      outline: none;
      flex: 1;
      min-width: 40px;
    }
  }
</style>
