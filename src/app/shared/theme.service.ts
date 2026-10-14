import { Injectable, inject, signal, effect, DestroyRef } from '@solid-mvc/core';

export type Theme = 'light' | 'dark' | 'system';

const KEY = 'smvc-theme';

@Injectable()
export class ThemeService {
  /** Demo accent — HelloView reads it to show module-provided theming. */
  accent = '#2c4f7c';
  headingStyle = { color: this.accent };

  theme = signal<Theme>((localStorage.getItem(KEY) as Theme) ?? 'system');
  /** Resolved theme — what is actually applied. */
  resolved = signal<'light' | 'dark'>('light');

  private media = matchMedia('(prefers-color-scheme: dark)');
  private destroyRef = inject(DestroyRef);

  constructor() {
    const apply = (): void => {
      const t =
        this.theme.value === 'system'
          ? this.media.matches
            ? 'dark'
            : 'light'
          : this.theme.value;
      this.resolved.value = t;
      document.documentElement.classList.toggle('dark', t === 'dark');
    };
    apply();
    const onMedia = (): void => apply();
    this.media.addEventListener('change', onMedia);
    this.destroyRef.onDestroy(() => this.media.removeEventListener('change', onMedia));
    // Persist + re-apply whenever the choice changes — scope-bound effect.
    effect(() => {
      localStorage.setItem(KEY, this.theme.value);
      apply();
    });
  }

  toggle(): void {
    this.theme.value = this.resolved.value === 'dark' ? 'light' : 'dark';
  }
}
