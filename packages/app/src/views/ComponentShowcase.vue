<!--
  文件说明：演示站点 - 组件展示页

  作用：
  - 用于快速浏览 @grafana-fast/component 的视觉密度与交互一致性
  - 作为 UI 组件回归测试的人工入口
-->
<template>
  <ConfigProvider theme="inherit">
    <div class="dp-component-showcase">
      <div class="dp-component-showcase__header">
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
            <Button size="small" type="ghost">Shortcut</Button>
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

            <FormItem label="Select (long list scroll)">
              <Select v-model:value="form.longEnv" :options="longEnvOptions" placeholder="下拉项很多时出现滚动条" allow-clear />
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

        <Card title="Form Validation (provide/inject)" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <div class="dp-component-showcase__hint">点击“校验”后，未通过规则的字段下方会显示红色提示。</div>
            <Form ref="validateFormRef" :model="validateForm" :rules="validateRules" layout="vertical">
              <FormItem label="用户名" prop="username">
                <Input v-model:value="validateForm.username" placeholder="至少 3 个字符" allow-clear />
              </FormItem>

              <FormItem label="邮箱" prop="email">
                <Input v-model:value="validateForm.email" placeholder="name@example.com" allow-clear />
              </FormItem>

              <FormItem label="环境" prop="env">
                <Select v-model:value="validateForm.env" :options="envOptions" placeholder="选择环境" allow-clear />
              </FormItem>

              <FormItem label="阈值" prop="threshold">
                <InputNumber v-model:value="validateForm.threshold" :min="0" :max="100" />
              </FormItem>

              <FormItem label="标签（至少选择 1 个）" prop="tags">
                <Select v-model:value="validateForm.tags" mode="multiple" show-search :options="tagOptions" placeholder="选择标签" allow-clear />
              </FormItem>

              <FormItem>
                <Space :size="8">
                  <Button type="primary" @click="handleValidate">校验</Button>
                  <Button type="ghost" @click="handleResetValidate">重置</Button>
                </Space>
              </FormItem>
            </Form>
          </Space>
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

        <Card title="List (Variants / Slots)" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <div class="dp-component-showcase__hint">KV：适合调试信息（插槽按 item.key：#dsn、#ready ...）</div>
            <List :items="listKvItems" variant="kv" size="small" :split="false" :hoverable="true">
              <template #dsn="{ value }">
                <span class="dp-component-showcase__mono">{{ value }}</span>
              </template>
              <template #ready="{ value, item }">
                <Tag :color="item.color">{{ value }}</Tag>
              </template>
            </List>

            <Divider />

            <div class="dp-component-showcase__hint">Lines：无外边框，一行行样式集合（适合弹窗/详情页）</div>
            <List :items="listKvItems" variant="lines" size="small" :split="false" :hoverable="true">
              <template #dsn="{ value }">
                <span class="dp-component-showcase__mono">{{ value }}</span>
              </template>
              <template #ready="{ value, item }">
                <Tag :color="item.color">{{ value }}</Tag>
              </template>
            </List>

            <Divider />

            <div class="dp-component-showcase__hint">Grid：卡片式列表（适合概览信息）</div>
            <List :items="listGridItems" variant="grid" :columns="2" size="small" :hoverable="true" :bordered="true" />

            <Divider />

            <div class="dp-component-showcase__hint">Empty slot：无数据时的自定义占位</div>
            <List :items="[]" variant="kv" size="small">
              <template #empty>
                <Empty description="暂无字段" />
              </template>
            </List>
          </Space>
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
                <div class="dp-component-showcase__box">span 8</div>
              </Col>
              <Col :span="8">
                <div class="dp-component-showcase__box">span 8</div>
              </Col>
              <Col :span="8">
                <div class="dp-component-showcase__box">span 8</div>
              </Col>
            </Row>
          </Space>
        </Card>

        <Card title="Cards (Zebra)" size="small" :bordered="true">
          <div class="dp-component-showcase__card-list dp-component-showcase__card-list--zebra">
            <div v-for="card in cards" :key="card.key" class="dp-component-showcase__card-wrap">
              <Card :title="card.title" size="small" :bordered="true">
                <Flex justify="between" :gap="10">
                  <div class="dp-component-showcase__card-meta">
                    <div class="dp-component-showcase__card-desc">{{ card.desc }}</div>
                    <div class="dp-component-showcase__card-sub">Key: {{ card.key }}</div>
                  </div>
                  <Tag :color="card.tagColor">{{ card.tag }}</Tag>
                </Flex>
              </Card>
            </div>
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
    List,
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
    longEnv: undefined as string | undefined,
  });

  const validateFormRef = ref<any>(null);
  const validateForm = reactive({
    username: '',
    email: '',
    env: undefined as string | undefined,
    threshold: undefined as number | undefined,
    tags: [] as string[],
  });

  const validateRules = {
    username: [
      { required: true, message: '请输入用户名' },
      { min: 3, message: '用户名至少 3 个字符' },
    ],
    email: [
      { required: true, message: '请输入邮箱' },
      { pattern: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/, message: '邮箱格式不正确' },
    ],
    env: [{ required: true, message: '请选择环境' }],
    threshold: [{ required: true, message: '请输入阈值' }],
    tags: [{ min: 1, message: '至少选择 1 个标签' }],
  };

  const envOptions = [
    { label: 'prod', value: 'prod' },
    { label: 'staging', value: 'staging' },
    { label: 'dev', value: 'dev' },
  ];

  const longEnvOptions = Array.from({ length: 80 }, (_, i) => {
    const idx = i + 1;
    return {
      label: `Option ${String(idx).padStart(2, '0')} - a very long label for scroll demo`,
      value: `opt-${idx}`,
    };
  });

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

  const handleValidate = async () => {
    const ok = await validateFormRef.value?.validate?.();
    if (ok) message.success('校验通过');
    else message.error('校验未通过，请检查红色提示');
  };

  const handleResetValidate = () => {
    validateFormRef.value?.resetFields?.();
    validateFormRef.value?.clearValidate?.();
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

  const listKvItems = computed(() => [
    { key: 'size', label: '容器尺寸', value: '1280 × 720', kind: 'plain' },
    { key: 'dsn', label: '当前 DSN', value: 'https://api.example.com', kind: 'dsn' },
    { key: 'load', label: '加载接口', value: '/custom/load', kind: 'plain' },
    { key: 'query', label: '查询接口', value: '/custom/execute', kind: 'plain' },
    { key: 'ready', label: '挂载状态', value: '已挂载', kind: 'status', color: 'var(--gf-color-success)' },
  ]);

  const listGridItems = computed(() => [
    { key: 'g1', label: 'Service A', value: '核心服务，吞吐稳定，延迟低。' },
    { key: 'g2', label: 'Service B', value: '近期有轻微抖动，建议关注错误率。' },
    { key: 'g3', label: 'Service C', value: '链路依赖较多，建议配置更细粒度告警。' },
    { key: 'g4', label: 'Service D', value: 'CPU 突增，可能存在热点或流量突刺。' },
  ]);

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
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border);
      transition:
        box-shadow var(--gf-motion-normal) var(--gf-easing),
        border-color var(--gf-motion-normal) var(--gf-easing),
        transform var(--gf-motion-normal) var(--gf-easing);
    }

    &__header:hover {
      border-color: var(--gf-color-border-strong);
      box-shadow: var(--gf-shadow-1);
      transform: translateY(-1px);
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

    &__card-list--zebra {
      > .dp-component-showcase__card-wrap:nth-child(even) {
        --gf-card-bg: var(--gf-color-zebra);
      }
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
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      transition:
        box-shadow var(--gf-motion-normal) var(--gf-easing),
        border-color var(--gf-motion-normal) var(--gf-easing),
        transform var(--gf-motion-normal) var(--gf-easing);
    }

    &__box:hover {
      border-color: var(--gf-color-border-strong);
      box-shadow: var(--gf-shadow-1);
      transform: translateY(-1px);
    }

    &__mono {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px solid var(--gf-color-border-muted);
      background: var(--gf-color-surface-muted);
      color: var(--gf-color-text);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
