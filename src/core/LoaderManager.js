import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { createDefaultSandbox } from '../security/Sandbox.js';
import { IframeLoader } from '../loaders/IframeLoader.js';
import { RequestLoader } from '../loaders/RequestLoader.js';
import { ParserLoader } from '../loaders/ParserLoader.js';
import { CacheLoader } from '../loaders/CacheLoader.js';
import { settingsManager } from './SettingsManager.js';

import { markMod } from '../utils/debugFlag.js';
markMod('LoaderManager');

export class LoaderManager {
  constructor() {
    this.sandbox = createDefaultSandbox(config.sitePolicy);
    this.loaders = {
      iframe: new IframeLoader(this.sandbox),
      request: new RequestLoader(),
      parser: new ParserLoader(),
      cache: new CacheLoader()
    };
  }
  /**
   * 解析应使用的加载方式。
   */
  resolveMode(url, hostname) {
    const policy = this.sandbox.policyFor(hostname);
    if (policy.iframe) return 'iframe';
    const mode = config.loader.defaultMode;
    if (mode === 'iframe') return 'iframe';
    if (mode === 'parser') return 'parser';
    if (mode === 'request') return 'request';
    if (config.cache.enabled) return 'cache';
    return 'request';
  }
  /**
   * 内容是否已在缓存中。
   */
  hasCached(url) {
    return this.loaders.cache.has(url);
  }
  /**
   * 预热缓存：后台抓取并净化 HTML，点击时可立即渲染。
   * 仅当解析结果为 cache 模式时有效。
   */
  prefetch(url) {
    const hostname = this._hostnameOf(url);
    const keepScripts = this.keepScriptsFor(hostname);
    return this.loaders.cache.prefetch(url, keepScripts, this.mobileUA());
  }
  /**
   * 手机模式下返回对应的移动端 UA，否则 null。
   */
  mobileUA() {
    const s = settingsManager.get();
    if (s.panelSize !== 'phone') return null;
    const m = config.phone.sizes[s.phoneModel] || config.phone.sizes[config.phone.defaultModel];
    return m ? m.ua : null;
  }
  _hostnameOf(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }
  /** 该站点抓取净化时是否保留 <script>（仅信任站点）。 */
  keepScriptsFor(hostname) {
    return this.sandbox.policyFor(hostname).scripts === true;
  }
  /**
   * 加载内容到容器。
   * @param {string} url
   * @param {Object} ctx { container, hostname, onError, onLoad, keepScripts?, mobileUA?, linkIntercept?, loadingSelector? }
   * @returns {Function} abort 函数
   */
  load(url, ctx) {
    const hostname = ctx.hostname || this._hostnameOf(url);
    const mode = this.resolveMode(url, hostname);
    const loader = this.loaders[mode] || this.loaders.request;
    const keepScripts = ctx.keepScripts !== undefined ? ctx.keepScripts : this.keepScriptsFor(hostname);
    const mobileUA = ctx.mobileUA !== undefined ? ctx.mobileUA : this.mobileUA();
    const linkIntercept = ctx.linkIntercept !== undefined ? ctx.linkIntercept : undefined;
    logger.log(`[LoaderManager] mode=${mode} scripts=${keepScripts} ${url}`);
    const abort = loader.load({
      url,
      hostname,
      keepScripts,
      mobileUA,
      linkIntercept,
      loadingSelector: ctx.loadingSelector,
      container: ctx.container,
      onError: ctx.onError,
      onLoad: ctx.onLoad,
      onNavigate: ctx.onNavigate
    });
    return () => {
      try {
        abort?.();
      } catch (err) {
        logger.warn('[LoaderManager] abort error', err);
      }
    };
  }
}

export const loaderManager = new LoaderManager();
