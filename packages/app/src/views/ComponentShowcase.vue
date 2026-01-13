<template>
  <ConfigProvider theme="inherit">
    <div class="dp-component-showcase">
      <div class="dp-component-showcase__header gf-surface">
        <div class="dp-component-showcase__title">
          <div class="dp-component-showcase__h1">@grafana-fast/component 组件展示</div>
          <div class="dp-component-showcase__sub">用于快速浏览组件状态、密度与交互（基于统一主题 Token）。</div>
        </div>

        <Flex justify="end" :gap="10" wrap>
          <Segmented v-model:value="themeModel" size="small" :options="themeOptions" />
          <Button size="small" type="ghost" @click="goHome">返回 Dashboard</Button>
        </Flex>
      </div>

      <div class="dp-component-showcase__grid">
        <Card title="Buttons" size="small" :bordered="true">
          <Space wrap :size="8">
            <Button type="primary" @click="notify('primary')">Primary</Button>
            <Button type="default" @click="notify('default')">Default</Button>
            <Button type="ghost" @click="notify('ghost')">Ghost</Button>
            <Button type="dashed" @click="notify('dashed')">Dashed</Button>
            <Button type="text" @click="notify('text')">Text</Button>
            <Button type="link" @click="notify('link')">Link</Button>
            <Button danger @click="notify('danger')">Danger</Button>
            <Button :loading="loadingBtn" type="primary" @click="triggerLoading">Loading</Button>
            <Button disabled>Disabled</Button>
          </Space>

          <Divider />

          <Space wrap :size="8">
            <Button size="small" type="primary">Small</Button>
            <Button size="middle" type="primary">Middle</Button>
            <Button size="large" type="primary">Large</Button>
            <Button size="small" type="ghost" shortcut="Ctrl+K">Shortcut</Button>
          </Space>
        </Card>

        <Card title="Tabs / Divider / Tag" size="small" :bordered="true">
          <Tabs v-model:activeKey="tabsActiveKey">
            <TabPane name="overview" tab="Overview">
              <Space direction="vertical" :size="10" style="width: 100%">
                <div class="dp-component-showcase__hint">Tabs + Tag + Divider + message API</div>
                <Space wrap :size="8">
                  <Tag color="var(--gf-color-primary)">core</Tag>
                  <Tag color="var(--gf-color-success)">healthy</Tag>
                  <Tag color="var(--gf-color-warning)">warning</Tag>
                </Space>
                <Divider />
                <Button size="small" type="ghost" @click="notify('tab:overview')">Trigger message</Button>
              </Space>
            </TabPane>
            <TabPane name="detail" tab="Detail">
              <div class="dp-component-showcase__hint">这里是 Detail 内容</div>
            </TabPane>
          </Tabs>
        </Card>

        <Card title="Form Controls" size="small" :bordered="true">
          <Form :model="form" layout="vertical">
            <FormItem label="Input" required>
              <Input v-model:value="form.name" placeholder="输入名称" allow-clear />
            </FormItem>

            <FormItem label="Textarea">
              <Textarea v-model:value="form.desc" :rows="2" placeholder="简短描述" />
            </FormItem>

            <FormItem label="Select">
              <Select v-model:value="form.env" :options="envOptions" placeholder="选择环境" allow-clear />
            </FormItem>

            <FormItem label="Select (multiple + search)">
              <Select v-model:value="form.tags" mode="multiple" show-search :options="tagOptions" placeholder="选择标签" allow-clear />
            </FormItem>

            <FormItem label="InputNumber">
              <InputNumber v-model:value="form.threshold" :min="0" :max="100" />
            </FormItem>

            <FormItem label="Slider">
              <Slider v-model:value="form.opacity" :min="0" :max="100" :step="5" />
            </FormItem>

            <FormItem label="Cascader">
              <Cascader v-model:value="form.cascader" :options="cascaderOptions" placeholder="选择路径" />
            </FormItem>

            <FormItem label="Switch / Checkbox">
              <Space :size="12" wrap>
                <Space :size="8">
                  <span class="dp-component-showcase__hint">Switch</span>
                  <Switch v-model:checked="form.enabled" />
                </Space>
                <Checkbox v-model:modelValue="form.checked">Checkbox</Checkbox>
              </Space>
            </FormItem>
          </Form>
        </Card>

        <Card title="Navigation (Dropdown / Menu)" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <Dropdown>
              <Button type="ghost">Dropdown Menu</Button>
              <template #overlay>
                <Menu :items="menuItems" @click="handleMenuClick" />
              </template>
            </Dropdown>

            <Divider />

            <div class="dp-component-showcase__hint">MenuItem (slot-driven)</div>
            <Menu @click="handleMenuClick">
              <MenuItem eventKey="a">Action A</MenuItem>
              <MenuItem eventKey="b">Action B</MenuItem>
            </Menu>
          </Space>
        </Card>

        <Card title="Feedback" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <Alert type="info" show-icon message="Info" description="这是信息提示，保持低饱和与克制对比。" />
            <Alert type="success" show-icon message="Success" description="成功提示（低饱和绿）。" />
            <Alert type="warning" show-icon message="Warning" description="警告提示（低饱和黄）。" />
            <Alert type="error" show-icon message="Error" description="错误提示（低饱和红）。" />
          </Space>

          <Divider />

          <Space wrap :size="8">
            <Button type="primary" @click="modalOpen = true">Open Modal</Button>
            <Button type="ghost" @click="drawerOpen = true">Open Drawer</Button>
            <Tooltip title="遵循主题 tooltip（哑光背景 + 冷灰边框）">
              <Button type="text">Tooltip</Button>
            </Tooltip>
            <Popconfirm title="确认执行该操作？" @confirm="notify('confirmed')" @cancel="notify('canceled')">
              <Button type="text">Popconfirm</Button>
            </Popconfirm>
          </Space>

          <Divider />

          <Space wrap :size="10">
            <Spin tip="加载中..." />
            <Loading text="Loading..." />
          </Space>
        </Card>

        <Card title="Data Display (Table + Zebra)" size="small" :bordered="true">
          <Table :columns="tableColumns" :data-source="tableData" :pagination="tablePagination" size="small" />
        </Card>

        <Card title="Empty / Alert" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <Empty description="暂无告警规则" />
            <Alert type="success" show-icon message="Saved" description="配置已保存并生效。" />
          </Space>
        </Card>

        <Card title="Layout (Space / Flex / Row / Col)" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <div class="dp-component-showcase__hint">Flex</div>
            <Flex justify="between" :gap="10">
              <Tag color="var(--gf-color-primary)">Left</Tag>
              <Tag color="var(--gf-color-primary-secondary)">Right</Tag>
            </Flex>

            <Divider />

            <div class="dp-component-showcase__hint">Row / Col</div>
            <Row :gutter="[10, 10]">
              <Col :span="8">
                <div class="dp-component-showcase__box gf-surface">span 8</div>
              </Col>
              <Col :span="8">
                <div class="dp-component-showcase__box gf-surface">span 8</div>
              </Col>
              <Col :span="8">
                <div class="dp-component-showcase__box gf-surface">span 8</div>
              </Col>
            </Row>
          </Space>
        </Card>

        <Card title="Cards (Zebra)" size="small" :bordered="true">
          <div class="gf-zebra-cards dp-component-showcase__card-list">
            <Card v-for="card in cards" :key="card.key" :title="card.title" size="small" :bordered="true">
              <Flex justify="between" :gap="10">
                <div class="dp-component-showcase__card-meta">
                  <div class="dp-component-showcase__card-desc">{{ card.desc }}</div>
                  <div class="dp-component-showcase__card-sub">Key: {{ card.key }}</div>
                </div>
                <Tag :color="card.tagColor">{{ card.tag }}</Tag>
              </Flex>
            </Card>
          </div>
        </Card>
      </div>

      <Modal v-model:open="modalOpen" title="Modal 示例" :width="560" @cancel="modalOpen = false">
        <div class="dp-component-showcase__modal-body">
          <Alert type="info" show-icon message="说明" description="Modal/Drawer 仅在浮层场景使用克制阴影。默认圆角 2–4px。" />
          <Divider />
          <Form layout="horizontal" :label-col="{ span: 8 }">
            <FormItem label="名称" required>
              <Input v-model:value="form.name" placeholder="输入名称" />
            </FormItem>
            <FormItem label="环境">
              <Select v-model:value="form.env" :options="envOptions" placeholder="选择环境" allow-clear />
            </FormItem>
          </Form>
        </div>
      </Modal>

      <Drawer v-model:open="drawerOpen" title="Drawer 示例" :width="520" @close="drawerOpen = false">
        <div class="dp-component-showcase__drawer-body">
          <Form layout="vertical">
            <FormItem label="过滤条件">
              <Input v-model:value="form.filter" placeholder="例如：instance=..." allow-clear />
            </FormItem>
            <FormItem label="标签">
              <Select v-model:value="form.tags" mode="multiple" show-search :options="tagOptions" placeholder="选择标签" allow-clear />
            </FormItem>
            <FormItem>
              <Space :size="8">
                <Button type="ghost" @click="drawerOpen = false">取消</Button>
                <Button type="primary" @click="notify('saved')">保存</Button>
              </Space>
            </FormItem>
          </Form>
        </div>
      </Drawer>
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    Alert,
    Button,
    Card,
    Checkbox,
    ConfigProvider,
    Cascader,
    Divider,
    Drawer,
    Dropdown,
    Empty,
    Flex,
    Form,
    FormItem,
    Input,
    Textarea,
    InputNumber,
    Loading,
    Menu,
    MenuItem,
    Modal,
    Popconfirm,
    // Result removed; Alert is the recommended replacement
    Segmented,
    Select,
    Slider,
    Space,
    Spin,
    Switch,
    Table,
    Tag,
    Tabs,
    TabPane,
    Tooltip,
    message,
  } from '@grafana-fast/component';
  import { getAppliedDashboardTheme, setDashboardThemePreference, type DashboardTheme } from '@grafana-fast/dashboard';

  const router = useRouter();

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

  const loadingBtn = ref(false);
  const modalOpen = ref(false);
  const drawerOpen = ref(false);
  const tabsActiveKey = ref('overview');

  const form = reactive({
    name: '',
    desc: '',
    env: 'prod',
    tags: ['core'],
    threshold: 42 as number | undefined,
    opacity: 60,
    enabled: true,
    checked: true,
    filter: '',
    cascader: [] as any[],
  });

  const envOptions = [
    { label: 'prod', value: 'prod' },
    { label: 'staging', value: 'staging' },
    { label: 'dev', value: 'dev' },
  ];

  const tagOptions = [
    { label: 'core', value: 'core' },
    { label: 'infra', value: 'infra' },
    { label: 'metrics', value: 'metrics' },
    { label: 'logs', value: 'logs' },
    { label: 'traces', value: 'traces' },
  ];

  const cascaderOptions = [
    {
      label: 'cluster-a',
      value: 'cluster-a',
      children: [
        { label: 'node-01', value: 'node-01' },
        { label: 'node-02', value: 'node-02' },
      ],
    },
    {
      label: 'cluster-b',
      value: 'cluster-b',
      children: [
        { label: 'node-03', value: 'node-03' },
        { label: 'node-04', value: 'node-04' },
      ],
    },
  ];

  const menuItems = [
    { key: 'reload', label: 'Reload' },
    { key: 'settings', label: 'Settings' },
  ];

  const notify = (label: string) => {
    message.success(`action: ${label}`);
  };

  const triggerLoading = async () => {
    if (loadingBtn.value) return;
    loadingBtn.value = true;
    message.loading({ content: '处理中...', key: 'demo-loading', duration: 0 });
    window.setTimeout(() => {
      loadingBtn.value = false;
      message.success({ content: '完成', key: 'demo-loading', duration: 1500 });
    }, 900);
  };

  const goHome = () => router.push('/home');

  const handleMenuClick = (payload: any) => {
    const key = typeof payload === 'string' ? payload : payload?.key;
    notify(`menu:${String(key)}`);
  };

  const tableColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Env', dataIndex: 'env', key: 'env' },
    { title: 'Value', dataIndex: 'value', key: 'value', sorter: (a: any, b: any) => a.value - b.value },
  ];

  const tableData = computed(() =>
    Array.from({ length: 14 }, (_, i) => ({
      key: `row-${i + 1}`,
      name: `metric_${String(i + 1).padStart(2, '0')}`,
      env: i % 3 === 0 ? 'prod' : i % 3 === 1 ? 'staging' : 'dev',
      value: Math.round((Math.sin(i / 2) * 50 + 50) * 10) / 10,
    }))
  );

  const tablePagination = {
    pageSize: 8,
    showSizeChanger: true,
    pageSizeOptions: ['8', '12', '20'],
    hideOnSinglePage: false,
    showTotal: (total: number) => `共 ${total} 条`,
  };

  const cards = computed(() => [
    { key: 'A', title: 'Panel Card A', desc: '用于高密度信息展示的卡片容器。', tag: 'core', tagColor: 'var(--gf-color-primary)' },
    { key: 'B', title: 'Panel Card B', desc: '偶数项使用极浅冷灰斑马底色。', tag: 'infra', tagColor: 'var(--gf-color-primary-secondary)' },
    { key: 'C', title: 'Panel Card C', desc: '边框 1px 冷灰蓝，hover 轻投影。', tag: 'metrics', tagColor: 'var(--gf-color-success)' },
    { key: 'D', title: 'Panel Card D', desc: '圆角统一 2–4px，保持硬朗线条。', tag: 'logs', tagColor: 'var(--gf-color-warning)' },
  ]);
</script>

<style scoped lang="less">
  .dp-component-showcase {
    width: 100%;
    min-height: 100%;
    padding: 12px;
    background: transparent;
    color: var(--gf-color-text);
    display: flex;
    flex-direction: column;
    gap: 12px;

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border-radius: var(--gf-radius-md);
    }

    &__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    &__h1 {
      font-size: 16px;
      font-weight: 750;
      letter-spacing: 0.2px;
      line-height: 1.2;
    }

    &__sub {
      font-size: 12px;
      color: var(--gf-color-text-tertiary);
    }

    &__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 12px;
      align-items: start;
    }

    &__hint {
      font-size: 12px;
      color: var(--gf-color-text-tertiary);
    }

    &__card-list {
      display: grid;
      gap: 10px;
    }

    &__card-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    &__card-desc {
      font-size: 13px;
      color: var(--gf-color-text);
    }

    &__card-sub {
      font-size: 12px;
      color: var(--gf-color-text-tertiary);
    }

    &__modal-body,
    &__drawer-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    &__box {
      padding: 10px;
      font-size: 12px;
      color: var(--gf-color-text-secondary);
    }
  }
</style>
