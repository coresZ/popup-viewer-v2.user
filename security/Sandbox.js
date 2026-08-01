export class Sandbox {
  constructor(policy = {}) {
    this.policy = policy;
  }
  /**
   * 获取站点策略，未知站点回退到 unknown 策略。
   * 支持子域名匹配（如 www.1cili.com 命中 1cili.com 策略）。
   */
  policyFor(hostname) {
    if (!hostname) return this.policy.unknown || { iframe: false, scripts: false };
    if (this.policy[hostname]) return this.policy[hostname];
    for (const key of Object.keys(this.policy)) {
      if (key === 'unknown') continue;
      if (hostname.endsWith('.' + key)) return this.policy[key];
    }
    return this.policy.unknown || { iframe: false, scripts: false };
  }
  /**
   * 生成 sandbox 属性字符串。
   * scripts=true 时允许脚本执行；否则不包含 allow-scripts/allow-same-origin。
   */
  buildSandboxAttrs(hostname, extra = []) {
    const p = this.policyFor(hostname);
    const attrs = [
      'allow-forms',
      'allow-modals',
      'allow-pointer-lock',
      'allow-popups',
      'allow-presentation'
    ];
    if (p.scripts) {
      attrs.push('allow-same-origin', 'allow-scripts');
    }
    return [...attrs, ...extra].join(' ');
  }
  /**
   * 该站点是否允许直接 iframe 加载。
   */
  allowsIframe(hostname) {
    return this.policyFor(hostname).iframe === true;
  }
}

export function createDefaultSandbox(policy) {
  return new Sandbox(policy);
}
