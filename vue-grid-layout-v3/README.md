<p align="center">
  <a href="https://merfais.github.io/vue-grid-layout-v3/" target="_blank" rel="noopener noreferrer">
    <img width="100" src="https://merfais.github.io/vue-grid-layout-v3/logo.png" alt="Vue Grid Layout">
  </a>
</p>

<h1 align="center">vue-grid-layout-v3</h1>

<p align="center">
<a href="https://www.npmjs.com/package/vue-grid-layout-v3">
    <img src="https://img.shields.io/npm/v/vue-grid-layout-v3.svg"/>
    <img src="https://img.shields.io/npm/dm/vue-grid-layout-v3.svg"/>
</a>
<a href="https://github.com/merfais/vue-grid-layout-v3/releases">
    <img src="https://img.shields.io/github/size/merfais/vue-grid-layout-v3/dist/vue-grid-layout-v3.js"/>
</a>
<!--a href="https://vuejs.org/">
    <img src="https://img.shields.io/badge/vue-2.2.x-brightgreen.svg"/>
</a-->
</p>
<h2 align="center">
<a href="https://merfais.github.io/vue-grid-layout-v3/" target="_blank">Documentation Website</a>
</h2>

## What is Vue Grid Layout?

vue-grid-layout is a grid layout system, like [Gridster](http://dsmorse.github.io/gridster.js/), for Vue.js. **Heavily inspired by [React-Grid-Layout](https://github.com/STRML/react-grid-layout)**

## Features

* Draggable widgets
* Resizable widgets
* Static widgets
* Bounds checking for dragging and resizing
* Widgets may be added or removed without rebuilding grid
* Layout can be serialized and restored
* Automatic RTL support (resizing not working with RTL on 2.2.0)
* Responsive

## **Current version:** 3.1.0 (Supports Vue 3.2+)

#### **upgrading from version 3.0 to version 3.1 has some break change**
  + GridLayout expose changed: `{ placeholderRef, emitter }` -> `{ el, placeholderEl, emitter, placeholder }`
  + GridItem expose changed: `{ calcXY, domRef }` -> `{ calcXY, el }`

#### **For legacy browsers**, like IE11, use version [2.3.12-legacy](https://github.com/jbaysolutions/vue-grid-layout/tree/legacy)
#### **For Vue 2.1.10+ use version [2.4.0](https://github.com/jbaysolutions/vue-grid-layout/tree/2.4.0)**
#### **For Vue 2.1.10 and below use version [2.1.3](https://github.com/jbaysolutions/vue-grid-layout/tree/2.1.3)**
#### **For Vue 1 use version [1.0.3](https://github.com/jbaysolutions/vue-grid-layout/tree/1.0.3)**

## Documentation

Check out the <a href="https://merfais.github.io/vue-grid-layout-v3/" target="_blank">Documentation Website</a>

<!--
Chinese documentation: [简体中文](./README-zh_CN.md)
-->

## Contribute

If you have a feature request, please add it as an issue or make a pull request.


3.0 version Developed by <a href="https://github.com/merfais">CoffeeBi</a>

Developed by <a href="https://www.jbaysolutions.com">JBay Solutions</a>
