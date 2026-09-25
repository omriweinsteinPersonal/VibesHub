'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function DelayedLoading({
  children,
  delay = 250,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  return (
    <div
      aria-hidden={!visible}
      className={`creatorLoading creatorLoadingDelayed${visible ? ' isVisible' : ''}`}
      role={visible ? 'status' : undefined}
    >
      {children}
    </div>
  );
}
