import { createEffect } from 'solid-js';
import type { JSX } from 'solid-js';
import { useService } from '../context';
import { appendChildren } from '../dom';
import { Router } from './router';

export interface LinkProps {
  to: string;
  class?: string;
  children?: JSX.Element;
  onClick?: (e: MouseEvent) => void;
}

/**
 * In-app link — builds the anchor imperatively so it works identically on
 * the main thread and inside worker islands (ambient `document` resolves
 * to the instance's proxy document there). Unmodified left clicks
 * preventDefault and navigate; the @solidjs/router document-level
 * interceptor sees the click as handled (defaultPrevented) and covers
 * plain <a href> markup that bypasses <Link>.
 */
export function Link(props: LinkProps): JSX.Element {
  const router = useService(Router);
  const el = globalThis.document.createElement('a');
  // href and class are prop reads — track them so `class={() => ...}` and
  // conditional active styling update on navigation instead of freezing
  // at mount.
  createEffect(() => {
    el.setAttribute('href', router.href(props.to));
    const cls = props.class;
    if (cls) el.setAttribute('class', cls);
    else el.removeAttribute('class');
  });
  el.addEventListener('click', (e) => {
    const me = e as MouseEvent;
    if (me.button !== 0 || me.metaKey || me.ctrlKey || me.shiftKey || me.altKey) return;
    props.onClick?.(me);
    if (me.defaultPrevented) return;
    me.preventDefault();
    router.navigate(props.to);
  });
  appendChildren(el, props.children);
  return el;
}
