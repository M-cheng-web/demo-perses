# 问题修复总结

## 修复日期
2025-11-13

## 修复的问题

### 1. ECharts 错误 ✅
**问题描述：**
- 在编辑模式下调整子面板容器大小后，控制台报错：
  - `[ECharts] cartesian2d cannot be found for series.line (index: 2)`
  - `[ECharts] No coordinate system that supports convertFromPixel found by the given finder`
- Tooltip 不再显示

**修复方案：**
- 在 `src/components/ChartTooltip/ChartTooltip.vue` 的 `findNearbySeries()` 方法中增加了保护性检查：
  1. 检查 ECharts 实例是否已被销毁 (`isDisposed()`)
  2. 检查 option 和 series 是否已初始化，确保坐标系统可用
  3. 优化了代码，避免重复调用 `getOption()`

**修改的文件：**
- `src/components/ChartTooltip/ChartTooltip.vue`

---

### 2. 面板编辑器样式配置警告 ✅
**问题描述：**
- 进入图表样式配置时，控制台报警告：
  - `[Vue warn]: Invalid prop: type check failed for prop "value". Expected String | Number, got Undefined`
- 所有配置项为英文，需要中文化

**修复方案：**
1. **确保所有默认值存在：**
   - 在 `TimeSeriesChartStyles.vue` 和 `GaugeChartStyles.vue` 中，将所有可能为 `undefined` 的 `a-input` 改为 `a-input-number`，以正确处理数字类型

2. **完整中文化：**
   - 将所有英文标签、选项、按钮文本改为中文
   - 包括：图例、Y轴、阈值、视觉等所有配置模块

**修改的文件：**
- `src/components/PanelEditor/ChartStyles/TimeSeriesChartStyles.vue`
- `src/components/PanelEditor/ChartStyles/GaugeChartStyles.vue`

**中文化列表：**
- Legend → 图例
- Y AXIS → Y 轴
- Thresholds → 阈值
- Visual → 视觉
- Show → 显示
- Position → 位置
- Mode → 模式
- Size → 大小
- Values → 显示值
- Short values → 缩写数值
- Unit → 单位
- Decimals → 小数位数
- Label → 标签
- Min/Max → 最小值/最大值
- Stack Series → 堆叠模式
- Display → 显示类型
- Line Width → 线宽
- Line Style → 线条样式
- Area Opacity → 区域透明度
- Connect Nulls → 连接空值
- Calculation → 计算方式
- Show legend → 显示图例

---

### 3. Monaco Editor Worker 错误 ✅
**问题描述：**
- 进入 JSON 编辑时报错：
  - `Uncaught (in promise) Error: You must define a function MonacoEnvironment.getWorkerUrl or MonacoEnvironment.getWorker`

**修复方案：**
1. **创建 Monaco Worker 配置文件：**
   - 新增 `src/monaco-worker.ts`
   - 配置 `self.MonacoEnvironment` 以提供 JSON 和 Editor worker

2. **更新 JsonEditor 组件：**
   - 修改 import 语句，从 `@/monaco-worker` 导入 monaco，确保 worker 配置被正确加载

3. **优化 Vite 配置：**
   - 在 `vite.config.ts` 中添加 Monaco Editor 的优化配置
   - 使用 `optimizeDeps` 预构建 monaco-editor
   - 使用 `manualChunks` 将 monaco-editor 单独打包

**新增的文件：**
- `src/monaco-worker.ts`

**修改的文件：**
- `src/components/Common/JsonEditor.vue`
- `vite.config.ts`

---

## 验证步骤

### 测试问题1（ECharts 错误）
1. 进入编辑模式
2. 调整任意子面板的大小（拖拽边角）
3. 鼠标移动到面板上
4. ✅ 不应该有 ECharts 错误
5. ✅ Tooltip 应该正常显示

### 测试问题2（样式配置警告）
1. 点击任意面板的编辑按钮
2. 切换到"图表样式" Tab
3. ✅ 不应该有 Vue warn
4. ✅ 所有配置项应该显示中文
5. ✅ 所有输入框应该有正确的值或 placeholder

### 测试问题3（Monaco Editor）
1. 点击任意面板的编辑按钮
2. 切换到"JSON 编辑" Tab
3. ✅ 不应该有 Monaco Worker 错误
4. ✅ JSON 编辑器应该正常加载并显示代码高亮
5. ✅ 可以正常编辑 JSON

---

## 技术要点

### ECharts 实例状态管理
- 始终检查实例是否已销毁（`isDisposed()`）
- 确保坐标系统已初始化再调用坐标转换方法
- 使用 try-catch 包裹可能失败的 ECharts API 调用

### Vue 表单数据绑定
- 使用 `a-input-number` 处理数字类型输入
- 确保所有 v-model 绑定的值都有默认值
- 使用 `deepClone` 确保数据的深拷贝

### Monaco Editor 在 Vite 中的配置
- 需要显式配置 worker 环境
- 使用 `?worker` 导入语法加载 worker
- 预构建和单独打包可以优化加载性能

---

## 后续优化建议

1. **性能优化：**
   - 考虑使用 Web Worker 处理大量数据的图表渲染
   - 优化 ECharts resize 的防抖策略

2. **错误处理：**
   - 添加全局错误边界组件
   - 改进错误提示的用户友好性

3. **可访问性：**
   - 为所有表单控件添加适当的 aria-label
   - 确保键盘导航的流畅性

4. **国际化：**
   - 考虑使用 vue-i18n 实现完整的国际化支持
   - 将所有硬编码的中文文本提取到语言文件

---

## 相关文档

- [ECharts API 文档](https://echarts.apache.org/zh/api.html)
- [Monaco Editor 文档](https://microsoft.github.io/monaco-editor/)
- [Vite Worker 文档](https://vitejs.dev/guide/features.html#web-workers)
- [Ant Design Vue 表单文档](https://antdv.com/components/form-cn)
