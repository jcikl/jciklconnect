import { useCallback, useMemo, useRef, useEffect, useState } from 'react';

/**
 * 性能优化相关的自定义 Hooks
 * Performance optimization related custom hooks
 */

/**
 * 防抖 Hook - 延迟执行函数直到停止调用一段时间后
 * Debounce Hook - Delays function execution until after calls have stopped for a specified time
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * 节流 Hook - 限制函数执行频率
 * Throttle Hook - Limits function execution frequency
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * 内存化计算 Hook - 缓存昂贵计算的结果
 * Memoized computation Hook - Caches expensive computation results
 */
export function useMemoizedComputation<T, D extends readonly unknown[]>(
  computeFn: () => T,
  deps: D
): T {
  return useMemo(computeFn, deps);
}

/**
 * 延迟状态 Hook - 延迟更新状态以避免频繁重渲染
 * Delayed state Hook - Delays state updates to avoid frequent re-renders
 */
export function useDelayedState<T>(
  initialValue: T,
  delay: number = 300
): [T, (value: T) => void, T] {
  const [immediateValue, setImmediateValue] = useState<T>(initialValue);
  const [delayedValue, setDelayedValue] = useState<T>(initialValue);

  const debouncedSetDelayedValue = useDebounce(setDelayedValue, delay);

  const setValue = useCallback((value: T) => {
    setImmediateValue(value);
    debouncedSetDelayedValue(value);
  }, [debouncedSetDelayedValue]);

  return [delayedValue, setValue, immediateValue];
}

/**
 * 交集观察器 Hook - 用于懒加载和无限滚动
 * Intersection Observer Hook - For lazy loading and infinite scrolling
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefCallback<Element>, IntersectionObserverEntry | null] {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [element, setElement] = useState<Element | null>(null);

  const callbackRef = useCallback((node: Element | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setEntry(entry),
      options
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element, options]);

  return [callbackRef, entry];
}

/**
 * 虚拟化 Hook - 计算虚拟滚动的可见项目
 * Virtualization Hook - Calculates visible items for virtual scrolling
 */
export function useVirtualization({
  itemCount,
  itemHeight,
  containerHeight,
  scrollTop,
  overscan = 3
}: {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  scrollTop: number;
  overscan?: number;
}) {
  return useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return {
      startIndex,
      endIndex,
      totalHeight: itemCount * itemHeight,
      offsetY: startIndex * itemHeight,
      visibleCount: endIndex - startIndex + 1
    };
  }, [itemCount, itemHeight, containerHeight, scrollTop, overscan]);
}

/**
 * 性能监控 Hook - 监控组件渲染性能
 * Performance monitoring Hook - Monitors component render performance
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());

  useEffect(() => {
    renderCountRef.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} rendered ${renderCountRef.current} times. Time since last render: ${timeSinceLastRender}ms`);
    }
  });

  return {
    renderCount: renderCountRef.current,
    logPerformance: (operation: string, startTime: number) => {
      const duration = Date.now() - startTime;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${componentName} - ${operation}: ${duration}ms`);
      }
    }
  };
}

/**
 * 批量状态更新 Hook - 批量处理多个状态更新
 * Batch state updates Hook - Batches multiple state updates
 */
export function useBatchedUpdates<T extends Record<string, any>>(
  initialState: T,
  batchDelay: number = 16 // One frame at 60fps
): [T, (updates: Partial<T>) => void, () => void] {
  const [state, setState] = useState<T>(initialState);
  const pendingUpdatesRef = useRef<Partial<T>>({});
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const batchUpdate = useCallback((updates: Partial<T>) => {
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setState(prevState => ({ ...prevState, ...pendingUpdatesRef.current }));
      pendingUpdatesRef.current = {};
    }, batchDelay);
  }, [batchDelay]);

  const flushUpdates = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (Object.keys(pendingUpdatesRef.current).length > 0) {
      setState(prevState => ({ ...prevState, ...pendingUpdatesRef.current }));
      pendingUpdatesRef.current = {};
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, batchUpdate, flushUpdates];
}

/**
 * 懒加载 Hook - 延迟加载资源
 * Lazy loading Hook - Delays resource loading
 */
export function useLazyLoad<T>(
  loadFn: () => Promise<T>,
  trigger: boolean = true
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (loadedRef.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await loadFn();
      setData(result);
      loadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [loadFn]);

  const reload = useCallback(() => {
    loadedRef.current = false;
    load();
  }, [load]);

  useEffect(() => {
    if (trigger && !loadedRef.current) {
      load();
    }
  }, [trigger, load]);

  return { data, loading, error, reload };
}

export default {
  useDebounce,
  useThrottle,
  useMemoizedComputation,
  useDelayedState,
  useIntersectionObserver,
  useVirtualization,
  usePerformanceMonitor,
  useBatchedUpdates,
  useLazyLoad
};