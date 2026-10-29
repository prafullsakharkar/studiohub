import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Transient UI feedback (toasts/banners) with unmount-safe timeout cleanup.
 * Replaces bare `setTimeout(() => setX(null), ms)` calls that warn on
 * unmounted-component state updates.
 */
export function useTransientFeedback<T>(timeoutMs = 3000): [T | null, (value: T) => void, () => void] {
  const [value, setValue] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const show = useCallback(
    (next: T) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      setValue(next);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setValue(null);
      }, timeoutMs);
    },
    [timeoutMs],
  );

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setValue(null);
  }, []);

  return [value, show, clear];
}
