import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { gm } from '../utils/gm.js';
import { sanitizer } from '../security/Sanitizer.js';
import { clear } from '../utils/dom.js';
import { settingsManager } from '../core/SettingsManager.js';

export class ParserLoader {
  load({ url, hostname, keepScripts, container, onError, onLoad, mobileUA = null }) {
    logger.debug(`[ParserLoader] fetch & parse ${url}`);
    const abort = gm.xmlhttpRequest({
      method: 'GET',
      url,
      timeout: config.loader.timeout,
      ...(mobileUA ? { headers: { 'User-Agent': mobileUA } } : {}),
      onload: (response) => {
        if (response.status !== 200) {
          onError(`加载失败 (HTTP ${response.status})`);
          return;
        }
        try {
          const { body: sanitizedBody } = sanitizer.sanitize(response.responseText, url);
          const doc = new DOMParser().parseFromString(
            `<!DOCTYPE html><html><body>${sanitizedBody}</body></html>`,
            'text/html'
          );
          this._absolutize(doc, url);
          const body = clear(container);
          const wrap = doc.body;
          while (wrap.firstChild) body.appendChild(wrap.firstChild);
          container.classList.remove('iframe-direct-load');
          onLoad?.();
        } catch (error) {
          logger.error('[ParserLoader] parse error', error);
          onError('内容解析失败: ' + error.message);
        }
      },
      onerror: (error) => {
        logger.error('[ParserLoader] request error', error);
        onError('网络请求失败');
      }
    });
    return () => {
      try {
        abort?.abort?.();
      } catch {}
    };
  }
  _absolutize(doc, baseUrl) {
    const base = baseUrl;
    doc.querySelectorAll('[href],[src],[poster],[data-src]').forEach((node) => {
      ['href', 'src', 'poster', 'data-src'].forEach((attr) => {
        const raw = node.getAttribute(attr);
        if (!raw || /^(javascript|data|mailto|tel|#):/i.test(raw.trim())) return;
        try {
          node.setAttribute(attr, new URL(raw, base).href);
        } catch {}
      });
    });
    doc.querySelectorAll('a[href]').forEach((link) => {
      if (settingsManager.get().linkIntercept !== false) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });
    doc.querySelectorAll('img').forEach((img) => {
      img.loading = img.loading || 'lazy';
    });
  }
}
