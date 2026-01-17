<!--
  页面说明：演示站点 - JSON Editor 测试页

  目标：
  - 为 @grafana-fast/json-editor 提供一个“回归与测试”的人工入口
  - 覆盖常见场景：合法/非法 JSON、非 Dashboard JSON、缺插件、迁移预检、外部校验错误

  说明：
  - 这个页面类似 ComponentShowcase：它不是最终产品页，而是验证能力的工具页
-->
<template>
  <ConfigProvider theme="inherit">
    <div class="dp-json-editor-showcase">
      <div class="dp-json-editor-showcase__header">
        <div class="dp-json-editor-showcase__title">
          <div class="dp-json-editor-showcase__h1">@grafana-fast/json-editor 测试页</div>
          <div class="dp-json-editor-showcase__sub">用于验证导入/导出、诊断提示（行列）、迁移预检、缺插件、外部校验。</div>
        </div>

        <Flex justify="end" :gap="10" wrap>
          <Segmented v-model:value="themeModel" size="small" :options="themeOptions" />
          <Button size="small" type="ghost" @click="goComponents">组件展示</Button>
          <Button size="small" type="ghost" @click="goHome">返回 Dashboard</Button>
        </Flex>
      </div>

      <div class="dp-json-editor-showcase__toolbar">
        <Space wrap :size="8">
          <Button size="small" type="primary" @click="loadDefaultDashboard">加载默认 Dashboard JSON</Button>
          <Button size="small" @click="loadInvalidJson">加载非法 JSON</Button>
          <Button size="small" @click="loadNotDashboardJson">加载非 Dashboard JSON</Button>
        </Space>

        <Space wrap :size="8">
          <Tag :color="applyOk ? 'var(--gf-color-success)' : 'var(--gf-color-danger)'"> validate: {{ applyOk ? 'true' : 'false' }} </Tag>
        </Space>
      </div>

      <div class="dp-json-editor-showcase__grid">
        <Card title="DashboardJsonEditor（带导入预检 + 外部校验）" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <Space wrap :size="8">
              <Switch v-model:checked="strictValidationEnabled" />
              <span class="dp-json-editor-showcase__hint">启用严格外部校验（示例：name 必填、refreshInterval >= 0、panel/type 必填）</span>
            </Space>

            <DashboardJsonEditor
              v-model="jsonText"
              :height="520"
              :validate="strictValidationEnabled ? validateDashboardStrict : undefined"
              @validate="(ok: boolean) => (applyOk = ok)"
            />
          </Space>
        </Card>

        <Card title="JsonEditorLite（通用 JSON 文本）" size="small" :bordered="true">
          <JsonEditorLite v-model="liteJsonText" :height="320" />
        </Card>
      </div>
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Button, Card, ConfigProvider, Flex, Segmented, Space, Switch, Tag, message } from '@grafana-fast/component';
  import { getAppliedDashboardTheme, setDashboardThemePreference, validateDashboardStrict, type DashboardTheme } from '@grafana-fast/dashboard';
  import { DashboardJsonEditor, JsonEditorLite } from '@grafana-fast/json-editor';
  import { createMockApiClient } from '@grafana-fast/api';

  const router = useRouter();

  const goHome = () => router.push('/home');
  const goComponents = () => router.push('/components');

  const theme = ref<DashboardTheme>(getAppliedDashboardTheme());
  const themeOptions = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ] as const;

  const themeModel = computed({
    get: () => theme.value,
    set: (value: DashboardTheme) => {
      theme.value = setDashboardThemePreference(value);
    },
  });

  const jsonText = ref<string>('');
  const liteJsonText = ref<string>('{ "hello": "world" }');
  const applyOk = ref<boolean>(false);

  const strictValidationEnabled = ref(true);

  const api = createMockApiClient();

  const loadDefaultDashboard = async () => {
    try {
      const d = await api.dashboard.getDefaultDashboard();
      jsonText.value = JSON.stringify(d, null, 2);
      message.success('已加载默认 Dashboard JSON');
    } catch (e) {
      message.error((e as Error)?.message ?? '加载失败');
    }
  };

  const loadInvalidJson = () => {
    // 特意制造一个 JSON 语法错误：缺少右括号 + 带尾逗号
    jsonText.value = '{\n  "name": "broken",\n  "panelGroups": [\n    { "id": "g1", }\n  \n';
    message.info('已写入非法 JSON（用于测试行/列定位）');
  };

  const loadNotDashboardJson = () => {
    jsonText.value = JSON.stringify({ hello: 'world', ok: true }, null, 2);
    message.info('已写入非 Dashboard JSON（用于测试“看起来不是 Dashboard”提示）');
  };

  // 默认先加载一次，方便打开页面直接看到效果
  void loadDefaultDashboard();
</script>

<style scoped lang="less">
  .dp-json-editor-showcase {
    padding: 14px 16px 18px;

    &__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    &__h1 {
      font-size: 15px;
      font-weight: 650;
      letter-spacing: 0.2px;
      color: var(--gf-color-text);
    }

    &__sub {
      margin-top: 2px;
      font-size: 12px;
      color: var(--gf-color-text-secondary);
      line-height: 1.5;
    }

    &__toolbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    &__grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    &__hint {
      color: var(--gf-color-text-secondary);
      font-size: 12px;
    }
  }
</style>
