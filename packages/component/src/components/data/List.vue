<!-- 组件说明：通用列表，用于 key-value / 行集合 / 网格卡片等展示，支持按 item.key 定位的插槽 -->
<template>
  <div
    :class="[
      bem(),
      bem({ [`variant-${variant}`]: true, [`size-${size}`]: true }),
      { 'is-bordered': bordered, 'is-split': split, 'is-striped': striped, 'is-hoverable': hoverable },
    ]"
  >
    <div v-if="!items.length" :class="bem('empty')">
      <slot name="empty">暂无数据</slot>
    </div>

    <div v-else :class="bem('body')" :style="variant === 'grid' ? gridStyle : undefined">
      <div v-for="(item, index) in items" :key="resolveItemKey(item, index)" :class="bem('item')">
        <slot name="item" :item="item" :index="index" :label="getLabel(item)" :value="getValue(item)" :slotName="getItemSlotName(item, index)">
          <div v-if="variant === 'grid'" :class="bem('card')">
            <slot
              v-if="$slots[getItemSlotName(item, index)]"
              :name="getItemSlotName(item, index)"
              :value="getValue(item)"
              :item="item"
              :index="index"
            ></slot>
            <template v-else>
              <div :class="bem('gridTitle')">
                <slot v-if="$slots.label" name="label" :value="getLabel(item)" :item="item" :index="index">
                  {{ getLabel(item) }}
                </slot>
                <template v-else>{{ getLabel(item) }}</template>
              </div>
              <div :class="bem('gridValue')">
                <slot v-if="$slots.value" name="value" :value="getValue(item)" :item="item" :index="index">
                  {{ formatValue(getValue(item)) }}
                </slot>
                <template v-else>{{ formatValue(getValue(item)) }}</template>
              </div>
            </template>
          </div>

          <div v-else :class="bem('row')">
            <div :class="bem('label')">
              <slot v-if="$slots.label" name="label" :value="getLabel(item)" :item="item" :index="index">
                {{ getLabel(item) }}
              </slot>
              <template v-else>{{ getLabel(item) }}</template>
            </div>
            <div :class="bem('value')">
              <slot
                v-if="$slots[getItemSlotName(item, index)]"
                :name="getItemSlotName(item, index)"
                :value="getValue(item)"
                :item="item"
                :index="index"
              ></slot>
              <slot v-else-if="$slots.value" name="value" :value="getValue(item)" :item="item" :index="index">
                {{ formatValue(getValue(item)) }}
              </slot>
              <template v-else>{{ formatValue(getValue(item)) }}</template>
            </div>
          </div>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';

  export type ListVariant = 'kv' | 'lines' | 'grid';
  export type ListSize = 'small' | 'middle';

  defineOptions({ name: 'GfList' });

  const props = withDefaults(
    defineProps<{
      items: any[];
      /** kv：带面板感的两列；lines：无外边框的行集合；grid：网格卡片 */
      variant?: ListVariant;
      size?: ListSize;
      /** kv/grid 外观边框（lines 模式下无效） */
      bordered?: boolean;
      /** kv/lines 纵向分隔（label/value 之间） */
      split?: boolean;
      striped?: boolean;
      hoverable?: boolean;
      /** grid 列数 */
      columns?: number;
      /** item key 同时用于 v-for key 和插槽名 */
      itemKey?: string | ((item: any, index: number) => string | number);
      /** label 字段名（默认 label） */
      labelKey?: string;
      /** value 字段名（默认 value） */
      valueKey?: string;
    }>(),
    {
      items: () => [],
      variant: 'kv',
      size: 'middle',
      bordered: true,
      split: true,
      striped: false,
      hoverable: false,
      columns: 2,
      itemKey: undefined,
      labelKey: 'label',
      valueKey: 'value',
    }
  );

  const [_, bem] = createNamespace('list');

  const gridStyle = computed(() => ({ gridTemplateColumns: `repeat(${Math.max(1, props.columns)}, minmax(0, 1fr))` }));

  const resolveItemKey = (item: any, index: number) => {
    if (typeof props.itemKey === 'function') return props.itemKey(item, index);
    if (typeof props.itemKey === 'string') return item?.[props.itemKey] ?? index;
    return item?.key ?? index;
  };

  const getItemSlotName = (item: any, index: number) => String(resolveItemKey(item, index));

  const getLabel = (item: any) => {
    const key = props.labelKey;
    const label = key ? item?.[key] : undefined;
    return label ?? item?.label ?? item?.key ?? '-';
  };

  const getValue = (item: any) => {
    const key = props.valueKey;
    return key ? item?.[key] : item?.value;
  };

  const formatValue = (value: any) => {
    if (value == null) return '-';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };
</script>

<style scoped lang="less">
  .gf-list {
    --gf-list-pad-x: var(--gf-space-4);
    --gf-list-pad-y: var(--gf-space-3);
    --gf-list-gap: var(--gf-space-2);
    --gf-list-border: var(--gf-color-border-muted);

    display: flex;
    flex-direction: column;
    width: 100%;
    color: var(--gf-color-text);

    &--size-small {
      --gf-list-pad-x: var(--gf-space-3);
      --gf-list-pad-y: var(--gf-space-2);
      --gf-list-gap: var(--gf-space-1);
    }

    &__empty {
      padding: var(--gf-list-pad-y) var(--gf-list-pad-x);
      color: var(--gf-color-text-tertiary);
      background: var(--gf-color-surface);
      border: 1px dashed var(--gf-list-border);
      border-radius: var(--gf-radius-md);
    }

    &__body {
      display: flex;
      flex-direction: column;
      gap: var(--gf-list-gap);
    }

    &__row {
      display: grid;
      grid-template-columns: minmax(120px, 240px) minmax(0, 1fr);
      align-items: center;
      gap: var(--gf-list-gap);
      padding: var(--gf-list-pad-y) var(--gf-list-pad-x);
      transition:
        box-shadow var(--gf-motion-normal) var(--gf-easing),
        border-color var(--gf-motion-normal) var(--gf-easing),
        background var(--gf-motion-normal) var(--gf-easing);
    }

    &__label {
      color: var(--gf-color-text-secondary);
      white-space: nowrap;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &__value {
      text-align: right;
      word-break: break-all;
      min-width: 0;
    }

    &--variant-kv {
      &.is-bordered {
        .gf-list__row {
          background: var(--gf-color-surface);
          border: 1px solid var(--gf-list-border);
          border-radius: var(--gf-radius-md);
        }
      }

      &.is-split {
        .gf-list__value {
          border-left: 1px solid var(--gf-color-border-muted);
          padding-left: var(--gf-list-pad-x);
        }
      }

      &.is-hoverable {
        .gf-list__row:hover {
          border-color: var(--gf-color-border-strong);
          box-shadow: var(--gf-shadow-1);
        }
      }

      &.is-striped {
        .gf-list__item:nth-child(even) {
          .gf-list__row {
            background: var(--gf-color-zebra);
          }
        }
      }
    }

    &--variant-lines {
      .gf-list__body {
        gap: 0;
      }

      .gf-list__item + .gf-list__item {
        border-top: 1px solid var(--gf-color-border-muted);
      }

      &.is-split {
        .gf-list__value {
          border-left: 1px solid var(--gf-color-border-muted);
          padding-left: var(--gf-list-pad-x);
        }
      }

      &.is-hoverable {
        .gf-list__row:hover {
          background: var(--gf-color-surface-muted);
        }
      }

      &.is-striped {
        .gf-list__item:nth-child(even) {
          .gf-list__row {
            background: var(--gf-color-zebra);
          }
        }
      }
    }

    &--variant-grid {
      .gf-list__body {
        display: grid;
        gap: var(--gf-space-3);
      }

      .gf-list__card {
        padding: var(--gf-list-pad-y) var(--gf-list-pad-x);
        border-radius: var(--gf-radius-md);
        background: var(--gf-color-surface);
        border: 1px solid var(--gf-list-border);
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        transition:
          box-shadow var(--gf-motion-normal) var(--gf-easing),
          border-color var(--gf-motion-normal) var(--gf-easing);
      }

      &.is-hoverable {
        .gf-list__card:hover {
          border-color: var(--gf-color-border-strong);
          box-shadow: var(--gf-shadow-1);
        }
      }

      &.is-bordered {
        .gf-list__card {
          border-color: var(--gf-color-border);
        }
      }

      .gf-list__gridTitle {
        font-weight: 650;
        color: var(--gf-color-text);
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .gf-list__gridValue {
        color: var(--gf-color-text-secondary);
        word-break: break-word;
      }

      .gf-list__label,
      .gf-list__value {
        display: none;
      }
    }
  }
</style>
