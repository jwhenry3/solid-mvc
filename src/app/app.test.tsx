import { screen, fireEvent } from '@solidjs/testing-library';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bootstrap } from '@solid-mvc/core';
import { AppModule } from './app.module';

// Full-stack smoke: boots the real AppModule (router, modules, DI, views)
// into a DOM node the way main.tsx does. Solid flushes updates
// synchronously — no act() needed; bootstrap() returns the root disposer.

let host: HTMLElement;
let dispose: () => void;

function boot(path = '/') {
  history.pushState(null, '', path);
  host = document.createElement('div');
  document.body.appendChild(host);
  dispose = bootstrap(AppModule, host);
}

afterEach(() => {
  dispose?.();
  host?.remove();
});

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('AppModule integration', () => {
  // The root <RouterOutlet/> mounts the @solidjs/router tree via dynamic
  // import (keeps it out of worker bundles), so routed content lands a
  // tick after boot — await a routed element before interacting.
  const todosMounted = () => screen.findByRole('heading', { name: 'Todos' });

  it('boots the shell with nav and the default todos route', async () => {
    boot('/');
    expect(await screen.findByText('MVC + Modules + JSX')).toBeTruthy();
    expect(await todosMounted()).toBeTruthy();
    expect(screen.getByText(/remaining/)).toBeTruthy();
  });

  it('navigates between routes and tracks visits via the shared service', async () => {
    boot('/');
    await todosMounted();
    fireEvent.click(screen.getByRole('link', { name: 'Counter' }));
    expect(await screen.findByRole('heading', { name: 'Counter' })).toBeTruthy();
    expect(await screen.findByText(/Page visits this session: 2/)).toBeTruthy();
  });

  it('adds a todo through controller -> store -> view re-render', async () => {
    boot('/');
    const input = await screen.findByPlaceholderText('What needs doing?');
    fireEvent.input(input, { target: { value: 'integration todo' } });
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByText('integration todo')).toBeTruthy();
  });

  it('keeps module-scoped store state across navigation', async () => {
    boot('/');
    const input = await screen.findByPlaceholderText('What needs doing?');
    fireEvent.input(input, { target: { value: 'survives nav' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.click(screen.getByRole('link', { name: 'Counter' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Todos' }));
    expect(await screen.findByText('survives nav')).toBeTruthy();
  });

  it('enforces module ownership at /raw-todos with a local error boundary', async () => {
    boot('/raw-todos');
    expect(await screen.findByText(/failed to mount/)).toBeTruthy();
    expect(screen.getByText(/declared by TodoModule/)).toBeTruthy();
    // app shell still alive
    expect(screen.getByText('MVC + Modules + JSX')).toBeTruthy();
  });

  it('resolves :name route params', async () => {
    boot('/hello/world');
    expect(await screen.findByText('Hello, world!')).toBeTruthy();
  });
});
