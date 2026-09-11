#!/usr/bin/env node
/**
 * Build `lib/client.js` — the merged browser half — from the three client halves
 * this package bundles.
 *
 * A DSH client bundle is one classic script that registers ONE lazy-CJS factory
 * under the PACKAGE name: `window.__ModuleLoader__.load({ id, factory })`, where
 * a mismatched `id` is a silently unloaded bundle. Three packages therefore
 * cannot stay three packages and still be one dependency, so this tool inlines
 * all three factory BODIES, verbatim, each inside its own closure.
 *
 * Verbatim matters. The three halves each keep the contracts they were tested
 * against — `__ModuleLoader__` registration, stylesheet injection on
 * `ctx.effect`, locale dictionaries, `settings.section` entries, the mutation-
 * observer nav marking and the Web search card patch — and every one of those is
 * re-asserted against the merged bundle by `test/client.test.mjs`. Wrapping each
 * body in a closure is what makes that safe: all three declare locals with the
 * same names (`EN`, `ZH`, `CSS`, `NS`, `CHANNEL`, `inject`, `apply`, `hostCall`,
 * `markNavRowIn`, …), and the original factory scope is exactly the scope an
 * IIFE restores.
 *
 * Usage:
 *   node tools/build-client.mjs [--from <dir>] [--check]
 *
 * `--from` defaults to this package's parent directory, which is where the three
 * original checkouts (`dsh-skills-panel/`, `dsh-token-stats/`,
 * `dsh-websearch-toggle/`) live when this package was built.
 * `--check` regenerates in memory and exits non-zero if `lib/client.js` differs.
 *
 * @module dsh-settings-extras/tools/build-client
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** The package this bundle registers as; must equal `package.json`'s name. */
const PACKAGE_NAME = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name;

/**
 * The three features, in composed order.
 *
 * `key` is the closure's local name and the key it appears under in
 * `__test.parts`; `feature` is the label the emitted bundle carries;
 * `pkg` is the source package name, which must be the `id` the source bundle
 * registers under and is the directory `--from` is searched for.
 */
const PARTS = [
  { key: 'SKILLS_PANEL', feature: 'skills panel', pkg: 'dsh-skills-panel' },
  { key: 'TOKEN_STATS', feature: 'usage dashboard', pkg: 'dsh-token-stats' },
  { key: 'WEBSEARCH_TOGGLE', feature: 'web search switch', pkg: 'dsh-websearch-toggle' },
];

/** The exact tail of a client bundle: the body ends at its `return`. */
const TAIL = '\n    return module.exports;\n  },\n});';

/** Read `--from <dir>`, defaulting to the parent of this package. */
function originalsRoot(argv) {
  const at = argv.indexOf('--from');
  if (at < 0) return resolve(root, '..');
  const value = argv[at + 1];
  if (value === undefined || value.startsWith('--')) throw new Error('--from needs a directory');
  return resolve(value);
}

/**
 * Extract one source bundle's factory body and the two facts the merge depends on.
 *
 * @param pkg - the original package name.
 * @param source - the source file's text.
 * @returns the body (verbatim, including its trailing `return`), its declared
 *   client services, and whether it exposes test hooks.
 */
function extract(pkg, source) {
  const registered = /__ModuleLoader__\.load\(\{\s*id:\s*'([^']+)'/u.exec(source);
  if (registered === null) throw new Error(`${pkg}: no __ModuleLoader__.load({ id }) registration found`);
  if (registered[1] !== pkg) {
    throw new Error(`${pkg}: the bundle registers as "${registered[1]}", which is not its package name — a mismatched id is a silently unloaded bundle`);
  }

  const marker = '  factory: (require) => {\n';
  const open = source.indexOf(marker);
  if (open < 0) throw new Error(`${pkg}: no "factory: (require) => {" line found`);
  const bodyStart = open + marker.length;

  const tail = source.indexOf(TAIL, bodyStart);
  if (tail < 0) throw new Error(`${pkg}: the factory does not end with the expected "return module.exports;" tail`);
  if (source.indexOf(TAIL, tail + 1) >= 0) throw new Error(`${pkg}: the expected tail appears more than once`);
  if (source.slice(tail + TAIL.length).trim() !== '') {
    throw new Error(`${pkg}: unexpected trailing content after the registration`);
  }

  const body = source.slice(bodyStart, tail + TAIL.length - '\n  },\n});'.length);
  if (!body.trimEnd().endsWith('return module.exports;')) {
    throw new Error(`${pkg}: the extracted body does not end with "return module.exports;"`);
  }
  if (body.includes('__ModuleLoader__')) throw new Error(`${pkg}: the extracted body still carries the registration`);
  if (!body.includes('exports.apply = apply;')) throw new Error(`${pkg}: the extracted body does not export apply`);

  const declared = /const inject = \[([^\]]*)\];/u.exec(body);
  if (declared === null) throw new Error(`${pkg}: no "const inject = [...]" declaration found`);
  const inject = declared[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((entry) => {
      if (!/^'[^']+'$/u.test(entry)) throw new Error(`${pkg}: inject entry ${JSON.stringify(entry)} is not a plain string literal`);
      return entry.slice(1, -1);
    });

  return { body, inject, hasHooks: /\nexports\.__test = \{/u.test(body) };
}

/**
 * Compose the bundle's text.
 * @param parts - one entry per part, with `key`, `feature`, `pkg`, `body`, `inject` and `hasHooks`.
 * @returns the file to write.
 */
function compose(parts) {
  // Every service any feature asks for must be declared by the plugin: the row
  // gates activation on this list, so a dropped name parks a whole feature.
  const union = [];
  for (const part of parts) {
    for (const service of part.inject) {
      if (!union.includes(service)) union.push(service);
    }
  }

  const closures = parts
    .map((part) => [
      `    // ── ${part.feature} ──`,
      '    // Its own closure: the features declare locals under the same names, so',
      '    // nothing may leak between them.',
      `    var ${part.key} = (function () {`,
      part.body,
      '    })();',
    ].join('\n'))
    .join('\n\n');

  const hookLines = [];
  if (parts.find((part) => part.key === 'TOKEN_STATS') !== undefined) {
    hookLines.push('      tokenStatsHooks: TOKEN_STATS.__test,');
  }
  if (parts.find((part) => part.key === 'WEBSEARCH_TOGGLE') !== undefined) {
    hookLines.push('      websearchToggleHooks: WEBSEARCH_TOGGLE.__test,');
  }

  return `/**
 * ${PACKAGE_NAME} — browser half.
 *
 * NOT an ES module. A DSH client bundle is a classic script registering one
 * lazy-CJS factory on the page-global facade:
 *   window.__ModuleLoader__.load({ id, factory: (require) => exports })
 * \`id\` must equal the package name. \`require\` resolves only against the platform
 * module table and this package's \`dsh.client.external\` suppliers.
 *
 * One bundle, ${parts.length} features (${parts.map((part) => part.feature).join(', ')}).
 * Each feature's half lives in its own closure — they all declare locals under
 * the same names (\`EN\`, \`ZH\`, \`CSS\`, \`NS\`, \`CHANNEL\`, \`inject\`, \`apply\`, …),
 * and a closure is what keeps them from colliding. The composition at the bottom
 * runs the ${parts.length} \`apply\` functions against the one client context this
 * row receives and declares the union of the services they need.
 *
 * Regenerate with \`node tools/build-client.mjs\` (see that file for the source
 * layout and the extraction guarantees).
 *
 * @module ${PACKAGE_NAME}/client
 */
window.__ModuleLoader__.load({
  id: '${PACKAGE_NAME}',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

${closures}

    /**
     * The union of the three halves' declared client services.
     *
     * Generated, not hand-written: the build fails rather than emit a list that
     * would leave a declaration out. \`slots\` and \`locale\` ride the settings
     * sections, \`uiWorkspace\` is the skills panel's folder picker.
     */
    const inject = [${union.map((service) => `'${service}'`).join(', ')}];

    /**
     * Client plugin body: run all ${parts.length} features against the one context.
     *
     * Each feature registers its own effects (stylesheet, observer, timers, locale
     * dictionaries, slot entries) on this context, so stopping or updating this
     * row disposes all of them together.
     *
     * @param ctx - Client Cordis context.
     */
    function apply(ctx) {
${parts.map((part) => `      ${part.key}.apply(ctx);`).join('\n')}
    }

    exports.apply = apply;
    exports.inject = inject;

    /**
     * Test surface: the closures as they were extracted, so a suite can drive one
     * feature through the same entry point its own tests always used.
     */
    exports.__test = {
      parts: {
${parts.map((part) => `        ${part.key},`).join('\n')}
      },
${hookLines.join('\n')}
    };
    return module.exports;
  },
});
`;
}

// ── main ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const from = originalsRoot(argv);
const parts = PARTS.map((part) => {
  const file = join(from, part.pkg, 'lib', 'client.js');
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`could not read ${file}: ${error.message}\nPass --from <dir> pointing at the directory holding the ${PARTS.map((entry) => entry.pkg).join(', ')} checkouts.`);
  }
  return { ...part, ...extract(part.pkg, source) };
});

const output = compose(parts);
const target = join(root, 'lib', 'client.js');

if (argv.includes('--check')) {
  const current = readFileSync(target, 'utf8');
  if (current !== output) {
    process.stderr.write('lib/client.js is out of date with the sources under ' + from + '\n');
    process.exit(1);
  }
  process.stdout.write('lib/client.js is up to date; ' + [parts.map((part) => `${part.key}:${part.inject.length} services`).join(', ')] + '\n');
} else {
  writeFileSync(target, output, 'utf8');
  process.stdout.write(
    `wrote ${target} (${Buffer.byteLength(output, 'utf8')} bytes)\n`
    + parts.map((part) => `  ${part.pkg} -> inject [${part.inject.join(', ')}]${part.hasHooks ? ' (test hooks)' : ''}`).join('\n')
    + '\n',
  );
}
