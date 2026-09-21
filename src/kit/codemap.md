# src/kit/

## Responsibility
Provides PopupKit, a self-contained library that packages popup preview functionality for use by other userscripts via `@require`. Encapsulates the full popup lifecycle (panel, loading, error states) with complete style isolation.

## Design
- **Isolation**: All DOM elements use `pvk-` prefix; styles are scoped via CSS layer reset and custom properties.
- **Component-based**: `KitPopupPanel` is a standalone UI component with drag-and-drop, keyboard shortcuts (Esc/F/R), fullscreen toggle, and responsive design.
- **Factory pattern**: `createPopupKit()` instantiates a private `LoaderManager` and `KitPopupPanel`, exposing a public API (`open`, `close`, `refresh`, `prefetch`).
- **Dependency injection**: Accepts `load` function in `open()` to allow host scripts to customize content loading.
- **Self-contained**: Includes its own loading/error states, not relying on main script UI modules.

## Flow
1. **Initialization**: `createPopupKit()` injects CSS, creates `LoaderManager` and `KitPopupPanel`.
2. **Open**: `kit.open(opts)` → `panel.open()` → calls injected `load` function → `loaderManager.load()` fetches content → renders into panel.
3. **Interaction**: Panel handles drag, keyboard shortcuts, refresh, fullscreen, close.
4. **Close**: `panel.close()` → aborts loading, removes DOM, triggers `onClose` callback.
5. **Prefetch**: `kit.prefetch(url)` → `loaderManager.prefetch()` for background caching.

## Integration
- **Depends on**: `core/LoaderManager.js` for content loading, `utils/dom.js` for DOM helpers, `utils/panelBehavior.js` for drag/scroll, `config.js` for configuration.
- **Consumed by**: External userscripts via `window.PopupKit` global.
- **Exports**: `PopupKit` global object with API methods.
