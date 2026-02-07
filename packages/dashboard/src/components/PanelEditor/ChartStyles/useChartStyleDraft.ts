import { ref, watch, type Ref } from 'vue';
import { deepClone } from '/#/utils';
import { deepMerge } from './utils';

interface UseChartStyleDraftOptions<T extends Record<string, any>> {
  getOptions: () => T | undefined;
  getDefaults: () => T;
  emitUpdate: (next: T) => void;
}

const toStableSignature = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '__unstringifiable__';
  }
};

export function useChartStyleDraft<T extends Record<string, any>>(options: UseChartStyleDraftOptions<T>) {
  const buildMerged = (override?: T): T => deepClone(deepMerge(options.getDefaults(), override ?? {}));

  const localOptions = ref<T>(buildMerged(options.getOptions())) as Ref<T>;

  const emitUpdate = (next: T) => {
    options.emitUpdate(deepClone(next));
  };

  const resetToDefaults = () => {
    const defaults = options.getDefaults();
    localOptions.value = deepClone(defaults);
    emitUpdate(defaults);
  };

  watch(
    localOptions,
    (next) => {
      emitUpdate(next);
    },
    { deep: true }
  );

  watch(
    () => options.getOptions(),
    (next) => {
      if (!next) return;
      const currentSig = toStableSignature(localOptions.value);
      const nextSig = toStableSignature(next);
      if (currentSig === nextSig) return;
      localOptions.value = buildMerged(next);
    },
    { deep: true }
  );

  return {
    localOptions,
    resetToDefaults,
  };
}
