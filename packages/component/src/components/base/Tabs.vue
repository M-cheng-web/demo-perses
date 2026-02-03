<!-- 组件说明：选项卡容器，管理 TabPane 的切换与注册 (AntD-inspired) -->
<template>
  <div :class="[bem(), bem({ [`type-${type}`]: true, [`size-${size}`]: true })]">
    <div :class="bem('nav')" ref="navRef">
      <div
        v-for="tab in panes"
        :key="tab.key"
        :ref="(el) => setTabRef(el, tab.key)"
        :class="[bem('tab'), { 'is-active': tab.key === current, 'is-disabled': tab.disabled }]"
        @click="handleTabClick(tab)"
      >
        <span v-if="tab.icon" :class="bem('tab-icon')">
          <component :is="tab.icon" />
        </span>
        <span>{{ tab.label }}</span>
      </div>
      <div v-if="type === 'line'" :class="bem('ink-bar')" :style="inkBarStyle"></div>
    </div>
    <div :class="bem('content')">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { provide, reactive, ref, watch, nextTick, onMounted } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfTabs' });

  const props = withDefaults(
    defineProps<{
      /** 当前激活的标签键值 */
      activeKey?: string;
      /** 标签页类型 */
      type?: 'line' | 'card';
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
    }>(),
    {
      activeKey: undefined,
      type: 'line',
      size: 'middle',
    }
  );

  const emit = defineEmits<{
    (e: 'update:activeKey', key: string): void;
    (e: 'change', key: string): void;
  }>();

  const [_, bem] = createNamespace('tabs');
  const panes = reactive<{ key: string; label: string; icon?: any; disabled?: boolean }[]>([]);
  const current = ref(props.activeKey || '');
  const navRef = ref<HTMLElement>();
  const tabRefs = new Map<string, HTMLElement>();
  const inkBarStyle = ref<Record<string, string>>({});

  const setTabRef = (el: any, key: string) => {
    if (el) {
      tabRefs.set(key, el as HTMLElement);
    }
  };

  const updateInkBar = async () => {
    await nextTick();
    const nav = navRef.value;
    const activeTab = tabRefs.get(current.value);
    if (!nav || !activeTab) {
      inkBarStyle.value = { width: '0', transform: 'translateX(0)' };
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    inkBarStyle.value = {
      width: `${tabRect.width}px`,
      transform: `translateX(${tabRect.left - navRect.left}px)`,
    };
  };

  const handleTabClick = (tab: { key: string; disabled?: boolean }) => {
    if (tab.disabled) return;
    setActive(tab.key);
  };

  const setActive = (key: string) => {
    current.value = key;
    emit('update:activeKey', key);
    emit('change', key);
    updateInkBar();
  };

  watch(
    () => props.activeKey,
    (val) => {
      if (val && val !== current.value) {
        current.value = val;
        updateInkBar();
      }
    }
  );

  onMounted(() => {
    updateInkBar();
  });

  provide('gf-tabs-register', (pane: { key: string; label: string; icon?: any; disabled?: boolean }) => {
    if (!panes.find((p) => p.key === pane.key)) {
      panes.push(pane);
    }
    if (!current.value) {
      setActive(pane.key);
    }
  });

  provide('gf-tabs-unregister', (key: string) => {
    const index = panes.findIndex((p) => p.key === key);
    if (index !== -1) panes.splice(index, 1);
  });

  provide('gf-tabs-active', current);
</script>

<style scoped lang="less">
  .gf-tabs {
    display: flex;
    flex-direction: column;

    &__nav {
      position: relative;
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--gf-color-border);
      margin-bottom: 16px;
    }

    &__tab {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      cursor: pointer;
      color: var(--gf-color-text);
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      background: transparent;
      border: none;
      outline: none;
      transition: color var(--gf-motion-fast) var(--gf-easing);

      &:hover:not(.is-disabled) {
        color: var(--gf-color-primary);
      }

      &.is-active {
        color: var(--gf-color-primary);
      }

      &.is-disabled {
        color: var(--gf-color-text-tertiary);
        cursor: not-allowed;
      }
    }

    &__tab-icon {
      display: inline-flex;
      align-items: center;
      font-size: 14px;
    }

    &__ink-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      background: var(--gf-color-primary);
      transition:
        width 0.3s cubic-bezier(0.645, 0.045, 0.355, 1),
        transform 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
    }

    &__content {
      display: block;
    }

    // Card type
    &--type-card &__nav {
      gap: 2px;
      border-bottom: 1px solid var(--gf-color-border);
      background: transparent;
    }

    &--type-card &__tab {
      background: var(--gf-color-fill);
      border: 1px solid var(--gf-color-border);
      border-bottom: none;
      border-radius: var(--gf-radius-sm) var(--gf-radius-sm) 0 0;
      margin-bottom: -1px;

      &.is-active {
        background: var(--gf-color-surface);
        border-bottom: 1px solid var(--gf-color-surface);
      }
    }

    &--type-card &__ink-bar {
      display: none;
    }

    // Size variants
    &--size-small &__tab {
      padding: 8px 12px;
      font-size: var(--gf-font-size-xs);
    }

    &--size-large &__tab {
      padding: 16px 20px;
      font-size: var(--gf-font-size-md);
    }
  }
</style>
