<script setup>
import {
  onMounted,
} from 'vue';

defineProps({
  text: {
    type: String,
    default: 'x',
  },
});

const emit = defineEmits([
  'removeItem',
]);
onMounted(() => {
  // console.log(`### ${props.text} ready!`);
});
</script>
<template>
  <div>
    <span class="text">
      {{text}}
    </span>
    <span class="remove" @click="emit('removeItem', text)">x</span>
  </div>
</template>
<style scoped>
.remove {
  position: absolute;
  right: 2px;
  top: 0;
  cursor: pointer;
}
</style>

