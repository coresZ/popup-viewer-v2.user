export class UrlResolver {
  constructor(base = window.location.href) {
    this.base = base;
  }
  /**
   * 将任意 href 解析为绝对 URL，无法解析时返回 null。
   */
  resolve(href) {
    if (!href || typeof href !== 'string') return null;
    try {
      return new URL(href, this.base).href;
    } catch {
      return null;
    }
  }
  /**
   * 是否为当前页面内的锚点跳转（#xxx），这类点击不应拦截。
   */
  isSamePageAnchor(href) {
    const resolved = this.resolve(href);
    if (!resolved) return false;
    try {
      const current = new URL(this.base);
      const target = new URL(resolved);
      return (
        target.origin === current.origin &&
        target.pathname === current.pathname &&
        !!target.hash &&
        target.href !== current.href
      );
    } catch {
      return false;
    }
  }
  /**
   * 是否为可安全加载的 http(s) 地址。
   */
  isHttpUrl(href) {
    const resolved = this.resolve(href);
    if (!resolved) return false;
    return /^https?:$/i.test(new URL(resolved).protocol);
  }
  /**
   * 是否禁止拦截的危险协议（javascript:、data:、vbscript: 等）。
   */
  isDangerous(href) {
    if (!href) return false;
    const scheme = String(href).trim().split(':')[0].toLowerCase();
    return ['javascript', 'data', 'vbscript', 'file'].includes(scheme);
  }
}

export const urlResolver = new UrlResolver();
