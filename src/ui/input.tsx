import type { JSX } from 'solid-js';
import { cn } from '@/lib/cn';

export function Input({ class: c, ...p }: JSX.IntrinsicElements['input'] & { children?: JSX.Element }): JSX.Element {
  return (
    <input
      class={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        c,
      )}
      {...p}
    />
  );
}

export function Label({ class: c, ...p }: JSX.IntrinsicElements['label'] & { children?: JSX.Element }): JSX.Element {
  return (
    <label
      class={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', c)}
      {...p}
    />
  );
}
