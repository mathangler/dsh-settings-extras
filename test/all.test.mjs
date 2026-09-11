/**
 * Every suite, in one process.
 *
 * `node --test` is the usual entry point, but it runs each file in a child
 * process — which some environments deny — so this file imports the three suites
 * instead. `node test/all.test.mjs` is the whole run either way.
 *
 * @module dsh-settings-extras/test/all
 */
import './package.test.mjs';
import './host.test.mjs';
import './client.test.mjs';
