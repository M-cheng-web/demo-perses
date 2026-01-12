<!-- 组件说明：级联选择器，支持搜索与路径选择 -->
<template>
  <div :class="[bem(), bem(`size-${size}`), { 'is-open': open }]" ref="rootRef">
    <div :class="bem('control')" @click="toggle">
      <span v-if="selectedLabel" :class="bem('value')">{{ selectedLabel }}</span>
      <span v-else :class="bem('placeholder')">{{ placeholder }}</span>
      <span :class="bem('arrow')">▾</span>
    </div>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="open" :class="bem('dropdown')" :style="dropdownStyle" ref="dropdownRef">
          <div v-if="showSearch" :class="bem('search-bar')"> <input v-model="search" placeholder="搜索..." /> </div>
          <div :class="bem('options')">
            <div v-for="path in filteredPaths" :key="path.labelPath" :class="bem('option')" @click="selectPath(path.valuePath)">
              {{ path.labelPath }}
            </div>
            <div v-if="filteredPaths.length === 0" :class="bem('empty')">无匹配项</div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfCascader' });

  interface CascaderOption {
    label: string;
    value: any;
    children?: CascaderOption[];
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
      /** 搜索开关或自定义过滤 */
      showSearch?: boolean | { filter: (input: string, path: CascaderOption[]) => boolean };
    }>(),
    {
      options: () => [],
      placeholder: '请选择',
      size: 'middle',
      showSearch: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: any[]): void;
    (e: 'change', value: any[]): void;
  }>();

  const [_, bem] = createNamespace('cascader');
  const rootRef = ref<HTMLElement>();
  const dropdownRef = ref<HTMLElement>();
  const open = ref(false);
  const search = ref('');
  const dropdownStyle = ref<Record<string, string>>({});

  type PathItem = { labelPath: string; valuePath: any[]; options: CascaderOption[] };

  const flattened = computed<PathItem[]>(() => {
    const list: PathItem[] = [];
    const walk = (opts: CascaderOption[], parents: CascaderOption[]) => {
      opts.forEach((opt) => {
        const current = [...parents, opt];
        if (opt.children?.length) {
          walk(opt.children, current);
        } else {
          list.push({
            labelPath: current.map((p) => p.label).join(' / '),
            valuePath: current.map((p) => p.value),
            options: current,
          });
        }
      });
    };
    walk(props.options, []);
    return list;
  });

  const selectedLabel = computed(() => {
    if (!props.value || props.value.length === 0) return '';
    const found = flattened.value.find((path) => JSON.stringify(path.valuePath) === JSON.stringify(props.value));
    return found?.labelPath ?? '';
  });

  const filterFn = computed(() => {
    if (typeof props.showSearch === 'object' && props.showSearch?.filter) {
      return props.showSearch.filter;
    }
    return (input: string, path: CascaderOption[]) => path.some((opt) => opt.label.toLowerCase().includes(input.toLowerCase()));
  });

  const filteredPaths = computed(() => {
    if (!props.showSearch || !search.value) return flattened.value;
    return flattened.value.filter((item) => filterFn.value(search.value, item.options));
  });

  const toggle = () => {
    open.value = !open.value;
    if (open.value) syncDropdownPosition();
  };

  const close = () => (open.value = false);

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

  const handleOutside = (evt: MouseEvent) => {
    if (!rootRef.value) return;
    if (rootRef.value.contains(evt.target as Node)) return;
    close();
  };

  onMounted(() => {
    window.addEventListener('click', handleOutside);
    window.addEventListener('resize', syncDropdownPosition);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('click', handleOutside);
    window.removeEventListener('resize', syncDropdownPosition);
  });

  const selectPath = (path: any[]) => {
    emit('update:value', path);
    emit('change', path);
    close();
  };
</script>

<style scoped lang="less">
  .gf-cascader {
    position: relative;
    width: 100%;

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
    }

    &__placeholder {
      color: var(--gf-text-secondary);
    }

    &__value {
      color: var(--gf-text);
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
      max-height: 260px;
      overflow: auto;
      padding: 6px;
    }

    &__option {
      padding: 8px 10px;
      border-radius: var(--gf-radius-sm);
      cursor: pointer;
      color: var(--gf-text);
      transition: all 0.2s var(--gf-easing);

      &:hover {
        background: var(--gf-primary-soft);
        color: var(--gf-primary-strong);
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
  }
</style>
