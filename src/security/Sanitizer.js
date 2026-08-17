import { markMod } from '../utils/debugFlag.js';
markMod('Sanitizer');

// 懒加载图片真实地址属性：Discuz 系 zoomfile/file 最权威（占位图 none.gif），
// 其次各站通用 data-* 懒加载属性。净化阶段与渲染兜底阶段共用，避免两处漂移。
export const REAL_SRC_ATTRS = [
  'zoomfile',
  'file',
  'data-src',
  'data-original',
  'data-lazy-src',
  'data-actualsrc',
  'data-src-real',
  'data-real-src',
  'data-url',
  'data-large',
  'data-big',
  'data-hd-src',
  'data-original-src',
  'data-echo',
  'data-lazyload',
  'data-lazy-load',
  'data-full',
  'data-img'
];

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
    this._resolveLazyImages(doc, baseUrl);
    return { head, body: doc.body ? doc.body.innerHTML : '' };
  }
  /**
   * 解析懒加载图片：真实地址常放在 data-original/data-src/data-srcset 等各类 data 属性里，
   * src 多为占位图（懒加载 JS 被净化后不会执行）。只要找到真实地址就换到 src 并绝对化，
   * 不依赖对「占位图文件名」的精确识别——各站点占位图命名千差万别，正则穷举必然漏。
   */
  static PLACEHOLDER_RE = /^(data:|about:|blob:)/i;
  _resolveLazyImages(doc, baseUrl) {
    doc.querySelectorAll('img').forEach((img) => {
      const real = this._firstRealAttr(img);
      if (real) {
        const resolved = this._absolutize(real, baseUrl);
        if (resolved) img.setAttribute('src', resolved);
        this._clearRealAttrs(img);
        img.classList.remove('lazy');
        img.loading = 'lazy';
        return;
      }
      if (this._resolveSrcset(img, baseUrl)) {
        this._clearRealAttrs(img);
        img.classList.remove('lazy');
        img.loading = 'lazy';
      }
    });
  }
  _firstRealAttr(img) {
    for (const attr of REAL_SRC_ATTRS) {
      const value = img.getAttribute(attr);
      if (value && value.trim()) return value.trim();
    }
    return null;
  }
  _absolutize(value, baseUrl) {
    if (!value) return null;
    if (/^(javascript|vbscript|file):/i.test(value.trim())) return null;
    try {
      return new URL(value, baseUrl || undefined).href;
    } catch {
      return value;
    }
  }
  /**
   * 处理 data-srcset / data-original-set：绝对化并写回 srcset；
   * src 仍是占位图时用第一个候选作为兜底 src。返回是否处理过。
   */
  _resolveSrcset(img, baseUrl) {
    const raw = img.getAttribute('data-srcset') || img.getAttribute('data-original-set');
    if (!raw) return false;
    const absolute = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const parts = entry.split(/\s+/);
        const url = parts[0];
        if (!url) return entry;
        try {
          return new URL(url, baseUrl || undefined).href + (parts.length > 1 ? ' ' + parts.slice(1).join(' ') : '');
        } catch {
          return entry;
        }
      });
    if (absolute.length) img.setAttribute('srcset', absolute.join(', '));
    img.removeAttribute('data-srcset');
    img.removeAttribute('data-original-set');
    const cur = (img.getAttribute('src') || '').trim();
    const first = absolute[0] ? absolute[0].split(/\s+/)[0] : null;
    if (first && (!cur || Sanitizer.PLACEHOLDER_RE.test(cur))) img.setAttribute('src', first);
    return true;
  }
  _clearRealAttrs(img) {
    for (const attr of REAL_SRC_ATTRS) img.removeAttribute(attr);
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
      const name = attrs[i].name.toLowerCase();
      const value = attrs[i].value;
      if (this.dangerousEventAttrs.test(name)) {
        node.removeAttribute(attrs[i].name);
        continue;
      }
      if (name === 'srcdoc') {
        node.removeAttribute(attrs[i].name);
        continue;
      }
      // 链接/导航类：禁止 javascript:/data:/vbscript:/file:（含 SVG xlink:href）
      if (name === 'href' || name === 'xlink:href') {
        const scheme = String(value).trim().split(':')[0].toLowerCase();
        if (['javascript', 'data', 'vbscript', 'file'].includes(scheme)) {
          node.removeAttribute(attrs[i].name);
        }
      }
      // 媒体类：允许 data: URI（图片/海报无害），仅拦截可执行代码或读本地文件的协议
      if (name === 'src' || name === 'poster' || name === 'background') {
        const scheme = String(value).trim().split(':')[0].toLowerCase();
        if (['javascript', 'vbscript', 'file'].includes(scheme)) {
          node.removeAttribute(attrs[i].name);
        }
      }
    }
  }
}

export const sanitizer = new Sanitizer();
