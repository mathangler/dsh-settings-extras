/**
 * Packaging tests: the manifest and the patch file are the install.
 *
 * A DSH plugin is loaded from an npm package whose manifest decides three things
 * that no runtime test can catch — which files ship (`files`), which patch layer
 * joins the profile (`dsh.bundle.patch`), and which client bundle the web server
 * serves (`exports["./client"]` + `dsh.client.platform`). A mistake in any of
 * them installs cleanly and does nothing, so they are asserted here against the
 * files on disk.
 *
 * The no-`scripts` rule is deliberate and comes from the platform's own install
 * behaviour: a lifecycle script makes `dsh plugin add` stop for a build
 * approval, which is friction for every future user of this package.
 *
 * @module dsh-settings-extras/test/package
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { packageRoot } from './support/harness.mjs';
import { name as pluginName } from '../lib/index.js';

const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

/** Every file under a directory, as paths relative to the package root. */
function walk(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(join(packageRoot, dir), { withFileTypes: true })) {
    const rel = prefix === '' ? `${dir}/${entry.name}` : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(rel, rel));
    else out.push(rel);
  }
  return out;
}

test('the package declares no lifecycle script', () => {
  assert.equal(manifest.scripts, undefined, 'a lifecycle script turns every install into a build-approval prompt');
});

test('the manifest points at files that exist', () => {
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.main, 'lib/index.js');
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    assert.ok(existsSync(join(packageRoot, target)), `exports["${subpath}"] points at a missing file: ${target}`);
  }
  assert.equal(manifest.exports['./client'], './lib/client.js');
});

test('every runtime file under lib/ is shipped', () => {
  const shipped = manifest.files;
  assert.ok(Array.isArray(shipped) && shipped.length > 0);
  const shippedDirs = shipped.filter((entry) => !entry.includes('.'));
  for (const file of walk('lib')) {
    const covered = shipped.includes(file) || shippedDirs.some((dir) => file.startsWith(`${dir}/`));
    assert.ok(covered, `${file} would be missing from the published package`);
  }
  // The three halves are the package: a `files` list that dropped them would
  // install a row whose imports fail.
  assert.ok(shipped.includes('lib/parts'), 'lib/parts must ship');
  for (const part of ['skills-panel', 'token-stats', 'websearch-toggle']) {
    assert.ok(existsSync(join(packageRoot, 'lib', 'parts', part, 'index.js')));
    assert.ok(existsSync(join(packageRoot, 'lib', 'parts', part, 'host-core.js')));
  }
  for (const extra of ['cordis.patch.yml', 'README.md', 'README.zh.md', 'LICENSE']) {
    assert.ok(shipped.includes(extra), `${extra} must ship`);
    assert.ok(existsSync(join(packageRoot, extra)), `${extra} is declared but missing`);
  }
});

test('the manifest declares both halves to the loader', () => {
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.ok(Array.isArray(manifest.dsh.client.inject));
  assert.ok(manifest.dsh.client.inject.length > 0);
});

test('the patch inserts exactly one row, and it is this plugin', () => {
  const patch = readFileSync(join(packageRoot, 'cordis.patch.yml'), 'utf8');
  const inserts = [...patch.matchAll(/^\s*-\s*insert:/gmu)];
  assert.equal(inserts.length, 1, 'one package contributes one layer');
  const rows = [...patch.matchAll(/^\s+-\s*id:\s*(\S+)\s*\n\s+name:\s*(\S+)\s*$/gmu)].map((match) => ({ id: match[1], name: match[2] }));
  assert.deepEqual(rows, [{ id: 'settings-extras', name: manifest.name }]);
  assert.equal(rows[0].id, pluginName, 'the row id and the plugin name the loader reports must agree');
});
