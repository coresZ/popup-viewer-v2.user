# src/loaders/

## Responsibility
Implements multiple content loading strategies for fetching, sanitizing, and rendering external web content into the popup panel.

## Design
Strategy pattern with four concrete loaders:
- **IframeLoader**: Direct iframe loading with sandbox attributes; monitors navigation via polling and load events.
- **RequestLoader**: GM_xmlhttpRequest fetch → HTML sanitization → render into iframe via `IframeRenderer`.
- **ParserLoader**: GM_xmlhttpRequest fetch → HTML sanitization → DOM parsing → direct DOM injection into container.
- **CacheLoader**: Extends RequestLoader with LRU in-memory cache and deduplication of in-flight requests.
- **IframeRenderer**: Utility for creating sandboxed iframes, writing sanitized HTML, fixing links/images, and injecting read styles.

All loaders follow a common interface: `load({ url, hostname, container, onError, onLoad, ... })` returning an `abort` function.

## Flow
1. **Mode Resolution**: `LoaderManager.resolveMode()` selects loader based on sandbox policy and config.
2. **Request**: Loader initiates fetch (or checks cache).
3. **Sanitization**: HTML is sanitized via `Sanitizer` to remove dangerous elements.
4. **Rendering**: Content is rendered either via `renderIntoIframe` (sandboxed) or direct DOM manipulation.
5. **Post-processing**: Links are absolutized, images fixed, styles injected.
6. **Navigation Tracking**: Iframe loaders monitor internal navigation for history support.

## Integration
- **Depends on**: `security/Sanitizer.js` for HTML净化, `security/Sandbox.js` for sandbox attributes, `utils/gm.js` for GM_xmlhttpRequest, `config.js` for timeouts/cache settings.
- **Consumed by**: `core/LoaderManager.js` which orchestrates mode selection and delegation.
- **Exports**: Loader classes and `renderIntoIframe` utility.
