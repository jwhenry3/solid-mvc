/**
 * The shell surface — our `*-island` package's main-thread half
 * (docs/atoll/islands-frameworks.md): mount a worker-hosted tree as an
 * ordinary element in a framework app.
 *
 *   <Island worker={entry} app="counter" props={{ start: 5 }}
 *           onEvent={(name, p) => ...} />
 *
 *   const Counter = islandComponent(counterContract);   // the facade:
 *   <Counter start={5} onEvent={...} />                 // no worker prop —
 *                                                        the contract carries it
 *
 *   const Lazy = lazyIsland(() => import('./counter.contract'));
 *
 * Plain function components — `worker`/`client`/`app` are mount identity:
 * change them with a keyed remount.
 */
import { createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { JSX } from 'solid-js';
import {
  connectIslandWorker,
  contractWorkerOf,
  islandAppNameOf,
  isIslandContract,
  mountIsland,
} from '@solid-mvc/atoll';
import type {
  IslandAppProps,
  IslandClient,
  IslandContract,
  IslandContractEventHandler,
  IslandContractProps,
  IslandHandle,
  IslandWorkerOptions,
  Mode,
  WorkerLike,
} from '@solid-mvc/atoll';
import { appendChildren } from '@solid-mvc/core/dom';

/** Props consumed by a proxy component itself — everything else forwards to
 *  the island as its props. */
export interface IslandShellProps {
  /** Bundler-detectable factory `() => new Worker(new URL(...))` (or a URL
   *  / spawned worker). Optional when `app` is a contract carrying its own
   *  worker — the contract module is then the whole connection. */
  worker?: WorkerLike | (() => WorkerLike) | URL;
  /** A shared `connectIslandWorker` client — this mount adds an instance. */
  client?: IslandClient;
  /** Client options for `worker`-shorthand mounts (taskTimeout, respawn,
   *  lazy, doorbell, keepAlive). `doorbell: true` needs cross-origin
   *  isolation; `keepAlive: true` leaves the worker resident-but-idle when
   *  the island unmounts so remounts are warm starts. */
  workerOptions?: IslandWorkerOptions & { doorbell?: boolean; keepAlive?: boolean };
  /** 'push' rides the doorbell SAB (COOP/COEP); 'poll' (default) is
   *  message-only — no headers needed. */
  mode?: Mode;
  /** Devtools renderer tag. */
  framework?: string;
  /** Receives every worker-side `emit(name, payload)`. */
  onEvent?: (name: string, payload: unknown) => void;
  /** Fired after each applied op batch. */
  onActivity?: () => void;
  /** The mounted handle (pid, updateProps, flush, setMode…) once ready. */
  onReady?: (island: IslandHandle) => void;
  /** Mount/update errors surface here instead of an unhandled rejection. */
  onError?: (err: unknown) => void;
  /** `data-atoll-slot` transclusion holes: worker owns the box, shell owns
   *  the contents. */
  slots?: Record<string, (el: HTMLElement | null) => void>;
  /** Rendered while the worker mounts (lazy facades). */
  fallback?: JSX.Element;
  className?: string;
  style?: string | Record<string, string | number>;
  mountTimeout?: number;
  children?: JSX.Element; // reserved for future slot sugar
}

export interface IslandProps extends IslandShellProps {
  /** Registry key, stamped app (`islandApp`/`viewIsland`), or contract —
   *  resolved through `islandAppNameOf`. */
  app?: unknown;
  /** Structured-cloneable props (functions via `callbackProp`). */
  props?: Record<string, unknown>;
}

function styleString(style: IslandShellProps['style']): string | undefined {
  if (style == null) return undefined;
  if (typeof style === 'string') return style;
  return Object.entries(style)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`)
    .join(';');
}

function mountError(err: unknown): HTMLElement {
  const box = globalThis.document.createElement('div');
  box.setAttribute('class', 'island-error');
  box.setAttribute('style', 'border:1px solid #c00;padding:.5em;');
  box.textContent = `Island mount failed: ${err instanceof Error ? err.message : String(err)}`;
  return box;
}

/**
 * `Island` — the no-JSX component form (Atoll solid convention): returns
 * the mounted `div` itself, or the mount-error box once failed.
 */
export function Island(p: IslandProps): JSX.Element {
  const [failed, setFailed] = createSignal<Error | null>(null);
  const el = globalThis.document.createElement('div');
  const cls = p.className ?? (p as { class?: string }).class;
  if (cls) el.setAttribute('class', cls);
  const sty = styleString(p.style);
  if (sty) el.setAttribute('style', sty);

  // 'main' mounts a mono worker's sole app namelessly; registries error
  // with the key list if 'main' isn't a real key.
  const appName = p.app === undefined ? 'main' : islandAppNameOf(p.app);
  let handle: IslandHandle | null = null;
  let cancelled = false;

  onMount(() => {
    if (appName === undefined) {
      setFailed(
        new Error(
          '<Island> could not resolve an app name — pass the registry key ' +
            'or stamp the app with islandApp(name, app)',
        ),
      );
      return;
    }
    const mode = p.mode ?? 'poll';
    // A contract `app` can carry its own worker factory — the contract
    // module is then the whole connection, call sites pass no worker.
    const resolvedWorker = p.worker ?? contractWorkerOf(p.app);
    const client =
      p.client ??
      (resolvedWorker !== undefined
        ? connectIslandWorker({
            name: appName,
            worker: resolvedWorker,
            doorbell: mode !== 'poll',
            ...p.workerOptions,
          })
        : undefined);
    if (client === undefined) {
      setFailed(
        new Error('<Island> requires either `worker`, `client`, or a contract carrying `worker`'),
      );
      return;
    }
    mountIsland({
      el,
      client,
      app: appName,
      props: p.props,
      onEvent: p.onEvent,
      onActivity: p.onActivity,
      slots: p.slots,
      mode,
      framework: p.framework,
      mountTimeout: p.mountTimeout,
    })
      .then((h) => {
        if (cancelled) h.destroy();
        else {
          handle = h;
          p.onReady?.(h);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (p.onError) p.onError(err);
        else setFailed(err instanceof Error ? err : new Error(String(err)));
      });
  });
  onCleanup(() => {
    cancelled = true;
    handle?.destroy();
    handle = null;
  });

  // Prop updates flow through the handle — deduped by wire-serialized
  // identity; a repeat send would be a wasted round-trip. Reading the
  // props getter here is what makes `<Island props={accessor()}/>` push
  // updateProps reactively.
  let lastJson = '';
  createEffect(() => {
    const json = JSON.stringify(p.props ?? {});
    if (json !== lastJson) {
      lastJson = json;
      handle?.updateProps(JSON.parse(json));
    }
  });

  return createMemo(() => {
    const f = failed();
    return f !== null ? mountError(f) : el;
  }) as unknown as JSX.Element;
}

/** What `app` accepts on a facade: the registry name, or a reference to
 *  resolve (component, stamped app, contract). */
export type IslandAppRef<A> = A | string;

export type IslandFacadeProps<A> = Omit<IslandShellProps, 'onEvent'> &
  IslandAppProps<A> & {
    props?: Record<string, unknown>;
    onEvent?: (name: string, payload: unknown) => void;
  };

/** Props consumed by a facade component itself — everything else forwards
 *  to the island as its props. */
const SHELL_PROP_KEYS: ReadonlySet<string> = new Set([
  'worker',
  'client',
  'workerOptions',
  'mode',
  'framework',
  'onEvent',
  'onActivity',
  'onReady',
  'onError',
  'slots',
  'fallback',
  'className',
  'class',
  'style',
  'mountTimeout',
  'children',
]);

const splitProxyProps = (
  raw: Record<string, unknown>,
): { shell: IslandShellProps; islandProps: Record<string, unknown> } => {
  const shell: Record<string, unknown> = {};
  const islandProps: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    // Getter-preserving forward: non-shell prop reads stay reactive so the
    // island's props accessor re-evaluates on the caller's signal writes.
    Object.defineProperty(SHELL_PROP_KEYS.has(key) ? shell : islandProps, key, {
      enumerable: true,
      configurable: true,
      get: () => raw[key],
    });
  }
  return { shell: shell as IslandShellProps, islandProps };
};

/** Build the Island argument object, keeping caller props lazy where they
 *  matter (island props are what updateProps diffs). */
const forwardIslandProps = (
  shell: IslandShellProps,
  app: unknown,
  islandProps: Record<string, unknown>,
  extraProps?: Record<string, unknown>,
): IslandProps => ({
  ...(shell as Record<string, unknown>),
  app,
  get props() {
    return { ...islandProps, ...(extraProps ?? {}) };
  },
}) as IslandProps;

/**
 * `islandComponent(contract)` — the cross-framework facade: the component's
 * props are the island's props (from the contract's schema), `onEvent`
 * narrows to the declared event vocabulary, and the contract's own worker
 * factory means call sites pass NO worker/client at all. The shell imports
 * the contract module only — never the worker entry or the island's code.
 *
 * `islandComponent<P>('charts')` — the string-keyed form for registries
 * whose workers the shell already knows.
 */
export function islandComponent<C extends IslandContract>(
  app: C,
): (
  props: IslandContractProps<C> &
    Omit<IslandShellProps, 'onEvent'> & {
      props?: Record<string, unknown>;
      onEvent?: IslandContractEventHandler<C>;
    },
) => JSX.Element;
export function islandComponent<A>(app: A | string): (props: IslandFacadeProps<A>) => JSX.Element;
export function islandComponent(app: unknown): (props: Record<string, unknown>) => JSX.Element {
  const Facade = (raw: Record<string, unknown>): JSX.Element => {
    const { props: extra, ...rest } = raw;
    const { shell, islandProps } = splitProxyProps(rest);
    return Island(
      forwardIslandProps(shell, app, islandProps, extra as Record<string, unknown> | undefined),
    );
  };
  Facade.displayName = `Island(${islandAppNameOf(app) ?? 'main'})`;
  return Facade as (props: Record<string, unknown>) => JSX.Element;
}

/**
 * `lazyIsland(() => import('./counter.contract'))` — the module must export
 * a contract (`defineIslandContract` — app + worker factory in one object),
 * a stamped app (`viewIsland('counter', CounterView)`), or a default export
 * resolvable by `islandAppNameOf`. A contract's own worker factory is used
 * when no `worker` prop is passed.
 */
export function lazyIsland<A>(
  load: () => Promise<Record<string, unknown>>,
): (props: IslandFacadeProps<A>) => JSX.Element {
  const Lazy = (p: IslandFacadeProps<A>): JSX.Element => {
    const [resolved, setResolved] = createSignal<unknown>(null);
    let live = true;
    onCleanup(() => {
      live = false;
    });
    void load().then((mod) => {
      if (!live) return;
      const unwrapped = 'default' in mod ? mod.default : mod;
      const app =
        isIslandContract(unwrapped) ? unwrapped
        : Object.values(mod).find((v) => isIslandContract(v)) ??
          Object.values(mod).find((v) => v && typeof v === 'object' && 'islandAppName' in v) ??
          unwrapped;
      setResolved(() => app);
    });
    return createMemo(() => {
      const app = resolved();
      if (app === null || app === undefined) {
        const el = globalThis.document.createElement('div');
        const cls = p.className;
        if (cls) el.setAttribute('class', cls);
        const sty = styleString(p.style);
        if (sty) el.setAttribute('style', sty);
        appendChildren(el, p.fallback);
        return el;
      }
      const { props: extra, ...rest } = p as Record<string, unknown>;
      const { shell, islandProps } = splitProxyProps(rest);
      return Island(
        forwardIslandProps(shell, app, islandProps, extra as Record<string, unknown> | undefined),
      );
    }) as unknown as JSX.Element;
  };
  return Lazy;
}
