// X 帖子加载器：GraphQL 原生渲染 + X 原生观感（双栏阅读器）+ 互动 + 翻译。
//   数据：src/x/xBridge.js（页面上下文网络层）+ src/x/xModel.js（数据层）
//   观感：src/x/xTheme.js（读取 X 实时样式做令牌）+ src/x/xIcons.js（克隆 X 实时图标）
//   版式：src/x/xRender.js（左原帖 / 右评论，各自滚动）
//   交互：点赞 / 转推 / 收藏 / 复制链接 / 纯文字回复 / 排序 / 滚动自动加载 / 图片放大 / 翻译
// 互动与翻译策略参照本地 peek 项目：乐观更新 + 失败回滚；翻译并发上限 2、按可见性懒翻译。

import { logger } from '../utils/logger.js';
import { el } from '../utils/dom.js';
import { showLoading } from '../ui/Loading.js';
import { installXBridge, pageWindow } from '../x/xBridge.js';
import { parseThreadSummary, postIdFromUrl, replyCursorAfterPage, shouldOfferTranslation, articleContentFromPayload } from '../x/xModel.js';
import { applyXSkin, watchXTheme } from '../x/xTheme.js';
import { primeXIcons } from '../x/xIcons.js';
import { createProfileCard } from '../x/xProfileCard.js';
import {
  renderReader,
  renderReply,
  renderTextBlock,
  openLightbox,
  paintAction,
  paintSort,
  notify,
  openUrlOf,
  profileUrlOf,
  FLAG_BY_ACTION
} from '../x/xRender.js';

// 窄于此宽度就切成上下堆叠（弹窗可自由缩放，故用内容区实测宽度而非视口）
const SINGLE_COLUMN_WIDTH = 640;
const COUNT_BY_ACTION = { reply: 'replies', repost: 'reposts', like: 'likes', bookmark: 'bookmarks' };
const ACTION_LABEL = { like: '点赞', repost: '转推', bookmark: '收藏' };
const TARGET_LANGUAGE = 'zh-cn';
const MAX_TRANSLATION_CONCURRENCY = 2;

/** 当前登录账号的头像与 @handle：取 X 左下角的账号切换按钮 */
function currentAccount() {
  const button = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
  const img = button && button.querySelector('img');
  const handleMatch = button && String(button.innerText || '').match(/@([A-Za-z0-9_]+)/);
  return {
    avatar: (img && (img.currentSrc || img.src)) || '',
    handle: handleMatch ? handleMatch[1] : ''
  };
}

export class XThreadLoader {
  /**
   * @param {Object} ctx { url, container, onError, onLoad, loadingSelector? }
   * @returns {Function} abort
   */
  load({ url, container, onError, onLoad, loadingSelector = '#popup-panel-loading' }) {
    const tweetId = postIdFromUrl(url);
    if (!tweetId) {
      onError('无法从链接解析出 X 帖子 ID。');
      return () => {};
    }
    const win = pageWindow();
    const bridge = installXBridge(win);
    if (!bridge) {
      onError('X 网络层未安装，请刷新 X 页面后重试。');
      return () => {};
    }

    const panel = document.getElementById('popup-content-panel');
    const account = currentAccount();
    const replies = [];
    const seen = new Set();
    const modelsById = new Map();
    let aborted = false;
    let cursor = null;
    let sortMode = 'relevant';
    let loadingMore = false;
    let readerEl = null;
    let replyList = null;
    let countLabel = null;
    let sortGroup = null;
    let composerView = null;
    let resizeObserver = null;
    let sentinelObserver = null;
    let sentinel = null;
    let profileCard = null;
    let replyTarget = null;

    // 翻译状态（与 peek 一致：默认自动翻译，缓存按 帖子ID:目标语言）
    const autoTranslate = true;
    const translationCache = new Map();
    const translationDisplay = new Map();
    const translationQueue = [];
    const queuedKeys = new Set();
    let activeTranslations = 0;
    let translationObserver = null;

    // X 观感：令牌取自 X 当前真实样式，主题切换时跟随
    primeXIcons();
    applyXSkin([panel, container]);
    panel?.classList.add('pv-x-skin');
    container.classList.add('pv-x-reader-mode');
    const stopThemeWatch = watchXTheme((theme) => applyXSkin([panel, container], theme));

    // 加载层：阅读器模式下内容区是 flex/滚动容器，loading 视图直接放进去会贴左，
    // 故套一层绝对定位的居中层（内容区本身是 position: relative）
    const loadingView = showLoading(container, { title: '正在通过 X 会话读取帖子...' });
    container.replaceChildren(el('div', { class: 'pv-x-loading-layer' }, loadingView));

    const syncLayout = () => {
      if (!readerEl) return;
      readerEl.classList.toggle('pv-x-single', container.clientWidth < SINGLE_COLUMN_WIDTH);
      // 窗体尺寸变化后资料卡位置会失效，重新贴回锚点
      profileCard?.reposition();
    };

    const cleanup = () => {
      aborted = true;
      stopThemeWatch();
      resizeObserver?.disconnect();
      resizeObserver = null;
      sentinelObserver?.disconnect();
      sentinelObserver = null;
      translationObserver?.disconnect();
      translationObserver = null;
      profileCard?.destroy();
      profileCard = null;
      container.classList.remove('pv-x-reader-mode');
      panel?.classList.remove('pv-x-skin');
      container.querySelector(loadingSelector)?.remove();
    };

    // ---------- 长文（Article）正文补全 ----------

    /**
     * TweetDetail 对长文帖有时只给封面与摘要，正文要另取一次 TweetResultByRestId。
     * 取不到不影响其它内容（失败静默）。
     */
    const hydrateArticle = async (model) => {
      if (!model || !model.attachment || model.attachment.type !== 'article') return false;
      if (model.attachment.content && model.attachment.content.blocks.length) return false;
      try {
        const json = await bridge.readArticle(model.id);
        const content = articleContentFromPayload(json);
        if (!content) return false;
        model.attachment.content = content;
        return true;
      } catch (err) {
        logger.debug('[XThreadLoader] article hydrate failed', err);
        return false;
      }
    };

    // ---------- 翻译 ----------

    const translationKey = (model) => `${model.id}:${TARGET_LANGUAGE}`;

    const refreshTranslation = (id) => {
      if (!readerEl) return;
      const model = modelsById.get(id);
      if (!model) return;
      for (const block of readerEl.querySelectorAll(`.pv-x-translatable[data-translation-id="${id}"]`)) {
        renderTextBlock(block, model, translationFor(model));
      }
    };

    const translationFor = (model) => ({
      offered: shouldOfferTranslation(model.text),
      entry: translationCache.get(translationKey(model)),
      display: translationDisplay.get(model.id) || (autoTranslate ? 'translation' : 'original'),
      onToggle: (next) => {
        translationDisplay.set(model.id, next);
        refreshTranslation(model.id);
      },
      onRetry: () => enqueueTranslation(model, true, true)
    });

    const pumpTranslations = () => {
      while (activeTranslations < MAX_TRANSLATION_CONCURRENCY && translationQueue.length) {
        const model = translationQueue.shift();
        const key = translationKey(model);
        queuedKeys.delete(key);
        activeTranslations += 1;
        translationCache.set(key, { status: 'loading' });
        refreshTranslation(model.id);
        bridge
          .translateTweet(model.id, TARGET_LANGUAGE)
          .then((result) => {
            const text = String((result && result.text) || '').trim();
            // 译文为空或与原文相同：说明这条不需要翻译
            if (!text || text === String(model.text || '').trim()) {
              translationCache.set(key, { status: 'unavailable' });
              return;
            }
            translationCache.set(key, {
              status: 'ready',
              text,
              sourceLanguage: String(result.sourceLanguage || ''),
              localizedSourceLanguage: String(result.localizedSourceLanguage || ''),
              destinationLanguage: String(result.destinationLanguage || TARGET_LANGUAGE)
            });
          })
          .catch((error) => {
            translationCache.set(key, { status: 'error', message: error && error.message ? error.message : '翻译失败' });
          })
          .finally(() => {
            activeTranslations -= 1;
            refreshTranslation(model.id);
            pumpTranslations();
          });
      }
    };

    const enqueueTranslation = (model, priority = false, force = false) => {
      if (!model || !shouldOfferTranslation(model.text)) return;
      const key = translationKey(model);
      const cached = translationCache.get(key);
      if (!force && cached && cached.status !== 'error') return;
      if (force) translationCache.delete(key);
      if (queuedKeys.has(key)) return;
      queuedKeys.add(key);
      translationCache.set(key, { status: 'queued' });
      if (priority) translationQueue.unshift(model);
      else translationQueue.push(model);
      refreshTranslation(model.id);
      pumpTranslations();
    };

    /** 原帖与上下文优先翻译；评论在滚动到附近时才翻译（并发上限 2，避免打爆接口） */
    const scheduleTranslationWork = () => {
      translationObserver?.disconnect();
      translationObserver = null;
      if (!readerEl) return;
      for (const model of modelsById.values()) {
        if (model.depth === undefined) enqueueTranslation(model, true);
      }
      const replyBlocks = [...readerEl.querySelectorAll('.pv-x-reply .pv-x-translatable')];
      if (!replyBlocks.length) return;
      if (typeof IntersectionObserver !== 'function') {
        for (const block of replyBlocks) enqueueTranslation(modelsById.get(block.dataset.translationId));
        return;
      }
      translationObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            translationObserver?.unobserve(entry.target);
            enqueueTranslation(modelsById.get(entry.target.dataset.translationId));
          }
        },
        // 评论列表是右栏唯一滚动区
        { root: replyList, rootMargin: '180px 0px', threshold: 0.01 }
      );
      for (const block of replyBlocks) translationObserver.observe(block);
    };

    // ---------- 作者资料卡与关注 ----------

    /** 把关注结果写回所有同一作者的模型（与 peek 一致：乐观 + 未确认标记） */
    const applyFollowState = (author, result) => {
      if (result && result.confirmed === false) {
        for (const model of modelsById.values()) {
          if (model.author && String(model.author.id) === String(author.id)) model.author.followStateUnconfirmed = true;
        }
        author.followStateUnconfirmed = true;
        return;
      }
      const active = Boolean(result.following);
      const nextFollowers = Number.isFinite(result.followers)
        ? result.followers
        : Math.max(0, Number(author.followers || 0) + Number(active) - Number(Boolean(author.viewerFollowing)));
      for (const model of modelsById.values()) {
        if (!model.author || String(model.author.id) !== String(author.id)) continue;
        model.author.viewerFollowing = active;
        model.author.followStateUnconfirmed = false;
        model.author.followRequestSent = Boolean(result.followRequestSent);
        model.author.followers = nextFollowers;
      }
      author.viewerFollowing = active;
      author.followStateUnconfirmed = false;
      author.followRequestSent = Boolean(result.followRequestSent);
      author.followers = nextFollowers;
    };

    const bindProfile = (node, model) => {
      if (!profileCard || !model || !model.author || !model.author.id) return;
      profileCard.bind(node, model.author, profileUrlOf(model));
    };

    // ---------- 渲染 ----------

    const sortedReplies = () => {
      if (sortMode === 'relevant') return replies;
      const copy = [...replies];
      if (sortMode === 'latest') copy.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      else copy.sort((a, b) => (Number(b.counts.likes) || 0) - (Number(a.counts.likes) || 0));
      return copy;
    };

    const updateCount = () => {
      if (countLabel) countLabel.textContent = `评论（${seen.size}）`;
    };

    const renderReplies = () => {
      if (!replyList) return;
      const scrollTop = replyList.scrollTop;
      replyList.replaceChildren();
      const list = sortedReplies();
      if (!list.length) {
        replyList.appendChild(el('div', { class: 'pv-x-empty', text: '这条帖子暂时没有可显示的评论' }));
      }
      for (const reply of list) {
        replyList.appendChild(
          renderReply(reply, {
            onAction: handleAction,
            onMedia: handleMedia,
            bindProfile,
            translation: translationFor(reply)
          })
        );
      }
      if (cursor) {
        sentinel = el('div', { class: 'pv-x-load-sentinel' }, el('span', { class: 'pv-x-loading', text: '正在加载更多评论...' }));
        replyList.appendChild(sentinel);
        observeSentinel();
      } else {
        sentinel = null;
      }
      if (replyList) replyList.scrollTop = scrollTop;
      markReplyTarget();
      scheduleTranslationWork();
    };

    const observeSentinel = () => {
      sentinelObserver?.disconnect();
      if (!sentinel || typeof IntersectionObserver !== 'function' || !replyList) return;
      sentinelObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) loadMore();
        },
        // 评论列表是右栏唯一滚动区
        { root: replyList, rootMargin: '0px 0px 240px 0px', threshold: 0.01 }
      );
      sentinelObserver.observe(sentinel);
    };

    // ---------- 回复目标（点评论的「回复」时高亮并定向回复） ----------

    const markReplyTarget = () => {
      if (!readerEl) return;
      for (const article of readerEl.querySelectorAll('article[data-reply-target="true"]')) {
        delete article.dataset.replyTarget;
      }
      if (!replyTarget) return;
      const article = readerEl.querySelector(`article[data-tweet-id="${replyTarget.id}"]`);
      if (article) article.dataset.replyTarget = 'true';
    };

    const setReplyTarget = (model) => {
      replyTarget = model && String(model.id) !== String(tweetId) ? model : null;
      composerView?.setTarget(replyTarget);
      markReplyTarget();
      composerView?.focus();
    };

    // ---------- 交互 ----------

    const handleMedia = (photos, index) => {
      if (!readerEl || !photos.length) return;
      openLightbox(readerEl, photos, index < 0 ? 0 : index, openUrlOf(modelsById.get(tweetId) || { id: tweetId }));
    };

    const handleAction = async (key, model, button) => {
      if (key === 'reply') {
        setReplyTarget(model);
        return;
      }
      if (key === 'share') {
        const target = openUrlOf(model);
        try {
          await navigator.clipboard.writeText(target);
          notify(readerEl, '链接已复制', 'ok');
        } catch (err) {
          notify(readerEl, `复制失败：${target}`, 'error');
        }
        return;
      }
      const flag = FLAG_BY_ACTION[key];
      const countKey = COUNT_BY_ACTION[key];
      if (!flag || !countKey) return;
      const wasActive = Boolean(model.flags[flag]);
      // 乐观更新：先改本地，X 拒绝再回滚
      model.flags[flag] = !wasActive;
      model.counts[countKey] = Math.max(0, (Number(model.counts[countKey]) || 0) + (wasActive ? -1 : 1));
      paintAction(button, model, key);
      try {
        await bridge.toggleAction(key, model.id, wasActive);
      } catch (err) {
        logger.warn(`[XThreadLoader] ${key} failed`, err);
        model.flags[flag] = wasActive;
        model.counts[countKey] = Math.max(0, (Number(model.counts[countKey]) || 0) + (wasActive ? 1 : -1));
        paintAction(button, model, key);
        notify(readerEl, `${ACTION_LABEL[key] || key}失败：${err && err.message ? err.message : err}`, 'error');
      }
    };

    const handleSort = (next, group) => {
      if (next === sortMode) return;
      sortMode = next;
      paintSort(group, next);
      renderReplies();
    };

    const submitReply = async (text, target) => {
      // 定向回复：点了某条评论的「回复」就回到那条，否则回主帖
      const inReplyTo = target && target.id ? String(target.id) : tweetId;
      await bridge.createReply(inReplyTo, text);
      const local = {
        id: `local-${Date.now()}`,
        text,
        createdAt: new Date().toISOString(),
        author: { name: account.handle ? `@${account.handle}` : '我', handle: account.handle, avatar: account.avatar, verified: false },
        counts: { replies: 0, likes: 0, reposts: 0, bookmarks: 0, views: 0 },
        flags: { liked: false, reposted: false, bookmarked: false },
        media: [],
        depth: target && target.depth !== undefined ? Math.min(Number(target.depth) + 1, 3) : 0,
        inReplyToId: inReplyTo
      };
      // 新回复固定显示在评论最前（与 peek 一致，便于立刻确认）
      replies.unshift(local);
      seen.add(local.id);
      modelsById.set(local.id, local);
      replyTarget = null;
      composerView?.setTarget(null);
      sortMode = 'relevant';
      paintSort(sortGroup, 'relevant');
      updateCount();
      renderReplies();
      notify(readerEl, target ? `已回复 @${(target.author && target.author.handle) || ''}` : '回复已发布', 'ok');
    };

    const loadMore = async () => {
      if (aborted || loadingMore || !cursor) return;
      loadingMore = true;
      const previousCursor = cursor;
      try {
        const json = await bridge.readThread(tweetId, previousCursor);
        if (aborted) return;
        const next = parseThreadSummary(json, tweetId);
        let added = 0;
        for (const reply of next.replies) {
          if (seen.has(reply.id)) continue;
          seen.add(reply.id);
          replies.push(reply);
          modelsById.set(reply.id, reply);
          added += 1;
        }
        cursor = replyCursorAfterPage(previousCursor, next.cursor, added);
        updateCount();
        renderReplies();
      } catch (err) {
        logger.warn('[XThreadLoader] load more failed', err);
        notify(readerEl, `加载更多评论失败：${err && err.message ? err.message : err}`, 'error');
      } finally {
        loadingMore = false;
      }
    };

    // ---------- 主流程 ----------

    (async () => {
      try {
        const json = await bridge.readThread(tweetId);
        if (aborted) return;
        const summary = parseThreadSummary(json, tweetId);
        if (!summary.focalFound) throw new Error('X 返回了数据，但没有找到这条原帖。');
        cursor = summary.cursor;
        modelsById.set(summary.focal.id, summary.focal);
        for (const ancestor of summary.ancestors) modelsById.set(ancestor.id, ancestor);
        for (const reply of summary.replies) {
          seen.add(reply.id);
          replies.push(reply);
          modelsById.set(reply.id, reply);
        }
        // 长文帖：先把正文补全再渲染，避免首屏只有封面
        await hydrateArticle(summary.focal);
        // 资料卡挂在阅读器根节点上，随弹窗关闭一起清理；须在渲染前创建，
        // 因为头像/昵称/@handle 的悬停绑定发生在渲染过程中
        profileCard = createProfileCard({
          getRoot: () => readerEl,
          onToggleFollow: async (author, nextActive) => {
            const result = await bridge.toggleFollow(author.id, nextActive);
            applyFollowState(author, result);
            return result;
          },
          onNotify: (message, tone) => notify(readerEl, message, tone === 'ok' ? 'ok' : 'error')
        });
        const built = renderReader({
          focal: summary.focal,
          ancestors: summary.ancestors,
          replyCount: seen.size,
          openUrl: openUrlOf(summary.focal),
          onAction: handleAction,
          onSort: handleSort,
          onSubmitReply: submitReply,
          onMedia: handleMedia,
          translationFor,
          bindProfile,
          composerAvatar: account.avatar
        });
        readerEl = built.reader;
        replyList = built.list;
        countLabel = built.countLabel;
        sortGroup = built.sort;
        composerView = built.composer;
        container.replaceChildren(readerEl);
        syncLayout();
        if (typeof ResizeObserver === 'function') {
          resizeObserver = new ResizeObserver(syncLayout);
          resizeObserver.observe(container);
        }
        updateCount();
        renderReplies();
        onLoad?.();
      } catch (err) {
        if (aborted) return;
        logger.warn('[XThreadLoader] read thread failed', err);
        // 错误态由弹窗自己的视图渲染，先摘掉阅读器布局
        container.classList.remove('pv-x-reader-mode');
        onError?.(`${err && err.message ? err.message : err}（X 的接口会变动，可点下方按钮改用新标签页打开）`);
      }
    })();

    return cleanup;
  }
}
