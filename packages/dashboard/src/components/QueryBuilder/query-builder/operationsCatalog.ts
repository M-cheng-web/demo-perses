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
 * Build cascader options for PromQL operations.
 *
 * Notes:
 * - Filters out `hideFromList` operations
 * - Removes empty categories
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
