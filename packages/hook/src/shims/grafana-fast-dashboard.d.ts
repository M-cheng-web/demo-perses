declare module '@grafana-fast/dashboard' {
  import type { DefineComponent } from 'vue';

  export const useDashboardStore: any;
  export const useTimeRangeStore: any;
  export const useTooltipStore: any;

  export type MousePosition = any;
  export type TooltipData = any;

  export const DashboardView: DefineComponent<any, any, any>;
  export default DashboardView;
}

