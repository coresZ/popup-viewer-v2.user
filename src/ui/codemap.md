# src/ui/

## Responsibility
Provides all user interface components for the popup viewer, including the main panel, toolbar, settings, rules management, and visual states.

## Design
Component-based architecture with each UI piece as a factory function or class:
- **PopupPanel**: Main container managing overlay, header, content area, footer, drag/resize, keyboard shortcuts, fullscreen, settings popover, and rules panel integration.
- **Toolbar**: Creates action buttons (refresh, maximize, open external, settings, close) with consistent styling.
- **SettingsPanel**: Popover for adjusting theme, panel size, scroll behavior, link interception, phone model, etc.
- **RulesPanel**: Modal for managing user-defined CSS selector rules per hostname.
- **ElementPicker**: Tool for selecting DOM elements to create rules.
- **Loading/ErrorView**: Visual states for loading spinner and error display.
- **style.css**: Comprehensive CSS with CSS custom properties, responsive design, dark/light themes, and reduced-motion support.

## Flow
1. **Initialization**: `PopupPanel.ensure()` creates DOM structure, attaches event listeners, injects CSS.
2. **Show/Hide**: `show()` applies settings, positions panel, adds visible class; `close()` removes visibility, cleans up.
3. **Settings Flow**: Settings button → `showSettingsNear()` → `SettingsPanel` → `onChange` → `applySettings()` updates panel dimensions/theme.
4. **Rules Flow**: Settings → "Manage Rules" → `RulesPanel.open()` → `ElementPicker` for selection → `RulesManager` persistence.
5. **Content Rendering**: `getContentArea()` returns container for loaders to inject content.

## Integration
- **Depends on**: `utils/dom.js` for DOM helpers, `utils/panelBehavior.js` for drag/resize/scroll, `core/SettingsManager.js` for settings, `core/RulesManager.js` for rules, `config.js` for size presets.
- **Consumed by**: `core/PopupManager.js` orchestrates panel lifecycle.
- **Exports**: `PopupPanel` class and factory functions for sub-components.
