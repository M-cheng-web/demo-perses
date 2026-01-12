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
    border-radius: 6px;
    border: 1px solid #8fb4ff;
    background: linear-gradient(135deg, #6ea9ff, #8bc5ff);
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 6px 14px rgba(110, 169, 255, 0.35);
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 20px rgba(110, 169, 255, 0.4);
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 4px 10px rgba(110, 169, 255, 0.28);
    }
  }
</style>
