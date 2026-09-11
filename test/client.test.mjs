/**
 * Load-layer tests for the merged browser half.
 *
 * Three suites' worth of contract in one file, because the merge is one file:
 * the registration contract that decides whether DSH loads the bundle at all,
 * the fact that all three features ran against the one context they are handed,
 * and — feature by feature — the behaviour each original suite pinned with
 * counters rather than with prose.
 *
 * The failure mode this file exists for is a half that never runs (a dropped
 * `apply`, a service the merged `inject` forgot to declare) or a half that runs
 * but no longer reaches its own branch (a nav row that stays the shell's gear, a
 * card switch that never injects). Every "the code did X" assertion below is
 * paired with the counter that proves the branch was entered.
 *
 * @module dsh-settings-extras/test/client
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classCount, loadBundle, nodes, pkg, settle, source } from './support/harness.mjs';

/** Style-tag plugin ids, in the order the three halves compose. */
const PLUGIN_IDS = ['dsh-skills-panel', 'dsh-token-stats', 'dsh-websearch-toggle'];

/** Locale namespaces, one per feature. */
const NAMESPACES = ['dsh-skills-panel', 'dsh-token-stats', 'dsh-websearch-toggle'];

/** A payload the usage dashboard can actually render. */
const PAYLOAD = {
  generatedAt: 0,
  scope: { sessions: 3, failed: 0, retired: 0, seeded: 0 },
  models: [
    { key: 'p/alpha', provider: 'p', model: 'alpha', name: 'Alpha', buckets: [300, 40, 900, 0] },
    { key: 'p/beta', provider: 'p', model: 'beta', name: 'Beta', buckets: [120, 30, 400, 0] },
    { key: '__other__', provider: '', model: '', name: '', buckets: [5, 5, 5, 0] },
  ],
  days: [
    { d: '2026-09-04', b: [10, 2, 30, 0], m: [[0, 10, 2, 30, 0]] },
    { d: '2026-09-05', b: [400, 60, 1200, 0], m: [[0, 400, 30, 900, 0], [1, 0, 30, 300, 0]] },
    { d: '2026-09-06', b: [15, 13, 75, 0], m: [[1, 10, 8, 70, 0], [2, 5, 5, 5, 0]] },
  ],
  range: { first: '2026-09-04', last: '2026-09-06' },
};

/** The row's parts, read out of the DOM the bundle built. */
function rowParts(row) {
  const line = row.children[0];
  return { line, label: line.children[0], toggle: line.children[1], hint: row.children[1], error: row.children[2] };
}

/**
 * Mark both settings-nav rows and patch the Web search card, so every feature is
 * settled and the steady-state assertions below mean what they say.
 *
 * @param loaded - a loaded bundle.
 * @returns the two nav rows and the card.
 */
function settleEveryFeature(loaded) {
  const skillsRow = loaded.makeNavRow('技能');
  const statsRow = loaded.makeNavRow('用量统计');
  // Mounted in the settings dialog, as the shell does: a row that is not in the
  // document is not "settled", which is the whole distinction the hot path makes.
  loaded.body.appendChild(skillsRow);
  loaded.body.appendChild(statsRow);
  const card = loaded.makeCard('网页搜索', true);
  loaded.fire([skillsRow]);
  loaded.fire([statsRow]);
  loaded.fire([card.body]);
  return { skillsRow, statsRow, card };
}

// ── the registration contract ────────────────────────────────────────────────

test('the bundle registers exactly once, under the package name', () => {
  const registered = [...source.matchAll(/^window\.__ModuleLoader__\.load\(/gmu)];
  assert.equal(registered.length, 1, 'one package is one registered bundle; a second load() call is a second package');
  const id = /__ModuleLoader__\.load\(\{\s*id:\s*'([^']+)'/u.exec(source);
  assert.equal(id[1], pkg.name, 'a mismatched id is a silently unloaded bundle');
  const loaded = loadBundle();
  assert.equal(typeof loaded.mod.apply, 'function');
  assert.equal(typeof loaded.mod.inject, 'object');
});

test('the merged inject is the union of the three halves and drops none', () => {
  const loaded = loadBundle();
  assert.deepEqual(loaded.mod.inject, ['slots', 'locale', 'uiWorkspace']);
  const parts = loaded.mod.__test.parts;
  assert.deepEqual(Object.keys(parts), ['SKILLS_PANEL', 'TOKEN_STATS', 'WEBSEARCH_TOGGLE']);
  for (const [key, part] of Object.entries(parts)) {
    assert.equal(typeof part.apply, 'function', `${key} must expose its own apply`);
    for (const service of part.inject) {
      assert.ok(loaded.mod.inject.includes(service), `${key} asks for "${service}", which the merged inject omits — its feature would park`);
    }
  }
  // The union documented in package.json's row metadata must match the bundle.
  assert.deepEqual(pkg.dsh.client.inject.slice().sort(), loaded.mod.inject.slice().sort());
});

test('all three halves ran, each with its own stylesheet on the fiber', () => {
  const loaded = loadBundle();
  assert.deepEqual(loaded.styleTags.map((tag) => tag.dataset.plugin), PLUGIN_IDS);
  const stylesheets = loaded.effectsLike('stylesheet');
  assert.equal(stylesheets.length, 3, 'one stylesheet effect per feature');
  for (const tag of loaded.styleTags) {
    assert.ok(tag.textContent.length > 100, `${tag.dataset.plugin} injected no stylesheet`);
    assert.ok(tag.isConnected, 'a stylesheet must be attached while the row is live');
  }
  // Class prefixes stay per-feature, so three stylesheets cannot collide.
  const css = (plugin) => loaded.styleTags.find((tag) => tag.dataset.plugin === plugin).textContent;
  assert.ok(css('dsh-skills-panel').includes('.dshsk-wrap{'));
  assert.ok(css('dsh-token-stats').includes('.dts-root{'));
  assert.ok(css('dsh-websearch-toggle').includes('.dshwst-switch{'));
  for (const [plugin, prefix] of [['dsh-skills-panel', 'dshsk-'], ['dsh-token-stats', 'dts-'], ['dsh-websearch-toggle', 'dshwst-']]) {
    const withoutDataUris = css(plugin).replace(/url\("data:[^"]*"\)/gu, 'url(data-uri)');
    for (const name of [...withoutDataUris.matchAll(/\.([a-zA-Z][\w-]*)/gu)].map((entry) => entry[1])) {
      // The settings-section rules of .dts- and the shell's own class names never
      // appear here; every class this bundle declares carries its own prefix.
      assert.ok(name.startsWith(prefix), `unprefixed class in ${plugin}'s stylesheet: ${name}`);
    }
  }
});

test('the stylesheets stay token-only, as the three originals were', () => {
  const loaded = loadBundle();
  for (const tag of loaded.styleTags) {
    // Two things are not a literal colour and must not be read as one: the
    // percent-encoded SVG inside a mask data URI, and the fallback of a
    // `var(--token, fallback)`, which the skills panel uses where a shipped
    // token is optional (`#fff` on the switch knob, a shadow). Everything else
    // paints from a token.
    const css = tag.textContent
      .replace(/url\("data:[^"]*"\)/gu, 'url(data-uri)')
      .replace(/var\((--[a-z0-9-]+)\s*,[^()]*(?:\([^()]*\))?[^()]*\)/gu, 'var($1)');
    assert.ok(css.includes('var(--dsw-'), `${tag.dataset.plugin}: the stylesheet must paint from theme tokens`);
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/u.test(css), `${tag.dataset.plugin}: hex colour outside a var() fallback`);
    assert.ok(!/\brgba?\(/u.test(css), `${tag.dataset.plugin}: rgb()/rgba() colour outside a var() fallback`);
    assert.ok(!/[:,]\s*(white|black)\b/iu.test(css), `${tag.dataset.plugin}: named colour outside a var() fallback`);
  }
});

test('every feature registered its own locale dictionaries, and both locales agree', () => {
  const loaded = loadBundle();
  for (const ns of NAMESPACES) {
    const dicts = loaded.dictsOf(ns);
    assert.deepEqual(Object.keys(dicts).sort(), ['en', 'zh'], `${ns} must register both dictionaries`);
    assert.deepEqual(Object.keys(dicts.en).sort(), Object.keys(dicts.zh).sort(), `${ns}: en and zh must cover the same keys`);
  }
  assert.equal(loaded.dictsOf('dsh-skills-panel').zh.title, '技能');
  assert.equal(loaded.dictsOf('dsh-skills-panel').en.title, 'Skills');
  assert.equal(loaded.dictsOf('dsh-token-stats').zh.title, '用量统计');
  assert.equal(loaded.dictsOf('dsh-token-stats').en.title, 'Usage');
  assert.equal(loaded.dictsOf('dsh-websearch-toggle').zh.toggle, '启用网页搜索');
  assert.equal(loaded.dictsOf('dsh-websearch-toggle').en.toggle, 'Enable web search');
  assert.equal(loaded.localeRegisters.length, 6, 'three namespaces × two locales');
});

test('the settings dialog gains both sections, with the ids they always had', () => {
  const loaded = loadBundle();
  assert.deepEqual(loaded.injected, ['settings.section', 'settings.section']);
  assert.equal(loaded.registrations.length, 2);
  const skills = loaded.registrationOf('skills');
  const stats = loaded.registrationOf('token-stats');
  assert.equal(skills.name, 'settings.section');
  assert.equal(skills.order, 25);
  assert.equal(stats.name, 'settings.section');
  assert.equal(stats.order, 40);
  for (const registration of [skills, stats]) {
    assert.equal(typeof registration.label, 'function', 'the label must be a thunk so a locale switch recomputes it');
    assert.equal(typeof registration.component, 'function', 'the panel component must be a function');
  }
  assert.equal(skills.label(), '技能');
  assert.equal(stats.label(), '用量统计');
  assert.equal(loadBundle({ locale: 'en' }).registrationOf('skills').label(), 'Skills');
  assert.equal(loadBundle({ locale: 'en-US' }).registrationOf('token-stats').label(), 'Usage');
});

// ── lifecycle: nothing may outlive the row ───────────────────────────────────

test('every side effect hangs on the fiber, and disposing the row removes all three', () => {
  const loaded = loadBundle();
  assert.equal(loaded.effectsLike('settings nav glyph').length, 2, 'both settings sections need their nav glyph marked');
  assert.equal(loaded.effectsLike('web search card').length, 1);
  assert.equal(loaded.effectsLike('idle update check').length, 1);
  assert.equal(loaded.observers.length, 3, 'each feature that watches the document must have created its own observer');
  assert.equal(loaded.observers.filter((observer) => observer.disconnected).length, 0);

  for (const effect of loaded.effects) effect.dispose();

  for (const tag of loaded.styleTags) assert.equal(tag.isConnected, false, `${tag.dataset.plugin}'s stylesheet survived disposal`);
  for (const observer of loaded.observers) assert.equal(observer.disconnected, true, 'an observer survived disposal');
  // 2 dictionaries per feature, plus the Web search toggle's locale subscription.
  assert.equal(loaded.localeDisposals.length, 6 + 1, 'every locale registration must be released with the fiber');
});

test('load does not poll: one host read, and the two delays are timers, not traffic', async () => {
  const loaded = loadBundle();
  await settle();
  assert.deepEqual(
    loaded.fetchCalls.map((call) => call.url),
    ['/websearch-toggle/state'],
    'only the Web search switch reads at load, and it reads exactly once',
  );
  assert.deepEqual(
    loaded.timers.filter((timer) => timer.delay !== undefined).map((timer) => timer.delay),
    [10000],
    'the only load-time timer is the skills panel\'s once-per-page idle update check',
  );
  assert.equal(loaded.intervals.length, 0, 'a feature that polls would show up here');
});

// ── feature: skills panel ────────────────────────────────────────────────────

test('the skills nav row is marked from the mutation that inserted it', () => {
  const loaded = loadBundle();
  const row = loaded.makeNavRow('技能');
  const container = loaded.page.createElement('div');
  const scansBefore = loaded.page.scans.subtree;

  loaded.fire([row]);

  assert.ok(row.hasAttribute('data-dsh-skills-nav'), 'the graduation cap hangs off this attribute');
  assert.ok(loaded.page.scans.subtree > scansBefore, 'the callback must actually scan what was added');
});

test('a label written as a text node still finds the skills row', () => {
  const loaded = loadBundle();
  const row = loaded.page.createElement('button');
  row.firstElementChild = loaded.page.createElement('svg');
  row.textContent = '技能';
  loaded.fire([{ nodeType: 3, textContent: '技能', parentNode: row }]);
  assert.ok(row.hasAttribute('data-dsh-skills-nav'), 'a text-node label must resolve to its enclosing button');
});

test('a settled document costs no scans at all', () => {
  const loaded = loadBundle();
  const { skillsRow, statsRow } = settleEveryFeature(loaded);
  assert.ok(skillsRow.hasAttribute('data-dsh-skills-nav'));
  assert.ok(statsRow.hasAttribute('data-dsh-token-stats-nav'));

  const subtree = loaded.page.scans.subtree;
  const doc = loaded.page.scans.doc;
  for (let i = 0; i < 200; i += 1) loaded.fire([loaded.page.createElement('div')]);
  assert.equal(loaded.page.scans.subtree, subtree, 'the hot path must exit before scanning anything');
  assert.equal(loaded.page.scans.doc, doc, 'steady state must never fall back to a document-wide scan');
});

// ── feature: token stats ─────────────────────────────────────────────────────

test('the usage nav row is marked too, with its own attribute', () => {
  const loaded = loadBundle();
  const row = loaded.makeNavRow('用量统计');
  loaded.fire([row]);
  assert.ok(row.hasAttribute('data-dsh-token-stats-nav'));
  assert.ok(!row.hasAttribute('data-dsh-skills-nav'), 'the two rows must not claim each other');
});

test('the registered usage panel really renders a dashboard', () => {
  const loaded = loadBundle();
  loaded.mod.__test.tokenStatsHooks.seedPayload(PAYLOAD);
  const tree = loaded.registrationOf('token-stats').component();

  assert.equal(classCount(tree, 'dts-root'), 1, 'the panel must render its own root');
  assert.equal(classCount(tree, 'dts-section'), 2, 'expected the scale card and the model card');
  assert.equal(classCount(tree, 'dts-viewslot'), 1, 'both day-scale views share exactly one slot');
  const cards = nodes(tree).filter((node) => node.type === loaded.mod.__test.tokenStatsHooks.components.Card);
  assert.equal(cards.length, 6, 'the dashboard carries six headline figures');
});

test('the copied usage half still exposes the helpers its charts rely on', () => {
  const hooks = loadBundle().mod.__test.tokenStatsHooks;
  assert.equal(hooks.NS, 'dsh-token-stats');
  assert.equal(hooks.CHANNEL, '/token-stats');
  assert.equal(hooks.heatmapWeeks(), 18, 'the day-scale window is fixed');
  assert.equal(hooks.gridGeometry(560).weeks, 18);
  assert.ok(hooks.gridGeometry(300).gridWidth <= 300.5, 'the block never overflows its slot');
  assert.equal(hooks.metricOf([10, 2, 5, 1], 'all'), 18);
  assert.equal(hooks.formatUnits(45670, (key) => ({ units: [[1e4, '万']] })[key]), '4.57万');
  assert.equal(hooks.granularityFor(32), 'week');
  assert.equal(hooks.smoothPath([[0, 10], [10, 20]]), 'M 0.00 10.00 L 10.00 20.00');
  assert.equal(hooks.staleFollowUp({ stale: true, days: [] }, hooks.STALE_MAX_TRIES - 1), true);
  assert.equal(hooks.staleFollowUp({ stale: true, days: [] }, hooks.STALE_MAX_TRIES), false);
});

// ── feature: Web search switch ───────────────────────────────────────────────

test('a collapsed Web search card is claimed but gets no switch', async () => {
  const loaded = loadBundle();
  await settle();
  const card = loaded.makeCard('网页搜索', false);
  loaded.fire([card.li]);
  assert.equal(card.li.hasAttribute('data-dshwst-card'), true, 'the greyed-out rules hang off this attribute');
  assert.equal(card.li.children.length, 1, 'a collapsed card has no body to inject into');
});

test('the switch is injected as the first thing in the card body, once', async () => {
  const loaded = loadBundle();
  await settle();
  const card = loaded.makeCard('网页搜索', false);
  loaded.fire([card.li]);

  const body = loaded.page.createElement('div');
  const field = loaded.page.createElement('div');
  field.appendChild(loaded.page.createElement('input'));
  body.appendChild(field);
  card.li.appendChild(body);
  loaded.fire([body]);

  assert.equal(body.children.length, 2, 'the row was inserted without removing the card\'s own field');
  const row = body.children[0];
  assert.equal(row.hasAttribute('data-dshwst-row'), true, 'the injected row must be the body\'s first child');
  const parts = rowParts(row);
  assert.equal(parts.toggle.getAttribute('role'), 'switch');
  assert.equal(parts.toggle.getAttribute('aria-checked'), 'true');
  assert.equal(parts.toggle.disabled, false);
  assert.equal(parts.label.textContent, '启用网页搜索');
  assert.equal(parts.hint.textContent, loaded.dictsOf('dsh-websearch-toggle').zh.on);
  assert.equal(parts.error.hidden, true);

  loaded.fire([card.li]);
  loaded.fire([body]);
  const rows = body.children.filter((node) => node.hasAttribute('data-dshwst-row'));
  assert.equal(rows.length, 1, 're-patching must adopt the row it finds, not build a second one');
});

test('an OFF host state greys the card and paints the switch off', async () => {
  const loaded = loadBundle({ answers: { state: { ok: true, value: { enabled: false, known: true, tool: 'web_search' } } } });
  await settle();
  const card = loaded.makeCard('网页搜索', true);
  loaded.fire([card.body]);
  const parts = rowParts(card.body.children[0]);
  assert.equal(card.li.hasAttribute('data-dshwst-off'), true, 'the grey rules hang off this attribute');
  assert.equal(parts.toggle.getAttribute('aria-checked'), 'false');
  assert.equal(parts.hint.textContent, loaded.dictsOf('dsh-websearch-toggle').zh.off);
});

test('flipping the switch writes through the host and greys the card', async () => {
  const loaded = loadBundle({
    answers: {
      state: { ok: true, value: { enabled: true, known: true, tool: 'web_search' } },
      set: { ok: true, value: { enabled: false, known: true, tool: 'web_search' } },
    },
  });
  await settle();
  const card = loaded.makeCard('网页搜索', true);
  loaded.fire([card.body]);
  const parts = rowParts(card.body.children[0]);

  parts.toggle.click();
  assert.equal(parts.toggle.disabled, true, 'the control is disabled while the write is in flight');
  await settle();

  const write = loaded.fetchCalls.find((call) => call.url.endsWith('/set'));
  assert.deepEqual(write.url, '/websearch-toggle/set');
  assert.deepEqual(write.body, { enabled: false });
  assert.equal(parts.toggle.getAttribute('aria-checked'), 'false');
  assert.equal(parts.toggle.disabled, false);
  assert.equal(card.li.hasAttribute('data-dshwst-off'), true);
});

test('a refused write rolls the switch back and says why', async () => {
  const loaded = loadBundle({
    answers: {
      state: { ok: true, value: { enabled: true, known: true, tool: 'web_search' } },
      set: { ok: false, error: { code: 'websearch-toggle/persist-failed', message: 'disk on fire' } },
    },
  });
  await settle();
  const card = loaded.makeCard('网页搜索', true);
  loaded.fire([card.body]);
  const parts = rowParts(card.body.children[0]);

  parts.toggle.click();
  await settle();

  assert.equal(parts.toggle.getAttribute('aria-checked'), 'true', 'the host is the authority, so the optimistic flip reverts');
  assert.equal(card.li.hasAttribute('data-dshwst-off'), false);
  assert.equal(parts.error.hidden, false);
  assert.equal(parts.error.textContent, 'disk on fire');
});

test('an unanswered host leaves the switch disabled instead of guessing', async () => {
  const loaded = loadBundle({ answers: { state: { ok: false, error: { code: 'websearch-toggle/internal', message: 'boom' } } } });
  await settle();
  const card = loaded.makeCard('网页搜索', true);
  loaded.fire([card.body]);
  const parts = rowParts(card.body.children[0]);
  assert.equal(parts.toggle.disabled, true, 'an unconfirmed position must not be painted as a real one');
  assert.equal(parts.error.textContent, 'boom');
});

test('the English card is claimed too, so a language switch keeps the switch', async () => {
  const loaded = loadBundle({ locale: 'en' });
  await settle();
  const card = loaded.makeCard('Web search', true);
  loaded.fire([card.body]);
  const parts = rowParts(card.body.children[0]);
  assert.equal(parts.label.textContent, 'Enable web search');
  assert.equal(parts.hint.textContent, loaded.dictsOf('dsh-websearch-toggle').en.on);
});

test('a card that belongs to another plugin is left untouched', async () => {
  const loaded = loadBundle();
  await settle();
  const shell = loaded.makeCard('终端', true);
  loaded.fire([shell.body]);
  assert.equal(shell.li.hasAttribute('data-dshwst-card'), false);
  assert.equal(shell.body.children.some((node) => node.hasAttribute('data-dshwst-row')), false);
});
