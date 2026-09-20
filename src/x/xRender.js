// X 版式渲染：把 xModel 的模型渲染成贴近 X 原生的帖子/评论结构。
// 双栏阅读器：左栏原帖（含回复上下文链）、右栏评论，各自独立滚动。
// 交互（点赞/转推/收藏/回复/复制链接/排序/翻译/图片放大）参照本地 peek 项目的行为。
// 图标来自 xIcons（克隆 X 实时 DOM），颜色字体来自 xTheme（读取 X 实时样式）。

import { el } from '../utils/dom.js';
import { xIcon } from './xIcons.js';
import { sourceLanguageLabel } from './xModel.js';

const SORTS = [
  { key: 'relevant', label: '相关' },
  { key: 'latest', label: '最新' },
  { key: 'liked', label: '最多喜欢' }
];

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatCount(value) {
  const n = Number(value) || 0;
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 10000).toFixed(1)}万`;
}

/** 作者主页地址（资料卡与头像/昵称链接共用） */
export function profileUrlOf(model) {
  const handle = model.author && model.author.handle;
  if (handle) return `https://x.com/${handle}`;
  const id = model.author && model.author.id;
  return id ? `https://x.com/i/user/${id}` : `https://x.com/i/status/${model.id}`;
}

/** 帖子的规范地址：用于「在 X 打开」与媒体点击 */
export function openUrlOf(model) {
  const handle = model.author && model.author.handle;
  return handle ? `https://x.com/${handle}/status/${model.id}` : `https://x.com/i/status/${model.id}`;
}

function avatarColumn(model, { link = true, bindProfile = null } = {}) {
  const column = el('div', { class: 'pv-x-avatar-col' });
  const avatar = el(link ? 'a' : 'span', {
    class: 'pv-x-avatar',
    href: link ? profileUrlOf(model) : null,
    target: link ? '_blank' : null,
    rel: link ? 'noreferrer' : null
  });
  if (model.author && model.author.avatar) avatar.appendChild(el('img', { src: model.author.avatar, alt: '', loading: 'lazy' }));
  column.appendChild(avatar);
  if (link) bindProfile?.(avatar, model);
  return column;
}

function headNode(model, bindProfile = null) {
  const head = el('div', { class: 'pv-x-head' });
  const nameLink = el('a', {
    class: 'pv-x-name',
    href: profileUrlOf(model),
    target: '_blank',
    rel: 'noreferrer',
    text: (model.author && (model.author.name || model.author.handle)) || 'X 用户'
  });
  head.appendChild(nameLink);
  bindProfile?.(nameLink, model);
  if (model.author && model.author.verified) {
    const badge = xIcon('verified');
    if (badge) head.appendChild(el('span', { class: 'pv-x-badge' }, badge));
  }
  if (model.author && model.author.handle) {
    const handle = el('span', { class: 'pv-x-handle', text: `@${model.author.handle}` });
    head.appendChild(handle);
    bindProfile?.(handle, model);
  }
  if (model.createdAt) {
    head.appendChild(el('span', { class: 'pv-x-dot', text: '·' }));
    head.appendChild(el('time', { class: 'pv-x-time', text: formatDate(model.createdAt) }));
  }
  return head;
}

/** 互动项：前五项是按钮（可点），查看数是纯展示 */
const ACTIONS = [
  { key: 'reply', icon: 'reply', count: 'replies', label: '回复' },
  { key: 'repost', icon: 'repost', count: 'reposts', label: '转推' },
  { key: 'like', icon: 'like', count: 'likes', label: '喜欢' },
  { key: 'bookmark', icon: 'bookmark', count: 'bookmarks', label: '收藏' },
  { key: 'share', icon: 'share', count: null, label: '复制链接' },
  { key: 'views', icon: 'views', count: 'views', label: '查看', readonly: true }
];

/** 互动键 → 帖子 flags 字段（X 的字段名与按钮名不同） */
export const FLAG_BY_ACTION = { like: 'liked', repost: 'reposted', bookmark: 'bookmarked' };
const COUNT_BY_ACTION = { reply: 'replies', repost: 'reposts', like: 'likes', bookmark: 'bookmarks', views: 'views' };

/** 按钮的激活态与数字由这里统一刷新（乐观更新与回滚都复用它） */
export function paintAction(button, model, key) {
  if (!button) return;
  const flag = FLAG_BY_ACTION[key];
  if (flag) button.dataset.active = model.flags && model.flags[flag] ? 'true' : 'false';
  const countNode = button.querySelector('.pv-x-count');
  const countKey = COUNT_BY_ACTION[key];
  if (!countNode || !countKey) return;
  const value = Number(model.counts[countKey]) || 0;
  countNode.textContent = value ? formatCount(value) : '';
}

function actionsNode(model, onAction) {
  const row = el('div', { class: 'pv-x-actions' });
  for (const spec of ACTIONS) {
    const value = spec.count ? Number(model.counts[spec.count]) || 0 : 0;
    const icon = xIcon(spec.icon);
    if (!icon && !value && !spec.readonly) continue;
    if (spec.readonly && !value) continue;
    const node = el(spec.readonly ? 'span' : 'button', {
      class: `pv-x-action pv-x-action-${spec.key}`,
      type: spec.readonly ? null : 'button',
      'data-action': spec.key,
      'aria-label': spec.label,
      title: spec.label
    });
    if (icon) node.appendChild(icon);
    if (spec.count) node.appendChild(el('span', { class: 'pv-x-count', text: value ? formatCount(value) : '' }));
    if (!spec.readonly && onAction) {
      node.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onAction(spec.key, model, node);
      });
    }
    paintAction(node, model, spec.key);
    row.appendChild(node);
  }
  return row;
}

// ---------- 翻译 ----------

/** 长文帖的正文通常只有一条 t.co 链接，正文另有排版，这里去掉它 */
function displayText(model) {
  const text = String(model.text || '');
  if (!model.attachment || model.attachment.type !== 'article') return text;
  return text.replace(/https?:\/\/t\.co\/\S+/g, '').trim();
}

/**
 * 渲染正文块（含翻译行）。翻译状态变化时由加载器重新调用本函数刷新同一个块，
 * 因此这里必须是幂等的：先清空再重建。
 */
export function renderTextBlock(block, model, view) {
  block.replaceChildren();
  const offered = Boolean(view && view.offered);
  const entry = view && view.entry;
  const showing = Boolean(entry && entry.status === 'ready' && view.display !== 'original');

  if (offered) {
    const row = el('div', { class: 'pv-x-translation-row' });
    if (!entry || entry.status === 'queued' || entry.status === 'loading') {
      row.appendChild(el('span', { class: 'pv-x-translation-note', text: '正在翻译…' }));
    } else if (entry.status === 'ready' && showing) {
      row.appendChild(el('span', { class: 'pv-x-translation-note', text: `翻译自${sourceLanguageLabel(entry)}` }));
      row.appendChild(
        el('button', { class: 'pv-x-translation-link', type: 'button', text: '显示原文' })
      );
    } else if (entry.status === 'error') {
      row.appendChild(
        el('button', { class: 'pv-x-translation-link', type: 'button', text: '重试翻译', title: entry.message || '' })
      );
    } else if (entry.status === 'ready') {
      row.appendChild(el('button', { class: 'pv-x-translation-link', type: 'button', text: '显示翻译' }));
    }
    // unavailable（原文即目标语言）不出提示，避免噪音
    const link = row.querySelector('button');
    if (link) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (entry && entry.status === 'error') view.onRetry?.();
        else if (entry && entry.status === 'ready') view.onToggle?.(showing ? 'original' : 'translation');
        else view.onRetry?.();
      });
    }
    if (row.childNodes.length) block.appendChild(row);
  }

  block.appendChild(el('div', { class: 'pv-x-text', text: showing ? entry.text : displayText(model) }));
}

function textBlock(model, view) {
  const block = el('div', { class: 'pv-x-translatable', 'data-translation-id': model.id });
  renderTextBlock(block, model, view);
  return block;
}

// ---------- X 长文（Article） ----------

/**
 * 行内样式：X 长文的加粗/斜体/下划线/删除线存在 inlineStyleRanges 里，
 * 丢掉它们正文会整体变成同一字重，看起来和 X 差别很大。
 */
function appendInline(container, block) {
  const text = String(block.text || '');
  const ranges = (block.inlineStyles || [])
    .filter((range) => range.length > 0 && range.offset >= 0)
    .sort((a, b) => a.offset - b.offset);
  if (!ranges.length) {
    container.appendChild(document.createTextNode(text));
    return;
  }
  let cursor = 0;
  for (const range of ranges) {
    const start = Math.max(cursor, Math.min(range.offset, text.length));
    const end = Math.max(start, Math.min(range.offset + range.length, text.length));
    if (start > cursor) container.appendChild(document.createTextNode(text.slice(cursor, start)));
    if (end > start) {
      const style = String(range.style || '').toUpperCase();
      const tag = style.includes('BOLD')
        ? 'strong'
        : style.includes('ITALIC')
          ? 'em'
          : style.includes('UNDERLINE')
            ? 'u'
            : style.includes('STRIKETHROUGH')
              ? 's'
              : null;
      const chunk = text.slice(start, end);
      container.appendChild(tag ? el(tag, { text: chunk }) : document.createTextNode(chunk));
    }
    cursor = end;
  }
  if (cursor < text.length) container.appendChild(document.createTextNode(text.slice(cursor)));
}

/** 长文正文块 → DOM：段落 / 标题 / 引用 / 列表 / 图片 */
function articleBlocks(content) {
  const container = el('div', { class: 'pv-x-article-content' });
  let list = null;
  let listTag = '';
  const endList = () => {
    list = null;
    listTag = '';
  };
  for (const block of content.blocks || []) {
    const type = String(block.type || 'unstyled');
    if (type === 'unordered-list-item' || type === 'ordered-list-item') {
      const tag = type === 'ordered-list-item' ? 'ol' : 'ul';
      if (!list || listTag !== tag) {
        list = el(tag, { class: 'pv-x-article-list' });
        listTag = tag;
        container.appendChild(list);
      }
      const item = el('li');
      appendInline(item, block);
      list.appendChild(item);
      continue;
    }
    endList();
    if (type === 'atomic') {
      const range = (block.entityRanges || [])[0];
      const entity = range ? content.entities[range.key] : null;
      if (entity && entity.image) {
        container.appendChild(
          el('figure', { class: 'pv-x-article-figure' }, el('img', { src: entity.image, alt: entity.alt || '', loading: 'lazy' }))
        );
      }
      continue;
    }
    if (!String(block.text || '').trim()) continue;
    const tag =
      type === 'header-one'
        ? 'h2'
        : type === 'header-two'
          ? 'h3'
          : type === 'header-three'
            ? 'h4'
            : type === 'blockquote'
              ? 'blockquote'
              : 'p';
    const className =
      tag === 'blockquote'
        ? 'pv-x-article-quote'
        : tag === 'p'
          ? 'pv-x-article-p'
          : tag === 'h2'
            ? 'pv-x-article-h2'
            : tag === 'h3'
              ? 'pv-x-article-h3'
              : 'pv-x-article-h4';
    const node = el(tag, { class: className });
    appendInline(node, block);
    container.appendChild(node);
  }
  return container;
}

/** 原帖是长文时：封面 + 标题 + 正文排版 */
function articleReader(model) {
  const attachment = model.attachment;
  const section = el('section', { class: 'pv-x-article' });
  if (attachment.image) {
    section.appendChild(el('div', { class: 'pv-x-article-cover' }, el('img', { src: attachment.image, alt: '', loading: 'lazy' })));
  }
  const heading = el('header', { class: 'pv-x-article-heading' });
  if (attachment.title) heading.appendChild(el('h1', { class: 'pv-x-article-title', text: attachment.title }));
  heading.appendChild(
    el('a', {
      class: 'pv-x-article-open',
      href: attachment.url || openUrlOf(model),
      target: '_blank',
      rel: 'noreferrer',
      text: '在 X 阅读全文'
    })
  );
  section.appendChild(heading);
  if (attachment.content && attachment.content.blocks.length) section.appendChild(articleBlocks(attachment.content));
  else if (attachment.description) section.appendChild(el('p', { class: 'pv-x-article-p', text: attachment.description }));
  return section;
}

/** 评论/上下文里的长文：紧凑卡片 */
function articleCard(model) {
  const attachment = model.attachment;
  const card = el('a', {
    class: 'pv-x-article-card',
    href: attachment.url || openUrlOf(model),
    target: '_blank',
    rel: 'noreferrer'
  });
  if (attachment.image) {
    card.appendChild(el('img', { class: 'pv-x-article-card-cover', src: attachment.image, alt: '', loading: 'lazy' }));
  }
  const body = el('div', { class: 'pv-x-article-card-body' });
  body.appendChild(el('span', { class: 'pv-x-article-card-domain', text: 'x.com · 长文' }));
  if (attachment.title) body.appendChild(el('strong', { class: 'pv-x-article-card-title', text: attachment.title }));
  if (attachment.description) body.appendChild(el('span', { class: 'pv-x-article-card-desc', text: attachment.description }));
  card.appendChild(body);
  return card;
}

// ---------- 媒体与灯箱 ----------

/** 图片放大：浮层内查看，支持左右切换、Esc 关闭（Esc 优先关灯箱，不关弹窗） */
export function openLightbox(reader, items, index, openUrl) {
  reader.querySelector('.pv-x-lightbox')?.remove();
  if (!items.length) return () => {};
  let current = Math.max(0, Math.min(index, items.length - 1));
  const box = el('div', { class: 'pv-x-lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': '图片查看' });
  const image = el('img', { class: 'pv-x-lightbox-img', src: items[current].url, alt: items[current].altText || '' });
  const counter = items.length > 1 ? el('span', { class: 'pv-x-lightbox-counter', text: `${current + 1} / ${items.length}` }) : null;

  const show = (next) => {
    current = (next + items.length) % items.length;
    image.src = items[current].url;
    image.alt = items[current].altText || '';
    if (counter) counter.textContent = `${current + 1} / ${items.length}`;
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowRight' && items.length > 1) {
      event.stopPropagation();
      show(current + 1);
    } else if (event.key === 'ArrowLeft' && items.length > 1) {
      event.stopPropagation();
      show(current - 1);
    }
  };
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    box.remove();
  };

  const closeButton = el('button', { class: 'pv-x-lightbox-close', type: 'button', 'aria-label': '关闭', text: '✕' });
  closeButton.addEventListener('click', close);
  const bar = el(
    'div',
    { class: 'pv-x-lightbox-bar' },
    counter,
    el('a', { class: 'pv-x-lightbox-open', href: openUrl, target: '_blank', rel: 'noreferrer', text: '在 X 打开' }),
    closeButton
  );
  box.appendChild(image);
  box.appendChild(bar);
  if (items.length > 1) {
    const prev = el('button', { class: 'pv-x-lightbox-nav pv-x-lightbox-prev', type: 'button', 'aria-label': '上一张', text: '‹' });
    const next = el('button', { class: 'pv-x-lightbox-nav pv-x-lightbox-next', type: 'button', 'aria-label': '下一张', text: '›' });
    prev.addEventListener('click', () => show(current - 1));
    next.addEventListener('click', () => show(current + 1));
    box.append(prev, next);
  }
  // 点背景关闭（点图片本身不关）
  box.addEventListener('click', (event) => {
    if (event.target === box) close();
  });
  document.addEventListener('keydown', onKey, true);
  reader.appendChild(box);
  return close;
}

function mediaGrid(model, { openUrl, onMedia }) {
  const items = (model.media || []).slice(0, 4);
  if (!items.length) return null;
  const photos = items.filter((item) => item.type === 'photo');
  const grid = el('div', { class: `pv-x-media pv-x-media-${items.length}` });
  for (const item of items) {
    if (item.type === 'photo') {
      // 点图片在弹窗内放大，不再跳到新页面
      const button = el(
        'button',
        { class: 'pv-x-media-item', type: 'button', 'aria-label': '放大图片' },
        el('img', { src: item.url, alt: item.altText || '', loading: 'lazy' })
      );
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onMedia?.(photos, photos.indexOf(item));
      });
      grid.appendChild(button);
      continue;
    }
    const video = el('video', {
      class: 'pv-x-video',
      poster: item.url || null,
      controls: '',
      playsinline: '',
      preload: 'none'
    });
    const nativeHls = item.hlsUrl && typeof video.canPlayType === 'function' && video.canPlayType('application/vnd.apple.mpegurl');
    const source = item.videoUrl || (nativeHls ? item.hlsUrl : '');
    const wrapper = el('div', { class: 'pv-x-media-item pv-x-media-video' });
    if (source) {
      video.src = source;
      wrapper.appendChild(video);
    } else {
      // 没有可播源就不放 <video>（避免留下黑色方块），改用海报 + 回 X 播放
      wrapper.appendChild(el('img', { class: 'pv-x-video-poster', src: item.url, alt: item.altText || '', loading: 'lazy' }));
      wrapper.appendChild(
        el('a', { class: 'pv-x-video-open', href: openUrl, target: '_blank', rel: 'noreferrer', text: '在 X 播放' })
      );
    }
    grid.appendChild(wrapper);
  }
  return grid;
}

// ---------- 帖子 / 评论 ----------

/** 渲染一条帖子/评论；threadLine 为真时在头像下方画出 X 的竖线 */
export function renderPost(
  model,
  { threadLine = false, onAction = null, onMedia = null, translation = null, bindProfile = null, compact = false } = {}
) {
  const article = el('article', { class: compact ? 'pv-x-post pv-x-post-compact' : 'pv-x-post' });
  // 供「正在回复这条」的高亮与定位使用
  article.dataset.tweetId = model.id;
  const column = avatarColumn(model, { bindProfile });
  if (threadLine) column.appendChild(el('span', { class: 'pv-x-thread-line' }));
  article.appendChild(column);
  const isArticle = model.attachment && model.attachment.type === 'article';
  const main = el(
    'div',
    { class: 'pv-x-main' },
    headNode(model, bindProfile),
    displayText(model) || !isArticle ? textBlock(model, translation) : null,
    isArticle ? (compact ? articleCard(model) : articleReader(model)) : null,
    mediaGrid(model, { openUrl: openUrlOf(model), onMedia }),
    actionsNode(model, onAction)
  );
  article.appendChild(main);
  return article;
}

export function renderReply(model, options = {}) {
  const article = renderPost(model, { ...options, threadLine: true, compact: true });
  article.classList.add('pv-x-reply');
  article.style.setProperty('--pv-x-depth', String(Math.min(Number(model.depth) || 0, 3)));
  return article;
}

// ---------- 阅读器骨架 ----------

function sortControl(current, onSort) {
  const group = el('div', { class: 'pv-x-sort', role: 'group', 'aria-label': '评论排序' });
  for (const sort of SORTS) {
    const button = el('button', {
      class: 'pv-x-sort-btn',
      type: 'button',
      'data-sort': sort.key,
      text: sort.label,
      'aria-pressed': sort.key === current ? 'true' : 'false'
    });
    button.addEventListener('click', () => onSort(sort.key, group));
    group.appendChild(button);
  }
  return group;
}

export function paintSort(group, current) {
  if (!group) return;
  for (const button of group.querySelectorAll('.pv-x-sort-btn')) {
    button.setAttribute('aria-pressed', button.dataset.sort === current ? 'true' : 'false');
  }
}

/** 纯文字回复框：输入框自适应高度，无内容时禁用提交；回复评论时显示目标 */
function composer({ avatar, onSubmit, focalId }) {
  const section = el('section', { class: 'pv-x-composer' });
  const avatarHolder = el('span', { class: 'pv-x-avatar pv-x-avatar-sm' });
  if (avatar) avatarHolder.appendChild(el('img', { src: avatar, alt: '' }));
  const input = el('textarea', { class: 'pv-x-composer-input', rows: '1', placeholder: '发布你的回复' });
  const submit = el('button', { class: 'pv-x-composer-submit', type: 'button', text: '回复', disabled: '' });
  const hint = el('span', { class: 'pv-x-composer-hint' });

  // 回复目标：点某条评论的「回复」时显示「回复 @xxx」，可取消
  let targetModel = null;
  const targetRow = el('div', { class: 'pv-x-composer-target' });
  const targetLabel = el('span', { class: 'pv-x-composer-target-label' });
  const clearTarget = el('button', { class: 'pv-x-composer-target-clear', type: 'button', 'aria-label': '取消回复该评论', text: '✕' });
  targetRow.append(targetLabel, clearTarget);
  targetRow.hidden = true;
  clearTarget.addEventListener('click', () => setTarget(null));

  function setTarget(model) {
    targetModel = model && String(model.id) !== String(focalId) ? model : null;
    if (targetModel) {
      targetLabel.textContent = `回复 @${(targetModel.author && (targetModel.author.handle || targetModel.author.name)) || 'X 用户'}`;
      targetRow.hidden = false;
    } else {
      targetRow.hidden = true;
    }
    return targetModel;
  }

  const autoGrow = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
  };
  input.addEventListener('input', () => {
    autoGrow();
    submit.disabled = !input.value.trim();
  });
  const send = async () => {
    const text = input.value.trim();
    if (!text || submit.disabled) return;
    submit.disabled = true;
    hint.textContent = '正在发布...';
    try {
      await onSubmit(text, targetModel);
      input.value = '';
      autoGrow();
      hint.textContent = '';
      setTarget(null);
    } catch (err) {
      hint.textContent = `发布失败：${err && err.message ? err.message : err}`;
    } finally {
      submit.disabled = !input.value.trim();
    }
  };
  submit.addEventListener('click', send);
  input.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + Enter 发布，与 X 的习惯一致
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      send();
    }
  });
  section.append(
    avatarHolder,
    el('div', { class: 'pv-x-composer-body' }, targetRow, input, el('div', { class: 'pv-x-composer-foot' }, hint, submit))
  );
  return { node: section, input, setTarget, focus: () => input.focus() };
}

/** 轻提示：互动失败等场景的反馈 */
export function notify(reader, message, tone = 'error') {
  if (!reader) return;
  let toast = reader.querySelector('.pv-x-toast');
  if (!toast) {
    toast = el('div', { class: 'pv-x-toast' });
    reader.appendChild(toast);
  }
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.dataset.visible = 'true';
  clearTimeout(toast.__pvTimer);
  toast.__pvTimer = setTimeout(() => {
    toast.dataset.visible = 'false';
  }, 3200);
}

/**
 * 双栏阅读器骨架：左原帖（含上下文链）、右评论（工具行 + 回复框 + 列表）。
 * 窄弹窗下由调用方加 .pv-x-single 切成上下堆叠。
 */
export function renderReader({
  focal,
  ancestors = [],
  replyCount,
  openUrl,
  onAction,
  onSort,
  onSubmitReply,
  onMedia,
  translationFor,
  bindProfile,
  composerAvatar
}) {
  const reader = el('div', { class: 'pv-x-reader' });
  const postPane = el('section', { class: 'pv-x-pane pv-x-pane-post' });
  // 回复上下文：只展示被点开那条之前的对话链
  for (const ancestor of ancestors) {
    postPane.appendChild(
      renderPost(ancestor, {
        threadLine: true,
        onAction,
        onMedia,
        bindProfile,
        translation: translationFor?.(ancestor),
        compact: true
      })
    );
  }
  postPane.appendChild(
    renderPost(focal, { threadLine: true, onAction, onMedia, bindProfile, translation: translationFor?.(focal) })
  );

  const countLabel = el('span', { class: 'pv-x-reply-count', text: `评论（${replyCount}）` });
  const sort = onSort ? sortControl('relevant', onSort) : null;
  const tools = el(
    'div',
    { class: 'pv-x-reply-tools' },
    el('div', { class: 'pv-x-tools-left' }, countLabel, sort),
    el('a', { class: 'pv-x-open', href: openUrl, target: '_blank', rel: 'noreferrer', text: '在 X 打开' })
  );
  const replyPane = el('section', { class: 'pv-x-pane pv-x-pane-replies' }, tools);
  const composerView = onSubmitReply ? composer({ avatar: composerAvatar, onSubmit: onSubmitReply, focalId: focal.id }) : null;
  if (composerView) replyPane.appendChild(composerView.node);
  const list = el('div', { class: 'pv-x-reply-list' });
  replyPane.appendChild(list);
  reader.append(postPane, replyPane);
  return { reader, list, replyPane, countLabel, composer: composerView, sort };
}
