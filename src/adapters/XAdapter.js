import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '../utils/logger.js';

// X（原 Twitter）站点适配器 —— spike 版：
// 目标是在 x.com 帖子列表/详情页里点击帖子时，用弹窗（同源 iframe 直载）打开，
// 而不跳走。解析规则参考本地 peek 项目（Chrome 扩展，MIT）已实测的选择器：
//   article[data-testid="tweet"]、[data-testid="User-Name"]、[data-testid="tweetText"]、
//   引用帖卡片为 [role="link"][tabindex="0"] 且同时含身份与内容节点。
// 引用帖优先于外层主帖：点引用卡片要打开被引用的那条，而不是外层帖。

const X_DOMAINS = ['x.com', 'twitter.com'];
// /{handle}/status/{id}，兼容 /i/web/status/{id} 这类内部路径
const STATUS_PATTERN = /^\/(?:i\/web\/)?([^/?#]+)\/status\/(\d+)/i;
const PROFILE_PATTERN = /^\/([A-Za-z0-9_]+)\/?$/;

export class XAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'X';
  }

  match(hostname) {
    return this.matchDomain(hostname, X_DOMAINS);
  }

  /** 规范化帖子地址：统一为 https://x.com/{handle}/status/{id} */
  normalizePostUrl(href, base = window.location.href) {
    if (!href || typeof href !== 'string') return null;
    let url;
    try {
      url = new URL(href, base);
    } catch {
      return null;
    }
    if (!this.match(url.hostname.replace(/^www\./i, ''))) return null;
    const m = url.pathname.match(STATUS_PATTERN);
    if (!m) return null;
    return `https://x.com/${m[1]}/status/${m[2]}`;
  }

  /** 顶层页面当前是否已经是帖子详情页 */
  isDetailPage() {
    return Boolean(this.normalizePostUrl(window.location.href));
  }

  /**
   * 从点击事件解析出应打开的帖子。
   * @returns {{url:string,title:string,element:Element}|null}
   */
  parseClick(event) {
    // 中键/修饰键交给浏览器原生行为（新标签页等）
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return null;
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return null;
    const article = target.closest('article[data-testid="tweet"]');
    if (!article) return null;
    // 嵌套的引用帖 article 由外层 article 统一处理，避免重复解析
    if (!this.isTopLevelTweet(article)) return null;
    // 点赞/转发/收藏按钮、输入框、视频、图片灯箱等交互目标不拦截
    if (this.shouldSkipTarget(target)) return null;

    const quoteScope = this.findClickedQuoteScope(article, target);
    // 已经在详情页时保留 X 原生交互，只有点引用帖卡片才开弹窗
    if (this.isDetailPage() && !quoteScope) return null;

    const quotedUrl = quoteScope ? this.findQuotedPostUrl(article, quoteScope) : null;
    const anchor = target.closest('a[href*="/status/"]');
    const outerUrl = this.findPostUrl(article);
    const url = quotedUrl || this.normalizePostUrl(anchor && anchor.getAttribute('href')) || outerUrl;
    if (!url) return null;
    const scope = quoteScope || article;
    return { url, title: this.titleOf(scope), element: article };
  }

  /** 视觉增强：X 的列表是虚拟化 React 树，这里不做任何 DOM 改写，避免与其渲染冲突 */
  enhance() {
    return false;
  }

  // ---------- 内部：X DOM 解析 ----------

  isTopLevelTweet(article) {
    try {
      return !article.parentElement?.closest('article[data-testid="tweet"]');
    } catch {
      return true;
    }
  }

  shouldSkipTarget(target) {
    if (target.closest('button, input, textarea, select, [contenteditable="true"], video')) return true;
    if (target.closest('[data-testid="tweetPhoto"]')) return true;
    const anchor = target.closest('a[href]');
    // 点了非帖子链接（用户主页/话题/外链等）时不拦截，保持原生行为
    return Boolean(anchor && !this.normalizePostUrl(anchor.getAttribute('href')));
  }

  /** 引用帖卡片：X 用 role=link 的 div 包住，内部同时有身份与内容节点 */
  isQuotedPostLink(node) {
    const hasIdentity = node?.querySelector?.('[data-testid="Tweet-User-Avatar"], [data-testid="User-Name"]');
    const hasQuotedContent = node?.querySelector?.(
      '[data-testid="tweetText"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="article-cover-image"]'
    );
    return Boolean(node?.matches?.('[role="link"][tabindex="0"]') && hasIdentity && hasQuotedContent);
  }

  findClickedQuoteScope(article, target) {
    let current = target;
    while (current && current !== article) {
      if (this.isQuotedPostLink(current)) return current;
      current = current.parentElement;
    }
    return null;
  }

  authorProfileHref(scope) {
    const userName = scope.querySelector('[data-testid="User-Name"]');
    return (
      [...(userName?.querySelectorAll('a[href]') || [])]
        .map((a) => a.getAttribute('href'))
        .find((href) => PROFILE_PATTERN.test(href || '')) || null
    );
  }

  statusLinks(scope) {
    return [...(scope?.querySelectorAll?.('a[href*="/status/"]') || [])]
      .map((a) => this.normalizePostUrl(a.getAttribute('href')))
      .filter(Boolean);
  }

  /** 一个作用域内可能同时含外层帖与引用帖的链接，按作者 handle 选出属于本作用域的那条 */
  selectOwnPostUrl(hrefs, profileHref) {
    const unique = [...new Set(hrefs.filter(Boolean))];
    const handle = String(profileHref || '').match(PROFILE_PATTERN)?.[1]?.toLowerCase() || null;
    if (!handle) return unique[0] || null;
    return (
      unique.find((u) => {
        try {
          return new URL(u).pathname.split('/')[1]?.toLowerCase() === handle;
        } catch {
          return false;
        }
      }) ||
      unique[0] ||
      null
    );
  }

  findPostUrl(article) {
    return this.selectOwnPostUrl(this.statusLinks(article), this.authorProfileHref(article));
  }

  findQuotedPostUrl(article, quoteScope) {
    const ownUrl = this.findPostUrl(article);
    const direct = quoteScope.matches('a[href*="/status/"]')
      ? this.normalizePostUrl(quoteScope.getAttribute('href'))
      : null;
    return [direct, ...this.statusLinks(quoteScope)].find((u) => u && u !== ownUrl) || null;
  }

  titleOf(scope) {
    try {
      const name = scope.querySelector('[data-testid="User-Name"]')?.innerText?.split('\n')?.[0]?.trim();
      const text = scope.querySelector('[data-testid="tweetText"]')?.innerText?.trim();
      if (name && text) return `${name}: ${text.slice(0, 60)}`;
      return name || (text ? text.slice(0, 60) : '') || 'X 帖子';
    } catch (err) {
      logger.debug('[XAdapter] title parse failed', err);
      return 'X 帖子';
    }
  }
}
