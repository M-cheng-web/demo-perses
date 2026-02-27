/**
 * BEM / createNamespace 工具
 *
 * 设计目标：
 * - 输出稳定的 className，减少手写拼接错误
 * - API 足够简单：`bem()` / `bem('el')` / `bem({ mod: true })`
 * - 支持可选命名空间（用于多包/多实例的样式隔离）
 */

export type Mod = string | Record<string, any>;
export type Mods = Mod | Mod[];

export interface BEM {
  /**
   * 生成 className
   *
   * 入参约定：
   * - `bem()`：生成 block
   * - `bem('el')`：生成 block__el
   * - `bem({ disabled: true })`：生成 block + block--disabled
   * - `bem('el', { disabled: true })`：生成 block__el + block__el--disabled
   */
  (el?: Mods, mods?: Mods): string;
  b: () => string;
  e: (element: string) => string;
  m: (modifier: string) => string;
  em: (element: string, modifier: string) => string;
}

export interface CreateNamespaceOptions {
  /**
   * className 前缀（命名空间）
   *
   * 默认：`gf`
   *
   * 示例：
   * - `createNamespace('button')` -> `gf-button`（默认 namespace）
   * - `createNamespace('button', { namespace: 'dp' })` -> `dp-button`（自定义 namespace）
   */
  namespace?: string;
}

export const DEFAULT_BEM_NAMESPACE = 'gf';

const ELEMENT_SEPARATOR = '__';
const MODIFIER_SEPARATOR = '--';

function genBem(name: string, mods?: Mods): string {
  if (!mods) return '';

  if (typeof mods === 'string') {
    return ` ${name}${MODIFIER_SEPARATOR}${mods}`;
  }

  if (Array.isArray(mods)) {
    return mods.reduce<string>((ret, item) => ret + genBem(name, item), '');
  }

  return Object.keys(mods).reduce((ret, key) => {
    if ((mods as Record<string, any>)[key]) ret += ` ${name}${MODIFIER_SEPARATOR}${key}`;
    return ret;
  }, '');
}

/**
 * 创建命名空间 + bem 函数
 *
 * @param blockName 块名（不含 namespace 前缀）
 * @param options 可选配置（namespace 等）
 * @returns `[prefixedBlockName, bem]`（前缀后的 blockName 与 bem 函数）
 *
 * @example
 * const [_, bem] = createNamespace('json-editor-lite');
 * bem() // gf-json-editor-lite（根 block）
 * bem('pos') // gf-json-editor-lite__pos（元素）
 * bem({ disabled: true }) // gf-json-editor-lite gf-json-editor-lite--disabled（状态）
 */
export function createNamespace(blockName: string, options: CreateNamespaceOptions = {}): [string, BEM] {
  const namespace = options.namespace ?? DEFAULT_BEM_NAMESPACE;
  const prefixedName = `${namespace}-${blockName}`;

  const bem = ((el?: Mods, mods?: Mods): string => {
    // bem({ disabled: true })
    if (el && typeof el !== 'string') {
      mods = el;
      el = '';
    }

    let name = prefixedName;
    if (el) name += `${ELEMENT_SEPARATOR}${el}`;

    return name + genBem(name, mods);
  }) as BEM;

  bem.b = () => prefixedName;
  bem.e = (element: string) => `${prefixedName}${ELEMENT_SEPARATOR}${element}`;
  bem.m = (modifier: string) => `${prefixedName}${MODIFIER_SEPARATOR}${modifier}`;
  bem.em = (element: string, modifier: string) => `${prefixedName}${ELEMENT_SEPARATOR}${element}${MODIFIER_SEPARATOR}${modifier}`;

  return [prefixedName, bem];
}
