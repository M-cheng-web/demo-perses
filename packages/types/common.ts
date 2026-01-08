/**
 * 通用类型定义
 */

/**
 * ID 类型
 */
export type ID = string;

/**
 * 时间戳类型（毫秒）
 */
export type Timestamp = number;

/**
 * 键值对类型
 */
export type KeyValue<T = string> = Record<string, T>;

/**
 * 可选字段
 */
export type Optional<T> = T | undefined;

/**
 * 可为空字段
 */
export type Nullable<T> = T | null;

/**
 * 深度部分类型
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * 值或值数组
 */
export type ValueOrArray<T> = T | T[];
