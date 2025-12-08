<!-- 图表样式配置 - 表格 -->
<template>
  <div class="table-chart-styles">
    <div class="styles-grid">
      <!-- 左侧列：表格配置 -->
      <div class="styles-column">
        <div class="section">
          <div class="section-header">表格配置</div>
          <div class="section-content">
            <div class="style-row">
              <span class="style-label">显示分页</span>
              <Switch v-model:checked="localOptions.specific.showPagination" size="small" />
            </div>

            <div v-if="localOptions.specific.showPagination" class="style-row">
              <span class="style-label">每页行数</span>
              <Select
                v-model:value="localOptions.specific.pageSize"
                size="small"
                style="width: 200px"
                :options="[
                  { label: '10', value: 10 },
                  { label: '20', value: 20 },
                  { label: '50', value: 50 },
                  { label: '100', value: 100 },
                ]"
              />
            </div>

            <div class="style-row">
              <span class="style-label">可排序</span>
              <Switch v-model:checked="localOptions.specific.sortable" size="small" />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧列：格式化 -->
      <div class="styles-column">
        <div class="section">
          <div class="section-header">格式化</div>
          <div class="section-content">
            <div class="style-row">
              <span class="style-label">单位</span>
              <Select
                v-model:value="localOptions.format.unit"
                size="small"
                style="width: 200px"
                :options="[
                  { label: '无', value: 'none' },
                  { label: '百分比 (0.0-1.0)', value: 'percent' },
                  { label: '百分比 (0-100)', value: 'percent-decimal' },
                  { label: '字节', value: 'bytes' },
                  { label: '毫秒', value: 'milliseconds' },
                  { label: '秒', value: 'seconds' },
                ]"
              />
            </div>

            <div class="style-row">
              <span class="style-label">小数位数</span>
              <Select
                v-model:value="localOptions.format.decimals"
                size="small"
                style="width: 200px"
                :options="[
                  { label: '默认', value: 'default' },
                  { label: '0', value: 0 },
                  { label: '1', value: 1 },
                  { label: '2', value: 2 },
                  { label: '3', value: 3 },
                  { label: '4', value: 4 },
                ]"
              />
            </div>
          </div>
        </div>

        <!-- 重置设置 -->
        <div class="section">
          <div class="section-header">重置设置</div>
          <div class="section-content">
            <Button type="default" size="middle" block @click="resetToDefaults"> 恢复默认设置 </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { deepClone } from '@/utils';
  import { Switch, Select, Button } from 'ant-design-vue';

  interface Props {
    options: any;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    (e: 'update:options', options: any): void;
  }>();

  const getDefaultOptions = () => ({
    specific: {
      showPagination: true,
      pageSize: 20,
      sortable: true,
    },
    format: {
      unit: 'none',
      decimals: 'default',
    },
  });

  // 合并默认配置和传入的配置
  const localOptions = ref(
    deepClone({
      ...getDefaultOptions(),
      ...props.options,
    })
  );

  // 恢复默认设置
  const resetToDefaults = () => {
    const defaults = getDefaultOptions();
    localOptions.value = deepClone(defaults);
    emit('update:options', deepClone(defaults));
  };

  watch(
    localOptions,
    (newVal) => {
      emit('update:options', deepClone(newVal));
    },
    { deep: true }
  );
</script>

<style scoped lang="less">
  .table-chart-styles {
    padding: 16px;
    height: 100%;
    overflow-y: auto;

    .styles-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }

    .styles-column {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .section {
      border: 1px solid @border-color;
      border-radius: 4px;
      overflow: hidden;
      background: @background-light;

      .section-header {
        padding: 12px 16px;
        border-bottom: 1px solid @border-color;
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.5px;
        color: @text-color-secondary;
        text-transform: uppercase;
        background: @background-base;
      }

      .section-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    }

    .style-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      .style-label {
        font-size: 13px;
        color: @text-color;
        flex-shrink: 0;
        min-width: 90px;
        font-weight: 500;
      }
    }
  }
</style>
