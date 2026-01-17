<!-- 组件说明：菜单子项，触发 click 事件回传键值 -->
<template>
  <li :class="bem()" @click="handleClick">
    <slot></slot>
  </li>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfMenuItem' });

  const props = withDefaults(
    defineProps<{
      /** 唯一键，用于回传点击 */
      eventKey?: string | number;
    }>(),
    {
      eventKey: '',
    }
  );

  const emit = defineEmits<{
    (e: 'click', key: string | number): void;
  }>();

  const [_, bem] = createNamespace('menu-item');

  const handleClick = () => {
    emit('click', props.eventKey);
  };
</script>

<style scoped lang="less">
  .gf-menu-item {
    padding: 8px 10px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s var(--gf-easing);

    &:hover {
      background: var(--gf-primary-soft);
      color: var(--gf-primary-strong);
    }
  }
</style>
