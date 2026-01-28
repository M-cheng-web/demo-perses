---
aside: true
---
# Installation

## NPM

```shell
npm install vue-grid-layout-v3 --save
```

## Yarn

```shell
yarn add vue-grid-layout-v3
```


# Import the library

## Global Registration

```javascript
import { createApp } from 'vue'
import VueGridLayout from 'vue-grid-layout-v3';

const app = createApp({
    // ...
})
// register GridLayout and GridItem component
app.use(VueGridLayout)
app.mount('#app')

/**
 * // custom component name
 * import { createApp } from 'vue'
 * import { GridLayout, GridItem } from 'vue-grid-layout-v3';
 *
 * const app = createApp({
 *     // ...
 * })
 * app.component('MyGridLayout', GridLayout)
 * app.component('MyGridItem', GridLayout)
 * app.mount('#app')
 */

```

## Local Registration
When using SFC with `<script setup>`, imported components can be locally used without registration:

```html
<script setup>
import { GridLayout, GridItem } from 'vue-grid-layout-v3'
</script>

<template>
    <GridLayout>
        <GridItem />
    </GridLayout>
</template>
```
In non-`<script setup>`, you will need to use the components option:
```javascript
import { GridLayout, GridItem } from 'vue-grid-layout-v3'

export default {
    components: {
        GridLayout,
        GridItem,
    },
    setup() {
        // ...
    }
}
```

## browser
download from [releases](https://github.com/merfais/vue-grid-layout-v3/releases),
choose the appropriate format package, `dist/vue-grid-layout-v3.umd.js` is more suitable in most cases.
upload this file to CDN or put it on your static web server,
then include it in your page.

for example, we are using [unpkg](https://unpkg.com/)
```html
<script src="https://www.unpkg.com/vue@3.5.13/dist/vue.global.js"></script>
<script src="https://www.unpkg.com/vue-grid-layout-v3@3.1.1/dist/vue-grid-layout-v3.umd.js"></script>
<body>
    <div id="app">
        <grid-layout v-model:layout="layout">
            <grid-item
                v-for="(item, index) in layout"
                :key="index"
                :static="item.static"
                :x="item.x"
                :y="item.y"
                :w="item.w"
                :h="item.h"
                :i="item.i"
            >
                <span class="text">{{itemTitle(item)}}</span>
            </grid-item>
        </grid-layout>
    </div>
</body>
<script>
    const { createApp, ref } = window.Vue

    const app = createApp({
      components: {
        GridItem: window.VueGridLayout.GridItem,
        GridLayout: window.VueGridLayout.GridLayout,
      },
      setup() {
        const layout = [
          { x: 0, y: 0, w: 2, h: 2, i: '0', static: false },
          { x: 2, y: 0, w: 2, h: 4, i: '1', static: true },
          { x: 4, y: 0, w: 2, h: 5, i: '2', static: false },
          { x: 6, y: 0, w: 2, h: 3, i: '3', static: false },
          { x: 8, y: 0, w: 2, h: 3, i: '4', static: false },
          { x: 10, y: 0, w: 2, h: 3, i: '5', static: false },
          { x: 0, y: 5, w: 2, h: 5, i: '6', static: false },
          { x: 2, y: 5, w: 2, h: 5, i: '7', static: false },
          { x: 4, y: 5, w: 2, h: 5, i: '8', static: false },
          { x: 6, y: 3, w: 2, h: 4, i: '9', static: true },
          { x: 8, y: 4, w: 2, h: 4, i: '10', static: false },
          { x: 10, y: 4, w: 2, h: 4, i: '11', static: false },
          { x: 0, y: 10, w: 2, h: 5, i: '12', static: false },
          { x: 2, y: 10, w: 2, h: 5, i: '13', static: false },
          { x: 4, y: 8, w: 2, h: 4, i: '14', static: false },
          { x: 6, y: 8, w: 2, h: 4, i: '15', static: false },
          { x: 8, y: 10, w: 2, h: 5, i: '16', static: false },
          { x: 10, y: 4, w: 2, h: 2, i: '17', static: false },
          { x: 0, y: 9, w: 2, h: 3, i: '18', static: false },
          { x: 2, y: 6, w: 2, h: 2, i: '19', static: false },
        ]
        function itemTitle(item) {
          let result = item.i;
          if (item.static) {
              result += ' - Static';
          }
          return result;
        }
        return {
          layout,
          itemTitle,
        }
      }
    })

    // global registration
    // app.use(window.VueGridLayout)

    app.mount('#app')
  </script>
```

