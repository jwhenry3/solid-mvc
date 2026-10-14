import { Component, View, inject, computed, Router } from '@solid-mvc/core';
import { SharedModule } from '../shared/shared.module';
import { ThemeService } from '../shared/theme.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';

// Standalone component: declared in NO module, mounts anywhere, yet still
// pulls SharedModule's providers into its own injector via `imports` —
// Angular's standalone-component model.
@Component({ imports: [SharedModule] })
export class HelloView extends View {
  private router = inject(Router);
  private theme = inject(ThemeService); // provided by the imported module
  private name = computed(() => this.router.params.value.name ?? 'stranger');

  render() {
    return (
      <section class="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle style={this.theme.headingStyle}>Hello, {this.name.value}!</CardTitle>
            <CardDescription>
              Try <code>/hello/world</code> — the name comes from a <code>:name</code> route
              param. The accent color comes from a module this component imported itself.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">
              This view is standalone: declared by no module, it mounts by route and imports
              SharedModule's providers into its own injector scope.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }
}
