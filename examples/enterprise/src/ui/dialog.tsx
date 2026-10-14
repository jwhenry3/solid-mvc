/**
 * shadcn-style Dialog: signal-controlled overlay, no Radix. `open` is a
 * signal — mutating it shows/hides the modal reactively.
 */
import type { Signal } from '@solid-mvc/core';
import { Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { cn } from '@/lib/cn';

export function Dialog({
  open,
  children,
}: {
  open: Signal<boolean>;
  children?: JSX.Element;
}): JSX.Element {
  return (
    <Show when={open.value}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) open.value = false;
        }}
      >
        {children}
      </div>
    </Show>
  );
}

export function DialogContent({ class: c, ...p }: JSX.IntrinsicElements['div'] & { children?: JSX.Element }): JSX.Element {
  return (
    <div
      class={cn(
        'relative z-50 w-full max-w-lg rounded-lg border bg-popover p-6 text-popover-foreground shadow-lg',
        c,
      )}
      {...p}
    />
  );
}

export function DialogHeader({ class: c, ...p }: JSX.IntrinsicElements['div'] & { children?: JSX.Element }): JSX.Element {
  return <div class={cn('flex flex-col space-y-1.5 text-center sm:text-left', c)} {...p} />;
}
export function DialogTitle({ class: c, ...p }: JSX.IntrinsicElements['h2'] & { children?: JSX.Element }): JSX.Element {
  return <h2 class={cn('text-lg font-semibold leading-none tracking-tight', c)} {...p} />;
}
export function DialogDescription({ class: c, ...p }: JSX.IntrinsicElements['p'] & { children?: JSX.Element }): JSX.Element {
  return <p class={cn('text-sm text-muted-foreground', c)} {...p} />;
}
export function DialogFooter({ class: c, ...p }: JSX.IntrinsicElements['div'] & { children?: JSX.Element }): JSX.Element {
  return <div class={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', c)} {...p} />;
}
