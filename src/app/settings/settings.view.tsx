import { Component, View, inject, Router, RouterOutlet, Link } from '@solid-mvc/core';
import SlidersHorizontal from 'lucide-solid/icons/sliders-horizontal';
import KeyRound from 'lucide-solid/icons/key-round';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { cn } from '@/lib/cn';

const SUB = [
  { to: '/settings/general', label: 'General', icon: SlidersHorizontal },
  { to: '/settings/security', label: 'Security', icon: KeyRound },
];

// The parent route renders this shell; its children render into the
// nested <RouterOutlet/> — the URL is matched as a chain, params merge.
@Component()
export class SettingsShellView extends View {
  private router = inject(Router);

  render() {
    return (
      <section class="max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              A parent route with children — this shell stays mounted while the
              nested outlet swaps pages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex gap-2 border-b pb-3">
              {SUB.map((s) => {
                const Icon = s.icon;
                return (
                  <Link
                    to={s.to}
                    class={cn(
                      'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                      this.router.url.value === s.to
                        ? 'bg-secondary text-secondary-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Icon size={14} />
                    {s.label}
                  </Link>
                );
              })}
            </div>
            <div class="pt-4">
              <RouterOutlet />
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }
}

@Component()
export class GeneralSettingsView extends View {
  render() {
    return (
      <p class="text-sm text-muted-foreground">
        General preferences — rendered by the depth-1 outlet at{' '}
        <code>/settings/general</code>.
      </p>
    );
  }
}

@Component()
export class SecuritySettingsView extends View {
  render() {
    return (
      <p class="text-sm text-muted-foreground">
        Security &amp; sessions — the second child route, <code>/settings/security</code>.
        Params merge across the chain, so children see parent params too.
      </p>
    );
  }
}
