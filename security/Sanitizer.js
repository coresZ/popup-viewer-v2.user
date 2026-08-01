export class Sanitizer {
  constructor() {
    this.removedTags = new Set([
      'script',
      'iframe',
      'frame',
      'frameset',
      'object',
      'embed',
      'applet',
      'form',
      'link',
      'meta',
      'base',
      'noscript'
    ]);
    this.dangerousEventAttrs = /^on[a-z]+$/i;
  }
  /**
   * 净化 HTML 字符串。
   * @param {string} html 原始 HTML
   * @param {string} [baseUrl] 用于绝对化样式链接
   * @param {Object} [options]
   * @param {boolean} [options.keepScripts=false] 保留 <script>（仅信任站点，需在沙箱 iframe 中渲染）
   * @returns {{head:string, body:string}} head 为保留的样式标签，body 为净化后的内容。
   */
  sanitize(html, baseUrl, options = {}) {
    if (!html) return { head: '', body: '' };
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const head = this._collectHead(doc, baseUrl);
    this._purge(doc, options);
    return { head, body: doc.body ? doc.body.innerHTML : '' };
  }
  /**
   * 收集原页面的样式（stylesheet 链接与 head 中的 <style> 块），
   * 并对样式链接做绝对化，避免因丢失 <base> 导致 CSS 404。
   * 样式链接可能位于 head 或 body（如淘股吧），需全文档收集。
   */
  _collectHead(doc, baseUrl) {
    const parts = [];
    const seen = new Set();
    const pick = (node) => {
      const key = node.outerHTML;
      if (seen.has(key)) return;
      seen.add(key);
      const clone = node.cloneNode(true);
      if (clone.tagName === 'LINK' && clone.getAttribute('href')) {
        try {
          clone.setAttribute('href', new URL(clone.getAttribute('href'), baseUrl).href);
        } catch {}
      }
      parts.push(clone.outerHTML);
    };
    doc.querySelectorAll('link[rel], head style').forEach((node) => {
      if (node.tagName === 'LINK') {
        const rel = (node.getAttribute('rel') || '').toLowerCase();
        const href = (node.getAttribute('href') || '').toLowerCase();
        const isStyle =
          rel.includes('stylesheet') ||
          href.endsWith('.css') ||
          (rel.includes('preload') && (node.getAttribute('as') || '').toLowerCase() === 'style');
        if (!isStyle) return;
      }
      pick(node);
    });
    return parts.join('');
  }
  _purge(doc, { keepScripts = false } = {}) {
    const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
    const toRemove = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.COMMENT_NODE) {
        toRemove.push(node);
        continue;
      }
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      const isScript = tag === 'script';
      if (this.removedTags.has(tag) && !(keepScripts && isScript)) {
        toRemove.push(node);
        continue;
      }
      this._sanitizeAttrs(node);
    }
    for (const node of toRemove) node.parentNode?.removeChild(node);
  }
  _sanitizeAttrs(node) {
    const attrs = node.attributes;
    if (!attrs || !attrs.length) return;
    for (let i = attrs.length - 1; i >= 0; i--) {
      const name = attrs[i].name;
      const value = attrs[i].value;
      if (this.dangerousEventAttrs.test(name)) {
        node.removeAttribute(name);
        continue;
      }
      if (name.toLowerCase() === 'srcdoc') {
        node.removeAttribute(name);
        continue;
      }
      if (name === 'href' || name === 'src') {
        const scheme = String(value).trim().split(':')[0].toLowerCase();
        if (['javascript', 'data', 'vbscript', 'file'].includes(scheme)) {
          node.removeAttribute(name);
        }
      }
    }
  }
}

export const sanitizer = new Sanitizer();
