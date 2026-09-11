# dsh-settings-extras

English | [中文](README.zh.md)

Three additions to the DeepSeek Harness **Settings** dialog:

| Feature | Where it appears |
|---|---|
| **Skills** | Settings → Skills |
| **Usage** | Settings → Usage |
| **Web search switch** | Settings → Plugins → inside the "Web search" card |

> **Unofficial.** A third-party plugin: not affiliated with or endorsed by DeepSeek.

---

## Features

### Skills

- Lists every skill DSH can load (global and per project), labelled by origin, and warns when a project
  skill shadows a global one of the same name.
- One switch per skill. **Off** writes `disable-model-invocation: true` into that skill's file: the skill
  leaves the model-visible catalog but stays callable as `/name`.
- Skills that are links owned by another tool, or are not owned by DSH, are read-only.
- **View** expands the skill's SKILL.md in place; **Remove** deletes the skill directory (a link is only
  unlinked).
- **Search & install**: searches skills.sh and gives each result a **GitHub** and a **skills.sh** link so
  you can look before installing. The panel downloads nothing until you confirm an install. Install to
  the global skills root, or to the current project's `.dsh/skills`.
- **Import**: brings in a skill folder from disk by **link** (the original folder stays the source of
  truth) or by **copy**; imported skills are not checked for updates.
- **Updates**: one background check of every installed skill after each page load, with a marker on the
  ones that changed. Update compares first and changes nothing when there is nothing to change.

### Usage

- Six headline figures: lifetime tokens, peak day, today, last 7 days, daily average, cache-read share.
- A GitHub-style daily heatmap (a fixed 18-week window) and a weekly bar chart, with columns that line up.
- Per-model trend lines (day / week / month / year granularity, chosen from the selected range) and a
  share ring.
- Metric selector (total / input+output / input / output / cache read / cache write) and range presets.
- The numbers come from the session logs; a forked (seeded) session's inherited prefix is not counted
  twice.

### Web search switch

- Adds a switch inside the "Web search" card under Settings → Plugins that controls `web_search` live.
- **On**: unchanged behaviour — the official DeepSeek search provider, billed per search.
- **Off**: `web_search` is no longer offered to the model and nothing reaches the search provider (a
  call already in flight is refused too). `web_fetch` (local fetching) keeps working.
- The card greys out while the switch stays operable; a refused write rolls back and shows the reason.
- State lives in `$DSH_HOME/websearch-toggle.json`.

---

## Install

Requires DSH with a `web` profile.

```sh
dsh plugin --profile web add github:mathangler/dsh-settings-extras
```

With npm:

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

```sh
dsh plugin --profile web update dsh-settings-extras
```

With npm:

```sh
npm update dsh-settings-extras
```

If the update fails, remove and add:

```sh
dsh plugin --profile web remove dsh-settings-extras
dsh plugin --profile web add github:mathangler/dsh-settings-extras
```


## Compatibility

- DSH `0.1.5-rc.x` (the version this was verified against).
- Requires DSH with a `web` profile.
- Usage depends on session logs; when it cannot read them the panel shows the reason instead of
  rendering empty.

## License

MIT.
