export interface TableColumnType<T = any> {
  title: string;
  dataIndex?: keyof T | string;
  key?: string;
  width?: number;
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
