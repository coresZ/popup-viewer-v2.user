import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { el } from '../utils/dom.js';
import { readIframeLocation } from './IframeRenderer.js';

export class IframeLoader {
  constructor(sandbox) {
    this.sandbox = sandbox;
  }
  load({ url, hostname, container, onError, onLoad, mobileUA = null, loadingSelector = '#popup-panel-loading', onNavigate }) {
    logger.debug(`[IframeLoader] direct load ${url}`);
    if (mobileUA) {
      logger.debug('[IframeLoader] 直接 iframe 无法设置移动端 UA：' + url);
    }
    const iframe = el('iframe', {
      id: 'popup-panel-iframe',
      sandbox: this.sandbox.buildSandboxAttrs(hostname)
    });
    // 标记自己的弹窗 iframe：即使开启「在 iframe 中运行」，也不在其中重复注入脚本
    try {
      iframe.contentWindow.__PV2_OWN_IFRAME__ = true;
    } catch {}
    iframe.style.cssText = 'width:100%;height:100%;border:none;background:#fff;';
    let settled = false;
    let firstLoad = true;
    let lastUrl = url;
    const finish = (fn, ...args) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(...args);
    };
    const timer = setTimeout(() => {
      logger.warn(`[IframeLoader] timeout loading ${url}`);
      onError(`加载 ${url} 超时或被阻止，请尝试在新标签页打开。`);
    }, config.loader.timeout);
    // SPA 站点（如 Discourse/linux.do）内部跳转是客户端路由，不触发 iframe load 事件；
    // 轮询同源 location 变化来捕获这类自主跳转
    const pollTimer = setInterval(() => {
      if (!iframe.isConnected) {
        clearInterval(pollTimer);
        return;
      }
      const loc = readIframeLocation(iframe);
      if (loc && loc.url !== lastUrl) {
        lastUrl = loc.url;
        onNavigate?.(loc.url, loc.title);
      }
    }, 800);
    iframe.addEventListener('load', () => {
      // 首次 load = 打开时的初始页面；之后每次 load = iframe 内部整页跳转，上报给历史
      if (firstLoad) {
        firstLoad = false;
        const loc = readIframeLocation(iframe);
        if (loc) lastUrl = loc.url; // 重定向后的真实地址
        if (!settled) {
          container.querySelector(loadingSelector)?.remove();
          container.classList.add('iframe-direct-load');
          finish(onLoad);
        }
        return;
      }
      const loc = readIframeLocation(iframe);
      if (loc && loc.url !== lastUrl) {
        lastUrl = loc.url;
        onNavigate?.(loc.url, loc.title);
      }
    });
    iframe.addEventListener('error', () => finish(onError, `加载 ${url} 失败。`));
    container.querySelector(loadingSelector)?.remove();
    container.appendChild(iframe);
    iframe.src = url;
    return () => {
      clearTimeout(timer);
      clearInterval(pollTimer);
      iframe.src = 'about:blank';
      iframe.remove();
    };
  }
}
