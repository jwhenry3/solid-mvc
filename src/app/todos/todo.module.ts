import { Module } from '@solid-mvc/core';
import { TodoStore } from './todo.store';
import { TodoView } from './todo.view';

@Module({
  providers: [TodoStore],
  components: [TodoView],
  bootstrap: [TodoView], // view rendered when this module is mounted by a route
})
export class TodoModule {}
