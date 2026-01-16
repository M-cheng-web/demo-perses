/**
 * 文件说明：BEM / createNamespace（json-editor 内部样式命名工具）
 *
 * 背景：
 * - 仓库里其它 UI 包（dashboard/component）普遍使用 `createNamespace` 来生成 BEM class
 * - json-editor 作为独立子包，也需要同样的能力，避免手写 class 名称导致风格不统一/容易拼错
 *
 * 设计选择（避免过度设计）：
 * - 不从其它包“引用内部工具文件”（那会让依赖关系变复杂）
 * - 在 json-editor 内部实现一份极小的 createNamespace：
 *   - 足够覆盖我们的需求：`bem()` / `bem('el')` / `bem({ mod: true })` 等
 *   - namespace 使用 `gf`，与组件库 token 前缀保持一致
 *
 * 注意：
 * - 该工具目前仅供 json-editor 包内部使用（不对外暴露为公共 API）
 */

export type Mod = string | { [key: string]: any };
export type Mods = Mod | Mod[];

export interface BEM {
  (el?: Mods, mods?: Mods): string;
  b: () => string;
  e: (element: string) => string;
  m: (modifier: string) => string;
  em: (element: string, modifier: string) => string;
}

// json-editor 的默认命名空间前缀（与组件库一致）
const NAMESPACE = 'gf';

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
    if (mods[key]) ret += ` ${name}${MODIFIER_SEPARATOR}${key}`;
    return ret;
  }, '');
}

/**
 * 创建命名空间 + bem 函数
 *
 * @example
 * const [_, bem] = createNamespace('json-editor-lite');
 * bem() // gf-json-editor-lite
 * bem('pos') // gf-json-editor-lite__pos
 * bem({ disabled: true }) // gf-json-editor-lite gf-json-editor-lite--disabled
 */
export function createNamespace(blockName: string): [string, BEM] {
  const prefixedName = `${NAMESPACE}-${blockName}`;

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

