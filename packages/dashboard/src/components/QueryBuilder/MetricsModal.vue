<!--
  @fileoverview 指标浏览器模态框
  @description
    提供完整的指标浏览和搜索功能。
    主要功能：
    - 搜索指标名称
    - 按类型过滤（Counter, Gauge, Histogram, Summary）
    - 分页显示指标列表
    - 显示指标元数据（类型、帮助信息）
  @reference Grafana 源码
    grafana/public/app/plugins/datasource/prometheus-querybuilder/components/MetricsBrowser.tsx
  @props
    open: boolean
  @emits
    update:open, select
-->
<template>
  <Modal
    v-model:open="isOpen"
    title="指标浏览器"
    width="800px"
    :keyboard="false"
    :maskClosable="false"
    :footer="null"
    :class="bem()"
    @cancel="handleClose"
  >
    <!-- 搜索和过滤 -->
    <div :class="bem('search-filters')">
      <Input v-model:value="searchText" placeholder="搜索指标名称..." allow-clear @input="handleSearch" :class="bem('search-input')">
        <template #prefix>
          <SearchOutlined />
        </template>
      </Input>

      <Select
        v-model:value="selectedTypes"
        mode="multiple"
        placeholder="按类型过滤"
        :options="typeOptions"
        style="width: 240px"
        @change="handleTypeFilterChange"
        allow-clear
      >
        <template #suffixIcon>
          <FilterOutlined />
        </template>
      </Select>
    </div>

    <!-- 指标列表 -->
    <Table
      :columns="columns"
      :data-source="filteredMetrics"
      :loading="loading"
      :pagination="paginationConfig"
      :row-key="(record: MetricInfo) => record.name"
      size="small"
      :scroll="{ y: 'calc(60vh - 100px)' }"
      :class="bem('table')"
      @change="handleTableChange"
    >
      <!-- 指标名称列 -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <code :class="bem('metric-name')">{{ record.name }}</code>
        </template>
        <template v-else-if="column.key === 'type'">
          <Tag v-if="record.type" :color="getTypeColor(record.type)">
            {{ record.type }}
          </Tag>
          <span v-else :class="bem('no-type')">未知</span>
        </template>
        <template v-else-if="column.key === 'help'">
          <span :class="bem('description')">{{ record.help || '-' }}</span>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button type="link" size="small" @click="handleSelectMetric(record.name)"> 选择 </Button>
        </template>
      </template>
    </Table>
  </Modal>
</template>

<script setup lang="ts">
  import { Button, Input, Modal, Select, Table, Tag } from '@grafana-fast/component';
  import { ref, computed, watch, onMounted } from 'vue';
  import { SearchOutlined, FilterOutlined } from '@ant-design/icons-vue';
  import { message } from '@grafana-fast/component';
  import { fetchMetrics } from '/#/api/querybuilder/prometheusApi';
  import { createNamespace } from '/#/utils';
  import type { TableProps, TableColumnType } from '@grafana-fast/component';

  const [_, bem] = createNamespace('metrics-modal');

  interface MetricInfo {
    name: string;
    type?: string;
    help?: string;
  }

  interface Props {
    open: boolean;
  }

  interface Emits {
    (e: 'update:open', value: boolean): void;
    (e: 'select', metricName: string): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const isOpen = ref(props.open);
  const loading = ref(false);
  const allMetrics = ref<MetricInfo[]>([]);
  const searchText = ref('');
  const selectedTypes = ref<string[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(20);

  // 表格列定义
  const columns: TableColumnType[] = [
    {
      title: '指标名称',
      dataIndex: 'name',
      key: 'name',
      width: '35%',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      align: 'center',
    },
    {
      title: '描述',
      dataIndex: 'help',
      key: 'help',
      width: '40%',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: '10%',
      align: 'center',
    },
  ];

  watch(
    () => props.open,
    (newValue) => {
      isOpen.value = newValue;
      if (newValue) {
        loadMetrics();
      }
    }
  );

  watch(isOpen, (newValue) => {
    emit('update:open', newValue);
  });

  // 类型选项
  const typeOptions = [
    { label: 'Counter', value: 'counter' },
    { label: 'Gauge', value: 'gauge' },
    { label: 'Histogram', value: 'histogram' },
    { label: 'Summary', value: 'summary' },
    { label: '未知类型', value: 'unknown' },
  ];

  // 过滤后的指标
  const filteredMetrics = computed(() => {
    let metrics = allMetrics.value;

    // 搜索过滤
    if (searchText.value) {
      const searchLower = searchText.value.toLowerCase();
      metrics = metrics.filter((m) => m.name.toLowerCase().includes(searchLower) || m.help?.toLowerCase().includes(searchLower));
    }

    // 类型过滤
    if (selectedTypes.value.length > 0) {
      metrics = metrics.filter((m) => {
        const metricType = m.type?.toLowerCase() || 'unknown';
        return selectedTypes.value.includes(metricType);
      });
    }

    return metrics;
  });

  // 分页配置
  const paginationConfig = computed(() => ({
    current: currentPage.value,
    pageSize: pageSize.value,
    total: filteredMetrics.value.length,
    showTotal: (total: number) => `共 ${total} 个指标`,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    size: 'small' as const,
  }));

  // 加载指标
  const loadMetrics = async () => {
    loading.value = true;
    try {
      const metricNames = await fetchMetrics();

      // 转换为 MetricInfo 格式并添加模拟的类型和描述
      allMetrics.value = metricNames.map((name) => ({
        name,
        type: inferMetricType(name),
        help: generateMetricHelp(name),
      }));
    } catch (error) {
      message.error('加载指标失败');
      console.error('Failed to load metrics:', error);
    } finally {
      loading.value = false;
    }
  };

  // 推断指标类型（基于命名规则）
  const inferMetricType = (name: string): string => {
    if (name.endsWith('_total') || name.endsWith('_count')) {
      return 'counter';
    } else if (name.endsWith('_bucket') || name.endsWith('_sum')) {
      return 'histogram';
    } else if (name.includes('_seconds') || name.includes('_bytes')) {
      return 'gauge';
    }
    return 'gauge';
  };

  // 生成指标描述（模拟）
  const generateMetricHelp = (name: string): string => {
    const helpTexts: Record<string, string> = {
      http_requests_total: 'HTTP 请求总数',
      http_request_duration_seconds: 'HTTP 请求持续时间（秒）',
      http_request_size_bytes: 'HTTP 请求大小（字节）',
      http_response_size_bytes: 'HTTP 响应大小（字节）',
      process_cpu_seconds_total: '进程 CPU 使用时间（秒）',
      process_resident_memory_bytes: '进程驻留内存（字节）',
      process_open_fds: '打开的文件描述符数量',
      go_goroutines: 'Goroutine 数量',
      go_memstats_alloc_bytes: '分配的内存（字节）',
      node_cpu_seconds_total: 'CPU 时间（秒）',
      node_memory_MemAvailable_bytes: '可用内存（字节）',
      node_memory_MemTotal_bytes: '总内存（字节）',
      up: '目标是否在线',
    };

    return helpTexts[name] || `${name} 的度量值`;
  };

  // 获取类型颜色
  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      counter: 'blue',
      gauge: 'green',
      histogram: 'orange',
      summary: 'purple',
      unknown: 'default',
    };
    return colors[type?.toLowerCase()] || 'default';
  };

  // 处理搜索
  const handleSearch = () => {
    currentPage.value = 1; // 重置到第一页
  };

  // 处理类型过滤变化
  const handleTypeFilterChange = () => {
    currentPage.value = 1;
  };

  // 处理表格变化（分页、排序、过滤）
  const handleTableChange: TableProps['onChange'] = (pagination: any) => {
    if (pagination) {
      currentPage.value = pagination.current || 1;
      pageSize.value = pagination.pageSize || 20;
    }
  };

  // 处理选择指标
  const handleSelectMetric = (metricName: string) => {
    emit('select', metricName);
    handleClose();
    message.success(`已选择指标: ${metricName}`);
  };

  // 关闭弹窗
  const handleClose = () => {
    isOpen.value = false;
  };

  onMounted(() => {
    if (props.open) {
      loadMetrics();
    }
  });
</script>

<style scoped>
  .dp-metrics-modal :deep(.gf-modal__body) {
    padding: 16px;
  }

  .dp-metrics-modal__search-filters {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
  }

  .dp-metrics-modal__search-input {
    flex: 1;
  }

  .dp-metrics-modal__table {
    margin-top: 16px;
  }

  .dp-metrics-modal__metric-name {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    color: #1890ff;
    background: #f0f5ff;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .dp-metrics-modal__no-type {
    color: #8c8c8c;
    font-size: 12px;
  }

  .dp-metrics-modal__description {
    font-size: 12px;
    color: #595959;
  }

  /* 自定义 Table 样式 */
  .dp-metrics-modal__table :deep(.gf-table) {
    font-size: 13px;
  }

  .dp-metrics-modal__table :deep(.gf-table th) {
    background: #fafafa;
    font-weight: 600;
    font-size: 12px;
  }

  .dp-metrics-modal__table :deep(.gf-table td:hover) {
    background: #f5f5f5;
  }

  .dp-metrics-modal__table :deep(.gf-tag) {
    font-size: 11px;
    margin: 0;
  }

  .dp-metrics-modal__table :deep(.gf-button) {
    padding: 4px 6px;
  }
</style>
