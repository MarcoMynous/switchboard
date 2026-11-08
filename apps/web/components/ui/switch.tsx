import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6258E8]/35 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-linear-to-r from-[#181F63] to-[#6258E8]' : 'bg-slate-200',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
