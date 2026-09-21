# src/utils/

## Responsibility
Provides low-level utility functions for DOM manipulation, GM API abstraction, panel interaction behaviors, debugging, and logging.

## Design
- **dom.js**: SVG icon system with path definitions, `el()` factory for creating elements with attributes/events, `svg()` and `svgIcon()` for inline SVG icons, `clear()` for removing children.
- **gm.js**: GM API adapter layer that safely detects and wraps `GM_addStyle`, `GM_xmlhttpRequest`, `GM_getValue`, `GM_setValue` with fallbacks to browser APIs (fetch, localStorage, style injection).
- **panelBehavior.js**: Shared panel interaction logic: `clampToViewport()` for position constraints, `setupDrag()` for header drag-and-drop with pointer events, `setupResize()` for 8-directional resize handles, `setupWheelScrollChain()` for scroll containment.
- **debugFlag.js**: Debug marking utilities for development.
- **logger.js**: Configurable logging with levels.
- **debounce.js**: Debounce utility for rate-limiting functions.
- **selector.js**: CSS selector utilities.

## Flow
1. **DOM Creation**: `el()` → create element → set attributes → append children → return node.
2. **GM Operations**: `gm.getValue()` → try GM_getValue → fallback to localStorage → return value.
3. **Panel Interaction**: `setupDrag()` → pointerdown → capture pointer → pointermove updates position → pointercommit → onDragEnd callback.
4. **Resize**: `setupResize()` → create resize handles → pointerdown starts resize → pointermove updates dimensions → pointerup → onResizeEnd callback.

## Integration
- **Depends on**: Browser DOM APIs, globalThis for GM detection.
- **Consumed by**: All UI components (`ui/*`), core managers (`core/*`), loaders (`loaders/*`).
- **Exports**: Utility functions and singleton `gm` object.
