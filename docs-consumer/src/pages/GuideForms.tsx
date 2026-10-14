import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function GuideForms() {
  return (
    <article>
      <h1>Forms &amp; validation</h1>
      <p class="lead">
        The honest pattern needs no form library: a declared controller owns
        field signals and submit logic, a schema library (zod shown here)
        validates the aggregate, and the view just binds inputs.
      </p>

      <h2>Schema + controller</h2>
      <CodeBlock
        file="settings.view.tsx (controller)"
        code={`import { z } from 'zod';

const schema = z.object({
  orgName: z.string().min(2, 'Organization name is too short'),
  email: z.string().email('Enter a valid email'),
  region: z.enum(['us-east', 'eu-west', 'ap-south']),
  notifyDeploys: z.boolean(),
});
type SettingsForm = z.infer<typeof schema>;

@Controller()
export class SettingsController {
  orgName = signal('Acme Inc');
  email = signal('ops@acme.dev');
  region = signal<SettingsForm['region']>('us-east');
  notifyDeploys = signal(true);

  errors = signal<Partial<Record<keyof SettingsForm, string>>>({});
  saved = signal(false);
  dirty = signal(false);

  touch() { this.dirty.value = true; this.saved.value = false; }

  submit() {
    const parsed = schema.safeParse({
      orgName: this.orgName.value,
      email: this.email.value,
      region: this.region.value,
      notifyDeploys: this.notifyDeploys.value,
    });
    if (!parsed.success) {
      const errs: typeof this.errors.value = {};
      for (const i of parsed.error.issues)
        errs[i.path[0] as keyof SettingsForm] = i.message;
      this.errors.value = errs;
      return;
    }
    this.errors.value = {};
    this.saved.value = true;
    this.dirty.value = false;
  }
}`}
      />

      <h2>The view binds signals</h2>
      <CodeBlock
        file="settings.view.tsx"
        language="tsx"
        code={`@Component({ controllers: [SettingsController] })
export class SettingsView extends View {
  private c = inject(SettingsController);

  render() {
    const c = this.c;
    return (
      <form onSubmit={(e) => { e.preventDefault(); c.submit(); }}>
        <Label for="email">Contact email</Label>
        <Input
          id="email" type="email"
          value={c.email.value}
          class={c.errors.value.email ? 'border-destructive' : ''}
          onInput={(e) => {
            c.touch();
            c.email.value = e.currentTarget.value;
          }}
        />
        {c.errors.value.email && (
          <p class="text-destructive">{c.errors.value.email}</p>
        )}

        <Button type="submit">Save changes</Button>
        {c.saved.value && <Badge variant="success">Saved</Badge>}
        {c.dirty.value && !c.saved.value && <span>unsaved changes</span>}
      </form>
    );
  }
}`}
      />

      <h2>Why this shape</h2>
      <ul>
        <li>
          <strong>Field state lives off the render path.</strong> Typing
          writes a signal — no synthetic form context, no controlled-input
          re-render cascades (updates are fine-grained, so inputs keep DOM
          focus naturally).
        </li>
        <li>
          <strong>Validation is a plain function call.</strong>{' '}
          <code>schema.safeParse</code> at submit; per-field errors land in a
          record the view renders inline. Swap zod for valibot/arktype —
          nothing else changes.
        </li>
        <li>
          <strong>The controller is testable headless.</strong>{' '}
          <code>new SettingsController()</code> + <code>submit()</code> in a
          unit test exercises the whole validation path without DOM.
        </li>
        <li>
          <strong>Sharing is a declaration.</strong> Declared on{' '}
          <code>@Component</code>, field sub-components inject the same
          controller — multi-field widgets for free. See{' '}
          <a href={docHref('controllers')}>Controllers</a>.
        </li>
      </ul>
      <p>
        Full working version in the{' '}
        <a href={docHref('demo-enterprise')}>enterprise demo</a> → Settings
        tab.
      </p>
    </article>
  );
}
