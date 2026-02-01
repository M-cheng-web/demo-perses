<!--
  组件说明：MockButton（开发/演示用）

  用途：
  - 在 demo 或临时代码中快速提供一个可点击按钮
  - 避免引入复杂依赖，便于后续替换为正式组件
-->
<template>
  <button class="gf-mock-button" type="button" @click="$emit('click')">
    <slot>Button</slot>
  </button>
</template>

<script setup lang="ts">
  defineEmits<{
    (e: 'click'): void;
  }>();
</script>

<style scoped lang="less">
  .gf-mock-button {
    padding: 6px 12px;
    border-radius: var(--gf-radius-sm);
    border: 1px solid transparent;
    background: var(--gf-color-primary);
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    box-shadow: var(--gf-shadow-1);
    transition:
      background var(--gf-motion-fast) var(--gf-easing),
      box-shadow var(--gf-motion-fast) var(--gf-easing);

    &:hover {
      background: var(--gf-color-primary-hover);
    }

    &:active {
      background: var(--gf-color-primary-active);
    }
  }
</style>
