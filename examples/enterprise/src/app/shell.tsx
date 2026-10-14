import { For, Show } from 'solid-js';
import { Component, View, inject, Link, RouterOutlet, Router } from '@solid-mvc/core';
import LayoutDashboard from 'lucide-solid/icons/layout-dashboard';
import Users from 'lucide-solid/icons/users';
import Settings from 'lucide-solid/icons/settings';
import Boxes from 'lucide-solid/icons/boxes';
import Sun from 'lucide-solid/icons/sun';
import Moon from 'lucide-solid/icons/moon';
import { SessionService } from '@/services/session.service';
import { ThemeService } from '@/services/theme.service';
import { ShellController } from './shell.controller';
import { Avatar } from '@/ui/misc';
import { Separator } from '@/ui/misc';
import { cn } from '@/lib/cn';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/components', label: 'Components', icon: Boxes },
  { to: '/settings', label: 'Settings', icon: Settings },
];

@Component({ controllers: [ShellController] })
export class ShellView extends View {
  private router = inject(Router);
  private theme = inject(ThemeService);
  private session = inject(SessionService);
  private c = inject(ShellController);

  render() {
    // Signal reads live inside JSX accessors — Solid tracks them there;
    // render() itself runs once per mount.
    return (
      <div class="flex min-h-screen bg-background">
        {/* Sidebar */}
        <aside class="w-60 shrink-0 border-r bg-card flex flex-col">
          <div class="h-14 flex items-center px-4 border-b">
            <div class="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mr-2">
              E
            </div>
            <span class="font-semibold">Enterprise</span>
          </div>
          <nav class="flex-1 p-2 space-y-1">
            <For each={NAV}>
              {(n) => {
                const Icon = n.icon;
                return (
                  <Link
                    to={n.to}
                    class={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      this.router.url.value === n.to
                        ? 'bg-secondary text-secondary-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Icon size={16} />
                    {n.label}
                  </Link>
                );
              }}
            </For>
          </nav>
          <div class="p-3 border-t">
            <div class="flex items-center gap-3 px-1">
              <Avatar name={this.session.user.value.name} class="h-8 w-8" />
              <div class="text-sm">
                <div class="font-medium">{this.session.user.value.name}</div>
                <div class="text-xs text-muted-foreground">{this.session.user.value.role}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div class="flex-1 flex flex-col min-w-0">
          <header class="h-14 border-b bg-card flex items-center justify-between px-6">
            <div class="text-sm text-muted-foreground">
              Workspace <span class="mx-1">/</span>{' '}
              <span class="text-foreground font-medium">
                {NAV.find((n) => n.to === this.router.url.value)?.label ?? 'Dashboard'}
              </span>
              <Show when={this.c.syncedRevenue.value}>
                <span
                  class="ml-3 text-xs"
                  title="Hydrated via BroadcastChannel cache sync — the shell never fetched this"
                >
                  · Revenue {this.c.syncedRevenue.value} (worker-synced)
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors cursor-pointer"
                onClick={() => this.theme.toggle()}
                title="Toggle theme"
              >
                {this.theme.resolved.value === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <Avatar name={this.session.user.value.name} class="h-8 w-8" />
            </div>
          </header>
          <main class="flex-1 p-6 overflow-auto">
            <RouterOutlet />
          </main>
        </div>
      </div>
    );
  }
}
