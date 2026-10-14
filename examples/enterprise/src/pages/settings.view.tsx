/**
 * Forms the framework way: a declared controller owns field signals and
 * validation (zod schema parse on submit), the view binds inputs to those
 * signals. The controller lives in settings.controller.ts; this file is
 * the projection only.
 */
import { For } from 'solid-js';
import { Component, View, inject } from '@solid-mvc/core';
import Check from 'lucide-solid/icons/check';
import { SettingsController, type SettingsForm } from './settings.controller';
import type { Theme } from '@/services/theme.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Input, Label } from '@/ui/input';
import { Badge } from '@/ui/badge';
import { Separator } from '@/ui/misc';
import { cn } from '@/lib/cn';

@Component({ controllers: [SettingsController] })
export class SettingsView extends View<{
  theme?: Theme;
  onThemeChange?: (t: Theme) => void;
}> {
  private c = inject(SettingsController);

  render() {
    const c = this.c;
    return (
      <div class="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Workspace settings</CardTitle>
            <CardDescription>
              A declared controller owns the form; zod validates on submit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              class="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                c.submit();
              }}
            >
              <div class="space-y-1.5">
                <Label for="org">Organization name</Label>
                <Input
                  id="org"
                  value={c.orgName.value}
                  class={cn(c.errors.value.orgName && 'border-destructive')}
                  onInput={(e) => {
                    c.touch();
                    c.orgName.value = (e.target as HTMLInputElement).value;
                  }}
                />
                {c.errors.value.orgName && (
                  <p class="text-xs text-destructive">{c.errors.value.orgName}</p>
                )}
              </div>

              <div class="space-y-1.5">
                <Label for="email">Contact email</Label>
                <Input
                  id="email"
                  type="email"
                  value={c.email.value}
                  class={cn(c.errors.value.email && 'border-destructive')}
                  onInput={(e) => {
                    c.touch();
                    c.email.value = (e.target as HTMLInputElement).value;
                  }}
                />
                {c.errors.value.email && (
                  <p class="text-xs text-destructive">{c.errors.value.email}</p>
                )}
              </div>

              <div class="space-y-1.5">
                <Label for="region">Region</Label>
                <select
                  id="region"
                  class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={c.region.value}
                  onChange={(e) => {
                    c.touch();
                    c.region.value = (e.target as HTMLSelectElement).value as SettingsForm['region'];
                  }}
                >
                  <option value="us-east">US East</option>
                  <option value="eu-west">EU West</option>
                  <option value="ap-south">AP South</option>
                </select>
              </div>

              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={c.notifyDeploys.value}
                  class="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                  onChange={(e) => {
                    c.touch();
                    c.notifyDeploys.value = (e.target as HTMLInputElement).checked;
                  }}
                />
                Notify on deploys
              </label>

              <div class="flex items-center gap-3 pt-2">
                <Button type="submit">Save changes</Button>
                {c.saved.value && (
                  <Badge variant="success">
                    <Check size={12} class="mr-1" /> Saved
                  </Badge>
                )}
                {c.dirty.value && !c.saved.value && (
                  <span class="text-xs text-muted-foreground">unsaved changes</span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              ThemeService stays shell-side (document/matchMedia) — the theme
              crosses the wire as a prop and the setter as a callbackProp.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <Separator />
            <div class="flex items-center gap-2 pt-2">
              <For each={['light', 'dark', 'system'] as Theme[]}>
                {(t) => (
                  <Button
                    variant={this.props.theme === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => this.props.onThemeChange?.(t)}
                  >
                    {t}
                  </Button>
                )}
              </For>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
