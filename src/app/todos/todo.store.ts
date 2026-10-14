import { Injectable, inject, signal, computed, effect } from '@solid-mvc/core';
import { API_URL } from '../core/tokens';

export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

// Model layer: owns domain state and operations. Provided by TodoModule, so
// its scope is the feature — a store instance per module injector.
@Injectable()
export class TodoStore {
  private apiUrl = inject(API_URL); // value provided at the app root

  todos = signal<Todo[]>(TodoStore.load());
  remaining = computed(() => this.todos.value.filter((t) => !t.done).length);

  private nextId = Math.max(0, ...this.todos.value.map((t) => t.id)) + 1;

  // Property-assigned effect: field initializers run inside the injection
  // context, so its disposer registers on the TodoModule injector scope.
  // Declared last since effects run once immediately — it must read todos
  // after the signal exists.
  private persist = effect(() => {
    window.localStorage.setItem('todos', JSON.stringify(this.todos.value));
  });

  private static load(): Todo[] {
    try {
      return JSON.parse(window.localStorage.getItem('todos') ?? '') ?? TodoStore.seed();
    } catch {
      return TodoStore.seed();
    }
  }

  private static seed(): Todo[] {
    return [
      { id: 1, text: 'Design the framework', done: true },
      { id: 2, text: 'Build the demo', done: false },
    ];
  }

  add(text: string) {
    // apiUrl would prefix a real fetch; logged here to prove token injection
    console.debug(`[TodoStore] add via ${this.apiUrl}/todos`);
    this.todos.value = [...this.todos.value, { id: this.nextId++, text, done: false }];
  }

  toggle(id: number) {
    this.todos.value = this.todos.value.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }

  remove(id: number) {
    this.todos.value = this.todos.value.filter((t) => t.id !== id);
  }
}
