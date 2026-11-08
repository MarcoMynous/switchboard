import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'default' | 'brand' | 'outline' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default:
    'bg-linear-to-r from-[#181F63] via-[#3B32B8] to-[#564CE6] text-white shadow-[0_4px_14px_rgba(73,60,206,0.28)] hover:shadow-[0_6px_20px_rgba(73,60,206,0.36)] hover:brightness-105',
  brand: 'bg-[#6258E8] text-white shadow-sm hover:bg-[#4F46E5] hover:shadow-md',
  outline:
    'border border-slate-200/90 bg-white/90 text-[#0C1233] shadow-2xs hover:bg-slate-50 hover:border-slate-300',
  secondary: 'bg-[#F2F3F8] text-[#0C1233] hover:bg-[#E6E8F2]',
  ghost: 'text-slate-600 hover:bg-slate-100/80 hover:text-[#0C1233]',
  destructive: 'bg-[#EF4444] text-white shadow-xs hover:bg-[#DC2626]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: 'h-11 px-5 py-2.5 text-sm rounded-xl',
  sm: 'h-9 px-3.5 py-1.5 text-xs rounded-xl',
  lg: 'h-12 px-7 py-3.5 text-[15px] rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-all duration-200 ease-out cursor-pointer select-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6258E8]/35 disabled:pointer-events-none disabled:opacity-50',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
