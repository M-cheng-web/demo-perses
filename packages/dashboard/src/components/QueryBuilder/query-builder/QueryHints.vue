<!--
  @fileoverview 查询优化提示组件
  @description
    提供查询优化建议和自动修复。
    主要功能：
    - 分析查询性能
    - 提供优化建议（如添加 rate()）
    - 一键应用修复
  @reference Grafana 源码
    grafana/public/app/plugins/datasource/prometheus-querybuilder/components/PromQueryBuilderHints.tsx
  @props
    query: PromVisualQuery
  @emits
    applyFix
-->
<template>
  <div v-if="hints.length > 0" :class="bem()">
    <div :class="bem('header')">
      <span :class="bem('title')">查询提示</span>
    </div>
    <div :class="bem('content')">
      <div v-for="(hint, index) in hints" :key="index" :class="bem('card')">
        <Alert :type="hint.type" :message="hint.title" show-icon>
          <template #description>
            <div :class="bem('hint-content')">
              <p>{{ hint.description }}</p>
              <div v-if="hint.suggestion" :class="bem('suggestion')">{{ hint.suggestion }}</div>
              <Button v-if="hint.fix" type="link" size="small" @click="applyFix(hint)">
                <ThunderboltOutlined />
                应用修复
              </Button>
            </div>
          </template>
        </Alert>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Button } from '@grafana-fast/component';
  import { computed } from 'vue';
  import { ThunderboltOutlined } from '@ant-design/icons-vue';
  import { message } from '@grafana-fast/component';
  import type { PromVisualQuery } from '/#/components/QueryBuilder/lib/types';
  import { createNamespace } from '/#/utils';
  import { Alert } from '@grafana-fast/component';

  const [_, bem] = createNamespace('query-hints');

  interface QueryHint {
    type: 'warning' | 'info' | 'success';
    title: string;
    description: string;
    suggestion?: string;
    fix?: {
      type: string;
      action: () => void;
    };
  }

  interface Props {
    query: PromVisualQuery;
  }

  interface Emits {
    (e: 'apply-fix', query: PromVisualQuery): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  // 分析查询并生成提示
  const hints = computed<QueryHint[]>(() => {
    const result: QueryHint[] = [];

    if (!props.query.metric) {
      return result;
    }

    // 提示 1: Counter 类型指标建议使用 rate()
    if (isCounterMetric(props.query.metric) && !hasRateFunction(props.query)) {
      result.push({
        type: 'warning',
        title: '建议使用 rate() 函数',
        description: `指标 "${props.query.metric}" 看起来是 Counter 类型。Counter 类型的指标应该使用 rate() 或 irate() 函数来计算每秒增长率。`,
        suggestion: '添加 rate() 函数到操作列表',
        fix: {
          type: 'add_rate',
          action: () => addRateFunction(),
        },
      });
    }

    // 提示 2: Histogram 指标建议使用 histogram_quantile
    if (isHistogramMetric(props.query.metric) && !hasHistogramQuantile(props.query)) {
      result.push({
        type: 'info',
        title: 'Histogram 指标优化',
        description: `指标 "${props.query.metric}" 是 Histogram 类型。建议使用 histogram_quantile() 函数计算分位数（如 P95、P99）。`,
        suggestion: '使用查询模板快速构建 Histogram 查询',
      });
    }

    // 提示 3: 建议添加聚合操作
    if (hasRangeFunction(props.query) && !hasAggregation(props.query)) {
      result.push({
        type: 'info',
        title: '考虑添加聚合操作',
        description: '您使用了范围函数（如 rate），通常需要配合聚合操作（如 sum、avg）来得到有意义的结果。',
        suggestion: '添加 sum 或 avg 聚合操作',
      });
    }

    // 提示 4: 建议添加标签过滤
    if (!props.query.labels || props.query.labels.length === 0) {
      result.push({
        type: 'info',
        title: '建议添加标签过滤',
        description: '添加标签过滤可以缩小查询范围，提高查询性能并得到更精确的结果。',
        suggestion: '在标签过滤器中添加常用标签（如 job、instance）',
      });
    }

    // 提示 5: 范围向量时间窗口建议
    if (hasRangeFunction(props.query)) {
      const rangeOp = props.query.operations.find((op) => ['rate', 'irate', 'increase', 'delta', 'idelta'].includes(op.id));
      if (rangeOp && rangeOp.params[0] === '$__rate_interval') {
        result.push({
          type: 'success',
          title: '✓ 使用了推荐的时间范围变量',
          description: '您正在使用 $__rate_interval 变量，这是推荐的做法，可以根据时间范围自动调整采样间隔。',
        });
      }
    }

    return result;
  });

  // 检查是否是 Counter 类型指标
  function isCounterMetric(metric: string): boolean {
    return metric.endsWith('_total') || metric.endsWith('_count') || metric.includes('_requests_') || metric.includes('_errors_');
  }

  // 检查是否是 Histogram 类型指标
  function isHistogramMetric(metric: string): boolean {
    return metric.endsWith('_bucket') || metric.endsWith('_sum') || metric.includes('_duration_') || metric.includes('_latency_');
  }

  // 检查是否已有 rate 函数
  function hasRateFunction(query: PromVisualQuery): boolean {
    return query.operations.some((op) => ['rate', 'irate', 'increase'].includes(op.id));
  }

  // 检查是否已有 histogram_quantile
  function hasHistogramQuantile(query: PromVisualQuery): boolean {
    return query.operations.some((op) => op.id === 'histogram_quantile');
  }

  // 检查是否有范围函数
  function hasRangeFunction(query: PromVisualQuery): boolean {
    return query.operations.some((op) => ['rate', 'irate', 'increase', 'delta', 'idelta', 'changes', 'deriv', 'resets'].includes(op.id));
  }

  // 检查是否有聚合操作
  function hasAggregation(query: PromVisualQuery): boolean {
    return query.operations.some((op) => ['sum', 'avg', 'min', 'max', 'count', '__sum_by', '__avg_by'].includes(op.id));
  }

  // 添加 rate 函数
  function addRateFunction() {
    const updatedQuery: PromVisualQuery = {
      ...props.query,
      operations: [
        {
          id: 'rate',
          params: ['$__rate_interval'],
        },
        ...props.query.operations,
      ],
    };
    emit('apply-fix', updatedQuery);
    message.success('已添加 rate() 函数');
  }

  // 应用修复
  function applyFix(hint: QueryHint) {
    if (hint.fix) {
      hint.fix.action();
    }
  }
</script>

<style scoped lang="less">
  @import '/#/assets/styles/variables.less';

  .dp-query-hints {
    width: 100%;
    border: 1px solid @border-color;
    border-radius: 4px;
    overflow: hidden;
    background: @background-light;
    border-left: 3px solid #fa5914; // 提示区块使用橙色强调

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid @border-color;
      background: @background-base;
    }

    &__title {
      font-weight: 600;
      font-size: 11px;
      color: @text-color;
      line-height: 1.5;
    }

    &__content {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    &__card {
      width: 100%;

      :deep(.gf-alert) {
        margin-bottom: 0;
        padding: 8px 12px;
        font-size: 12px;
      }

      :deep(.gf-alert__message) {
        font-size: 12px;
        font-weight: 500;
      }

      :deep(.gf-alert__description) {
        font-size: 12px;
      }
    }

    &__hint-content {
      font-size: 12px;

      p {
        margin: 4px 0;
        line-height: 1.4;
      }
    }

    &__suggestion {
      background: #fff7e6;
      padding: 6px 8px;
      border-radius: 2px;
      margin: 6px 0;
      border-left: 2px solid #faad14;
      font-size: 11px;
      color: #8c8c8c;
    }
  }
</style>
