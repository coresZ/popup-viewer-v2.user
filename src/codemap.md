# src/

## Responsibility
Application source for Popup Viewer V2. Contains the userscript entry point, static configuration, and all feature modules: site adapters, core managers, content loaders, security primitives, UI components, utilities, the standalone PopupKit library, and the X (Twitter) reader.

## Design
- **Layered ES Modules**: `main.js` is the composition root; `core/` orchestrates; `loaders/`, `security/`, `adapters/` provide strategies; `ui/` renders; `utils/` is the lowest layer. Modules export singleton managers where shared state is required (`eventBus`, `siteManager`, `loaderManager`, `popupManager`, `settingsManager`, `rulesManager`, `storageManager`, `sanitizer`, `urlResolver`).
- **Adapter pattern**: `adapters/BaseAdapter.js` defines `match` / `parseClick` / `enhance`; concrete adapters are registered in `main.js`.
- **Strategy pattern**: `LoaderManager` selects `iframe` / `request` / `parser` / `cache` / `xthread` based on `config.sitePolicy` and the target hostname.
- **Security-first rendering**: fetched HTML passes through `security/Sanitizer.js` and is rendered in a sandboxed iframe (`security/Sandbox.js`); URLs are validated by `security/UrlResolver.js`.
- **UI isolation**: `ui/PopupPanel.js` mounts the shell into an open Shadow DOM (`utils/uiHost.js`), with a page-mount fallback for compatibility.
- **X special case**: `x/` implements the GraphQL bridge, data model, renderer, comment/profile cards, draft store, theme reader and zoom math; `XThreadLoader` is registered only on X pages.

## Flow
1. `main.js` bootstraps settings, registers adapters, installs the X bridge when applicable, binds capture-phase `click` / `mouseover`, and starts a debounced `MutationObserver`.
2. `SiteManager.resolveCandidate()` checks user rules first, then active adapters; `handleClick()` emits `open-page`.
3. `PopupManager` manages the panel lifecycle and per-popup navigation history, and delegates content loading to `LoaderManager`.
4. The chosen loader fetches or renders content; the UI layer shows loading / error states and applies settings.
5. `SettingsPanel` / `RulesPanel` / `ElementPicker` write through `SettingsManager` and `RulesManager`, persisted via `utils/gm.js`.

## Integration
- **Depends on**: browser DOM/History/Storage APIs, Tampermonkey `GM_*` APIs (with native fallbacks), and `config.js`.
- **Consumed by**: `build.mjs`, which bundles `main.js` into `dist/popup-viewer-v2.user.js` and `kit/popupKit.js` into `dist/popup-viewer-kit.js`.
- **Related docs**: [root codemap](../codemap.md), [development manual](../docs/development.md), per-directory codemaps in each subfolder.
