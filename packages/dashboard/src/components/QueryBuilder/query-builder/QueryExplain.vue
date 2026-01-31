<!--
  @fileoverview 查询解释组件
  @description
    将 PromQL 查询分解为步骤化的可视化解释。
    主要功能：
    - 解析 Visual Query 对象为步骤
    - 解析 PromQL 字符串（Code 模式）
    - 使用 operation 的 explainHandler 生成详细说明
    - 使用 operation 的 renderer 生成每步的 PromQL 片段
    - 支持 Markdown 渲染说明文本
    - 支持步骤高亮显示和交互
  @reference Grafana 源码
    grafana/packages/grafana-prometheus/src/querybuilder/components/PromQueryBuilderExplained.tsx
    grafana/packages/grafana-prometheus/src/querybuilder/shared/OperationListExplained.tsx
    grafana/packages/grafana-prometheus/src/querybuilder/shared/OperationExplainedBox.tsx
  @props
    query: PromVisualQuery, codePromQL?: string
  @emits
    highlight
-->
<template>
  <div :class="bem()">
    <div :class="bem('steps')">
      <!-- 步骤 1: 基础指标和标签过滤 -->
      <div
        v-if="baseStep"
        :class="[bem('step'), { [bem('step--highlighted')]: highlightedStepIndex === 0 }]"
        @mouseenter="handleMouseEnter(0, -1)"
        @mouseleave="handleMouseLeave()"
      >
        <div :class="bem('step-indicator')">
          <div :class="bem('step-number')">1</div>
          <!-- <div :class="bem('step-connector')" v-if="operationSteps.length > 0"></div> -->
        </div>
        <div :class="bem('step-content')">
          <div :class="bem('step-header')">
            <Tag color="blue" :class="bem('step-tag')">基础查询</Tag>
            <span :class="bem('step-title')">选择指标和标签过滤器</span>
          </div>
          <div :class="bem('step-query')">
            <div :class="bem('promql-box')">
              <code :class="bem('promql-code')">{{ baseStep.promql }}</code>
            </div>
          </div>
          <div :class="bem('step-description')">
            <p>{{ baseStep.description }}</p>
            <Divider style="margin: 8px 0" />
            <div :class="bem('step-details')">
              <div v-if="query.metric" :class="bem('detail-item')">
                <span :class="bem('detail-label')">指标名称:</span>
                <code>{{ query.metric }}</code>
              </div>
              <div v-if="query.labels.length > 0" :class="bem('detail-item')">
                <span :class="bem('detail-label')">标签过滤:</span>
                <span>{{ query.labels.length }} 个条件</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 步骤 2-N: 每个操作 -->
      <div
        v-for="step in operationSteps"
        :key="step.stepNumber"
        :class="[bem('step'), { [bem('step--highlighted')]: highlightedStepIndex === step.stepNumber }]"
        @mouseenter="handleMouseEnter(step.stepNumber, step.operationIndex)"
        @mouseleave="handleMouseLeave()"
      >
        <div :class="bem('step-indicator')">
          <div :class="bem('step-number')">{{ step.stepNumber }}</div>
          <!-- <div :class="bem('step-connector')" v-if="index < operationSteps.length - 1"></div> -->
        </div>
        <div :class="bem('step-content')">
          <div :class="bem('step-header')">
            <Tag :color="getOperationColor(step.category)" :class="bem('step-tag')">
              {{ step.categoryLabel }}
            </Tag>
            <span :class="bem('step-title')">{{ step.title }}</span>
          </div>
          <div :class="bem('step-query')">
            <div :class="bem('promql-box')">
              <code :class="bem('promql-code')">{{ step.promqlFragment }}</code>
            </div>
          </div>
          <div :class="bem('step-description')">
            <!-- 使用 v-html 支持 Markdown（简化版，实际应该用库） -->
            <div v-html="renderDescription(step.description)" class="markdown-body"></div>

            <!-- 如果有参数，显示参数详情 -->
            <div v-if="step.params && step.params.length > 0" class="step-params">
              <Divider style="margin: 8px 0" />
              <div class="params-label">参数:</div>
              <div class="params-list">
                <div v-for="(param, pIndex) in step.params" :key="pIndex" class="param-item">
                  <span class="param-name">{{ param.name }}:</span>
                  <code class="param-value">{{ param.value }}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 二元查询说明 -->
      <div v-if="query.binaryQueries && query.binaryQueries.length > 0" :class="[bem('step'), bem('step--binary')]">
        <div :class="bem('step-indicator')">
          <div :class="bem('step-number')">
            <DatabaseOutlined />
          </div>
        </div>
        <div :class="bem('step-content')">
          <div :class="bem('step-header')">
            <Tag color="purple" :class="bem('step-tag')">二元查询</Tag>
            <span :class="bem('step-title')">包含 {{ query.binaryQueries.length }} 个二元运算</span>
          </div>
          <div :class="bem('step-description')">
            <p>此查询包含二元运算，将与其他查询进行组合计算。二元运算支持算术、比较和逻辑操作。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Tag, Divider } from '@grafana-fast/component';
  import { DatabaseOutlined } from '@ant-design/icons-vue';
  import { computed, ref } from 'vue';
  import { promQueryModeller } from '@grafana-fast/utils';
  import type { PromVisualQuery, QueryBuilderOperationParamValue } from '@grafana-fast/utils';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('query-explain');

  interface Props {
    query: PromVisualQuery;
    codePromQL?: string;
  }

  interface ExplainStep {
    stepNumber: number;
    title: string;
    promqlFragment: string;
    description: string;
    category: string;
    categoryLabel: string;
    operationIndex: number;
    params?: Array<{ name: string; value: QueryBuilderOperationParamValue }>;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'highlight', index: number | null): void;
  }>();

  const highlightedStepIndex = ref<number | null>(null);

  // 基础步骤（指标 + 标签）
  const baseStep = computed(() => {
    if (!props.query.metric && props.query.labels.length === 0) {
      return null;
    }

    let promql = props.query.metric || '';
    let description = '获取匹配指标名称的所有时间序列';

    if (props.query.labels.length > 0) {
      promql += promQueryModeller.renderLabels(props.query.labels);
      description = `获取匹配指标名称和 ${props.query.labels.length} 个标签过滤条件的所有时间序列。标签过滤器用于精确筛选需要查询的数据。`;
    }

    return {
      stepNumber: 1,
      promql,
      description,
    };
  });

  // 操作步骤
  const operationSteps = computed<ExplainStep[]>(() => {
    const steps: ExplainStep[] = [];
    let stepNumber = 2; // 从 2 开始，因为 1 是基础查询

    // 累积构建查询，每一步都基于前一步
    let currentQuery: PromVisualQuery = {
      ...props.query,
      operations: [],
    };

    for (const [index, operation] of props.query.operations.entries()) {
      // 添加当前操作到累积查询
      currentQuery = {
        ...currentQuery,
        operations: [...currentQuery.operations, operation],
      };

      const opDef = promQueryModeller.getOperationDef(operation.id);
      if (!opDef) {
        steps.push({
          stepNumber,
          title: `未知操作: ${operation.id}`,
          promqlFragment: operation.id,
          description: '操作定义未找到',
          category: 'unknown',
          categoryLabel: '未知',
          operationIndex: index,
        });
        stepNumber++;
        continue;
      }

      // 使用 renderer 生成此步骤的 PromQL 片段
      const promqlFragment = opDef.renderer(operation, opDef, '<expr>');

      // 使用 explainHandler 或 documentation 生成说明
      let description = '应用此操作到查询结果';
      if (opDef.explainHandler) {
        description = opDef.explainHandler(operation, opDef);
      } else if (opDef.documentation) {
        description = opDef.documentation;
      }

      // 提取参数信息（正确处理 Rest 参数，如多个 Label）
      const params: Array<{ name: string; value: QueryBuilderOperationParamValue }> = [];
      if (operation.params && opDef.params) {
        let paramIndex = 0;

        opDef.params.forEach((paramDef) => {
          // 检查是否还有参数值可用
          if (paramIndex >= operation.params.length) {
            return;
          }

          // 如果是 Rest 参数（如 sum by 的多个 label），收集所有剩余参数
          if (paramDef.restParam) {
            const restValues: QueryBuilderOperationParamValue[] = [];
            while (paramIndex < operation.params.length) {
              const value = operation.params[paramIndex];
              if (value !== undefined && value !== '') {
                restValues.push(value);
              }
              paramIndex++;
            }

            // 如果有多个值，为每个值创建一个参数项
            if (restValues.length > 0) {
              restValues.forEach((value, index) => {
                params.push({
                  name: `${paramDef.name || 'Label'} ${index + 1}`,
                  value: value,
                });
              });
            }
          } else {
            // 普通参数，只取一个值
            const value = operation.params[paramIndex];
            if (value !== undefined && value !== '') {
              params.push({
                name: paramDef.name || `参数 ${paramIndex + 1}`,
                value: value,
              });
            }
            paramIndex++;
          }
        });
      }

      // 确定操作类别
      const category = opDef.category || 'other';
      const categoryLabels: Record<string, string> = {
        aggregations: '聚合',
        'range functions': '范围函数',
        functions: '函数',
        'trigonometric functions': '三角函数',
        'time functions': '时间函数',
        'binary operations': '二元运算',
        other: '其他',
      };

      steps.push({
        stepNumber,
        title: opDef.name || operation.id,
        promqlFragment,
        description,
        category,
        categoryLabel: categoryLabels[category.toLowerCase()] || category,
        operationIndex: index,
        params: params.length > 0 ? params : undefined,
      });

      stepNumber++;
    }

    return steps;
  });

  // 获取操作类别的颜色
  function getOperationColor(category: string): string {
    const colors: Record<string, string> = {
      aggregations: 'blue',
      'range functions': 'green',
      functions: 'cyan',
      'trigonometric functions': 'purple',
      'time functions': 'orange',
      'binary operations': 'red',
      other: 'default',
    };
    return colors[category.toLowerCase()] || 'default';
  }

  // 简化的 Markdown 渲染（实际应使用 marked 或 markdown-it 库）
  function renderDescription(text: string): string {
    if (!text) return '';

    // 简单处理一些 Markdown 语法
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // 粗体
      .replace(/\*(.+?)\*/g, '<em>$1</em>') // 斜体
      .replace(/`(.+?)`/g, '<code>$1</code>') // 行内代码
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>') // 链接
      .replace(/\n/g, '<br>'); // 换行
  }

  const handleMouseEnter = (stepIndex: number, operationIndex: number) => {
    highlightedStepIndex.value = stepIndex;
    if (operationIndex >= 0) {
      emit('highlight', operationIndex);
    }
  };

  const handleMouseLeave = () => {
    highlightedStepIndex.value = null;
    emit('highlight', null);
  };
</script>

<style scoped lang="less">
  .dp-query-explain {
    &__steps {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    &__step {
      display: flex;
      gap: 0;
      padding: 8px;
      background: var(--gf-color-surface);
      border-radius: var(--gf-radius-xs);
      border: 1px solid transparent;
      transition: all 0.15s;
      cursor: pointer;
      margin-bottom: 6px;

      &:last-child {
        margin-bottom: 0;
      }

      // &:hover {
      //   background: #f5f5f5;
      //   border-color: #d9d9d9;
      // }

      &--highlighted {
        background: var(--gf-color-primary-soft);
        border-color: var(--gf-color-primary-border);
      }

      &--binary {
        background: var(--gf-color-surface-muted);

        &:hover {
          background: var(--gf-color-surface);
          border-color: var(--gf-color-border-strong);
        }
      }
    }

    &__step-indicator {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-right: 10px;
      position: relative;
    }

    &__step-number {
      width: 22px;
      height: 22px;
      border-radius: var(--gf-radius-xs);
      background: var(--gf-color-primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
      font-size: 11px;
      z-index: 1;
    }

    &__step--binary &__step-number {
      background: var(--gf-color-primary-hover);
    }

    &__step-connector {
      width: 1px;
      flex: 1;
      background: var(--gf-color-border-muted);
      margin-top: 2px;
    }

    &__step-content {
      flex: 1;
      min-width: 0;
    }

    &__step-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    &__step-tag {
      font-size: 11px;
      margin: 0;
      padding: 0 6px;
      line-height: 18px;
    }

    &__step-title {
      font-weight: 500;
      color: var(--gf-color-text);
      font-size: 12px;
    }

    &__step-query {
      margin-bottom: 6px;
    }

    &__promql-box {
      background: var(--gf-color-surface-muted);
      border: 1px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-xs);
      padding: 6px 8px;
      border-left: 2px solid var(--gf-color-primary);
    }

    &__promql-code {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
      font-size: 11px;
      line-height: 1.5;
      color: var(--gf-color-text);
      word-break: break-all;
      white-space: pre-wrap;
    }

    &__step-description {
      color: var(--gf-color-text-secondary);
      font-size: 11px;
      line-height: 1.5;

      p {
        margin: 0 0 4px 0;

        &:last-child {
          margin-bottom: 0;
        }
      }
    }

    .markdown-body {
      line-height: 1.5;

      code {
        background: var(--gf-color-fill);
        padding: 1px 4px;
        border-radius: var(--gf-radius-xs);
        font-size: 11px;
        color: var(--gf-color-danger);
      }

      strong {
        font-weight: 500;
        color: var(--gf-color-text);
      }

      a {
        color: var(--gf-color-primary);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    &__step-details {
      background: var(--gf-color-surface-muted);
      padding: 6px 8px;
      border-radius: var(--gf-radius-xs);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    &__detail-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;

      code {
        background: var(--gf-color-surface);
        padding: 1px 4px;
        border-radius: var(--gf-radius-xs);
        font-size: 11px;
        border: 1px solid var(--gf-color-border-muted);
      }
    }

    &__detail-label {
      color: var(--gf-color-text-tertiary);
      font-weight: 500;
    }

    .step-params {
      margin-top: 6px;
    }

    .params-label {
      font-size: 11px;
      color: var(--gf-color-text-tertiary);
      font-weight: 500;
      margin-bottom: 3px;
    }

    .params-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .param-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      padding: 3px 6px;
      background: var(--gf-color-surface-muted);
      border-radius: var(--gf-radius-xs);
    }

    .param-name {
      color: var(--gf-color-text-secondary);
      font-weight: 500;
    }

    .param-value {
      background: var(--gf-color-surface);
      padding: 1px 4px;
      border-radius: var(--gf-radius-xs);
      font-size: 11px;
      border: 1px solid var(--gf-color-border-muted);
      color: var(--gf-color-danger);
    }
  }
</style>
