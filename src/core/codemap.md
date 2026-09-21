# src/core/

## Responsibility
Orchestrates the core application logic for popup preview functionality, managing content loading, popup lifecycle, site-specific behavior, settings, and storage.

## Design
Implements a modular architecture with manager classes following the Singleton pattern (exported instances). Key abstractions:
- **EventBus**: Publish-subscribe system for decoupled communication between modules.
- **LoaderManager**: Strategy pattern for content loading (iframe, request, parser, cache) with sandbox security.
- **PopupManager**: State machine managing popup panel, navigation history (including iframe-native history), and content loading.
- **PrefetchManager**: Debounced prefetch scheduler for hover-triggered preloading.
- **RulesManager**: CRUD manager for user-defined CSS selector rules persisted via GM storage.
- **SettingsManager**: Hierarchical settings (global + per-site) with invariant enforcement.
- **SiteManager**: Adapter registry and click resolver, coordinating built-in adapters and user rules.
- **StorageManager**: Abstraction over GM storage for history and favorites.

## Flow
1. **Initialization**: Managers instantiate as singletons, load persisted state from GM storage.
2. **Site Detection**: `SiteManager` matches current hostname/pathname against registered adapters.
3. **Click Handling**: `SiteManager.handleClick()` → `resolveCandidate()` checks user rules first, then adapters → emits `open-page` event.
4. **Popup Opening**: `PopupManager.open()` → pushes to navigation history → `LoaderManager.load()` → appropriate loader fetches content.
5. **Content Loading**: `LoaderManager` resolves mode (iframe/request/parser/cache) → delegates to specific loader → renders into popup container.
6. **Prefetching**: `PrefetchManager` schedules background fetch on hover → caches for instant popup display.
7. **Settings Persistence**: `SettingsManager` merges global/site settings → persists via `gm.setValue`.

## Integration
- **Depends on**: `config.js` for configuration, `utils/gm.js` for storage, `security/Sandbox.js` for iframe sandboxing, `loaders/*` for content fetching, `ui/*` for panel rendering.
- **Consumed by**: `main.js` (entry point) initializes all managers and wires event handlers.
- **Exports**: Singleton instances for cross-module access.
