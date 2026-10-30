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
      if (settled) return;
      // 部分站点（Discourse/linux.do）页面已经可见，但 iframe 的 load 事件被
      // 长连接/客户端路由拖住：同源时地址已不是 about:blank，直接按加载成功处理。
      try {
        const href = iframe.contentWindow && iframe.contentWindow.location.href;
        if (href && href !== 'about:blank') {
          container.querySelector(loadingSelector)?.remove();
          container.classList.add('iframe-direct-load');
          finish(onLoad);
          return;
        }
      } catch {
        // 跨域文档已经提交（location 读取被安全策略拒绝），同样按已加载处理，
        // 不再用错误页覆盖用户已经看到的界面。
        container.querySelector(loadingSelector)?.remove();
        container.classList.add('iframe-direct-load');
        finish(onLoad);
        return;
      }
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
      // 忽略初次插入 iframe 时的 about:blank load：否则会把真正的页面 load
      // 当成「iframe 内部跳转」，导致 linux.do 这类站点 15 秒后被超时错误覆盖。
      try {
        if (iframe.contentWindow && iframe.contentWindow.location.href === 'about:blank') return;
      } catch {}
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
    // 先设置 src 再挂载，避免插入时浏览器先产生一次 about:blank load。
    iframe.src = url;
    container.appendChild(iframe);
    return () => {
      clearTimeout(timer);
      clearInterval(pollTimer);
      iframe.src = 'about:blank';
      iframe.remove();
    };
  }
}
