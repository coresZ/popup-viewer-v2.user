import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { gm } from '../utils/gm.js';
import { sanitizer } from '../security/Sanitizer.js';
import { contentSandboxAttrs } from '../security/Sandbox.js';
import { renderIntoIframe } from './IframeRenderer.js';

export class RequestLoader {
  load({ url, hostname, keepScripts = false, container, onError, onLoad, mobileUA = null, linkIntercept, loadingSelector, onNavigate }) {
    logger.debug(`[RequestLoader] fetch ${url}`);
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
          const result = sanitizer.sanitize(response.responseText, url, { keepScripts });
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
        } catch (error) {
          logger.error('[RequestLoader] process content error', error);
          onError('内容解析失败: ' + error.message);
        }
      },
      onerror: (error) => {
        logger.error('[RequestLoader] request error', error);
        onError('网络请求失败');
      }
    });
    return () => {
      try {
        abort?.abort?.();
      } catch {}
      const iframe = container.querySelector('#popup-panel-iframe');
      iframe?.remove();
    };
  }
}
