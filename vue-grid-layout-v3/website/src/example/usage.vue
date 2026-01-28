<script setup>
import {
    reactive,
    onMounted,
} from 'vue';
import { GridLayout, GridItem } from 'vue-grid-layout-v3';
import TestElement from './test-element.vue';
import { getDocumentDir, setDocumentDir } from './dom';

const testLayout = [
    { x: 0, y: 0, w: 2, h: 2, i: '0', resizable: true, draggable: true, static: false, minY: 0, maxY: 2 },
    { x: 2, y: 0, w: 2, h: 4, i: '1', resizable: null, draggable: null, static: true },
    { x: 4, y: 0, w: 2, h: 5, i: '2', resizable: false, draggable: false, static: false, minX: 4, maxX: 4, minW: 2, maxW: 2, preserveAspectRatio: true },
    { x: 6, y: 0, w: 2, h: 3, i: '3', resizable: false, draggable: false, static: false, preserveAspectRatio: true },
    { x: 8, y: 0, w: 2, h: 3, i: '4', resizable: false, draggable: false, static: false },
    { x: 10, y: 0, w: 2, h: 3, i: '5', resizable: false, draggable: false, static: false },
    { x: 0, y: 5, w: 2, h: 5, i: '6', resizable: false, draggable: false, static: false },
    { x: 2, y: 5, w: 2, h: 5, i: '7', resizable: false, draggable: false, static: false },
    { x: 4, y: 5, w: 2, h: 5, i: '8', resizable: false, draggable: false, static: false },
    { x: 6, y: 3, w: 2, h: 4, i: '9', resizable: false, draggable: false, static: true },
    { x: 8, y: 4, w: 2, h: 4, i: '10', resizable: false, draggable: false, static: false },
    { x: 10, y: 4, w: 2, h: 4, i: '11', resizable: false, draggable: false, static: false, minY: 4 },
    { x: 0, y: 10, w: 2, h: 5, i: '12', resizable: false, draggable: false, static: false },
    { x: 2, y: 10, w: 2, h: 5, i: '13', resizable: false, draggable: false, static: false },
    { x: 4, y: 8, w: 2, h: 4, i: '14', resizable: false, draggable: false, static: false },
    { x: 6, y: 8, w: 2, h: 4, i: '15', resizable: false, draggable: false, static: false },
    { x: 8, y: 10, w: 2, h: 5, i: '16', resizable: false, draggable: false, static: false },
    { x: 10, y: 4, w: 2, h: 2, i: '17', resizable: false, draggable: false, static: false },
    { x: 0, y: 9, w: 2, h: 3, i: '18', resizable: false, draggable: false, static: false },
    { x: 2, y: 6, w: 2, h: 2, i: '19', resizable: false, draggable: false, static: false },
];

const state = reactive({
    layout: JSON.parse(JSON.stringify(testLayout)),
    layout2: JSON.parse(JSON.stringify(testLayout)),
    draggable: true,
    resizable: true,
    mirrored: false,
    responsive: true,
    bounded: false,
    transformScale: 1,
    preventCollision: false,
    compact: true,
    // restoreOnDrag: true,
    rowHeight: 30,
    colNum: 12,
    index: 0,
    marginX: 10,
    marginY: 10,
});

let layoutRef;

onMounted(() => {
    state.index = state.layout.length;
    console.info(layoutRef);
});

// function clicked()  {
//   window.alert("CLICK!");
// }

function increaseWidth() {
    let width = document.getElementById('grid-layout-test').offsetWidth;
    width += 20;
    document.getElementById('grid-layout-test').style.width = `${width}px`;
}

function decreaseWidth() {
    let width = document.getElementById('grid-layout-test').offsetWidth;
    width -= 20;
    document.getElementById('grid-layout-test').style.width = `${width}px`;
}

function scaleHalf() {
    state.transformScale = 0.5;
    document.getElementById('grid-layout-test').style.transform = 'scale(0.5)';
}

function scaleThreeQuarters() {
    state.transformScale = 0.75;
    document.getElementById('grid-layout-test').style.transform = 'scale(0.75)';
}

function scaleIdentity() {
    state.transformScale = 1;
    document.getElementById('grid-layout-test').style.transform = 'scale(1)';
}

function removeItem(i) {
    // console.info(`### REMOVE ${i}`);
    const index = state.layout.map(item => item.i).indexOf(i);
    state.layout.splice(index, 1);
}

function addItem() {
    // let self = state;
    // console.info("### LENGTH: " + state.layout.length);
    const item = { x: 0, y: 0, w: 2, h: 2, i: `${state.index}`, whatever: 'bbb' };
    state.index++;
    state.layout.push(item);
}

function addItemDynamically() {
    const x = Math.round(Math.random() * (state.colNum || 12)); // (state.layout.length * 2) % (state.colNum || 12);
    const y = Math.round(Math.random() * 100); // state.layout.length + (state.colNum || 12);
    // console.info(`X=${x} Y=${y}`);
    const item = {
        x,
        y,
        w: 2,
        h: 2,
        i: `${state.index}`,
    };
    state.index++;
    state.layout.push(item);
}

function move(i, newX, newY) {
    console.info(`MOVE i=${i}, X=${newX}, Y=${newY}`);
}

function resize(i, newH, newW, newHPx, newWPx) {
    console.info(`RESIZE i=${i}, H=${newH}, W=${newW}, H(px)=${newHPx}, W(px)=${newWPx}`);
}

function moved(i, newX, newY) {
    console.info(`### MOVED i=${i}, X=${newX}, Y=${newY}`);
}

function resized(i, newH, newW, newHPx, newWPx) {
    console.info(`### RESIZED i=${i}, H=${newH}, W=${newW}, H(px)=${newHPx}, W(px)=${newWPx}`);
}

function containerResized(i, newH, newW, newHPx, newWPx) {
    console.info(`### CONTAINER RESIZED i=${i}, H=${newH}, W=${newW}, H(px)=${newHPx}, W(px)=${newWPx}`);
}

/**
 * Add change direction button
 */
function changeDirection() {
    const documentDirection = getDocumentDir();
    let toggle = '';
    if (documentDirection === 'rtl') {
        toggle = 'ltr';
    } else {
        toggle = 'rtl';
    }
    setDocumentDir(toggle);
    state.mirrored = toggle === 'rtl';
}

function layoutCreatedEvent(newLayout) {
    console.info('Created layout: ', newLayout);
}

function layoutBeforeMountEvent(newLayout) {
    console.info('beforeMount layout: ', newLayout);
}

function layoutMountedEvent(newLayout) {
    console.info('Mounted layout: ', newLayout);
}

function layoutReadyEvent(newLayout) {
    console.info('Ready layout: ', newLayout);
}

function layoutUpdatedEvent(newLayout) {
    console.info('Updated layout: ', newLayout);
}
function breakpointChangedEvent(newBreakpoint, newLayout) {
    console.info('breakpoint changed breakpoint=', newBreakpoint, ', layout: ', newLayout);
}
function setRef(e) {
    layoutRef = e;
}
</script>
<template>
    <div id="app">
        <div class="layout-json">
            <div class="layoutItem" v-for="item in state.layout" :key="item.i">
                <b>{{item.i}}</b>:{{item}}
            </div>
        </div>
        <div class="control-panel">
            <button class="btn" @click="decreaseWidth">Decrease Width</button>
            <button class="btn" @click="increaseWidth">Increase Width</button>
            <button class="btn" @click="scaleHalf">Scale x0.5</button>
            <button class="btn" @click="scaleThreeQuarters">Scale x0.75</button>
            <button class="btn" @click="scaleIdentity">Scale x1.0</button>
            <button class="btn" @click="addItem">Add an item</button>
            <button class="btn" @click="addItemDynamically">Add an item dynamically</button>
            <button class="btn" @click="changeDirection">Change Direction</button>
            <input type="checkbox" v-model="state.draggable" /> Draggable
            <input type="checkbox" v-model="state.resizable" /> Resizable
            <input type="checkbox" v-model="state.mirrored" /> Mirrored
            <input type="checkbox" v-model="state.bounded" /> Bounded
            <input type="checkbox" v-model="state.responsive" /> Responsive
            <input type="checkbox" v-model="state.preventCollision" /> Prevent Collision
            <input type="checkbox" v-model="state.compact" /> Vertical Compact
            <div style="margin-top: 10px;margin-bottom: 10px;">
                Row Height: <input class="inp" type="number" v-model="state.rowHeight">
                Col nums: <input class="inp" type="number" v-model="state.colNum">
                Margin x: <input class="inp" type="number" v-model="state.marginX">
                Margin y: <input class="inp" type="number" v-model="state.marginY">
            </div>
        </div>
        <GridLayout
            :ref="setRef"
            id="grid-layout-test"
            :margin="[parseInt(state.marginX), parseInt(state.marginY)]"
            v-model:layout="state.layout"
            :col-num="parseInt(state.colNum)"
            :row-height="state.rowHeight"
            :is-draggable="state.draggable"
            :is-resizable="state.resizable"
            :is-mirrored="state.mirrored"
            :is-bounded="state.bounded"
            :prevent-collision="state.preventCollision"
            :vertical-compact="state.compact"
            :restore-on-drag="state.restoreOnDrag"
            :use-css-transforms="true"
            :responsive="state.responsive"
            :transform-scale="state.transformScale"
            @layout-created="layoutCreatedEvent"
            @layout-before-mount="layoutBeforeMountEvent"
            @layout-mounted="layoutMountedEvent"
            @layout-ready="layoutReadyEvent"
            @layout-updated="layoutUpdatedEvent"
            @breakpoint-changed="breakpointChangedEvent"
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
                :min-w="item.minW"
                :max-w="item.maxW"
                :min-x="item.minX"
                :max-x="item.maxX"
                :min-y="item.minY"
                :max-y="item.maxY"
                :preserve-aspect-ratio="item.preserveAspectRatio"
                @resize="resize"
                @move="move"
                @resized="resized"
                @container-resized="containerResized"
                @moved="moved"
            >
                <!--<CustomDragElement :text="item.i"></CustomDragElement>-->
                <TestElement :text="item.i" @remove-item="removeItem($event)" />
                <!--<button @click="clicked">CLICK ME!</button>-->
            </GridItem>
        </GridLayout>
    </div>
</template>
<style scoped>
#app {
    font-family: 'Avenir', Helvetica, Arial, sans-serif;
    color: #2c3e50;
}
.layout-json {
    border: 1px solid #ccc;
    padding: 5px;
}

.control-panel {
    padding: 10px 0;
}
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
.inp {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-size: 14px;
    background-color: #fff;
    border: 1px solid #d9d9d9;
    border-radius: 2px;
}
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
.vue-grid-item .remove {
    position: absolute;
    right: 2px;
    top: 0;
    cursor: pointer;
}

</style>
