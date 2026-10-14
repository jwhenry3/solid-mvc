import { onCleanup } from 'solid-js';
import { Injector } from './injector';
import { useInjector } from './context';

// Lifecycle contracts — implement on a view, controller, or service and the
// owning injector fires them on scope activate/deactivate.
export interface OnInit {
  onInit(): void;
}

export interface OnDestroy {
  onDestroy(): void;
}

/**
 * useController — the explicit controller escape hatch for function
 * components: always a fresh instance, owned by the calling component's
 * mount (activate now, deactivate on cleanup).
 */
export function useController<C extends object>(cls: new () => C): C {
  const inj = new Injector(useInjector(), `controller ${cls.name}`);
  const inst = inj.instantiate(cls);
  inj.activate();
  onCleanup(() => inj.deactivate());
  return inst;
}
