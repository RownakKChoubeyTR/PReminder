'use client';

import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────
// useDebouncedValue — Delays value updates for search inputs
//
// Industry-standard pattern (Netflix, Google, GitHub):
//   - 300-500ms delay prevents API calls on every keystroke
//   - Value only updates after user stops typing
// ─────────────────────────────────────────────────────────────

export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
