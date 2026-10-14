import { Controller, signal } from '@solid-mvc/core';
import { z } from 'zod';

/**
 * Controller layer for SettingsView: owns field signals, dirty/saved
 * state, and validation (zod schema parse on submit). The view binds
 * inputs to these signals — no form library needed, and none of the
 * React form libs would fit class-first views anyway.
 */
const schema = z.object({
  orgName: z.string().min(2, 'Organization name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  region: z.enum(['us-east', 'eu-west', 'ap-south']),
  notifyDeploys: z.boolean(),
});

export type SettingsForm = z.infer<typeof schema>;

@Controller()
export class SettingsController {
  orgName = signal('Acme Inc');
  email = signal('ops@acme.dev');
  region = signal<SettingsForm['region']>('us-east');
  notifyDeploys = signal(true);
  errors = signal<Partial<Record<keyof SettingsForm, string>>>({});
  saved = signal(false);
  dirty = signal(false);

  touch(): void {
    this.dirty.value = true;
    this.saved.value = false;
  }

  submit(): void {
    const parsed = schema.safeParse({
      orgName: this.orgName.value,
      email: this.email.value,
      region: this.region.value,
      notifyDeploys: this.notifyDeploys.value,
    });
    if (!parsed.success) {
      const errs: Partial<Record<keyof SettingsForm, string>> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path[0] as keyof SettingsForm] = issue.message;
      }
      this.errors.value = errs;
      this.saved.value = false;
      return;
    }
    this.errors.value = {};
    this.saved.value = true;
    this.dirty.value = false;
  }
}
