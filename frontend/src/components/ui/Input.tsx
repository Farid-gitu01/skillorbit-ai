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

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold tracking-wide text-slate-300 uppercase"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixIcon && (
            <div className="absolute left-3 text-muted-slate pointer-events-none flex items-center">
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
              'w-full rounded-btn bg-midnight-navy/90 text-surface-white text-sm border px-3.5 py-2.5 transition-colors',
              'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error ? 'border-red-500/80 focus:ring-red-500' : 'border-slate-700/80 hover:border-slate-600',
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
