<script setup>
import Example01 from '@/example/01-basic.vue';
import Example02 from '@/example/02-events.vue';
import Example03 from '@/example/03-multiple-grids.vue';
import Example04 from '@/example/04-allow-ignore.vue';
import Example05 from '@/example/05-mirrored.vue';
import Example06 from '@/example/06-responsive.vue';
import Example07 from '@/example/07-prevent-collision.vue';
import Example08 from '@/example/08-responsive-predefined-layouts.vue';
import Example09 from '@/example/09-dynamic-add-remove.vue';
import Example10 from '@/example/10-drag-from-outside.vue';
import Example11 from '@/example/11-bounded.vue';

const list = [
    Example01,
    Example02,
    Example03,
    Example04,
    Example05,
    Example06,
    Example07,
    Example08,
    Example09,
    Example10,
    Example11,
];
</script>
<template>
    <div class="page">
        <div v-for="(item, index) in list" :key="index" class="col-12">
            <div class="box">
                <div class="title">{{index + 1}} - {{item.__file}}</div>
                <component :is="item"/>
            </div>
        </div>
    </div>
    <Example05 />
</template>
<style scoped>
.page {
  display: flex;
  flex-wrap: wrap;
  padding-bottom: 200px;
}
.title {
  font-size: 20px;
  font-weight: bold;
  padding: 10px 0;
}
.col-12 {
  width: 50%;
}
.col-24 {
  width: 100%;
}
.box {
  padding: 0 20px;
}
</style>
