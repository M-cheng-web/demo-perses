/**
 * production mode（`pnpm dev:prod` / `pnpm build`）下的样式入口（显式引入各包 dist 产物的 CSS）。
 *
 * 背景：
 * - 本仓库的 component/dashboard 在 library mode 下会把 Less/SFC 样式抽取为独立的 `.css` 文件；
 * - 当 packages/app 以 production mode 消费各包 dist 时，需要显式把这些 CSS 纳入 Vite module graph，
 *   否则页面能渲染但缺少主题/控件样式（看起来像“样式没有挂载”）。
 */
import '../../component/dist/component.css';
import '../../dashboard/dist/dashboard.css';
