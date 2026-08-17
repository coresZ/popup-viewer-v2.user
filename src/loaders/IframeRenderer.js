import { logger } from '../utils/logger.js';
import { el } from '../utils/dom.js';
import { settingsManager } from '../core/SettingsManager.js';
import { REAL_SRC_ATTRS } from '../security/Sanitizer.js';

/**
 * 读取 iframe 当前地址与标题（仅同源可读；跨域/空白页返回 null）。
 * 用于追踪弹窗内 iframe 的自主跳转（前进/后退历史）。
 */
export function readIframeLocation(iframe) {
  try {
    const win = iframe.contentWindow;
    if (!win || !win.location || !win.location.href) return null;
    const href = win.location.href;
    if (!href || href === 'about:blank') return null;
    let title = '';
    try {
      title = (iframe.contentDocument && iframe.contentDocument.title) || '';
    } catch (e) {}
    return { url: href, title };
  } catch (e) {
    return null;
  }
}

export function renderIntoIframe({ html, url, container, sandboxAttrs, head = '', linkIntercept, loadingSelector = '#popup-panel-loading', onNavigate }) {
  container.querySelector(loadingSelector)?.remove();
  container.classList.add('iframe-direct-load');
  const iframe = el('iframe', {
    id: 'popup-panel-iframe',
    sandbox: sandboxAttrs
  });
  // 标记自己的弹窗 iframe：即使开启「在 iframe 中运行」，也不在其中重复注入脚本
  try {
    iframe.contentWindow.__PV2_OWN_IFRAME__ = true;
  } catch {}
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:#fff;';
  container.appendChild(iframe);
  const iframeDoc = iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(buildDocument(html, url, head));
  iframeDoc.close();
  const runFixes = () => {
    if (!iframe.isConnected || !iframe.contentWindow) return;
    try {
      // 用实时 document（iframe 内部跳转后是新文档，同样需要链接修复/样式/图片兜底）
      const doc = iframe.contentDocument;
      if (!doc) return;
      fixLinks(doc, linkIntercept);
      injectReadStyle(doc);
      fixImages(doc);
    } catch (err) {
      logger.error('[renderIntoIframe] manipulate error', err);
    }
  };
  // 首次 load = 初始内容渲染；之后每次 load = iframe 内部自主跳转，上报给历史
  let firstLoad = true;
  iframe.addEventListener('load', () => {
    runFixes();
    if (firstLoad) {
      firstLoad = false;
      return;
    }
    if (onNavigate) {
      const loc = readIframeLocation(iframe);
      if (loc) onNavigate(loc.url, loc.title);
    }
  });
  if (iframeDoc.readyState === 'complete') iframe.dispatchEvent(new Event('load'));
  // 图片可能晚于 load 事件失败/未触发加载，延迟再做两轮恢复
  [1500, 3500].forEach((delay) => setTimeout(runFixes, delay));
  return iframe;
}

function buildDocument(html, url, head = '') {
  const baseHref = buildBaseHref(url);
  return (
    '<!DOCTYPE html><html><head><base href="' +
    baseHref +
    '"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Content</title>' +
    head +
    '</head><body>' +
    html +
    '</body></html>'
  );
}

function buildBaseHref(url) {
  try {
    const u = new URL(url);
    let base = u.origin ? u.origin + u.pathname : u.pathname;
    // 无扩展名的路径按目录对待，补斜杠避免相对图片路径被拼到错误的父级
    if (!/\.[a-z0-9]+$/i.test(u.pathname) && !u.pathname.endsWith('/')) base += '/';
    return base;
  } catch {
    return url;
  }
}

function fixLinks(iframeDoc, linkIntercept) {
  const openNewTab = linkIntercept !== undefined ? linkIntercept : settingsManager.get().linkIntercept !== false;
  iframeDoc.querySelectorAll('a[href]').forEach((link) => {
    if (openNewTab) link.target = '_blank';
    const href = link.getAttribute('href');
    if (!href || href.trim().startsWith('javascript:')) return;
    try {
      link.href = new URL(href, iframeDoc.baseURI).href;
    } catch {}
  });
}

function injectReadStyle(iframeDoc) {
  const style = iframeDoc.createElement('style');
  style.textContent =
    'body{font-family:Segoe UI,sans-serif;padding:10px;word-wrap:break-word;overflow-wrap:break-word;overscroll-behavior:contain;}img,video,iframe{max-width:100%;height:auto;}a{color:#007bff;text-decoration:none;}a:hover{text-decoration:underline;}a:visited{color:#6a0dad;}';
  iframeDoc.head.insertBefore(style, iframeDoc.head.firstChild);
}

/**
 * 图片恢复兜底：净化阶段可能漏掉的懒加载属性在此再抢救一次；
 * 已失败/未触发的图片强制 eager 加载并重试一轮。
 */
function fixImages(iframeDoc) {
  iframeDoc.querySelectorAll('img').forEach((img) => {
    img.loading = 'eager';
    const cur = img.getAttribute('src') || '';
    // src 为 1x1 占位图（Discuz none.gif、懒加载占位等）也算未显示，
    // 否则 naturalWidth=1 会绕过 naturalWidth===0 的判定导致真实图永不加载
    const isPlaceholderSrc =
      !cur || /(?:none|placeholder|loading|blank|spacer|1x1|pixel)(?:\.gif|\.png|\.jpg|\.jpeg|\.webp)?$/i.test(cur);
    if (isPlaceholderSrc || (img.complete && img.naturalWidth === 0)) {
      for (const attr of REAL_SRC_ATTRS) {
        const value = img.getAttribute(attr);
        if (value && value.trim()) {
          try {
            img.src = new URL(value.trim(), iframeDoc.baseURI).href;
          } catch {
            img.src = value.trim();
          }
          img.removeAttribute(attr);
          break;
        }
      }
    }
    const dsrcset = img.getAttribute('data-srcset') || img.getAttribute('data-original-set');
    if (dsrcset) {
      const first = dsrcset.split(',')[0].trim().split(/\s+/)[0];
      if (first) {
        try {
          img.src = new URL(first, iframeDoc.baseURI).href;
        } catch {
          img.src = first;
        }
      }
      img.removeAttribute('data-srcset');
      img.removeAttribute('data-original-set');
    }
    if (img.complete && img.naturalWidth === 0 && img.src && !/^data:/i.test(img.src)) {
      const s = img.src;
      img.src = '';
      img.src = s;
    }
  });
}
