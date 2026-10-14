import { For } from 'solid-js';
import { Component, View, inject } from '@solid-mvc/core';
import { TodoController } from './todo.controller';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { cn } from '@/lib/cn';

// View layer as a class: injection happens once at mount inside this view's
// own injector scope. render() is a pure JSX projection — it reads signals
// (auto-tracked) and delegates events to the controller.
// Declaring the controller here registers it in this view's scope — shared
// with any nested views, per-instance of the mounted view.
@Component({ controllers: [TodoController] })
export class TodoView extends View {
  private c = inject(TodoController);

  render() {
    const c = this.c;
    return (
      <section class="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Todos</CardTitle>
            <CardDescription>
              {c.remaining.value} remaining — a declared controller owns the state; the view
              just projects signals and delegates events.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <form
              class="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                c.submit();
              }}
            >
              <Input
                placeholder="What needs doing?"
                value={c.draft.value}
                onInput={(e) => (c.draft.value = (e.target as HTMLInputElement).value)}
              />
              <Button type="submit">Add</Button>
            </form>
            <ul class="divide-y">
              <For each={c.todos.value}>
                {(t) => (
                <li class="flex items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    class="h-4 w-4 cursor-pointer"
                    checked={t.done}
                    onChange={() => c.toggle(t.id)}
                  />
                  <span
                    class={cn(
                      'flex-1 text-sm',
                      t.done && 'line-through text-muted-foreground',
                    )}
                  >
                    {t.text}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => c.remove(t.id)}>
                    ✕
                  </Button>
                </li>
                )}
              </For>
            </ul>
          </CardContent>
        </Card>
      </section>
    );
  }
}
