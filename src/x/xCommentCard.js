import { el, svgIcon } from '../utils/dom.js';
import { logger } from '../utils/logger.js';
import { renderPost, renderReply } from './xRender.js';

/** 相对时间：更新于 x 分钟前（用于卡片头部，让人知道看的是不是旧数据） */
function sinceLabel(at) {
  if (!at) return '';
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 45) return '刚刚更新';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前更新`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前更新`;
  return `${Math.round(hours / 24)} 天前更新`;
}

function stamp(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 1e9) return Date.now() - value;
  const ms = Date.parse(String(value || ''));
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}小时`;
  return `${Math.round(hours / 24)}天`;
}

const CARD_WIDTH = 340;
const CARD_GAP = 8;
const CARD_MAX_HEIGHT = 340;

/**
 * 小巧评论卡：点帖子头部时间右侧的 💬 图标弹出。
 *
 * 定位硬规则：**卡片只在右侧评论栏内活动**，绝不越过中线压到左侧主贴。
 * 因为右栏是滚动容器（绝对定位会被它裁掉并跟着滚），卡片挂在 `.pv-x-reader` 上，
 * 用右栏的 rect 反算位置并夹紧：left ≥ 栏左边 + 8、right ≤ 栏右边 − 8。
 *
 * 缓存：命中缓存直接渲染，**不出现"正在读取…"**；头部 ⟳ 才重新请求（失败保留旧内容）。
 * 无全局监听：键盘事件挂在卡片自己身上（打开即聚焦），随弹窗销毁。
 */
export function createCommentCard({ getRoot, getPane, load, onAction = null, bindProfile = null, onOpenExternal = null }) {
  let layer = null;
  let card = null;
  let body = null;
  let head = null;
  let refreshButton = null;
  let anchorNode = null;
  let currentId = '';
  let refreshing = false;
  const cache = new Map();

  const isOpen = () => Boolean(card);
  const current = () => currentId;

  const place = () => {
    if (!card || !layer) return;
    const root = getRoot();
    const pane = getPane && getPane();
    if (!root || !pane) return;
    const rootRect = root.getBoundingClientRect();
    const paneRect = pane.getBoundingClientRect();
    const paneWidth = paneRect.width;
    if (!paneWidth) return;
    // 宽度：栏够宽时 340，栏窄时贴栏（两侧各留 8）
    const width = Math.max(180, Math.min(CARD_WIDTH, paneWidth - CARD_GAP * 2));
    card.style.width = `${Math.round(width)}px`;
    card.style.maxHeight = `${CARD_MAX_HEIGHT}px`;

    // 水平：右对齐；左边界由栏的左边界兜住 —— 结构上不可能盖到左栏
    const paneLeft = paneRect.left - rootRect.left;
    const paneRight = paneRect.right - rootRect.left;
    const right = Math.max(rootRect.width - paneRight + CARD_GAP, CARD_GAP);
    card.style.right = `${Math.round(right)}px`;
    card.style.left = 'auto';

    // 垂直：贴在被点图标下方；下方不够就向上翻转；仍不够则夹在栏内（卡片内部滚动）
    const measured = card.offsetHeight || 220;
    const paneTop = paneRect.top - rootRect.top;
    const paneBottom = paneRect.bottom - rootRect.top;
    let top = paneTop + 8;
    let arrow = null;
    if (anchorNode && anchorNode.isConnected) {
      const anchorRect = anchorNode.getBoundingClientRect();
      const anchorCenter = anchorRect.left + anchorRect.width / 2 - rootRect.left;
      const anchorBottom = anchorRect.bottom - rootRect.top;
      const anchorTop = anchorRect.top - rootRect.top;
      const below = anchorBottom + 6;
      const above = anchorTop - 6 - measured;
      if (below + measured <= paneBottom - 8) {
        top = below;
        arrow = 'up';
      } else if (above >= paneTop + 8) {
        top = above;
        arrow = 'down';
      } else {
        top = Math.max(paneTop + 8, Math.min(below, paneBottom - 8 - measured));
      }
      // 箭头跟着图标走，但夹在卡片内
      const cardLeft = paneRight - right - width;
      const arrowLeft = Math.max(14, Math.min(anchorCenter - cardLeft, width - 14));
      card.style.setProperty('--pv-card-arrow-left', `${Math.round(arrowLeft)}px`);
    }
    const maxTop = paneBottom - 8 - Math.min(measured, CARD_MAX_HEIGHT);
    card.style.top = `${Math.round(Math.max(paneTop + 8, Math.min(top, maxTop)))}px`;
    card.dataset.arrow = arrow || 'none';
  };

  const paintHead = (data) => {
    if (!head) return;
    head.replaceChildren();
    const count = data ? data.replies.length : 0;
    const title = el('span', { class: 'pv-x-card-title' });
    title.appendChild(el('b', { text: count ? `${count} 条回复` : '暂无回复' }));
    if (data && data.at) title.appendChild(el('span', { class: 'pv-x-card-when', text: `· ${sinceLabel(data.at)}` }));
    head.appendChild(title);

    refreshButton = el('button', {
      class: 'pv-x-card-btn pv-x-card-refresh',
      type: 'button',
      title: '重新读取',
      'aria-label': '重新读取'
    });
    const icon = svgIcon('refresh', { size: 13 });
    if (icon) refreshButton.appendChild(icon);
    refreshButton.addEventListener('click', () => refresh());
    head.appendChild(refreshButton);

    const closeButton = el('button', {
      class: 'pv-x-card-btn pv-x-card-close',
      type: 'button',
      title: '关闭',
      'aria-label': '关闭',
      text: '✕'
    });
    closeButton.addEventListener('click', close);
    head.appendChild(closeButton);
  };

  const paintBody = (data, error) => {
    if (!body) return;
    body.replaceChildren();
    if (error) {
      body.appendChild(el('div', { class: 'pv-x-card-state', text: `读取失败：${error.message || error}` }));
      return;
    }
    if (!data) return;
    if (!data.replies.length) {
      body.appendChild(el('div', { class: 'pv-x-card-state', text: '这条还没有回复' }));
      return;
    }
    for (const reply of data.replies) {
      body.appendChild(renderReply(reply, { onAction, bindProfile, compact: true }));
    }
  };

  const paintFoot = (data) => {
    if (!card) return;
    const old = card.querySelector('.pv-x-card-foot');
    if (old) old.remove();
    const url = data && data.url;
    if (!url) return;
    const foot = el('a', {
      class: 'pv-x-card-foot',
      href: url,
      target: '_blank',
      rel: 'noreferrer',
      text: '在 X 打开 ›'
    });
    if (onOpenExternal) {
      foot.addEventListener('click', () => onOpenExternal(url));
    }
    card.appendChild(foot);
  };

  /** 首次进入才请求；命中缓存直接渲染（不闪加载态） */
  async function open(model, anchor) {
    const id = String((model && model.id) || '');
    if (!id) return;
    anchorNode = anchor || null;
    currentId = id;
    if (!card) mount();
    if (!card) return;
    place();
    const cached = cache.get(id);
    if (cached) {
      paintHead(cached);
      paintBody(cached);
      paintFoot(cached);
      place();
      return;
    }
    paintHead(null);
    body.replaceChildren(el('div', { class: 'pv-x-card-state', text: '正在读取…' }));
    paintFoot(null);
    place();
    try {
      const data = await fetchData(id);
      if (currentId !== id) return;
      paintHead(data);
      paintBody(data);
      paintFoot(data);
      place();
    } catch (err) {
      logger.warn('[xCommentCard] load failed', err);
      if (currentId === id) paintBody(null, err);
    }
  }

  async function fetchData(id) {
    const result = await load(id);
    const data = {
      at: Date.now(),
      post: result.post,
      replies: result.replies || [],
      url: result.url || ''
    };
    cache.set(id, data);
    return data;
  }

  /** 手动刷新：只重新请求当前这条；失败时保留旧内容 */
  async function refresh() {
    const id = currentId;
    if (!id || refreshing) return;
    refreshing = true;
    refreshButton?.classList.add('pv-x-card-busy');
    try {
      const data = await fetchData(id);
      if (currentId !== id || !card) return;
      paintHead(data);
      paintBody(data);
      paintFoot(data);
      place();
    } catch (err) {
      logger.warn('[xCommentCard] refresh failed', err);
      if (currentId === id) {
        const note = el('div', { class: 'pv-x-card-state pv-x-card-state-error', text: `刷新失败：${err.message || err}` });
        body.prepend(note);
      }
    } finally {
      refreshing = false;
      refreshButton?.classList.remove('pv-x-card-busy');
    }
  }

  const onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    // 先于弹窗处理：否则 Esc 会把整个弹窗关掉
    event.stopPropagation();
    event.preventDefault();
    close();
  };

  const onDocPointer = (event) => {
    if (!card) return;
    if (card.contains(event.target)) return;
    if (anchorNode && anchorNode.contains(event.target)) return;
    close();
  };

  function mount() {
    const root = getRoot();
    if (!root) return;
    layer = el('div', { class: 'pv-x-card-layer' });
    card = el('div', { class: 'pv-x-card', role: 'dialog', 'aria-label': '评论', tabindex: '-1' });
    head = el('div', { class: 'pv-x-card-head' });
    body = el('div', { class: 'pv-x-card-body' });
    card.append(head, body);
    card.addEventListener('keydown', onKeydown);
    card.addEventListener('click', (event) => event.stopPropagation());
    layer.appendChild(card);
    root.appendChild(layer);
    // 点卡片以外关闭：只在打开期间挂，关闭即摘（不长期占着 document）
    document.addEventListener('pointerdown', onDocPointer, true);
    requestAnimationFrame(() => card && card.classList.add('visible'));
    try {
      card.focus({ preventScroll: true });
    } catch (err) {
      card.focus();
    }
  }

  function close() {
    if (!card) return;
    const cardNode = card;
    const layerNode = layer;
    card = null;
    body = null;
    head = null;
    refreshButton = null;
    currentId = '';
    anchorNode = null;
    layer = null;
    document.removeEventListener('pointerdown', onDocPointer, true);
    cardNode.classList.remove('visible');
    // 等淡出结束再摘；先把引用清空，避免这期间重新打开时误删新节点
    setTimeout(() => {
      cardNode.remove();
      if (layerNode) layerNode.remove();
    }, 160);
  }

  return {
    open,
    close,
    isOpen,
    current: () => currentId,
    /** 面板尺寸/布局变化后由调用方通知，重新夹紧位置 */
    reposition: place,
    destroy() {
      cache.clear();
      close();
    }
  };
}

export { stamp as cardStamp };
