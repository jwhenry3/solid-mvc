import type { JSX } from 'solid-js';
import { cn } from '@/lib/cn';

type DivProps = JSX.IntrinsicElements['div'] & { children?: JSX.Element };
type HProps = JSX.IntrinsicElements['h3'] & { children?: JSX.Element };
type PProps = JSX.IntrinsicElements['p'] & { children?: JSX.Element };

export function Card({ class: c, ...p }: DivProps): JSX.Element {
  return <div class={cn('rounded-lg border bg-card text-card-foreground shadow-sm', c)} {...p} />;
}
export function CardHeader({ class: c, ...p }: DivProps): JSX.Element {
  return <div class={cn('flex flex-col space-y-1.5 p-6', c)} {...p} />;
}
export function CardTitle({ class: c, ...p }: HProps): JSX.Element {
  return <h3 class={cn('font-semibold leading-none tracking-tight', c)} {...p} />;
}
export function CardDescription({ class: c, ...p }: PProps): JSX.Element {
  return <p class={cn('text-sm text-muted-foreground', c)} {...p} />;
}
export function CardContent({ class: c, ...p }: DivProps): JSX.Element {
  return <div class={cn('p-6 pt-0', c)} {...p} />;
}
export function CardFooter({ class: c, ...p }: DivProps): JSX.Element {
  return <div class={cn('flex items-center p-6 pt-0', c)} {...p} />;
}
