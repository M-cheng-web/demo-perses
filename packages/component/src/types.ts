export interface TableColumnType<T = any> {
  title: string;
  dataIndex?: Extract<keyof T, string> | string;
  key?: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  ellipsis?: boolean;
  sorter?: (a: T, b: T) => number;
}

export interface TablePaginationConfig {
  pageSize?: number;
  current?: number;
  total?: number;
  pageSizeOptions?: string[];
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: (total: number) => string;
  hideOnSinglePage?: boolean;
}

export interface TableProps<T = any> {
  columns?: TableColumnType<T>[];
  dataSource?: T[];
  pagination?: TablePaginationConfig | false;
  loading?: boolean;
  rowKey?: (record: T) => string | number;
  onChange?: (pagination: TablePaginationConfig) => void;
}

export type GfFormRuleTrigger = 'change' | 'blur' | 'submit';

export interface GfFormRule {
  required?: boolean;
  message?: string;
  min?: number;
  max?: number;
  pattern?: RegExp;
  validator?: (value: any, model?: Record<string, any>) => boolean | string | Promise<boolean | string>;
  trigger?: GfFormRuleTrigger | GfFormRuleTrigger[];
}

export type GfFormRules = Record<string, GfFormRule | GfFormRule[]>;
