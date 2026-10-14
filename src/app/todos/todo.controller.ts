import { Controller, inject, signal } from '@solid-mvc/core';
import type { OnInit } from '@solid-mvc/core';
import { SessionService } from '../core/session.service';
import { TodoStore } from './todo.store';

// Controller layer: view-local state (draft) + event handling + lifecycle.
// One instance per mounted TodoView. Constructor `inject()` resolves up the
// injector tree: TodoStore from TodoModule, SessionService from root.
@Controller()
export class TodoController implements OnInit {
  private store = inject(TodoStore);
  private session = inject(SessionService);

  draft = signal('');

  get todos() {
    return this.store.todos;
  }
  get remaining() {
    return this.store.remaining;
  }

  onInit() {
    this.session.recordVisit();
  }

  submit() {
    const text = this.draft.value.trim();
    if (!text) return;
    this.store.add(text);
    this.draft.value = '';
  }

  toggle(id: number) {
    this.store.toggle(id);
  }

  remove(id: number) {
    this.store.remove(id);
  }
}
