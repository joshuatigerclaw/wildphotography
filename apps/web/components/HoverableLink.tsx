'use client';

import Link from 'next/link';
import { useState } from 'react';

interface HoverableLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function HoverableLink({ href, children, className, style }: HoverableLinkProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      className={className}
      style={{
        ...style,
        borderColor: hovered ? 'var(--accent)' : undefined,
        color: hovered ? 'var(--accent)' : undefined,
      }}
      onMouseEnter={(e) => {
        setHovered(true);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
      }}
    >
      {children}
    </Link>
  );
}