<!-- 组件说明：级联选择器（多级面板），用于逐级选择路径 -->
<template>
  <div :class="[bem(), bem({ [`size-${size}`]: true }), { 'is-open': open, 'is-disabled': disabled }]" ref="rootRef">
    <div v-if="$slots.default" ref="triggerRef" :class="bem('trigger')" tabindex="0" @click="toggle" @keydown="handleKeydown">
      <slot></slot>
    </div>

    <div
      v-else
      ref="triggerRef"
      :class="[bem('control'), 'gf-control', controlSizeClass, { 'gf-control--disabled': disabled }]"
      tabindex="0"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <span v-if="selectedLabel" :class="bem('value')">{{ selectedLabel }}</span>
      <span v-else :class="bem('placeholder')">{{ placeholder }}</span>
      <span :class="bem('arrow')">▾</span>
    </div>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="open" :class="bem('dropdown')" :style="dropdownStyle" ref="dropdownRef">
          <div :class="bem('menus')">
            <div v-for="(menu, depth) in menus" :key="depth" :class="bem('menu')">
              <div
                v-for="option in menu"
                :key="option.value"
                :class="[
                  bem('option'),
                  {
                    'is-active': activeValues[depth] === option.value,
                    'is-selected-leaf': isSelectedLeaf(depth, option.value),
                    'has-children': !!option.children?.length,
                  },
                ]"
                @mouseenter="handleHover(depth, option)"
                @click="handleClick(depth, option)"
              >
                <span :class="bem('option-label')">{{ option.label }}</span>
                <span v-if="option.children?.length" :class="bem('option-arrow')" aria-hidden="true">
                  <RightOutlined />
                </span>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { RightOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfCascader' });

  interface CascaderOption {
    label: string;
    value: any;
    children?: CascaderOption[];
    disabled?: boolean;
  }

  const props = withDefaults(
    defineProps<{
      /** 选中的路径值数组 */
      value?: any[];
      /** 级联选项 */
      options: CascaderOption[];
      /** 占位提示 */
      placeholder?: string;
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
      /** 禁用状态 */
      disabled?: boolean;
    }>(),
    {
      options: () => [],
      placeholder: '请选择',
      size: 'middle',
      disabled: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: any[]): void;
    (e: 'change', value: any[]): void;
  }>();

  const [_, bem] = createNamespace('cascader');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);
  const rootRef = ref<HTMLElement>();
  const triggerRef = ref<HTMLElement>();
  const dropdownRef = ref<HTMLElement>();
  const open = ref(false);
  const dropdownStyle = ref<Record<string, string>>({});
  const controlSizeClass = computed(() => {
    if (props.size === 'small') return 'gf-control--size-small';
    if (props.size === 'large') return 'gf-control--size-large';
    return undefined;
  });

  const resolvePath = (values: any[] | undefined) => {
    const pathValues = Array.isArray(values) ? values : [];
    const out: CascaderOption[] = [];
    let current = props.options;
    for (const val of pathValues) {
      const found = current.find((o) => o.value === val);
      if (!found) break;
      out.push(found);
      current = found.children ?? [];
    }
    return out;
  };

  const selectedPath = computed(() => resolvePath(props.value));
  const selectedLabel = computed(() => selectedPath.value.map((o) => o.label).join(' / '));

  const activePath = ref<CascaderOption[]>([]);
  const activeValues = computed<any[]>(() => activePath.value.map((o) => o.value));

  const menus = computed<CascaderOption[][]>(() => {
    const cols: CascaderOption[][] = [];
    cols.push(props.options ?? []);
    let current = props.options ?? [];
    for (const opt of activePath.value) {
      const found = current.find((o) => o.value === opt.value);
      if (!found?.children?.length) break;
      cols.push(found.children);
      current = found.children;
    }
    return cols;
  });

  const isSelectedLeaf = (depth: number, value: any) => {
    const values = Array.isArray(props.value) ? props.value : [];
    if (depth !== values.length - 1) return false;
    return values[depth] === value;
  };

  const openDropdown = async () => {
    if (props.disabled) return;
    if (open.value) return;
    activePath.value = [...selectedPath.value];
    open.value = true;
    await nextTick();
    syncDropdownPosition();
  };

  const close = () => {
    open.value = false;
  };

  const toggle = () => {
    if (props.disabled) return;
    if (open.value) {
      close();
      return;
    }
    openDropdown();
  };

  const handleKeydown = (evt: KeyboardEvent) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      toggle();
    }
    if (evt.key === 'Escape') close();
  };

  const handleHover = (depth: number, option: CascaderOption) => {
    if (props.disabled || option.disabled) return;
    if (!option.children?.length) return;
    const next = activePath.value.slice(0, depth);
    next[depth] = option;
    activePath.value = next;
  };

  const handleClick = (depth: number, option: CascaderOption) => {
    if (props.disabled || option.disabled) return;
    const next = activePath.value.slice(0, depth);
    next[depth] = option;
    activePath.value = next;

    if (option.children?.length) return;

    const valuePath = activePath.value.map((o) => o.value);
    emit('update:value', valuePath);
    emit('change', valuePath);
    formItem?.onFieldChange();
    close();
  };

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  let rafId: number | null = null;

  const scheduleSyncDropdownPosition = () => {
    if (!open.value) return;
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      syncDropdownPosition();
    });
  };

  const syncDropdownPosition = async () => {
    const trigger = triggerRef.value;
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

  const handleOutside = (evt: MouseEvent) => {
    if (!rootRef.value) return;
    if (rootRef.value.contains(evt.target as Node)) return;
    if (dropdownRef.value?.contains(evt.target as Node)) return;
    close();
  };

  onMounted(() => {
    window.addEventListener('click', handleOutside);
    window.addEventListener('resize', syncDropdownPosition);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('click', handleOutside);
    window.removeEventListener('resize', syncDropdownPosition);
    window.removeEventListener('scroll', scheduleSyncDropdownPosition, true);
    if (rafId != null) cancelAnimationFrame(rafId);
  });

  watch(
    () => open.value,
    (val) => {
      if (val) {
        window.addEventListener('scroll', scheduleSyncDropdownPosition, true);
      } else {
        window.removeEventListener('scroll', scheduleSyncDropdownPosition, true);
      }
    }
  );
</script>

<style scoped lang="less">
  .gf-cascader {
    position: relative;
    width: 100%;

    &__trigger {
      display: inline-flex;
      width: auto;
      outline: none;
    }

    &__control {
      display: inline-flex;
      align-items: center;
      width: 100%;
      gap: 6px;
      cursor: pointer;
    }

    &__placeholder {
      color: var(--gf-text-secondary);
      line-height: 1.35;
      display: inline-flex;
      align-items: center;
    }

    &__value {
      color: var(--gf-text);
      line-height: 1.35;
      display: inline-flex;
      align-items: center;
    }

    &__arrow {
      margin-left: auto;
      color: var(--gf-text-secondary);
      font-size: 10px;
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

    &__menus {
      display: flex;
      max-height: 320px;
    }

    &__menu {
      min-width: 200px;
      max-height: 320px;
      overflow: auto;
      padding: 6px;
      border-right: 1px solid var(--gf-color-border-muted);

      &:last-child {
        border-right: none;
      }
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
        background: var(--gf-primary-soft);
        color: var(--gf-primary-strong);
      }

      &.is-active {
        background: var(--gf-color-fill);
      }

      &.is-selected-leaf {
        background: var(--gf-primary-soft);
        color: var(--gf-primary-strong);
        box-shadow: inset 0 0 0 1px var(--gf-border-strong);
      }
    }

    &__option-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__option-arrow {
      width: 16px;
      height: 16px;
      display: grid;
      place-items: center;
      font-size: 11px;
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
