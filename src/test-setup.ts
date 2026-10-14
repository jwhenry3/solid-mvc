// Node 22+ exposes an experimental `localStorage` global that is undefined
// unless --localstorage-file is passed. It shadows jsdom's storage (window ===
// globalThis in vitest's jsdom env), so redefine it with a minimal in-memory
// Storage implementation for tests.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
});

// jsdom stubs scrollTo as a not-implemented error — @solidjs/router calls
// it on every navigation, so stub it silently.
Object.defineProperty(globalThis, 'scrollTo', {
  value: () => {},
  configurable: true,
  writable: true,
});

// jsdom has no matchMedia — the dark-mode ThemeService only needs the
// matches flag + listener plumbing, so a fixed "light" stub suffices.
if (typeof globalThis.matchMedia !== 'function') {
  Object.defineProperty(globalThis, 'matchMedia', {
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
    configurable: true,
  });
}
