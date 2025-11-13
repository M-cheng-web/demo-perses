<template>
  <h1>{{ msg }}</h1>

  <div class="card">
    <button type="button" @click="count++">count is {{ count }}</button>
    <p>
      Edit
      <code>components/HelloWorld.vue</code> to test HMR
    </p>
  </div>

  <Button type="primary">Primary Button</Button>
</template>

<script setup lang="ts">
  import { Button } from 'ant-design-vue';
  import { ref } from 'vue';

  defineProps<{ msg: string }>();

  const count = ref(0);
</script>

<style scoped>
  .read-the-docs {
    color: #888;
  }
</style>
