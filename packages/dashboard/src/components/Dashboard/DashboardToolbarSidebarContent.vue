<template>
  <div :class="bem('sidebar')">
    <Card v-if="apiModeOptions?.length" title="数据源模式" :class="bem('card')">
      <Alert type="info" show-icon :message="'更改将在点击底部“确定”后生效；远程模式需要宿主提供 apiClient。'" :class="bem('tip')" />
      <Segmented
        :value="draftApiMode"
        block
        :options="apiModeOptions"
        :disabled="isBooting || apiModeSwitching"
        @update:value="(value: unknown) => emit('update:draft-api-mode', value as 'remote' | 'mock')"
      />
    </Card>

    <Card title="操作" :class="bem('card')">
      <Flex gap="8" wrap>
        <Button type="ghost" :disabled="isBooting || isReadOnly" @click="emit('create-group')">创建面板组</Button>
      </Flex>
      <div :class="bem('divider')"></div>
      <Flex gap="8" wrap>
        <Button type="ghost" :icon="h(FileTextOutlined)" :disabled="isBooting" @click="emit('view-json')">查看</Button>
        <Button type="ghost" :icon="h(UploadOutlined)" :disabled="isBooting || isReadOnly" @click="emit('import-json')">导入</Button>
        <Button type="ghost" :icon="h(DownloadOutlined)" :disabled="isBooting" @click="emit('export-json')">导出</Button>
      </Flex>
      <Alert type="info" show-icon :message="'导入会先进行严格校验；非法 JSON 不会污染当前状态。'" :class="bem('tip')" />
    </Card>

    <Card title="视图与时间" :class="bem('card')">
      <Alert type="info" show-icon :message="'更改将在点击底部“确定”后生效。'" :class="bem('tip')" />
      <Segmented
        :value="draftViewMode"
        block
        :options="viewModeOptions"
        :disabled="isBooting"
        @update:value="(value: unknown) => emit('update:draft-view-mode', value as 'grouped' | 'allPanels')"
      />
      <Alert v-if="isAllPanelsViewDraft" type="warning" show-icon :message="'全部面板视图为只读，不支持拖拽/编辑。'" :class="bem('tip')" />
      <div :class="bem('field')">
        <div :class="bem('label')">范围</div>
        <TimeRangePicker
          :value="draftTimeRange"
          :style="{ width: '100%' }"
          :disabled="isBooting"
          @update:value="(value: string) => emit('update:draft-time-range', value)"
        />
      </div>
      <div :class="bem('field')">
        <div :class="bem('label')">自动刷新</div>
        <Select
          :value="draftRefreshInterval"
          :disabled="isBooting"
          :options="refreshIntervalOptions"
          @update:value="(value: unknown) => emit('update:draft-refresh-interval', Number(value ?? 0))"
        />
      </div>
      <Alert
        type="info"
        show-icon
        :message="'自动刷新仅影响当前页面运行时；保存/导出时会写入 Dashboard JSON 的 refreshInterval。'"
        :class="bem('tip')"
      />
    </Card>

    <Card title="变量" :class="bem('card')">
      <Alert type="info" show-icon :class="bem('tip')">
        <template #description> 更改将在点击底部“确定”后生效；仅当查询 expr 中使用了 <code>$变量名</code> 才会影响面板。 </template>
      </Alert>

      <div v-if="variableDefs.length > 0" :class="bem('var-help-list')">
        <div :class="bem('var-help-title')">当前仪表盘变量说明：</div>
        <div v-for="v in variableDefs" :key="v.id" :class="bem('var-help-item')">
          <div :class="bem('var-help-name')">
            <code>{{ formatVariableToken(v.name) }}</code>
            <span style="margin-left: 6px">{{ v.label || v.name }}</span>
          </div>
          <template v-for="(line, idx) in getVariableHelpLines(v)" :key="`${v.id}-${idx}`">
            <div :class="bem('var-help-line')">- {{ line }}</div>
          </template>
        </div>
      </div>

      <Alert v-if="variableDefs.length === 0" type="info" show-icon :message="'当前仪表盘未定义 variables。'" :class="bem('tip')" />

      <template v-else>
        <Alert v-if="isResolvingVariableOptions" type="info" show-icon :message="'选项加载中...'" :class="bem('tip')" />
        <Alert v-if="variableLastError" type="warning" show-icon :message="`上次刷新失败：${variableLastError}`" :class="bem('tip')" />

        <div v-for="v in variableDefs" :key="v.id" :class="bem('field')">
          <div :class="bem('var-label')" :title="v.label || v.name">{{ v.label || v.name }}</div>
          <div :class="bem('var-control')">
            <Select
              v-if="isSelectLikeVariable(v)"
              :value="draftVariableValues[v.name]"
              :mode="v.multi ? 'multiple' : undefined"
              show-search
              allow-clear
              style="width: 100%"
              :disabled="isBooting || v.type === 'constant'"
              :options="getVariableSelectOptions(v)"
              :placeholder="getVariablePlaceholder(v)"
              @update:value="(value: string | string[] | undefined) => emit('update:draft-variable-value', { name: v.name, value })"
            />
            <Input
              v-else
              :value="formatPlainVariableDraftValue(draftVariableValues[v.name])"
              allow-clear
              style="width: 100%"
              :disabled="isBooting || v.type === 'constant'"
              :placeholder="v.type === 'constant' ? '常量' : '请输入'"
              @update:value="
                (value: string | number) => emit('update:draft-variable-value', { name: v.name, value: parsePlainVariableDraftValue(v, value) })
              "
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
  import { h } from 'vue';
  import { Alert, Button, Card, Flex, Input, Segmented, Select, TimeRangePicker } from '@grafana-fast/component';
  import { DownloadOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons-vue';
  import type { DashboardVariable } from '@grafana-fast/types';
  import { createNamespace } from '/#/utils';

  interface ApiModeOption {
    label: string;
    value: 'remote' | 'mock';
    disabled?: boolean;
  }

  const [_, bem] = createNamespace('dashboard-toolbar');

  defineProps<{
    apiModeOptions?: ApiModeOption[];
    apiModeSwitching?: boolean;
    draftApiMode: 'remote' | 'mock';
    draftViewMode: 'grouped' | 'allPanels';
    viewModeOptions: Array<{ label: string; value: 'grouped' | 'allPanels'; disabled?: boolean }>;
    isAllPanelsViewDraft: boolean;
    draftTimeRange: string;
    draftRefreshInterval: number;
    refreshIntervalOptions: Array<{ label: string; value: number }>;
    isBooting: boolean;
    isReadOnly: boolean;
    variableDefs: DashboardVariable[];
    isResolvingVariableOptions: boolean;
    variableLastError: string | null;
    draftVariableValues: Record<string, string | string[]>;
    formatVariableToken: (name: string) => string;
    getVariableHelpLines: (v: DashboardVariable) => string[];
    isSelectLikeVariable: (v: DashboardVariable) => boolean;
    getVariableSelectOptions: (v: DashboardVariable) => Array<{ label: string; value: string }>;
    getVariablePlaceholder: (v: DashboardVariable) => string;
  }>();

  const formatPlainVariableDraftValue = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) return value.join(', ');
    return String(value ?? '');
  };

  const parsePlainVariableDraftValue = (def: DashboardVariable, value: string | number): string | string[] | undefined => {
    const text = String(value ?? '').trim();
    if (!def.multi) return text;
    if (!text) return [];
    return text
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
  };

  const emit = defineEmits<{
    (e: 'create-group'): void;
    (e: 'view-json'): void;
    (e: 'import-json'): void;
    (e: 'export-json'): void;
    (e: 'update:draft-api-mode', value: 'remote' | 'mock'): void;
    (e: 'update:draft-view-mode', value: 'grouped' | 'allPanels'): void;
    (e: 'update:draft-time-range', value: string): void;
    (e: 'update:draft-refresh-interval', value: number): void;
    (e: 'update:draft-variable-value', payload: { name: string; value: string | string[] | undefined }): void;
  }>();
</script>
