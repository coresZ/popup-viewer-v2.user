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
      // 允许弹窗/新标签页逃逸沙箱：右键「用 Google 搜索」等需在新标签页打开，
      // 否则会被加载进弹窗 iframe 内，被目标站 X-Frame-Options 拒绝
      'allow-popups-to-escape-sandbox',
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

/**
 * 生成「抓取净化后注入内容」所用 iframe 的 sandbox 属性。
 * 注入/后处理需要访问 iframe 文档，故始终保留 allow-same-origin；
 * 但仅当 keepScripts=true（信任站点）时才允许脚本执行，
 * 否则即使净化有遗漏，也无法运行脚本或访问父页面。
 */
export function contentSandboxAttrs(keepScripts = false) {
  const attrs = [
    'allow-forms',
    'allow-modals',
    'allow-pointer-lock',
    'allow-popups',
    'allow-popups-to-escape-sandbox',
    'allow-presentation',
    'allow-same-origin'
  ];
  if (keepScripts) attrs.push('allow-scripts');
  return attrs.join(' ');
}
