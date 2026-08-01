import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { el } from '../utils/dom.js';

export class IframeLoader {
  constructor(sandbox) {
    this.sandbox = sandbox;
  }
  load({ url, hostname, container, onError, onLoad, mobileUA = null }) {
    logger.debug(`[IframeLoader] direct load ${url}`);
    if (mobileUA) {
      logger.debug('[IframeLoader] 直接 iframe 无法设置移动端 UA：' + url);
    }
    const iframe = el('iframe', {
      id: 'popup-panel-iframe',
      sandbox: this.sandbox.buildSandboxAttrs(hostname)
    });
    iframe.style.cssText = 'width:100%;height:100%;border:none;background:#fff;';
    let settled = false;
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
    iframe.addEventListener('load', () => {
      if (settled) return;
      container.querySelector('#popup-panel-loading')?.remove();
      container.classList.add('iframe-direct-load');
      finish(onLoad);
    });
    iframe.addEventListener('error', () => finish(onError, `加载 ${url} 失败。`));
    container.querySelector('#popup-panel-loading')?.remove();
    container.appendChild(iframe);
    iframe.src = url;
    return () => {
      clearTimeout(timer);
      iframe.src = 'about:blank';
      iframe.remove();
    };
  }
}
