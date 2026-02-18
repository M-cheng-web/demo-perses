/**
 * contracts 统一导出
 *
 * 说明：
 * - 这里集中导出所有“契约层接口”
 * - 宿主应用/核心包应优先依赖 contracts，而不是直接依赖某个实现文件
 */
export * from './apiClient';
export * from './dashboard';
export * from './query';
export * from './variable';
