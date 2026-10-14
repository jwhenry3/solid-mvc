import { createContext, createComponent, useContext } from 'solid-js';
import type { JSX } from 'solid-js';
import { Injector } from './injector';
import type { Provider, Token } from './injector';

// The current injector travels through the view tree as context — owner-
// scoped in Solid, so module and route boundaries swap in child injectors
// exactly as before.
export const InjectorContext = createContext<Injector>(null as unknown as Injector);

export function useInjector(): Injector {
  const injector = useContext(InjectorContext);
  if (!injector) {
    throw new Error('No injector in context — is this view mounted under bootstrap()?');
  }
  return injector;
}

// Resolve a service/store from the view's injector scope.
export function useService<T>(token: Token<T>): T {
  return useInjector().get(token);
}

// View-local provider scope: equivalent to a component-level providers
// array. Providers created here live and die with this subtree. Component
// bodies run once in Solid, so the injector is built inline — no lazy-init
// dance.
export function Provide(props: { providers: Provider[]; children?: JSX.Element }): JSX.Element {
  const inj = new Injector(useInjector(), 'view providers');
  for (const p of props.providers) inj.provide(p);
  return createComponent(InjectorContext.Provider, {
    value: inj,
    get children() {
      return props.children;
    },
  });
}
