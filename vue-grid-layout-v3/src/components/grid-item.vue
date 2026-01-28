<script setup>
import {
  reactive,
  unref,
  watch,
  computed,
  onBeforeUnmount,
  onMounted,
  inject,
} from 'vue';
import interact from '@interactjs/interact';
import '@interactjs/auto-start';
import '@interactjs/auto-scroll';
import '@interactjs/actions/drag';
import '@interactjs/actions/resize';
import '@interactjs/modifiers';
import '@interactjs/dev-tools';
import {
  setTopLeft,
  setTopRight,
  setTransformRtl,
  setTransform,
} from '../helpers/utils';
import {
  getControlPosition,
  createCoreData,
} from '../helpers/draggable-utils';
import {
  getColsFromBreakpoint,
} from '../helpers/responsive-utils';

const props = defineProps({
  i: {
    required: true,
  },
  x: {
    type: Number,
    required: true,
  },
  y: {
    type: Number,
    required: true,
  },
  w: {
    type: Number,
    required: true,
  },
  h: {
    type: Number,
    required: true,
  },
  minW: {
    type: Number,
    required: false,
    default: 1,
  },
  minH: {
    type: Number,
    required: false,
    default: 1,
  },
  maxW: {
    type: Number,
    required: false,
    default: Infinity,
  },
  maxH: {
    type: Number,
    required: false,
    default: Infinity,
  },
  // cols: {
  //   type: Number,
  //   required: true
  // },
  // containerWidth: {
  //   type: Number,
  //   required: true
  // },
  // rowHeight: {
  //   type: Number,
  //   required: true
  // },
  // margin: {
  //   type: Array,
  //   required: true
  // },
  // maxRows: {
  //   type: Number,
  //   required: true
  // },
  isDraggable: {
    type: Boolean,
    required: false,
    default: null,
  },
  isResizable: {
    type: Boolean,
    required: false,
    default: null,
  },
  isBounded: {
    type: Boolean,
    required: false,
    default: null,
  },
  // useCssTransforms: {
  //   type: Boolean,
  //   required: true
  // },
  static: {
    type: Boolean,
    required: false,
    default: false,
  },
  dragIgnoreFrom: {
    type: String,
    required: false,
    default: 'a, button',
  },
  dragAllowFrom: {
    type: String,
    required: false,
    default: null,
  },
  resizeIgnoreFrom: {
    type: String,
    required: false,
    default: 'a, button',
  },
  preserveAspectRatio: {
    type: Boolean,
    required: false,
    default: false,
  },
  dragOption: {
    type: Object,
    required: false,
    default: () => ({}),
  },
  resizeOption: {
    type: Object,
    required: false,
    default: () => ({}),
  },
});

const emit = defineEmits([
  'container-resized',
  'resize',
  'resized',
  'move',
  'moved',
]);

const exposeObj = {
  el: undefined,
  calcXY,
};
defineExpose(exposeObj);

const emitter = inject('emitter');
const gridLayout = inject('gridLayout');
// inject: ["eventBus", "layout"],

let interactObj;

const state = reactive({
  cols: 1,
  containerWidth: 100,
  rowHeight: 30,
  margin: [10, 10],
  maxRows: Infinity,
  draggable: null,
  resizable: null,
  bounded: null,
  transformScale: 1,
  useCssTransforms: true,
  useStyleCursor: true,

  isDragging: false,
  dragging: null,
  isResizing: false,
  resizing: null,
  lastX: NaN,
  lastY: NaN,
  lastW: NaN,
  lastH: NaN,
  style: {},

  dragEventSet: false,
  resizeEventSet: false,

  previousW: null,
  previousH: null,
  previousX: null,
  previousY: null,
  innerX: props.x,
  innerY: props.y,
  innerW: props.w,
  innerH: props.h,
});

const classObj = computed(() => {
  return {
    'vue-resizable': unref(resizableAndNotStatic),
    static: props.static,
    resizing: state.isResizing,
    'vue-draggable-dragging': state.isDragging,
    cssTransforms: state.useCssTransforms,
    'render-rtl': unref(renderRtl),
    'disable-userselect': state.isDragging,
    // 'no-touch': unref(isAndroid) && unref(draggableOrResizableAndNotStatic),
    'no-touch': unref(draggableOrResizableAndNotStatic),
  };
});

const resizableAndNotStatic = computed(() => {
  return state.resizable && !props.static;
});

const draggableOrResizableAndNotStatic = computed(() => {
  return (state.draggable || state.resizable) && !props.static;
});

// const isAndroid = computed(() => {
//   return navigator.userAgent.toLowerCase().indexOf('android') !== -1;
// });

const renderRtl = computed(() => {
  return gridLayout.props.isMirrored;
});

const resizableHandleClass = computed(() => {
  if (unref(renderRtl)) {
    return 'vue-resizable-handle vue-rtl-resizable-handle';
  }
  return 'vue-resizable-handle';
});

function created() {
  emitter.on('updateWidth', updateWidth);
  emitter.on('setDraggable', setDraggableHandler);
  emitter.on('setResizable', setResizableHandler);
  emitter.on('setBounded', setBoundedHandler);
  emitter.on('setTransformScale', setTransformScaleHandler);
  emitter.on('setRowHeight', setRowHeightHandler);
  emitter.on('setMaxRows', setMaxRowsHandler);
  emitter.on('directionchange', directionchangeHandler);
  emitter.on('setColNum', setColNum);
}

created();

onBeforeUnmount(() => {
  // Remove listeners
  emitter.off('updateWidth', updateWidth);
  emitter.off('setDraggable', setDraggableHandler);
  emitter.off('setResizable', setResizableHandler);
  emitter.off('setBounded', setBoundedHandler);
  emitter.off('setTransformScale', setTransformScaleHandler);
  emitter.off('setRowHeight', setRowHeightHandler);
  emitter.off('setMaxRows', setMaxRowsHandler);
  emitter.off('directionchange', directionchangeHandler);
  emitter.off('setColNum', setColNum);
  if (interactObj) {
    interactObj.unset(); // destroy interact intance
  }
});

onMounted(() => {
  const parent = { ...gridLayout.props, ...gridLayout.state };
  if (parent.responsive && parent.lastBreakpoint) {
    state.cols = getColsFromBreakpoint(parent.lastBreakpoint, parent.cols);
  } else {
    state.cols = parent.colNum;
  }
  state.rowHeight = parent.rowHeight;
  state.containerWidth = parent.width !== null ? parent.width : 100;
  state.margin = parent.margin !== undefined ? parent.margin : [10, 10];
  state.maxRows = parent.maxRows;

  if (props.isDraggable === null) {
    state.draggable = parent.isDraggable;
  } else {
    state.draggable = props.isDraggable;
  }
  if (props.isResizable === null) {
    state.resizable = parent.isResizable;
  } else {
    state.resizable = props.isResizable;
  }
  if (props.isBounded === null) {
    state.bounded = parent.isBounded;
  } else {
    state.bounded = props.isBounded;
  }
  state.transformScale = parent.transformScale;
  state.useCssTransforms = parent.useCssTransforms;
  state.useStyleCursor = parent.useStyleCursor;
  createStyle();
});

watch(() => props.isDraggable, () => {
  state.draggable = props.isDraggable;
});

watch(() => props.static, () => {
  tryMakeDraggable();
  tryMakeResizable();
});

watch(() => state.draggable, () => {
  tryMakeDraggable();
});

watch(() => props.isResizable, () => {
  state.resizable = props.isResizable;
});

watch(() => props.isBounded, () => {
  state.bounded = props.isBounded;
});

watch(() => state.resizable, () => {
  tryMakeResizable();
});

watch(() => state.rowHeight, () => {
  createStyle();
  emitContainerResized();
});

watch(() => state.cols, () => {
  tryMakeResizable();
  createStyle();
  emitContainerResized();
});

watch(() => state.containerWidth, () => {
  tryMakeResizable();
  createStyle();
  emitContainerResized();
});

watch(() => props.x, (newVal) => {
  state.innerX = newVal;
  createStyle();
});

watch(() => props.y, (newVal) => {
  state.innerY = newVal;
  createStyle();
});

watch(() => props.h, (newVal) => {
  state.innerH = newVal;
  createStyle();
});

watch(() => props.w, (newVal) => {
  state.innerW = newVal;
  createStyle();
});

watch(renderRtl, () => {
  tryMakeResizable();
  createStyle();
});

watch(() => props.minH, () => {
  tryMakeResizable();
});

watch(() => props.maxH, () => {
  tryMakeResizable();
});

watch(() => props.minW, () => {
  tryMakeResizable();
});

watch(() => props.maxW, () => {
  tryMakeResizable();
});

watch(() => gridLayout.props.margin, (margin) => {
  if (!margin
    || (Number(margin[0]) === Number(state.margin[0])
      && Number(margin[1]) === Number(state.margin[1]))
  ) {
    return;
  }
  state.margin = margin.map(m => Number(m) || 0);
  createStyle();
  emitContainerResized();
});

function setDraggableHandler(isDraggable) {
  if (props.isDraggable === null) {
    state.draggable = isDraggable;
  }
}

function setResizableHandler(isResizable) {
  if (props.isResizable === null) {
    state.resizable = isResizable;
  }
}

function setBoundedHandler(isBounded) {
  if (props.isBounded === null) {
    state.bounded = isBounded;
  }
}

function setTransformScaleHandler(transformScale) {
  state.transformScale = transformScale;
}

function setRowHeightHandler(rowHeight) {
  state.rowHeight = rowHeight;
}

function setMaxRowsHandler(maxRows) {
  state.maxRows = maxRows;
}

function directionchangeHandler() {
  createStyle();
}

function setColNum(colNum) {
  state.cols = parseInt(colNum);
}

function createStyle() {
  if (props.x + props.w > state.cols) {
    state.innerX = 0;
    state.innerW = (props.w > state.cols) ? state.cols : props.w;
  } else {
    state.innerX = props.x;
    state.innerW = props.w;
  }
  const pos = calcPosition(state.innerX, state.innerY, state.innerW, state.innerH);


  if (state.isDragging) {
    pos.top = state.dragging.top;
    // Add rtl support
    if (unref(renderRtl)) {
      pos.right = state.dragging.left;
    } else {
      pos.left = state.dragging.left;
    }
  }
  if (state.isResizing) {
    pos.width = state.resizing.width;
    pos.height = state.resizing.height;
  }

  let style;
  // CSS Transforms support (default)
  if (state.useCssTransforms) {
    // Add rtl support
    if (unref(renderRtl)) {
      style = setTransformRtl(pos.top, pos.right, pos.width, pos.height);
    } else {
      style = setTransform(pos.top, pos.left, pos.width, pos.height);
    }
  } else { // top,left (slow)
    // Add rtl support
    if (unref(renderRtl)) {
      style = setTopRight(pos.top, pos.right, pos.width, pos.height);
    } else {
      style = setTopLeft(pos.top, pos.left, pos.width, pos.height);
    }
  }
  state.style = style;
}

function emitContainerResized() {
  // state.style has width and height with trailing 'px'. The
  // resized event is without them
  const styleProps = {};
  for (const prop of ['width', 'height']) {
    const val = state.style[prop];
    const matches = val.match(/^(\d+)px$/);
    if (!matches) return;
    styleProps[prop] = matches[1];
  }
  emit('container-resized', props.i, props.h, props.w, styleProps.height, styleProps.width);
}

function handleResize(event) {
  if (props.static) return;
  const position = getControlPosition(event);
  // Get the current drag point from the event. This is used as the offset.
  if (position == null) return; // not possible but satisfies flow
  const { x, y } = position;

  const newSize = { width: 0, height: 0 };
  let pos;
  switch (event.type) {
    case 'resizestart': {
      tryMakeResizable();
      state.previousW = state.innerW;
      state.previousH = state.innerH;
      pos = calcPosition(state.innerX, state.innerY, state.innerW, state.innerH);
      newSize.width = pos.width;
      newSize.height = pos.height;
      state.resizing = newSize;
      state.isResizing = true;
      break;
    }
    case 'resizemove': {
      const coreEvent = createCoreData(state.lastW, state.lastH, x, y);
      if (unref(renderRtl)) {
        newSize.width = state.resizing.width - coreEvent.deltaX / state.transformScale;
      } else {
        newSize.width = state.resizing.width + coreEvent.deltaX / state.transformScale;
      }
      newSize.height = state.resizing.height + coreEvent.deltaY / state.transformScale;

      state.resizing = newSize;
      break;
    }
    case 'resizeend': {
      pos = calcPosition(state.innerX, state.innerY, state.innerW, state.innerH);
      newSize.width = pos.width;
      newSize.height = pos.height;
      state.resizing = null;
      state.isResizing = false;
      break;
    }
  }
  createStyle();

  // Get new WH
  pos = calcWH(newSize.height, newSize.width);
  if (pos.w < props.minW) {
    pos.w = props.minW;
  }
  if (pos.w > props.maxW) {
    pos.w = props.maxW;
  }
  if (pos.h < props.minH) {
    pos.h = props.minH;
  }
  if (pos.h > props.maxH) {
    pos.h = props.maxH;
  }

  if (pos.h < 1) {
    pos.h = 1;
  }
  if (pos.w < 1) {
    pos.w = 1;
  }

  state.lastW = x;
  state.lastH = y;

  if (state.innerW !== pos.w || state.innerH !== pos.h) {
    emit('resize', props.i, pos.h, pos.w, newSize.height, newSize.width);
  }
  if (event.type === 'resizeend' && (state.previousW !== state.innerW || state.previousH !== state.innerH)) {
    emit('resized', props.i, pos.h, pos.w, newSize.height, newSize.width);
  }
  emitter.emit('resizeEvent', [
    event.type, props.i, state.innerX, state.innerY, pos.h, pos.w,
  ]);
}

function handleDrag(event) {
  if (props.static) return;
  if (state.isResizing) return;

  const position = getControlPosition(event);

  // Get the current drag point from the event. This is used as the offset.
  if (position === null) return; // not possible but satisfies flow
  const { x, y } = position;

  // let shouldUpdate = false;
  const newPosition = { top: 0, left: 0 };
  switch (event.type) {
    case 'dragstart': {
      state.previousX = state.innerX;
      state.previousY = state.innerY;

      const parentRect = event.target.offsetParent.getBoundingClientRect();
      const clientRect = event.target.getBoundingClientRect();

      const cLeft = clientRect.left / state.transformScale;
      const pLeft = parentRect.left / state.transformScale;
      const cRight = clientRect.right / state.transformScale;
      const pRight = parentRect.right / state.transformScale;
      const cTop = clientRect.top / state.transformScale;
      const pTop = parentRect.top / state.transformScale;

      if (unref(renderRtl)) {
        newPosition.left = (cRight - pRight) * -1;
      } else {
        newPosition.left = cLeft - pLeft;
      }
      newPosition.top = cTop - pTop;
      state.dragging = newPosition;
      state.isDragging = true;
      break;
    }
    case 'dragend': {
      if (!state.isDragging) return;
      const parentRect = event.target.offsetParent.getBoundingClientRect();
      const clientRect = event.target.getBoundingClientRect();

      const cLeft = clientRect.left / state.transformScale;
      const pLeft = parentRect.left / state.transformScale;
      const cRight = clientRect.right / state.transformScale;
      const pRight = parentRect.right / state.transformScale;
      const cTop = clientRect.top / state.transformScale;
      const pTop = parentRect.top / state.transformScale;

      // Add rtl support
      if (unref(renderRtl)) {
        newPosition.left = (cRight - pRight) * -1;
      } else {
        newPosition.left = cLeft - pLeft;
      }
      newPosition.top = cTop - pTop;
      state.dragging = null;
      state.isDragging = false;
      // shouldUpdate = true;
      break;
    }
    case 'dragmove': {
      const coreEvent = createCoreData(state.lastX, state.lastY, x, y);
      //                        Add rtl support
      if (unref(renderRtl)) {
        newPosition.left = state.dragging.left - coreEvent.deltaX / state.transformScale;
      } else {
        newPosition.left = state.dragging.left + coreEvent.deltaX / state.transformScale;
      }
      newPosition.top = state.dragging.top + coreEvent.deltaY / state.transformScale;
      if (state.bounded) {
        const bottomBoundary = event.target.offsetParent.clientHeight - calcGridItemWHPx(props.h, state.rowHeight, state.margin[1]);
        newPosition.top = clamp(newPosition.top, 0, bottomBoundary);
        const colWidth = calcColWidth();
        const rightBoundary = state.containerWidth - calcGridItemWHPx(props.w, colWidth, state.margin[0]);
        newPosition.left = clamp(newPosition.left, 0, rightBoundary);
      }
      state.dragging = newPosition;
      break;
    }
  }
  createStyle();
  // Get new XY
  let pos;
  if (unref(renderRtl)) {
    pos = calcXY(newPosition.top, newPosition.left);
  } else {
    pos = calcXY(newPosition.top, newPosition.left);
  }

  state.lastX = x;
  state.lastY = y;

  if (state.innerX !== pos.x || state.innerY !== pos.y) {
    emit('move', props.i, pos.x, pos.y);
  }
  if (event.type === 'dragend' && (state.previousX !== state.innerX || state.previousY !== state.innerY)) {
    emit('moved', props.i, pos.x, pos.y);
  }
  emitter.emit('dragEvent', [
    event.type, props.i, pos.x, pos.y, state.innerH, state.innerW,
  ]);
}

function calcPosition(x, y, w, h) {
  const colWidth = calcColWidth();
  // add rtl support
  let out;
  if (unref(renderRtl)) {
    out = {
      right: Math.round(colWidth * x + (x + 1) * state.margin[0]),
      top: Math.round(state.rowHeight * y + (y + 1) * state.margin[1]),
      // 0 * Infinity === NaN, which causes problems with resize constriants;
      // Fix this if it occurs.
      // Note we do it here rather than later because Math.round(Infinity) causes deopt
      width: w === Infinity ? w : Math.round(colWidth * w + Math.max(0, w - 1) * state.margin[0]),
      height: h === Infinity ? h : Math.round(state.rowHeight * h + Math.max(0, h - 1) * state.margin[1]),
    };
  } else {
    out = {
      left: Math.round(colWidth * x + (x + 1) * state.margin[0]),
      top: Math.round(state.rowHeight * y + (y + 1) * state.margin[1]),
      // 0 * Infinity === NaN, which causes problems with resize constriants;
      // Fix this if it occurs.
      // Note we do it here rather than later because Math.round(Infinity) causes deopt
      width: w === Infinity ? w : Math.round(colWidth * w + Math.max(0, w - 1) * state.margin[0]),
      height: h === Infinity ? h : Math.round(state.rowHeight * h + Math.max(0, h - 1) * state.margin[1]),
    };
  }

  return out;
}

/**
 * Translate x and y coordinates from pixels to grid units.
 * @param  {Number} top  Top position (relative to parent) in pixels.
 * @param  {Number} left Left position (relative to parent) in pixels.
 * @return {Object} x and y in grid units.
 */
// TODO check if this function needs change in order to support rtl.
function calcXY(top, left) {
  const colWidth = calcColWidth();

  // left = colWidth * x + margin * (x + 1)
  // l = cx + m(x+1)
  // l = cx + mx + m
  // l - m = cx + mx
  // l - m = x(c + m)
  // (l - m) / (c + m) = x
  // x = (left - margin) / (coldWidth + margin)
  let x = Math.round((left - state.margin[0]) / (colWidth + state.margin[0]));
  let y = Math.round((top - state.margin[1]) / (state.rowHeight + state.margin[1]));

  // Capping
  x = Math.max(Math.min(x, state.cols - state.innerW), 0);
  y = Math.max(Math.min(y, state.maxRows - state.innerH), 0);

  return { x, y };
}

// Helper for generating column width
function calcColWidth() {
  const colWidth = (state.containerWidth - (state.margin[0] * (state.cols + 1))) / state.cols;
  return colWidth;
}

// This can either be called:
// calcGridItemWHPx(w, colWidth, margin[0])
// or
// calcGridItemWHPx(h, rowHeight, margin[1])
function calcGridItemWHPx(gridUnits, colOrRowSize, marginPx) {
  // 0 * Infinity === NaN, which causes problems with resize contraints
  if (!Number.isFinite(gridUnits)) return gridUnits;
  return Math.round(
    colOrRowSize * gridUnits + Math.max(0, gridUnits - 1) * marginPx,
  );
}

// Similar to _.clamp
function clamp(num, lowerBound, upperBound) {
  return Math.max(Math.min(num, upperBound), lowerBound);
}

/**
 * Given a height and width in pixel values, calculate grid units.
 * @param  {Number} height Height in pixels.
 * @param  {Number} width  Width in pixels.
 * @param  {Boolean} autoSizeFlag  function autoSize identifier.
 * @return {Object} w, h as grid units.
 */
function calcWH(height, width, autoSizeFlag = false) {
  const colWidth = calcColWidth();

  // width = colWidth * w - (margin * (w - 1))
  // ...
  // w = (width + margin) / (colWidth + margin)
  let w = Math.round((width + state.margin[0]) / (colWidth + state.margin[0]));
  let h = 0;
  if (!autoSizeFlag) {
    h = Math.round((height + state.margin[1]) / (state.rowHeight + state.margin[1]));
  } else {
    h = Math.ceil((height + state.margin[1]) / (state.rowHeight + state.margin[1]));
  }

  // Capping
  w = Math.max(Math.min(w, state.cols - state.innerX), 0);
  h = Math.max(Math.min(h, state.maxRows - state.innerY), 0);
  return { w, h };
}

function updateWidth(width, colNum) {
  state.containerWidth = width;
  if (colNum !== undefined && colNum !== null) {
    state.cols = colNum;
  }
}

function tryMakeDraggable() {
  if (interactObj === null || interactObj === undefined) {
    interactObj = interact(exposeObj.el);
    if (!state.useStyleCursor) {
      interactObj.styleCursor(false);
    }
  }
  if (state.draggable && !props.static) {
    const opts = {
      ignoreFrom: props.dragIgnoreFrom,
      allowFrom: props.dragAllowFrom,
      ...props.dragOption,
    };
    interactObj.draggable(opts);
    /* interactObj.draggable({allowFrom: '.vue-draggable-handle'}); */
    if (!state.dragEventSet) {
      state.dragEventSet = true;
      interactObj.on('dragstart dragmove dragend', (event) => {
        handleDrag(event);
      });
    }
  } else {
    interactObj.draggable({
      enabled: false,
    });
  }
}

function tryMakeResizable() {
  if (interactObj === null || interactObj === undefined) {
    interactObj = interact(exposeObj.el);
    if (!state.useStyleCursor) {
      interactObj.styleCursor(false);
    }
  }
  if (state.resizable && !props.static) {
    const maximum = calcPosition(0, 0, props.maxW, props.maxH);
    const minimum = calcPosition(0, 0, props.minW, props.minH);

    const opts = {
      // allowFrom: "." + unref(resizableHandleClass).trim().replace(" ", "."),
      edges: {
        left: false,
        right: `.${unref(resizableHandleClass).trim().replace(' ', '.')}`,
        bottom: `.${unref(resizableHandleClass).trim().replace(' ', '.')}`,
        top: false,
      },
      ignoreFrom: props.resizeIgnoreFrom,
      restrictSize: {
        min: {
          height: minimum.height * state.transformScale,
          width: minimum.width * state.transformScale,
        },
        max: {
          height: maximum.height * state.transformScale,
          width: maximum.width * state.transformScale,
        },
      },
      ...props.resizeOption,
    };

    if (props.preserveAspectRatio) {
      opts.modifiers = [
        interact.modifiers.aspectRatio({
          ratio: 'preserve',
        }),
      ];
    }

    interactObj.resizable(opts);
    if (!state.resizeEventSet) {
      state.resizeEventSet = true;
      interactObj.on('resizestart resizemove resizeend', (event) => {
        handleResize(event);
      });
    }
  } else {
    interactObj.resizable({
      enabled: false,
    });
  }
}

function setRef(e) {
  exposeObj.el = e;
}

</script>
<template>
  <div :ref="setRef"
    class="vue-grid-item"
    :class="classObj"
    :style="state.style"
    :id="i"
    :key="i"
  >
    <slot :class="{ rtl: renderRtl }"/>
    <span v-if="resizableAndNotStatic"
      :class="resizableHandleClass"
    />
    <!--<span v-if="draggable" ref="dragHandle" class="vue-draggable-handle"></span>-->
  </div>
</template>
<style scoped>
.vue-grid-item {
  transition: all 200ms ease;
  transition-property: left, top, right;
  /* add right for rtl */
}

.vue-grid-item.no-touch {
  touch-action: none;
}

.vue-grid-item.cssTransforms {
  transition-property: transform;
  left: 0;
  right: auto;
}

.vue-grid-item.cssTransforms.render-rtl {
  left: auto;
  right: 0;
}

.vue-grid-item.resizing {
  opacity: 0.6;
  z-index: 3;
}

.vue-grid-item.vue-draggable-dragging {
  transition:none;
  z-index: 3;
}

.vue-grid-item.vue-grid-placeholder {
  background: red;
  opacity: 0.2;
  transition-duration: 100ms;
  z-index: 2;
  user-select: none;
}

.vue-grid-item > .vue-resizable-handle {
  position: absolute;
  width: 20px;
  height: 20px;
  bottom: 0;
  right: 0;
  background: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/Pg08IS0tIEdlbmVyYXRvcjogQWRvYmUgRmlyZXdvcmtzIENTNiwgRXhwb3J0IFNWRyBFeHRlbnNpb24gYnkgQWFyb24gQmVhbGwgKGh0dHA6Ly9maXJld29ya3MuYWJlYWxsLmNvbSkgLiBWZXJzaW9uOiAwLjYuMSAgLS0+DTwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+DTxzdmcgaWQ9IlVudGl0bGVkLVBhZ2UlMjAxIiB2aWV3Qm94PSIwIDAgNiA2IiBzdHlsZT0iYmFja2dyb3VuZC1jb2xvcjojZmZmZmZmMDAiIHZlcnNpb249IjEuMSINCXhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbDpzcGFjZT0icHJlc2VydmUiDQl4PSIwcHgiIHk9IjBweCIgd2lkdGg9IjZweCIgaGVpZ2h0PSI2cHgiDT4NCTxnIG9wYWNpdHk9IjAuMzAyIj4NCQk8cGF0aCBkPSJNIDYgNiBMIDAgNiBMIDAgNC4yIEwgNCA0LjIgTCA0LjIgNC4yIEwgNC4yIDAgTCA2IDAgTCA2IDYgTCA2IDYgWiIgZmlsbD0iIzAwMDAwMCIvPg0JPC9nPg08L3N2Zz4=');
  background-position: bottom right;
  padding: 0 3px 3px 0;
  background-repeat: no-repeat;
  background-origin: content-box;
  box-sizing: border-box;
  cursor: se-resize;
}

.vue-grid-item > .vue-rtl-resizable-handle {
  bottom: 0;
  left: 0;
  background: url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAuMDAwMDAwMDAwMDAwMDAyIiBoZWlnaHQ9IjEwLjAwMDAwMDAwMDAwMDAwMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KIDwhLS0gQ3JlYXRlZCB3aXRoIE1ldGhvZCBEcmF3IC0gaHR0cDovL2dpdGh1Yi5jb20vZHVvcGl4ZWwvTWV0aG9kLURyYXcvIC0tPgogPGc+CiAgPHRpdGxlPmJhY2tncm91bmQ8L3RpdGxlPgogIDxyZWN0IGZpbGw9Im5vbmUiIGlkPSJjYW52YXNfYmFja2dyb3VuZCIgaGVpZ2h0PSIxMiIgd2lkdGg9IjEyIiB5PSItMSIgeD0iLTEiLz4KICA8ZyBkaXNwbGF5PSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgeT0iMCIgeD0iMCIgaGVpZ2h0PSIxMDAlIiB3aWR0aD0iMTAwJSIgaWQ9ImNhbnZhc0dyaWQiPgogICA8cmVjdCBmaWxsPSJ1cmwoI2dyaWRwYXR0ZXJuKSIgc3Ryb2tlLXdpZHRoPSIwIiB5PSIwIiB4PSIwIiBoZWlnaHQ9IjEwMCUiIHdpZHRoPSIxMDAlIi8+CiAgPC9nPgogPC9nPgogPGc+CiAgPHRpdGxlPkxheWVyIDE8L3RpdGxlPgogIDxsaW5lIGNhbnZhcz0iI2ZmZmZmZiIgY2FudmFzLW9wYWNpdHk9IjEiIHN0cm9rZS1saW5lY2FwPSJ1bmRlZmluZWQiIHN0cm9rZS1saW5lam9pbj0idW5kZWZpbmVkIiBpZD0ic3ZnXzEiIHkyPSItNzAuMTc4NDA3IiB4Mj0iMTI0LjQ2NDE3NSIgeTE9Ii0zOC4zOTI3MzciIHgxPSIxNDQuODIxMjg5IiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlPSIjMDAwIiBmaWxsPSJub25lIi8+CiAgPGxpbmUgc3Ryb2tlPSIjNjY2NjY2IiBzdHJva2UtbGluZWNhcD0idW5kZWZpbmVkIiBzdHJva2UtbGluZWpvaW49InVuZGVmaW5lZCIgaWQ9InN2Z181IiB5Mj0iOS4xMDY5NTciIHgyPSIwLjk0NzI0NyIgeTE9Ii0wLjAxODEyOCIgeDE9IjAuOTQ3MjQ3IiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz4KICA8bGluZSBzdHJva2UtbGluZWNhcD0idW5kZWZpbmVkIiBzdHJva2UtbGluZWpvaW49InVuZGVmaW5lZCIgaWQ9InN2Z183IiB5Mj0iOSIgeDI9IjEwLjA3MzUyOSIgeTE9IjkiIHgxPSItMC42NTU2NCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2U9IiM2NjY2NjYiIGZpbGw9Im5vbmUiLz4KIDwvZz4KPC9zdmc+);
  background-position: bottom left;
  padding-left: 3px;
  background-repeat: no-repeat;
  background-origin: content-box;
  cursor: sw-resize;
  right: auto;
}

.vue-grid-item.disable-userselect {
  user-select: none;
}
</style>

