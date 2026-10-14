import { Module } from '@solid-mvc/core';
import { CounterView } from './counter.view';

@Module({
  components: [CounterView],
  bootstrap: [CounterView],
})
export class CounterModule {}
