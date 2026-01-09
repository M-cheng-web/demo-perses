<template>
  <div v-if="visible" :class="[bem(), `gf-alert--${type}`]">
    <div v-if="showIcon" :class="bem('icon')" :data-symbol="iconSymbol" aria-hidden="true"></div>
    <div :class="bem('body')">
      <div v-if="message" :class="bem('message')">{{ message }}</div>
      <div v-if="description || $slots.description" :class="bem('description')">
        <slot name="description">
          {{ description }}
        </slot>
      </div>
    </div>
    <button v-if="closable" type="button" :class="bem('close')" aria-label="关闭" @click="handleClose">x</button>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { createNamespace } from '/#/utils';

  type AlertType = 'info' | 'success' | 'warning' | 'error';

  const props = withDefaults(
    defineProps<{
      type?: AlertType;
      message?: string;
      description?: string;
      showIcon?: boolean;
      closable?: boolean;
    }>(),
    {
      type: 'info',
      message: '',
      description: '',
      showIcon: false,
      closable: false,
    }
  );

  const emit = defineEmits<{
    (e: 'close'): void;
  }>();

  const [_, bem] = createNamespace('alert');
  const visible = ref(true);

  const iconSymbol = computed(() => {
    const map: Record<AlertType, string> = {
      info: 'i',
      success: 'ok',
      warning: '!',
      error: 'x',
    };
    return map[props.type];
  });

  const type = computed<AlertType>(() => props.type);

  const handleClose = () => {
    visible.value = false;
    emit('close');
  };

  watch(
    () => [props.message, props.description, props.type],
    () => {
      visible.value = true;
    }
  );
</script>

<style scoped lang="less">
  .dp-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #d8e5f5;
    background: #f6f9ff;
    color: #132039;
    position: relative;

    &__icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
      background: rgba(79, 148, 245, 0.15);
      color: #4f94f5;

      &::before {
        content: attr(data-symbol);
      }
    }

    &__body {
      flex: 1;
      display: grid;
      gap: 4px;
    }

    &__message {
      font-weight: 700;
      font-size: 13px;
    }

    &__description {
      font-size: 12px;
      color: #4a5568;
      line-height: 1.5;
    }

    &__close {
      border: none;
      background: transparent;
      color: #8c8c8c;
      cursor: pointer;
      padding: 2px 4px;
      font-size: 14px;
      line-height: 1;
    }

    &.gf-alert--success {
      border-color: #b7eb8f;
      background: #f6ffed;

      .dp-alert__icon {
        background: rgba(56, 158, 13, 0.12);
        color: #389e0d;
      }
    }

    &.gf-alert--warning {
      border-color: #ffe58f;
      background: #fffbe6;

      .dp-alert__icon {
        background: rgba(212, 136, 6, 0.12);
        color: #d48806;
      }
    }

    &.gf-alert--error {
      border-color: #ffa39e;
      background: #fff2f0;

      .dp-alert__icon {
        background: rgba(207, 19, 34, 0.12);
        color: #cf1322;
      }
    }
  }
</style>
