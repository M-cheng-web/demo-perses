/**
 * QueryBuilder 操作目录：生成 PromQL 操作的级联选择（分类 -> 操作）。
 */
import { promQueryModeller } from '@grafana-fast/utils';

export interface OperationCascaderOption {
  value: string;
  label: string;
  children: Array<{
    value: string;
    label: string;
  }>;
}

/**
 * 生成 PromQL 操作的 Cascader 选项（按分类分组）。
 *
 * 说明：
 * - 过滤 `hideFromList` 的操作
 * - 自动剔除空分类
 */
export function getOperationCascaderOptions(): OperationCascaderOption[] {
  const categories = promQueryModeller.getCategories();

  return categories
    .map((category) => {
      const ops = promQueryModeller.getOperationsForCategory(category);
      return {
        value: category,
        label: category,
        children: ops
          .filter((op) => !op.hideFromList)
          .map((op) => ({
            value: op.id,
            label: op.name,
          })),
      };
    })
    .filter((category) => category.children.length > 0);
}
