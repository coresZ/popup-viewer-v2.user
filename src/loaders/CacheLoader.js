import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { gm } from '../utils/gm.js';
import { sanitizer } from '../security/Sanitizer.js';
import { contentSandboxAttrs } from '../security/Sandbox.js';
import { renderIntoIframe } from './IframeRenderer.js';

export class CacheLoader {
  constructor() {
    this.cache = new Map();
    this.inflight = new Map();
  }
  has(url) {
    return this._readCache(url) != null;
  }
  _readCache(url) {
    const entry = this.cache.get(url);
    if (!entry) return null;
    if (Date.now() - entry.time > config.cache.ttl) {
      this.cache.delete(url);
      return null;
    }
    return entry;
  }
  _writeCache(url, result) {
    if (this.cache.size >= config.cache.maxEntries) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(url, { head: result.head, body: result.body, time: Date.now() });
  }
  /**
   * 发起抓取并缓存，返回 { promise, abort }。
   * 同一 URL 的并发请求会去重复用。
   */
  prefetch(url, keepScripts = false, mobileUA = null) {
    const cached = this._readCache(url);
    if (cached != null) return { promise: Promise.resolve(cached), abort: () => {} };
    const existing = this.inflight.get(url);
    if (existing) return existing;
    const entry = this._fetch(url, keepScripts, mobileUA);
    entry.promise.finally(() => this.inflight.delete(url));
    this.inflight.set(url, entry);
    return entry;
  }
  _fetch(url, keepScripts, mobileUA = null) {
    let abort = () => {};
    const promise = new Promise((resolve, reject) => {
      const req = gm.xmlhttpRequest({
        method: 'GET',
        url,
        timeout: config.loader.timeout,
        ...(mobileUA ? { headers: { 'User-Agent': mobileUA } } : {}),
        onload: (response) => {
          if (response.status !== 200) {
            reject(new Error(`加载失败 (HTTP ${response.status})`));
            return;
          }
          try {
            const result = sanitizer.sanitize(response.responseText, url, { keepScripts });
            if (config.cache.enabled) this._writeCache(url, result);
            resolve(result);
          } catch (error) {
            logger.error('[CacheLoader] process error', error);
            reject(new Error('内容解析失败: ' + error.message));
          }
        },
        onerror: (error) => {
          logger.error('[CacheLoader] request error', error);
          reject(new Error('网络请求失败'));
        }
      });
      abort = () => {
        try {
          req?.abort?.();
        } catch {}
      };
    });
    return { promise, abort };
  }
  load({ url, keepScripts = false, container, onError, onLoad, mobileUA = null, linkIntercept, loadingSelector, onNavigate }) {
    logger.debug(`[CacheLoader] ${url}`);
    const cached = this._readCache(url);
    if (cached != null) {
      logger.debug(`[CacheLoader] cache hit: ${url}`);
      renderIntoIframe({
        html: cached.body,
        head: cached.head,
        url,
        container,
        sandboxAttrs: contentSandboxAttrs(keepScripts),
        linkIntercept,
        loadingSelector,
        onNavigate
      });
      onLoad?.();
      return () => {
        container.querySelector('#popup-panel-iframe')?.remove();
      };
    }
    const { promise, abort } = this.prefetch(url, keepScripts, mobileUA);
    promise
      .then((result) => {
        renderIntoIframe({
          html: result.body,
          head: result.head,
          url,
          container,
          sandboxAttrs: contentSandboxAttrs(keepScripts),
          linkIntercept,
          loadingSelector,
          onNavigate
        });
        onLoad?.();
      })
      .catch((error) => onError?.(error.message));
    return () => {
      try {
        abort?.();
      } catch {}
      container.querySelector('#popup-panel-iframe')?.remove();
    };
  }
}
