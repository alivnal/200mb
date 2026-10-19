import React, { Suspense, lazy, type ComponentType } from 'react';

// Vite renders on the client only, so next/dynamic is React.lazy in Suspense.
export default function dynamic<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  _options?: { ssr?: boolean },
): ComponentType<P> {
  const Component = lazy(load);
  return function DynamicComponent(props: P) {
    return (
      <Suspense fallback={null}>
        <Component {...props} />
      </Suspense>
    );
  };
}
