import type { JSX } from 'solid-js';
import { cn } from '@/lib/cn';

export function Skeleton({ class: c, ...p }: JSX.IntrinsicElements['div'] & { children?: JSX.Element }): JSX.Element {
  return <div class={cn('animate-pulse rounded-md bg-muted', c)} {...p} />;
}

export function Separator({
  class: c,
  orientation = 'horizontal',
  ...p
}: JSX.IntrinsicElements['div'] & { children?: JSX.Element } & { orientation?: 'horizontal' | 'vertical' }): JSX.Element {
  return (
    <div
      role="separator"
      class={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        c,
      )}
      {...p}
    />
  );
}

export function Avatar({
  class: c,
  name,
  src,
  ...p
}: JSX.IntrinsicElements['div'] & { children?: JSX.Element } & { name: string; src?: string }): JSX.Element {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      class={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold',
        c,
      )}
      {...p}
    >
      {src ? <img src={src} alt={name} class="h-full w-full object-cover" /> : initials}
    </div>
  );
}
