/**
 * `smvc generate|g <schematic> <name>` — file generators, the `ng g`
 * equivalent. Schematics: view|component, controller, service, module,
 * island. Flags: --path <dir>, --skip-tests, -d/--dry-run, --force.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  featureName,
  findProjectRoot,
  render,
  toCamel,
  toPascal,
  writeFile,
  fail,
  warn,
  log,
} from '../lib.mjs';
import * as T from '../templates.mjs';

/** words → sentence case for <h1>s: 'user-card' → 'User card' */
function title(kebab) {
  const s = kebab.replace(/-/g, ' ');
  return s[0].toUpperCase() + s.slice(1);
}

function tokensFor(name, dirName) {
  const KEBAB = name;
  const CAMEL = toCamel(name);
  const CLASS = toPascal(name);
  return { KEBAB, CAMEL, CLASS, TITLE: title(dirName ?? name) };
}

const SCHEMATICS = {
  view: (root, name, a) => {
    const dir = a.path ?? `src/app/${name}`;
    const tk = tokensFor(name);
    writeFile(root, `${dir}/${name}.view.tsx`, render(T.G_VIEW, tk), a);
    if (!a['skip-tests']) {
      writeFile(root, `${dir}/${name}.view.test.tsx`, render(T.G_VIEW_TEST, tk), a);
    }
    log(`\nMount it: add a route in src/app/app.routes.ts, or declare it in a module's \`components\`.`);
  },

  component: (root, name, a) => SCHEMATICS.view(root, name, a),

  controller: (root, name, a) => {
    const dir = a.path ?? `src/app/${name}`;
    const tk = tokensFor(name);
    writeFile(root, `${dir}/${name}.controller.ts`, render(T.G_CONTROLLER, tk), a);
    log(`\nUse it: @Component({ controllers: [${tk.CLASS}Controller] }) or inject(${tk.CLASS}Controller) (transient).`);
  },

  service: (root, name, a) => {
    const dir = a.path ?? `src/app/${name}`;
    const tk = tokensFor(name);
    writeFile(root, `${dir}/${name}.service.ts`, render(T.G_SERVICE, tk), a);
    log(`\nInject it: inject(${tk.CLASS}Service) inside a view or controller constructor/field.`);
  },

  module: (root, name, a) => {
    const dir = a.path ?? `src/app/${name}`;
    const tk = tokensFor(name);
    writeFile(root, `${dir}/${name}.module.ts`, render(T.G_MODULE, tk), a);
    log(`\nRegister it: imports: [${tk.CLASS}Module] on the root module, or { path, module: ${tk.CLASS}Module } on a route.`);
  },

  island: (root, name, a) => {
    const tk = tokensFor(name);
    const contract = `src/islands/${name}.contract.ts`;
    const worker = `src/workers/${name}.worker.tsx`;
    writeFile(root, contract, render(T.T_ISLAND_CONTRACT, tk), a);
    writeFile(root, worker, render(T.T_ISLAND_WORKER, tk), a);
    log(`
Mount it from any view:

  import { islandComponent } from '@solid-mvc/atoll-island';
  import { ${tk.CAMEL}Contract } from '../../islands/${name}.contract';

  const ${tk.CLASS}Island = islandComponent(${tk.CAMEL}Contract);
  // <${tk.CLASS}Island onEvent={(n, p) => …} />`);
  },
};

export function cmdGenerate(a) {
  const schematic = a._[0];
  const rawName = a._[1];
  if (!schematic || !rawName) {
    fail(
      'usage: smvc generate <view|controller|service|module|island> <name>\n' +
        `       schematics: ${Object.keys(SCHEMATICS).join(', ')}`,
    );
  }
  const gen = SCHEMATICS[schematic];
  if (!gen) {
    fail(`unknown schematic "${schematic}" — expected one of: ${Object.keys(SCHEMATICS).join(', ')}`);
  }

  const found = findProjectRoot();
  if (!found) fail('not inside a SolidMVC project (no @solid-mvc/core dependency found)');
  const name = featureName(rawName);

  if (schematic === 'island') {
    const deps = { ...found.pkg.dependencies, ...found.pkg.devDependencies };
    if (!deps['@solid-mvc/atoll-island']) {
      warn(
        '@solid-mvc/atoll-island is not a dependency — run `smvc add islands` first.',
      );
    }
  }

  log('');
  gen(found.root, name, {
    dry: !!a['dry-run'],
    force: !!a.force,
    'skip-tests': !!a['skip-tests'],
    path: a.path,
  });
  log('');
}
