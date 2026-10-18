/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

type PanelSize = 'lg' | 'xl' | '2xl';

const sizeClasses: Record<PanelSize, string> = {
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

interface ScreenPanelProps {
  children: React.ReactNode;
  size?: PanelSize;
  className?: string;
}

export function ScreenPanel({ children, size = 'lg', className = '' }: ScreenPanelProps) {
  return (
    <div data-ui="processing-panel" className={`app-panel w-full mx-auto ${sizeClasses[size]} ${className}`}>
      {children}
    </div>
  );
}

export function PanelHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`app-panel-header ${className}`}>{children}</div>;
}

export function PanelDivider() {
  return <div className="app-panel-divider" aria-hidden />;
}

export function PanelBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`app-panel-body ${className}`}>{children}</div>;
}

export function PanelFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`app-panel-footer ${className}`}>{children}</div>;
}

export function PanelInset({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`app-inset ${className}`}>{children}</div>;
}
