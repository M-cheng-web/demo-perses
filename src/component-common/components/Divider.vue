<template>
  <div :class="['cc-divider', 'ant-divider', bem()]" />
</template>

<script setup lang="ts">
  import { createNamespace } from '@/utils';

  const [_, bem] = createNamespace('divider');
</script>
