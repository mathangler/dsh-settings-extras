/**
 * Route-layer tests for the merged host half.
 *
 * These mount the real `apply` of `lib/index.js` against a stub context and drive
 * the handlers the parts registered. What is asserted is the contract the browser
 * depends on, per channel: the platform's trust fence runs before any body read,
 * wire faults are 4xx, business failures are HTTP 200 with an envelope — and the
 * three channels keep the behaviour each original suite pinned, including their
 * independent body ceilings.
 *
 * The merge's own risks live here too: a route that never registers, a part that
 * mounts when its service is missing, or a part whose effects are not the row's.
 *
 * @module dsh-settings-extras/test/host
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { CHANNELS, apply, inject, name } from '../lib/index.js';
import { STATE_FILE } from '../lib/parts/websearch-toggle/index.js';
import { WEB_SEARCH_SECTION } from '../lib/parts/websearch-toggle/host-core.js';

/** Every channel the merged row must publish, in composed order. */
const ALL_CHANNELS = [CHANNELS.skillsPanel, CHANNELS.tokenStats, CHANNELS.websearchToggle];

/**
 * The services a web profile provides that the three halves read.
 *
 * `skills` is optional on purpose: the suite mounts with and without it to prove
 * the skills panel is scoped to its own dependency.
 */
function services(options) {
  const base = {
    settings: { prepareDocument: async () => join('C:', 'dsh-home', 'settings.yaml') },
    agents: { list: () => [], get: () => undefined },
    workspaceRegistry: {
      list: () => [{ id: 'w1', title: 'project', path: join('C:', 'work') }],
    },
    skills: { list: async () => [], get: async () => undefined },
  };
  if (options.withoutSkills === true) {
    delete base.skills;
    return base;
  }
  return base;
}

/**
 * Mount the merged host half against a stub context.
 *
 * @param options - `rejection` makes the fence refuse, `preload` seeds the Web
 *   search state file, `withoutSkills` omits the skill service, `extra` adds
 *   services, `config` is the row config.
 * @returns the captured registrations, the state-file path and a cleanup.
 */
function mount(options = {}) {
  const home = mkdtempSync(join(tmpdir(), 'dshse-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  if (options.preload !== undefined) {
    writeFileSync(join(home, STATE_FILE), `${JSON.stringify(options.preload)}\n`, 'utf8');
  }

  const routes = [];
  const disposers = [];
  const effectLabels = [];
  const listeners = [];
  const injected = [];
  const guards = [];
  const provided = Object.assign(services(options), options.extra, {
    // The tool registry is what the Web search switch hangs its execution-side
    // guard on; the stub records the guard exactly as the real registry would.
    tools: {
      guard(guard) {
        guards.push(guard);
        return () => {};
      },
    },
  });
  let rejection = options.rejection;

  const ctx = {
    effect(fn, label) {
      effectLabels.push(label);
      const dispose = fn();
      const wrapped = () => {
        if (typeof dispose === 'function') dispose();
      };
      disposers.push(wrapped);
      return wrapped;
    },
    on(event, listener) {
      listeners.push({ event, listener });
      return () => {};
    },
    inject(deps, callback) {
      injected.push(deps);
      // A real fiber starts the callback only once every declared service is
      // provided; the stub keeps that rule so a missing service is observable.
      if (deps.every((dep) => provided[dep] !== undefined)) callback(ctx);
      return () => {};
    },
    get(serviceName) {
      return provided[serviceName];
    },
    logger: undefined,
    webServer: {
      register(route) {
        routes.push(route);
        return () => {};
      },
    },
    connection: { requestRejection: () => rejection },
    // Service properties, as a real context resolves them after inject.
    ...provided,
  };

  apply(ctx, options.config);
  if (previous === undefined) delete process.env.DSH_HOME;
  else process.env.DSH_HOME = previous;

  return {
    home,
    routes,
    effectLabels,
    listeners,
    injected,
    guards,
    routeOf: (channel) => routes.find((route) => route.path === channel),
    listenerFor: (event) => listeners.find((entry) => entry.event === event),
    stateFile: join(home, STATE_FILE),
    setRejection: (value) => {
      rejection = value;
    },
    dispose: () => {
      for (const dispose of disposers) dispose();
    },
    cleanup: () => rmSync(home, { recursive: true, force: true }),
  };
}

/**
 * The endpoint a body-level test targets on each channel.
 *
 * Every part validates the endpoint name BEFORE it reads a body, so a request
 * aimed at an unknown endpoint answers 404 whatever its body is; the default has
 * to name a real handler for a body fault to be reachable at all.
 */
const DEFAULT_ENDPOINT = new Map([
  [CHANNELS.skillsPanel, 'bootstrap'],
  [CHANNELS.tokenStats, 'summary'],
  [CHANNELS.websearchToggle, 'state'],
]);

/** A request stream carrying a body plus the headers the handlers read. */
function fakeRequest(channel, options = {}) {
  const body = options.body === undefined ? '{}' : options.body;
  const stream = Readable.from([Buffer.from(body, 'utf8')]);
  stream.method = options.method === undefined ? 'POST' : options.method;
  stream.headers = options.contentType === null
    ? {}
    : { 'content-type': options.contentType === undefined ? 'application/json' : options.contentType };
  stream.url = options.url === undefined ? `${channel}/${DEFAULT_ENDPOINT.get(channel)}` : options.url;
  return stream;
}

/** A response double. */
function fakeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(header, value) {
      this.headers[String(header).toLowerCase()] = value;
    },
    end(chunk) {
      if (chunk !== undefined) this.body += String(chunk);
    },
  };
}

/** Drive one mounted route once and parse whatever envelope came back. */
async function call(mounted, channel, options = {}) {
  const route = mounted.routeOf(channel);
  assert.ok(route !== undefined, `no route registered for ${channel}`);
  const res = fakeResponse();
  await route.handler(fakeRequest(channel, options), res);
  let parsed = null;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    parsed = null;
  }
  return { res, parsed };
}

/** One assembled prompt shaped like the platform's `PromptAssembly`. */
const assembly = () => ({
  sections: [
    { name: 'persona', text: 'You are a coding agent.' },
    { name: WEB_SEARCH_SECTION, text: 'Use the web_search tool.' },
  ],
  contexts: [],
  tools: [{ name: 'read' }, { name: 'web_search' }, { name: 'web_fetch' }],
  variables: {},
});

/** A `sessionQuery` double answering one session with one billed message. */
const sessionQuery = {
  listSessions: async () => [{ header: { id: 's1', isSeeded: false } }],
  listEvents: async () => [{ seq: 0 }, { seq: 1 }],
  readSession: async () => ({
    session: { id: 's1' },
    inheritedEventCount: 0,
    events: [
      { type: 'turn/start', time: 1789000000000, data: { turn: 1 } },
      { type: 'step/start', time: 1789000000000, data: { step: 1 } },
      {
        type: 'assistant/message',
        time: 1789000000000,
        data: {
          turn: 1,
          step: 1,
          usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 1, cacheWriteTokens: 0 },
          message: { source: { kind: 'model', provider: 'prov', model: 'mod' } },
        },
      },
      { type: 'turn/end', time: 1789000000001, data: { turn: 1 } },
    ],
  }),
};

// ── identity and composition ─────────────────────────────────────────────────

test('the row declares one identity, two hard services and three channels', () => {
  assert.equal(name, 'settings-extras');
  assert.deepEqual(inject, ['webServer', 'connection']);
  assert.deepEqual(CHANNELS, {
    skillsPanel: '/skills-panel',
    tokenStats: '/token-stats',
    websearchToggle: '/websearch-toggle',
  });
});

test('one row publishes all three routes, each as its own prefix', () => {
  const mounted = mount();
  try {
    assert.deepEqual(mounted.routes.map((route) => route.path), ALL_CHANNELS, 'composed in the order of the three former rows');
    for (const route of mounted.routes) {
      assert.equal(route.kind, 'prefix');
      assert.equal(typeof route.handler, 'function');
    }
  } finally {
    mounted.cleanup();
  }
});

test('without a skill service the other two features still mount and answer', async () => {
  const mounted = mount({ withoutSkills: true });
  try {
    assert.deepEqual(mounted.injected, [['skills'], ['tools']], 'the skills panel asks for its service and is parked without it');
    assert.deepEqual(mounted.routes.map((route) => route.path), [CHANNELS.tokenStats, CHANNELS.websearchToggle]);
    const { res, parsed } = await call(mounted, CHANNELS.websearchToggle, { url: `${CHANNELS.websearchToggle}/state` });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(parsed, { ok: true, value: { enabled: true, known: false, tool: 'web_search' } });
  } finally {
    mounted.cleanup();
  }
});

test('the Web search switch wires the assembly waterfall and the global guard once', () => {
  const mounted = mount();
  try {
    assert.equal(mounted.listeners.filter((entry) => entry.event === 'system-prompt/assemble').length, 1);
    assert.equal(mounted.guards.length, 1, 'exactly one global tool guard');
    assert.deepEqual(mounted.injected, [['skills'], ['tools']]);
  } finally {
    mounted.cleanup();
  }
});

// ── the platform fence, on every channel ─────────────────────────────────────

test('every channel consults the fence before reading a body', async () => {
  for (const channel of ALL_CHANNELS) {
    const mounted = mount({ rejection: 401 });
    try {
      const { res } = await call(mounted, channel, { body: '{ not json' });
      assert.equal(res.statusCode, 401, `${channel}: a rejected caller must not reach a handler`);
      assert.equal(res.body, '', `${channel}: a rejected request must not receive a body`);
    } finally {
      mounted.cleanup();
    }
  }
});

test('wire faults are 4xx on every channel, and never an envelope for 405', async () => {
  for (const channel of ALL_CHANNELS) {
    const mounted = mount();
    try {
      const wrongMethod = await call(mounted, channel, { method: 'GET' });
      assert.equal(wrongMethod.res.statusCode, 405, `${channel}: a non-POST method`);
      assert.equal(wrongMethod.res.headers.allow, 'POST');

      const wrongType = await call(mounted, channel, { contentType: 'text/plain' });
      assert.equal(wrongType.res.statusCode, 415, `${channel}: a non-JSON content type`);

      const missingType = await call(mounted, channel, { contentType: null });
      assert.equal(missingType.res.statusCode, 415, `${channel}: a missing content type`);

      const notJson = await call(mounted, channel, { body: '{ not json' });
      assert.equal(notJson.res.statusCode, 400, `${channel}: a body that is not JSON`);

      const unknown = await call(mounted, channel, { url: `${channel}/nope` });
      assert.equal(unknown.res.statusCode, 404, `${channel}: an unknown endpoint`);

      const malformed = await call(mounted, channel, { url: `${channel}/../escape` });
      assert.equal(malformed.res.statusCode, 404, `${channel}: a malformed endpoint`);
    } finally {
      mounted.cleanup();
    }
  }
});

test('each channel keeps its own body ceiling and its own error codes', async () => {
  // The three parts were written separately and their limits differ (8 KiB, 64 KiB,
  // 256 KiB). Keeping them per channel is the point: a merged reader would have
  // silently loosened the switch's limit to the largest one.
  const ceilings = [
    [CHANNELS.websearchToggle, 9 * 1024, 'websearch-toggle/too-large'],
    [CHANNELS.tokenStats, 70 * 1024, 'token-stats/too-large'],
    [CHANNELS.skillsPanel, 300 * 1024, 'skills-panel/too-large'],
  ];
  for (const [channel, size, code] of ceilings) {
    const mounted = mount();
    try {
      const { res, parsed } = await call(mounted, channel, { body: JSON.stringify({ pad: 'x'.repeat(size) }) });
      assert.equal(res.statusCode, 413, `${channel}: oversized body`);
      assert.equal(parsed.error.code, code, `${channel}: its own code`);
    } finally {
      mounted.cleanup();
    }
  }
  // …and the switch's ceiling really is the smallest: 9 KiB is fine on the other
  // two channels, which is what makes the test above meaningful.
  const mounted = mount();
  try {
    const stats = await call(mounted, CHANNELS.tokenStats, { body: JSON.stringify({ pad: 'x'.repeat(9 * 1024) }) });
    assert.notEqual(stats.res.statusCode, 413, 'the usage channel must accept what the switch refuses');
  } finally {
    mounted.cleanup();
  }
});

test('the unknown-endpoint code names the channel that answered', async () => {
  const expected = new Map([
    [CHANNELS.skillsPanel, 'skills-panel/bad-request'],
    [CHANNELS.tokenStats, 'token-stats/unknown-endpoint'],
    [CHANNELS.websearchToggle, 'websearch-toggle/unknown-endpoint'],
  ]);
  for (const [channel, code] of expected) {
    const mounted = mount();
    try {
      const { parsed } = await call(mounted, channel, { url: `${channel}/nope` });
      assert.equal(parsed.error.code, code);
    } finally {
      mounted.cleanup();
    }
  }
});

// ── feature: Web search switch ───────────────────────────────────────────────

test('the switch reads, writes and reads back through one state file', async () => {
  const mounted = mount();
  try {
    const written = await call(mounted, CHANNELS.websearchToggle, {
      url: `${CHANNELS.websearchToggle}/set`,
      body: JSON.stringify({ enabled: false }),
    });
    assert.deepEqual(written.parsed, { ok: true, value: { enabled: false, known: true, tool: 'web_search' } });
    assert.deepEqual(JSON.parse(readFileSync(mounted.stateFile, 'utf8')), { enabled: false });

    const read = await call(mounted, CHANNELS.websearchToggle, { url: `${CHANNELS.websearchToggle}/state` });
    assert.deepEqual(read.parsed.value, { enabled: false, known: true, tool: 'web_search' });
  } finally {
    mounted.cleanup();
  }
});

test('a bad payload is a 200 business failure, so the card can show the reason', async () => {
  const mounted = mount();
  try {
    const { res, parsed } = await call(mounted, CHANNELS.websearchToggle, {
      url: `${CHANNELS.websearchToggle}/set`,
      body: JSON.stringify({ enabled: 'off' }),
    });
    assert.equal(res.statusCode, 200);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error.code, 'websearch-toggle/bad-argument');
  } finally {
    mounted.cleanup();
  }
});

test('a persisted OFF state withholds the tool and the section, and refuses a pending call', async () => {
  const mounted = mount({ preload: { enabled: false } });
  try {
    const entry = mounted.listenerFor('system-prompt/assemble');
    const projected = await entry.listener(assembly(), {}, async () => assembly());
    assert.deepEqual(projected.tools.map((tool) => tool.name), ['read', 'web_fetch']);
    assert.deepEqual(projected.sections.map((section) => section.name), ['persona']);
    assert.equal(typeof mounted.guards[0]({ name: 'web_search' }), 'string');
    assert.equal(mounted.guards[0]({ name: 'web_fetch' }), undefined);

    // Flipping it back on restores both, which is what makes it a switch.
    await call(mounted, CHANNELS.websearchToggle, {
      url: `${CHANNELS.websearchToggle}/set`,
      body: JSON.stringify({ enabled: true }),
    });
    const back = await entry.listener(assembly(), {}, async () => assembly());
    assert.deepEqual(back.tools.map((tool) => tool.name), ['read', 'web_search', 'web_fetch']);
    assert.equal(mounted.guards[0]({ name: 'web_search' }), undefined);
  } finally {
    mounted.cleanup();
  }
});

test('an ON state leaves the assembly untouched, object identity included', async () => {
  const mounted = mount();
  try {
    const entry = mounted.listenerFor('system-prompt/assemble');
    const input = assembly();
    assert.equal(await entry.listener(input, {}, async () => input), input);
  } finally {
    mounted.cleanup();
  }
});

// ── feature: token usage ─────────────────────────────────────────────────────

test('the usage channel reports a missing session query as a business failure', async () => {
  const mounted = mount();
  try {
    const { res, parsed } = await call(mounted, CHANNELS.tokenStats, { url: `${CHANNELS.tokenStats}/summary` });
    assert.equal(res.statusCode, 200);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error.code, 'token-stats/no-session-query');
  } finally {
    mounted.cleanup();
  }
});

test('the usage channel folds a session through the injected service', async () => {
  // `cachePath: null` disables the durable rollup on purpose: its default path is
  // SHARED (`%TEMP%/dsh-token-stats/rollup-v1.json`), so without this the fold
  // would be compared against whatever aggregate another DSH instance running on
  // this machine last wrote — a test that passes or fails by who else is booted.
  const mounted = mount({ extra: { sessionQuery }, config: { cachePath: null } });
  try {
    const { res, parsed } = await call(mounted, CHANNELS.tokenStats, { url: `${CHANNELS.tokenStats}/summary` });
    assert.equal(res.statusCode, 200);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.models.length, 1);
    assert.equal(parsed.value.models[0].key, 'prov/mod');
    assert.deepEqual(parsed.value.models[0].buckets, [10, 4, 1, 0]);
    assert.deepEqual(parsed.value.days[0].b, [10, 4, 1, 0]);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['cache-control'], 'no-store');
  } finally {
    mounted.cleanup();
  }
});

test('the row config still reaches the usage dashboard', async () => {
  // `sessionQuery` and `cachePath` are the usage core's documented config surface;
  // the merged row forwards it rather than dropping it.
  const mounted = mount({ config: { sessionQuery, cachePath: null } });
  try {
    const { parsed } = await call(mounted, CHANNELS.tokenStats, { url: `${CHANNELS.tokenStats}/refresh` });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.models[0].key, 'prov/mod');
  } finally {
    mounted.cleanup();
  }
});

test('the usage channel hangs its warm-up scan, and every route, on the fiber', () => {
  const mounted = mount();
  try {
    // One warm-up per process, deliberately not an interval, and it must be the
    // fiber's to clear — otherwise unloading the row leaves a scan scheduled.
    assert.deepEqual(
      mounted.effectLabels,
      [
        'dsh-skills-panel: /skills-panel route',
        'dsh-token-stats: /token-stats route',
        'dsh-token-stats: warm-up scan',
        'dsh-websearch-toggle: /websearch-toggle route',
      ],
      'every effect the merged row creates belongs to exactly one part',
    );
    assert.doesNotThrow(() => mounted.dispose());
  } finally {
    mounted.cleanup();
  }
});

// ── feature: skills panel ────────────────────────────────────────────────────

test('the skills channel answers bootstrap from the services it was given', async () => {
  const mounted = mount();
  try {
    const { res, parsed } = await call(mounted, CHANNELS.skillsPanel, { url: `${CHANNELS.skillsPanel}/bootstrap` });
    assert.equal(res.statusCode, 200);
    assert.equal(parsed.ok, true, 'the channel answers the platform envelope');
    assert.equal(parsed.value.ok, true, 'and the panel wraps its own business envelope inside it');
    assert.equal(parsed.value.platform, process.platform);
    assert.equal(parsed.value.webAvailable, false);
    assert.equal(parsed.value.subprocessAvailable, false);
    assert.deepEqual(parsed.value.projects, [{ id: 'w1', title: 'project', path: join('C:', 'work') }]);
    assert.equal(parsed.value.globalRoot, join(dirname(join('C:', 'dsh-home', 'settings.yaml')), 'skills'));
  } finally {
    mounted.cleanup();
  }
});

test('a skills business failure stays a 200 envelope the panel can show', async () => {
  const mounted = mount();
  try {
    const { res, parsed } = await call(mounted, CHANNELS.skillsPanel, { url: `${CHANNELS.skillsPanel}/list` });
    assert.equal(res.statusCode, 200);
    assert.equal(parsed.ok, true, 'transport succeeded');
    assert.equal(parsed.value.ok, false, 'the business call did not');
    assert.match(parsed.value.error, /No live session/);
  } finally {
    mounted.cleanup();
  }
});

test('disposing the row releases every part', () => {
  const mounted = mount();
  assert.equal(mounted.routes.length, 3, 'three routes were published by one row');
  assert.equal(mounted.effectLabels.length, 4, 'three routes plus the usage warm-up');
  mounted.dispose();
  mounted.cleanup();
});
