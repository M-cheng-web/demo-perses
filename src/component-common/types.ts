export type Key = string | number;

export interface TablePaginationConfig {
  current?: number;
  pageSize?: number;
  total?: number;
  showTotal?: (total: number) => string;
  showSizeChanger?: boolean;
  pageSizeOptions?: Array<string | number>;
  size?: 'small' | 'middle';
  hideOnSinglePage?: boolean;
}

export interface TableColumnType<RecordType = any> {
  title?: string;
  dataIndex?: string;
  key?: string;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  sorter?: boolean | ((a: RecordType, b: RecordType) => number);
  ellipsis?: boolean;
}

export interface TableScrollConfig {
  y?: string | number;
}

export interface TableProps<RecordType = any> {
  columns?: TableColumnType<RecordType>[];
  dataSource?: RecordType[];
  loading?: boolean;
  pagination?: false | TablePaginationConfig;
  size?: 'small' | 'middle' | 'large';
  rowKey?: string | ((record: RecordType) => Key);
  scroll?: TableScrollConfig;
  onChange?: (pagination?: TablePaginationConfig) => void;
}
