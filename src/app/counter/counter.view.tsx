import { Component, View, inject, signal, computed } from '@solid-mvc/core';
import type { OnInit } from '@solid-mvc/core';
import { SessionService } from '../core/session.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';

// The other end of the spectrum: no separate controller — the component class
// holds its own signals (React-style freedom) while still participating in
// mount-time DI and lifecycle.
@Component()
export class CounterView extends View implements OnInit {
  private session = inject(SessionService); // root-scoped, shared with todos

  count = signal(0);
  doubled = computed(() => this.count.value * 2);

  onInit() {
    this.session.recordVisit();
  }

  render() {
    return (
      <section class="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Counter</CardTitle>
            <CardDescription>
              Signals live on the view class itself — no controller needed.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => (this.count.value -= 1)}
              >
                −
              </Button>
              <div class="text-3xl font-semibold tabular-nums w-20 text-center">
                {this.count.value}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => (this.count.value += 1)}
              >
                +
              </Button>
              <span class="text-sm text-muted-foreground">
                doubled: {this.doubled.value}
              </span>
            </div>
            <p class="text-sm text-muted-foreground">
              Page visits this session: {this.session.visits.value}
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }
}
