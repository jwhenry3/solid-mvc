/**
 * TanStack Query the framework way. `useQuery` is a hook (function
 * components only); Views and controllers consume queries through a
 * signal-backed QueryObserver instead — the observer pattern TanStack uses
 * internally, exposed as a signal so `render()` subscribes automatically.
 *
 * Scope-bound like `effect()`: called inside a constructor or field
 * initializer, the observer's subscription registers on the injector's
 * DestroyRef and dies with the view/module scope.
 *
 * Reactive keys: pass an options GETTER and it runs inside a scope-bound
 * effect — signals read there (e.g. a debounced search) re-arm the same
 * observer via setOptions when they change, so query keys stay reactive
 * without leaking subscriptions.
 */
import {
  QueryClient,
  QueryObserver,
  type QueryKey,
  type QueryObserverOptions,
  type QueryObserverResult,
} from '@tanstack/query-core';
import { signal, type Signal } from '@solid-mvc/core';
import { effect, getCurrentInjector, DestroyRef } from '@solid-mvc/core';

export function querySignal<TData = unknown, TError = Error>(
  client: QueryClient,
  options: QueryObserverOptions<TData, TError> | (() => QueryObserverOptions<TData, TError>),
): Signal<QueryObserverResult<TData, TError>> {
  const getOpts =
    typeof options === 'function' ? options : () => options;
  const observer = new QueryObserver<TData, TError>(client, getOpts());
  const s = signal(observer.getCurrentResult());
  const unsubscribe = observer.subscribe((r) => (s.value = r));
  // In an injection context the subscription lives on the scope; outside
  // one the caller owns it (same rule as effect()).
  getCurrentInjector()?.get(DestroyRef).onDestroy(unsubscribe);
  if (typeof options === 'function') {
    // Tracked: signal reads inside getOpts re-run this effect → setOptions
    // re-keys the query (cache lookup + refetch are TanStack's problem).
    effect(() => observer.setOptions(getOpts()));
  }
  return s;
}

export type { QueryKey, QueryObserverResult };
