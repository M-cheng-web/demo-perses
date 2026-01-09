/**
 * vue-grid-layout-v3 类型声明
 */

declare module 'vue-grid-layout-v3' {
  import { DefineComponent } from 'vue';

  export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    static?: boolean;
  }

  export interface GridLayoutProps {
    layout: Layout[];
    colNum?: number;
    rowHeight?: number;
    maxRows?: number;
    margin?: [number, number];
    isDraggable?: boolean;
    isResizable?: boolean;
    isMirrored?: boolean;
    autoSize?: boolean;
    verticalCompact?: boolean;
    preventCollision?: boolean;
    useCssTransforms?: boolean;
    responsive?: boolean;
    breakpoints?: Record<string, number>;
    cols?: Record<string, number>;
  }

  export interface GridItemProps {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    static?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
  }

  export const GridLayout: DefineComponent<GridLayoutProps>;
  export const GridItem: DefineComponent<GridItemProps>;
}
