import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export class PrefetchManager {
  constructor(loaderManager) {
    this.loader = loaderManager;
    this._timer = null;
    this._current = null;
  }
  /**
   * 预约预热某个 URL（带防抖）。
   */
  schedule(url, hostname) {
    if (!config.prefetch.enabled) return;
    if (this.loader.resolveMode(url, hostname) !== 'cache') return;
    if (this.loader.hasCached(url)) return;
    if (this._current?.url === url) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._run(url), config.prefetch.hoverDebounceMs);
  }
  cancel() {
    clearTimeout(this._timer);
    this._timer = null;
  }
  abort() {
    this.cancel();
    if (this._current) {
      try {
        this._current.abort();
      } catch {}
      this._current = null;
    }
  }
  _run(url) {
    if (this._current?.url === url) return;
    if (this._current) {
      try {
        this._current.abort();
      } catch {}
      this._current = null;
    }
    logger.debug(`[Prefetch] ${url}`);
    const entry = this.loader.prefetch(url);
    this._current = { url, abort: entry.abort };
    entry.promise.finally(() => {
      if (this._current?.url === url) this._current = null;
    });
  }
}
