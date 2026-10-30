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
import {
  parseThreadSummary,
  postIdFromUrl,
  replyCursorAfterPage,
  shouldOfferTranslation,
  articleContentFromPayload,
  fullTextFromPayload,
  tweetFromCreateResponse,
  mergeModel
} from '../x/xModel.js';
import { formatCount } from '../x/xFormat.js';
import { replyDrafts } from '../x/xDrafts.js';
import { applyXSkin, watchXTheme } from '../x/xTheme.js';
import { primeXIcons } from '../x/xIcons.js';
import { createProfileCard } from '../x/xProfileCard.js';
import { createCommentCard } from '../x/xCommentCard.js';
import {
  renderReader,
  renderReply,
  renderTextBlock,
  paintAction,
  paintSort,
  paintRepliesLink,
  syncThreadLines,
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
  const text = String((button && button.innerText) || '');
  const handleMatch = text.match(/@([A-Za-z0-9_]+)/);
  // 按钮文字是「昵称\n@handle」：取 @ 之前的第一行做昵称
  const name = text.split('\n').map((line) => line.trim()).find((line) => line && !line.startsWith('@')) || '';
  return {
    avatar: (img && (img.currentSrc || img.src)) || '',
    handle: handleMatch ? handleMatch[1] : '',
    name
  };
}

export class XThreadLoader {
  /**
   * @param {Object} ctx { url, container, onError, onLoad }
   * @returns {Function} abort
   */
  load({ url, container, onError, onLoad }) {
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

    // 从内容区往上找面板（外壳迁入 Shadow DOM 后 document.getElementById 找不到它）
    const panel = (container.closest && container.closest('#popup-content-panel')) || null;
    const account = currentAccount();
    const replies = [];
    const seen = new Set();
    // 同一条推文全阅读器只有一个模型对象（列表、评论卡、点赞状态共用）
    const modelsById = new Map();
    // 列表里评论相对主帖的层级（视图属性，不写在共享模型上）
    const listDepths = new Map();
    /** 新数据并入已有的同 id 模型并返回那个对象；第一次见到就登记 */
    const canonical = (model) => {
      if (!model || !model.id) return model;
      const existing = modelsById.get(model.id);
      if (existing) return mergeModel(existing, model);
      modelsById.set(model.id, model);
      return model;
    };
    let focalModel = null;
    let columnsEl = null;
    let sentinelState = 'idle';
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
    const loadingView = showLoading(container, { title: '正在通过 X 会话读取帖子…' });
    container.replaceChildren(el('div', { class: 'pv-x-loading-layer' }, loadingView));

    const syncLayout = () => {
      if (!readerEl) return;
      readerEl.classList.toggle('pv-x-single', container.clientWidth < SINGLE_COLUMN_WIDTH);
      // 窗体尺寸变化后资料卡位置会失效，重新贴回锚点
      profileCard?.reposition();
      // 评论卡同理：重新按右栏算一次位置并夹紧
      commentCard?.reposition();
    };

    /**
     * 把主贴滚到所在滚动区顶部（有上下文链时，否则它本来就在顶部）。
     * 双栏时滚的是左栏，单栏时滚的是 .pv-x-columns。之后的图片加载由浏览器的滚动锚定保持位置。
     */
    const scrollFocalIntoView = (focalNode, hasAncestors) => {
      if (!hasAncestors || !focalNode || !readerEl) return;
      const single = readerEl.classList.contains('pv-x-single');
      const scroller = single ? columnsEl : readerEl.querySelector('.pv-x-pane-post');
      if (!scroller) return;
      const offset = focalNode.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTop += offset;
    };

    /** 资料卡贴着锚点：任一滚动区滚动（资料卡、灯箱、评论卡内部除外）就收起 */
    const onReaderScroll = (event) => {
      const target = event.target;
      if (target && target.nodeType === 1 && target.closest && target.closest('.pv-x-profile-card, .pv-x-media-lightbox, .pv-x-card')) return;
      profileCard?.remove();
    };

    // 幂等：PopupManager 会在关窗和下一次 load 前调用它，渲染成功后再调也安全；调多次只生效一次
    let disposed = false;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      aborted = true;
      stopThemeWatch();
      readerEl?.removeEventListener('scroll', onReaderScroll, true);
      resizeObserver?.disconnect();
      resizeObserver = null;
      sentinelObserver?.disconnect();
      sentinelObserver = null;
      translationObserver?.disconnect();
      translationObserver = null;
      profileCard?.destroy();
      profileCard = null;
      // 评论卡挂在阅读器内、键盘监听在自己身上，随 DOM 回收；这里清缓存与 window 级监听
      commentCard?.destroy();
      // 翻译队列必须清空：否则关闭弹窗后在途请求的 finally 会继续出队、继续发请求
      translationQueue.length = 0;
      queuedKeys.clear();
      translationCache.clear();
      // 自检数据不跨会话保留（否则会一直钉住整张模型图）；只清自己这次的，别清掉后一次加载的
      if (this.lastThread && this.lastThread.models === modelsById) this.lastThread = null;
      // 图片就地放大不注册任何全局监听（键盘事件挂在展开容器上，随 DOM 一起回收），
      // 因此这里无需额外注销
      container.classList.remove('pv-x-reader-mode');
      panel?.classList.remove('pv-x-skin');
      // 加载视图由弹窗自身在下次 load/close 时清空（PopupManager 会重置内容区），这里不重复处理
    };

    // ---------- 长文（Article）正文补全 ----------

    /**
     * 「显示更多」：正文被 X 截断时（legacy.truncated 且没有 note_tweet 全文），
     * 用 TweetResultByRestId 补一次全文并就地替换；失败则提示走「在 X 打开」。
     */
    const expandPost = async (model) => {
      if (!model || model.expanding) return;
      model.expanding = true;
      refreshTranslation(model.id);
      try {
        const json = await bridge.readArticle(model.id);
        if (aborted) return;
        const full = fullTextFromPayload(json, model.id);
        // 取不到更长的正文：多半是「正文本来就以省略号结尾」的误判，
        // 静默收起按钮并给中性提示，不要报成错误
        if (!full) {
          model.needsExpand = false;
          notify(readerEl, '这条帖子没有更长的正文', 'ok');
          return;
        }
        model.text = full.text;
        model.entities = full.entities;
        model.needsExpand = false;
        // 正文变了，旧译文作废
        translationCache.delete(translationKey(model));
      } catch (err) {
        logger.warn('[XThreadLoader] expand full text failed', err);
        notify(readerEl, `展开全文失败：${err && err.message ? err.message : err}（可点「在 X 打开」看原文）`, 'error');
      } finally {
        model.expanding = false;
        refreshTranslation(model.id);
      }
    };

    /**
     * TweetDetail 对长文帖有时只给封面与摘要，正文要另取一次 TweetResultByRestId。
     * 取不到不影响其它内容（失败只记日志，页面仍渲染封面与摘要）。
     */
    const hydrateArticle = async (model) => {
      if (!model || !model.attachment || model.attachment.type !== 'article') return;
      if ((model.attachment.content?.blocks || []).length) return;
      try {
        const json = await bridge.readArticle(model.id);
        const content = articleContentFromPayload(json);
        if (content) model.attachment.content = content;
      } catch (err) {
        logger.warn('[XThreadLoader] article hydrate failed', err);
      }
    };

    // ---------- 翻译 ----------

    const translationKey = (model) => `${model.id}:${TARGET_LANGUAGE}`;

    const refreshTranslation = (id) => {
      if (!readerEl) return;
      const model = modelsById.get(id);
      if (!model) return;
      for (const block of readerEl.querySelectorAll(`.pv-x-translatable[data-translation-id="${id}"]`)) {
        renderTextBlock(block, model, translationFor(model), bindProfile);
      }
    };

    const translationFor = (model) => ({
      offered: shouldOfferTranslation(model.text),
      entry: translationCache.get(translationKey(model)),
      // 默认自动显示译文（尚无「关闭自动翻译」设置项，用户可用「显示原文」逐条切回）
      display: translationDisplay.get(model.id) || 'translation',
      onToggle: (next) => {
        translationDisplay.set(model.id, next);
        refreshTranslation(model.id);
      },
      onRetry: () => enqueueTranslation(model, true, true),
      onExpand: expandPost
    });

    const pumpTranslations = () => {
      // 弹窗已关闭：不再出队、不再发请求（cleanup 已清空队列，这里再兜一道）
      if (aborted) return;
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
            if (aborted) return;
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
            if (aborted) return;
            translationCache.set(key, { status: 'error', message: error && error.message ? error.message : '翻译失败' });
          })
          .finally(() => {
            activeTranslations -= 1;
            if (aborted) return;
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
    /**
     * 只观察新加进列表的评论（追加/插入时调用，已观察过的不再重复）。
     * root 用 null（视口）：双栏时滚的是评论列表、单栏时滚的是 .pv-x-columns，
     * 祖先的 overflow 裁剪对隐式 root 同样生效，两种布局共用一个观察器。
     */
    const observeTranslations = (nodes) => {
      if (aborted || !readerEl) return;
      const blocks = [];
      for (const node of nodes) {
        for (const block of node.querySelectorAll('.pv-x-translatable')) {
          if (block.__pvObserved) continue;
          block.__pvObserved = true;
          blocks.push(block);
        }
      }
      if (!blocks.length) return;
      if (typeof IntersectionObserver !== 'function') {
        for (const block of blocks) enqueueTranslation(modelsById.get(block.dataset.translationId));
        return;
      }
      if (!translationObserver) {
        translationObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              translationObserver?.unobserve(entry.target);
              enqueueTranslation(modelsById.get(entry.target.dataset.translationId));
            }
          },
          { root: null, rootMargin: '180px 0px', threshold: 0.01 }
        );
      }
      for (const block of blocks) translationObserver.observe(block);
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
      // 缺 counts 时归 0：模型一旦缺字段就抛错的话，排序会把整次渲染拖成「加载失败」
      const likesOf = (model) => Number(model && model.counts && model.counts.likes) || 0;
      if (sortMode === 'latest') copy.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      else copy.sort((a, b) => likesOf(b) - likesOf(a));
      return copy;
    };

    /** 工具行「回复 N」：取 X 给的总数与已加载数中较大的那个（与主贴操作栏同一口径） */
    const updateCount = () => {
      if (!countLabel) return;
      const total = Math.max(Number(focalModel && focalModel.counts && focalModel.counts.replies) || 0, seen.size);
      countLabel.textContent = `回复 ${formatCount(total)}`;
      countLabel.title = `已加载 ${seen.size} 条`;
    };

    /** 列表里每条评论的节点（按 id 复用：追加、排序都不重建已有节点，视频播放/展开状态不丢） */
    const replyNodes = new Map();
    const replyNodeFor = (reply) => {
      let node = replyNodes.get(reply.id);
      if (!node) {
        node = renderReply(reply, {
          onAction: handleAction,
          bindProfile,
          // 评论列表里的每条评论都有「查看 N 条回复」入口：点它看这条评论自己的回复
          onOpenComments: openCommentsFor,
          translation: translationFor(reply),
          depth: listDepths.has(reply.id) ? listDepths.get(reply.id) : reply.depth
        });
        replyNodes.set(reply.id, node);
      }
      return node;
    };

    /**
     * 把列表摆成 sortedReplies() 的顺序：已有节点原地移动，新节点插入，哨兵永远在最后。
     * 不再 replaceChildren 整表重建（滚动位置、播放中的视频、已展开的正文都保留）。
     */
    const placeReplies = () => {
      if (!replyList) return;
      const list = sortedReplies();
      const fresh = [];
      replyList.querySelector(':scope > .pv-x-empty')?.remove();
      let ref = replyList.firstChild;
      for (const reply of list) {
        const isNew = !replyNodes.has(reply.id);
        const node = replyNodeFor(reply);
        if (isNew) fresh.push(node);
        if (node === ref) {
          ref = ref.nextSibling;
          continue;
        }
        replyList.insertBefore(node, ref);
      }
      if (sentinel && sentinel.parentNode !== replyList) replyList.appendChild(sentinel);
      else if (sentinel && replyList.lastChild !== sentinel) replyList.appendChild(sentinel);
      if (!list.length && !cursor) {
        replyList.insertBefore(el('div', { class: 'pv-x-empty', text: '这条帖子暂时没有可显示的回复' }), sentinel || null);
      }
      syncThreadLines(list.map((reply) => replyNodes.get(reply.id)), (id) => modelsById.get(id));
      markReplyTarget();
      observeTranslations(fresh);
    };

    /**
     * 哨兵四态：loading（滚动到底自动加载）/ error（「加载失败 · 重试」按钮，不再自动重试）/
     * done（「已显示全部 N 条」）/ none（没有回复时不显示）
     */
    const setSentinel = (state, message = '') => {
      sentinelState = state;
      if (!replyList) return;
      if (!sentinel) {
        sentinel = el('div', { class: 'pv-x-load-sentinel' });
        replyList.appendChild(sentinel);
      }
      sentinel.dataset.state = state;
      sentinel.removeAttribute('role');
      if (state === 'loading') {
        sentinel.replaceChildren(el('span', { class: 'pv-x-loading', text: '正在加载更多回复…' }));
        observeSentinel();
      } else if (state === 'error') {
        sentinelObserver?.disconnect();
        const retry = el('button', { class: 'pv-x-load-retry', type: 'button', text: '加载失败 · 重试', title: message || null });
        retry.addEventListener('click', () => {
          setSentinel('loading');
          loadMore();
        });
        sentinel.setAttribute('role', 'alert');
        sentinel.replaceChildren(retry);
      } else if (state === 'done') {
        sentinelObserver?.disconnect();
        sentinel.replaceChildren(el('span', { class: 'pv-x-load-done', text: `已显示全部 ${seen.size} 条` }));
      } else {
        sentinelObserver?.disconnect();
        sentinel.replaceChildren();
      }
    };

    /** 加载完一页后的哨兵状态 */
    const settleSentinel = () => {
      if (cursor) setSentinel('loading');
      else setSentinel(seen.size ? 'done' : 'none');
    };

    /**
     * 观察哨兵。root 用 null：单栏时滚的是 .pv-x-columns、双栏时是评论列表，隐式 root 两种都对。
     * 每次重新 observe：追加后哨兵若仍在可视区，IntersectionObserver 不会再报一次「进入」，
     * 重新 observe 会立即给出当前状态，从而继续加载下一页。
     */
    const observeSentinel = () => {
      if (!sentinel || typeof IntersectionObserver !== 'function') return;
      if (!sentinelObserver) {
        sentinelObserver = new IntersectionObserver(
          (entries) => {
            if (sentinelState === 'loading' && entries.some((entry) => entry.isIntersecting)) loadMore();
          },
          { root: null, rootMargin: '0px 0px 240px 0px', threshold: 0.01 }
        );
      }
      sentinelObserver.unobserve(sentinel);
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

    const setReplyTarget = (model, { focus = true } = {}) => {
      replyTarget = model && String(model.id) !== String(tweetId) ? model : null;
      composerView?.setTarget(replyTarget);
      markReplyTarget();
      if (focus) composerView?.focus();
    };

    /** 回复框上报的草稿：按主帖 id 暂存；回复框里点 ✕ 取消目标时也同步到这里 */
    const onDraftChange = (text, target) => {
      if (target !== replyTarget) {
        replyTarget = target || null;
        markReplyTarget();
      }
      replyDrafts.set(tweetId, text, target);
    };

    /** 同一条推文可能同时出现在列表和评论卡里：刷新所有副本的按钮 */
    const repaintActions = (model, key) => {
      if (!readerEl) return;
      for (const article of readerEl.querySelectorAll(`article[data-tweet-id="${model.id}"]`)) {
        const button = article.querySelector(`:scope > .pv-x-main > .pv-x-actions > .pv-x-action-${key}`);
        if (button) paintAction(button, model, key);
      }
    };

    /** 回复数变化后刷新「查看 N 条回复」与回复按钮 */
    const repaintReplies = (model) => {
      if (!readerEl || !model) return;
      for (const link of readerEl.querySelectorAll(`.pv-x-comment-entry[data-replies-for="${model.id}"]`)) {
        paintRepliesLink(link, model);
      }
      repaintActions(model, 'reply');
    };

    // ---------- 交互 ----------

    const handleAction = async (key, model, button) => {
      if (key === 'reply') {
        setReplyTarget(model);
        return;
      }
      // 接口没返回真实推文时的本地占位：没有真实 id，互动和链接都无从谈起
      if (String(model.id).startsWith('local-')) {
        notify(readerEl, '这条回复还在同步，请稍后刷新再操作', 'info');
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
      repaintActions(model, key);
      try {
        await bridge.toggleAction(key, model.id, wasActive);
      } catch (err) {
        logger.warn(`[XThreadLoader] ${key} failed`, err);
        model.flags[flag] = wasActive;
        model.counts[countKey] = Math.max(0, (Number(model.counts[countKey]) || 0) + (wasActive ? 1 : -1));
        paintAction(button, model, key);
        repaintActions(model, key);
        notify(readerEl, `${ACTION_LABEL[key] || key}失败：${err && err.message ? err.message : err}`, 'error');
      }
    };

    const handleSort = (next, group) => {
      if (next === sortMode) return;
      sortMode = next;
      paintSort(group, next);
      placeReplies();
    };

    // ---------- 小巧评论卡：点时间右侧的 💬 图标打开 ----------
    // 必须放在 handleAction 之后：这里会直接引用它（const 有 TDZ，提前引用会 ReferenceError）

    const commentCard = createCommentCard({
      getRoot: () => readerEl,
      // 卡片只在右栏内活动：位置由右栏 rect 反算并夹紧，结构上不会压到左侧主贴
      // 垂直方向夹在评论列表的可见部分里：卡片上沿不会越过回复框下沿
      getBounds: () => {
        if (!replyList || !readerEl) return null;
        const pane = readerEl.querySelector('.pv-x-pane-replies');
        const list = replyList.getBoundingClientRect();
        const paneRect = pane ? pane.getBoundingClientRect() : list;
        const scroller = (columnsEl && readerEl.classList.contains('pv-x-single') ? columnsEl : replyList).getBoundingClientRect();
        // 单栏时工具行吸顶，卡片也不能盖住它
        const tools = readerEl.querySelector('.pv-x-reply-tools');
        const toolsBottom = tools ? tools.getBoundingClientRect().bottom : scroller.top;
        return {
          top: Math.max(list.top, scroller.top, toolsBottom),
          bottom: Math.min(list.bottom, scroller.bottom),
          left: paneRect.left,
          right: paneRect.right
        };
      },
      bindProfile,
      onAction: handleAction,
      replyCountOf: (model) => Number(model && model.counts && model.counts.replies) || 0,
      load: async (id) => {
        const json = await bridge.readThread(String(id));
        if (aborted) throw new Error('已关闭');
        const summary = parseThreadSummary(json, String(id));
        if (!summary.focalFound || !summary.focal) throw new Error('X 没有返回这条回复');
        const depths = new Map(summary.replies.map((reply) => [reply.id, reply.depth]));
        const post = canonical(summary.focal);
        const cardReplies = summary.replies.map(canonical);
        // 标题与列表入口同一个数：取 X 的计数与实际拿到的条数中较大者
        post.counts.replies = Math.max(Number(post.counts.replies) || 0, cardReplies.length);
        repaintReplies(post);
        return { post, replies: cardReplies, depths, url: openUrlOf(post) };
      }
    });

    /** 「查看 N 条回复」：打开这条的评论卡（同一个入口再点是关闭，由卡片自己处理） */
    const openCommentsFor = (model, anchor) => {
      if (!model || !model.id) return;
      commentCard.open(model, anchor);
    };

    const submitReply = async (text, target) => {
      if (target && String(target.id).startsWith('local-')) throw new Error('这条回复还在同步，暂时不能回复它');
      // 定向回复：点了某条评论的「回复」就回到那条，否则回主帖
      const inReplyTo = target && target.id ? String(target.id) : tweetId;
      const json = await bridge.createReply(inReplyTo, text);
      // 已经发出去了：先清草稿，即使弹窗这时已关闭，下次打开也不会带着已发送的内容
      replyDrafts.clear(tweetId);
      if (aborted) return;
      const targetDepth = target ? (listDepths.has(target.id) ? listDepths.get(target.id) : Number(target.depth) || 0) : -1;
      // 优先用接口返回的真实推文（真实 id、作者信息，点赞/复制链接都可用）；取不到才用本地占位
      const real = tweetFromCreateResponse(json);
      const posted = real
        ? canonical(real)
        : {
            id: `local-${Date.now()}`,
            text,
            entities: [],
            createdAt: new Date().toISOString(),
            author: { id: '', name: account.name || account.handle || '我', handle: account.handle, avatar: account.avatar, verified: false },
            counts: { replies: 0, likes: 0, reposts: 0, bookmarks: 0, views: 0 },
            flags: { liked: false, reposted: false, bookmarked: false },
            media: [],
            inReplyToId: inReplyTo
          };
      if (!real) modelsById.set(posted.id, posted);
      listDepths.set(posted.id, Math.min(targetDepth + 1, 3));
      // 被回复的那条（或主帖）回复数 +1，并作废它的评论卡缓存
      const parent = target ? modelsById.get(String(target.id)) || target : focalModel;
      if (parent && parent.counts) {
        parent.counts.replies = (Number(parent.counts.replies) || 0) + 1;
        repaintReplies(parent);
      }
      if (target) commentCard.invalidate(target.id);
      // 新回复固定显示在列表最前（便于立刻确认）
      if (!seen.has(posted.id)) {
        replies.unshift(posted);
        seen.add(posted.id);
      }
      sortMode = 'relevant';
      paintSort(sortGroup, 'relevant');
      updateCount();
      placeReplies();
      if (sentinelState === 'done' || sentinelState === 'none') settleSentinel();
      notify(readerEl, target ? `已回复 @${(target.author && target.author.handle) || ''}` : '回复已发布', 'ok');
      // 回复框自己会清空正文、取消目标并上报（onDraftChange 会把 replyTarget 置空）
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
          listDepths.set(reply.id, reply.depth);
          replies.push(canonical(reply));
          added += 1;
        }
        cursor = replyCursorAfterPage(previousCursor, next.cursor, added);
        updateCount();
        // 只追加新节点，已有节点不动
        placeReplies();
        settleSentinel();
      } catch (err) {
        if (aborted) return;
        logger.warn('[XThreadLoader] load more failed', err);
        // 哨兵换成「加载失败 · 重试」，不再自动重试（避免失败后无限循环请求）
        setSentinel('error', err && err.message ? err.message : String(err));
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
        focalModel = canonical(summary.focal);
        for (const ancestor of summary.ancestors) canonical(ancestor);
        for (const reply of summary.replies) {
          seen.add(reply.id);
          listDepths.set(reply.id, reply.depth);
          replies.push(canonical(reply));
        }
        // 长文帖：先把正文补全再渲染，避免首屏只有封面
        await hydrateArticle(summary.focal);
        // 补全期间用户可能已关闭弹窗或切到别的链接：必须重新确认，否则会把阅读器渲染进已关闭的面板，
        // 并留下无人回收的 ResizeObserver / translationObserver / 资料卡
        if (aborted) return;
        // 供 diag() 自检使用
        this.lastThread = { tweetId, models: modelsById };
        // 资料卡挂在阅读器根节点上，随弹窗关闭一起清理；须在渲染前创建，
        // 因为头像/昵称/@handle 的悬停绑定发生在渲染过程中
        profileCard = createProfileCard({
          getRoot: () => readerEl,
          onToggleFollow: async (author, nextActive) => {
            const result = await bridge.toggleFollow(author.id, nextActive);
            applyFollowState(author, result);
            return result;
          },
          // ok / info / error 原样传：info 走礼貌播报，不再被当成错误
          onNotify: (message, tone) => notify(readerEl, message, tone || 'error')
        });
        // 草稿：同一主帖重开/刷新时恢复正文和回复目标
        const draft = replyDrafts.get(tweetId);
        const built = renderReader({
          focal: focalModel,
          ancestors: summary.ancestors.map((ancestor) => modelsById.get(ancestor.id) || ancestor),
          replyCount: Math.max(Number(focalModel.counts && focalModel.counts.replies) || 0, seen.size),
          openUrl: openUrlOf(focalModel),
          onAction: handleAction,
          onSort: handleSort,
          onSubmitReply: submitReply,
          translationFor,
          bindProfile,
          composerAvatar: account.avatar,
          draftText: draft ? draft.text : '',
          onDraftChange
        });
        readerEl = built.reader;
        columnsEl = built.columns;
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
        composerView?.syncHeight();
        if (draft && draft.target) {
          setReplyTarget(modelsById.get(draft.target.id) || draft.target, { focus: false });
        }
        updateCount();
        placeReplies();
        settleSentinel();
        // 主贴与上下文优先翻译
        enqueueTranslation(focalModel, true);
        for (const ancestor of summary.ancestors) enqueueTranslation(modelsById.get(ancestor.id), true);
        observeTranslations([built.postPane]);
        // 有上下文链时把主贴滚到栏顶（上下文在上方，往上滚可看）
        scrollFocalIntoView(built.focalNode, summary.ancestors.length > 0);
        // 资料卡贴着锚点定位：所在栏滚动后锚点跑了，收起
        readerEl.addEventListener('scroll', onReaderScroll, { capture: true, passive: true });
      } catch (err) {
        if (aborted) return;
        logger.warn('[XThreadLoader] read thread failed', err);
        // 错误态由弹窗自己的视图渲染，先摘掉阅读器布局
        container.classList.remove('pv-x-reader-mode');
        onError?.(`${err && err.message ? err.message : err}（X 的接口会变动，可点下方按钮改用新标签页打开）`);
        return;
      }
      // onLoad 放在 try 之外：它若抛错就不会落进上面的 catch，
      // 避免「先报加载成功、紧接着又报加载失败」并把已渲染的阅读器布局摘掉
      if (!aborted) onLoad?.();
    })().catch((err) => {
      // 兜底：上面 catch 内部再抛错时不至于变成未处理的 rejection
      logger.warn('[XThreadLoader] unexpected failure', err);
    });

    return cleanup;
  }

  /**
   * 自检：当前阅读器里各帖子的正文状态。
   * 排查「长贴没显示全 / 该出『显示更多』却没出」时用它看真实数据。
   */
  diag() {
    const thread = this.lastThread;
    if (!thread) return 'no thread loaded';
    const rows = [...thread.models.values()].slice(0, 12).map((model) => ({
      id: model.id,
      textLength: String(model.text || '').length,
      hasFullText: Boolean(model.hasFullText),
      needsExpand: Boolean(model.needsExpand),
      entities: (model.entities || []).length,
      tail: String(model.text || '').slice(-16)
    }));
    return { focalId: thread.tweetId, rows };
  }
}
