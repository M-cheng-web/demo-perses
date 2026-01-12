/**
 * BEM naming helper for the UI kit
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

const NAMESPACE = 'gf';
const ELEMENT_SEPARATOR = '__';
const MODIFIER_SEPARATOR = '--';

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

export function createNamespace(blockName: string): [string, BEM] {
  const prefixedName = `${NAMESPACE}-${blockName}`;

  const bem = ((el?: Mods, mods?: Mods): string => {
    if (el && typeof el !== 'string') {
      mods = el;
      el = '';
    }

    let name = prefixedName;
    if (el) {
      name += `${ELEMENT_SEPARATOR}${el}`;
    }

    return name + genBem(name, mods);
  }) as BEM;

  bem.b = () => prefixedName;
  bem.e = (element: string) => `${prefixedName}${ELEMENT_SEPARATOR}${element}`;
  bem.m = (modifier: string) => `${prefixedName}${MODIFIER_SEPARATOR}${modifier}`;
  bem.em = (element: string, modifier: string) => `${prefixedName}${ELEMENT_SEPARATOR}${element}${MODIFIER_SEPARATOR}${modifier}`;

  return [prefixedName, bem];
}
