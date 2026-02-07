import type { ComputedRef, Ref } from 'vue';
import { moveActiveIndex, type SelectOptionLike } from './selectLogic';

type BoolLike = Ref<boolean> | ComputedRef<boolean>;

interface UseSelectKeyboardOptions<Option extends SelectOptionLike> {
  disabled: BoolLike;
  open: Ref<boolean>;
  search: Ref<string>;
  activeIndex: Ref<number>;
  filteredOptions: ComputedRef<Option[]>;
  isMultiple: ComputedRef<boolean>;
  isTags: ComputedRef<boolean>;

  openDropdown: () => void | Promise<void>;
  close: () => void;
  selectOption: (option: Option) => void;
  removeValue: (value: unknown) => void;
  updateValue: (value: unknown) => void;
  getValue: () => unknown;
}

export function useSelectKeyboard<Option extends SelectOptionLike>(options: UseSelectKeyboardOptions<Option>) {
  const isDisabled = () => Boolean(options.disabled.value);

  const handleKeydown = (evt: KeyboardEvent) => {
    if (isDisabled()) return;

    if (!options.open.value && (evt.key === 'ArrowDown' || evt.key === 'Enter' || evt.key === ' ')) {
      evt.preventDefault();
      void options.openDropdown();
      return;
    }

    if (!options.open.value) return;

    if (evt.key === 'Escape') {
      options.close();
      return;
    }

    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      evt.preventDefault();
      const dir = evt.key === 'ArrowDown' ? 1 : -1;
      const opts = options.filteredOptions.value;
      if (opts.length === 0) return;
      options.activeIndex.value = moveActiveIndex(opts, options.activeIndex.value, dir);
      return;
    }

    if (evt.key === 'Enter') {
      evt.preventDefault();
      const opt = options.filteredOptions.value[options.activeIndex.value];
      if (opt) options.selectOption(opt);
    }
  };

  const handleSearchKeydown = (evt: KeyboardEvent) => {
    if (evt.key === 'Escape') {
      options.close();
      return;
    }

    if (evt.key === 'Backspace' && options.isMultiple.value && !options.search.value) {
      const rawValue = options.getValue();
      const values: unknown[] = Array.isArray(rawValue) ? rawValue : [];
      const last = values[values.length - 1];
      if (last !== undefined) options.removeValue(last);
      return;
    }

    if (evt.key === 'Enter' && options.isTags.value && options.search.value.trim()) {
      const raw = options.search.value.trim();
      const rawValue = options.getValue();
      const values: unknown[] = Array.isArray(rawValue) ? rawValue : [];
      if (!values.includes(raw)) options.updateValue([...values, raw]);
      options.search.value = '';
    }

    // Pass arrow keys to main keydown handler
    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp' || evt.key === 'Enter') {
      handleKeydown(evt);
    }
  };

  return {
    handleKeydown,
    handleSearchKeydown,
  };
}
