import * as React from 'react';
import { cn } from '../../lib/utils.js';

export type ButtonVariant =
  | 'default'
  | 'surf'
  | 'dark'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'compact';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'btn',
  surf: 'btn btn-surf',
  dark: 'btn btn-dark',
  destructive: 'btn btn-danger',
  outline: 'btn',
  secondary: 'btn',
  ghost: 'btn',
  link: 'btn',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: '',
  sm: 'btn-compact',
  compact: 'btn-compact',
  lg: 'btn-lg',
  icon: 'btn-icon',
};

export function buttonVariants(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  const v = opts?.variant || 'default';
  const s = opts?.size || 'default';
  return cn(VARIANT_CLASSES[v], SIZE_CLASSES[s], opts?.className);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button };
