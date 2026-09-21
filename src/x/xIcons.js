// X 图标：只读克隆 X 页面实时 DOM 里的 SVG，拿到与 X 像素级一致的图标。
// 只 cloneNode，绝不移动/修改 X 的节点；取不到时返回 null，由调用方降级（不显示图标）。

const SELECTORS = {
  reply: ['[data-testid="reply"] svg'],
  repost: ['[data-testid="retweet"] svg'],
  like: ['[data-testid="like"] svg'],
  bookmark: ['[data-testid="bookmark"] svg'],
  share: ['[data-testid="share"] svg'],
  views: ['[data-testid="analytics"] svg', 'a[href$="/analytics"] svg'],
  verified: ['[data-testid="icon-verified"] svg', 'svg[aria-label*="认证"]', 'svg[aria-label*="Verified"]']
};

const cache = new Map();

/** 取一枚 X 图标（每次返回新节点，可直接插入 DOM） */
export function xIcon(name) {
  const cached = cache.get(name);
  if (cached) return cached.cloneNode(true);
  let source = null;
  for (const selector of SELECTORS[name] || []) {
    try {
      source = document.querySelector(selector);
    } catch (err) {
      source = null;
    }
    if (source && String(source.tagName).toLowerCase() === 'svg') break;
    source = null;
  }
  // 未命中**不缓存**：X 的 DOM 随页面变化（「查看」图标基本只在详情页存在），
  // 一旦把「这次没找到」缓存成 null，整个会话里这枚图标都不会再出现
  if (!source) return null;
  const clone = source.cloneNode(true);
  // 尺寸交给我们自己的 CSS，避免 X 的内联宽高/样式带进来
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  clone.removeAttribute('style');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('focusable', 'false');
  cache.set(name, clone);
  return clone.cloneNode(true);
}

/** 预热：弹窗打开时 X 的帖子 DOM 一定在，一次性抓齐，避免渲染时逐枚查询 */
export function primeXIcons() {
  // 每次打开都重探（克隆一枚图标很便宜，缓存过期的代价却是整会话缺图标）
  cache.clear();
  for (const name of Object.keys(SELECTORS)) xIcon(name);
}
