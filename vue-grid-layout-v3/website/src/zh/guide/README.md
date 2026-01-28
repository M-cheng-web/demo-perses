# 安装

## NPM

	npm install vue-grid-layout-v3 --save

## Yarn

    yarn add vue-grid-layout-v3


导入库

```javascript
    import VueGridLayout from 'vue-grid-layout-v3';
```

添加到其他Vue组件

 ```javascript
    export default {
        components: {
            GridLayout: VueGridLayout.GridLayout,
            GridItem: VueGridLayout.GridItem
        },
    // ... data, methods, mounted (), etc.
    }

```

## 浏览器

包括可用于浏览器的软件包（[从发布版本](https://github.com/merfais/vue-grid-layout-v3/releases)下载）。组件将自动可用。

```html
    <script src="vue-grid-layout-v3.umd.min.js"></script>
```

