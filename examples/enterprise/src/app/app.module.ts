import { Module, RouterModule } from '@solid-mvc/core';
import { SessionService } from '@/services/session.service';
import { ThemeService } from '@/services/theme.service';
import { PageWorkerHost } from '@/services/page-worker.service';
import { QueryModule } from '@/lib/query.module';
import { routes } from './routes';
import { ShellView } from './shell';

@Module({
  imports: [QueryModule.forRoot(), RouterModule.forRoot(routes)],
  // Every page runs in a worker, so the only main-thread query consumer is
  // ShellController's skipToken observer fed by BroadcastChannel sync.
  providers: [SessionService, ThemeService, PageWorkerHost],
  bootstrap: [ShellView],
})
export class AppModule {}
