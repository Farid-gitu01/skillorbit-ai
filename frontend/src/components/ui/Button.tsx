import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'blue' | 'blue-outline' | 'yellow' | 'yellow-outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-[#C6F500] focus:ring-offset-2 focus:ring-offset-[#090B09] disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const variantStyles = {
      primary:
        'bg-[#C6F500] hover:bg-[#A8D900] text-[#090B09] font-bold shadow-sm active:bg-[#92BC00]',
      secondary:
        'bg-[#171D17] hover:bg-[#202820] text-[#F5F7F2] border border-[#303A2B] hover:border-[#C6F500]/50 active:bg-[#252E25]',
      outline:
        'border border-[#303A2B] hover:border-[#C6F500] text-[#F5F7F2] bg-transparent hover:bg-[#171D17]',
      ghost:
        'text-[#A3ADA0] hover:text-[#F5F7F2] hover:bg-[#171D17] bg-transparent',
      danger:
        'bg-red-600 hover:bg-red-700 text-white active:bg-red-800',
      blue:
        'bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm focus:ring-blue-500 focus:ring-offset-white active:bg-blue-800',
      'blue-outline':
        'border border-slate-300 hover:border-blue-600 text-slate-700 hover:text-blue-600 bg-white hover:bg-blue-50/50 focus:ring-blue-500 focus:ring-offset-white',
      yellow:
        'bg-yellow-400 hover:bg-yellow-300 text-black font-bold shadow-md shadow-yellow-500/20 active:bg-yellow-500 focus:ring-yellow-400 focus:ring-offset-black',
      'yellow-outline':
        'border border-yellow-400/40 hover:border-yellow-400 text-yellow-400 hover:text-yellow-300 bg-neutral-900/60 hover:bg-neutral-800 focus:ring-yellow-400 focus:ring-offset-black',
    };

    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2.5 gap-2',
      lg: 'text-base px-6 py-3 gap-2.5',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
