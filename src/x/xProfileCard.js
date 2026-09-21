// X 作者资料卡：鼠标悬停头像/昵称/@handle 停顿 1 秒后弹出，与 X 的行为一致。
// 行为移植自本地 peek 项目（MIT，Copyright (c) 2026 xuntianx）的 content.js：
//   - 悬停 1s 出现、移开 650ms 消失，鼠标移到卡片上不闪
//   - 关注/取关：乐观禁用 + 结果核对，未确认时按钮变「查看状态」并跳 X 个人资料页
// 卡片的关注状态由加载器统一写回所有同一作者的模型（见 XThreadLoader.applyFollowState）。

import { el } from '../utils/dom.js';
import { xIcon } from './xIcons.js';

// 悬停后停顿 1 秒再弹出（避免扫过时误触发）；移开后 650ms 收起
const SHOW_DELAY = 1000;
const HIDE_DELAY = 650;

function formatCount(value) {
  const n = Number(value) || 0;
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 10000).toFixed(1)}万`;
}

function profileHref(author) {
  return author.handle ? `https://x.com/${author.handle}` : `https://x.com/i/user/${author.id}`;
}

/**
 * @param {Object} ctx
 * @param {() => HTMLElement} ctx.getRoot 卡片挂载的容器（延迟取，避免与渲染顺序耦合）
 * @param {(author:Object, nextActive:boolean)=>Promise<Object>} ctx.onToggleFollow
 * @param {(message:string, tone?:string)=>void} ctx.onNotify
 */
export function createProfileCard({ getRoot, onToggleFollow, onNotify }) {
  let card = null;
  let cardKey = '';
  let anchor = null;
  let showTimer = null;
  let hideTimer = null;

  const keyOf = (author) => String(author.id || author.handle || '');

  const clearTimers = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = null;
    hideTimer = null;
  };

  const remove = () => {
    clearTimers();
    card?.remove();
    card = null;
    cardKey = '';
    anchor = null;
  };

  const scheduleHide = () => {
    clearTimers();
    hideTimer = setTimeout(remove, HIDE_DELAY);
  };

  /**
   * 卡片定位：**相对阅读器绝对定位**，不用视口坐标。
   * 坑：`#popup-content-panel` 带 `transform: translate(-50%,-50%)` 做居中，
   * 于是面板成了 `position: fixed` 后代的包含块——按视口坐标算出来的位置会整体偏掉。
   * 改成相对 `.pv-x-reader`（position: relative）定位即可免疫该问题。
   */
  const position = (node, target) => {
    const root = getRoot();
    if (!node?.isConnected || !target?.isConnected || !root) return;
    const rootRect = root.getBoundingClientRect();
    const anchorRect = target.getBoundingClientRect();
    const cardRect = node.getBoundingClientRect();
    const gap = 4;
    const pad = 8;
    const maxLeft = Math.max(pad, rootRect.width - cardRect.width - pad);
    const left = Math.min(Math.max(pad, anchorRect.left - rootRect.left), maxLeft);
    const below = anchorRect.bottom - rootRect.top + gap;
    const top = below + cardRect.height <= rootRect.height - pad ? below : Math.max(pad, anchorRect.top - rootRect.top - cardRect.height - gap);
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  };

  const followButton = (author, cardNode) => {
    if (!author.id) return null;
    const button = el(
      'button',
      { class: 'pv-x-profile-follow', type: 'button' },
      el('span', { class: 'pv-x-profile-follow-default' }),
      el('span', { class: 'pv-x-profile-follow-hover', text: '取消关注' })
    );
    const refresh = () => {
      const following = Boolean(author.viewerFollowing);
      const pending = !following && Boolean(author.followRequestSent);
      const uncertain = Boolean(author.followStateUnconfirmed);
      const label = uncertain ? '查看状态' : following ? '正在关注' : pending ? '已请求' : '关注';
      button.dataset.following = String(following && !uncertain);
      button.disabled = pending && !uncertain;
      button.title = uncertain
        ? '请求已提交，点击在 X 个人资料页核对状态'
        : pending
          ? '关注请求待批准，可在 X 个人资料页管理'
          : '';
      button.querySelector('.pv-x-profile-follow-default').textContent = label;
      button.setAttribute('aria-label', `${label} @${author.handle || author.name || 'X 用户'}`);
      const followers = cardNode.querySelector('.pv-x-profile-followers-count');
      if (followers) followers.textContent = formatCount(author.followers) || '0';
    };
    refresh();
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      if (author.followStateUnconfirmed) {
        window.open(profileHref(author), '_blank', 'noopener');
        return;
      }
      const nextActive = !Boolean(author.viewerFollowing);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      try {
        const result = await onToggleFollow(author, nextActive);
        refresh();
        if (result && result.confirmed === false) {
          onNotify?.('请求已提交，状态暂未同步，可点「查看状态」核对', 'info');
        } else if (result && result.following) {
          onNotify?.(`已关注 @${author.handle}`, 'ok');
        } else if (result && result.followRequestSent) {
          onNotify?.(`已发送关注请求 @${author.handle}`, 'ok');
        } else if (nextActive) {
          onNotify?.(`X 当前显示尚未关注 @${author.handle}`, 'info');
        } else {
          onNotify?.(`已取消关注 @${author.handle}`, 'ok');
        }
      } catch (err) {
        onNotify?.(err && err.message ? err.message : '关注操作失败', 'error');
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        refresh();
      }
    });
    return button;
  };

  const build = (author, href) => {
    const node = el('section', {
      class: 'pv-x-profile-card',
      role: 'dialog',
      'aria-label': `${author.name || author.handle || 'X 用户'} 的账号资料`
    });
    const top = el('div', { class: 'pv-x-profile-top' });
    const avatarLink = el('a', { class: 'pv-x-profile-avatar', href, target: '_blank', rel: 'noreferrer' });
    if (author.avatar) avatarLink.appendChild(el('img', { src: author.avatar, alt: author.name || author.handle || '' }));
    top.appendChild(avatarLink);
    const follow = followButton(author, node);
    if (follow) top.appendChild(follow);

    const nameRow = el('a', { class: 'pv-x-profile-name', href, target: '_blank', rel: 'noreferrer' });
    nameRow.appendChild(el('strong', { text: author.name || author.handle || 'X 用户' }));
    if (author.verified) {
      const badge = xIcon('verified');
      if (badge) nameRow.appendChild(el('span', { class: 'pv-x-badge' }, badge));
    }
    const handleRow = el('a', {
      class: 'pv-x-profile-handle',
      href,
      target: '_blank',
      rel: 'noreferrer',
      text: `@${author.handle || 'unknown'}`
    });
    node.append(top, nameRow, handleRow);
    if (author.followsViewer) node.appendChild(el('div', { class: 'pv-x-profile-follows-you', text: '关注了你' }));
    if (author.description) node.appendChild(el('p', { class: 'pv-x-profile-bio', text: author.description }));

    const stats = el('div', { class: 'pv-x-profile-stats' });
    const followingLink = el('a', { href: `${href.replace(/\/$/, '')}/following`, target: '_blank', rel: 'noreferrer' });
    followingLink.append(el('strong', { text: formatCount(author.followingCount) || '0' }), document.createTextNode(' 正在关注'));
    const followersLink = el('a', { href: `${href.replace(/\/$/, '')}/verified_followers`, target: '_blank', rel: 'noreferrer' });
    followersLink.append(
      el('strong', { class: 'pv-x-profile-followers-count', text: formatCount(author.followers) || '0' }),
      document.createTextNode(' 关注者')
    );
    stats.append(followingLink, followersLink);
    node.appendChild(stats);

    node.appendChild(
      el('a', {
        class: 'pv-x-profile-summary',
        href: `https://x.com/i/grok?text=${encodeURIComponent(`请总结 @${author.handle || ''} 的个人资料`)}`,
        target: '_blank',
        rel: 'noreferrer',
        text: '个人资料概要'
      })
    );

    // 鼠标移到卡片上不消失
    node.addEventListener('pointerenter', clearTimers);
    node.addEventListener('pointerleave', scheduleHide);
    node.addEventListener('focusin', () => clearTimeout(hideTimer));
    node.addEventListener('focusout', scheduleHide);
    return node;
  };

  const show = (author, href, target) => {
    const root = getRoot();
    if (!root || !target.isConnected) return;
    const key = keyOf(author);
    if (card?.isConnected && cardKey === key) {
      anchor = target;
      position(card, target);
      return;
    }
    remove();
    card = build(author, href);
    cardKey = key;
    anchor = target;
    root.appendChild(card);
    position(card, target);
  };

  /** 给头像/昵称/@handle 绑定悬停与聚焦 */
  const bind = (node, author, href) => {
    if (!node || !author) return;
    node.classList.add('pv-x-profile-trigger');
    node.setAttribute('aria-haspopup', 'dialog');
    node.addEventListener('pointerenter', () => {
      clearTimers();
      if (card?.isConnected && cardKey === keyOf(author)) {
        anchor = node;
        position(card, node);
        return;
      }
      showTimer = setTimeout(() => show(author, href, node), SHOW_DELAY);
    });
    node.addEventListener('pointerleave', scheduleHide);
    node.addEventListener('focus', () => show(author, href, node));
    node.addEventListener('blur', scheduleHide);
  };

  return {
    bind,
    remove,
    destroy: remove,
    // 弹窗尺寸变化后卡片位置会失效，重新贴回锚点
    reposition: () => {
      if (card && anchor) position(card, anchor);
    }
  };
}
