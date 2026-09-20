# popup-viewer-v2/

## Project Responsibility
A Tampermonkey userscript that enables in-page popup preview of forum posts and links. Intercepts link clicks and loads content in a sandboxed popup panel without navigating away from the current page. Features multi-site adapters, user-defined rules, multiple loading strategies, and comprehensive security sanitization.

## System Entry Points
- `src/main.js`: Plugin initialization and OpenCode integration.
- `package.json`: Dependency manifest and build scripts.
- `config.js`: Global configuration for popup sizes, loading policies, cache settings.

## Directory Map (Aggregated)
| Directory | Responsibility Summary | Detailed Map |
|-----------|------------------------|--------------|
| `src/adapters/` | Site-specific adapters for parsing click events and enhancing DOM elements to enable popup preview across different websites. | [View Map](src/adapters/codemap.md) |
| `src/core/` | Orchestrates core application logic: event bus, popup lifecycle, site detection, content loading, settings, storage, and rules management. | [View Map](src/core/codemap.md) |
| `src/kit/` | PopupKit library: self-contained popup component for use by other userscripts via `@require`, with complete style isolation. | [View Map](src/kit/codemap.md) |
| `src/loaders/` | Multiple content loading strategies (iframe, request, parser, cache) for fetching, sanitizing, and rendering external web content. | [View Map](src/loaders/codemap.md) |
| `src/security/` | Security primitives: sandbox policy, HTML sanitization, URL validation to prevent XSS and unsafe content loading. | [View Map](src/security/codemap.md) |
| `src/ui/` | All UI components: popup panel, toolbar, settings, rules management, element picker, loading/error states. | [View Map](src/ui/codemap.md) |
| `src/utils/` | Low-level utilities: DOM manipulation, GM API abstraction, panel interaction behaviors, debugging, logging. | [View Map](src/utils/codemap.md) |

## Architecture Overview
The system follows a modular manager-based architecture with singleton instances:
1. **Initialization**: `main.js` creates all managers and wires event handlers.
2. **Site Detection**: `SiteManager` matches current hostname/pathname against registered adapters and user rules.
3. **Click Handling**: `SiteManager.handleClick()` → `resolveCandidate()` → emits `open-page` event.
4. **Popup Opening**: `PopupManager.open()` → `LoaderManager.load()` → appropriate loader fetches content.
5. **Content Loading**: Loaders fetch, sanitize, and render content into sandboxed iframes or direct DOM.
6. **Security**: All content passes through `Sanitizer` and `Sandbox` to prevent XSS.

## Data Flow
- **User Click**: Adapter/Rule parsing → URL validation → event bus → popup manager → loader → renderer.
- **Settings**: User changes → `SettingsManager` → persistence via GM storage → UI updates.
- **Rules**: User-defined selectors → `RulesManager` → persistence → integrated into click resolution.
