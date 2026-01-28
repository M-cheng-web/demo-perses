<script setup>
import { reactive, nextTick } from 'vue';
import { GridLayout, GridItem } from 'vue-grid-layout-v3';

const mouseXY = { x: null, y: null };
const DragPos = { x: null, y: null, w: 1, h: 1, i: null };

const state = reactive({
    layout: [
        { x: 0, y: 0, w: 2, h: 2, i: '0' },
        { x: 2, y: 0, w: 2, h: 4, i: '1' },
        { x: 4, y: 0, w: 2, h: 5, i: '2' },
        { x: 6, y: 0, w: 2, h: 3, i: '3' },
        { x: 8, y: 0, w: 2, h: 3, i: '4' },
        { x: 10, y: 0, w: 2, h: 3, i: '5' },
        { x: 0, y: 5, w: 2, h: 5, i: '6' },
        { x: 2, y: 5, w: 2, h: 5, i: '7' },
        { x: 4, y: 5, w: 2, h: 5, i: '8' },
        { x: 5, y: 10, w: 4, h: 3, i: '9' },
    ],
    colNum: 12,
    layoutRef: {},
    itemRefs: {},
});

document.addEventListener('dragover', (e) => {
    mouseXY.x = e.clientX;
    mouseXY.y = e.clientY;
}, false);

async function drag() {
    const parentRect = document.getElementById('content').getBoundingClientRect();
    let mouseInGrid = false;
    if (((mouseXY.x > parentRect.left) && (mouseXY.x < parentRect.right)) && ((mouseXY.y > parentRect.top) && (mouseXY.y < parentRect.bottom))) {
        mouseInGrid = true;
    }
    if (mouseInGrid === true && (state.layout.findIndex(item => item.i === 'drop')) === -1) {
        state.layout.push({
            x: (state.layout.length * 2) % (state.colNum || 12),
            y: state.layout.length + (state.colNum || 12), // puts it at the bottom
            w: 1,
            h: 1,
            i: 'drop',
        });
        await nextTick();
    }
    if (!state.itemRefs?.drop) {
        return;
    }
    const index = state.layout.findIndex(item => item.i === 'drop');
    if (index !== -1) {
        if (state.itemRefs?.drop?.el?.style) {
            state.itemRefs.drop.el.style.display = 'none';
        }
        const itemRef = state.itemRefs.drop;
        const new_pos = itemRef.calcXY(mouseXY.y - parentRect.top, mouseXY.x - parentRect.left);
        if (mouseInGrid === true) {
            state.layoutRef.emitter.emit('dragEvent', ['dragstart', 'drop', new_pos.x, new_pos.y, 1, 1]);
            DragPos.i = String(index);
            DragPos.x = state.layout[index].x;
            DragPos.y = state.layout[index].y;
        }
        if (mouseInGrid === false) {
            state.layoutRef.emitter.emit('dragEvent', ['dragend', 'drop', new_pos.x, new_pos.y, 1, 1]);
            state.layout = state.layout.filter(obj => obj.i !== 'drop');
            await nextTick();
        }
    }
}

async function dragend() {
    const parentRect = document.getElementById('content').getBoundingClientRect();
    let mouseInGrid = false;
    if (((mouseXY.x > parentRect.left) && (mouseXY.x < parentRect.right)) && ((mouseXY.y > parentRect.top) && (mouseXY.y < parentRect.bottom))) {
        mouseInGrid = true;
    }
    if (mouseInGrid === true) {
        state.layoutRef.emitter.emit('dragEvent', ['dragend', 'drop', DragPos.x, DragPos.y, 1, 1]);
        state.layout = state.layout.filter(obj => obj.i !== 'drop');

        state.layout.push({
            x: DragPos.x,
            y: DragPos.y,
            w: 1,
            h: 1,
            i: DragPos.i,
        });
        await nextTick();
        state.layoutRef.emitter.emit('dragEvent', ['dragend', DragPos.i, DragPos.x, DragPos.y, 1, 1]);
    }
}

function setItemRef(item, e) {
    state.itemRefs[item.i] = e;
}

function setLayoutRef(e) {
    state.layoutRef = e;
}
</script>
<template>
    <div>
        <div>
            <div class="layoutJSON">
                Displayed as <code>[x, y, w, h]</code>:
                <div class="columns">
                    <div class="layoutItem" v-for="item in state.layout" :key="item.i">
                        <b>{{ item.i }}</b>: [{{ item.x }}, {{ item.y }}, {{ item.w }}, {{ item.h }}]
                    </div>
                </div>
            </div>
        </div>
        <br/>
        <div @drag="drag" @dragend="dragend" class="droppable-element" draggable="true"
             unselectable="on">Droppable Element (Drag me!)</div>
        <div id="content">
            <GridLayout
                :ref="setLayoutRef"
                v-model:layout="state.layout"
                :col-num="12"
                :row-height="30"
                :is-draggable="true"
                :is-resizable="true"
                :vertical-compact="true"
                :use-css-transforms="true"
            >
                <GridItem
                    v-for="item in state.layout"
                    :key="item.i"
                    :ref="e => setItemRef(item, e)"
                    :x="item.x"
                    :y="item.y"
                    :w="item.w"
                    :h="item.h"
                    :i="item.i"
                >
                    <span class="text">{{ item.i }}</span>
                </GridItem>
            </GridLayout>
        </div>
    </div>
</template>
<style scoped>
.vue-grid-layout {
    background: #eee;
}

.vue-grid-item:not(.vue-grid-placeholder) {
    background: #ccc;
    border: 1px solid black;
}

.vue-grid-item.static {
    background: #cce;
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

.droppable-element {
    width: 150px;
    text-align: center;
    background: #fdd;
    border: 1px solid black;
    margin: 10px 0;
    padding: 10px;
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
