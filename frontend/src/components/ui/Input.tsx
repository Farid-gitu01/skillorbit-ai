import { forwardRef, useState, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showPasswordToggle?: boolean;
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
  variant?: 'dark' | 'light' | 'yellow';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      helperText,
      showPasswordToggle = false,
      prefixIcon,
      suffixIcon,
      variant = 'dark',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const resolvedType = showPasswordToggle ? (isPasswordVisible ? 'text' : 'password') : type;

    const isLight = variant === 'light';
    const isYellow = variant === 'yellow';

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-xs font-semibold tracking-wide uppercase',
              isLight ? 'text-slate-700' : isYellow ? 'text-neutral-300' : 'text-[#A3ADA0]'
            )}
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixIcon && (
            <div className={cn(
              'absolute left-3 pointer-events-none flex items-center',
              isLight ? 'text-slate-400' : isYellow ? 'text-neutral-500' : 'text-[#A3ADA0]'
            )}>
              {prefixIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'w-full rounded-btn text-sm border px-3.5 py-2.5 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isLight
                ? cn(
                    'bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600',
                    error && 'border-red-500 focus:ring-red-500'
                  )
                : isYellow
                  ? cn(
                      'bg-[#0D0D0D] text-white placeholder:text-neutral-500 border-neutral-800 hover:border-yellow-400/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400',
                      error && 'border-red-500 focus:ring-red-500'
                    )
                  : cn(
                      'bg-[#111611] text-[#F5F7F2] placeholder:text-[#A3ADA0]/50 border-[#303A2B] hover:border-[#A3ADA0]/40 focus:outline-none focus:ring-2 focus:ring-[#C6F500] focus:border-[#C6F500]',
                      error && 'border-red-500/80 focus:ring-red-500'
                    ),
              prefixIcon ? 'pl-10' : 'pl-3.5',
              showPasswordToggle || suffixIcon ? 'pr-10' : 'pr-3.5',
              className
            )}
            {...props}
          />
          {showPasswordToggle ? (
            <button
              type="button"
              onClick={() => setIsPasswordVisible((prev) => !prev)}
              tabIndex={-1}
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              className="absolute right-3 p-1 text-muted-slate hover:text-surface-white transition-colors focus:outline-none"
            >
              {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          ) : suffixIcon ? (
            <div className="absolute right-3 text-muted-slate pointer-events-none flex items-center">
              {suffixIcon}
            </div>
          ) : null}
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-red-400 font-medium">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-muted-slate">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
