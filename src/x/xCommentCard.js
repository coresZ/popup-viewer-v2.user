import { el, svgIcon, eventPath } from '../utils/dom.js';
import { logger } from '../utils/logger.js';
import { renderReply, syncThreadLines } from './xRender.js';
import { formatCount, relativeTime, sinceLabel } from './xFormat.js';

const CARD_WIDTH = 340;
const CARD_GAP = 8;
const CARD_MAX_HEIGHT = 340;
const CARD_MIN_HEIGHT = 96;
// 锚点被滚动带走超过这个距离才收卡（翻译完成等引起的滚动锚定只会挪几个像素）
const SCROLL_CLOSE_DISTANCE = 24;

/**
 * 小巧评论卡：点帖子头部时间右侧的 💬 图标弹出。
 *
 * 定位硬规则：**卡片只在右侧评论栏内活动**，绝不越过中线压到左侧主贴。
 * 因为右栏是滚动容器（绝对定位会被它裁掉并跟着滚），卡片挂在 `.pv-x-reader` 上，
 * 用右栏的 rect 反算位置并夹紧：left ≥ 栏左边 + 8、right ≤ 栏右边 − 8。
 *
 * 垂直方向夹在 getBounds() 给出的区域里（评论列表的可见部分），所以**不会盖住回复框和工具行**。
 *
 * 缓存：命中缓存直接渲染，**不出现"正在读取…"**；头部 ⟳ 才重新请求（失败保留旧内容）。
 * 键盘事件挂在卡片自己身上（打开即聚焦）；document 级只在打开期间挂一个 pointerdown。
 *
 * @param {Object} ctx
 * @param {() => HTMLElement} ctx.getRoot 卡片挂载的容器（.pv-x-reader，自身不滚动）
 * @param {() => {top:number,bottom:number,left:number,right:number}|null} ctx.getBounds 可用区域（视口坐标）
 * @param {(id:string) => Promise<{post:Object,replies:Object[],depths?:Map,url:string}>} ctx.load
 * @param {(model:Object) => number} [ctx.replyCountOf] 标题里的回复数（与列表入口同一来源）
 */
export function createCommentCard({
  getRoot,
  getBounds,
  load,
  onAction = null,
  bindProfile = null,
  onOpenExternal = null,
  replyCountOf = null
}) {
  let layer = null;
  let card = null;
  let body = null;
  let head = null;
  let refreshButton = null;
  let anchorNode = null;
  let currentId = '';
  let refreshing = false;
  const cache = new Map();
  // 定位时锚点的视口 top：滚动时比较它，判断是用户在滚还是滚动锚定的小幅修正
  let anchorTopAtPlace = null;
  let scrollRoot = null;

  const cardAction = onAction
    ? (key, model, node) => {
        if (key === 'reply') close('reply');
        return onAction(key, model, node);
      }
    : null;

  const isOpen = () => Boolean(card);

  const place = () => {
    if (!card || !layer) return;
    const root = getRoot();
    const bounds = getBounds && getBounds();
    if (!root || !bounds) return;
    const rootRect = root.getBoundingClientRect();
    const paneWidth = bounds.right - bounds.left;
    if (paneWidth <= 0) return;
    // 宽度：栏够宽时 340，栏窄时贴栏（两侧各留 8）
    const width = Math.max(180, Math.min(CARD_WIDTH, paneWidth - CARD_GAP * 2));
    card.style.width = `${Math.round(width)}px`;

    // 水平：右对齐；左边界由栏的左边界兜住 —— 结构上不可能盖到左栏
    const paneRight = bounds.right - rootRect.left;
    const right = Math.max(rootRect.width - paneRight + CARD_GAP, CARD_GAP);
    card.style.right = `${Math.round(right)}px`;
    card.style.left = 'auto';

    // 垂直可用区：评论列表的可见部分（上沿在回复框/工具行之下）
    const paneTop = Math.max(bounds.top, rootRect.top) - rootRect.top;
    const paneBottom = Math.min(bounds.bottom, rootRect.bottom) - rootRect.top;
    // maxHeight = min(340, 可用高 − 16)；可用区太矮时保底 96（宁可内部滚动也不越过上沿）
    const maxHeight = Math.max(CARD_MIN_HEIGHT, Math.min(CARD_MAX_HEIGHT, paneBottom - paneTop - CARD_GAP * 2));
    card.style.maxHeight = `${Math.round(maxHeight)}px`;

    // 贴在入口下方；下方不够就向上翻转；仍不够则夹在区内（卡片内部滚动）
    const measured = Math.min(card.offsetHeight || 220, maxHeight);
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
    const maxTop = paneBottom - 8 - measured;
    // 上沿永远不高于可用区上沿：回复框和工具行不会被盖住
    const finalTop = Math.max(paneTop + 8, Math.min(top, maxTop));
    card.style.top = `${Math.round(finalTop)}px`;
    // 被夹过位置时箭头就指不准了，不画
    card.dataset.arrow = arrow && Math.abs(finalTop - top) < 1 ? arrow : 'none';
    anchorTopAtPlace = anchorNode && anchorNode.isConnected ? anchorNode.getBoundingClientRect().top : null;
  };

  const paintHead = (data) => {
    if (!head) return;
    head.replaceChildren();
    // 标题计数与列表里的「查看 N 条回复」同一来源（模型 counts.replies）
    const count = data ? (replyCountOf && data.post ? replyCountOf(data.post) : data.replies.length) : 0;
    const title = el('span', { class: 'pv-x-card-title' });
    title.appendChild(el('b', { text: data ? (count ? `${formatCount(count)} 条回复` : '暂无回复') : '回复' }));
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
    closeButton.addEventListener('click', () => close('button'));
    head.appendChild(closeButton);
  };

  const retryButton = (label) => {
    const button = el('button', { class: 'pv-x-card-retry', type: 'button', text: label });
    button.addEventListener('click', () => {
      const id = currentId;
      if (!id) return;
      cache.delete(id);
      startLoad(id);
    });
    return button;
  };

  const paintBody = (data, error) => {
    if (!body) return;
    body.replaceChildren();
    body.removeAttribute('aria-busy');
    if (error) {
      body.appendChild(
        el(
          'div',
          { class: 'pv-x-card-state pv-x-card-state-error', role: 'alert' },
          el('span', { text: `读取失败：${error.message || error}` }),
          retryButton('重试')
        )
      );
      return;
    }
    if (!data) {
      // 加载态：带 spinner，读屏能感知忙碌
      body.setAttribute('aria-busy', 'true');
      body.appendChild(
        el('div', { class: 'pv-x-card-state pv-x-card-loading', role: 'status' }, el('span', { class: 'pv-x-card-spinner', 'aria-hidden': 'true' }), '正在读取回复…')
      );
      return;
    }
    if (!data.replies.length) {
      body.appendChild(el('div', { class: 'pv-x-card-state', text: '这条还没有回复' }));
      return;
    }
    const depths = data.depths || new Map();
    for (const reply of data.replies) {
      const depth = depths.has(reply.id) ? depths.get(reply.id) : reply.depth;
      // 卡片里的回复动作：先关卡片再交给回复框，避免卡片盖住回复框
      body.appendChild(renderReply(reply, { onAction: cardAction, bindProfile, compact: true, depth }));
    }
    const byId = new Map(data.replies.map((reply) => [reply.id, reply]));
    syncThreadLines([...body.querySelectorAll('.pv-x-reply')], (id) => byId.get(id));
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
    // 再点同一个入口：收起（焦点留在入口上）
    if (card && currentId === id && anchor && anchor === anchorNode) {
      close('toggle');
      return;
    }
    if (anchorNode && anchorNode !== anchor) anchorNode.setAttribute('aria-expanded', 'false');
    anchorNode = anchor || null;
    anchorNode?.setAttribute('aria-expanded', 'true');
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
    await startLoad(id);
  }

  /** 显示加载态并请求；失败时显示「重试」 */
  async function startLoad(id) {
    if (!card) return;
    paintHead(null);
    paintBody(null);
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
      depths: result.depths || null,
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
      if (currentId === id && body) {
        body.querySelector('.pv-x-card-refresh-error')?.remove();
        const note = el(
          'div',
          { class: 'pv-x-card-state pv-x-card-state-error pv-x-card-refresh-error', role: 'alert' },
          el('span', { text: `刷新失败：${err.message || err}` })
        );
        const again = el('button', { class: 'pv-x-card-retry', type: 'button', text: '重试' });
        again.addEventListener('click', () => refresh());
        note.appendChild(again);
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
    close('escape');
  };

  /**
   * 点卡片以外关闭。用 composedPath（外壳迁进 Shadow DOM 后 event.target 会被重定向到宿主）。
   * 资料卡、大图灯箱虽然挂在卡片外，但都是从卡片里打开的，算「卡内」。
   */
  const onDocPointer = (event) => {
    if (!card) return;
    for (const node of eventPath(event)) {
      if (node === card || node === anchorNode) return;
      if (node && node.nodeType === 1 && node.classList && (node.classList.contains('pv-x-profile-card') || node.classList.contains('pv-x-media-lightbox'))) return;
    }
    close('outside');
  };

  /**
   * 滚动时收卡：在阅读器上用捕获阶段监听（单栏时滚的是 .pv-x-columns，双栏时是 .pv-x-reply-list）。
   * 卡片自己、资料卡、灯箱内部的滚动不算；锚点只挪了几个像素（滚动锚定）也不算。
   */
  const onRootScroll = (event) => {
    if (!card) return;
    const target = event.target;
    if (target && target.nodeType === 1) {
      if (card.contains(target)) return;
      if (target.closest && target.closest('.pv-x-profile-card, .pv-x-media-lightbox')) return;
    }
    if (anchorNode && anchorNode.isConnected && anchorTopAtPlace !== null) {
      const moved = Math.abs(anchorNode.getBoundingClientRect().top - anchorTopAtPlace);
      if (moved < SCROLL_CLOSE_DISTANCE) return;
    }
    close('scroll');
  };

  function mount() {
    const root = getRoot();
    if (!root) return;
    layer = el('div', { class: 'pv-x-card-layer' });
    card = el('div', { class: 'pv-x-card', role: 'dialog', 'aria-label': '回复', tabindex: '-1' });
    head = el('div', { class: 'pv-x-card-head' });
    body = el('div', { class: 'pv-x-card-body' });
    card.append(head, body);
    card.addEventListener('keydown', onKeydown);
    card.addEventListener('click', (event) => event.stopPropagation());
    layer.appendChild(card);
    root.appendChild(layer);
    scrollRoot = root;
    // 点卡片以外关闭 / 滚动收卡：只在打开期间挂，关闭即摘
    document.addEventListener('pointerdown', onDocPointer, true);
    scrollRoot.addEventListener('scroll', onRootScroll, { capture: true, passive: true });
    requestAnimationFrame(() => card && card.classList.add('visible'));
    try {
      card.focus({ preventScroll: true });
    } catch (err) {
      card.focus();
    }
  }

  /** 焦点当前是否在卡片里（穿透 shadow root 取真实的 activeElement） */
  const focusInside = (node) => {
    let active = node.getRootNode ? node.getRootNode().activeElement : document.activeElement;
    if (!active) active = document.activeElement;
    return Boolean(active && (active === node || node.contains(active)));
  };

  /**
   * @param {'escape'|'button'|'outside'|'reply'|'scroll'|'toggle'|'destroy'} [reason]
   * Esc / 关闭按钮 / 焦点在卡内时：焦点还给打开它的入口。
   * 点卡外、点「回复」（焦点要去回复框）、销毁：不动焦点。
   */
  function close(reason = 'button') {
    if (!card) return;
    const cardNode = card;
    const layerNode = layer;
    const trigger = anchorNode;
    const restoreFocus =
      reason !== 'outside' && reason !== 'reply' && reason !== 'destroy' && reason !== 'toggle' && (reason !== 'scroll' || focusInside(cardNode));
    card = null;
    body = null;
    head = null;
    refreshButton = null;
    currentId = '';
    anchorNode = null;
    anchorTopAtPlace = null;
    layer = null;
    document.removeEventListener('pointerdown', onDocPointer, true);
    scrollRoot?.removeEventListener('scroll', onRootScroll, { capture: true });
    scrollRoot = null;
    trigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && trigger && trigger.isConnected) {
      try {
        trigger.focus({ preventScroll: true });
      } catch (err) {
        trigger.focus();
      }
    }
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
    /** 某条帖子的缓存失效（例如刚给它发了回复） */
    invalidate(id) {
      cache.delete(String(id || ''));
    },
    destroy() {
      cache.clear();
      close('destroy');
    }
  };
}

/** 行内相对时间（旧名保留，实现统一在 xFormat.relativeTime） */
export { relativeTime as cardStamp };
