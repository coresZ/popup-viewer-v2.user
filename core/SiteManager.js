import { logger } from '../utils/logger.js';
import { urlResolver } from '../security/UrlResolver.js';
import { eventBus } from './EventBus.js';

export class SiteManager {
  constructor() {
    this.adapters = [];
    this.enhancers = [];
  }
  register(adapter) {
    this.adapters.push(adapter);
    return adapter;
  }
  registerEnhancer(fn) {
    this.enhancers.push(fn);
    return fn;
  }
  activeAdapters(hostname, pathname) {
    return this.adapters.filter((a) => a.match(hostname, pathname));
  }
  /**
   * 解析点击/悬停目标是否为可打开的链接。
   * 不修改事件，供点击拦截与悬停预热共用。
   * @returns {{url:string,title:string,element:Element}|null}
   */
  resolveCandidate(event) {
    if (event.target.closest?.('#popup-content-panel')) return null;
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    for (const adapter of this.activeAdapters(hostname, pathname)) {
      let parsed;
      try {
        parsed = adapter.parseClick(event);
      } catch (err) {
        logger.error(`[${adapter.name}] parseClick error`, err);
        continue;
      }
      if (!parsed || !parsed.url) continue;
      const url = urlResolver.resolve(parsed.url);
      if (!url || !urlResolver.isHttpUrl(url)) continue;
      if (urlResolver.isDangerous(parsed.url)) continue;
      if (urlResolver.isSamePageAnchor(url)) return null;
      return { url, title: parsed.title || '查看内容', element: parsed.element };
    }
    return null;
  }
  /**
   * 全局链接点击入口（capture 阶段）。
   * @returns {boolean} 是否已处理
   */
  handleClick(event) {
    if (event.defaultPrevented) return false;
    const candidate = this.resolveCandidate(event);
    if (!candidate) return false;
    event.preventDefault();
    event.stopPropagation();
    logger.debug(`opening ${candidate.title} -> ${candidate.url}`);
    eventBus.emit('open-page', { url: candidate.url, title: candidate.title, element: candidate.element });
    return true;
  }
  /**
   * 对当前页面执行所有适配器的视觉增强。
   */
  runEnhancements() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    for (const adapter of this.activeAdapters(hostname, pathname)) {
      try {
        adapter.enhance(document, hostname, pathname);
      } catch (err) {
        logger.error(`[${adapter.name}] enhance error`, err);
      }
    }
    for (const fn of this.enhancers) {
      try {
        fn(hostname, pathname);
      } catch (err) {
        logger.error('enhancer error', err);
      }
    }
  }
}

export const siteManager = new SiteManager();
