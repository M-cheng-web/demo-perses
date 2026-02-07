import { nextTick, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue';
import { estimateTagWidthFromText } from './selectLogic';

interface UseSelectResponsiveTagCountOptions {
  isMultiple: ComputedRef<boolean>;
  maxTagCount: ComputedRef<number | 'responsive' | undefined>;
  showSearch: ComputedRef<boolean>;
  controlRef: Ref<HTMLElement | undefined>;
  selectionClass: string;
  getSelectedValuesKey: () => string;
}

export function useSelectResponsiveTagCount(options: UseSelectResponsiveTagCountOptions) {
  const responsiveTagCount = ref<number>(Number.POSITIVE_INFINITY);

  let tagRafId: number | null = null;
  const tagWidthCache = new Map<string, number>();

  const estimateTagWidth = (tagEl: HTMLElement) => {
    const text = (tagEl.textContent ?? '').trim();
    return estimateTagWidthFromText(text);
  };

  const scheduleSyncTagCount = () => {
    if (!options.isMultiple.value) return;
    if (options.maxTagCount.value !== 'responsive') return;
    if (tagRafId != null) return;

    tagRafId = requestAnimationFrame(() => {
      tagRafId = null;
      void syncResponsiveTagCount();
    });
  };

  const syncResponsiveTagCount = async () => {
    if (!options.isMultiple.value) return;
    if (options.maxTagCount.value !== 'responsive') return;

    const control = options.controlRef.value;
    if (!control) return;

    await nextTick();

    const tagsWrap = control.querySelector(`.${options.selectionClass}`) as HTMLElement | null;
    if (!tagsWrap) return;

    const allTags = Array.from(tagsWrap.querySelectorAll('[data-gf-value]')) as HTMLElement[];
    const total = allTags.length;

    if (!total) {
      responsiveTagCount.value = Number.POSITIVE_INFINITY;
      return;
    }

    const wrapWidth = tagsWrap.clientWidth;
    const suffixWidth = 0;
    const inputReserve = options.showSearch.value ? 50 : 0;
    const paddingReserve = 12;
    const summaryReserve = 44;

    const available = Math.max(0, wrapWidth - suffixWidth - inputReserve - paddingReserve);

    let used = 0;
    let fit = 0;
    for (let i = 0; i < allTags.length; i++) {
      const el = allTags[i];
      if (!el) break;
      const key = el.dataset.gfValue;
      const measured = el.offsetWidth ?? 0;
      const w = measured > 0 ? measured : ((key ? tagWidthCache.get(key) : undefined) ?? estimateTagWidth(el));
      if (measured > 0 && key) tagWidthCache.set(key, measured);
      if (used + w <= available) {
        used += w;
        fit++;
      } else {
        break;
      }
    }

    if (fit >= total) {
      responsiveTagCount.value = total;
      return;
    }

    used = 0;
    fit = 0;
    const availableWithSummary = Math.max(0, available - summaryReserve);
    for (let i = 0; i < allTags.length; i++) {
      const el = allTags[i];
      if (!el) break;
      const key = el.dataset.gfValue;
      const measured = el.offsetWidth ?? 0;
      const w = measured > 0 ? measured : ((key ? tagWidthCache.get(key) : undefined) ?? estimateTagWidth(el));
      if (measured > 0 && key) tagWidthCache.set(key, measured);
      if (used + w <= availableWithSummary) {
        used += w;
        fit++;
      } else {
        break;
      }
    }

    responsiveTagCount.value = Math.max(0, fit);
  };

  onMounted(() => {
    scheduleSyncTagCount();
  });

  watch(
    () => options.getSelectedValuesKey(),
    async () => {
      await nextTick();
      scheduleSyncTagCount();
    }
  );

  onBeforeUnmount(() => {
    if (tagRafId != null) cancelAnimationFrame(tagRafId);
  });

  return {
    responsiveTagCount,
    scheduleSyncTagCount,
    syncResponsiveTagCount,
  };
}
