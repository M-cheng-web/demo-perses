/**
 * BEM 命名规范工具函数
 * 参考 Vant 的实现方式
 */

export type Mod = string | { [key: string]: any };
export type Mods = Mod | Mod[];

// BEM 函数类型定义
export interface BEM {
  (el?: Mods, mods?: Mods): string;
  b: () => string;
  e: (element: string) => string;
  m: (modifier: string) => string;
  em: (element: string, modifier: string) => string;
}

// 默认命名空间前缀
const NAMESPACE = 'dp'; // demo-perses 缩写

// BEM 分隔符配置
const ELEMENT_SEPARATOR = '__';
const MODIFIER_SEPARATOR = '--';

/**
 * 将修饰符对象转换为类名数组
 */
function genBem(name: string, mods?: Mods): string {
  if (!mods) {
    return '';
  }

  if (typeof mods === 'string') {
    return ` ${name}${MODIFIER_SEPARATOR}${mods}`;
  }

  if (Array.isArray(mods)) {
    return mods.reduce<string>((ret, item) => ret + genBem(name, item), '');
  }

  return Object.keys(mods).reduce((ret, key) => {
    if (mods[key]) {
      ret += ` ${name}${MODIFIER_SEPARATOR}${key}`;
    }
    return ret;
  }, '');
}

/**
 * 创建 BEM 命名空间
 * @param blockName 块名称（不包含命名空间前缀）
 * @returns [完整块名, bem函数]
 *
 * @example
 * const [_, bem] = createNamespace('button');
 *
 * // 使用方式：
 * bem() // 'dp-button'
 * bem('text') // 'dp-button__text'
 * bem('text', 'primary') // 'dp-button__text dp-button__text--primary'
 * bem({ disabled: true }) // 'dp-button dp-button--disabled'
 * bem('text', { disabled: true }) // 'dp-button__text dp-button__text--disabled'
 */
export function createNamespace(blockName: string): [string, BEM] {
  const prefixedName = `${NAMESPACE}-${blockName}`;

  const bem = ((el?: Mods, mods?: Mods): string => {
    // 只有块名
    if (el && typeof el !== 'string') {
      mods = el;
      el = '';
    }

    // 基础类名
    let name = prefixedName;
    if (el) {
      name += `${ELEMENT_SEPARATOR}${el}`;
    }

    // 添加修饰符
    return name + genBem(name, mods);
  }) as BEM;

  // 简写方法
  bem.b = () => prefixedName;
  bem.e = (element: string) => `${prefixedName}${ELEMENT_SEPARATOR}${element}`;
  bem.m = (modifier: string) => `${prefixedName}${MODIFIER_SEPARATOR}${modifier}`;
  bem.em = (element: string, modifier: string) => `${prefixedName}${ELEMENT_SEPARATOR}${element}${MODIFIER_SEPARATOR}${modifier}`;

  return [prefixedName, bem];
}
