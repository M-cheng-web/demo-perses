import { ref, readonly } from 'vue-demi';

const defaultOptions = {
  format: 'YYYY-MM-DD HH:mm:ss',
  method: 'format',
};

type Value = string | number | Date;

/**
 * format: 针对日期格式化（默认 YYYY-MM-DD HH:mm:ss）
 * method: 获取时间的操作方法（默认 format）
 * methodParam: 针对获取到的时间 (例如 hour(methodParam = 10) 就是将获取到的时间中小时时间设置为10)
 * 注意：比如说 method 设为 hour，methodParam 不设置时，dayjs返回的是当前小时数(比如当前是10点则返回10)
 */
interface Options {
  format?: string;
  method?:
    | 'format' // 返回默认全部时间
    | 'timestamp' // 返回时间戳
    | 'millisecond' // 只返回毫秒
    | 'second' // 只返回秒
    | 'minute' // 只返回分钟 后面以此类推..
    | 'hour'
    | 'date'
    | 'day'
    | 'month'
    | 'year';
  methodParam?: number;
}

/**
 * 操作时间（使用原生 Date 实现，不依赖 dayjs）
 * @param options
 * @param initialValue 初始时间
 */
export function useDate(
  options?: Options,
  initialValue?: Value | undefined
): {
  readonly data: any;
  refresh: (refreshValue?: Value) => void;
};

export function useDate(options?: Options, initialValue?: Value) {
  const state = ref<string | number>();

  const { format, method, methodParam } = { ...defaultOptions, ...options };

  const pad = (num: number, len = 2) => String(num).padStart(len, '0');

  const toDate = (value: Value) => {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === 'number') return new Date(value);
    // string
    return new Date(value);
  };

  const formatDate = (date: Date, fmt: string) => {
    const replacements: Record<string, string> = {
      YYYY: String(date.getFullYear()),
      MM: pad(date.getMonth() + 1),
      DD: pad(date.getDate()),
      HH: pad(date.getHours()),
      mm: pad(date.getMinutes()),
      ss: pad(date.getSeconds()),
      SSS: pad(date.getMilliseconds(), 3),
    };
    return fmt.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, (token) => replacements[token] ?? token);
  };

  const refresh = (value: Value = +new Date()) => {
    const date = toDate(value);
    switch (method) {
      case 'format':
        state.value = formatDate(date, format);
        break;
      case 'timestamp':
        state.value = date.getTime();
        break;
      case undefined:
        break;
      default: {
        // 说明：
        // - 当 methodParam 不传时：返回对应的“时间字段数值”（例如 hour -> 10）
        // - 当 methodParam 传入时：先 set 对应字段，再返回格式化后的时间字符串（与旧逻辑保持一致）
        if (methodParam == null) {
          switch (method) {
            case 'millisecond':
              state.value = date.getMilliseconds();
              break;
            case 'second':
              state.value = date.getSeconds();
              break;
            case 'minute':
              state.value = date.getMinutes();
              break;
            case 'hour':
              state.value = date.getHours();
              break;
            case 'date':
              state.value = date.getDate();
              break;
            case 'day':
              state.value = date.getDay();
              break;
            case 'month':
              state.value = date.getMonth();
              break;
            case 'year':
              state.value = date.getFullYear();
              break;
            default:
              break;
          }
        } else {
          switch (method) {
            case 'millisecond':
              date.setMilliseconds(methodParam);
              break;
            case 'second':
              date.setSeconds(methodParam);
              break;
            case 'minute':
              date.setMinutes(methodParam);
              break;
            case 'hour':
              date.setHours(methodParam);
              break;
            case 'date':
              date.setDate(methodParam);
              break;
            case 'month':
              date.setMonth(methodParam);
              break;
            case 'year':
              date.setFullYear(methodParam);
              break;
            // day(weekday) 语义在 Date 里不适合直接 set，这里保持不支持 set
            case 'day':
              break;
            default:
              break;
          }
          state.value = formatDate(date, format);
        }
      }
    }
  };

  refresh(initialValue || +new Date());

  const data = readonly(state);

  return { data, refresh };
}
