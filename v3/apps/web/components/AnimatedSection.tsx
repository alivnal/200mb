/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';

interface AnimatedSectionProps {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Conditional block — no enter animation; list FLIP handles motion. */
export default function AnimatedSection({ show, children, className = '' }: AnimatedSectionProps) {
  if (!show) return null;
  return <div className={className}>{children}</div>;
}
