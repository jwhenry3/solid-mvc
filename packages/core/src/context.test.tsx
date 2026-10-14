import { render, screen, cleanup } from '@solidjs/testing-library';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Injector, InjectionToken, inject } from './injector';
import { InjectorContext, useInjector, useService, Provide } from './context';
import { useController } from './controller';
import { Controller } from './decorators';

afterEach(() => cleanup());

class Svc {
  msg = 'service message';
}

const TOKEN = new InjectionToken<string>('token');

function scoped(providers: any[] = []) {
  const inj = new Injector();
  for (const p of providers) inj.provide(p);
  return inj;
}

// Solid children evaluate eagerly at the JSX site — pass a THUNK so
// component creation lands inside the Provider's context owner.
function mount(node: () => any, injector: Injector) {
  return render(() => (
    <InjectorContext.Provider value={injector}>{node()}</InjectorContext.Provider>
  ));
}

describe('useService', () => {
  it('resolves services and tokens from the ambient injector', () => {
    function F() {
      const s = useService(Svc);
      const t = useService(TOKEN);
      return (
        <p>
          {s.msg}/{t}
        </p>
      );
    }
    mount(() => <F />, scoped([Svc, { provide: TOKEN, useValue: 'tok' }]));
    expect(screen.getByText('service message/tok')).toBeTruthy();
  });

  it('throws when used outside an injector context', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function F() {
      useService(Svc);
      return null;
    }
    expect(() => render(() => <F />)).toThrow(/No injector in context/);
    errSpy.mockRestore();
  });
});

describe('useController', () => {
  it('creates the controller once per mount with DI deps', () => {
    @Controller()
    class Ctrl {
      svc = inject(Svc);
      id = Math.random();
    }
    const seen: any[] = [];
    function F() {
      const c = useController(Ctrl);
      seen.push(c);
      return <p>{c.svc.msg}</p>;
    }
    mount(() => <F />, scoped([Svc]));
    expect(screen.getByText('service message')).toBeTruthy();
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen).size).toBe(1); // same instance across renders
  });

  it('binds lifecycle to mount/unmount', async () => {
    const onInit = vi.fn();
    const onDestroy = vi.fn();
    @Controller()
    class Ctrl {
      onInit = onInit;
      onDestroy = onDestroy;
    }
    function F() {
      useController(Ctrl);
      return null;
    }
    const r = mount(() => <F />, scoped([]));
    expect(onInit).toHaveBeenCalledTimes(1);
    r.unmount();
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });
});

describe('Provide', () => {
  it('creates a child scope visible to descendants', () => {
    function Reader() {
      const s = useService(Svc);
      return <p>{s.msg}</p>;
    }
    mount(() => 
      <Provide providers={[Svc]}>
        <Reader />
      </Provide>,
      scoped([]) // Svc is NOT in the parent scope
    );
    expect(screen.getByText('service message')).toBeTruthy();
  });

  it('shadows parent providers within the subtree', () => {
    const parent = scoped([Svc]);
    class OtherSvc {
      msg = 'shadowed';
    }
    function Reader() {
      const s = useService(Svc as any) as any;
      return <p>{s.msg}</p>;
    }
    mount(() => 
      <Provide providers={[{ provide: Svc, useClass: OtherSvc }]}>
        <Reader />
      </Provide>,
      parent
    );
    expect(screen.getByText('shadowed')).toBeTruthy();
  });
});

describe('useInjector', () => {
  it('returns the ambient injector', () => {
    let got: Injector | undefined;
    function F() {
      got = useInjector();
      return null;
    }
    const inj = scoped([]);
    mount(() => <F />, inj);
    expect(got).toBe(inj);
  });
});
