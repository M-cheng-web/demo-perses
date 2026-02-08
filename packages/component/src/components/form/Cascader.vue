<!-- 组件说明：级联选择器（多级面板），用于逐级选择路径 (AntD-inspired) -->
<template>
  <div :class="[bem(), bem({ [`size-${resolvedSize}`]: true }), { 'is-open': open, 'is-disabled': disabled }]" ref="rootRef">
    <div v-if="$slots.default" ref="triggerRef" :class="bem('trigger')" tabindex="0" @click="toggle" @keydown="handleKeydown">
      <slot></slot>
    </div>

    <div
      v-else
      ref="triggerRef"
      :class="[bem('control'), 'gf-control', controlSizeClass, { 'gf-control--disabled': disabled, 'is-focus': open }]"
      tabindex="0"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <span v-if="selectedLabel" :class="bem('value')">{{ selectedLabel }}</span>
      <span v-else :class="bem('placeholder')">{{ placeholder }}</span>
      <span :class="[bem('arrow'), { 'is-open': open }]">
        <DownOutlined />
      </span>
    </div>

    <Teleport :to="portalTarget">
      <Transition name="gf-slide-up">
        <div
          v-if="open"
          :class="[bem('dropdown'), bem({ [`size-${resolvedSize}`]: true }), themeClass]"
          :data-gf-theme="colorScheme"
          :style="dropdownStyle"
          ref="dropdownRef"
        >
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
                    'is-disabled': option.disabled,
                  },
                ]"
                @mouseenter="handleHover(depth, option)"
                @click="handleClick(depth, option)"
              >
                <span :class="bem('option-label')">{{ option.label }}</span>
                <span v-if="option.children?.length" :class="bem('option-arrow')" aria-hidden="true">
                  <RightOutlined />
                </span>
                <span v-else-if="isSelectedLeaf(depth, option.value)" :class="bem('option-check')">
                  <CheckOutlined />
                </span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, ref, watch } from 'vue';
  import { RightOutlined, DownOutlined, CheckOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';
  import { GF_PORTAL_CONTEXT_KEY } from '../../context/portal';
  import { useComponentSize } from '../../context/size';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';
  import { resolveCascaderPath } from './cascader/cascaderLogic';
  import { useCascaderDropdownPositioning } from './cascader/useCascaderDropdownPositioning';

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
      /**
       * 下拉最小宽度（px）
       * - 默认：跟随级联菜单内容宽度（避免大触发器导致下拉过宽）
       * - 传入后：用于抬高最小宽度
       */
      dropdownMinWidth?: number;
      /**
       * 下拉最大宽度（px）
       * - 用于避免触发器过宽时下拉面板铺满整个屏幕
       */
      dropdownMaxWidth?: number;
      /** 禁用状态 */
      disabled?: boolean;
    }>(),
    {
      options: () => [],
      placeholder: '请选择',
      size: undefined,
      dropdownMinWidth: undefined,
      dropdownMaxWidth: 640,
      disabled: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: any[]): void;
    (e: 'change', value: any[]): void;
  }>();

  const [_, bem] = createNamespace('cascader');
  const resolvedSize = useComponentSize(computed(() => props.size));
  const themeContext = inject(GF_THEME_CONTEXT_KEY, null);
  const themeClass = computed(() => themeContext?.themeClass.value);
  const colorScheme = computed(() => themeContext?.colorScheme.value);
  const portalContext = inject(GF_PORTAL_CONTEXT_KEY, null);
  const portalTarget = computed(() => portalContext?.target.value ?? 'body');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);
  const rootRef = ref<HTMLElement>();
  const triggerRef = ref<HTMLElement>();
  const dropdownRef = ref<HTMLElement>();
  const open = ref(false);

  const controlSizeClass = computed(() => {
    if (resolvedSize.value === 'small') return 'gf-control--size-small';
    if (resolvedSize.value === 'large') return 'gf-control--size-large';
    return undefined;
  });

  const selectedPath = computed(() => resolveCascaderPath(props.options ?? [], props.value));
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
    // 打开时先仅展示首列；hover 到父级时再展开子级（更符合级联预期）
    activePath.value = [];
    primeDropdownPosition();
    open.value = true;
    await nextTick();
    syncDropdownPosition();
  };

  const close = () => {
    if (!open.value) return;
    open.value = false;
    dropdownStyle.value = {};
    // Treat "dropdown closed" as finishing interaction (AntD-ish blur validation).
    formItem?.onFieldBlur();
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

  const { dropdownStyle, primeDropdownPosition, syncDropdownPosition, scheduleSyncDropdownPosition } = useCascaderDropdownPositioning({
    openRef: open,
    rootRef,
    triggerRef,
    dropdownRef,
    close,
    getColumnCount: () => menus.value.length,
    dropdownMinWidth: () => props.dropdownMinWidth,
    dropdownMaxWidth: () => props.dropdownMaxWidth,
  });

  watch(
    () => activeValues.value.join('|'),
    async () => {
      if (!open.value) return;
      await nextTick();
      scheduleSyncDropdownPosition();
    }
  );
</script>

<style scoped lang="less">
  .gf-cascader {
    position: relative;
    width: 100%;
    display: inline-block;

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

      &.is-focus {
        border-color: var(--gf-color-primary);
        box-shadow: 0 0 0 2px var(--gf-color-primary-soft);
      }
    }

    &__placeholder {
      flex: 1;
      min-width: 0;
      color: var(--gf-color-text-tertiary);
      line-height: 1.5714285714285714;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__value {
      flex: 1;
      min-width: 0;
      color: var(--gf-color-text);
      line-height: 1.5714285714285714;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__arrow {
      flex-shrink: 0;
      color: var(--gf-color-text-tertiary);
      font-size: 12px;
      transition: transform var(--gf-motion-fast) var(--gf-easing);

      &.is-open {
        transform: rotate(180deg);
      }
    }

    &__dropdown {
      position: fixed;
      z-index: var(--gf-z-popover);
      background: var(--gf-color-surface);
      border-radius: var(--gf-radius-lg);
      box-shadow: var(--gf-shadow-2);
      overflow: hidden;
    }

    &__menus {
      display: flex;
      width: max-content;
      max-width: 100%;
      max-height: 320px;
      overflow-x: auto;
      overflow-y: hidden;
    }

    &__menu {
      flex: 0 0 168px;
      width: 168px;
      min-width: 168px;
      max-width: 168px;
      max-height: 320px;
      overflow-x: hidden;
      overflow-y: auto;
      padding: 4px;
      border-right: 1px solid var(--gf-color-border);

      &:last-child {
        border-right: none;
      }
    }

    &__option {
      padding: 5px 12px;
      border-radius: var(--gf-radius-sm);
      cursor: pointer;
      color: var(--gf-color-text);
      min-height: 32px;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      transition: background var(--gf-motion-fast) var(--gf-easing);

      &:hover:not(.is-disabled) {
        background: var(--gf-color-fill);
      }

      &.is-active {
        background: var(--gf-color-fill);
        font-weight: 500;
      }

      &.is-selected-leaf {
        background: var(--gf-color-primary-soft);
        color: var(--gf-color-primary);
        font-weight: 500;
      }

      &.is-disabled {
        color: var(--gf-color-text-tertiary);
        cursor: not-allowed;
      }
    }

    &__option-label {
      display: block;
      flex: 1;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__option-arrow {
      flex-shrink: 0;
      font-size: 10px;
      color: var(--gf-color-text-tertiary);
    }

    &__option-check {
      flex-shrink: 0;
      font-size: 12px;
      color: var(--gf-color-primary);
    }

    &__dropdown.gf-cascader--size-small .gf-cascader__option {
      min-height: 24px;
      font-size: var(--gf-font-size-xs);
      padding: 4px 8px;
    }

    &__dropdown.gf-cascader--size-large .gf-cascader__option {
      min-height: 40px;
      font-size: var(--gf-font-size-md);
      padding: 8px 12px;
    }

    &.is-disabled {
      cursor: not-allowed;

      .gf-cascader__control {
        background: var(--gf-color-fill);
        cursor: not-allowed;
      }
    }
  }

  // Animation
  .gf-slide-up-enter-active,
  .gf-slide-up-leave-active {
    transition:
      opacity var(--gf-motion-fast) var(--gf-easing),
      transform var(--gf-motion-fast) var(--gf-easing);
    transform-origin: top center;
  }

  .gf-slide-up-enter-from,
  .gf-slide-up-leave-to {
    opacity: 0;
    transform: scaleY(0.8);
  }
</style>
