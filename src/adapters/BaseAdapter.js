export class BaseAdapter {
  constructor() {
    this.name = 'Base';
  }
  /** 当前页面是否属于该站点 */
  match(hostname, pathname) {
    return false;
  }
  /** 从点击事件的目标元素中解析出可打开的链接信息 */
  parseClick(event) {
    return null;
  }
  /** 返回该站点可增强的链接选择器列表 */
  getEnhanceSelectors() {
    return [];
  }
  /** 对某个 DOM 元素应用视觉增强（添加 popup-trigger 类等） */
  enhance(element) {
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
