import { logger } from '../utils/logger.js';
import { el } from '../utils/dom.js';
import { settingsManager } from '../core/SettingsManager.js';

export function renderIntoIframe({ html, url, container, sandboxAttrs, head = '', linkIntercept, loadingSelector = '#popup-panel-loading' }) {
  container.querySelector(loadingSelector)?.remove();
  container.classList.add('iframe-direct-load');
  const iframe = el('iframe', {
    id: 'popup-panel-iframe',
    sandbox: sandboxAttrs
  });
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:#fff;';
  container.appendChild(iframe);
  const iframeDoc = iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(buildDocument(html, url, head));
  iframeDoc.close();
  iframe.addEventListener('load', () => {
    try {
      fixLinks(iframeDoc, linkIntercept);
      injectReadStyle(iframeDoc);
    } catch (err) {
      logger.error('[renderIntoIframe] manipulate error', err);
    }
  });
  if (iframeDoc.readyState === 'complete') iframe.dispatchEvent(new Event('load'));
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
    return u.origin ? u.origin + u.pathname : u.pathname;
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
