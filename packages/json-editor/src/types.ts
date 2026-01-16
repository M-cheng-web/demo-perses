/**
 * 类型说明：json-editor 的对外类型定义
 *
 * 说明：
 * - 这里的类型是 json-editor 的“对外契约”
 * - 上层（dashboard/app）可以依赖这些稳定类型，而不需要关心内部实现细节
 */

/**
 * JSON 解析错误（带位置）
 */
export interface JsonParseError {
  /** 错误描述（适合直接展示给用户） */
  message: string;
  /** 错误 offset（从 0 开始） */
  offset: number;
  /** 错误所在行（从 1 开始） */
  line: number;
  /** 错误所在列（从 1 开始） */
  column: number;
}

/**
 * 一段 JSON 文本的诊断结果（通用）
 */
export interface JsonTextDiagnostics {
  /** 是否能被解析成 JSON */
  ok: boolean;
  /** 解析后的值（仅 ok=true 时存在） */
  value?: unknown;
  /** 解析错误（仅 ok=false 时存在） */
  error?: JsonParseError;
}

/**
 * JSON 文本外部校验钩子（由宿主注入）
 *
 * 用途：
 * - json-editor 内置只做“JSON 语法合法性校验”（能否 parse）
 * - 更严格的“业务合法性校验”（是否符合当前 dashboard 定义、字段必填、引用一致性等）由宿主决定
 *
 * 调用时机：
 * - 每次用户输入变化都会调用（包含 JSON 不合法的情况）
 *
 * 返回值：
 * - 返回空数组：表示通过
 * - 返回字符串数组：每一条错误信息可直接展示给用户
 */
export type JsonTextValidator = (text: string, parsedValue: unknown | undefined) => string[] | Promise<string[]>;

/**
 * Dashboard JSON 的精简摘要（用于 UI 提示，不用于严格校验）
 */
export interface DashboardSummary {
  /** 面板组数量 */
  panelGroupCount: number;
  /** 面板数量 */
  panelCount: number;
  /** 变量数量 */
  variableCount: number;
}
