import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'amber';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-[#EEF0FF] text-[#3B32B8] border border-[#6258E8]/20',
  secondary: 'bg-[#F2F4F8] text-slate-600 border border-slate-200/80',
  outline: 'bg-white/80 text-[#0C1233] border border-slate-200',
  success: 'bg-[#ECFDF5] text-[#059669] border border-[#10B981]/25',
  warning: 'bg-[#FFFBEB] text-[#B45309] border border-[#F59E0B]/30',
  amber: 'bg-linear-to-r from-[#FFFBEB] to-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/30',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tracking-tight transition-all duration-150',
        BADGE_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
