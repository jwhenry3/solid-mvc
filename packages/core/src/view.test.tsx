import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { signal } from './signals';
import { Injector } from './injector';
import { inject } from './injector';
import { InjectorContext } from './context';
import { View } from './view';
import { Component, Module } from './decorators';
import { createModuleInjector } from './module';

// Solid children evaluate eagerly at the JSX site — pass a THUNK so the
// view's createComponent call lands inside the Provider's context owner.
function mount(node: () => any, injector = new Injector()) {
  return render(() => (
    <InjectorContext.Provider value={injector}>{node()}</InjectorContext.Provider>
  ));
}

afterEach(() => cleanup());

class Greeting extends View {
  render() {
    return <p>hello from class view</p>;
  }
}

describe('class-based views', () => {
  it('renders a View subclass anywhere JSX can appear', () => {
    mount(() => <Greeting />);
    expect(screen.getByText('hello from class view')).toBeTruthy();
  });

  it('runs inject() in field initializers at mount', () => {
    class Svc {
      msg = 'injected';
    }
    class V extends View {
      s = inject(Svc);
      render() {
        return <p>{this.s.msg}</p>;
      }
    }
    const inj = new Injector();
    inj.provide(Svc);
    mount(() => <V />, inj);
    expect(screen.getByText('injected')).toBeTruthy();
  });

  it('re-renders when signals read in render() change', async () => {
    class V extends View {
      n = signal(0);
      render() {
        return <button onClick={() => this.n.value++}>n={this.n.value}</button>;
      }
    }
    mount(() => <V />);
    expect(screen.getByText('n=0')).toBeTruthy();
    fireEvent.click(screen.getByText('n=0'));
    expect(screen.getByText('n=1')).toBeTruthy();
  });

  it('calls onInit on mount and onDestroy on unmount', async () => {
    const onInit = vi.fn();
    const onDestroy = vi.fn();
    class V extends View {
      onInit = onInit;
      onDestroy = onDestroy;
      render() {
        return <p>v</p>;
      }
    }
    const r = mount(() => <V />);
    expect(onInit).toHaveBeenCalledTimes(1);
    r.unmount();
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it('fires lifecycle on controllers injected into the view', async () => {
    const onInit = vi.fn();
    class Ctrl {
      onInit = onInit;
    }
    (Ctrl as any).__controller = true;
    class V extends View {
      c = inject(Ctrl);
      render() {
        return <p>v</p>;
      }
    }
    mount(() => <V />);
    expect(onInit).toHaveBeenCalledTimes(1);
  });

  it('supports view-scoped providers via @Component({ providers })', () => {
    class Svc {
      id = Math.random();
    }
    @Component({ providers: [Svc] })
    class V extends View {
      s = inject(Svc);
      render() {
        return <p>{this.s.id}</p>;
      }
    }
    // Svc is NOT provided in the parent scope — only at the view level.
    mount(() => <V />);
    expect(document.querySelector('p')!.textContent).not.toBe('');
  });

  it('passes props onto the view instance', () => {
    class V extends View<{ label: string }> {
      render() {
        return <p>{this.props.label}</p>;
      }
    }
    mount(() => <V label="prop value" />);
    expect(screen.getByText('prop value')).toBeTruthy();
  });

  it('child views resolve through the parent view’s injector', () => {
    class Svc {
      tag = 'from parent scope';
    }
    class Child extends View {
      s = inject(Svc);
      render() {
        return <p>{this.s.tag}</p>;
      }
    }
    @Component({ providers: [Svc] })
    class Parent extends View {
      render() {
        return <Child />;
      }
    }
    mount(() => <Parent />);
    expect(screen.getByText('from parent scope')).toBeTruthy();
  });

});

describe('@Component declarations', () => {
  it('controllers declared on a component are shared with its subtree', () => {
    class Ctrl {
      id = Math.random();
    }
    (Ctrl as any).__controller = true;
    class Child extends View {
      c = inject(Ctrl);
      render() {
        return <p data-testid="child">{this.c.id}</p>;
      }
    }
    @Component({ controllers: [Ctrl] })
    class Parent extends View {
      c = inject(Ctrl);
      render() {
        return (
          <div>
            <p data-testid="parent">{this.c.id}</p>
            <Child />
          </div>
        );
      }
    }
    mount(() => <Parent />);
    const parentId = screen.getByTestId('parent').textContent;
    const childId = screen.getByTestId('child').textContent;
    expect(parentId).toBe(childId); // child resolved parent's instance
  });

  it('a mounted view gets a fresh controller instance per view scope', () => {
    class Ctrl {
      id = Math.random();
    }
    (Ctrl as any).__controller = true;
    @Component({ controllers: [Ctrl] })
    class V extends View {
      c = inject(Ctrl);
      render() {
        return <p data-testid="v">{this.c.id}</p>;
      }
    }
    mount(() => 
      <div>
        <V />
        <V />
      </div>
    );
    const ids = screen.getAllByTestId('v').map((e) => e.textContent);
    expect(ids[0]).not.toBe(ids[1]); // two mounts -> two controllers
  });

  it('standalone imports give a module-less view the module’s providers', () => {
    class Svc {
      tag = 'imported';
    }
    @Module({ providers: [Svc] })
    class M {}
    @Component({ imports: [M] })
    class Standalone extends View {
      s = inject(Svc);
      render() {
        return <p>{this.s.tag}</p>;
      }
    }
    // Standalone is declared in NO module — mounts under a bare injector.
    mount(() => <Standalone />);
    expect(screen.getByText('imported')).toBeTruthy();
  });

  it('standalone imports also satisfy ownership for the module’s components', async () => {
    class Owned extends View {
      render() {
        return <p>owned rendered</p>;
      }
    }
    @Module({ components: [Owned] })
    class M {}
    @Component({ imports: [M] })
    class Standalone extends View {
      render() {
        return <Owned />;
      }
    }
    mount(() => <Standalone />);
    expect(await screen.findByText('owned rendered')).toBeTruthy();
  });
});

describe('module ownership enforcement', () => {
  it('declared views mounted out of scope fail locally, not globally', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    class Owned extends View {
      render() {
        return <p>owned</p>;
      }
    }
    @Module({ components: [Owned] })
    class M {}
    // Rendered under a bare injector — M is not an ancestor.
    mount(() => <Owned />);
    expect(await screen.findByText(/failed to mount/)).toBeTruthy();
    expect(screen.getByText(/declared by M/)).toBeTruthy();
    errSpy.mockRestore();
  });

  it('declared views mount inside their module’s injector', async () => {
    class Owned extends View {
      render() {
        return <p>owned ok</p>;
      }
    }
    @Module({ components: [Owned] })
    class M {}
    const inj = createModuleInjector(M, new Injector());
    mount(() => <Owned />, inj);
    expect(await screen.findByText('owned ok')).toBeTruthy();
  });

  it('declared views mount under an injector that imported their module', async () => {
    class Shared extends View {
      render() {
        return <p>shared ok</p>;
      }
    }
    @Module({ components: [Shared] })
    class SharedMod {}
    @Module({ imports: [SharedMod] })
    class FeatureMod {}
    const inj = createModuleInjector(FeatureMod, new Injector());
    mount(() => <Shared />, inj);
    expect(await screen.findByText('shared ok')).toBeTruthy();
  });

  it('undeclared views mount freely anywhere', () => {
    mount(() => <Greeting />);
    expect(screen.getByText('hello from class view')).toBeTruthy();
  });
});

describe('error boundary', () => {
  it('catches render errors and shows a fallback instead of crashing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    class Bad extends View {
      render(): never {
        throw new Error('kaboom');
      }
    }
    mount(() => 
      <div>
        <p>sibling</p>
        <Bad />
      </div>
    );
    expect(await screen.findByText(/failed to mount/)).toBeTruthy();
    expect(screen.getByText(/kaboom/)).toBeTruthy();
    // the rest of the tree survived
    expect(screen.getByText('sibling')).toBeTruthy();
    errSpy.mockRestore();
  });

  it('catches construction (inject) errors the same way', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    class Missing {}
    class NeedsDep extends View {
      dep = inject(Missing);
      render() {
        return <p>never</p>;
      }
    }
    mount(() => <NeedsDep />);
    expect(await screen.findByText(/failed to mount/)).toBeTruthy();
    expect(screen.getByText(/No provider for Missing/)).toBeTruthy();
    errSpy.mockRestore();
  });
});
