/**
 * dsh-settings-extras — host half.
 *
 * A Cordis plugin row (`name: 'dsh-settings-extras'`) that publishes one JSON
 * route per feature, so a single profile dependency and a single
 * `cordis.patch.yml` row carry all of them:
 *
 *   | feature           | host half                          | route              |
 *   |-------------------|------------------------------------|--------------------|
 *   | Skills panel      | `parts/skills-panel/index.js`       | `/skills-panel`    |
 *   | Token-usage stats | `parts/token-stats/index.js`        | `/token-stats`     |
 *   | Web search switch | `parts/websearch-toggle/index.js`   | `/websearch-toggle`|
 *
 * Each feature owns its own transport contract end to end: its route prefix, the
 * `connection.requestRejection(req)` fence that runs before any body read, the
 * 4xx wire-fault statuses, the endpoint whitelist, the `{ok,value}` /
 * `{ok,error}` envelope, its bounded body reader, and its own `ctx.effect`
 * disposers. This module only composes them; the browser half states the same
 * three-way split in `lib/client.js`.
 *
 * Service requirements:
 *   - `webServer` and `connection` are hard requirements: without them there is
 *     nothing to publish and no fence to publish behind.
 *   - `skills` is scoped to the skills panel alone through `ctx.inject`, so a
 *     composition without a skill service loses the Skills panel while the usage
 *     dashboard and the Web search switch keep working.
 *
 * Every other service the features read (`subprocess`, `web`, `settings`,
 * `agents`, `workspaceRegistry`, `sessionQuery`, `llm`, `tools`) is looked up
 * optionally with `ctx.get(...)` or `ctx.inject(...)` inside the feature that
 * needs it, so this row never fails to mount for a service a feature merely
 * prefers.
 *
 * @module dsh-settings-extras
 */
import { apply as applySkillsPanel, CHANNEL as SKILLS_PANEL_CHANNEL } from './parts/skills-panel/index.js';
import { apply as applyTokenStats, CHANNEL as TOKEN_STATS_CHANNEL } from './parts/token-stats/index.js';
import { apply as applyWebsearchToggle, CHANNEL as WEBSEARCH_TOGGLE_CHANNEL } from './parts/websearch-toggle/index.js';

/** Cordis plugin name reported to the loader; matches the patch row's id. */
const name = 'settings-extras';

/**
 * Hard requirements. `skills` is deliberately absent: it is injected inside
 * {@link apply} so that a missing skill service cannot take the other two
 * features down with it.
 */
const inject = ['webServer', 'connection'];

/**
 * The three route prefixes this row publishes.
 *
 * Exported so the suite can assert the row really publishes all three without
 * reaching into each feature, and so a diagnostic can name a route it sees in
 * the composed tree.
 */
const CHANNELS = Object.freeze({
  skillsPanel: SKILLS_PANEL_CHANNEL,
  tokenStats: TOKEN_STATS_CHANNEL,
  websearchToggle: WEBSEARCH_TOGGLE_CHANNEL,
});

/**
 * Host plugin body: mount the three features.
 *
 * The order is arbitrary — each feature registers its own route and its own
 * effects, and nothing depends on another being mounted first.
 *
 * @param ctx - Host Cordis context.
 * @param config - optional row config. Forwarded to the usage dashboard, the one
 *   feature whose core documents a config surface (`sessionQuery`,
 *   `sessionPersistence`, `cachePath`, `maxModels`, `aggregateTtlMs`, `dayKey`,
 *   `retainSessions`); the other two take none. In a web profile those values
 *   come from services instead, so an unconfigured row needs no config at all.
 */
function apply(ctx, config) {
  // Soft dependency, scoped to one feature: `ctx.inject` starts the skills panel
  // once `skills` is provided and disposes its route and effects if it goes away.
  ctx.inject(['skills'], (skillsCtx) => {
    applySkillsPanel(skillsCtx);
  });

  applyTokenStats(ctx, config);
  applyWebsearchToggle(ctx);
}

export { apply, inject, name, CHANNELS };
