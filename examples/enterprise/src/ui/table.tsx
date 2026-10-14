import type { JSX } from 'solid-js';
import { cn } from '@/lib/cn';

export function Table({ class: c, ...p }: JSX.IntrinsicElements['table'] & { children?: JSX.Element }): JSX.Element {
  return (
    <div class="relative w-full overflow-auto">
      <table class={cn('w-full caption-bottom text-sm', c)} {...p} />
    </div>
  );
}
export function TableHeader({ class: c, ...p }: JSX.IntrinsicElements['thead'] & { children?: JSX.Element }): JSX.Element {
  return <thead class={cn('[&_tr]:border-b', c)} {...p} />;
}
export function TableBody({ class: c, ...p }: JSX.IntrinsicElements['thead'] & { children?: JSX.Element }): JSX.Element {
  return <tbody class={cn('[&_tr:last-child]:border-0', c)} {...p} />;
}
export function TableRow({ class: c, ...p }: JSX.IntrinsicElements['tr'] & { children?: JSX.Element }): JSX.Element {
  return (
    <tr
      class={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', c)}
      {...p}
    />
  );
}
export function TableHead({ class: c, ...p }: JSX.IntrinsicElements['th'] & { children?: JSX.Element }): JSX.Element {
  return (
    <th
      class={cn('h-10 px-2 text-left align-middle font-medium text-muted-foreground', c)}
      {...p}
    />
  );
}
export function TableCell({ class: c, ...p }: JSX.IntrinsicElements['td'] & { children?: JSX.Element }): JSX.Element {
  return <td class={cn('p-2 align-middle', c)} {...p} />;
}
export function TableCaption({ class: c, ...p }: JSX.IntrinsicElements['caption'] & { children?: JSX.Element }): JSX.Element {
  return <caption class={cn('mt-4 text-sm text-muted-foreground', c)} {...p} />;
}
