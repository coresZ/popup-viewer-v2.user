# src/adapters/

## Responsibility
Provides site-specific adapters for parsing click events and enhancing DOM elements to enable popup preview functionality across different websites.

## Design
Implements the Adapter pattern with a abstract base class (`BaseAdapter`) defining the interface for matching hostnames, parsing click events, and enhancing DOM. Concrete adapters (`CiliAdapter`, `DiscuzAdapter`, `LinuxAdapter`, `TgbAdapter`) implement site-specific logic. Each adapter encapsulates:
- **Hostname matching**: Determines if the current site is supported.
- **Click parsing**: Extracts URL and title from click events based on site-specific DOM structure.
- **DOM enhancement**: Adds CSS classes (e.g., `popup-trigger`) to elements to enable popup behavior.

## Flow
1. **Initialization**: Adapters are instantiated and registered.
2. **Matching**: For each page, `match(hostname, pathname)` is called to determine if the adapter applies.
3. **Enhancement**: If matched, `enhance(doc)` is called to modify DOM elements (add trigger classes).
4. **Click Handling**: When a user clicks an enhanced element, `parseClick(event)` extracts the target URL and title.
5. **URL Resolution**: `resolveHref` helper converts relative URLs to absolute URLs.

## Integration
- **Consumed by**: Core modules (likely `RulesManager` or `SiteManager`) that coordinate adapter selection and event handling.
- **Depends on**: Browser DOM APIs and `window.location` for hostname/pathname.
- **Exports**: Adapter classes for dynamic instantiation based on site configuration.
