<!--
  @fileoverview 查询模板模态框
  @description
    提供预定义的查询模板用于快速开始。
    主要功能：
    - 显示查询模板列表
    - 按类别分组（基础查询、聚合查询、高级查询等）
    - 选择模板并应用到查询
    - 模板说明和示例
  @reference Grafana 源码
    grafana/public/app/plugins/datasource/prometheus-querybuilder/components/PromQueryPattern.tsx
  @props
    open: boolean
  @emits
    update:open, select
-->
<template>
  <Modal
    v-model:open="isOpen"
    title="查询模板"
    width="700px"
    :keyboard="false"
    :maskClosable="false"
    :footer="null"
    :class="bem()"
    @cancel="handleClose"
  >
    <div :class="bem('description')">
      <Alert description="选择一个查询模板快速构建常用的 PromQL 查询" type="info" show-icon />
    </div>

    <div :class="bem('grid')">
      <Card
        v-for="pattern in patterns"
        :key="pattern.type"
        :title="pattern.name"
        hoverable
        :class="bem('card')"
        @click="handleSelectPattern(pattern)"
      >
        <template #extra>
          <Tag :color="getPatternColor(pattern.type)">
            {{ getPatternTypeLabel(pattern.type) }}
          </Tag>
        </template>

        <div :class="bem('card-content')">
          <div :class="bem('card-description')">
            {{ pattern.description }}
          </div>

          <div :class="bem('operations')">
            <div :class="bem('operations-label')">操作步骤：</div>
            <ol :class="bem('operations-list')">
              <li v-for="(op, index) in pattern.operations" :key="index">
                <code>{{ getOperationName(op.id) }}</code>
                <span v-if="op.params.length > 0" :class="bem('op-params')"> ({{ formatParams(op.params) }})</span>
              </li>
            </ol>
          </div>

          <div v-if="pattern.binaryQueries && pattern.binaryQueries.length > 0" :class="bem('binary')">
            <Divider style="margin: 10px 0" />
            <div :class="bem('operations-label')">+ 二元运算：</div>
            <div :class="bem('binary-info')">
              <code>{{ pattern.binaryQueries[0]?.operator || '' }}</code>
              <span :class="bem('binary-desc')">与另一个查询进行计算</span>
            </div>
          </div>

          <Button type="primary" block style="margin-top: 12px" size="small" @click.stop="handleSelectPattern(pattern)"> 使用此模板 </Button>
        </div>
      </Card>
    </div>
  </Modal>
</template>

<script setup lang="ts">
  import { Button, Card, Divider, Modal, Tag } from '@grafana-fast/component';
  import { ref, watch } from 'vue';
  import { message } from '@grafana-fast/component';
  import { promQueryModeller } from '/#/components/QueryBuilder/lib/PromQueryModeller';
  import type { PromQueryPattern, PromVisualQuery } from '/#/components/QueryBuilder/lib/types';
  import { createNamespace } from '/#/utils';
  import { Alert } from '@grafana-fast/component';

  const [_, bem] = createNamespace('query-patterns-modal');

  interface Props {
    open: boolean;
  }

  interface Emits {
    (e: 'update:open', value: boolean): void;
    (e: 'select', query: PromVisualQuery): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const isOpen = ref(props.open);

  watch(
    () => props.open,
    (newValue) => {
      isOpen.value = newValue;
    }
  );

  watch(isOpen, (newValue) => {
    emit('update:open', newValue);
  });

  // 获取查询模板
  const patterns: Array<PromQueryPattern & { description: string }> = promQueryModeller.getQueryPatterns().map((p) => ({
    ...p,
    description: getPatternDescription(p.name),
  }));

  // 获取模板描述（根据模板名称）
  function getPatternDescription(type: string): string {
    const descriptions: Record<string, string> = {
      'Rate then sum': '计算每秒速率后求和，适用于统计总请求数/秒等指标',
      'Rate then sum by(label)': '按标签分组计算速率，可分析不同维度（如状态码、实例）的速率',
      'Rate then sum by(label) then avg': '按标签分组后取平均值，用于分析平均性能',
      Increase: '计算指定时间窗口内的增量，适用于统计累计总数',
      'Irate then sum': '使用即时速率（最近两个点）计算，适用于快速变化的指标',
      'Histogram quantile on rate': '计算直方图指标的分位数（P95），用于延迟分析',
      'Histogram quantile on increase': '基于增量计算分位数，适用于累积型直方图',
      'Histogram P99': '计算 P99 延迟，用于 SLA 监控',
      'Histogram P50 (Median)': '计算中位数延迟，反映典型性能',
      'Error Rate (errors / total)': '计算错误率（错误数/总请求数），用于可靠性监控',
      'Percentage calculation': '计算百分比，将结果乘以 100',
      'Difference between metrics': '计算两个指标的差值，用于对比分析',
    };

    // 通用描述
    if (type === 'rate') return '计算时间序列的每秒平均增长率，常用于 Counter 类型指标';
    if (type === 'histogram') return '计算 Histogram 类型指标的分位数（如 P95、P99），用于性能分析';
    if (type === 'binary') return '使用二元运算符对两个查询结果进行计算，常用于比率计算（如错误率）';

    return descriptions[type] || '通用查询模板';
  }

  // 获取模板类型标签
  function getPatternTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      rate: 'Rate 查询',
      histogram: 'Histogram',
      binary: '二元运算',
    };
    return labels[type] || type;
  }

  // 获取模板类型颜色
  function getPatternColor(type: string): string {
    const colors: Record<string, string> = {
      rate: 'blue',
      histogram: 'orange',
      binary: 'purple',
    };
    return colors[type] || 'default';
  }

  // 获取操作名称
  function getOperationName(id: string): string {
    const opDef = promQueryModeller.getOperationDef(id);
    return opDef?.name || id;
  }

  // 格式化参数
  function formatParams(params: any[]): string {
    return params.map((p) => (typeof p === 'string' && p ? `"${p}"` : p)).join(', ');
  }

  // 处理选择模板
  function handleSelectPattern(pattern: PromQueryPattern) {
    const query: PromVisualQuery = {
      metric: '',
      labels: [],
      operations: [...pattern.operations],
      binaryQueries: pattern.binaryQueries ? [...pattern.binaryQueries] : undefined,
    };

    emit('select', query);
    handleClose();
    message.success(`已应用模板: ${pattern.name}`);
  }

  // 关闭弹窗
  function handleClose() {
    isOpen.value = false;
  }
</script>

<style scoped>
  .dp-query-patterns-modal :deep(.gf-modal__body) {
    padding: 16px;
  }

  .dp-query-patterns-modal__description {
    margin-bottom: 16px;
  }

  .dp-query-patterns-modal__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
    max-height: 60vh;
    overflow-y: auto;
  }

  .dp-query-patterns-modal__card {
    cursor: pointer;
    transition: all 0.3s ease;
    height: 100%;
  }

  .dp-query-patterns-modal__card:hover {
    box-shadow: var(--gf-shadow-1);
  }

  .dp-query-patterns-modal__card :deep(.gf-card__header) {
    background: var(--gf-color-surface-muted);
    padding: 8px 12px;
    min-height: auto;
  }

  .dp-query-patterns-modal__card :deep(.gf-card__title) {
    font-weight: 600;
    font-size: 14px;
    padding: 0;
  }

  .dp-query-patterns-modal__card :deep(.gf-card__body) {
    padding: 12px;
  }

  .dp-query-patterns-modal__card-content {
    display: flex;
    flex-direction: column;
  }

  .dp-query-patterns-modal__card-description {
    color: var(--gf-color-text-secondary);
    font-size: 12px;
    line-height: 1.5;
    margin-bottom: 12px;
    min-height: 36px;
  }

  .dp-query-patterns-modal__operations {
    background: var(--gf-color-surface-muted);
    padding: 10px;
    border-radius: var(--gf-radius-xs);
    border: 1px solid var(--gf-color-border-muted);
    margin-bottom: 10px;
  }

  .dp-query-patterns-modal__operations-label {
    font-weight: 500;
    font-size: 12px;
    color: var(--gf-color-text);
    margin-bottom: 6px;
  }

  .dp-query-patterns-modal__operations-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .dp-query-patterns-modal__operations-list li {
    padding: 3px 0;
    font-size: 12px;
    color: var(--gf-color-text-secondary);
  }

  .dp-query-patterns-modal__operations-list code {
    background: var(--gf-color-surface);
    color: var(--gf-color-primary);
    padding: 2px 5px;
    border-radius: var(--gf-radius-xs);
    border: 1px solid var(--gf-color-border-muted);
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 11px;
  }

  .dp-query-patterns-modal__op-params {
    color: var(--gf-color-text-tertiary);
    font-size: 11px;
    margin-left: 4px;
  }

  .dp-query-patterns-modal__binary {
    background: var(--gf-color-primary-soft);
    padding: 8px 10px;
    border-radius: var(--gf-radius-xs);
    border-left: 2px solid var(--gf-color-primary);
  }

  .dp-query-patterns-modal__binary-info {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  .dp-query-patterns-modal__binary-info code {
    background: var(--gf-color-surface);
    color: var(--gf-color-primary-hover);
    padding: 2px 6px;
    border-radius: var(--gf-radius-xs);
    border: 1px solid var(--gf-color-border-muted);
    font-weight: 600;
    font-size: 11px;
  }

  .dp-query-patterns-modal__binary-desc {
    color: var(--gf-color-text-secondary);
    font-size: 11px;
  }
</style>
