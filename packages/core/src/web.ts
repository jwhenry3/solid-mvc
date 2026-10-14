/**
 * The JSX runtime module for the DOM target — the `@solid-mvc/core/web`
 * entry consumers point babel-preset-solid's `moduleName` at:
 *
 *   solidPlugin({ solid: { moduleName: '@solid-mvc/core/web' } })
 *
 * Compiled output imports its runtime helpers (insert/template/effect/
 * spread/...) from here; `export *` passes every one of them through to
 * solid-js/web unchanged EXCEPT createComponent, which resolves View
 * classes through the host machinery — the `options.vnode` interception
 * of the old renderer, relocated to the compile-time runtime seam.
 */
export * from 'solid-js/web';

import { createComponent as solidCreateComponent } from 'solid-js';
import type { JSX } from 'solid-js';
import { viewComponent } from './view';

export function createComponent(Comp: any, props: any): JSX.Element {
  return solidCreateComponent(viewComponent(Comp), props);
}
