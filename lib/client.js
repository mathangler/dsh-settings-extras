/**
 * dsh-settings-extras — browser half.
 *
 * NOT an ES module. A DSH client bundle is a classic script registering one
 * lazy-CJS factory on the page-global facade:
 *   window.__ModuleLoader__.load({ id, factory: (require) => exports })
 * `id` must equal the package name. `require` resolves only against the platform
 * module table and this package's `dsh.client.external` suppliers.
 *
 * One bundle, 3 features (skills panel, usage dashboard, web search switch).
 * Each feature's half lives in its own closure — they all declare locals under
 * the same names (`EN`, `ZH`, `CSS`, `NS`, `CHANNEL`, `inject`, `apply`, …),
 * and a closure is what keeps them from colliding. The composition at the bottom
 * runs the 3 `apply` functions against the one client context this
 * row receives and declares the union of the services they need.
 *
 * Regenerate with `node tools/build-client.mjs` (see that file for the source
 * layout and the extraction guarantees).
 *
 * @module dsh-settings-extras/client
 */
window.__ModuleLoader__.load({
  id: 'dsh-settings-extras',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    // ── skills panel ──
    // Its own closure: the features declare locals under the same names, so
    // nothing may leak between them.
    var SKILLS_PANEL = (function () {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const h = React.createElement;

    /** RPC channel owned by the host half; must match lib/index.js. */
    const CHANNEL = '/skills-panel';

    /** Locale namespace for this panel's dictionary. */
    const NS = 'dsh-skills-panel';

    /** Delay before the once-per-page-load update check, to stay off the first paint. */
    const IDLE_MS = 10000;

    /**
     * Backstop delay for re-checking the whole document for the settings nav row.
     *
     * The row is normally marked synchronously from the very mutation that
     * inserted it (see the observer in `apply`), which is what keeps the shell's
     * gear fallback from being painted at all. This timer only covers the case
     * where the row appears outside the subtree that mutation showed us, so it
     * can afford to be slow.
     */
    const NAV_SWEEP_MS = 400;

    /**
     * Graduation cap for the settings nav row, as a percent-encoded SVG mask.
     *
     * Drawn to fill the 16x16 box to roughly the same extent as the shipped
     * outline icons, and painted with `background-color: currentColor` so it
     * follows the nav row's normal, hover and active colours for free.
     */
    const NAV_ICON_SVG =
      "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'"
      + " stroke='black' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round'%3E"
      + "%3Cpath d='M1.2 6.3 8 2.8l6.8 3.5-6.8 3.5z'/%3E"
      + "%3Cpath d='M3.9 8.15v2.85c0 1.3 1.85 2.25 4.1 2.25s4.1-.95 4.1-2.25V8.15'/%3E"
      + "%3Cpath d='M14.8 6.3v3.9'/%3E%3C/svg%3E";

    /** Marker attribute this bundle puts on its own nav row. */
    const NAV_ATTR = 'data-dsh-skills-nav';

    /**
     * Mark a settings nav row when it is this plugin's.
     *
     * The `settings.section` registration contract carries only id, order and
     * label — there is no icon field — and the shell picks the glyph from a
     * hardcoded if-chain over section ids whose fallback is the settings gear,
     * so a third-party section can never be handed its own glyph. The rendered
     * nav button does not name its section either, so the row can only be
     * recognised by its label.
     *
     * Matching is therefore a `<button>` whose first child is an icon and whose
     * text is this panel's title in either spelling. That survives the dialog
     * mounting late, sections being reordered, and a section count we do not
     * control — none of which a positional selector would.
     *
     * React owns this subtree, but only rewrites the attributes it renders, so a
     * marker we add stays put until the node is replaced.
     *
     * @param button - candidate element.
     * @returns the button when this call marked it, otherwise null.
     */
    function markNavButton(button) {
      if (button.hasAttribute(NAV_ATTR)) return null;
      const first = button.firstElementChild;
      if (first === null || first === undefined) return null;
      if (String(first.tagName).toLowerCase() !== 'svg') return null;
      // Both spellings, so the mark survives a locale change. Read here
      // rather than at module scope: the dictionaries are declared below.
      const label = String(button.textContent || '').trim();
      if (label !== EN.title && label !== ZH.title) return null;
      button.setAttribute(NAV_ATTR, '');
      return button;
    }

    /**
     * Nearest enclosing `<button>`, for a label written into a mounted row.
     * @param node - the node that was inserted.
     * @returns the owning button, or null.
     */
    function enclosingButton(node) {
      let parent = node.parentNode;
      while (parent !== null && parent !== undefined && parent.nodeType === 1) {
        if (String(parent.tagName).toLowerCase() === 'button') return parent;
        parent = parent.parentNode;
      }
      return null;
    }

    /**
     * Mark this plugin's nav row anywhere inside `root`.
     *
     * Scoped to a subtree so the mutation observer can inspect only what React
     * just inserted rather than walking the whole document — that is what keeps
     * the observer cheap enough to run synchronously, before the paint that
     * would otherwise show the shell's gear fallback.
     *
     * Every match is marked, not just the first: the shell renders one row, but
     * marking all of them costs nothing and covers a locale change that briefly
     * leaves both spellings mounted.
     *
     * @param root - a Document or Element to search.
     * @returns the first button marked by this call, otherwise null.
     */
    function markNavRowIn(root) {
      let first = null;
      if (root.nodeType === 1 && String(root.tagName).toLowerCase() === 'button') {
        first = markNavButton(root);
      }
      if (typeof root.querySelectorAll !== 'function') return first;
      for (const button of root.querySelectorAll('button')) {
        const hit = markNavButton(button);
        if (hit !== null && first === null) first = hit;
      }
      return first;
    }

    const CSS = [
      '.dshsk-wrap{display:flex;flex-direction:column;gap:0;padding:0 0 16px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.dshsk-head{position:sticky;top:0;z-index:6;display:flex;flex-direction:column;gap:12px;padding:1px 0 8px;background:var(--dsw-alias-bg-layer-2)}',
      '.dshsk-body{display:flex;flex-direction:column;min-height:0}',
      '.dshsk-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary)}',
      '.dshsk-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.dshsk-tabs{display:flex;align-items:flex-end;gap:22px;margin-top:2px;border-bottom:.5px solid var(--dsw-alias-border-l2)}',
      '.dshsk-tab{position:relative;background:0 0;border:0;padding:7px 1px 9px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.dshsk-tab:hover{color:var(--dsw-alias-label-secondary)}',
      '.dshsk-tab:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3);border-radius:6px}',
      '.dshsk-tab-on{color:var(--dsw-alias-label-primary)}',
      '.dshsk-tab-on:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:1px;background:var(--dsw-alias-label-primary)}',
      '.dshsk-in{box-sizing:border-box;flex:1 1 auto;min-width:170px;height:32px;padding:0 10px;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;transition:border-color .16s,background .16s}',
      '.dshsk-in:focus-visible{outline:none;border-color:var(--dsw-alias-border-l2);box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}',
      '.dshsk-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;padding:0 10px;font:inherit;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);background:0 0;border:.5px solid var(--dsw-alias-border-l3);border-radius:14px;cursor:pointer;transition:border-color .16s,background .16s}',
      '.dshsk-btn:hover:enabled{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshsk-btn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}',
      '.dshsk-btn:disabled{opacity:.4;cursor:default}',
      '.dshsk-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}',
      '.dshsk-danger{color:var(--dsw-alias-state-error-primary);background:0 0;border-color:transparent}',
      '.dshsk-danger:hover:enabled{background:var(--dsw-alias-interactive-bg-hover-danger)}',
      '.dshsk-seg{display:inline-flex;align-items:center;gap:2px;height:36px;padding:2px;background:var(--dsw-alias-bg-module-platform);border:none;border-radius:18px}',
      '.dshsk-segbtn{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 12px;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:16px;cursor:pointer;white-space:nowrap;transition:background .16s,color .16s}',
      '.dshsk-segbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dshsk-segbtn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}',
      '.dshsk-segon,.dshsk-segon:hover{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:600}',
      '.dshsk-segtick{font-size:10px}',
      '.dshsk-dd{position:relative;display:inline-flex;max-width:100%}',
      '.dshsk-ddtoggle{display:inline-flex;align-items:center;gap:12px;max-width:100%;height:36px;padding:0 14px;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform);border:none;border-radius:18px;cursor:pointer;white-space:nowrap;transition:background .16s}',
      '.dshsk-ddtoggle:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshsk-ddtoggle:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}',
      '.dshsk-ddlabel{overflow:hidden;text-overflow:ellipsis;max-width:240px}',
      '.dshsk-ddcaret{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary)}',
      '.dshsk-ddmenu{position:absolute;top:calc(100% + 6px);left:0;z-index:30;display:flex;flex-direction:column;gap:2px;min-width:240px;max-width:340px;max-height:280px;overflow:auto;padding:6px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2));border:.5px solid var(--dsw-alias-border-l4);border-radius:16px;box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.22))}',
      '.dshsk-dditem{display:flex;flex-direction:column;gap:2px;text-align:left;padding:6px 10px;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:10px;cursor:pointer}',
      '.dshsk-dditem:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshsk-dditem:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}',
      '.dshsk-dditem-on{background:var(--dsw-specific-sidebar-nav-item-active,var(--dsw-alias-bg-layer-3))}',
      '.dshsk-ddsub{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);word-break:break-all}',
      '.dshsk-status{min-height:18px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);word-break:break-all}',
      '.dshsk-status-err{color:var(--dsw-alias-state-error-primary)}',
      '.dshsk-row{display:flex;flex-direction:column;gap:8px;padding:14px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}',
      '.dshsk-row:last-child{border-bottom:none}',
      '.dshsk-rowmain{display:flex;align-items:flex-start;gap:12px}',
      '.dshsk-rowtext{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}',
      '.dshsk-ctl{display:flex;align-items:center;gap:8px;flex:none}',
      '.dshsk-ctllabel{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
      '.dshsk-switch{position:relative;flex:none;width:36px;height:20px;padding:0;border-radius:999px;background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l4);cursor:pointer;transition:background .16s,border-color .16s}',
      '.dshsk-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:transform .16s,background .16s}',
      '.dshsk-switch-on{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}',
      '.dshsk-switch-on .dshsk-knob{transform:translateX(16px);background:var(--dsw-alias-label-primary-foreground,#fff)}',
      '.dshsk-switch:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}',
      '.dshsk-detail{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}',
      '.dshsk-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.dshsk-name{font-size:14px;font-weight:500;line-height:22px;color:var(--dsw-alias-label-primary)}',
      '.dshsk-desc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
      '.dshsk-tag{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);border-radius:4px;padding:1px 6px;font-size:11px;line-height:16px;white-space:nowrap}',
      '.dshsk-new{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}',
      '.dshsk-warn{color:var(--dsw-alias-state-warn-label)}',
      '.dshsk-err{color:var(--dsw-alias-state-error-primary)}',
      '.dshsk-pre{background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;max-height:300px;overflow:auto;padding:10px 12px;white-space:pre-wrap;word-break:break-word;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);margin:0}',
      '.dshsk-muted{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;word-break:break-all}',
      '.dshsk-sec{font-size:14px;font-weight:500;line-height:22px;color:var(--dsw-alias-label-primary)}',
      '.dshsk-list{display:flex;flex-direction:column;max-height:max(220px, calc(100vh - 400px));overflow:auto;padding-right:2px}',
      '.dshsk-dest{display:flex;flex-direction:column;gap:2px;padding:8px 12px;background:var(--dsw-alias-bg-module-platform);border-radius:12px}',
      '.dshsk-destlabel{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
      '.dshsk-destpath{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);word-break:break-all}',
      '.dshsk-list::-webkit-scrollbar,.dshsk-pre::-webkit-scrollbar,.dshsk-ddmenu::-webkit-scrollbar{width:8px;height:8px}',
      '.dshsk-list::-webkit-scrollbar-thumb,.dshsk-pre::-webkit-scrollbar-thumb,.dshsk-ddmenu::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2);border-radius:4px}',
      '.dshsk-list::-webkit-scrollbar-thumb:hover,.dshsk-pre::-webkit-scrollbar-thumb:hover,.dshsk-ddmenu::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2)}',
      '.dshsk-list::-webkit-scrollbar-track,.dshsk-pre::-webkit-scrollbar-track,.dshsk-ddmenu::-webkit-scrollbar-track{background:transparent}',
      // Settings nav glyph, applied to the row this bundle marked above.
      'button[' + NAV_ATTR + '] > svg{display:none}',
      'button[' + NAV_ATTR + ']::before{content:"";flex:none;width:16px;height:16px;background-color:currentColor;'
        + '-webkit-mask:url("data:image/svg+xml;utf8,' + NAV_ICON_SVG + '") center/contain no-repeat;'
        + 'mask:url("data:image/svg+xml;utf8,' + NAV_ICON_SVG + '") center/contain no-repeat}',
    ].join('');

    const EN = {
      title: 'Skills', global: 'All user skills (global)', project: 'Project', refresh: 'Refresh',
      tabInstalled: 'Installed', tabFind: 'Find & install', tabImport: 'Import',
      search: 'Search skills.sh', searching: 'Searching...',
      installTo: 'Install to', toGlobal: 'Global', toProject: 'Project',
      view: 'View', hide: 'Hide', noSkills: 'No skills found in this scope.',
      loading: 'Loading...', installs: 'installs', skipped: 'skipped', confirm: 'Install',
      cancel: 'Cancel', low: 'low installs', shadows: 'overrides',
      noMatch: 'No matches.', installing: 'Installing...', installed: 'Installed skills',
      filter: 'Filter installed skills by name or description', none: 'Nothing matches the filter.',
      modeAuto: 'Auto', modeManual: 'Manual',
      ctxOn: 'Injected into the model context automatically', ctxOff: 'Not invoked automatically; use /name',
      shared: 'shared link', notOwned: 'not DSH-owned',
      shortLink: 'link', shortNotOwned: 'not owned', shortNoDir: 'no directory',
      uninstall: 'Remove', confirmDel: 'Confirm remove', delHintLink: 'Removes only the link; the source folder stays.',
      delHint: 'Deletes the skill folder from disk.',
      pickProject: 'Choose a project first', chooseProject: 'Select a project...',
      checkUpdates: 'Check all for updates', checking: 'Checking...', update: 'Update', updating: 'Updating...',
      hasUpdate: 'update available', upToDate: 'up to date', imported: 'imported', managed: 'installed here',
      noRecord: 'no source record', alreadyTag: 'already installed', reinstall: 'Reinstall',
      noChange: 'Already up to date; nothing was changed.',
      checkingRemote: 'Checking the repository first...',
      checked: 'checked', skillsWord: 'skills', withUpdates: 'with updates',
      autoHint: 'All installed skills are checked once in the background after the page loads.',
      importTitle: 'Import a local skill folder',
      srcPath: 'Skill folder or SKILL.md path', pickDir: 'Browse...',
      importMode: 'Import as', modeLink: 'Link', modeCopy: 'Copy',
      doImport: 'Import', importing: 'Importing...',
      linkHint: 'Link creates a junction: the original folder stays the source of truth.',
      copyHint: 'Copy duplicates the files into the skills root.',
      importNoUpdate: 'Imported skills are not checked for updates.',
      noPicker: 'No directory picker is available in this build.',
    };
    const ZH = {
      title: '技能', global: '全部用户技能（全局）', project: '项目', refresh: '刷新',
      tabInstalled: '已安装', tabFind: '搜索安装', tabImport: '导入',
      search: '搜索 skills.sh', searching: '搜索中…',
      installTo: '安装到', toGlobal: '全局', toProject: '项目',
      view: '查看', hide: '收起', noSkills: '该范围内没有技能。',
      loading: '加载中…', installs: '安装量', skipped: '已跳过', confirm: '安装',
      cancel: '取消', low: '安装量偏低', shadows: '覆盖',
      noMatch: '没有匹配结果。', installing: '安装中…', installed: '已安装技能',
      filter: '按名称或描述筛选已安装技能', none: '没有符合筛选的技能。',
      modeAuto: '自动', modeManual: '手动',
      ctxOn: '自动注入到模型 context', ctxOff: '不自动调用，需用 /名称',
      shared: '共享链接', notOwned: '非 DSH 所有',
      shortLink: '链接', shortNotOwned: '非自有', shortNoDir: '无目录',
      uninstall: '移除', confirmDel: '确认移除', delHintLink: '仅删除链接，源目录不会被删除。',
      delHint: '将从磁盘删除该技能目录。',
      pickProject: '请先选择项目', chooseProject: '选择项目…',
      checkUpdates: '检查全部更新', checking: '检查中…', update: '更新', updating: '更新中…',
      hasUpdate: '有可用更新', upToDate: '已是最新', imported: '已导入', managed: '本面板安装',
      noRecord: '无来源记录', alreadyTag: '已安装', reinstall: '重新安装',
      noChange: '已是最新，未做任何改动。',
      checkingRemote: '正在先行检查仓库…',
      checked: '已检查', skillsWord: '个技能', withUpdates: '个有更新',
      autoHint: '每次打开页面后会在后台检查一次全部已安装技能。',
      importTitle: '导入本地技能目录',
      srcPath: '技能目录或 SKILL.md 路径', pickDir: '浏览…',
      importMode: '导入方式', modeLink: '链接', modeCopy: '复制',
      doImport: '导入', importing: '导入中…',
      linkHint: '链接会创建 junction，原目录仍是唯一来源。',
      copyHint: '复制会把文件拷贝到技能目录。',
      importNoUpdate: '导入的技能不参与更新检查。',
      noPicker: '当前构建中没有可用的目录选择器。',
    };

    /** Last path segment, tolerating either separator. */
    const baseName = (p) => {
      const s = String(p).replace(/[\\/]+$/, '');
      const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf(String.fromCharCode(92)));
      return i >= 0 ? s.slice(i + 1) : s;
    };

    function Segmented(props) {
      return h('div', { className: 'dshsk-seg' }, props.options.map(function (o) {
        const on = o.value === props.value;
        return h('button', {
          key: o.value, type: 'button', title: o.title || o.label,
          'aria-pressed': on ? 'true' : 'false',
          className: on ? 'dshsk-segbtn dshsk-segon' : 'dshsk-segbtn',
          onClick: function () { if (!on) props.onChange(o.value); },
        }, on ? h('span', { className: 'dshsk-segtick' }, '\u2713') : null, h('span', null, o.label));
      }));
    }

    function Switch(props) {
      return h('button', {
        type: 'button', role: 'switch',
        'aria-checked': props.checked ? 'true' : 'false',
        'aria-label': props.label, title: props.label,
        className: props.checked ? 'dshsk-switch dshsk-switch-on' : 'dshsk-switch',
        onClick: function () { props.onChange(!props.checked); },
      }, h('span', { className: 'dshsk-knob' }));
    }

    function Dropdown(props) {
      const [open, setOpen] = React.useState(false);
      let current = null;
      for (const o of props.options) { if (o.value === props.value) { current = o; break; } }
      const label = current === null ? String(props.value) : current.label;
      return h('div', {
        className: 'dshsk-dd', tabIndex: -1,
        onBlur: function (e) {
          const rt = e.relatedTarget;
          if (rt === null || rt === undefined || !e.currentTarget.contains(rt)) setOpen(false);
        },
        onKeyDown: function (e) { if (e.key === 'Escape') setOpen(false); },
      },
        h('button', {
          type: 'button', className: 'dshsk-ddtoggle',
          'aria-haspopup': 'listbox', 'aria-expanded': open ? 'true' : 'false',
          title: current !== null && current.title ? current.title : label,
          onClick: function () { setOpen(!open); },
        },
          h('span', { className: 'dshsk-ddlabel' }, label),
          h('span', { className: 'dshsk-ddcaret' }, open ? '\u25B2' : '\u25BC')),
        open ? h('div', { className: 'dshsk-ddmenu', role: 'listbox' },
          props.options.map(function (o) {
            const on = o.value === props.value;
            return h('button', {
              key: o.value === '' ? '__none' : o.value,
              type: 'button', role: 'option', 'aria-selected': on ? 'true' : 'false',
              className: on ? 'dshsk-dditem dshsk-dditem-on' : 'dshsk-dditem',
              onClick: function () { setOpen(false); if (!on) props.onChange(o.value); },
            },
              h('span', null, o.label),
              (o.title && o.title !== o.label) ? h('span', { className: 'dshsk-ddsub' }, o.title) : null);
          })) : null,
      );
    }

    /**
     * Build the panel component for one owning context.
     * @param ctx - Client Cordis context.
     * @param deps.translate - `(key) => string`.
     * @param deps.store - shared update store, `{ get, subscribe, publish }`.
     * @param deps.subscribeLocale - `(fn) => unsubscribe`.
     * @returns the component registered into `settings.section`.
     */
    function createPanel(ctx, deps) {
      const store = deps.store;
      const subscribeLocale = deps.subscribeLocale;

      /** The folder picker, when this build ships one. */
      const pickDirectory = () => {
        const uw = ctx.uiWorkspace;
        if (uw === undefined || uw === null || typeof uw.pickDirectory !== 'function') {
          return Promise.reject(new Error('no picker'));
        }
        return Promise.resolve(uw.pickDirectory());
      };

      let inflightToggle = '';

      function Panel() {
        const [boot, setBoot] = React.useState(null);
        const [view, setView] = React.useState('installed');
        const [pp, setPp] = React.useState('');
        const [skills, setSkills] = React.useState(null);
        const [inst, setInst] = React.useState({});
        const [updateMap, setUpdateMap] = React.useState(store.get());
        const [err, setErr] = React.useState('');
        const [busy, setBusy] = React.useState(false);
        const [openName, setOpenName] = React.useState('');
        const [body, setBody] = React.useState(null);
        const [q, setQ] = React.useState('');
        const [res, setRes] = React.useState(null);
        const [serr, setSerr] = React.useState('');
        const [target, setTarget] = React.useState('global');
        const [note, setNote] = React.useState(null);
        const [searching, setSearching] = React.useState(false);
        const [installing, setInstalling] = React.useState(false);
        const [filter, setFilter] = React.useState('');
        const [, setTick] = React.useState(0);
        const [confirmDel, setConfirmDel] = React.useState('');
        const [deleting, setDeleting] = React.useState('');
        const [checking, setChecking] = React.useState(false);
        const [updatingName, setUpdatingName] = React.useState('');
        const [srcPath, setSrcPath] = React.useState('');
        const [impMode, setImpMode] = React.useState('link');
        const [importing, setImporting] = React.useState(false);

        React.useEffect(function () {
          setUpdateMap(store.get());
          return store.subscribe(setUpdateMap);
        }, []);
        React.useEffect(function () {
          if (typeof subscribeLocale !== 'function') return undefined;
          let off;
          try {
            off = subscribeLocale(function () { setTick(function (n) { return n + 1; }); });
          } catch (e) { return undefined; }
          return function () { try { if (typeof off === 'function') off(); } catch (e) {} };
        }, []);

        const tt = (k) => deps.translate(k);
        const updates = updateMap[pp] || {};
        const say = (text) => setNote({ v: view, text: String(text) });
        const clearNote = () => setNote(null);
        const mark = (key, value) => {
          const next = Object.assign({}, updates);
          if (value === null) delete next[key]; else next[key] = value;
          store.publish(pp, next);
        };

        const load = (projectPath) => {
          setBusy(true); setErr('');
          hostCall('list', { projectPath: projectPath || '' }).then(function (r) {
            if (r && r.ok) {
              setSkills(r.skills);
              setInst(r.installed || {});
              setBoot(function (b) { return b ? Object.assign({}, b, { globalRoot: r.globalRoot }) : b; });
            } else { setSkills([]); setErr((r && r.error) || 'Could not list skills.'); }
            setBusy(false);
          }).catch(function (e) { setErr(String(e && e.message ? e.message : e)); setBusy(false); });
        };

        React.useEffect(function () {
          let alive = true;
          hostCall('bootstrap', {}).then(function (r) {
            if (!alive) return;
            setBoot(r || {});
            setBusy(true);
            hostCall('list', { projectPath: '' }).then(function (lr) {
              if (!alive) return;
              if (lr && lr.ok) { setSkills(lr.skills); setInst(lr.installed || {}); }
              else { setSkills([]); setErr((lr && lr.error) || 'Could not list skills.'); }
              setBusy(false);
            }).catch(function (e) { if (alive) { setErr(String(e && e.message ? e.message : e)); setBusy(false); } });
          }).catch(function (e) { if (alive) { setErr(String(e && e.message ? e.message : e)); setBusy(false); } });
          return function () { alive = false; };
        }, []);

        const onProject = (v) => {
          setPp(v); setOpenName(''); setBody(null); clearNote(); setFilter('');
          setConfirmDel(''); load(v);
        };
        const onToggleBody = (name) => {
          if (openName === name) { setOpenName(''); setBody(null); return; }
          setOpenName(name); setBody(null);
          hostCall('body', { name: name, projectPath: pp }).then(function (r) {
            if (r && r.ok) setBody(r);
            else setBody({ ok: false, error: (r && r.error) || 'Could not read the skill.' });
          }).catch(function (e) { setBody({ ok: false, error: String(e && e.message ? e.message : e) }); });
        };
        const setOne = (name, value) => {
          setSkills(function (cur) {
            if (!Array.isArray(cur)) return cur;
            return cur.map(function (x) {
              return x.name === name ? Object.assign({}, x, { modelInvocable: value }) : x;
            });
          });
        };
        const onSetEnabled = (s, next) => {
          if (inflightToggle === s.name) return;
          inflightToggle = s.name;
          setOne(s.name, next);
          hostCall('set-enabled', { name: s.name, projectPath: pp, enabled: next }).then(function (r) {
            inflightToggle = '';
            if (r && r.ok) { clearNote(); return; }
            setOne(s.name, !next); say('FAILED: ' + ((r && r.error) || 'unknown error'));
          }).catch(function (e) {
            inflightToggle = ''; setOne(s.name, !next);
            say('FAILED: ' + String(e && e.message ? e.message : e));
          });
        };
        const onUninstall = (s) => {
          if (confirmDel !== s.name) { setConfirmDel(s.name); clearNote(); return; }
          setConfirmDel(''); setDeleting(s.name); clearNote();
          hostCall('uninstall', { name: s.name, projectPath: pp }).then(function (r) {
            setDeleting('');
            if (r && r.ok) {
              mark(s.name, null);
              say('REMOVED ' + r.name + (r.linked ? ' (link only)' : ''));
              setOpenName(''); setBody(null); load(pp);
            } else {
              say('FAILED: ' + ((r && r.error) || 'unknown error') + (r && r.detail ? ' | ' + r.detail : ''));
            }
          }).catch(function (e) { setDeleting(''); say('FAILED: ' + String(e && e.message ? e.message : e)); });
        };
        const onCheck = () => {
          setChecking(true); clearNote();
          hostCall('check-updates', { projectPath: pp }).then(function (r) {
            setChecking(false);
            if (r && r.ok) {
              const u = r.updates || {};
              store.publish(pp, u);
              let total = 0;
              for (const x of all) if (x.mode === 'install') total += 1;
              let n = 0;
              for (const k in u) { if (u[k] !== undefined && u[k] !== null && u[k].status === 'update') n += 1; }
              say(tt('checked') + ' ' + total + ' ' + tt('skillsWord') + '  \u00B7  ' + n + ' ' + tt('withUpdates'));
            } else { say('FAILED: ' + ((r && r.error) || 'update check failed')); }
          }).catch(function (e) { setChecking(false); say('FAILED: ' + String(e && e.message ? e.message : e)); });
        };
        const onUpdate = (s) => {
          setUpdatingName(s.name); say(tt('checkingRemote'));
          hostCall('update', { name: s.name, projectPath: pp }).then(function (r) {
            setUpdatingName('');
            if (r && r.ok) {
              if (r.upToDate) {
                mark(s.name, { status: 'current' });
                say(tt('noChange') + '  [' + s.name + ']');
                return;
              }
              mark(s.name, null);
              say('UPDATED ' + r.name + ' (' + r.written.length + ' entries, ' + String(r.via) + ')');
              load(pp);
            } else { say('FAILED: ' + ((r && r.error) || 'update failed')); }
          }).catch(function (e) { setUpdatingName(''); say('FAILED: ' + String(e && e.message ? e.message : e)); });
        };
        const onSearch = () => {
          setSearching(true); setSerr(''); setRes(null); clearNote();
          hostCall('search', { query: q }).then(function (r) {
            if (!r || !r.ok) { setSerr((r && r.error) || 'Search failed.'); setSearching(false); return; }
            setRes(r.results); setSearching(false);
          }).catch(function (e) { setSerr(String(e && e.message ? e.message : e)); setSearching(false); });
        };
        const keyOf = (r) => r.source + '/' + r.skillId;

        /**
         * Hand the skill over to whoever documents it, in a new tab.
         *
         * Deliberately the ONLY thing the panel does with a search result the
         * user has not installed. Reading a description or a SKILL.md here would
         * mean pulling a stranger's content onto this machine before any
         * decision had been made, and the archive fallback made that worse by
         * extracting a whole repository into the temp directory.
         *
         * Two destinations, because they answer different questions. GitHub is
         * the source of truth: the real SKILL.md and whatever ships beside it.
         * The directory page is the curated view, with a rendered summary and an
         * install command, but only a summary. Neither is fetched by this panel.
         */
        const openExternal = (url) => {
          const opened = window.open(url, '_blank', 'noopener,noreferrer');
          if (opened !== null && opened !== undefined) opened.opener = null;
        };

        /**
         * Whether a skills.sh `source` names a GitHub repository.
         *
         * Most entries do, but the directory also indexes skills from other
         * registries (smithery.ai, modelscope.cn) where a GitHub link would
         * 404. GitHub owners cannot contain a dot, so a dotted first segment is
         * the tell — and it costs no request to check.
         */
        const isGithubSource = (source) => /^[^/.]+\/[^/]+$/.test(String(source));

        const onInstall = (item) => {
          setInstalling(true); clearNote();
          hostCall('install', { source: item.source, skillId: item.skillId, target: target, projectPath: pp })
            .then(function (r) {
              setInstalling(false);
              if (r && r.ok) {
                mark(r.name, null);
                say('OK ' + r.name + ' -> ' + r.dir + ' (' + r.written.length + ' entries, ' + String(r.via) + ')');
                load(pp);
              } else {
                const d2 = (r && r.error) ? r.error
                  : ((r && r.failed && r.failed.length) ? r.failed.join('; ') : 'unknown error');
                say('FAILED: ' + d2);
              }
            }).catch(function (e) { setInstalling(false); say('FAILED: ' + String(e && e.message ? e.message : e)); });
        };
        const onBrowse = () => {
          pickDirectory().then(
            function (p) { if (typeof p === 'string' && p.length > 0) setSrcPath(p); },
            function () { say('FAILED: ' + tt('noPicker')); },
          );
        };
        const onImport = () => {
          setImporting(true); clearNote();
          hostCall('import-skill', { sourcePath: srcPath, mode: impMode, target: target, projectPath: pp })
            .then(function (r) {
              setImporting(false);
              if (r && r.ok) {
                say('IMPORTED ' + r.name + ' -> ' + r.dir + ' (' + String(r.mode) + ')');
                setSrcPath(''); load(pp);
              } else { say('FAILED: ' + ((r && r.error) || 'import failed')); }
            }).catch(function (e) { setImporting(false); say('FAILED: ' + String(e && e.message ? e.message : e)); });
        };

        const projects = (boot && boot.projects) ? boot.projects : [];
        const all = skills || [];
        const needle = filter.trim().toLowerCase();
        const shown = needle === '' ? all : all.filter(function (s) {
          return (s.name + ' ' + s.description + ' ' + s.source).toLowerCase().indexOf(needle) >= 0;
        });
        const updCount = Object.keys(updates).filter(function (k) {
          return updates[k] !== undefined && updates[k] !== null && updates[k].status === 'update';
        }).length;
        const shortReason = (n2) => {
          if (n2 === 'link') return tt('shortLink');
          if (n2 === 'no-directory') return tt('shortNoDir');
          return tt('shortNotOwned');
        };
        const updateTag = (name) => {
          const u = updates[name];
          if (u === undefined) return null;
          if (u.status === 'update') return h('span', { className: 'dshsk-tag dshsk-new' }, tt('hasUpdate'));
          if (u.status === 'current') return h('span', { className: 'dshsk-tag' }, tt('upToDate'));
          if (u.status === 'no-record') return h('span', { className: 'dshsk-tag' }, tt('noRecord'));
          return h('span', { className: 'dshsk-tag dshsk-warn' }, 'unreachable');
        };

        const renderSkill = (s) => {
          const hasUpd = updates[s.name] !== undefined && updates[s.name] !== null
            && updates[s.name].status === 'update';
          const tags = [h('span', { className: 'dshsk-tag', key: 'src' }, s.source)];
          if (s.userInvocable) tags.push(h('span', { className: 'dshsk-tag', key: 'ui' }, '/' + s.name));
          if (s.mode === 'install' || s.mode === 'link' || s.mode === 'copy') {
            tags.push(h('span', { className: 'dshsk-tag', key: 'mg' },
              s.mode === 'install' ? tt('managed') : tt('imported')));
          }
          if (s.shadowsGlobal) {
            tags.push(h('span', { className: 'dshsk-tag dshsk-warn', key: 'sh' },
              tt('shadows') + ' ' + s.shadowsGlobal));
          }
          const ut = updateTag(s.name);
          if (ut) tags.push(h('span', { key: 'up' }, ut));

          const control = s.togglable
            ? h('div', { className: 'dshsk-ctl', key: 'ctl' },
                h('span', { className: 'dshsk-ctllabel' }, s.modelInvocable ? tt('modeAuto') : tt('modeManual')),
                h(Switch, {
                  checked: !!s.modelInvocable,
                  label: s.modelInvocable ? tt('ctxOn') : tt('ctxOff'),
                  onChange: function (next) { onSetEnabled(s, next); },
                }))
            : h('span', { className: 'dshsk-tag', key: 'ctl',
                title: s.ownerNote === 'link' ? tt('shared') : tt('notOwned') }, shortReason(s.ownerNote));

          const actions = [
            h('button', { className: 'dshsk-btn', key: 'view',
              onClick: function () { onToggleBody(s.name); } },
              openName === s.name ? tt('hide') : tt('view')),
          ];
          if (s.mode === 'install') {
            const st = updates[s.name];
            const fresh = st !== undefined && st.status === 'update';
            const known = st !== undefined && st.status === 'current';
            actions.push(h('button', {
              className: fresh ? 'dshsk-btn dshsk-primary' : 'dshsk-btn',
              key: 'up',
              disabled: updatingName === s.name || known,
              title: known ? tt('noChange') : '',
              onClick: function () { onUpdate(s); },
            }, updatingName === s.name ? tt('updating') : tt('update')));
          }
          if (confirmDel === s.name) {
            actions.push(h('span', { className: 'dshsk-muted', key: 'hint' },
              s.ownerNote === 'link' ? tt('delHintLink') : tt('delHint')));
            actions.push(h('button', { className: 'dshsk-btn dshsk-danger', key: 'cd',
              disabled: deleting === s.name, onClick: function () { onUninstall(s); } }, tt('confirmDel')));
            actions.push(h('button', { className: 'dshsk-btn', key: 'cx',
              onClick: function () { setConfirmDel(''); } }, tt('cancel')));
          } else {
            actions.push(h('button', { className: 'dshsk-btn dshsk-danger', key: 'del',
              disabled: deleting === s.name, onClick: function () { onUninstall(s); } }, tt('uninstall')));
          }

          const kids = [
            h('div', { className: 'dshsk-rowmain', key: 'main' },
              h('div', { className: 'dshsk-rowtext', key: 'txt' },
                h('div', { className: 'dshsk-top', key: 'top' },
                  hasUpd ? h('span', { className: 'dshsk-dot', key: 'dot' }) : null,
                  h('span', { className: 'dshsk-name' }, s.name), tags),
                h('div', { className: 'dshsk-desc', key: 'd' }, s.description),
                s.dir ? h('div', { className: 'dshsk-muted', key: 'p' }, s.dir) : null),
              control),
            h('div', { className: 'dshsk-bar', key: 'b' }, actions),
          ];
          if (openName === s.name && body) {
            kids.push(body.ok
              ? h('pre', { className: 'dshsk-pre', key: 'pre' }, body.content)
              : h('div', { className: 'dshsk-err', key: 'e' }, body.error));
          }
          return h('div', { className: 'dshsk-row', key: s.name }, kids);
        };

        const renderResult = (r) => {
          const k = keyOf(r);
          const have = inst[k];
          const tags = [
            h('span', { className: 'dshsk-tag', key: 's' }, r.source),
            h('span', { className: 'dshsk-tag', key: 'i' }, tt('installs') + ' ' + r.installs),
          ];
          if (have) tags.push(h('span', { className: 'dshsk-tag dshsk-new', key: 'have' }, tt('alreadyTag')));
          else if (r.installs < 100) tags.push(h('span', { className: 'dshsk-tag dshsk-warn', key: 'l' }, tt('low')));
          // Name, source and install count only. Nothing about the skill itself
          // is fetched to render this row; the panel does not pull a stranger's
          // content down until the user asks for it, and then only by name.
          const kids = [
            h('div', { className: 'dshsk-rowtext', key: 'txt' },
              h('div', { className: 'dshsk-top', key: 't' }, h('span', { className: 'dshsk-name' }, r.name), tags)),
            h('div', { className: 'dshsk-bar', key: 'b' },
              isGithubSource(r.source) ? h('button', { className: 'dshsk-btn', key: 'gh',
                onClick: function () { openExternal('https://github.com/' + r.source); } }, 'GitHub') : null,
              h('button', { className: 'dshsk-btn', key: 'sh',
                onClick: function () { openExternal('https://www.skills.sh/' + k); } }, 'skills.sh'),
              h('button', { className: have ? 'dshsk-btn' : 'dshsk-btn dshsk-primary', key: 'in',
                disabled: installing, onClick: function () { onInstall(r); } },
                have ? tt('reinstall') : tt('confirm'))),
          ];
          return h('div', { className: 'dshsk-row', key: k }, kids);
        };

        const projectOptions = [{ value: '', label: tt('global'), title: tt('global') }].concat(
          projects.map(function (p) { return { value: p.path, label: p.title || baseName(p.path), title: p.path }; }));
        const projectPickOptions = [{ value: '', label: tt('chooseProject'), title: tt('chooseProject') }].concat(
          projects.map(function (p) { return { value: p.path, label: p.title || baseName(p.path), title: p.path }; }));
        const globalTargetPath = (boot && boot.globalRoot) ? String(boot.globalRoot) : tt('global');
        const projectTargetPath = pp ? (pp + '/.dsh/skills') : tt('pickProject');
        const targetSeg = h(Segmented, {
          options: [
            { value: 'global', label: tt('toGlobal'), title: globalTargetPath },
            { value: 'project', label: tt('toProject'), title: projectTargetPath },
          ],
          value: target,
          onChange: function (v) { setTarget(v); },
        });
        const targetBar = (key) => h('div', { className: 'dshsk-bar', key: key },
          h('span', { className: 'dshsk-ctllabel' }, tt('installTo')),
          targetSeg,
          (target === 'project') ? h(Dropdown, { options: projectPickOptions, value: pp, onChange: onProject }) : null,
          (target === 'project' && pp === '') ? h('span', { className: 'dshsk-warn' }, tt('pickProject')) : null);
        const tabs = h('div', { className: 'dshsk-tabs', key: 'tabs' },
          h('button', { type: 'button', className: view === 'installed' ? 'dshsk-tab dshsk-tab-on' : 'dshsk-tab',
            onClick: function () { setView('installed'); } },
            tt('tabInstalled') + ' (' + all.length + ')' + (updCount > 0 ? '  \u2022' + updCount : '')),
          h('button', { type: 'button', className: view === 'find' ? 'dshsk-tab dshsk-tab-on' : 'dshsk-tab',
            onClick: function () { setView('find'); } }, tt('tabFind')),
          h('button', { type: 'button', className: view === 'import' ? 'dshsk-tab dshsk-tab-on' : 'dshsk-tab',
            onClick: function () { setView('import'); } }, tt('tabImport')));

        const installedHead = [
          h('div', { className: 'dshsk-bar', key: 'bar' },
            h('span', { className: 'dshsk-sec' }, tt('installed')),
            h(Dropdown, { options: projectOptions, value: pp, onChange: onProject }),
            h('button', { className: 'dshsk-btn', key: 'rf',
              onClick: function () { clearNote(); load(pp); }, disabled: busy }, tt('refresh')),
            h('button', { className: 'dshsk-btn dshsk-primary', key: 'ck',
              onClick: onCheck, disabled: checking }, checking ? tt('checking') : tt('checkUpdates'))),
          h('div', { className: 'dshsk-bar', key: 'fltb' },
            h('input', { className: 'dshsk-in', value: filter, placeholder: tt('filter'),
              onChange: function (e) { setFilter(e.target.value); } })),
        ];
        const installedBody = [
          (busy && shown.length === 0) ? h('div', { className: 'dshsk-muted', key: 'ld' }, tt('loading')) : null,
          (!busy && shown.length === 0)
            ? h('div', { className: 'dshsk-muted', key: 'no' }, all.length === 0 ? tt('noSkills') : tt('none')) : null,
          shown.length > 0 ? h('div', { className: 'dshsk-list', key: 'list' }, shown.map(renderSkill)) : null,
          h('div', { className: 'dshsk-muted', key: 'auto' }, tt('autoHint')),
        ];
        const findHead = [
          h('div', { className: 'dshsk-bar', key: 'sb' },
            h('input', {
              className: 'dshsk-in', value: q, placeholder: tt('search'),
              onChange: function (e) { setQ(e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter') onSearch(); },
            }),
            h('button', { className: 'dshsk-btn dshsk-primary', key: 'go', onClick: onSearch,
              disabled: searching || q.trim().length < 2 }, searching ? tt('searching') : tt('search'))),
          targetBar('tt2'),
          serr ? h('div', { className: 'dshsk-status dshsk-status-err', key: 'se' }, serr) : null,
        ];
        const findBody = [
          res ? (res.length === 0
            ? h('div', { className: 'dshsk-muted', key: 'nm' }, tt('noMatch'))
            : h('div', { className: 'dshsk-list', key: 'rl' }, res.map(renderResult))) : null,
        ];
        const importHead = [
          h('div', { className: 'dshsk-sec', key: 'ti' }, tt('importTitle')),
          h('div', { className: 'dshsk-bar', key: 'src' },
            h('input', { className: 'dshsk-in', value: srcPath, placeholder: tt('srcPath'),
              onChange: function (e) { setSrcPath(e.target.value); } }),
            h('button', { className: 'dshsk-btn', key: 'br', onClick: onBrowse }, tt('pickDir'))),
          h('div', { className: 'dshsk-bar', key: 'mode' },
            h('span', { className: 'dshsk-ctllabel' }, tt('importMode')),
            h(Segmented, {
              options: [
                { value: 'link', label: tt('modeLink'), title: tt('linkHint') },
                { value: 'copy', label: tt('modeCopy'), title: tt('copyHint') },
              ],
              value: impMode, onChange: setImpMode,
            })),
          targetBar('tgt'),
          h('div', { className: 'dshsk-bar', key: 'go' },
            h('button', { className: 'dshsk-btn dshsk-primary', onClick: onImport,
              disabled: importing || srcPath.trim().length === 0 },
              importing ? tt('importing') : tt('doImport'))),
          h('div', { className: 'dshsk-muted', key: 'hint' }, impMode === 'link' ? tt('linkHint') : tt('copyHint')),
          h('div', { className: 'dshsk-muted', key: 'nu' }, tt('importNoUpdate')),
        ];

        const currentHead = view === 'installed' ? installedHead : (view === 'find' ? findHead : importHead);
        const currentBody = view === 'installed' ? installedBody : (view === 'find' ? findBody : []);
        const errForView = view === 'installed' ? err : '';
        const noteForView = (note !== null && note.v === view) ? note.text : '';
        const statusText = errForView !== '' ? errForView : noteForView;
        const statusErr = errForView !== '' || noteForView.indexOf('FAILED') === 0;

        return h('div', { className: 'dshsk-wrap' },
          h('div', { className: 'dshsk-head' }, [
            h('div', { className: 'dshsk-bar', key: 'title' }, h('span', { className: 'dshsk-sec' }, tt('title'))),
            tabs,
            h('div', {
              className: statusErr ? 'dshsk-status dshsk-status-err' : 'dshsk-status', key: 'st',
            }, statusText),
          ].concat(currentHead)),
          h('div', { className: 'dshsk-body' }, currentBody));
      }

      return Panel;
    }

    /** Required client services: the slot registry, the locale, and the folder picker. */
    const inject = ['slots', 'locale', 'uiWorkspace'];

    /**
     * Client plugin body.
     * @param ctx - Client Cordis context.
     */
    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-skills-panel';
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => { tag.remove(); };
      }, 'dsh-skills-panel: panel stylesheet');

      // The settings dialog mounts when the user opens it and unmounts on close,
      // so the nav row has to be marked whenever it appears rather than once at
      // load. The observer also re-marks if React replaces the row node.
      //
      // The mark has to land before the browser paints the freshly mounted
      // dialog, or the shell's gear fallback is on screen for a moment and then
      // swaps to the cap. A MutationObserver callback already runs as a microtask
      // at the end of React's commit — after the nodes are in the DOM, before the
      // frame is painted — so the scan happens right there, with no timer in
      // between. The cost of being that hot is bounded two ways: the callback
      // inspects only the nodes that were just added, and it returns immediately
      // while our marker is still mounted, which is the state a streaming
      // conversation mutates through. The debounced document-wide sweep is kept
      // only as a backstop, for a row that somehow arrives outside the subtree we
      // were shown.
      ctx.effect(() => {
        let row = markNavRowIn(document);
        if (typeof MutationObserver !== 'function' || !document.body) return () => {};

        const isMarked = () => row !== null && row.isConnected && row.hasAttribute(NAV_ATTR);

        let sweep = 0;
        const backstop = () => {
          if (sweep !== 0) return;
          sweep = setTimeout(() => {
            sweep = 0;
            if (isMarked()) return;
            row = markNavRowIn(document) || row;
          }, NAV_SWEEP_MS);
        };

        const observer = new MutationObserver((records) => {
          if (isMarked()) return;
          for (const record of records) {
            for (const node of record.addedNodes) {
              // A label written into an already-mounted row arrives as a text
              // node, so resolve the enclosing button before giving up on it.
              if (node.nodeType === 3) {
                const owner = enclosingButton(node);
                if (owner !== null && markNavButton(owner) !== null) { row = owner; return; }
                continue;
              }
              if (node.nodeType !== 1) continue;
              const hit = markNavRowIn(node);
              if (hit !== null) { row = hit; return; }
            }
          }
          // Nothing in what was just added: re-check the document once the burst
          // settles, rather than walking it on every mutation batch.
          backstop();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => {
          observer.disconnect();
          if (sweep !== 0) clearTimeout(sweep);
        };
      }, 'dsh-skills-panel: settings nav glyph');

      const locale = ctx.locale;
      const pickDict = (id) => (/^zh/i.test(String(id || '')) ? ZH : EN);
      const activeId = () => {
        try {
          const s = locale.getSnapshot();
          return String((s && s.active) || '');
        } catch (e) { return ''; }
      };

      let bound = null;
      try {
        let ids = [];
        try {
          const snap = locale.getSnapshot();
          ids = Array.isArray(snap && snap.locales) ? snap.locales.map((d) => String(d.id)) : [];
        } catch (e) { /* fall back to the known pair */ }
        if (ids.length === 0) ids = ['en', 'zh'];
        for (const id of ids) {
          const off = locale.register(NS, id, pickDict(id));
          // The dictionary registration outlives the row, so tie it to the fiber.
          if (typeof off === 'function') ctx.effect(() => off);
        }
        bound = typeof locale.bind === 'function' ? locale.bind(NS) : null;
      } catch (e) { bound = null; }

      const translate = (key) => {
        if (bound !== null) {
          try {
            const v = bound(key);
            if (typeof v === 'string' && v !== key && v.length > 0) return v;
          } catch (e) { /* fall through to the literal dictionary */ }
        }
        const d = pickDict(activeId());
        return d[key] || EN[key] || key;
      };

      // One shared update store per mounted plugin: the idle check publishes
      // into it and the panel subscribes, so opening settings never re-checks.
      let store = {};
      const subs = [];
      const api = {
        get: () => store,
        publish: (scopeKey, updates) => {
          const next = Object.assign({}, store);
          next[scopeKey] = updates;
          store = next;
          for (const fn of subs.slice()) { try { fn(store); } catch (e) { /* subscriber fault */ } }
        },
        subscribe: (fn) => {
          subs.push(fn);
          return () => {
            const i = subs.indexOf(fn);
            if (i >= 0) subs.splice(i, 1);
          };
        },
      };

      const subscribeLocale = (fn) => {
        try {
          return locale.subscribe(fn);
        } catch (e) { return undefined; }
      };

      // One background sweep per page load, after the first paint. Deliberately
      // not an interval: the check costs one host round trip per installed skill.
      if (typeof setTimeout === 'function') {
        let alive = true;
        const timer = setTimeout(() => {
          if (!alive) return;
          hostCall('bootstrap', {}).then((b) => {
            if (!alive) return;
            const scopes = [''];
            if (b && Array.isArray(b.projects)) {
              for (const p of b.projects) { if (p && p.path) scopes.push(String(p.path)); }
            }
            let i = 0;
            const step = () => {
              if (!alive || i >= scopes.length) return;
              const sc = scopes[i];
              i += 1;
              hostCall('check-updates', { projectPath: sc }).then((r) => {
                if (!alive) return;
                if (r && r.ok) api.publish(sc, r.updates || {});
                step();
              }, () => { if (alive) step(); });
            };
            step();
          }, () => {});
        }, IDLE_MS);
        ctx.effect(() => () => {
          alive = false;
          clearTimeout(timer);
        }, 'dsh-skills-panel: idle update check');
      }

      const Panel = createPanel(ctx, { translate, store: api, subscribeLocale });
      ctx.slots.inject('settings.section', () => ctx.slots.register(
        { name: 'settings.section', id: 'skills', order: 25, label: () => translate('title') },
        Panel,
      ));
    }

    /**
     * One call into the host route.
     *
     * The route answers a JSON envelope and is same-origin, so the browser
     * attaches the platform's login cookie automatically. Transport faults and
     * failure envelopes are folded into the single `{ok:…}` shape the panel
     * speaks, so no caller has to tell them apart.
     *
     * @param method - endpoint name, matching a host-core method.
     * @param args - JSON payload.
     * @returns `{ok: true, …}` or `{ok: false, error}`.
     */
    function hostCall(method, args) {
      let pending;
      try {
        pending = fetch(CHANNEL + '/' + method, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(args || {}),
        });
      } catch (e) {
        return Promise.resolve({ ok: false, error: String(e && e.message ? e.message : e) });
      }
      return Promise.resolve(pending).then(
        (res) =>
          res.json().then(
            (env) => {
              if (env && env.ok) return env.value;
              const msg = env && env.error
                ? (env.error.message || env.error.code || 'host call failed')
                : 'HTTP ' + res.status;
              return { ok: false, error: String(msg) };
            },
            () => ({ ok: false, error: 'HTTP ' + res.status + ' with a non-JSON body' }),
          ),
        (e) => ({ ok: false, error: String(e && e.message ? e.message : e) }),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
    })();

    // ── usage dashboard ──
    // Its own closure: the features declare locals under the same names, so
    // nothing may leak between them.
    var TOKEN_STATS = (function () {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const h = React.createElement;

    /** Route prefix owned by the host half; must match lib/index.js. */
    const CHANNEL = '/token-stats';

    /** Locale namespace for this panel's dictionary. */
    const NS = 'dsh-token-stats';

    /** Marker attribute this bundle puts on its own settings nav row. */
    const NAV_ATTR = 'data-dsh-token-stats-nav';

    /**
     * Backstop delay for re-checking the whole document for the settings nav row.
     *
     * The row is normally marked synchronously from the very mutation that
     * inserted it (see the observer in `apply`), which is what keeps the shell's
     * gear fallback from being painted at all. This timer only covers a row that
     * somehow arrives outside the subtree a mutation showed us, so it can afford
     * to be slow.
     */
    const NAV_SWEEP_MS = 400;

    /**
     * Bar-chart glyph for the settings nav row, as a percent-encoded SVG mask.
     *
     * Drawn to fill the 16x16 box to roughly the same extent as the shipped
     * outline icons, and painted with `background-color: currentColor` so it
     * follows the nav row's normal, hover and active colours for free.
     */
    const NAV_ICON_SVG =
      "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'"
      + " stroke='black' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round'%3E"
      + "%3Cpath d='M2 13.4h12'/%3E"
      + "%3Cpath d='M4.7 13.4V9.1'/%3E%3Cpath d='M8 13.4V4.6'/%3E%3Cpath d='M11.3 13.4V7.3'/%3E"
      + "%3C/svg%3E";

    /** Metric identifiers shared with the host payload's bucket order. */
    const METRIC_INDEX = { input: 0, output: 1, cacheRead: 2, cacheWrite: 3 };

    /** Model keys the host reserves for folded slices. */
    const OTHER_KEY = '__other__';
    const UNKNOWN_KEY = '__unknown__';

    /** Everything the panel can say, in both locales. */
    const EN = {
      title: 'Usage',
      loading: 'Reading session logs…',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      updated: 'Updated',
      statLifetime: 'Lifetime tokens',
      statPeak: 'Peak day',
      statSessions: 'Sessions',
      statToday: 'Today',
      statWeek: 'Last 7 days',
      statDailyAvg: 'Daily average',
      statDailyAvgBasis: 'per active day',
      statCacheShare: 'Cache read share',
      statCacheShareBasis: 'of all tokens',
      metric: 'Metric',
      metricAll: 'Total',
      metricTotal: 'Input + output',
      metricInput: 'Input',
      metricOutput: 'Output',
      metricCacheRead: 'Cache read',
      metricCacheWrite: 'Cache write',
      scale: 'Scale',
      viewDaily: 'Daily',
      viewWeekly: 'Weekly',
      modelUsageTitle: 'Usage by model',
      granularityPrefix: 'Granularity',
      granularityDay: 'by day',
      granularityWeek: 'by week',
      granularityMonth: 'by month',
      granularityYear: 'by year',
      heatmapTitle: 'Daily usage',
      weeklyTitle: 'Weekly usage',
      donutTotal: 'Total',
      trendTitle: 'Trend',
      pieTitle: 'Share',
      range: 'Range',
      range7: '7 days',
      range30: '30 days',
      range90: '90 days',
      rangeYear: 'This year',
      rangeAll: 'All time',
      other: 'Other models',
      unknown: 'Unattributed',
      noData: 'No token usage recorded yet.',
      incomplete: 'sessions could not be read and were skipped',
      retained: 'retained after removal',
      metricNote: 'Total = uncached input + output + cache read + cache write, matching the provider\u2019s own totalTokens. Input + output excludes cache reads, which on a warm session dominate by a wide margin.',
      metricNoteNoCacheWrite: 'Total = uncached input + output + cache read, matching the provider\u2019s own totalTokens. Input + output excludes cache reads, which on a warm session dominate by a wide margin. No cache-write usage is reported through this deployment, so that metric stays hidden.',
      dailyNote: 'Daily buckets use this machine\u2019s local timezone. Totals include sessions whose logs are no longer listed, so cleaning up history does not shrink them.',
      weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      tokens: 'tokens',
      // Largest-first so the first match wins; 1e3 is a unit here because the
      // request was explicit about 千 / 万 / 亿.
      units: [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']],
    };

    const ZH = {
      title: '用量统计',
      loading: '正在读取会话日志…',
      refresh: '刷新',
      refreshing: '刷新中…',
      updated: '更新于',
      statLifetime: '累计用量',
      statPeak: '单日峰值',
      statSessions: '会话数',
      statToday: '今日用量',
      statWeek: '近 7 天',
      statDailyAvg: '日均用量',
      statDailyAvgBasis: '按活跃天',
      statCacheShare: '缓存读占比',
      statCacheShareBasis: '占总量',
      metric: '计量口径',
      metricAll: '总量（含缓存）',
      metricTotal: '输入+输出',
      metricInput: '输入',
      metricOutput: '输出',
      metricCacheRead: '缓存读',
      metricCacheWrite: '缓存写',
      scale: '粒度',
      viewDaily: '每日',
      viewWeekly: '每周',
      modelUsageTitle: '分模型用量',
      granularityPrefix: '粒度',
      granularityDay: '按天',
      granularityWeek: '按周',
      granularityMonth: '按月',
      granularityYear: '按年',
      heatmapTitle: '每日用量',
      weeklyTitle: '每周用量',
      donutTotal: '合计',
      trendTitle: '趋势',
      pieTitle: '占比',
      range: '范围',
      range7: '近 7 天',
      range30: '近 30 天',
      range90: '近 90 天',
      rangeYear: '今年',
      rangeAll: '全部',
      other: '其他模型',
      unknown: '无归属',
      noData: '暂无用量记录。',
      incomplete: '个会话无法读取，已跳过',
      retained: '个已移除但保留计数',
      metricNote: '「总量（含缓存）」= 未缓存输入 + 输出 + 缓存读 + 缓存写，与提供方上报的 totalTokens 口径一致；「输入+输出」不含缓存读 —— 热会话里缓存读往往是它的几十倍。',
      metricNoteNoCacheWrite: '「总量」= 未缓存输入 + 输出 + 缓存读，与提供方上报的 totalTokens 口径一致；「输入+输出」不含缓存读 —— 热会话里缓存读往往是它的几十倍。本环境没有任何缓存写用量上报，因此该口径不显示。',
      dailyNote: '每日归属按本机本地时区切分。已从列表移除但日志仍在的会话继续计入，所以清理历史不会让累计数字变小。',
      weekdays: ['一', '二', '三', '四', '五', '六', '日'],
      months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      tokens: 'tokens',
      units: [[1e12, '万亿'], [1e8, '亿'], [1e4, '万'], [1e3, '千']],
    };

    /**
     * Stylesheet, assembled as an array so a unit test can assert single rules.
     * Every colour is a host alias token; every class carries the `dts-` prefix.
     */
    const CSS = [
      '.dts-root{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary);font:inherit}',
      '.dts-head{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:12px;padding:12px 0;background:var(--dsw-alias-bg-layer-2)}',
      '.dts-head-title{font-size:13px;line-height:20px;font-weight:600}',
      '.dts-head-right{margin-left:auto;display:flex;align-items:center;gap:8px}',
      '.dts-updated{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
      // A quiet pulse instead of a spinner: the panel keeps showing the last
      // figures while the host rescans, so there is nothing to block on.
      '.dts-refreshing{display:inline-flex;align-items:center;gap:5px}',
      '.dts-refreshing::before{content:"";width:5px;height:5px;border-radius:50%;background-color:var(--dsw-static-blue-400);animation:dts-pulse 1.1s ease-in-out infinite}',
      '@keyframes dts-pulse{0%,100%{opacity:.2}50%{opacity:1}}',
      '.dts-body{display:flex;flex-direction:column;gap:10px;padding-bottom:24px}',
      '.dts-btn{font:inherit;font-size:12px;line-height:18px;height:28px;padding:0 12px;border-radius:14px;border:.5px solid var(--dsw-alias-border-l3);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;transition:border-color .16s,background .16s}',
      '.dts-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dts-btn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}',
      '.dts-btn[disabled]{opacity:.4;cursor:default}',
      '.dts-btn[disabled]:hover{background:transparent}',
      '.dts-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px}',
      // Surfaces copied verbatim from the shell's own settings cards:
      // `.card{border:.5px solid var(--dsw-alias-border-l4);
      //        background:var(--dsw-alias-bg-layer-3);border-radius:16px}`
      // read out of dsh-client-ui-settings-plugins. A 12px radius, no outline, or
      // the module-platform surface each read as a different design next to the
      // shipped settings pages.
      '.dts-card{border:.5px solid var(--dsw-alias-border-l4);border-radius:16px;background:var(--dsw-alias-bg-layer-3);padding:14px 16px}',
      '.dts-card-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dts-card-value{font-size:20px;line-height:28px;font-variant-numeric:tabular-nums;margin-top:2px}',
      '.dts-card-sub{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin-top:2px}',
      '.dts-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dts-row-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);margin-right:2px}',
      '.dts-seg{display:inline-flex;border:.5px solid var(--dsw-alias-border-l3);border-radius:14px;overflow:hidden}',
      '.dts-seg-btn{font:inherit;font-size:12px;line-height:18px;height:28px;padding:0 12px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;transition:background .16s,color .16s}',
      '.dts-seg-btn:hover{color:var(--dsw-alias-label-secondary)}',
      '.dts-seg-btn[data-on="1"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dts-seg-btn:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--dsw-alias-border-l3)}',
      '.dts-input{font:inherit;font-size:13px;line-height:20px;height:32px;padding:0 10px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);transition:border-color .16s,box-shadow .16s}',
      '.dts-input:focus-visible{outline:none;border-color:var(--dsw-alias-border-l3);box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}',
      '.dts-section{border:.5px solid var(--dsw-alias-border-l4);border-radius:16px;background:var(--dsw-alias-bg-layer-3);padding:14px 16px;display:flex;flex-direction:column;gap:14px}',
      '.dts-subsection{display:flex;flex-direction:column;gap:10px}',
      // The shell separates settings rows with a border-l2 hairline; the same
      // divider keeps the two model-scoped charts visibly distinct without a
      // second card.
      '.dts-subsection+.dts-subsection{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:14px}',
      '.dts-section-title{font-size:13px;line-height:20px;font-weight:600}',
      '.dts-status{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);padding:8px 0}',
      '.dts-error{font-size:13px;line-height:20px;color:var(--dsw-alias-state-error-primary);padding:8px 0}',
      '.dts-note{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin:0}',
      // The slot holds whichever day-scale view is selected. Its min-height is
      // set inline from viewSlotHeight(), so swapping the two views changes
      // nothing about the space they occupy.
      '.dts-viewslot{position:relative;width:100%}',
      '.dts-chart-wrap{position:relative;width:100%}',
      '.dts-chart{display:block;width:100%;overflow:visible}',
      // An instant tooltip, fixed to the viewport: SVG <title> is a native
      // browser tooltip with a ~1s delay that cannot be styled, and a tooltip
      // positioned inside the scroll container got clipped as soon as it reached
      // the panel edge, so it could not be read near the right border at all.
      '.dts-tip{position:fixed;z-index:40;pointer-events:none;transform:translate(-50%,calc(-100% - 10px));white-space:nowrap;padding:6px 8px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12px;line-height:16px;box-shadow:0 2px 8px var(--dsw-alias-bg-mask-drop)}',
      '.dts-tip-head{color:var(--dsw-alias-label-secondary)}',
      '.dts-tip-row{display:flex;align-items:center;gap:6px}',
      '.dts-tip-value{margin-left:auto;font-variant-numeric:tabular-nums}',
      '.dts-axis{font-size:10px;fill:var(--dsw-alias-label-tertiary)}',
      '.dts-grid{stroke:var(--dsw-alias-border-l1);stroke-width:.5}',
      // A tick per labelled x, so every time-series chart shows the same
      // structure even where no data was recorded.
      '.dts-tick{stroke:var(--dsw-alias-border-l1);stroke-width:.5}',
      '.dts-dot-empty{fill:none;stroke:var(--dsw-alias-label-tertiary);stroke-width:1;opacity:.55}',
      '.dts-trend-bar,.dts-donut-slice,.dts-week-bar,.dts-dot,.dts-cell{transition:opacity .16s}',
      '.dts-trend-bar:hover,.dts-donut-slice:hover,.dts-week-bar:hover{opacity:.75}',
      '.dts-swatch{flex:none;width:8px;height:8px;border-radius:2px;background-color:currentColor}',
      '.dts-legend{display:flex;flex-direction:column;gap:6px;min-width:180px}',
      '.dts-legend-row{display:flex;align-items:center;gap:8px;font-size:12px;line-height:18px}',
      '.dts-legend-name{color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dts-legend-value{margin-left:auto;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.dts-pie-wrap{display:flex;align-items:center;gap:20px;flex-wrap:wrap}',
      '.dts-donut-total{font-size:15px;line-height:20px;font-weight:600;fill:var(--dsw-alias-label-primary)}',
      '.dts-donut-total-label{font-size:10px;line-height:14px;fill:var(--dsw-alias-label-tertiary)}',
      '.dts-donut-slice{stroke:var(--dsw-alias-bg-layer-3);stroke-width:1.5;cursor:default}',
      '.dts-heat{display:flex;flex-direction:column;gap:4px}',
      // Both day-scale views are a fixed-width block: past the cell cap the
      // width stops growing with the card, so the block is centred in it. The
      // two views share this wrapper, which is also what keeps them aligned.
      '.dts-heat-center{display:flex;justify-content:center;width:100%}',
      '.dts-heat-months{display:flex;gap:3px;width:100%;font-size:10px;line-height:12px;color:var(--dsw-alias-label-tertiary)}',
      // The month row mirrors the grid exactly: one gutter column plus one cell
      // per week column, so labels cannot drift away from their columns.
      '.dts-heat-gutter,.dts-heat-weekdays{flex:none;width:16px;margin-right:2px}',
      '.dts-heat-month{flex:1 1 0;min-width:0;overflow:hidden;white-space:nowrap}',
      // Columns share the width evenly so the grid fills the card and the newest
      // day sits flush right; the cell size follows from that, which keeps a
      // 53-week window at roughly GitHub's own cell pitch.
      '.dts-heat-grid{display:flex;gap:3px;width:100%;align-items:stretch}',
      '.dts-heat-col{display:flex;flex-direction:column;gap:3px;flex:1 1 0;min-width:0}',
      // The weekday column divides the same height into the same 7 rows, so a
      // label lines up with its row at any cell size. Fixed-height labels were
      // the reason they drifted once the cells became square.
      '.dts-heat-weekdays{display:flex;flex-direction:column;gap:3px;font-size:10px;line-height:1;color:var(--dsw-alias-label-tertiary)}',
      '.dts-heat-weekdays span{flex:1 1 0;min-height:0;display:flex;align-items:center;justify-content:flex-end;padding-right:3px}',
      '.dts-heat-gutter{height:12px}',
      '.dts-cell{width:100%;aspect-ratio:1/1;box-sizing:border-box;border-radius:2px;background:var(--dsw-alias-bg-layer-2);box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l2)}',
      // Days that have not happened yet keep their slot but are drawn as an
      // outline, so the grid reads as "calendar continues" rather than as
      // missing data.
      '.dts-cell[data-future="1"]{background:transparent;box-shadow:none;border:1px dashed var(--dsw-alias-border-l2);opacity:.75}',
      '.dts-cell:hover{opacity:.72}',
      // One hue, with the depth carried by an inline opacity computed from the
      // value (see intensityOf).
      '.dts-cell-on{background:var(--dsw-static-blue-400);box-shadow:none}',
      // Categorical chart palette. These must NOT be the semantic alias tokens:
      // --dsw-alias-brand-primary resolves to a near-black neutral in the light
      // theme and a near-white one in the dark theme, so a chart built on it
      // reads as black-and-white. The shell also publishes fixed `--dsw-static-*`
      // ramps, which are stable across both themes and are what a data series
      // needs. The 400-level steps are used first because the 500s read as
      // over-saturated against the shell's own muted surfaces.
      '.dts-c0{fill:var(--dsw-static-blue-400);color:var(--dsw-static-blue-400)}',
      '.dts-c1{fill:var(--dsw-static-amber-400);color:var(--dsw-static-amber-400)}',
      '.dts-c2{fill:var(--dsw-static-green-400);color:var(--dsw-static-green-400)}',
      '.dts-c3{fill:var(--dsw-static-red-400);color:var(--dsw-static-red-400)}',
      '.dts-c4{fill:var(--dsw-static-deepseek-450);color:var(--dsw-static-deepseek-450)}',
      '.dts-c5{fill:var(--dsw-static-blue-300);color:var(--dsw-static-blue-300)}',
      '.dts-c6{fill:var(--dsw-static-amber-500);color:var(--dsw-static-amber-500)}',
      '.dts-c7{fill:var(--dsw-static-green-500);color:var(--dsw-static-green-500)}',
      '.dts-c8{fill:var(--dsw-static-neutral-400);color:var(--dsw-static-neutral-400)}',
      '.dts-donut-shadow-node{flood-color:var(--dsw-static-neutral-1000);flood-opacity:.16}',
      '.dts-line{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
      '.dts-dot{stroke:var(--dsw-alias-bg-layer-3);stroke-width:1;fill:currentColor}',
      'button[' + NAV_ATTR + '] > svg{display:none}',
      'button[' + NAV_ATTR + ']::before{content:"";flex:none;width:16px;height:16px;background-color:currentColor;'
        + "-webkit-mask:url(\"data:image/svg+xml;utf8," + NAV_ICON_SVG + "\") center/contain no-repeat;"
        + "mask:url(\"data:image/svg+xml;utf8," + NAV_ICON_SVG + "\") center/contain no-repeat}",
    ].join('');

    /**
     * Mark a settings nav row when it is this plugin's.
     *
     * The `settings.section` registration contract carries only id, order and
     * label — there is no icon field — and the shell picks the glyph from a
     * hardcoded if-chain over section ids whose fallback is the settings gear,
     * so a third-party section can never be handed its own glyph. The rendered
     * row carries no attribute naming its section either, so the only reliable
     * match is the label text, in both spellings so a locale change cannot drop
     * the mark.
     *
     * @param button - candidate element.
     * @returns the button when this call marked it, otherwise null.
     */
    function markNavButton(button) {
      if (button.hasAttribute(NAV_ATTR)) return null;
      const first = button.firstElementChild;
      if (first === null || first === undefined) return null;
      if (String(first.tagName).toLowerCase() !== 'svg') return null;
      const label = String(button.textContent || '').trim();
      if (label !== EN.title && label !== ZH.title) return null;
      button.setAttribute(NAV_ATTR, '');
      return button;
    }

    /**
     * Nearest enclosing `<button>`, for a label written into a mounted row.
     * @param node - the node that was inserted.
     * @returns the owning button, or null.
     */
    function enclosingButton(node) {
      let parent = node.parentNode;
      while (parent !== null && parent !== undefined && parent.nodeType === 1) {
        if (String(parent.tagName).toLowerCase() === 'button') return parent;
        parent = parent.parentNode;
      }
      return null;
    }

    /**
     * Mark this plugin's nav row anywhere inside `root`.
     * @param root - a Document or Element to search.
     * @returns the first button marked by this call, otherwise null.
     */
    function markNavRowIn(root) {
      let first = null;
      if (root.nodeType === 1 && String(root.tagName).toLowerCase() === 'button') {
        first = markNavButton(root);
      }
      if (typeof root.querySelectorAll !== 'function') return first;
      for (const button of root.querySelectorAll('button')) {
        const hit = markNavButton(button);
        if (hit !== null && first === null) first = hit;
      }
      return first;
    }

    /** Two-digit zero padding. */
    function pad2(value) {
      return value < 10 ? '0' + value : String(value);
    }

    /** `YYYY-MM-DD` for a Date, in local time. */
    function dayKeyOf(date) {
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    }

    /** Local-midnight Date for a `YYYY-MM-DD` key. */
    function parseDay(key) {
      const parts = String(key).split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }

    /** Every `YYYY-MM-DD` from `from` through `to`, inclusive. */
    function eachDay(from, to) {
      const out = [];
      const cursor = parseDay(from);
      const end = parseDay(to);
      // A malformed or inverted range must not spin: bound the walk.
      for (let guard = 0; guard < 4000 && cursor <= end; guard += 1) {
        out.push(dayKeyOf(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return out;
    }

    /** Monday-based day index (0 = Monday) for a Date. */
    function mondayIndex(date) {
      return (date.getDay() + 6) % 7;
    }

    /** Add days to a Date, returning a new Date at local midnight. */
    function addDays(date, days) {
      const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      next.setDate(next.getDate() + days);
      return next;
    }

    /** Selected metric's token count for a four-bucket array. */
    function metricOf(buckets, metric) {
      if (metric === 'all') return buckets[0] + buckets[1] + buckets[2] + buckets[3];
      if (metric === 'total') return buckets[0] + buckets[1];
      const index = METRIC_INDEX[metric];
      return index === undefined ? buckets[0] + buckets[1] : buckets[index];
    }

    /**
     * Unit-scaled token count in the active locale: 1.23亿 / 4,567万 / 8.9千
     * for Chinese, 1.2B / 3.4M / 5.6K for English.
     *
     * The unit table lives in the dictionary, so a locale that has no unit
     * convention simply falls through to a plain grouped number.
     *
     * @param value - token count.
     * @param t - translate function, whose dictionary carries `units`.
     * @returns the scaled string.
     */
    function formatUnits(value, t) {
      const n = Math.round(Number(value) || 0);
      const table = t('units');
      if (Array.isArray(table)) {
        for (const entry of table) {
          const scale = entry[0];
          if (n >= scale) {
            const scaled = n / scale;
            const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
            return String(Number(scaled.toFixed(digits))) + entry[1];
          }
        }
      }
      return formatFull(n);
    }

    /** Unit form plus the exact count, for tooltips. */
    function formatUnitsExact(value, t) {
      const n = Math.round(Number(value) || 0);
      const units = formatUnits(n, t);
      return units === formatFull(n) ? units : units + '\uff08' + formatFull(n) + '\uff09';
    }

    /** Full token count with thousands separators. */
    function formatFull(value) {
      return Math.round(Number(value) || 0).toLocaleString();
    }

    /** Class name for the colour of one model index. */
    function colorClass(index) {
      return 'dts-c' + Math.max(0, Math.min(8, index));
    }

    /** Localized label for one model slice. */
    function modelLabel(model, t) {
      if (model === undefined || model === null) return t('unknown');
      if (model.key === OTHER_KEY) return t('other');
      if (model.key === UNKNOWN_KEY) return t('unknown');
      return model.name && model.name.length > 0 ? model.name : model.key;
    }

    /**
     * Prepare the payload for rendering: index every day and rank the models.
     * @param payload - the host payload.
     * @returns lookup tables, or null when there is nothing to draw.
     */
    function prepare(payload) {
      const models = Array.isArray(payload.models) ? payload.models : [];
      const days = Array.isArray(payload.days) ? payload.days : [];
      const byDay = new Map();
      for (const day of days) {
        const slots = new Map();
        for (const entry of day.m) slots.set(entry[0], [entry[1], entry[2], entry[3], entry[4]]);
        byDay.set(day.d, { b: day.b, m: slots });
      }
      let lifetime = 0;
      let activeDays = 0;
      for (const day of days) {
        const value = day.b[0] + day.b[1];
        lifetime += value;
        if (value > 0) activeDays += 1;
      }
      return { models, days, byDay, lifetime, activeDays, first: payload.range ? payload.range.first : null, last: payload.range ? payload.range.last : null };
    }

    /** Total for one day entry under the selected metric. */
    function dayValue(entry, metric) {
      return entry === undefined ? 0 : metricOf(entry.b, metric);
    }

    /** Total for one model slice inside one day entry. */
    function dayModelValue(entry, index, metric) {
      if (entry === undefined) return 0;
      const buckets = entry.m.get(index);
      return buckets === undefined ? 0 : metricOf(buckets, metric);
    }

    /** Peak day across all recorded days for the selected metric. */
    function peakDay(model, metric) {
      let best = null;
      for (const day of model.days) {
        const value = dayValue(model.byDay.get(day.d), metric);
        if (best === null || value > best.value) best = { day: day.d, value };
      }
      return best;
    }

    /** Sum one metric across a day list for a model index (-1 = all models). */
    function sumDays(model, dayKeys, metric, index) {
      let total = 0;
      for (const key of dayKeys) {
        const entry = model.byDay.get(key);
        if (entry === undefined) continue;
        total += index === undefined || index < 0 ? dayValue(entry, metric) : dayModelValue(entry, index, metric);
      }
      return total;
    }

    /**
     * How colour depth follows a day's usage.
     *
     * Three candidate mappings, and why this one:
     *
     * - **Linear** (`value / max`) is the most intuitive reading — twice as dark
     *   means twice as much — but it crushes everything below the top: with a
     *   265M peak a 15M day sits at 5.6% of the ramp and a 26M day at 9.8%, so
     *   ordinary days all render as the same faint tint.
     * - **Logarithmic** (`log(v) / log(max)`) was tried and rejected on real
     *   data: 8.9k…265M spans 4.5 decades, so the two busiest days (111M and
     *   265M, a 153M gap) landed 8% apart on the ramp — a 0.07 opacity
     *   difference, invisible. A log scale flattens exactly the region a heavy
     *   user is looking at.
     * - **Power law** (`(value / max) ** 0.45`) sits between them: the top end
     *   keeps real separation (265M vs 111M is ~0.27 of the ramp) while a 15M
     *   day still reads clearly lighter than a 26M day.
     *
     * The anchor is the window maximum, so the ramp always spans the data in
     * view. One consequence is worth naming: a single extreme outlier would push
     * every other day toward the floor, which is inherent to any single scale.
     */
    const INTENSITY_GAMMA = 0.45;

    /** Lowest opacity a day with any usage receives, so it never looks empty. */
    const INTENSITY_FLOOR = 0.15;

    /**
     * Colour opacity for one day's usage.
     * @param value - the day's usage under the selected metric.
     * @param highest - the largest day in view (the ramp's anchor).
     * @returns an opacity in `[0, 1]`; 0 means no usage.
     */
    function intensityOf(value, highest) {
      if (!(value > 0)) return 0;
      if (!(highest > 0)) return 0;
      const ratio = Math.min(1, value / highest);
      return INTENSITY_FLOOR + Math.pow(ratio, INTENSITY_GAMMA) * (1 - INTENSITY_FLOOR);
    }

    /** SVG polyline/area path from a list of `[x, y]` points. */
    function linePath(points) {
      if (points.length === 0) return '';
      let d = 'M ' + points[0][0].toFixed(2) + ' ' + points[0][1].toFixed(2);
      for (let i = 1; i < points.length; i += 1) d += ' L ' + points[i][0].toFixed(2) + ' ' + points[i][1].toFixed(2);
      return d;
    }

    /**
     * Smooth path through `points` (Catmull-Rom control points as cubic beziers).
     *
     * The vertical control offsets are clamped into each segment, so the curve is
     * smooth without overshooting its own data — an unclamped spline can dip
     * below a value it interpolates, which on a monotone cumulative curve would
     * draw usage that never happened.
     *
     * @param points - `[x, y]` pairs in order.
     * @returns an SVG path string.
     */
    function smoothPath(points) {
      if (points.length < 3) return linePath(points);
      const tension = 0.2;
      let d = 'M ' + points[0][0].toFixed(2) + ' ' + points[0][1].toFixed(2);
      for (let i = 0; i < points.length - 1; i += 1) {
        const previous = points[i - 1] === undefined ? points[i] : points[i - 1];
        const from = points[i];
        const to = points[i + 1];
        const next = points[i + 2] === undefined ? to : points[i + 2];
        const low = Math.min(from[1], to[1]);
        const high = Math.max(from[1], to[1]);
        const clamp = (value) => Math.min(Math.max(value, low), high);
        const c1x = from[0] + (to[0] - previous[0]) * tension;
        const c1y = clamp(from[1] + (to[1] - previous[1]) * tension);
        const c2x = to[0] - (next[0] - from[0]) * tension;
        const c2y = clamp(to[1] - (next[1] - from[1]) * tension);
        d += ' C ' + c1x.toFixed(2) + ' ' + c1y.toFixed(2) + ' ' + c2x.toFixed(2) + ' ' + c2y.toFixed(2)
          + ' ' + to[0].toFixed(2) + ' ' + to[1].toFixed(2);
      }
      return d;
    }

    /**
     * Resolve a range preset into concrete day keys.
     *
     * Presets are anchored on today rather than on the last recorded day, so
     * "7 days" means the last seven calendar days even when nothing ran today.
     * @param preset - `7` | `30` | `90` | `year` | `all`.
     * @param model - prepared payload.
     * @returns `{ from, to }` day keys.
     */
    function presetRange(preset, model) {
      const today = new Date();
      const todayKey = dayKeyOf(today);
      if (preset === 'all') {
        return { from: model.first === null ? todayKey : model.first, to: model.last === null ? todayKey : model.last };
      }
      if (preset === 'year') return { from: today.getFullYear() + '-01-01', to: todayKey };
      const days = preset === '7' ? 7 : preset === '90' ? 90 : 30;
      return { from: dayKeyOf(addDays(today, -(days - 1))), to: todayKey };
    }

    /**
     * One segmented control.
     * @param props - `label`, `options` (`{value,label}`), `value`, `onChange`.
     * @returns the control element.
     */
    function Segmented(props) {
      return h('div', { className: 'dts-row' },
        props.label === undefined ? null : h('span', { className: 'dts-row-label' }, props.label),
        h('div', { className: 'dts-seg', role: 'group' },
          props.options.map((option) => h('button', {
            key: option.value,
            type: 'button',
            className: 'dts-seg-btn',
            'data-on': option.value === props.value ? '1' : '0',
            'aria-pressed': option.value === props.value,
            onClick: () => props.onChange(option.value),
          }, option.label))));
    }

    /** One statistic card. */
    function Card(props) {
      return h('div', { className: 'dts-card' },
        h('div', { className: 'dts-card-label' }, props.label),
        h('div', { className: 'dts-card-value', title: props.title }, props.value),
        props.sub === undefined ? null : h('div', { className: 'dts-card-sub' }, props.sub));
    }

    /**
     * Instant hover tooltip state for one chart.
     *
     * SVG `<title>` produces a native tooltip with a browser-imposed delay that
     * cannot be shortened or styled, which is why hovering felt sluggish; this
     * renders an owned element at the cursor's column instead.
     *
     * @returns the wrapper ref, the current tip, and the handlers.
     */
    function useTip() {
      const wrap = React.useRef(null);
      const [tip, setTip] = React.useState(null);
      const show = (event, lines) => {
        const target = event.currentTarget.getBoundingClientRect();
        const viewport = typeof window === 'undefined' ? 1280 : window.innerWidth;
        const margin = 100;
        setTip({
          x: Math.min(Math.max(target.left + target.width / 2, margin), Math.max(margin, viewport - margin)),
          y: target.top,
          below: target.top < 72,
          lines,
        });
      };
      const hide = () => setTip(null);
      return { wrap, tip, show, hide };
    }

    /**
     * The last width the day-scale slot reported.
     *
     * It lives at module scope so a remount — the settings dialog unmounts the
     * panel on close — starts from the width the last mount measured instead of
     * re-deriving the whole grid from the 820px fallback.
     */
    let lastMeasuredWidth = 0;

    /**
     * Turn one measured element into the slot width.
     *
     * A width of 0 means the element is not laid out yet (a hidden dialog, or a
     * commit that has not been painted); it must never overwrite a good value,
     * or the grid would snap back to the fallback on every reopen.
     *
     * @param element - the slot element, or null when it detached.
     * @param apply - setter for the measured width.
     */
    function measureWidth(element, apply) {
      if (element === null || element === undefined) return;
      if (typeof element.getBoundingClientRect !== 'function') return;
      const rect = element.getBoundingClientRect();
      const next = rect !== undefined && rect !== null && rect.width > 0 ? rect.width : 0;
      if (next <= 0) return;
      lastMeasuredWidth = next;
      // A sub-pixel change is not worth a render: React bails out when the
      // updater returns the value it already holds.
      apply((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    }

    /**
     * Render one tooltip. A plain string is a heading; a `[index, label, value]`
     * triple becomes a swatch row.
     * @param tip - the current tooltip state.
     * @returns the tooltip element, or null.
     */
    function renderTip(tip) {
      if (tip === null) return null;
      return h('div', {
        className: 'dts-tip',
        style: {
          left: tip.x + 'px',
          top: tip.y + 'px',
          // Flip below the cursor when there is no room above it.
          transform: tip.below === true ? 'translate(-50%,10px)' : undefined,
        },
      },
      tip.lines.map((line, i) => (Array.isArray(line)
        ? h('div', { key: i, className: 'dts-tip-row' },
          h('span', { className: 'dts-swatch ' + colorClass(line[0]) }),
          h('span', {}, line[1]),
          h('span', { className: 'dts-tip-value' }, line[2]))
        : h('div', { key: i, className: 'dts-tip-head' }, line))));
    }

    /** Wrap a chart body with its tooltip overlay. */
    function chartShell(tip, body, label) {
      return h('div', { className: 'dts-chart-wrap', ref: tip.wrap, onMouseLeave: tip.hide },
        body,
        renderTip(tip.tip));
    }

    /**
     * Geometry of the day-scale block, in CSS pixels.
     *
     * These are the numbers the stylesheet's heat grid also declares — a 16px
     * weekday column plus a 2px margin, a 3px gap between and inside columns —
     * so the block the two views are laid out in can be computed in JavaScript
     * and reserved before either of them renders.
     */
    const CELL_GAP = 3;
    const GUTTER = 18;
    /** Rows in the daily grid, and the month-label strip above them. */
    const HEAT_ROWS = 7;
    const HEAT_HEADER = 16;
    /**
     * The day-scale window: eighteen weeks, always.
     *
     * It is deliberately not a function of the card width any more. Deriving it
     * from the width made the block fill whatever card it landed in, which read
     * as a big block that grew on a wide screen, and it showed months whose only
     * contribution was to shrink every square. A fixed column count is also what
     * lets the daily grid and the weekly bars stay one shape at any width.
     */
    const WINDOW_WEEKS = 18;
    /**
     * Edge of one day's square. Fixed rather than derived from the width, for
     * the same reason as the window; a card narrower than the resulting block
     * shrinks the cell just enough to fit.
     */
    const CELL_TARGET = 26;
    /**
     * Hard floor for the cell, so a card narrower than the fixed block still
     * holds the whole grid instead of overflowing it. Below this the squares are
     * a smear, which is the honest outcome for a card that narrow.
     */
    const CELL_MIN = 6;
    /** Side inset of a weekly bar inside its column, so bars stay distinct. */
    const BAR_INSET = 6;

    /**
     * Column count for the day-scale views.
     * @returns the fixed number of week columns.
     */
    function heatmapWeeks() {
      return WINDOW_WEEKS;
    }

    /**
     * The geometry both day-scale views are built from.
     *
     * One block, shared by the grid and the bars: the same sixteen weeks, the
     * same column pitch, the same width and the same height, so the two views are
     * the same object seen two ways and switching between them moves nothing —
     * and, because both place column i at the same x, a week sits exactly under
     * its seven days. The stylesheet's heat grid is `gutter | column × weeks`
     * with a 3px gap between every pair, which is what the formula below mirrors.
     *
     * The cell is a fixed size, not a division of the card: the block is one
     * compact shape that is centred in the slot, and only a card too narrow to
     * hold it shrinks the cell.
     *
     * @param availableWidth - measured slot width in CSS pixels, 0 when unknown.
     * @returns `{ weeks, cell, pitch, barWidth, gutter, gap, gridWidth, height }`.
     */
    function gridGeometry(availableWidth) {
      const width = availableWidth > 0 ? availableWidth : 820;
      const weeks = heatmapWeeks();
      const fits = (width - GUTTER - CELL_GAP * weeks) / weeks;
      const cell = Math.max(CELL_MIN, Math.min(CELL_TARGET, fits));
      const gridWidth = GUTTER + CELL_GAP * weeks + weeks * cell;
      return {
        weeks,
        cell,
        pitch: cell + CELL_GAP,
        // Bars keep a gap of their own inside the column, so a week with usage
        // reads as a bar instead of a solid band of colour.
        barWidth: Math.max(3, cell - BAR_INSET),
        gutter: GUTTER,
        gap: CELL_GAP,
        gridWidth,
        // Month labels plus the grid: the block the weekly chart also occupies.
        height: HEAT_HEADER + HEAT_ROWS * cell + CELL_GAP * (HEAT_ROWS - 1),
      };
    }

    /**
     * Height reserved for the day-scale view slot.
     *
     * Both views are built from {@link gridGeometry}, so they are already the
     * same height; the slot states it as a minimum anyway, which is what keeps a
     * resize or a locale change from moving the sections below it.
     *
     * @param availableWidth - measured slot width in CSS pixels.
     * @returns the reserved height in CSS pixels.
     */
    function viewSlotHeight(availableWidth) {
      return Math.round(gridGeometry(availableWidth).height);
    }

    /**
     * Daily view: a GitHub-style contribution heatmap.
     *
     * The window length and the block size come from {@link gridGeometry}, so
     * this grid and the weekly bars are the same rectangle, column for column,
     * and always end today.
     */
    function Heatmap(props) {
      const t = props.t;
      const model = props.model;
      const metric = props.metric;
      const tip = useTip();
      // The panel measures the shared view slot once and hands the width down,
      // so both views work off exactly one measurement and one column grid.
      const availableWidth = typeof props.width === 'number' ? props.width : 0;
      const geometry = gridGeometry(availableWidth);

      const today = new Date();
      const todayKey = dayKeyOf(today);
      const weeks = geometry.weeks;
      const thisMonday = addDays(today, -mondayIndex(today));
      const gridStart = addDays(thisMonday, -7 * (weeks - 1));
      const columns = [];
      let cursor = gridStart;
      while (cursor <= today) {
        const column = [];
        for (let i = 0; i < 7; i += 1) {
          const key = dayKeyOf(cursor);
          column.push({ key, future: cursor > today });
          cursor = addDays(cursor, 1);
        }
        columns.push(column);
      }
      const values = [];
      for (const column of columns) {
        for (const cell of column) {
          if (cell.future) continue;
          const value = dayValue(model.byDay.get(cell.key), metric);
          if (value > 0) values.push(value);
        }
      }
      // The ramp is anchored on the busiest day in view, so the whole colour
      // range is used whatever the absolute magnitude happens to be.
      const highest = values.length === 0 ? 0 : Math.max.apply(null, values);
      // One label cell per grid column, so the month row shares the columns'
      // exact layout. A span-sized label drifted left by one gap per boundary
      // because it covered `span` columns but only one gap.
      const monthCells = [];
      let lastMonth = -1;
      for (let c = 0; c < columns.length; c += 1) {
        const month = parseDay(columns[c][0].key).getMonth();
        monthCells.push(month === lastMonth ? '' : t('months')[month]);
        lastMonth = month;
      }
      const monthRow = monthCells.map((label, i) => h('span', { key: i, className: 'dts-heat-month' }, label));
      const weekdayLabels = t('weekdays').map((label, i) => h('span', { key: i }, label));
      // The block is given an explicit width instead of filling the card: past
      // the cell cap that is what keeps the squares from becoming slabs, and the
      // weekly view uses the same width so the two stay column-aligned.
      return chartShell(tip, h('div', { className: 'dts-heat-center' },
        h('div', { className: 'dts-heat', style: { width: geometry.gridWidth + 'px' } },
          h('div', { className: 'dts-heat-months' },
            h('span', { className: 'dts-heat-gutter' }),
            monthRow),
          h('div', { className: 'dts-heat-grid' },
            h('div', { className: 'dts-heat-weekdays' }, weekdayLabels),
            columns.map((column, ci) => h('div', { key: ci, className: 'dts-heat-col' },
              column.map((cell) => {
                const value = cell.future ? 0 : dayValue(model.byDay.get(cell.key), metric);
                const depth = cell.future ? 0 : intensityOf(value, highest);
                return h('div', {
                  key: cell.key,
                  className: 'dts-cell' + (depth > 0 ? ' dts-cell-on' : ''),
                  'data-future': cell.future ? '1' : '0',
                  // Depth is continuous, so a day several times busier reads as a
                  // visibly darker block instead of landing in the same step.
                  style: depth > 0 ? { opacity: depth.toFixed(3) } : undefined,
                  onMouseEnter: cell.future
                    ? undefined
                    : (event) => tip.show(event, [cell.key, [0, t('tokens'), formatUnits(value, t)]]),
                });
              })))))), t('heatmapTitle'));
    }

    /**
     * Weekly view: one bar per week.
     *
     * Same window, same column pitch, same width and same height as the daily
     * grid (see {@link gridGeometry}), and the viewBox is expressed in CSS pixels
     * at a 1:1 scale, so week i sits exactly under heatmap column i. The previous
     * version hard-coded 53 weeks while the grid was adaptive, which both
     * misaligned the two views and squeezed every bar to ~10px.
     */
    function WeeklyBars(props) {
      const t = props.t;
      const model = props.model;
      const metric = props.metric;
      const tip = useTip();
      const measured = typeof props.width === 'number' ? props.width : 0;
      const geometry = gridGeometry(measured);
      const weekCount = geometry.weeks;
      const today = new Date();
      const thisMonday = addDays(today, -mondayIndex(today));
      const weeks = [];
      for (let w = weekCount - 1; w >= 0; w -= 1) {
        const start = addDays(thisMonday, -7 * w);
        const keys = [];
        for (let i = 0; i < 7; i += 1) {
          const day = addDays(start, i);
          if (day <= today) keys.push(dayKeyOf(day));
        }
        weeks.push({ start, keys, value: sumDays(model, keys, metric) });
      }
      const max = weeks.reduce((a, w) => Math.max(a, w.value), 0);
      const width = geometry.gridWidth;
      const height = geometry.height;
      // Column i sits where the heatmap's column i sits, at the same pitch: the
      // grid is `gutter | column × weeks` with a gap between every pair, so the
      // first column starts one gap after the gutter. The bar is inset inside its
      // column — narrower than a day square — so consecutive weeks read as
      // separate bars rather than one continuous band.
      const colLeft = (i) => geometry.gutter + geometry.gap + i * geometry.pitch;
      const barWidth = geometry.barWidth;
      const barX = (i) => colLeft(i) + (geometry.cell - barWidth) / 2;
      // The bars occupy the grid's own band: the same 16px header above them,
      // and a date strip of the same height as the month labels below.
      const top = HEAT_HEADER + 12;
      const bottom = height - HEAT_HEADER + 4;
      const plotHeight = bottom - top;
      const y = (value) => bottom - (max === 0 ? 0 : (value / max) * plotHeight);
      return chartShell(tip, h('div', { className: 'dts-heat-center' },
        h('svg', {
          className: 'dts-chart',
          // The block's own width, at a 1:1 scale, and never shrunk by the flex
          // row it sits in: a scaled SVG is exactly how the two views drifted
          // apart before. Until a width has been measured it stretches to the
          // card instead, so the bars stay on screen rather than being drawn
          // past the edge of a narrower dialog.
          style: { width: measured > 0 ? width + 'px' : '100%', flex: 'none' },
          viewBox: '0 0 ' + width + ' ' + height,
          role: 'img',
        },
        h('line', { className: 'dts-grid', x1: colLeft(0), y1: bottom, x2: colLeft(weeks.length - 1) + geometry.cell, y2: bottom }),
        // The scale reference sits above the plot rather than in a left gutter,
        // because a left gutter would break the alignment with the daily grid.
        h('text', { className: 'dts-axis', x: colLeft(0), y: 10 }, formatUnits(max, t)),
        // Every week gets a full-height hit target as well as its bar, so a week
        // with no usage is still hoverable and reports an explicit zero instead
        // of being an unclickable gap.
        weeks.map((week, i) => {
          const rectY = y(week.value);
          return h('g', { key: i },
            h('rect', {
              className: 'dts-week-bar dts-c0',
              x: barX(i),
              y: rectY,
              width: barWidth,
              height: Math.max(week.value > 0 ? 1 : 0, bottom - rectY),
              rx: 2,
            }),
            h('rect', {
              x: colLeft(i) - geometry.gap / 2,
              y: top,
              width: geometry.cell + geometry.gap,
              height: plotHeight,
              fill: 'transparent',
              onMouseEnter: (event) => tip.show(event, [
                dayKeyOf(week.start) + ' \u2192 ' + dayKeyOf(addDays(week.start, 6)),
                [0, t('tokens'), formatUnits(week.value, t)],
              ]),
            }));
        }),
        axisTicks({
          indices: tickIndices(weeks.length, 5),
          xOf: (i) => colLeft(i) + geometry.cell / 2,
          top,
          bottom,
          labelY: height - 4,
          width: width - geometry.gutter,
          label: (i) => dayKeyOf(weeks[i].start).slice(5),
        }))), t('weeklyTitle'));
    }

    /**
     * Bucketing granularity a range deserves.
     *
     * A wide range at daily resolution is an unreadable picket fence, and a
     * narrow range at monthly resolution is three points; the axes therefore
     * follow the range instead of a fixed rule.
     *
     * @param dayCount - number of calendar days in the range.
     * @returns `day` | `week` | `month` | `year`.
     */
    function granularityFor(dayCount) {
      if (dayCount <= 31) return 'day';
      if (dayCount <= 180) return 'week';
      if (dayCount <= 730) return 'month';
      return 'year';
    }

    /**
     * Group day keys into display buckets at the given granularity.
     *
     * Every calendar day of the range is represented, so an empty stretch still
     * occupies its real width on the axis rather than collapsing.
     *
     * @param days - every day key in the range, ascending.
     * @param granularity - `day` | `week` | `month` | `year`.
     * @returns `[{ key, label, keys }]`.
     */
    function bucketize(days, granularity) {
      if (granularity === 'day') return days.map((key) => ({ key, label: key, keys: [key] }));
      const buckets = new Map();
      for (const key of days) {
        let bucketKey;
        if (granularity === 'week') {
          const date = parseDay(key);
          bucketKey = dayKeyOf(addDays(date, -mondayIndex(date)));
        } else if (granularity === 'month') {
          bucketKey = key.slice(0, 7);
        } else {
          bucketKey = key.slice(0, 4);
        }
        const entry = buckets.get(bucketKey) === undefined ? { key: bucketKey, label: bucketKey, keys: [] } : buckets.get(bucketKey);
        entry.keys.push(key);
        buckets.set(bucketKey, entry);
      }
      return [...buckets.values()];
    }

    /**
     * Evenly spaced axis tick positions over `length` slots.
     * @param length - number of slots.
     * @param count - desired tick count.
     * @returns ascending slot indices, always including both ends.
     */
    function tickIndices(length, count) {
      if (length <= 0) return [];
      const wanted = Math.max(2, Math.min(count, length));
      const out = [];
      for (let i = 0; i < wanted; i += 1) out.push(Math.round((i / (wanted - 1)) * (length - 1)));
      return [...new Set(out)];
    }

    /** Axis label for one bucket at the active granularity. */
    function bucketLabel(label, granularity) {
      if (granularity === 'day') return label.slice(5);
      if (granularity === 'week') return label.slice(5);
      if (granularity === 'month') return label.slice(2);
      return label;
    }

    /** Axis tick marks plus labels, shared by every time-series chart. */
    function axisTicks(props) {
      return props.indices.map((index, i) => {
        const x = props.xOf(index);
        return h('g', { key: 'tick' + i },
          h('line', { className: 'dts-tick', x1: x, y1: props.top, x2: x, y2: props.bottom }),
          h('text', {
            className: 'dts-axis',
            x: Math.min(props.width - 4, Math.max(4, x)),
            y: props.labelY,
            textAnchor: i === 0 ? 'start' : i === props.indices.length - 1 ? 'end' : 'middle',
          }, props.label(index)));
      });
    }

    /**
     * Trend view: one smooth line per model.
     *
     * Lines only — comparing models across time is what this chart is for, and a
     * shape toggle asked the reader to choose a question before answering it.
     * The granularity follows the range, and empty buckets still carry a muted
     * marker so the axis reads as continuous instead of skipping gaps.
     */
    function TrendChart(props) {
      const t = props.t;
      const model = props.model;
      const metric = props.metric;
      const days = props.days;
      const tip = useTip();
      const indices = model.models.map((m, i) => i);
      const width = 720;
      const height = 210;
      const padLeft = 44;
      const padBottom = 22;
      const plotWidth = width - padLeft - 4;
      const plotHeight = height - padBottom - 22;
      const baseline = 4 + plotHeight;

      const granularity = granularityFor(days.length);
      const buckets = bucketize(days, granularity).map((bucket) => {
        const parts = indices.map((index) => sumDays(model, bucket.keys, metric, index));
        return { key: bucket.key, label: bucket.label, parts, total: parts.reduce((a, b) => a + b, 0) };
      });
      if (buckets.length === 0) return h('div', { className: 'dts-status' }, t('noData'));
      const max = buckets.reduce((a, b) => Math.max(a, b.total === 0 ? 0 : Math.max.apply(null, b.parts)), 0);
      const scale = (value) => (max === 0 ? 0 : (value / max) * plotHeight);
      const step = plotWidth / Math.max(1, buckets.length);
      const xOfSlot = (i) => padLeft + i * step;
      const centreOf = (i) => xOfSlot(i) + step / 2;
      const seriesTotal = indices.map((index) => sumDays(model, days, metric, index));

      // One hover target per x, listing every series: naming only one model would
      // be strictly less useful than the chart itself.
      const tooltipFor = (bucket) => {
        const out = [bucket.label + ' · ' + formatUnits(bucket.total, t) + ' ' + t('tokens')];
        for (let s = 0; s < indices.length; s += 1) {
          if (bucket.parts[s] > 0) out.push([indices[s], modelLabel(model.models[indices[s]], t), formatUnits(bucket.parts[s], t)]);
        }
        return out;
      };

      const shapes = [];
      for (let s = 0; s < indices.length; s += 1) {
        if (seriesTotal[s] <= 0) continue;
        const points = buckets.map((bucket, i) => [centreOf(i), baseline - scale(bucket.parts[s])]);
        shapes.push(h('path', { key: 'line' + s, className: 'dts-line ' + colorClass(indices[s]), d: smoothPath(points) }));
        if (points.length <= 62 && points.length > 1) {
          for (let i = 0; i < points.length; i += 1) {
            const empty = buckets[i].parts[s] <= 0;
            // An empty bucket keeps a hollow, muted marker: the point is still
            // there on the axis, it just is not emphasised.
            shapes.push(h('circle', {
              key: 'dot' + s + ':' + i,
              className: empty ? 'dts-dot-empty' : 'dts-dot ' + colorClass(indices[s]),
              cx: points[i][0],
              cy: points[i][1],
              r: empty ? 1.7 : 2.3,
            }));
          }
        }
      }
      for (let i = 0; i < buckets.length; i += 1) {
        shapes.push(h('rect', {
          key: 'hit' + i,
          x: xOfSlot(i),
          y: 4,
          width: Math.max(step, 1),
          height: plotHeight,
          fill: 'transparent',
          onMouseEnter: (event) => tip.show(event, tooltipFor(buckets[i])),
        }));
      }

      const ticks = axisTicks({
        indices: tickIndices(buckets.length, 6),
        xOf: centreOf,
        top: 4,
        bottom: baseline,
        labelY: height - 6,
        width,
        label: (i) => bucketLabel(buckets[i].label, granularity),
      });
      return chartShell(tip, h('svg', { className: 'dts-chart', viewBox: '0 0 ' + width + ' ' + height, role: 'img' },
        h('line', { className: 'dts-grid', x1: padLeft, y1: baseline, x2: width - 4, y2: baseline }),
        h('text', { className: 'dts-axis', x: 0, y: 10 }, formatUnits(max, t)),
        h('text', { className: 'dts-axis', x: 0, y: baseline }, '0'),
        shapes,
        ticks), t('trendTitle'));
    }

    /**
     * Ring path between two angles: outer arc out, inner arc back.
     * @param cx - centre x.
     * @param cy - centre y.
     * @param outer - outer radius.
     * @param inner - inner radius.
     * @param start - start angle in radians.
     * @param end - end angle in radians.
     * @returns the path, or null when the span is a full circle.
     */
    function ringPath(cx, cy, outer, inner, start, end) {
      if (end - start >= Math.PI * 2 - 1e-6) return null;
      const large = end - start > Math.PI ? 1 : 0;
      const x1 = cx + outer * Math.cos(start);
      const y1 = cy + outer * Math.sin(start);
      const x2 = cx + outer * Math.cos(end);
      const y2 = cy + outer * Math.sin(end);
      const x3 = cx + inner * Math.cos(end);
      const y3 = cy + inner * Math.sin(end);
      const x4 = cx + inner * Math.cos(start);
      const y4 = cy + inner * Math.sin(start);
      return 'M ' + x1.toFixed(2) + ' ' + y1.toFixed(2)
        + ' A ' + outer + ' ' + outer + ' 0 ' + large + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2)
        + ' L ' + x3.toFixed(2) + ' ' + y3.toFixed(2)
        + ' A ' + inner + ' ' + inner + ' 0 ' + large + ' 0 ' + x4.toFixed(2) + ' ' + y4.toFixed(2)
        + ' Z';
    }

    /**
     * Share view: a ring chart plus a legend that names every slice.
     *
     * A ring rather than a solid pie: the hole gives the total a place to live,
     * keeps the eye on the arcs instead of a centroid, and survives narrow
     * slices (a 1% sliver of a pie is an unreadable spike at the centre).
     */
    function DonutChart(props) {
      const t = props.t;
      const model = props.model;
      const metric = props.metric;
      const days = props.days;
      const tip = useTip();
      const totals = model.models.map((entry, index) => ({ index, entry, value: sumDays(model, days, metric, index) }))
        .filter((slice) => slice.value > 0)
        .sort((a, b) => b.value - a.value);
      const sum = totals.reduce((a, slice) => a + slice.value, 0);
      if (sum <= 0) return h('div', { className: 'dts-status' }, t('noData'));
      const size = 196;
      const outer = 80;
      const inner = 52;
      const center = size / 2;
      const [hovered, setHovered] = React.useState(-1);
      // A small angular gap on both sides of every boundary. The previous
      // version instead displaced every slice along its mid-angle at rest, which
      // is what made the ring look randomly misaligned.
      const gap = 0.016;
      let angle = -Math.PI / 2;
      const slices = totals.map((slice) => {
        const sweep = (slice.value / sum) * Math.PI * 2;
        const start = angle;
        angle += sweep;
        const inset = Math.min(gap, sweep * 0.18);
        return {
          slice,
          share: slice.value / sum,
          path: ringPath(center, center, outer, inner, start + inset, angle - inset),
          mid: start + sweep / 2,
        };
      });
      const lines = (entry) => [
        modelLabel(entry.slice.entry, t) + ' · ' + (entry.share * 100).toFixed(1) + '%',
        [entry.slice.index, t('tokens'), formatUnits(entry.slice.value, t)],
      ];
      const hover = (event, entry) => {
        setHovered(entry.slice.index);
        tip.show(event, lines(entry));
      };
      return h('div', { className: 'dts-pie-wrap' },
        h('div', {
          className: 'dts-chart-wrap',
          ref: tip.wrap,
          style: { width: size + 'px', flex: 'none' },
          onMouseLeave: () => { setHovered(-1); tip.hide(); },
        },
          h('svg', {
            className: 'dts-chart',
            viewBox: '0 0 ' + size + ' ' + size,
            style: { width: size + 'px' },
            role: 'img',
          },
            h('defs', {},
              h('filter', { id: 'dts-donut-shadow', x: '-25%', y: '-25%', width: '150%', height: '150%' },
                h('feDropShadow', { dx: 0, dy: 2, stdDeviation: 3, className: 'dts-donut-shadow-node' }))),
            h('g', { filter: 'url(#dts-donut-shadow)' },
              slices.map((entry) => (entry.path === null
                ? h('circle', {
                  key: entry.slice.index,
                  className: 'dts-donut-slice ' + colorClass(entry.slice.index),
                  cx: center,
                  cy: center,
                  r: (outer + inner) / 2,
                  fill: 'none',
                  strokeWidth: outer - inner,
                  onMouseEnter: (event) => hover(event, entry),
                })
                : h('path', {
                  key: entry.slice.index,
                  className: 'dts-donut-slice ' + colorClass(entry.slice.index),
                  d: entry.path,
                  // Only the hovered slice lifts away from the centre, so the
                  // resting ring stays perfectly concentric.
                  style: { transition: 'transform .16s' },
                  transform: hovered === entry.slice.index
                    ? 'translate(' + (Math.cos(entry.mid) * 3).toFixed(2) + ' ' + (Math.sin(entry.mid) * 3).toFixed(2) + ')'
                    : undefined,
                  onMouseEnter: (event) => hover(event, entry),
                })))),
            h('text', { className: 'dts-donut-total', x: center, y: center, textAnchor: 'middle', dominantBaseline: 'middle' }, formatUnits(sum, t)),
            h('text', { className: 'dts-donut-total-label', x: center, y: center + 16, textAnchor: 'middle' }, t('donutTotal'))),
          renderTip(tip.tip)),
        h('div', { className: 'dts-legend' },
          slices.map((entry) => h('div', { key: entry.slice.index, className: 'dts-legend-row' },
            h('span', { className: 'dts-swatch ' + colorClass(entry.slice.index) }),
            h('span', { className: 'dts-legend-name', title: modelLabel(entry.slice.entry, t) }, modelLabel(entry.slice.entry, t)),
            h('span', { className: 'dts-legend-value', title: formatFull(entry.slice.value) },
              formatUnits(entry.slice.value, t) + ' · ' + (entry.share * 100).toFixed(1) + '%')))));
    }

    /**
     * Last payload successfully fetched in this page session.
     *
     * The settings dialog unmounts its section when the user leaves Settings, so
     * without this every re-entry showed a full-panel "reading session logs…"
     * state even though the numbers had just been computed. Holding the last
     * answer at module scope lets a remount paint immediately and revalidate
     * behind it, which is what removes the perceived wait.
     */
    let panelCache = null;

    /**
     * Follow-up schedule for one scan that is still running.
     *
     * A rescan is not a fixed cost: the first one after a boot reads every
     * session log, and the live session alone cost ~4.9s a scan before it stopped
     * being read twice. The host never makes a request wait for a scan now, so
     * this schedule is what turns its `stale` / `scanning` flags back into the
     * truth on screen: a follow-up that arrives while the scan is running joins
     * it and answers from the cache.
     *
     * The two cases get different budgets, because they mean different things:
     *
     * - `scanning` is reported by the host: one poll every 1.5s, bounded by a
     *   two-minute ceiling that covers a cold scan of a large history.
     * - a stale answer with nothing running behind it is a host between scans, so
     *   the original fast 0.7s start over twelve attempts is kept.
     */
    const STALE_RETRY_MS = 700;

    /** Ceiling for the wait between follow-ups while no scan is reported. */
    const STALE_RETRY_MAX_MS = 2500;

    /** How many follow-ups one stale answer may queue while no scan is running. */
    const STALE_MAX_TRIES = 12;

    /** Wait between follow-ups while the host reports a scan in flight. */
    const SCAN_RETRY_MS = 1500;

    /** How many times one running scan may be asked about. */
    const SCAN_MAX_TRIES = 80;

    /**
     * Wait before the `tries`-th follow-up.
     * @param tries - how many follow-ups have already been queued (0-based).
     * @param scanning - whether the host reported a scan in flight.
     * @returns the delay in milliseconds.
     */
    function staleRetryDelay(tries, scanning) {
      if (scanning === true) return SCAN_RETRY_MS;
      return Math.min(STALE_RETRY_MAX_MS, STALE_RETRY_MS * (tries + 1));
    }

    /**
     * Decide whether one host answer still needs a follow-up.
     *
     * The host tags an answer that is not the output of the latest completed scan
     * (`stale`) and one that arrives while it is scanning (`scanning`); both mean
     * the numbers on screen are about to change, so both are followed up. The
     * retries stay bounded, so a host that never finishes a scan cannot turn this
     * into an endless poll — the explicit refresh button remains.
     *
     * @param value - the value the host returned, or a failure envelope.
     * @param tries - how many follow-ups have already been queued.
     * @returns true when another request is due.
     */
    function staleFollowUp(value, tries) {
      if (value === null || typeof value !== 'object') return false;
      const scanning = value.scanning === true;
      if (value.stale !== true && !scanning) return false;
      return tries < (scanning ? SCAN_MAX_TRIES : STALE_MAX_TRIES);
    }

    /**
     * Build the panel component.
     * @param ctx - client Cordis context.
     * @param seams - `translate`, `subscribeLocale`.
     * @returns the component registered into `settings.section`.
     */
    function createPanel(ctx, seams) {
      const t = seams.translate;

      return function Panel() {
        const [state, setState] = React.useState(panelCache === null
          ? { phase: 'loading', payload: null, error: '' }
          : { phase: 'ready', payload: panelCache, error: '' });
        const [busy, setBusy] = React.useState(false);
        const [refreshing, setRefreshing] = React.useState(false);
        const [metric, setMetric] = React.useState('all');
        const [view, setView] = React.useState('daily');
        const [preset, setPreset] = React.useState('30');
        const [, setTick] = React.useState(0);
        const [viewWidth, setViewWidth] = React.useState(lastMeasuredWidth);
        const slotNode = React.useRef(null);
        const alive = React.useRef(true);
        const timer = React.useRef(null);

        React.useEffect(() => {
          const off = seams.subscribeLocale(() => setTick((n) => n + 1));
          return () => { if (typeof off === 'function') off(); };
        }, []);

        /**
         * Measure the slot that both day-scale views are laid out in.
         *
         * This cannot be a plain effect: on a cold open the panel first renders
         * the loading state, so the slot element does not exist yet, and an
         * effect with no dependencies runs while the ref is still null and never
         * runs again. The panel then kept the 820px fallback geometry inside a
         * 530px dialog — 18px squares, a slot reserving 247px for a 162px grid,
         * and a weekly chart drawn off the right edge of the card. A callback ref
         * measures at the commit that actually attaches the element, whenever
         * that happens, and an effect keyed on the answer re-arms the observer.
         */
        const measureSlot = (element) => {
          measureWidth(element, setViewWidth);
        };

        // The slot's ref: React runs it at the commit that attaches the element,
        // so the width is known before the frame that shows the grid.
        const attachSlot = (element) => {
          slotNode.current = element;
          if (element !== null && element !== undefined) measureSlot(element);
        };

        // Re-arms when the dashboard replaces the loading state, which is when
        // the slot first exists.
        const showDashboard = state.payload !== null;
        React.useEffect(() => {
          measureSlot(slotNode.current);
          const element = slotNode.current;
          if (element === null || element === undefined) return undefined;
          if (typeof ResizeObserver === 'function') {
            const observer = new ResizeObserver(() => measureSlot(slotNode.current));
            observer.observe(element);
            return () => observer.disconnect();
          }
          if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            const onResize = () => measureSlot(slotNode.current);
            window.addEventListener('resize', onResize);
            return () => window.removeEventListener('resize', onResize);
          }
          return undefined;
        }, [showDashboard]);

        // A background revalidation must not outlive the panel: the settings
        // dialog unmounts it on close, and a late answer would set state on a
        // gone component.
        React.useEffect(() => () => {
          alive.current = false;
          if (timer.current !== null && typeof clearTimeout === 'function') clearTimeout(timer.current);
        }, []);

        /**
         * Ask the host for one aggregate.
         *
         * The host answers immediately from what it already has and rescans
         * behind the response — for an explicit refresh too — so a `stale` or
         * `scanning` answer is followed up until the numbers on screen are the
         * scan's own output. The already-painted figures stay on screen while
         * that happens; only the first ever load shows the loading state.
         *
         * @param force - ask for a rescan instead of whatever the host has.
         * @param attempt - how many follow-ups this load has already queued.
         */
        const load = (force, attempt) => {
          const tries = typeof attempt === 'number' ? attempt : 0;
          if (force) setBusy(true);
          return hostCall(force ? 'refresh' : 'summary', {}).then((result) => {
            if (alive.current === false) return;
            if (force) setBusy(false);
            if (result && result.ok === false) {
              setRefreshing(false);
              setState((prev) => ({ phase: prev.payload === null ? 'error' : 'ready', payload: prev.payload, error: result.error }));
              return;
            }
            if (result && Array.isArray(result.days)) {
              panelCache = result;
              setState({ phase: 'ready', payload: result, error: '' });
              if (staleFollowUp(result, tries)) {
                setRefreshing(true);
                timer.current = setTimeout(() => load(false, tries + 1), staleRetryDelay(tries, result.scanning === true));
                return;
              }
              setRefreshing(false);
              return;
            }
            setRefreshing(false);
            setState((prev) => ({ phase: prev.payload === null ? 'error' : 'ready', payload: prev.payload, error: 'unexpected payload' }));
          });
        };

        React.useEffect(() => { load(false); }, []);

        const payload = state.payload;
        const model = payload === null ? null : prepare(payload);
        // Cache writes are a real part of the platform's TokenUsage contract, but
        // a provider that does not bill them simply never reports the bucket — on
        // this deployment every sample has cacheWriteTokens absent, i.e. zero. An
        // always-zero choice is noise, so it appears only once some usage exists.
        const cacheWriteUsed = payload !== null && Array.isArray(payload.days)
          && payload.days.some((day) => Array.isArray(day.b) && day.b[3] > 0);

        React.useEffect(() => {
          if (!cacheWriteUsed && metric === 'cacheWrite') setMetric('all');
        }, [cacheWriteUsed]);

        const metricOptions = [
          { value: 'all', label: t('metricAll') },
          { value: 'total', label: t('metricTotal') },
          { value: 'input', label: t('metricInput') },
          { value: 'output', label: t('metricOutput') },
          { value: 'cacheRead', label: t('metricCacheRead') },
        ];
        if (cacheWriteUsed) metricOptions.push({ value: 'cacheWrite', label: t('metricCacheWrite') });
        const viewOptions = [
          { value: 'daily', label: t('viewDaily') },
          { value: 'weekly', label: t('viewWeekly') },
        ];
        const rangeOptions = [
          { value: '7', label: t('range7') },
          { value: '30', label: t('range30') },
          { value: '90', label: t('range90') },
          { value: 'year', label: t('rangeYear') },
          { value: 'all', label: t('rangeAll') },
        ];

        let body = null;
        if (model !== null) {
          const peak = peakDay(model, metric);
          let lifetime = 0;
          for (const day of model.days) lifetime += dayValue(model.byDay.get(day.d), metric);
          const range = presetRange(preset, model);
          const rangeDays = eachDay(range.from, range.to);
          const rangeTotal = sumDays(model, rangeDays, metric);
          // Four more figures that are cheap to derive and actually answer
          // questions the first four do not: where today stands, how the current
          // week is going, the typical day, and how much of the total is served
          // from cache. Cost estimates were deliberately left out — the platform
          // exposes no token pricing, so any number here would be invented.
          const today = dayKeyOf(new Date());
          const todayValue = dayValue(model.byDay.get(today), metric);
          const weekDays = eachDay(dayKeyOf(addDays(new Date(), -6)), today);
          const weekValue = sumDays(model, weekDays, metric);
          const dailyAverage = model.activeDays > 0 ? lifetime / model.activeDays : 0;
          let allTokens = 0;
          let cacheReadTokens = 0;
          for (const day of model.days) {
            allTokens += day.b[0] + day.b[1] + day.b[2] + day.b[3];
            cacheReadTokens += day.b[2];
          }
          const cacheShare = allTokens > 0 ? (cacheReadTokens / allTokens) * 100 : 0;
          const granularityLabel = {
            day: t('granularityDay'), week: t('granularityWeek'), month: t('granularityMonth'), year: t('granularityYear'),
          }[granularityFor(rangeDays.length)];
          const failed = payload.scope && Array.isArray(payload.scope.failedSessions) ? payload.scope.failedSessions : [];

          body = h('div', { className: 'dts-body' },
            state.error === '' ? null : h('div', { className: 'dts-error' }, state.error),
            h('div', { className: 'dts-cards' },
              h(Card, { label: t('statLifetime'), value: formatUnits(lifetime, t), title: formatFull(lifetime) + ' ' + t('tokens') }),
              h(Card, {
                label: t('statPeak'),
                value: peak === null ? '0' : formatUnits(peak.value, t),
                title: peak === null ? '' : formatFull(peak.value) + ' ' + t('tokens'),
                sub: peak === null ? undefined : peak.day,
              }),
              h(Card, {
                label: t('statToday'),
                value: formatUnits(todayValue, t),
                title: formatFull(todayValue) + ' ' + t('tokens'),
                sub: today,
              }),
              h(Card, {
                label: t('statWeek'),
                value: formatUnits(weekValue, t),
                title: formatFull(weekValue) + ' ' + t('tokens'),
                sub: weekDays[0] + ' \u2192 ' + today,
              }),
              h(Card, {
                label: t('statDailyAvg'),
                value: formatUnits(dailyAverage, t),
                title: formatFull(Math.round(dailyAverage)) + ' ' + t('tokens'),
                sub: t('statDailyAvgBasis') + ' · ' + formatFull(model.activeDays),
              }),
              h(Card, {
                label: t('statCacheShare'),
                value: cacheShare.toFixed(1) + '%',
                title: formatUnits(cacheReadTokens, t),
                sub: t('statCacheShareBasis'),
              })),
            h('div', { className: 'dts-row' }, h(Segmented, { label: t('metric'), options: metricOptions, value: metric, onChange: setMetric })),
            h('div', { className: 'dts-section' },
              h('div', { className: 'dts-row' },
                h('span', { className: 'dts-section-title' }, view === 'daily' ? t('heatmapTitle') : t('weeklyTitle')),
                h('div', { style: { marginLeft: 'auto' } }, h(Segmented, { label: t('scale'), options: viewOptions, value: view, onChange: setView }))),
              // One slot for both day-scale views: it carries the single
              // measurement they share and reserves the taller view's height, so
              // switching cannot re-measure from zero or move what is below it.
              h('div', {
                className: 'dts-viewslot',
                ref: attachSlot,
                // Reserved only once a width has actually been measured: a
                // reservation computed from the fallback is what left dead space
                // under the grid on a cold open.
                style: viewWidth > 0 ? { minHeight: viewSlotHeight(viewWidth) + 'px' } : undefined,
              },
              view === 'daily'
                ? h(Heatmap, { t, model, metric, width: viewWidth })
                : h(WeeklyBars, { t, model, metric, width: viewWidth }))),
            // One section for everything model-scoped. The range control used to
            // sit inside the trend block while also driving the ring below it,
            // which made it ambiguous what it applied to; the shared header now
            // states the scope once.
            h('div', { className: 'dts-section' },
              h('div', { className: 'dts-row' },
                h('span', { className: 'dts-section-title' }, t('modelUsageTitle')),
                h('div', { style: { marginLeft: 'auto' } },
                  h(Segmented, { label: t('range'), options: rangeOptions, value: preset, onChange: setPreset }))),
              h('div', { className: 'dts-row' },
                h('span', { className: 'dts-updated' },
                  range.from + ' \u2192 ' + range.to + ' · ' + formatUnitsExact(rangeTotal, t) + ' ' + t('tokens')),
                h('span', { className: 'dts-updated', style: { marginLeft: 'auto' } },
                  t('granularityPrefix') + ': ' + granularityLabel)),
              h('div', { className: 'dts-subsection' },
                h('div', { className: 'dts-section-title' }, t('trendTitle')),
                h(TrendChart, { t, model, metric, days: rangeDays }),
                h('div', { className: 'dts-legend', style: { flexDirection: 'row', flexWrap: 'wrap' } },
                  model.models.map((entry, index) => (sumDays(model, rangeDays, metric, index) > 0
                    ? h('div', { key: entry.key, className: 'dts-legend-row' },
                      h('span', { className: 'dts-swatch ' + colorClass(index) }),
                      h('span', { className: 'dts-legend-name' }, modelLabel(entry, t)),
                      h('span', { className: 'dts-legend-value', title: formatFull(sumDays(model, rangeDays, metric, index)) },
                        formatUnits(sumDays(model, rangeDays, metric, index), t)))
                    : null)))),
              h('div', { className: 'dts-subsection' },
                h('div', { className: 'dts-section-title' }, t('pieTitle')),
                h(DonutChart, { t, model, metric, days: rangeDays }))),
            h('p', { className: 'dts-note' }, t(cacheWriteUsed ? 'metricNote' : 'metricNoteNoCacheWrite')),
            // The corpus itself, kept as a footnote rather than a headline: it
            // describes the data set, not the usage, and it is where a skipped
            // session has to stay visible because it shrinks every total.
            h('p', {
              className: 'dts-note',
              title: failed.length > 0
                ? failed.map((entry) => String(entry && entry.id) + ': ' + String(entry && entry.error)).join('\n')
                : undefined,
            }, [
              formatFull(payload.scope ? payload.scope.sessions : 0) + ' ' + t('statSessions'),
              failed.length > 0 ? String(failed.length) + ' ' + t('incomplete') : null,
              payload.scope && payload.scope.retired > 0 ? String(payload.scope.retired) + ' ' + t('retained') : null,
            ].filter(Boolean).join(' · ')),
            h('p', { className: 'dts-note' }, t('dailyNote')));
        } else {
          body = h('div', { className: 'dts-body' },
            state.phase === 'error'
              ? h('div', { className: 'dts-error' }, state.error === '' ? 'failed to load usage' : state.error)
              : h('div', { className: 'dts-status' }, t('loading')));
        }

        return h('div', { className: 'dts-root' },
          h('div', { className: 'dts-head' },
            h('div', { className: 'dts-head-title' }, t('title')),
            h('div', { className: 'dts-head-right' },
              payload === null ? null : h('span', { className: 'dts-updated' },
                t('updated') + ' ' + new Date(payload.generatedAt).toLocaleTimeString()),
              // Shown while the host reports a scan it has not answered from yet;
              // there is no loading state to look at, so this is the whole
              // indication that the numbers are catching up.
              refreshing ? h('span', { className: 'dts-updated dts-refreshing' }, t('refreshing')) : null,
              h('button', {
                type: 'button',
                className: 'dts-btn',
                disabled: busy || refreshing,
                onClick: () => load(true),
              }, busy || refreshing ? t('refreshing') : t('refresh')))),
          body);
      };
    }

    /** Required client services: the slot registry and the locale. */
    const inject = ['slots', 'locale'];

    /**
     * Client plugin body.
     * @param ctx - Client Cordis context.
     */
    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-token-stats';
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => { tag.remove(); };
      }, 'dsh-token-stats: panel stylesheet');

      // The settings dialog mounts when the user opens it and unmounts on
      // close, so the nav row has to be marked whenever it appears rather than
      // once at load.
      //
      // The mark has to land before the browser paints the freshly mounted
      // dialog, or the shell's gear fallback is on screen for a moment and then
      // swaps to the bar chart. A MutationObserver callback already runs as a
      // microtask at the end of React's commit — after the nodes are in the
      // DOM, before the frame is painted — so the scan happens right there,
      // with no timer in between. The cost of being that hot is bounded two
      // ways: the callback inspects only the nodes just added, and it returns
      // immediately while our marker is still mounted, which is the state a
      // streaming conversation mutates through.
      ctx.effect(() => {
        let row = markNavRowIn(document);
        if (typeof MutationObserver !== 'function' || !document.body) return () => {};

        const isMarked = () => row !== null && row.isConnected && row.hasAttribute(NAV_ATTR);

        let sweep = 0;
        const backstop = () => {
          if (sweep !== 0) return;
          sweep = setTimeout(() => {
            sweep = 0;
            if (isMarked()) return;
            row = markNavRowIn(document) || row;
          }, NAV_SWEEP_MS);
        };

        const observer = new MutationObserver((records) => {
          if (isMarked()) return;
          for (const record of records) {
            for (const node of record.addedNodes) {
              // A label written into an already-mounted row arrives as a text
              // node, so resolve the enclosing button before giving up on it.
              if (node.nodeType === 3) {
                const owner = enclosingButton(node);
                if (owner !== null && markNavButton(owner) !== null) { row = owner; return; }
                continue;
              }
              if (node.nodeType !== 1) continue;
              const hit = markNavRowIn(node);
              if (hit !== null) { row = hit; return; }
            }
          }
          backstop();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => {
          observer.disconnect();
          if (sweep !== 0) clearTimeout(sweep);
        };
      }, 'dsh-token-stats: settings nav glyph');

      const locale = ctx.locale;
      const pickDict = (id) => (/^zh/i.test(String(id || '')) ? ZH : EN);
      const activeId = () => {
        try {
          const snapshot = locale.getSnapshot();
          return String((snapshot && snapshot.active) || '');
        } catch (e) { return ''; }
      };

      let bound = null;
      try {
        let ids = [];
        try {
          const snapshot = locale.getSnapshot();
          ids = Array.isArray(snapshot && snapshot.locales) ? snapshot.locales.map((d) => String(d.id)) : [];
        } catch (e) { /* fall back to the known pair */ }
        if (ids.length === 0) ids = ['en', 'zh'];
        for (const id of ids) {
          const off = locale.register(NS, id, pickDict(id));
          // The dictionary registration outlives the row, so tie it to the fiber.
          if (typeof off === 'function') ctx.effect(() => off);
        }
        bound = typeof locale.bind === 'function' ? locale.bind(NS) : null;
      } catch (e) { bound = null; }

      const translate = (key) => {
        if (bound !== null) {
          try {
            const value = bound(key);
            if (typeof value === 'string' && value !== key && value.length > 0) return value;
          } catch (e) { /* fall through to the literal dictionary */ }
        }
        const dict = pickDict(activeId());
        return dict[key] || EN[key] || key;
      };

      // The panel owns this subscription: the effect that creates it also
      // disposes it, so a remount cannot accumulate listeners.
      const subscribeLocale = (fn) => {
        try {
          return locale.subscribe(fn);
        } catch (e) { return undefined; }
      };

      const Panel = createPanel(ctx, { translate, subscribeLocale });
      ctx.slots.inject('settings.section', () => ctx.slots.register(
        { name: 'settings.section', id: 'token-stats', order: 40, label: () => translate('title') },
        Panel,
      ));
    }

    /**
     * One call into the host route.
     *
     * The route answers a JSON envelope and is same-origin, so the browser
     * attaches the platform's login cookie automatically. Transport faults and
     * failure envelopes are folded into the single `{ok:…}` shape the panel
     * speaks, so no caller has to tell them apart.
     *
     * @param method - endpoint name, matching a host-core method.
     * @param args - JSON payload.
     * @returns `{ok: true, …}` or `{ok: false, error}`.
     */
    function hostCall(method, args) {
      let pending;
      try {
        pending = fetch(CHANNEL + '/' + method, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(args || {}),
        });
      } catch (e) {
        return Promise.resolve({ ok: false, error: String(e && e.message ? e.message : e) });
      }
      return Promise.resolve(pending).then(
        (res) =>
          res.json().then(
            (envelope) => {
              if (envelope && envelope.ok) return envelope.value;
              const message = envelope && envelope.error
                ? (envelope.error.message || envelope.error.code || 'host call failed')
                : 'HTTP ' + res.status;
              return { ok: false, error: String(message) };
            },
            () => ({ ok: false, error: 'HTTP ' + res.status + ' with a non-JSON body' }),
          ),
        (e) => ({ ok: false, error: String(e && e.message ? e.message : e) }),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.__test = {
      CSS,
      EN,
      ZH,
      NS,
      NAV_ATTR,
      CHANNEL,
      markNavButton,
      markNavRowIn,
      enclosingButton,
      formatFull,
      formatUnits,
      formatUnitsExact,
      metricOf,
      dayKeyOf,
      parseDay,
      eachDay,
      prepare,
      presetRange,
      intensityOf,
      ringPath,
      smoothPath,
      granularityFor,
      bucketize,
      tickIndices,
      heatmapWeeks,
      gridGeometry,
      viewSlotHeight,
      staleFollowUp,
      staleRetryDelay,
      STALE_MAX_TRIES,
      SCAN_MAX_TRIES,
      SCAN_RETRY_MS,
      modelLabel,
      colorClass,
      components: { Segmented, Card, Heatmap, WeeklyBars, TrendChart, DonutChart },
      createPanel,
      seedPayload: (value) => { panelCache = value; },
      // The shim never runs effects, so a measured width cannot be produced by
      // rendering. Seeding it is how a test proves a remount starts from the
      // last real width instead of from zero.
      seedMeasuredWidth: (value) => { lastMeasuredWidth = typeof value === 'number' ? value : 0; },
      measuredWidth: () => lastMeasuredWidth,
    };
    return module.exports;
    })();

    // ── web search switch ──
    // Its own closure: the features declare locals under the same names, so
    // nothing may leak between them.
    var WEBSEARCH_TOGGLE = (function () {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    /** Route prefix owned by the host half; must match lib/index.js. */
    const CHANNEL = '/websearch-toggle';

    /** Locale namespace for this plugin's dictionary. */
    const NS = 'dsh-websearch-toggle';

    /** Marker on the card we patched, so both the CSS and the observer can find it. */
    const CARD_ATTR = 'data-dshwst-card';

    /** Marker on a card whose switch is OFF; every grey rule hangs off it. */
    const OFF_ATTR = 'data-dshwst-off';

    /** Marker on the row we injected. */
    const ROW_ATTR = 'data-dshwst-row';

    /**
     * Backstop delay for re-checking the whole document.
     *
     * The row is normally injected synchronously from the very mutation that
     * inserted the card body (see the observer in `apply`), which is what keeps
     * the switch from appearing one frame late. This timer only covers a card
     * that somehow arrives outside the subtree a mutation showed us, so it can
     * afford to be slow.
     */
    const SWEEP_MS = 400;

    /**
     * The shipped card's own title, in every shipped locale.
     *
     * The nav row and this card both carry no id on their rendered nodes, so the
     * label text is the only stable handle. Matching both spellings keeps the
     * switch mounted across a language switch instead of dropping it.
     */
    const CARD_TITLES = ['网页搜索', 'Web search'];

    /** Everything this row can say, in both locales. */
    const EN = {
      toggle: 'Enable web search',
      on: 'Agents may search the web with the DeepSeek search provider. Every search is a billed model request.',
      off: 'Agents get no web_search tool and nothing is sent to the search provider. The endpoint and key below are kept but ignored.',
      unknown: 'Reading the saved switch position…',
    };

    /** Simplified Chinese copy. */
    const ZH = {
      toggle: '启用网页搜索',
      on: 'Agent 可以调用 DeepSeek 搜索提供方联网搜索；每次搜索都是一次计费的模型请求。',
      off: 'Agent 不会获得 web_search 工具，也不会有任何请求发往搜索提供方；下方的接口地址与密钥会保留但不再生效。',
      unknown: '正在读取已保存的开关状态…',
    };

    /**
     * The row's stylesheet.
     *
     * Sizes and colours are copied from the shell's own controls rather than
     * invented: the toggle is the shell's `Switch` (36x20 track, 16px thumb,
     * `translate(16px)` when checked) and the row uses the same 12px vertical
     * rhythm and `.5px` divider the plugin cards' fields use, so it reads as one
     * more field of the card it was injected into. No literal colour: both
     * themes follow the alias tokens for free.
     *
     * The `li[data-dshwst-off]` rules are the "greyed out" state. They target
     * the card's own children with `:not([data-dshwst-row])` so the switch stays
     * legible and operable while everything it governs is dimmed and inert.
     */
    const CSS = [
      '.dshwst-row{display:flex;flex-direction:column;gap:6px;padding:12px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}',
      '.dshwst-toggleRow{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}',
      '.dshwst-toggleLabel{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5}',
      '.dshwst-hint{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}',
      '.dshwst-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5}',
      '.dshwst-switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:10px;background:var(--dsw-alias-border-l3);cursor:pointer;transition:background .16s}',
      '.dshwst-switch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}',
      '.dshwst-switch:disabled{cursor:default;opacity:.5}',
      '.dshwst-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.dshwst-thumb{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground);transition:transform .12s ease}',
      '.dshwst-switch[aria-checked=true] .dshwst-thumb{transform:translate(16px)}',
      'li[data-dshwst-off] > button[aria-expanded]{opacity:.6;transition:opacity .16s}',
      'li[data-dshwst-off] > div > :not([data-dshwst-row]){opacity:.45;transition:opacity .16s}',
      'li[data-dshwst-off] > div > :not([data-dshwst-row]) input,li[data-dshwst-off] > div > :not([data-dshwst-row]) button{pointer-events:none}',
    ].join('');

    // ── the shipped card's shape ────────────────────────────────────────────
    //
    // PluginCard renders:
    //   <li class=…card>                     <- the card; we mark this
    //     <button aria-expanded=…>           <- header, always present
    //       <span><span>title</span><span>description</span></span>
    //     <div class=…body>                  <- ONLY while expanded
    //       …fields… <div class=…footer>…</div>
    //
    // Class names are content-hashed by the shell's CSS modules and change
    // between releases, so everything below is found structurally: by tag, by
    // `aria-expanded`, and by label text.

    /** The card's own disclosure button (a direct child), or null. */
    function headerButtonOf(li) {
      const children = li.children;
      for (let i = 0; children !== undefined && i < children.length; i += 1) {
        const child = children[i];
        if (child.tagName === 'BUTTON' && child.hasAttribute('aria-expanded')) return child;
      }
      return null;
    }

    /** The expanded body (the card's only direct `<div>` child), or null while collapsed. */
    function bodyOf(li) {
      const children = li.children;
      for (let i = 0; children !== undefined && i < children.length; i += 1) {
        const child = children[i];
        if (child.tagName === 'DIV') return child;
      }
      return null;
    }

    /** The card's title text when it is the one we govern, else null. */
    function titleOf(li) {
      const button = headerButtonOf(li);
      if (button === null) return null;
      const spans = button.querySelectorAll('span');
      for (let i = 0; i < spans.length; i += 1) {
        const span = spans[i];
        if (span.childElementCount !== 0) continue;
        const text = String(span.textContent || '').trim();
        if (CARD_TITLES.indexOf(text) !== -1) return text;
      }
      return null;
    }

    /** The nearest ancestor `<li>` that looks like a plugin card, or null. */
    function enclosingCard(node) {
      let cursor = node === null || node === undefined ? null : node.parentNode;
      while (cursor !== null && cursor !== undefined && cursor.nodeType === 1) {
        if (cursor.tagName === 'LI' && headerButtonOf(cursor) !== null) return cursor;
        cursor = cursor.parentNode;
      }
      return null;
    }

    /** The row this bundle already injected into a body, or null. */
    function ownRowIn(body) {
      const children = body.children;
      for (let i = 0; children !== undefined && i < children.length; i += 1) {
        if (children[i].hasAttribute(ROW_ATTR)) return children[i];
      }
      return null;
    }

    // ── transport ───────────────────────────────────────────────────────────

    /**
     * One call into the host route.
     *
     * The route answers a JSON envelope and is same-origin, so the browser
     * attaches the platform's login cookie automatically. Transport faults and
     * failure envelopes are folded into one `{ok:…}` shape so no caller has to
     * tell them apart.
     *
     * @param method - endpoint name, matching a host-core method.
     * @param args - JSON payload.
     * @returns `{ ok: true, value }` or `{ ok: false, error }`.
     */
    function hostCall(method, args) {
      let pending;
      try {
        pending = fetch(`${CHANNEL}/${method}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(args || {}),
        });
      } catch (error) {
        return Promise.resolve({ ok: false, error: String(error && error.message ? error.message : error) });
      }
      return Promise.resolve(pending).then(
        (res) =>
          res.json().then(
            (envelope) => {
              if (envelope && envelope.ok) return { ok: true, value: envelope.value };
              // The host half answers `{ ok: false, error: { code, message } }`;
              // a bare string is tolerated so a different channel's shape cannot
              // turn a real reason into a meaningless one.
              const failure = envelope ? envelope.error : undefined;
              const message = typeof failure === 'string'
                ? failure
                : failure
                  ? failure.message || failure.code || 'host call failed'
                  : `HTTP ${res.status}`;
              return { ok: false, error: String(message) };
            },
            () => ({ ok: false, error: `HTTP ${res.status} with a non-JSON body` }),
          ),
        (error) => ({ ok: false, error: String(error && error.message ? error.message : error) }),
      );
    }

    // ── row and state ───────────────────────────────────────────────────────

    /**
     * Build the injected row.
     *
     * Markup mirrors the shell's own toggle field: a label and a `role="switch"`
     * button on one line, a hint underneath, and an error line that is present
     * but hidden until a save fails. The parts are stashed on the row element so
     * a re-patch after a collapse/expand cycle can adopt the row it finds
     * instead of building a second one.
     *
     * @param ui - the shared plugin state.
     * @returns the row element (not yet attached).
     */
    function buildRow(ui) {
      const row = document.createElement('div');
      row.className = 'dshwst-row';
      row.setAttribute(ROW_ATTR, '');

      const line = document.createElement('div');
      line.className = 'dshwst-toggleRow';

      const label = document.createElement('span');
      label.className = 'dshwst-toggleLabel';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'dshwst-switch';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', 'false');
      toggle.appendChild(document.createElement('span')).className = 'dshwst-thumb';
      toggle.addEventListener('click', () => {
        void toggleSwitch(ui);
      });

      line.appendChild(label);
      line.appendChild(toggle);

      const hint = document.createElement('p');
      hint.className = 'dshwst-hint';

      const error = document.createElement('p');
      error.className = 'dshwst-error';
      error.setAttribute('role', 'status');
      error.hidden = true;

      row.appendChild(line);
      row.appendChild(hint);
      row.appendChild(error);
      row.dshwstParts = { label, toggle, hint, error };
      return row;
    }

    /**
     * Paint the shared state onto the card and the injected row.
     *
     * `known` is what keeps this honest: until the host has answered once the
     * switch is rendered disabled rather than in a position we cannot back up,
     * so the row is never "wrong first, right later".
     *
     * @param ui - the shared plugin state.
     */
    function syncCard(ui) {
      const card = ui.card;
      if (card !== null && card.isConnected) {
        if (ui.known && !ui.enabled) card.setAttribute(OFF_ATTR, '');
        else card.removeAttribute(OFF_ATTR);
      }
      const row = ui.row;
      const parts = row === null || row === undefined ? null : row.dshwstParts;
      if (parts === null || parts === undefined || !row.isConnected) return;

      const label = ui.t('toggle');
      parts.label.textContent = label;
      parts.toggle.setAttribute('aria-label', label);
      parts.toggle.title = label;
      parts.toggle.setAttribute('aria-checked', ui.enabled ? 'true' : 'false');
      parts.toggle.disabled = ui.busy || !ui.known;
      parts.hint.textContent = ui.known ? ui.t(ui.enabled ? 'on' : 'off') : ui.t('unknown');
      if (ui.error.length > 0) {
        parts.error.textContent = ui.error;
        parts.error.hidden = false;
      } else {
        parts.error.textContent = '';
        parts.error.hidden = true;
      }
    }

    /** Whether the card is patched and needs no further work this mutation. */
    function settled(ui) {
      const card = ui.card;
      if (card === null || !card.isConnected || !card.hasAttribute(CARD_ATTR)) return false;
      // Collapsed: there is no body to inject into, so the grey state is all
      // this card owes until it is expanded again.
      if (bodyOf(card) === null) return true;
      const row = ui.row;
      return row !== null && row.isConnected && row.parentNode === bodyOf(card);
    }

    /**
     * Patch one candidate element if it really is the card we govern.
     * @param li - a candidate `<li>`.
     * @param ui - the shared plugin state.
     * @returns the card, or null when this is not it.
     */
    function patchCard(li, ui) {
      if (titleOf(li) === null) return null;
      ui.card = li;
      li.setAttribute(CARD_ATTR, '');
      const body = bodyOf(li);
      let row = null;
      if (body !== null) {
        row = ownRowIn(body);
        if (row === null) {
          row = buildRow(ui);
          body.insertBefore(row, body.firstChild);
        }
      }
      ui.row = row;
      syncCard(ui);
      return li;
    }

    /**
     * Patch whatever card an inserted subtree brought with it.
     *
     * Only the inserted subtree is inspected, and the one ancestor that could
     * have gained a body is checked first — the hot path during a streaming
     * conversation never reaches this function at all, because `settled()`
     * short-circuits the observer first.
     *
     * @param root - an inserted node (or the document, for the initial scan).
     * @param ui - the shared plugin state.
     * @returns the patched card, or null.
     */
    function patchCardIn(root, ui) {
      if (root === null || root === undefined) return null;
      const candidates = [];
      const owner = enclosingCard(root);
      if (owner !== null) candidates.push(owner);
      // Elements and the document itself are both scanned; a document-level scan
      // is only ever the initial one and the 400ms backstop, never the hot path.
      if ((root.nodeType === 1 || root.nodeType === 9) && typeof root.querySelectorAll === 'function') {
        if (root.nodeType === 1 && root.tagName === 'LI') candidates.push(root);
        const nested = root.querySelectorAll('li');
        for (let i = 0; i < nested.length; i += 1) candidates.push(nested[i]);
      }
      for (let i = 0; i < candidates.length; i += 1) {
        if (patchCard(candidates[i], ui) !== null) return candidates[i];
      }
      return null;
    }

    /** In-flight one-shot read, so a burst of patches issues one request. */
    let refreshing = null;

    /**
     * Read the host's stored switch once.
     *
     * Called at plugin load and never on a timer: the position is a durable
     * fact that only this page can change, so polling would buy nothing and
     * cost the first paint.
     *
     * @param ui - the shared plugin state.
     * @returns the transport answer.
     */
    function refresh(ui) {
      if (refreshing !== null) return refreshing;
      refreshing = hostCall('state', {}).then((answer) => {
        refreshing = null;
        const value = answer.ok ? answer.value : null;
        if (value !== null && typeof value === 'object' && typeof value.enabled === 'boolean') {
          ui.enabled = value.enabled;
          ui.known = true;
          ui.error = '';
        } else if (!answer.ok) {
          ui.error = answer.error;
        }
        syncCard(ui);
        return answer;
      });
      return refreshing;
    }

    /**
     * Flip the switch: optimistic, then reconciled against the host's answer.
     *
     * A refused write is rolled back rather than left showing a position the
     * host never accepted, and the reason is rendered in the row instead of
     * only reaching the console.
     *
     * @param ui - the shared plugin state.
     */
    async function toggleSwitch(ui) {
      if (ui.busy || !ui.known) return;
      const previous = ui.enabled;
      ui.enabled = !previous;
      ui.busy = true;
      ui.error = '';
      syncCard(ui);

      const answer = await hostCall('set', { enabled: ui.enabled });
      ui.busy = false;
      const value = answer.ok ? answer.value : null;
      if (value !== null && typeof value === 'object' && typeof value.enabled === 'boolean') {
        ui.enabled = value.enabled;
        ui.known = true;
      } else {
        ui.enabled = previous;
        ui.error = answer.ok ? 'the host did not report the new state' : answer.error;
      }
      syncCard(ui);
    }

    /** Required client services: the locale registry, for the row's copy. */
    const inject = ['locale'];

    /**
     * Client plugin body: inject the stylesheet, resolve copy, and keep the
     * shipped card patched for as long as the settings dialog lives.
     * @param ctx - Client Cordis context.
     */
    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-websearch-toggle';
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => {
          tag.remove();
        };
      }, 'dsh-websearch-toggle: card stylesheet');

      const locale = ctx.locale;
      const pickDict = (id) => (/^zh/i.test(String(id || '')) ? ZH : EN);
      const activeId = () => {
        try {
          const snapshot = locale.getSnapshot();
          return String((snapshot && snapshot.active) || '');
        } catch {
          return '';
        }
      };

      let bound = null;
      try {
        let ids = [];
        try {
          const snapshot = locale.getSnapshot();
          ids = Array.isArray(snapshot && snapshot.locales) ? snapshot.locales.map((d) => String(d.id)) : [];
        } catch {
          // Fall back to the known pair.
        }
        if (ids.length === 0) ids = ['en', 'zh'];
        for (const id of ids) {
          const off = locale.register(NS, id, pickDict(id));
          // The dictionary registration outlives the card, so tie it to the fiber.
          if (typeof off === 'function') ctx.effect(() => off, 'dsh-websearch-toggle: locale dictionary');
        }
        bound = typeof locale.bind === 'function' ? locale.bind(NS) : null;
      } catch {
        bound = null;
      }

      const translate = (key) => {
        if (bound !== null) {
          try {
            const value = bound(key);
            if (typeof value === 'string' && value !== key && value.length > 0) return value;
          } catch {
            // Fall through to the literal dictionary.
          }
        }
        const dict = pickDict(activeId());
        return dict[key] || EN[key] || key;
      };

      const ui = { card: null, row: null, enabled: true, known: false, busy: false, error: '', t: translate };

      // One read at load, deliberately not on a timer and not when Settings
      // opens: by the time the card can be on screen the stored position is
      // already known, so it is never painted in one state and corrected into
      // another (the one bug this family of plugins has actually shipped).
      refresh(ui);

      if (typeof locale.subscribe === 'function') {
        const off = locale.subscribe(() => {
          syncCard(ui);
        });
        if (typeof off === 'function') ctx.effect(() => off, 'dsh-websearch-toggle: locale subscription');
      }

      // The settings dialog mounts when the user opens it and unmounts on close,
      // and the card body mounts only while the card is expanded, so the row has
      // to be injected whenever the body appears rather than once at load.
      //
      // A MutationObserver callback already runs as a microtask at the end of
      // React's commit — after the nodes are in the DOM, before the frame is
      // painted — so the insertion lands in the same frame the body does, with
      // no timer in between. The cost of being that hot is bounded two ways: the
      // callback returns immediately while the row is intact, and it inspects
      // only the nodes just added.
      ctx.effect(() => {
        patchCardIn(document, ui);
        if (typeof MutationObserver !== 'function' || !document.body) return () => {};

        let sweep = 0;
        const backstop = () => {
          if (sweep !== 0) return;
          sweep = setTimeout(() => {
            sweep = 0;
            if (settled(ui)) return;
            patchCardIn(document, ui);
          }, SWEEP_MS);
        };

        const observer = new MutationObserver((records) => {
          if (settled(ui)) return;
          for (const record of records) {
            for (const node of record.addedNodes) {
              // A label written into an already-mounted card arrives as a text
              // node, so resolve the enclosing card before giving up on it.
              if (node.nodeType === 3) {
                const owner = enclosingCard(node);
                if (owner !== null && patchCard(owner, ui) !== null) return;
                continue;
              }
              if (node.nodeType !== 1) continue;
              if (patchCardIn(node, ui) !== null) return;
            }
          }
          backstop();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => {
          observer.disconnect();
          if (sweep !== 0) clearTimeout(sweep);
        };
      }, 'dsh-websearch-toggle: web search card');
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.__test = {
      CSS,
      EN,
      ZH,
      NS,
      CHANNEL,
      CARD_ATTR,
      OFF_ATTR,
      ROW_ATTR,
      SWEEP_MS,
      CARD_TITLES,
      headerButtonOf,
      bodyOf,
      titleOf,
      enclosingCard,
      ownRowIn,
      hostCall,
      buildRow,
      syncCard,
      settled,
      patchCard,
      patchCardIn,
      refresh,
      toggleSwitch,
      createUi: (t) => ({ card: null, row: null, enabled: true, known: false, busy: false, error: '', t }),
    };
    return module.exports;
    })();

    /**
     * The union of the three halves' declared client services.
     *
     * Generated, not hand-written: the build fails rather than emit a list that
     * would leave a declaration out. `slots` and `locale` ride the settings
     * sections, `uiWorkspace` is the skills panel's folder picker.
     */
    const inject = ['slots', 'locale', 'uiWorkspace'];

    /**
     * Client plugin body: run all 3 features against the one context.
     *
     * Each feature registers its own effects (stylesheet, observer, timers, locale
     * dictionaries, slot entries) on this context, so stopping or updating this
     * row disposes all of them together.
     *
     * @param ctx - Client Cordis context.
     */
    function apply(ctx) {
      SKILLS_PANEL.apply(ctx);
      TOKEN_STATS.apply(ctx);
      WEBSEARCH_TOGGLE.apply(ctx);
    }

    exports.apply = apply;
    exports.inject = inject;

    /**
     * Test surface: the closures as they were extracted, so a suite can drive one
     * feature through the same entry point its own tests always used.
     */
    exports.__test = {
      parts: {
        SKILLS_PANEL,
        TOKEN_STATS,
        WEBSEARCH_TOGGLE,
      },
      tokenStatsHooks: TOKEN_STATS.__test,
      websearchToggleHooks: WEBSEARCH_TOGGLE.__test,
    };
    return module.exports;
  },
});
