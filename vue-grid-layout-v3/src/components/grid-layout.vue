<script setup>
import elementResizeDetectorMaker from 'element-resize-detector';
import mitt from 'mitt';
import {
  onBeforeMount,
  onMounted,
  onBeforeUnmount,
  reactive,
  watch,
  provide,
  nextTick,
} from 'vue';
import {
  bottom,
  compact,
  getLayoutItem,
  moveElement,
  validateLayout,
  cloneLayout,
  getAllCollisions,
} from '../helpers/utils';
import {
  getBreakpointFromWidth,
  getColsFromBreakpoint,
  findOrGenerateResponsiveLayout,
} from '../helpers/responsive-utils';
import {
  addWindowEventListener,
  removeWindowEventListener,
} from '../helpers/dom';
import GridItem from './grid-item.vue';

const props = defineProps({
  layout: {
    type: Array,
    required: true,
  },
  responsiveLayouts: {
    type: Object,
    default() {
      return {};
    },
  },
  colNum: {
    type: Number,
    default: 12,
  },
  rowHeight: {
    type: Number,
    default: 150,
  },
  maxRows: {
    type: Number,
    default: Infinity,
  },
  margin: {
    type: Array,
    default() {
      return [10, 10];
    },
  },
  isDraggable: {
    type: Boolean,
    default: true,
  },
  isResizable: {
    type: Boolean,
    default: true,
  },
  isMirrored: {
    type: Boolean,
    default: false,
  },
  isBounded: {
    type: Boolean,
    default: false,
  },
  // If true, the container height swells and contracts to fit contents
  autoSize: {
    type: Boolean,
    default: true,
  },
  verticalCompact: {
    type: Boolean,
    default: true,
  },
  restoreOnDrag: {
    type: Boolean,
    default: false,
  },
  preventCollision: {
    type: Boolean,
    default: false,
  },
  useCssTransforms: {
    type: Boolean,
    default: true,
  },
  responsive: {
    type: Boolean,
    default: false,
  },
  breakpoints: {
    type: Object,
    default() { return { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }; },
  },
  cols: {
    type: Object,
    default() { return { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }; },
  },
  useStyleCursor: {
    type: Boolean,
    default: true,
  },
  transformScale: {
    type: Number,
    default: 1,
  },
});

const emit = defineEmits([
  'update:layout',
  'layout-ready',
  'layout-created',
  'layout-before-mount',
  'layout-mounted',
  'layout-updated',
  'breakpoint-changed',
]);

const emitter = mitt();

const exposeObj = {
  el: undefined,
  placeholderEl: undefined,
  placeholder: {},
  emitter,
};
defineExpose(exposeObj);

const erd = elementResizeDetectorMaker({
  strategy: 'scroll', // <- For ultra performance.
  // See https://github.com/wnr/element-resize-detector/issues/110 about callOnAdd.
  callOnAdd: false,
});

const state = reactive({
  width: null,
  mergedStyle: {},
  isDragging: false,
  placeholder: {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    i: -1,
  },
  layout: [],
  layouts: {}, // array to store all layouts from different breakpoints
  lastBreakpoint: null, // store last active breakpoint
  originalLayout: null, // store original Layout
});

provide('emitter', emitter);
provide('gridLayout', { props, state });

function created() {
  emitter.on('resizeEvent', onResizeEvent);
  emitter.on('dragEvent', onDragEvent);
  emit('layout-created', props.layout);
  addWindowEventListener('resize', onWindowResize);
}

created();

onBeforeMount(() => {
  emit('layout-before-mount', state.layout);
});

onMounted(() => {
  emit('layout-mounted', state.layout);
});

onBeforeUnmount(() => {
  // Remove listeners
  emitter.off('resizeEvent', onResizeEvent);
  emitter.off('dragEvent', onDragEvent);
  removeWindowEventListener('resize', onWindowResize);
  if (erd && exposeObj.el) {
    erd.uninstall(exposeObj.el);
  }
});

watch(() => state.width, async (newval, oldval) => {
  // this.$broadcast("updateWidth", state.width);
  emitter.emit('updateWidth', state.width);
  updateHeight();

  /**
   * If oldval == null is when the width has never been
   * set before. That only occurs when mouting is
   * finished, and onWindowResize has been called and
   * state.width has been changed the first time after it
   * got set to null in the constructor. It is now time
   * to issue layout-ready events as the GridItems have
   * their sizes configured properly.

   * The reason for emitting the layout-ready events on
   * the next tick is to allow for the newly-emitted
   * updateWidth event (above) to have reached the
   * children GridItem-s and had their effect, so we're
   * sure that they have the final size before we emit
   * layout-ready (for this GridLayout) and
   * item-layout-ready (for the GridItem-s).

   * This way any client event handlers can reliably
   * invistigate stable sizes of GridItem-s.
   */
  if (oldval === null) {
    await nextTick();
    emit('layout-ready', state.layout);
  }
});

watch(() => props.layout, () => {
  validateLayout(props.layout);
  state.originalLayout = props.layout;
  layoutUpdate();
}, { deep: true, immediate: true });

watch(() => props.colNum, () => {
  state.colNum = props.colNum;
  emitter.emit('setColNum', props.colNum);
}, { immediate: true });

watch(() => props.rowHeight, () => {
  emitter.emit('setRowHeight', props.rowHeight);
});

watch(() => props.isDraggable, () => {
  emitter.emit('setDraggable', props.isDraggable);
});

watch(() => props.isResizable, () => {
  emitter.emit('setResizable', props.isResizable);
});

watch(() => props.isBounded, () => {
  emitter.emit('setBounded', props.isBounded);
});

watch(() => props.transformScale, () => {
  emitter.emit('setTransformScale', props.transformScale);
});

watch(() => props.responsive, () => {
  if (!props.responsive) {
    state.layout = cloneLayout(state.originalLayout);
    emitter.emit('setColNum', props.colNum);
  }
  onWindowResize();
});

watch(() => props.maxRows, () => {
  emitter.emit('setMaxRows', props.maxRows);
});

watch(() => props.margin, () => {
  updateHeight();
}, { deep: true });

function layoutIsDiff(newLayout, oldLayout) {
  if (newLayout?.length !== oldLayout?.length) {
    return true;
  }
  let diff = false;
  let idx = 0;
  while (idx < newLayout.length) {
    const nItem = newLayout[idx];
    const nKeys = Object.keys(nItem);
    const oItem = oldLayout[idx];
    const oKeys = Object.keys(oItem);
    const keys = [...new Set([...nKeys, ...oKeys])];
    let j = 0;
    while (j < keys.length) {
      const k = keys[j];
      if (nItem[k] !== oItem[k]) {
        diff = true;
        break;
      }
      j += 1;
    }
    if (diff) {
      break;
    }
    idx += 1;
  }
  return diff;
}

function layoutUpdate() {
  const diff = layoutIsDiff(props.layout, state.layout);
  if (diff) {
    initResponsiveFeatures();
    state.layout = cloneLayout(props.layout);

    compact(state.layout, props.verticalCompact);
    emitter.emit('updateWidth', state.width);
    updateHeight();

    if (layoutIsDiff(props.layout, state.layout)) {
      const layout = cloneLayout(state.layout);
      emit('layout-updated', layout);
      emit('update:layout', layout);
    }
  }
}

function updateHeight() {
  state.mergedStyle = {
    height: containerHeight(),
  };
}

function onWindowResize() {
  if (exposeObj.el) {
    state.width = exposeObj.el.offsetWidth;
  }
  emitter.emit('resizeEvent');
}

function containerHeight() {
  if (!props.autoSize) return;
  const m2 = props.margin?.[1] || 0;
  return `${bottom(state.layout) * (props.rowHeight + m2) + m2}px`;
}

function onDragEvent([eventName, id, x, y, h, w] = []) {
  let l = getLayoutItem(state.layout, id);
  // GetLayoutItem sometimes returns null object
  if (l === undefined || l === null) {
    l = { x: 0, y: 0 };
  }

  if (eventName === 'dragstart' && !props.verticalCompact) {
    state.positionsBeforeDrag = state.layout.reduce((result, { i, x, y }) => ({
      ...result,
      [i]: { x, y },
    }), {});
  }

  if (eventName === 'dragmove' || eventName === 'dragstart') {
    // state.placeholder.i = id;
    state.placeholder.x = l.x;
    state.placeholder.y = l.y;
    state.placeholder.w = w;
    state.placeholder.h = h;
    state.isDragging = true;
  } else {
    state.isDragging = false;
  }

  // Move the element to the dragged location.
  state.layout = moveElement(state.layout, l, x, y, true, props.preventCollision);
  // const newLayout = moveElement(state.layout, l, x, y, true, props.preventCollision);


  if (props.restoreOnDrag) {
    // Do not compact items more than in layout before drag
    // Set moved item as static to avoid to compact it
    l.static = true;
    compact(state.layout, props.verticalCompact, state.positionsBeforeDrag);
    l.static = false;
  } else {
    compact(state.layout, props.verticalCompact);
  }

  updateHeight();
  if (eventName === 'dragend') {
    delete state.positionsBeforeDrag;
  }
  if (layoutIsDiff(props.layout, state.layout)) {
    const layout = cloneLayout(state.layout);
    emit('layout-updated', layout);
    emit('update:layout', layout);
  }
}

function onResizeEvent([eventName, id, x, y, h, w] = []) {
  let l = getLayoutItem(state.layout, id);
  // GetLayoutItem sometimes return null object
  if (l === undefined || l === null) {
    l = { h: 0, w: 0 };
  }

  let hasCollisions;
  if (props.preventCollision) {
    const collisions = getAllCollisions(state.layout, { ...l, w, h }).filter(
      layoutItem => layoutItem.i !== l.i,
    );
    hasCollisions = collisions.length > 0;

    // If we're colliding, we need adjust the placeholder.
    if (hasCollisions) {
      // adjust w && h to maximum allowed space
      let leastX = Infinity;
      let leastY = Infinity;
      collisions.forEach(layoutItem => {
        if (layoutItem.x > l.x) leastX = Math.min(leastX, layoutItem.x);
        if (layoutItem.y > l.y) leastY = Math.min(leastY, layoutItem.y);
      });

      if (Number.isFinite(leastX)) l.w = leastX - l.x;
      if (Number.isFinite(leastY)) l.h = leastY - l.y;
    }
  }

  if (!hasCollisions) {
    // Set new width and height.
    l.w = w;
    l.h = h;
  }

  if (eventName === 'resizestart' || eventName === 'resizemove') {
    // state.placeholder.i = id;
    state.placeholder.x = x;
    state.placeholder.y = y;
    state.placeholder.w = l.w;
    state.placeholder.h = l.h;
    state.isDragging = true;
  } else {
    state.isDragging = false;
  }

  if (props.responsive) {
    responsiveGridLayout();
  }

  compact(state.layout, props.verticalCompact);
  updateHeight();

  if (layoutIsDiff(props.layout, state.layout)) {
    const layout = cloneLayout(state.layout);
    emit('layout-updated', layout);
    emit('update:layout', layout);
  }
}

// finds or generates new layouts for set breakpoints
function responsiveGridLayout() {
  const newBreakpoint = getBreakpointFromWidth(props.breakpoints, state.width);
  const newCols = getColsFromBreakpoint(newBreakpoint, props.cols);

  if (newCols !== state.colNum) {
    state.colNum = newCols;
    // Find or generate a new layout.
    state.layout = findOrGenerateResponsiveLayout(
      state.layout,
      state.layouts,
      props.breakpoints,
      newBreakpoint,
      newCols,
      props.verticalCompact,
    );

    // Store the new layout.
    state.layouts[newBreakpoint] = state.layout;
    emitter.emit('setColNum', newCols);
  }

  if (state.lastBreakpoint !== newBreakpoint) {
    state.lastBreakpoint = newBreakpoint;
    emit('breakpoint-changed', newBreakpoint, state.layout);
  }
}

// clear all responsive layouts
function initResponsiveFeatures() {
  // clear layouts
  state.layouts = { ...props.responsiveLayouts };
}

// // find difference in layouts
// function findDifference(layout, originalLayout) {
//   // Find values that are in result1 but not in result2
//   const uniqueResultOne = layout.filter((obj) => {
//     return !originalLayout.some((obj2) => {
//       return obj.i === obj2.i;
//     });
//   });
//
//   // Find values that are in result2 but not in result1
//   const uniqueResultTwo = originalLayout.filter((obj) => {
//     return !layout.some((obj2) => {
//       return obj.i === obj2.i;
//     });
//   });
//
//   // Combine the two arrays of unique entries#
//   return uniqueResultOne.concat(uniqueResultTwo);
// }

function setRef(e) {
  if (!e || e === exposeObj.el) {
    return;
  }
  exposeObj.el = e;
  if (erd) {
    erd.listenTo(exposeObj.el, () => {
      onWindowResize();
    });
  }
  state.width = exposeObj.el.offsetWidth;
}

function setPlaceholderRef(e) {
  if (e) {
    exposeObj.placeholder = e;
    exposeObj.placeholderEl = e.el;
  }
}
</script>
<template>
  <div :ref="setRef" class="vue-grid-layout" :style="state.mergedStyle">
    <slot />
    <GridItem :ref="setPlaceholderRef"
      v-show="state.isDragging"
      class="vue-grid-placeholder"
      :x="state.placeholder.x"
      :y="state.placeholder.y"
      :w="state.placeholder.w"
      :h="state.placeholder.h"
      i="placeholder"
    />
  </div>
</template>
<style scoped>
.vue-grid-layout {
  position: relative;
  transition: height 200ms ease;
}
</style>

