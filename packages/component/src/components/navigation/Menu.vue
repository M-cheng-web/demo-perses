<!-- 组件说明：简易菜单列表，可传入 items 或自定义插槽 -->
<template>
  <ul :class="bem()">
    <li v-for="item in normalizedItems" :key="item.key" :class="bem('item')" @click="handleClick(item)">
      <span v-if="item.icon" :class="bem('icon')">
        <component :is="item.icon" />
      </span>
      <span>{{ item.label }}</span>
    </li>
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
  }

  const props = withDefaults(
    defineProps<{
      /** 数据驱动的菜单项 */
      items?: MenuItemData[];
    }>(),
    {
      items: undefined,
    }
  );

  const emit = defineEmits<{
    (e: 'click', payload: { key: string | number; item: MenuItemData }): void;
  }>();

  const [_, bem] = createNamespace('menu');

  const normalizedItems = computed(() => props.items ?? []);

  const handleClick = (item: MenuItemData) => {
    emit('click', { key: item.key, item });
  };
</script>

<style scoped lang="less">
  .gf-menu {
    list-style: none;
    margin: 0;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 180px;

    &__item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 10px;
      cursor: pointer;
      color: var(--gf-text);
      transition: all 0.2s var(--gf-easing);

      &:hover {
        background: var(--gf-primary-soft);
        color: var(--gf-primary-strong);
      }
    }

    &__icon {
      display: inline-flex;
      align-items: center;
    }
  }
</style>
