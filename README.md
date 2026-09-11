# dsh-settings-extras

English | [中文](README.zh.md)

Three additions to the DeepSeek Harness **Settings** dialog:

| Feature | Where it appears |
|---|---|
| **Skills** | Settings → Skills |
| **Usage** | Settings → Usage |
| **Web search switch** | Settings → Plugins → inside the "Web search" card |

> **Unofficial.** A third-party plugin: not affiliated with or endorsed by DeepSeek, using only DSH's published plugin interfaces.

---

## Features

### Skills

- Lists every skill DSH can actually load (global and per project), labelled by origin, and warns when a
  project skill shadows a global one of the same name.
- One switch per skill. **Off** writes `disable-model-invocation: true` into that skill's frontmatter:
  the skill leaves the model-visible catalog but stays callable as `/name` — DSH's own mechanism.
- Skills that are junctions owned by another tool, or are not owned by DSH, are read-only here; the
  panel never rewrites a file shared with something else.
- **View** expands the skill's SKILL.md in place; **Remove** deletes the skill directory (a junction is
  only unlinked).
- **Search & install**: searches skills.sh and gives each result a **GitHub** and a **skills.sh** link so
  you can look before installing. The panel downloads nothing until you confirm an install. Install to
  the global skills root, or to the current project's `.dsh/skills`.
- **Import**: brings in a skill folder from disk by **link** (a junction — the original folder stays the
  source of truth) or by **copy**; imported skills are not checked for updates.
- **Updates**: one background check of every installed skill after each page load, with a marker on the
  ones that changed. Update compares first and changes nothing when there is nothing to change.

### Usage

- Six headline figures: lifetime tokens, peak day, today, last 7 days, daily average, cache-read share.
- A GitHub-style daily heatmap (a fixed 18-week window) and a weekly bar chart sharing one geometry, so
  their columns line up.
- Per-model trend lines (day / week / month / year granularity, chosen from the selected range) and a
  share ring.
- Metric selector (total / input+output / input / output / cache read / cache write) and range presets.
- The numbers come from the `assistant/message` usage records in the session logs; a forked (seeded)
  session's inherited prefix is skipped, so nothing is counted twice.

### Web search switch

- Adds a switch inside the "Web search" card under Settings → Plugins that controls `web_search` live.
- **On**: unchanged behaviour — the official DeepSeek search provider, billed per search.
- **Off**: `web_search` and the `tool:web_search` prompt section are withheld from every step's prompt
  assembly, and a call that was already dispatched is refused — nothing reaches the search provider.
  `web_fetch` (local fetching) keeps working.
- The card greys out while the switch stays operable; a refused write rolls back and shows the reason.
- State lives in `$DSH_HOME/websearch-toggle.json`, written atomically.

---

## Install

Requires DSH with a `web` profile.

**Option 1 — `dsh plugin` (one command)**

```sh
dsh plugin --profile web add github:mathangler/dsh-settings-extras
```

`dsh plugin` forwards to pnpm and appends this package to `dsh.profile.bundles` afterwards, so
**no YAML needs editing**. (This command requires `pnpm` on `PATH`.)

**Option 2 — npm (no pnpm required)**

The package has zero dependencies and no lifecycle script, so npm can install it into a profile too;
only the automatic bundle-layer append has to be done by hand:

```sh
cd ~/.dsh/profiles/web
npm install github:mathangler/dsh-settings-extras
# then add "dsh-settings-extras" to dsh.profile.bundles in this package.json
```

Restart the web app afterwards:

```sh
dsh web
```

Then open **Settings**.

## Update

pnpm does not re-resolve a git HEAD when the spec is unchanged, so update by removing first:

```sh
dsh plugin --profile web remove dsh-settings-extras
dsh plugin --profile web add github:mathangler/dsh-settings-extras
```

With npm, name the commit instead (npm caches the resolution in `package-lock.json` too):

```sh
npm install github:mathangler/dsh-settings-extras#<new commit sha>
```

## Compatibility

- DSH `0.1.5-rc.x` (the version this was verified against).
- Requires a **web** profile: the client half injects `slots`, `locale` and `uiWorkspace`, all provided
  by the web profile.
- The host-side `skills` service is **optional**: without it only the Skills section is missing, while
  Usage and the Web search switch keep working.
- Usage reads session logs through `sessionQuery` (provided by the web profile); without it the panel
  shows the reason instead of rendering empty.

## License

MIT.
