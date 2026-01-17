import type { Ref } from 'vue';
import type { GfFormRuleTrigger, GfFormRules } from '../../types';

export const gfFormLayoutKey = 'gf-form-layout';
export const gfFormLabelSpanKey = 'gf-form-label-span';
export const gfFormContextKey = 'gf-form-context';
export const gfFormItemContextKey = 'gf-form-item-context';

export type GfFormValidateTrigger = GfFormRuleTrigger;

export interface GfFormItemInstance {
  prop: string;
  validate: (trigger?: GfFormValidateTrigger) => Promise<boolean>;
  resetField: () => void;
  clearValidate: () => void;
}

export interface GfFormContext {
  model: Ref<Record<string, any> | undefined>;
  rules: Ref<GfFormRules | undefined>;
  addField: (field: GfFormItemInstance) => void;
  removeField: (prop: string) => void;
}

export interface GfFormItemContext {
  prop?: string;
  onFieldChange: () => void;
  onFieldBlur: () => void;
  clearValidate: () => void;
}
