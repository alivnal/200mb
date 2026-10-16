'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { captureFlipState, flipFromState } from '@/lib/flipLayout';

/**
 * FLIP transitions for list reorder / add / remove (gsap.com/ui pattern).
 */
export function useFlipList(listRef: RefObject<HTMLElement | null>, layoutKey: string) {
  const isFirstRender = useRef(true);
  const pendingFirst = useRef<Map<string, DOMRect> | null>(null);

  const captureBeforeUpdate = () => {
    if (!listRef.current) return;
    pendingFirst.current = captureFlipState(listRef.current);
  };

  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    flipFromState(listRef.current, pendingFirst.current);
    pendingFirst.current = null;
  }, [layoutKey, listRef]);

  return { captureBeforeUpdate };
}
