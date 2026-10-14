import { Component, View, inject, RouterOutlet, Link, Router } from '@solid-mvc/core';
import ListTodo from 'lucide-solid/icons/list-todo';
import Plus from 'lucide-solid/icons/plus';
import Sparkles from 'lucide-solid/icons/sparkles';
import Boxes from 'lucide-solid/icons/boxes';
import Settings from 'lucide-solid/icons/settings';
import Sun from 'lucide-solid/icons/sun';
import Moon from 'lucide-solid/icons/moon';
import { SessionService } from './core/session.service';
import { APP_TITLE } from './core/tokens';
import { ThemeService } from './shared/theme.service';
import { Avatar } from '@/ui/misc';
import { cn } from '@/lib/cn';

const NAV = [
  { to: '/todos', match: '/todos', label: 'Todos', icon: ListTodo },
  { to: '/counter', match: '/counter', label: 'Counter', icon: Plus },
  { to: '/hello/ada', match: '/hello', label: 'Hello', icon: Sparkles },
  { to: '/island', match: '/island', label: 'Islands', icon: Boxes },
  { to: '/settings/general', match: '/settings', label: 'Settings', icon: Settings },
];

@Component()
export class AppShell extends View {
  private router = inject(Router);
  private session = inject(SessionService);
  private theme = inject(ThemeService);
  private title = inject(APP_TITLE);

  render() {
    const user = this.session.user.value.name;
    return (
      <div class="flex min-h-screen bg-background">
        {/* Sidebar */}
        <aside class="w-60 shrink-0 border-r bg-card flex flex-col">
          <div class="h-14 flex items-center px-4 border-b">
            <img src="/favicon.svg" alt="" class="h-7 w-7 mr-2" />
            <div class="min-w-0">
              <div class="font-semibold">SolidMVC</div>
              <div class="text-xs text-muted-foreground truncate">{this.title}</div>
            </div>
          </div>
          <nav class="flex-1 p-2 space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = this.router.url.value!.startsWith(n.match);
              return (
                <Link
                  to={n.to}
                  class={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-secondary text-secondary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon size={16} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div class="p-3 border-t">
            <div class="flex items-center gap-3 px-1">
              <Avatar name={user} class="h-8 w-8" />
              <div class="text-sm">
                <div class="font-medium">{user}</div>
                <div class="text-xs text-muted-foreground">
                  visits: {this.session.visits.value}
                </div>
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
                {NAV.find((n) => this.router.url.value!.startsWith(n.match))?.label ?? 'Todos'}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors cursor-pointer"
                onClick={() => this.theme.toggle()}
                title="Toggle theme"
              >
                {this.theme.resolved.value === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <Avatar name={user} class="h-8 w-8" />
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
