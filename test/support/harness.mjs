/**
 * Test harness for the merged browser half.
 *
 * `lib/client.js` is a classic script, so it is evaluated here with a fake
 * `window`, `document`, `MutationObserver`, `ResizeObserver` and `fetch` — one
 * page good enough for all three features at once. Everything the assertions
 * need to *prove* a branch ran is a counter on the page: the originals' suites
 * exist because a silently early-returning branch shipped a broken nav glyph
 * twice, and that risk does not disappear when three bundles become one.
 *
 * The fake page is a simplification, deliberately: no layout, no React commit.
 * React is a descriptor shim (as in the originals' suites), `ResizeObserver` is
 * captured rather than connected, and every `setTimeout` is recorded so it can
 * never fire behind an assertion. The parts guard all three of those with
 * `typeof … === 'function'` checks, which is why a fake is enough.
 *
 * @module dsh-settings-extras/test/support/harness
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** The package root (`test/support/` is two levels down). */
export const packageRoot = join(here, '..', '..');

/** The bundle under test, as text. */
export const source = readFileSync(join(packageRoot, 'lib', 'client.js'), 'utf8');

/** The package manifest, so `id` can be checked against the real name. */
export const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

/** Let every stubbed microtask settle. */
export const settle = () => new Promise((resolve) => setImmediate(resolve));

/**
 * One fake element.
 *
 * `firstElementChild` is a plain writable property that `attach()` maintains for
 * an element that gains children: the shell's nav rows are built by hand in
 * these tests (an `<svg>` then a label), so a setter is what both cases need.
 *
 * @param tag - tag name.
 * @param page - the page this element belongs to (scan counters live there).
 * @returns the element.
 */
export function makeElement(tag, page) {
  const element = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    attributes: {},
    dataset: {},
    style: {},
    children: [],
    childElementCount: 0,
    parentNode: null,
    firstElementChild: null,
    hidden: false,
    disabled: false,
    checked: false,
    textContent: '',
    className: '',
    title: '',
    listeners: {},
    get firstChild() {
      return element.children[0] === undefined ? null : element.children[0];
    },
    get isConnected() {
      let cursor = element;
      while (cursor.parentNode !== null && cursor.parentNode !== undefined) cursor = cursor.parentNode;
      return cursor === page.document;
    },
    setAttribute(name, value) {
      element.attributes[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(element.attributes, name) ? element.attributes[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(element.attributes, name);
    },
    removeAttribute(name) {
      delete element.attributes[name];
    },
    appendChild(child) {
      attach(element, child, element.children.length, page);
      return child;
    },
    insertBefore(child, before) {
      const index = before === null || before === undefined ? 0 : element.children.indexOf(before);
      attach(element, child, index < 0 ? 0 : index, page);
      return child;
    },
    remove() {
      detach(element);
    },
    contains(other) {
      let cursor = other;
      while (cursor !== null && cursor !== undefined) {
        if (cursor === element) return true;
        cursor = cursor.parentNode;
      }
      return false;
    },
    addEventListener(type, listener) {
      (element.listeners[type] = element.listeners[type] || []).push(listener);
    },
    removeEventListener(type, listener) {
      const list = element.listeners[type] || [];
      const index = list.indexOf(listener);
      if (index >= 0) list.splice(index, 1);
    },
    click() {
      for (const listener of [...(element.listeners.click || [])]) listener({ currentTarget: element });
    },
    getBoundingClientRect() {
      return { width: page.viewportWidth, height: 0, top: 0, left: 0, right: page.viewportWidth, bottom: 0 };
    },
    querySelectorAll(selector) {
      page.scans.subtree += 1;
      return collect(element, selector);
    },
  };
  return element;
}

/** Attach a child at an index, keeping the counters the parts read honest. */
function attach(parent, child, index, page) {
  if (child.parentNode !== null && child.parentNode !== undefined) detach(child);
  child.parentNode = parent;
  parent.children.splice(index, 0, child);
  parent.childElementCount = parent.children.length;
  parent.firstElementChild = parent.children[0];
  if (child.nodeType === 3) page.textNodes.push(child);
}

/** Detach a node from its parent. */
function detach(child) {
  const parent = child.parentNode;
  if (parent !== null && parent !== undefined) {
    const index = parent.children.indexOf(child);
    if (index >= 0) parent.children.splice(index, 1);
    parent.childElementCount = parent.children.length;
    parent.firstElementChild = parent.children[0] === undefined ? null : parent.children[0];
  }
  child.parentNode = null;
}

/** Depth-first descendants whose tag name matches one simple selector. */
function collect(node, selector) {
  const wanted = String(selector).trim().toUpperCase();
  const found = [];
  const visit = (current) => {
    for (const child of current.children) {
      if (child.tagName === wanted) found.push(child);
      visit(child);
    }
  };
  visit(node);
  return found;
}

/** Count every descendant whose `className` contains one class name. */
export function classCount(node, name) {
  let total = 0;
  const visit = (current) => {
    if (current === null || current === undefined || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      for (const child of current) visit(child);
      return;
    }
    const cls = current.props === undefined ? undefined : current.props.className;
    if (typeof cls === 'string' && cls.split(' ').includes(name)) total += 1;
    visit(current.children);
  };
  visit(node);
  return total;
}

/** Every node of a rendered React descriptor tree, depth first. */
export function nodes(node, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) nodes(child, out);
    return out;
  }
  out.push(node);
  nodes(node.children, out);
  return out;
}

/** The shipped settings-nav row: an icon followed by the label text. */
export function makeNavRow(page, label) {
  const button = makeElement('button', page);
  button.firstElementChild = makeElement('svg', page);
  button.textContent = label;
  return button;
}

/**
 * The shipped Web search plugin card.
 *
 * `PluginCard` renders `<li>` → `<button aria-expanded>` (header with a title and
 * a description span) → `<div>` (the body, present only while expanded). The
 * classes are content-hashed and change between releases, which is why the toggle
 * finds the card structurally — so that is how this builds it too.
 *
 * @param page - the page.
 * @param title - the card title in the active locale.
 * @param open - whether to render the body.
 * @returns `{ li, button, body, name }`.
 */
export function makeCard(page, title, open) {
  const li = makeElement('li', page);
  const button = makeElement('button', page);
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  const head = makeElement('span', page);
  const name = makeElement('span', page);
  name.textContent = title;
  const description = makeElement('span', page);
  description.textContent = 'The DeepSeek search provider.';
  head.appendChild(name);
  head.appendChild(description);
  button.appendChild(head);
  li.appendChild(button);

  const body = makeElement('div', page);
  if (open) {
    const field = makeElement('div', page);
    field.appendChild(makeElement('input', page));
    body.appendChild(field);
    const footer = makeElement('div', page);
    footer.appendChild(makeElement('button', page));
    body.appendChild(footer);
    li.appendChild(body);
  }
  page.body.appendChild(li);
  return { li, button, body, name };
}

/**
 * Evaluate `lib/client.js` against a fake page, then run its `apply` once.
 *
 * @param options - `locale` (active id), `answers` (endpoint → envelope), and
 *   `innerWidth`.
 * @returns the captured module, the page, every counter, and the stub context's
 *   registrations.
 */
export function loadBundle(options = {}) {
  const page = {
    scans: { subtree: 0, doc: 0 },
    textNodes: [],
    viewportWidth: options.innerWidth === undefined ? 1280 : options.innerWidth,
  };
  const styleTags = [];
  const observers = [];
  const resizeObservers = [];
  const timers = [];
  const intervals = [];
  const windowListeners = {};
  const fetchCalls = [];
  const openCalls = [];
  let observerCallback = null;
  let captured = null;

  const body = makeElement('body', page);
  const head = {
    nodeType: 1,
    tagName: 'HEAD',
    children: [],
    childElementCount: 0,
    parentNode: null,
    appendChild(tag) {
      attach(head, tag, head.children.length, page);
      styleTags.push(tag);
      return tag;
    },
  };
  const document = {
    nodeType: 9,
    body,
    head,
    createElement: (tag) => makeElement(tag, page),
    querySelectorAll: (selector) => {
      page.scans.doc += 1;
      return collect(body, selector);
    },
    addEventListener() {},
  };
  head.parentNode = document;
  body.parentNode = document;
  page.document = document;
  page.body = body;
  page.head = head;
  /** Build an element belonging to this page, as the document would. */
  page.createElement = (tag) => makeElement(tag, page);

  /** One captured observer; `disconnect()` is what the disposal assertions read. */
  class FakeObserver {
    constructor(listener) {
      observerCallback = listener;
      this.listener = listener;
      this.disconnected = false;
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }

  class FakeResizeObserver {
    constructor(listener) {
      this.listener = listener;
      this.disconnected = false;
      resizeObservers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }

  const answers = options.answers === undefined ? {} : options.answers;
  function fakeFetch(url, init) {
    const endpoint = String(url).split('/').pop();
    fetchCalls.push({ url, body: init === undefined ? undefined : JSON.parse(init.body) });
    const answered = answers[endpoint] === undefined
      ? { ok: true, value: { enabled: true, known: true, tool: 'web_search' } }
      : answers[endpoint];
    return Promise.resolve({ status: 200, json: () => Promise.resolve(answered) });
  }

  const win = {
    __ModuleLoader__: {
      load: (registration) => {
        captured = registration;
      },
    },
    innerWidth: page.viewportWidth,
    addEventListener(type, listener) {
      (windowListeners[type] = windowListeners[type] || []).push(listener);
    },
    removeEventListener(type, listener) {
      const list = windowListeners[type] || [];
      const index = list.indexOf(listener);
      if (index >= 0) list.splice(index, 1);
    },
    open(url, target, features) {
      openCalls.push({ url, target, features });
      return null;
    },
  };

  new Function(
    'window',
    'document',
    'MutationObserver',
    'ResizeObserver',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'fetch',
    source,
  )(
    win,
    document,
    FakeObserver,
    FakeResizeObserver,
    // Recorded, never scheduled: a backstop timer or a stale-answer follow-up
    // must not fire behind an assertion. Every timer path is asserted through
    // these lists instead.
    (fn, delay) => {
      timers.push({ fn, delay });
      return timers.length;
    },
    (id) => {
      timers.push({ cleared: id });
    },
    (fn, delay) => {
      intervals.push({ fn, delay });
      return intervals.length;
    },
    () => {},
    fakeFetch,
  );

  if (captured === null) throw new Error('the bundle registered nothing on window.__ModuleLoader__');
  const mod = captured.factory(requireShim);

  // The stub client context. `effect` runs the factory immediately (a real
  // Cordis effect does too) and keeps the disposer, which is what makes the
  // cleanup assertions meaningful.
  const effects = [];
  const injected = [];
  const registrations = [];
  const localeRegisters = [];
  const localeDisposals = [];
  const dictionaries = {};
  const active = options.locale === undefined ? 'zh' : options.locale;
  const localeIds = options.locales === undefined ? ['en', 'zh'] : options.locales;

  const locale = {
    getSnapshot: () => ({ active, locales: localeIds.map((id) => ({ id })) }),
    register: (ns, id, dict) => {
      localeRegisters.push({ ns, id, dict });
      (dictionaries[ns] = dictionaries[ns] || {})[id] = dict;
      const dispose = () => {
        localeDisposals.push({ ns, id });
      };
      return dispose;
    },
    bind: (ns) => (key) => {
      const dict = (dictionaries[ns] || {})[active] || (dictionaries[ns] || {}).en;
      return dict === undefined ? key : dict[key];
    },
    subscribe: (fn) => {
      const dispose = () => {
        localeDisposals.push({ ns: '__subscribe__', id: 'off' });
      };
      void fn;
      return dispose;
    },
  };

  const ctx = {
    effect(fn, label) {
      const dispose = fn();
      effects.push({
        label,
        dispose: () => {
          if (typeof dispose === 'function') dispose();
        },
        raw: dispose,
      });
      return effects[effects.length - 1].dispose;
    },
    slots: {
      inject(key, thunk) {
        injected.push(key);
        const dispose = thunk();
        return typeof dispose === 'function' ? dispose : () => {};
      },
      register(registration, component) {
        registrations.push(Object.assign({}, registration, { component }));
        return () => {};
      },
    },
    locale,
    uiWorkspace: options.uiWorkspace,
    get(name) {
      return name === 'uiWorkspace' ? options.uiWorkspace : undefined;
    },
  };

  mod.apply(ctx);

  return {
    mod,
    ctx,
    page,
    document,
    body,
    head,
    styleTags,
    observers,
    resizeObservers,
    timers,
    intervals,
    windowListeners,
    fetchCalls,
    openCalls,
    effects,
    injected,
    registrations,
    localeRegisters,
    localeDisposals,
    dictionaries,
    /** Effects whose label contains one substring. */
    effectsLike: (needle) => effects.filter((entry) => typeof entry.label === 'string' && entry.label.includes(needle)),
    /** Drive every captured MutationObserver callback at once, as a real commit would. */
    fire: (addedNodes) => {
      if (observerCallback === null) throw new Error('no MutationObserver was created');
      for (const observer of observers) {
        if (observer.disconnected) continue;
        observer.listener([{ addedNodes }], observer);
      }
    },
    /** The registered slot entry with one id, or undefined. */
    registrationOf: (id) => registrations.find((entry) => entry.id === id),
    /** Every dictionary registered under one locale namespace. */
    dictsOf: (ns) => dictionaries[ns] || {},
    makeNavRow: (label) => makeNavRow(page, label),
    makeCard: (title, open) => makeCard(page, title, open),
  };
}

/**
 * The `require` a bundle sees: React, as a descriptor shim.
 *
 * A descriptor rather than an empty object, because the render smoke test walks
 * the trees and counts elements. Anything else is a hard failure — a bundle that
 * requires a third-party module is a bundle that will not load in the browser.
 */
function requireShim(name) {
  if (name !== 'react') throw new Error(`unexpected require: ${name}`);
  return {
    createElement: (type, props, ...children) => ({
      type,
      props: props === null || props === undefined ? {} : props,
      children,
    }),
    useState: (initial) => [initial, () => {}],
    useRef: (initial) => ({ current: initial === undefined ? null : initial }),
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
  };
}
