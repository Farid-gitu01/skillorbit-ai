import type { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#171D17] border border-[#303A2B]/40 ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}
