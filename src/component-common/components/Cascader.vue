<template>
  <div ref="triggerRef" :class="[bem(), 'cc-cascader']" @click="toggle">
    <slot>
      <div class="cc-input" :class="sizeClass">
        <span>{{ displayLabel || placeholder }}</span>
      </div>
    </slot>
  </div>
  <teleport to="body">
    <transition name="cc-tooltip-fade">
      <div v-if="open" :class="['cc-cascader__dropdown', 'ant-cascader-dropdown']" :style="dropdownStyle" @click.stop>
        <div v-if="hasSearch" :class="bem('search')">
          <input v-model="searchValue" class="cc-input" placeholder="搜索..." />
        </div>
        <ul class="cc-cascader__options ant-cascader-menu">
          <li
            v-for="item in filteredPaths"
            :key="item.path.join('__')"
            :class="['cc-cascader__option', 'ant-cascader-menu-item', { 'is-active': isSelected(item.path) }]"
            @click="select(item.path)"
          >
            <span>{{ item.labels.join(' / ') }}</span>
          </li>
          <li v-if="!filteredPaths.length" class="cc-cascader__empty">暂无选项</li>
        </ul>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
  import { createNamespace } from '@/utils';

  interface CascaderOption {
    value: string | number;
    label: string;
    children?: CascaderOption[];
  }

  const props = withDefaults(
    defineProps<{
      value?: Array<string | number>;
      options?: CascaderOption[];
      placeholder?: string;
      size?: 'small' | 'middle';
      showSearch?: { filter: (inputValue: string, path: CascaderOption[]) => boolean } | boolean;
    }>(),
    {
      value: undefined,
      options: () => [],
      placeholder: '请选择',
      size: 'middle',
      showSearch: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', val: Array<string | number>): void;
    (e: 'change', val: Array<string | number>): void;
  }>();

  const [_, bem] = createNamespace('cascader');
  const open = ref(false);
  const triggerRef = ref<HTMLElement>();
  const dropdownStyle = ref<Record<string, string>>({});
  const searchValue = ref('');

  const paths = computed(() => {
    const list: { path: Array<string | number>; labels: string[]; nodes: CascaderOption[] }[] = [];
    const traverse = (option: CascaderOption, parents: CascaderOption[]) => {
      if (option.children && option.children.length > 0) {
        option.children.forEach((child) => traverse(child, [...parents, option]));
      } else {
        const currentPath = [...parents, option];
        list.push({
          path: currentPath.map((o) => o.value),
          labels: currentPath.map((o) => o.label),
          nodes: currentPath,
        });
      }
    };
    props.options.forEach((opt) => traverse(opt, []));
    return list;
  });

  const hasSearch = computed(() => !!props.showSearch);

  const filteredPaths = computed(() => {
    if (!searchValue.value) return paths.value;
    if (props.showSearch && typeof props.showSearch === 'object' && props.showSearch.filter) {
      return paths.value.filter((p) => props.showSearch.filter(searchValue.value, p.nodes));
    }
    const lower = searchValue.value.toLowerCase();
    return paths.value.filter((p) => p.labels.some((label) => label.toLowerCase().includes(lower)));
  });

  const displayLabel = computed(() => {
    if (!props.value || !props.value.length) return '';
    const found = paths.value.find((item) => item.path.join('||') === props.value?.join('||'));
    return found?.labels.join(' / ') || '';
  });

  const sizeClass = computed(() => (props.size === 'small' ? 'ant-input-sm' : ''));

  const setDropdown = () => {
    nextTick(() => {
      const trigger = triggerRef.value;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      dropdownStyle.value = {
        position: 'absolute',
        top: `${rect.bottom + window.scrollY + 6}px`,
        left: `${rect.left + window.scrollX}px`,
        minWidth: `${rect.width}px`,
        zIndex: '2500',
      };
    });
  };

  const toggle = () => {
    open.value = !open.value;
    if (open.value) {
      setDropdown();
    }
  };

  const select = (path: Array<string | number>) => {
    emit('update:value', path);
    emit('change', path);
    open.value = false;
  };

  const isSelected = (path: Array<string | number>) => {
    return props.value?.join('||') === path.join('||');
  };

  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as Node;
    if (triggerRef.value?.contains(target)) return;
    open.value = false;
  };

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick);
  });
</script>

<style scoped lang="less">
  .dp-cascader {
    display: inline-flex;
  }

  .cc-cascader__dropdown {
    background: var(--cc-surface);
    border: 1px solid var(--cc-border);
    border-radius: var(--cc-radius-sm);
    box-shadow: var(--cc-shadow);
    padding: 6px 0;
  }

  .cc-cascader__options {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 300px;
    overflow: auto;
  }

  .cc-cascader__option {
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

  .cc-cascader__empty {
    padding: 8px 12px;
    color: var(--cc-text-secondary);
  }

  .dp-cascader__search {
    padding: 6px 10px;
  }
</style>
