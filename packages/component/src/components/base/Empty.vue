<!-- 组件说明：空状态占位，显示图标与提示文案 (AntD-inspired) -->
<template>
  <div :class="[bem(), { 'is-simple': image === 'simple' }]">
    <div :class="bem('image')">
      <slot name="image">
        <svg v-if="image === 'simple'" width="56" height="40" viewBox="0 0 56 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="28" cy="34" rx="18" ry="4" fill="currentColor" fill-opacity="0.08" stroke="none" />
            <rect x="8" y="8" width="40" height="24" rx="6" stroke-width="1.5" opacity="0.5" />
            <path d="M8 16h40" stroke-width="1.5" opacity="0.32" />
            <path d="M20 24h16" stroke-width="1.5" opacity="0.4" />
            <circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none" opacity="0.36" />
          </g>
        </svg>
        <svg v-else width="120" height="96" viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="60" cy="82" rx="32" ry="7" fill="currentColor" fill-opacity="0.08" stroke="none" />
            <rect x="22" y="14" width="76" height="54" rx="10" stroke-width="1.6" opacity="0.5" />
            <path d="M22 29h76" stroke-width="1.6" opacity="0.32" />
            <path d="M36 45h20" stroke-width="1.6" opacity="0.42" />
            <path d="M36 55h30" stroke-width="1.6" opacity="0.32" />
            <circle cx="32" cy="21.5" r="1.6" fill="currentColor" stroke="none" opacity="0.34" />
            <circle cx="39" cy="21.5" r="1.6" fill="currentColor" stroke="none" opacity="0.22" />
          </g>
        </svg>
      </slot>
    </div>
    <div :class="bem('description')">
      <slot name="description">{{ description || '暂无数据' }}</slot>
    </div>
    <div v-if="$slots.default" :class="bem('footer')">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfEmpty' });

  withDefaults(
    defineProps<{
      /** 自定义空状态描述 */
      description?: string;
      /** 图片类型 */
      image?: 'default' | 'simple';
    }>(),
    {
      description: '',
      image: 'default',
    }
  );

  const [_, bem] = createNamespace('empty');
</script>

<style scoped lang="less">
  .gf-empty {
    margin: 24px 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;

    &__image {
      height: 84px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gf-color-text-tertiary);

      svg {
        max-width: 100%;
        height: auto;
      }
    }

    &.is-simple &__image {
      height: 36px;
    }

    &__description {
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      color: var(--gf-color-text-tertiary);
    }

    &__footer {
      margin-top: 16px;
    }
  }
</style>
