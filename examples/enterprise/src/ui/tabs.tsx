/**
 * shadcn-style Tabs without Radix: a tiny signal-driven version, framework
 * native. Tabs owns a `signal` for the active value; triggers/contents read
 * it inside JSX accessors so updates stay tracked.
 */
import { signal, type Signal } from '@solid-mvc/core';
import { createContext, useContext, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { cn } from '@/lib/cn';

const TabsCtx = createContext<Signal<string>>(signal(''));

export function Tabs({
  value,
  defaultValue = '',
  class: c,
  ...p
}: JSX.IntrinsicElements['div'] & {
  value?: Signal<string>;
  defaultValue?: string;
}): JSX.Element {
  const state = value ?? signal(defaultValue);
  return (
    <TabsCtx.Provider value={state}>
      <div class={cn('w-full', c)} {...p} />
    </TabsCtx.Provider>
  );
}

export function TabsList({ class: c, ...p }: JSX.IntrinsicElements['div']): JSX.Element {
  return (
    <div
      class={cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        c,
      )}
      {...p}
    />
  );
}

export function TabsTrigger({
  value,
  class: c,
  ...p
}: JSX.IntrinsicElements['button'] & { value: string }): JSX.Element {
  const state = useContext(TabsCtx);
  return (
    <button
      class={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
        state.value === value && 'bg-background text-foreground shadow',
        c,
      )}
      onClick={() => (state.value = value)}
      {...p}
    />
  );
}

export function TabsContent({
  value,
  class: c,
  ...p
}: JSX.IntrinsicElements['div'] & { value: string }): JSX.Element {
  const state = useContext(TabsCtx);
  return (
    <Show when={state.value === value}>
      <div class={cn('mt-2 focus-visible:outline-none', c)} {...p} />
    </Show>
  );
}
