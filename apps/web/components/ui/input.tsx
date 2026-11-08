import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-[15px] text-[#0C1233] shadow-2xs transition-all duration-150 placeholder:text-slate-400 focus:border-[#6258E8] focus:outline-none focus:ring-3 focus:ring-[#6258E8]/15 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
