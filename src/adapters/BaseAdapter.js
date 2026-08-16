export class BaseAdapter {
  constructor() {
    this.name = 'Base';
  }
  /** 当前页面是否属于该站点 */
  match(hostname, pathname) {
    return false;
  }
  /** 域名精确/子域名匹配：example.com 命中 example.com 与 www.example.com，但不命中 evil-example.com */
  matchDomain(hostname, domains) {
    return domains.some((d) => hostname === d || hostname.endsWith('.' + d));
  }
  /** 从点击事件的目标元素中解析出可打开的链接信息 */
  parseClick(event) {
    return null;
  }
  /** 对当前页面 DOM 应用视觉增强（添加 popup-trigger 类等） */
  enhance(doc, hostname, pathname) {
    return false;
  }
  /** 供子类使用的通用 URL 解析辅助 */
  resolveHref(href, base) {
    if (!href || href.startsWith('javascript:')) return null;
    try {
      return new URL(href, base).href;
    } catch {
      return null;
    }
  }
}
