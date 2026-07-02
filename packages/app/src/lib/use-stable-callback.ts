/**
 * useStableCallback — like useCallback but the function identity never
 * changes (no dep array). Used to keep handler props stable across
 * re-renders without forcing callers to memoize.
 *
 * Native React offers `useEvent` (still RFC as of 2026) for this; until
 * that lands, this is the standard pattern.
 */
import { useCallback, useRef } from "react";

export function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
}
