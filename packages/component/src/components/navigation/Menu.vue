<!-- 组件说明：简易菜单列表，可传入 items 或自定义插槽 (AntD-inspired) -->
<template>
  <ul :class="[bem(), bem({ [`mode-${mode}`]: true })]">
    <template v-for="item in normalizedItems" :key="item.key">
      <li v-if="item.type === 'divider'" :class="bem('divider')"></li>
      <li
        v-else
        :class="[bem('item'), { 'is-disabled': item.disabled, 'is-danger': item.danger, 'is-selected': selectedKeys.includes(item.key) }]"
        :aria-disabled="item.disabled ? 'true' : undefined"
        @click="handleClick(item)"
      >
        <span v-if="item.icon" :class="bem('icon')">
          <component :is="item.icon" />
        </span>
        <span :class="bem('title')">{{ item.label }}</span>
        <span v-if="item.extra" :class="bem('extra')">{{ item.extra }}</span>
      </li>
    </template>
    <slot></slot>
  </ul>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfMenu' });

  export interface MenuItemData {
    key: string | number;
    label: string;
    icon?: any;
    disabled?: boolean;
    danger?: boolean;
    extra?: string;
    type?: 'item' | 'divider';
  }

  const props = withDefaults(
    defineProps<{
      /** 数据驱动的菜单项 */
      items?: MenuItemData[];
      /** 当前选中的菜单项 key 数组 */
      selectedKeys?: (string | number)[];
      /** 菜单模式 */
      mode?: 'vertical' | 'horizontal';
    }>(),
    {
      items: undefined,
      selectedKeys: () => [],
      mode: 'vertical',
    }
  );

  const emit = defineEmits<{
    (e: 'click', payload: { key: string | number; item: MenuItemData }): void;
  }>();

  const [_, bem] = createNamespace('menu');

  const normalizedItems = computed(() => props.items ?? []);
  const selectedKeys = computed(() => props.selectedKeys ?? []);

  const handleClick = (item: MenuItemData) => {
    if (item.disabled) return;
    emit('click', { key: item.key, item });
  };
</script>

<style scoped lang="less">
  .gf-menu {
    list-style: none;
    margin: 0;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 160px;
    background: var(--gf-color-surface);

    &--mode-horizontal {
      flex-direction: row;
      gap: 4px;
      padding: 0;
    }

    &__item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      min-height: 32px;
      border-radius: var(--gf-radius-sm);
      cursor: pointer;
      color: var(--gf-color-text);
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      transition:
        background var(--gf-motion-fast) var(--gf-easing),
        color var(--gf-motion-fast) var(--gf-easing);

      &:hover:not(.is-disabled) {
        background: var(--gf-color-fill);
      }

      &.is-selected {
        background: var(--gf-color-primary-soft);
        color: var(--gf-color-primary);
      }

      &.is-danger {
        color: var(--gf-color-danger);

        &:hover:not(.is-disabled) {
          background: var(--gf-color-danger-soft);
        }
      }

      &.is-disabled {
        color: var(--gf-color-text-tertiary);
        cursor: not-allowed;
      }
    }

    &__icon {
      display: inline-flex;
      align-items: center;
      font-size: 14px;
      flex-shrink: 0;
    }

    &__title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__extra {
      flex-shrink: 0;
      color: var(--gf-color-text-tertiary);
      font-size: var(--gf-font-size-xs);
    }

    &__divider {
      height: 1px;
      margin: 4px 12px;
      background: var(--gf-color-border);
    }
  }
</style>
