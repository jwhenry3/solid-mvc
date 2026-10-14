import { Module } from '@solid-mvc/core';
import { ThemeService } from './theme.service';

@Module({
  providers: [ThemeService],
})
export class SharedModule {}
