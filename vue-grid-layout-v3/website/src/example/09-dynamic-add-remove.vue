<script setup>
import { reactive } from 'vue';
import { GridLayout, GridItem } from 'vue-grid-layout-v3';

const state = reactive({
    layout: [
        { x: 0, y: 0, w: 2, h: 2, i: '0' },
        { x: 2, y: 0, w: 2, h: 2, i: '1' },
        { x: 4, y: 0, w: 2, h: 2, i: '2' },
        { x: 6, y: 0, w: 2, h: 2, i: '3' },
        { x: 8, y: 0, w: 2, h: 2, i: '4' },
    ],
    draggable: true,
    resizable: true,
    colNum: 12,
    index: 0,
});
state.index = state.layout.length;
function addItem() {
    // Add a new item. It must have a unique key!
    state.layout.push({
        x: (state.layout.length * 2) % (state.colNum || 12),
        y: state.layout.length + (state.colNum || 12), // puts it at the bottom
        w: 2,
        h: 2,
        i: state.index,
    });
    // Increment the counter to ensure key is always unique.
    state.index++;
}

function removeItem(val) {
    const index = state.layout.map(item => item.i).indexOf(val);
    state.layout.splice(index, 1);
}
</script>
<template>
    <div>
        <div class="layoutJSON">
            Displayed as <code>[x, y, w, h]</code>:
            <div class="columns">
                <div class="layoutItem" v-for="item in state.layout" :key="item.i">
                    <b>{{item.i}}</b>: [{{item.x}}, {{item.y}}, {{item.w}}, {{item.h}}]
                </div>
            </div>
        </div>
        <div class="controls">
            <button @click="addItem">Add an item dynamically</button>
            <input type="checkbox" v-model="state.draggable" /> Draggable
            <input type="checkbox" v-model="state.resizable" /> Resizable
        </div>
        <GridLayout
            v-model:layout="state.layout"
            :col-num="state.colNum"
            :row-height="30"
            :is-draggable="state.draggable"
            :is-resizable="state.resizable"
            :vertical-compact="true"
            :use-css-transforms="true"
        >
            <GridItem
                v-for="item in state.layout"
                :key="item.i"
                :static="item.static"
                :x="item.x"
                :y="item.y"
                :w="item.w"
                :h="item.h"
                :i="item.i"
            >
                <span class="text">{{item.i}}</span>
                <span class="remove" @click="removeItem(item.i)">x</span>
            </GridItem>
        </GridLayout>
    </div>
</template>
<style scoped>
button {
    white-space: nowrap;
    text-align: center;
    border: 1px solid #d9d9d9;
    cursor: pointer;
    padding: 0 4px;
    font-size: 14px;
    border-radius: 2px;
    background: #fff;
}

.controls {
    padding: 10px 0;
}
.vue-grid-layout {
    background: #eee;
}

.vue-grid-item:not(.vue-grid-placeholder) {
    background: #ccc;
    border: 1px solid black;
}

.vue-grid-item .text {
    font-size: 24px;
    text-align: center;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    margin: auto;
    height: 100%;
    width: 100%;
}
.vue-grid-item .remove {
    position: absolute;
    right: 2px;
    top: 0;
    cursor: pointer;
}


.layoutJSON {
    background: #ddd;
    border: 1px solid black;
    margin-top: 10px;
    padding: 10px;
}

.columns {
    columns: 120px;
}

</style>
