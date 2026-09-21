# src/security/

## Responsibility
Provides security primitives for sandboxing, HTML sanitization, and URL validation to prevent XSS and unsafe content loading.

## Design
- **Sandbox**: Policy-based iframe sandbox configuration. Determines allowed capabilities (scripts, forms, popups) per hostname via subdomain matching.
- **Sanitizer**: HTML purification using DOMParser and tree walking. Removes dangerous tags (script, iframe, object, etc.) and attributes (event handlers, javascript: URLs). Handles lazy-load image resolution and style collection.
- **UrlResolver**: URL utility for absolutization, protocol validation, and same-page anchor detection. Centralizes dangerous protocol detection (javascript:, data:, vbscript:).

## Flow
1. **Policy Lookup**: `Sandbox.policyFor(hostname)` returns capability set for the site.
2. **Sanitization**: `Sanitizer.sanitize(html, baseUrl)` parses HTML → collects styles → purges dangerous elements → resolves lazy images → returns clean head/body.
3. **URL Validation**: `UrlResolver.resolve(href)` absolutizes URLs; `isDangerous()` checks for malicious protocols; `isHttpUrl()` ensures safe loading.
4. **Sandbox Attribute Generation**: `Sandbox.buildSandboxAttrs(hostname)` or `contentSandboxAttrs(keepScripts)` produces sandbox attribute strings for iframes.

## Integration
- **Depends on**: Browser DOM APIs (DOMParser, URL).
- **Consumed by**: `loaders/*` for content sanitization and iframe sandboxing, `core/SiteManager.js` for URL validation.
- **Exports**: Singleton instances (`sanitizer`, `urlResolver`) and factory functions.
