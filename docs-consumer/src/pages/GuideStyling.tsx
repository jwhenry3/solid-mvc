import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function GuideStyling() {
  return (
    <article>
      <h1>Styling &amp; UI kits</h1>
      <p class="lead">
        Styling is framework-agnostic — JSX plus CSS. The enterprise example
        shows the full modern stack: Tailwind v4, shadcn-style design tokens,
        <code>cn()</code>, CVA variants, and a primitives layer in{' '}
        <code>src/ui/</code>.
      </p>

      <h2>Tailwind v4</h2>
      <CodeBlock
        language="bash"
        code={`npm install tailwindcss @tailwindcss/vite`}
      />
      <CodeBlock
        file="vite.config.ts"
        code={`import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [solidPlugin(), tailwindcss()] });`}
      />
      <CodeBlock
        file="src/styles.css"
        language="css"
        code={`@import 'tailwindcss';

/* Class-strategy dark mode — ThemeService toggles .dark on <html>. */
@custom-variant dark (&:where(.dark, .dark *));

/* shadcn-style design tokens as HSL channels. */
:root {
  --background: 0 0% 100%;
  --card: 0 0% 100%;
  --muted-foreground: 240 3.8% 46.1%;
  /* … light tokens … */
}
.dark {
  --background: 240 10% 3.9%;
  --card: 240 10% 5.9%;
  --muted-foreground: 240 5% 64.9%;
  /* … dark tokens … */
}

/* tokens → utilities: bg-card, text-muted-foreground, border-border, … */
@theme inline {
  --color-background: hsl(var(--background));
  --color-card: hsl(var(--card));
  --color-muted-foreground: hsl(var(--muted-foreground));
  /* … */
}`}
      />

      <h2>cn() + CVA primitives</h2>
      <CodeBlock
        file="lib/cn.ts"
        code={`import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// clsx for conditional joining, tailwind-merge so later classes win
// conflicts (px-2 vs px-4) — the shadcn composition primitive.
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));`}
      />
      <CodeBlock
        file="ui/button.tsx"
        language="tsx"
        code={`import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-input bg-transparent hover:bg-accent',
        ghost: 'hover:bg-accent',
      },
      size: { default: 'h-9 px-4', sm: 'h-8 px-3', lg: 'h-10 px-6' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({ class: c, variant, size, ...props }:
  JSX.IntrinsicElements['button'] & VariantProps<typeof buttonVariants>) {
  return <button class={cn(buttonVariants({ variant, size }), c)} {...props} />;
}`}
      />
      <p>
        The <code>JSX.IntrinsicElements['button']</code> trick types the
        component as "a button plus extras" — every real DOM prop passes
        through, which is what makes a primitives layer feel native. Add{' '}
        <code>children?: JSX.Element</code> to the intersection (it's
        not part of the intrinsic type).
      </p>

      <h2>Theming as a service</h2>
      <p>
        Dark mode is domain state, so it lives in an injectable —{' '}
        <code>ThemeService</code> holds the <code>theme</code> signal,
        persists to localStorage, follows <code>prefers-color-scheme</code>{' '}
        under <code>'system'</code>, and a scope-bound{' '}
        <code>effect()</code> toggles the <code>.dark</code> class. Views
        read <code>theme.isDark.value</code> for icon state; CSS does the
        rest through the token swap.
      </p>

      <h2>What the example's ui/ covers</h2>
      <table class="doc-table">
        <thead>
          <tr><th>Layer</th><th>Pieces</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Primitives</td>
            <td>Button, Input, Label, Badge, Separator, Skeleton, Avatar</td>
          </tr>
          <tr>
            <td>Layout</td>
            <td>Card family, Table family, Tabs (context-driven)</td>
          </tr>
          <tr>
            <td>Overlay</td>
            <td>Dialog (signal-controlled)</td>
          </tr>
          <tr>
            <td>Data viz</td>
            <td>Chart — an ECharts wrapper component</td>
          </tr>
        </tbody>
      </table>
      <p>
        All of it is plain function components over <code>cn()</code> — copy
        the folder into your app like shadcn intends. Browse it live in the{' '}
        <a href={docHref('demo-enterprise')}>enterprise demo</a> → Components
        tab.
      </p>
    </article>
  );
}
