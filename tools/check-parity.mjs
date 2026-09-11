#!/usr/bin/env node
/**
 * Prove the merge is a packaging merge and nothing else.
 *
 * The claim this package makes is that the three features are the three original
 * plugins, unchanged, under one row. That claim is checkable, so it is checked
 * here rather than asserted in prose:
 *
 *   1. each `lib/parts/<pkg>/index.js` and `host-core.js` is BYTE-identical to
 *      the original plugin's file;
 *   2. each original `lib/client.js` factory BODY appears verbatim inside the
 *      built `lib/client.js`;
 *   3. the built bundle registers under this package's name, and its `inject`
 *      covers every service the three originals declared.
 *
 * Usage:
 *   node tools/check-parity.mjs [--from <dir>]
 *
 * `--from` defaults to this package's parent directory, where the three original
 * checkouts live side by side. Missing originals are reported as SKIP, not as a
 * pass: run this where the sources are, which is how the package was built.
 *
 * @module dsh-settings-extras/tools/check-parity
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const argv = process.argv.slice(2);
const at = argv.indexOf('--from');
const from = at < 0 ? resolve(root, '..') : resolve(argv[at + 1] === undefined ? '' : argv[at + 1]);

const PARTS = [
  { pkg: 'dsh-skills-panel', dir: 'skills-panel' },
  { pkg: 'dsh-token-stats', dir: 'token-stats' },
  { pkg: 'dsh-websearch-toggle', dir: 'websearch-toggle' },
];

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const clientBundle = readFileSync(join(root, 'lib', 'client.js'), 'utf8');

/** SHA-256 of a buffer, for byte comparisons in the report. */
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** The factory body of an original client bundle, without its registration. */
function bodyOf(pkg, source) {
  const registered = /__ModuleLoader__\.load\(\{\s*id:\s*'([^']+)'/u.exec(source);
  if (registered === null || registered[1] !== pkg) {
    throw new Error(`${pkg}: the source does not register itself under its own package name`);
  }
  const marker = '  factory: (require) => {\n';
  const open = source.indexOf(marker);
  const tail = '\n    return module.exports;\n  },\n});';
  const close = source.indexOf(tail, open);
  if (open < 0 || close < 0) throw new Error(`${pkg}: could not find the factory body`);
  return source.slice(open + marker.length, close);
}

/** The services an original half declares, re-derived from its own bundle. */
function injectOf(pkg, source) {
  const match = /const inject = \[([^\]]*)\];/u.exec(source);
  if (match === null) throw new Error(`${pkg}: no inject declaration`);
  return match[1].split(',').map((entry) => entry.trim().replace(/^'|'$/gu, '')).filter((entry) => entry !== '');
}

const lines = [];
let failed = 0;
let skipped = 0;

for (const part of PARTS) {
  for (const name of ['index.js', 'host-core.js']) {
    const original = join(from, part.pkg, 'lib', name);
    const copy = join(root, 'lib', 'parts', part.dir, name);
    let a;
    let b;
    try {
      a = readFileSync(original);
    } catch {
      lines.push(`SKIP  ${part.pkg}/lib/${name} — no original at ${original}`);
      skipped += 1;
      continue;
    }
    b = readFileSync(copy);
    if (digest(a) === digest(b)) {
      lines.push(`ok    ${part.pkg}/lib/${name} (${a.length} bytes, byte-identical)`);
    } else {
      lines.push(`FAIL  ${part.pkg}/lib/${name} — the copy differs from the original (${a.length} vs ${b.length} bytes)`);
      failed += 1;
    }
  }

  const originalClient = join(from, part.pkg, 'lib', 'client.js');
  let source;
  try {
    source = readFileSync(originalClient, 'utf8');
  } catch {
    lines.push(`SKIP  ${part.pkg}/lib/client.js — no original at ${originalClient}`);
    skipped += 1;
    continue;
  }
  const body = bodyOf(part.pkg, source);
  if (clientBundle.includes(body)) {
    lines.push(`ok    ${part.pkg}/lib/client.js factory body (${body.length} bytes, verbatim in lib/client.js)`);
  } else {
    lines.push(`FAIL  ${part.pkg}/lib/client.js — its factory body is not verbatim in lib/client.js`);
    failed += 1;
  }
  for (const service of injectOf(part.pkg, source)) {
    if (clientBundle.includes(`const inject = [${service}`) || new RegExp(`const inject = \\[[^\\]]*'${service}'`, 'u').test(clientBundle)) {
      lines.push(`ok    ${part.pkg} declares client service "${service}", declared by the merged bundle`);
    } else {
      lines.push(`FAIL  ${part.pkg} declares client service "${service}", which the merged bundle omits`);
      failed += 1;
    }
  }
}

const bundleId = /__ModuleLoader__\.load\(\{\s*id:\s*'([^']+)'/u.exec(clientBundle);
if (bundleId !== null && bundleId[1] === manifest.name) {
  lines.push(`ok    lib/client.js registers as "${manifest.name}"`);
} else {
  lines.push(`FAIL  lib/client.js registers as "${bundleId === null ? '(nothing)' : bundleId[1]}" instead of "${manifest.name}"`);
  failed += 1;
}

process.stdout.write(`${lines.join('\n')}\n\n`);
process.stdout.write(`sources: ${from}\n${failed === 0 ? 'parity OK' : `${failed} mismatch(es)`}${skipped > 0 ? `, ${skipped} skipped` : ''}\n`);
process.exit(failed === 0 ? 0 : 1);
