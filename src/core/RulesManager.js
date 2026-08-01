import { gm } from '../utils/gm.js';

const KEY = 'pv2:rules';

export class RulesManager {
  constructor() {
    this.rules = {};
    this._loaded = false;
  }
  load() {
    if (this._loaded) return this.rules;
    this._loaded = true;
    const raw = gm.getValue(KEY, {});
    if (raw && typeof raw === 'object') {
      this.rules = {};
      for (const [host, list] of Object.entries(raw)) {
        if (Array.isArray(list)) {
          this.rules[host] = list
            .filter((r) => r && typeof r.selector === 'string' && r.selector.trim())
            .map((r) => ({ selector: r.selector.trim() }));
        }
      }
    }
    return this.rules;
  }
  getRules(hostname) {
    return this.load()[hostname] || [];
  }
  addRule(hostname, selector) {
    const rules = this.getRules(hostname);
    if (!rules.some((r) => r.selector === selector)) {
      rules.push({ selector });
      this.load()[hostname] = rules;
      this._persist();
    }
    return rules;
  }
  removeRule(hostname, index) {
    const rules = this.getRules(hostname);
    rules.splice(index, 1);
    this.load()[hostname] = rules;
    this._persist();
    return rules;
  }
  _persist() {
    gm.setValue(KEY, this.rules);
  }
  /**
   * 命中当前站点用户规则的链接。
   * @returns {{url:string,title:string,element:Element}|null}
   */
  match(event, hostname) {
    const rules = this.getRules(hostname);
    if (!rules.length) return null;
    for (const rule of rules) {
      let el = null;
      try {
        el = event.target.closest ? event.target.closest(rule.selector) : null;
      } catch {
        el = null;
      }
      if (!el) continue;
      const link = this._extractLink(el);
      if (link) return link;
    }
    return null;
  }
  _extractLink(el) {
    const get = (a) => (el.getAttribute ? el.getAttribute(a) : null);
    // 1) a[href]
    if (el.tagName === 'A') {
      const href = get('href');
      const url = this._resolve(href);
      if (url) return { url, title: el.title || (el.textContent || '').trim() || '查看内容', element: el };
    }
    // 2) data-topic-url / data-href
    const dataUrl = get('data-topic-url') || get('data-href');
    if (dataUrl) {
      const url = this._resolve(dataUrl);
      if (url) {
        return {
          url,
          title: el.title || (el.textContent || '').trim().slice(0, 60) || '查看内容',
          element: el
        };
      }
    }
    // 3) 内部或最近的 a[href]
    const inner = el.querySelector ? el.querySelector('a[href]') : null;
    if (inner) {
      const url = this._resolve(inner.getAttribute('href'));
      if (url) return { url, title: inner.title || (inner.textContent || '').trim() || '查看内容', element: inner };
    }
    const outer = el.closest ? el.closest('a[href]') : null;
    if (outer) {
      const url = this._resolve(outer.getAttribute('href'));
      if (url) return { url, title: outer.title || (outer.textContent || '').trim() || '查看内容', element: outer };
    }
    return null;
  }
  _resolve(href) {
    if (!href || typeof href !== 'string') return null;
    try {
      return new URL(href, window.location.href).href;
    } catch {
      return null;
    }
  }
}

export const rulesManager = new RulesManager();
