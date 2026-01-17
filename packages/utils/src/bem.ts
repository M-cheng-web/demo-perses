/**
 * BEM / createNamespace 工具
 *
 * 设计目标：
 * - 输出稳定的 className，减少手写拼接错误
 * - API 足够简单：`bem()` / `bem('el')` / `bem({ mod: true })`
 * - 支持“可选命名空间”，以兼容历史样式前缀（例如 dp-xxx）
 */

export type Mod = string | Record<string, any>;
export type Mods = Mod | Mod[];

export interface BEM {
  /**
   * 生成 className
   *
   * 入参约定：
   * - `bem()`：仅 block
   * - `bem('el')`：block__el
   * - `bem({ disabled: true })`：block + block--disabled
   * - `bem('el', { disabled: true })`：block__el + block__el--disabled
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
   * - `createNamespace('button')` -> `gf-button`
   * - `createNamespace('button', { namespace: 'dp' })` -> `dp-button`
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
 * @returns `[prefixedBlockName, bem]`
 *
 * @example
 * const [_, bem] = createNamespace('json-editor-lite');
 * bem() // gf-json-editor-lite
 * bem('pos') // gf-json-editor-lite__pos
 * bem({ disabled: true }) // gf-json-editor-lite gf-json-editor-lite--disabled
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
