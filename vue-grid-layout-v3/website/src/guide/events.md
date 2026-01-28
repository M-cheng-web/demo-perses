---
aside: true
---
# Events

Move and resize event listeners can be added to each grid-item, so that the parent Vue can be notified when a grid element is being moved or resized.
Moved and resized event listeners can be added, if the only notification needed is when an item is finished moving or resizing.

Working example [here](../guide/02-events.md)

````html
<GridLayout
    v-model:layout="state.layout"
    :col-num="12"
    :row-height="30"
    :is-draggable="state.draggable"
    :is-resizable="state.resizable"
    :vertical-compact="true"
    :use-css-transforms="true"
    @layout-created="layoutCreatedEvent"
    @layout-before-mount="layoutBeforeMountEvent"
    @layout-mounted="layoutMountedEvent"
    @layout-ready="layoutReadyEvent"
    @layout-updated="layoutUpdatedEvent"
>
    <GridItem
        v-for="item in state.layout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
        @resize="resizeEvent"
        @move="moveEvent"
        @resized="resizedEvent"
        @container-resized="containerResizedEvent"
        @moved="movedEvent"
    >
        <span class="text">{{item.i}}</span>
    </GridItem>
</GridLayout>
````

## GridLayout

### update:layout

sync layout by v-model:layout. same as layout-updated

```html
<GridLayout
    v-model:layout="state.layout"
>
    <GridItem />
</GridLayout>
```
### layout-created

Layout created event

Emited on the component created lifecycle hook

```javascript
function layoutCreatedEvent(newLayout){
  console.log("Created layout: ", newLayout)
}
```

### layout-before-mount

Layout beforeMount event

Emited on the component beforeMount lifecycle hook

```javascript
function layoutBeforeMountEvent(newLayout){
  console.log("beforeMount layout: ", newLayout)
}
```

### layout-mounted

Layout mounted event

Emited on the component mounted lifecycle hook

```javascript
function layoutMountedEvent(newLayout){
  console.log("Mounted layout: ", newLayout)
}
```

### layout-ready

Layout ready event

Emited when all the operations on the mount hook finish

```javascript
function layoutReadyEvent(newLayout){
  console.log("Ready layout: ", newLayout)
}
```

### layout-updated

Layout updated event

Every time the layout has finished updating and positions of all grid-items are recalculated

```javascript
function layoutUpdatedEvent(newLayout){
  console.log("Updated layout: ", newLayout)
}
```


### breakpoint-changed

Breakpoint Changed event

Every time the breakpoint value changes due to window resize

```javascript
/**
 *
 * @param newBreakpoint the breakpoint name
 * @param newLayout the chosen layout for the breakpoint
 *
 */
function breakpointChangedEvent(newBreakpoint, newLayout){
    console.log("BREAKPOINT CHANGED breakpoint=", newBreakpoint, ", layout: ", newLayout );
},
```


## GridItem

### move

Move event

Every time an item is being moved and changes position

```javascript
function moveEvent(i, newX, newY){
    console.log("MOVE i=" + i + ", X=" + newX + ", Y=" + newY);
},
```

### moved

Moved event

Every time an item is finished being moved and changes position

```javascript
function movedEvent(i, newX, newY){
    console.log("MOVED i=" + i + ", X=" + newX + ", Y=" + newY);
},
```

### resize

Resize event

Every time an item is being resized and changes size

```javascript
function resizeEvent(i, newH, newW, newHPx, newWPx){
    console.log("RESIZE i=" + i + ", H=" + newH + ", W=" + newW + ", H(px)=" + newHPx + ", W(px)=" + newWPx);
},
```

### resized

Resized event

Every time an item is finished being resized and changes size

```javascript
/**
 *
 * @param i the item id/index
 * @param newH new height in grid rows
 * @param newW new width in grid columns
 * @param newHPx new height in pixels
 * @param newWPx new width in pixels
 *
 */
function resizedEvent(i, newH, newW, newHPx, newWPx){
    console.log("RESIZED i=" + i + ", H=" + newH + ", W=" + newW + ", H(px)=" + newHPx + ", W(px)=" + newWPx);
},
```

### container-resized

Container Resized event

Every time the grid item/layout container changes size (browser window or other)

```javascript
/**
 *
 * @param i the item id/index
 * @param newH new height in grid rows
 * @param newW new width in grid columns
 * @param newHPx new height in pixels
 * @param newWPx new width in pixels
 *
 */
function containerResizedEvent(i, newH, newW, newHPx, newWPx){
    console.log("CONTAINER RESIZED i=" + i + ", H=" + newH + ", W=" + newW + ", H(px)=" + newHPx + ", W(px)=" + newWPx);
},
```

