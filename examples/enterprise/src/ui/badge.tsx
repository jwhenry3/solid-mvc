import { cva, type VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-[hsl(142_71%_45%/0.15)] text-[hsl(142_71%_35%)] dark:text-[hsl(142_71%_65%)]',
        warning: 'border-transparent bg-[hsl(25_95%_53%/0.15)] text-[hsl(25_95%_38%)] dark:text-[hsl(25_95%_65%)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeProps = JSX.IntrinsicElements['span'] &
  VariantProps<typeof badgeVariants> & { children?: JSX.Element };

export function Badge({ class: c, variant, ...p }: BadgeProps): JSX.Element {
  return <span class={cn(badgeVariants({ variant }), c)} {...p} />;
}
