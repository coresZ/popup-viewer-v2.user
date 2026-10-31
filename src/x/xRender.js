// X 版式渲染：把 xModel 的模型渲染成贴近 X 原生的帖子/评论结构。
// 双栏阅读器：左栏原帖（含回复上下文链）、右栏评论，各自独立滚动。
// 交互（点赞/转推/收藏/回复/复制链接/排序/翻译/图片放大）参照本地 peek 项目的行为。
// 图标来自 xIcons（克隆 X 实时 DOM），颜色字体来自 xTheme（读取 X 实时样式）。

import { el, svgIcon } from '../utils/dom.js';
import {
  MIN_SCALE,
  MAX_SCALE,
  clampScale,
  clampTranslate,
  maxScaleFor,
  ratioToScale,
  scaleToRatio,
  zoomTowards
} from './xZoomMath.js';
import { xIcon } from './xIcons.js';
import { sourceLanguageLabel, threadContinues } from './xModel.js';
import { formatCount, fullTime } from './xFormat.js';
import { debugEnabled } from '../utils/debugFlag.js';

const SORTS = [
  { key: 'relevant', label: '相关' },
  { key: 'latest', label: '最新' },
  { key: 'liked', label: '最多喜欢' }
];

export { formatCount };

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

/** 时间右侧的「查看 N 条回复」入口：图标 + 计数（恢复旧版 X 卡片的紧凑样式） */
function repliesEntry(model, onOpenComments) {
  if (!onOpenComments) return null;
  const count = countOf(model, 'replies');
  const button = el('button', {
    class: 'pv-x-comment-entry',
    type: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    'data-replies-for': model.id,
    title: count ? `查看这条的 ${count} 条评论` : '查看这条的评论',
    'aria-label': count ? `查看这条的 ${count} 条评论` : '查看这条的评论'
  });
  const icon = xIcon('reply');
  if (icon) button.appendChild(icon);
  button.appendChild(el('span', { class: 'pv-x-comment-count', text: count ? formatCount(count) : '' }));
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenComments(model, button);
  });
  paintRepliesLink(button, model);
  return button;
}

/** 回复数变化（发回复、评论卡拿到新计数）后刷新入口；为 0 时隐藏 */
export function paintRepliesLink(button, model) {
  if (!button) return;
  const count = countOf(model, 'replies');
  button.hidden = !count;
  const label = count ? `查看这条的 ${count} 条评论` : '查看这条的评论';
  button.title = label;
  button.setAttribute('aria-label', label);
  const countNode = button.querySelector('.pv-x-comment-count');
  if (countNode) countNode.textContent = count ? formatCount(count) : '';
}

function headNode(model, bindProfile = null, onOpenComments = null) {
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
    const full = fullTime(model.createdAt);
    const date = new Date(model.createdAt);
    // 与旧版 X 阅读器一致：行内显示完整日期时间（完整中文时间仍放在 title 里）。
    const label = Number.isNaN(date.getTime())
      ? full
      : date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
    head.appendChild(
      el('time', {
        class: 'pv-x-time',
        text: label || full,
        title: full || null,
        datetime: Number.isNaN(date.getTime()) ? null : date.toISOString()
      })
    );
  }
  const entry = repliesEntry(model, onOpenComments);
  if (entry) head.appendChild(entry);
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

/** 计数字段的统一读取：模型缺 counts 时归 0，而不是抛错（一次抛错会让整次渲染被当成加载失败） */
function countOf(model, key) {
  if (!key) return 0;
  return Number(model && model.counts && model.counts[key]) || 0;
}

/** 按钮的激活态与数字由这里统一刷新（乐观更新与回滚都复用它） */
export function paintAction(button, model, key) {
  if (!button) return;
  const flag = FLAG_BY_ACTION[key];
  const active = Boolean(flag && model.flags && model.flags[flag]);
  if (flag) {
    button.dataset.active = active ? 'true' : 'false';
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  const countNode = button.querySelector('.pv-x-count');
  const countKey = COUNT_BY_ACTION[key];
  const spec = ACTIONS.find((item) => item.key === key);
  const value = countKey ? countOf(model, countKey) : 0;
  // 读屏标签带上数字：「喜欢 12」
  if (spec) button.setAttribute('aria-label', value ? `${spec.label} ${formatCount(value)}` : spec.label);
  if (!countNode || !countKey) return;
  countNode.textContent = value ? formatCount(value) : '';
}

function actionsNode(model, onAction) {
  const row = el('div', { class: 'pv-x-actions' });
  for (const spec of ACTIONS) {
    const value = spec.count ? countOf(model, spec.count) : 0;
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
 * 富文本正文：按 X 的实体区间把 @提及 / #话题 / $代码 / 链接渲染成可点链接。
 * 实体偏移已在数据层完成「码点 → UTF-16」换算与显示窗口裁剪。
 * 类型校验：@ / # / $ 这类行内实体的切片文字必须真的以该符号开头，否则宁可当纯文本。
 * 链接例外：正文里放的是 t.co 短链，X 界面显示的是 display_url（如 github.com/foo/bar），
 * 因此链接文字用实体自带的 label，而不是切片出来的 t.co。
 */
function appendRichText(container, model, bindProfile) {
  const text = displayText(model);
  const ranges = (model.entities || []).filter((range) => range.end > range.start && range.start >= 0);
  if (!ranges.length) {
    container.appendChild(document.createTextNode(text));
    return;
  }
  const prefixOf = { mention: '@', hashtag: '#', symbol: '$' };
  let cursor = 0;
  for (const range of ranges) {
    const start = Math.max(cursor, Math.min(range.start, text.length));
    const end = Math.max(start, Math.min(range.end, text.length));
    if (start > cursor) container.appendChild(document.createTextNode(text.slice(cursor, start)));
    if (end > start) {
      const sliced = text.slice(start, end);
      const prefix = prefixOf[range.kind];
      // 链接用 display_url 当文字（与 X 一致），其余实体用切片文字并校验前缀
      const label = range.kind === 'url' ? range.label || sliced : sliced;
      const valid = range.kind === 'url' ? Boolean(range.url) : !prefix || sliced.startsWith(prefix);
      if (!range.url || !valid) {
        container.appendChild(document.createTextNode(sliced));
      } else {
        const link = el('a', {
          class: `pv-x-entity pv-x-entity-${range.kind}`,
          href: range.url,
          target: '_blank',
          rel: 'noreferrer',
          text: label
        });
        // @提及 也能悬停看资料卡（作者信息取自 entities.user_mentions）
        if (range.kind === 'mention' && range.author && bindProfile) {
          bindProfile(link, { id: range.author.id, author: range.author });
        }
        container.appendChild(link);
      }
    }
    cursor = end;
  }
  if (cursor < text.length) container.appendChild(document.createTextNode(text.slice(cursor)));
}

/**
 * 渲染正文块（含翻译行）。翻译状态变化时由加载器重新调用本函数刷新同一个块，
 * 因此这里必须是幂等的：先清空再重建。
 */
export function renderTextBlock(block, model, view, bindProfile = null) {
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

  const body = el('div', { class: 'pv-x-text' });
  // 译文没有实体信息，按纯文本渲染
  if (showing) body.textContent = entry.text;
  else appendRichText(body, model, bindProfile);
  block.appendChild(body);

  // 正文被 X 截断时给「显示更多」补全全文（note_tweet 已带全文则不出现）
  if (model.needsExpand) {
    const more = el('button', {
      class: 'pv-x-more-text',
      type: 'button',
      text: model.expanding ? '正在加载全文…' : '显示更多',
      disabled: model.expanding ? '' : null
    });
    more.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      view?.onExpand?.(model);
    });
    block.appendChild(more);
  }
}

function textBlock(model, view, bindProfile) {
  const block = el('div', { class: 'pv-x-translatable', 'data-translation-id': model.id });
  renderTextBlock(block, model, view, bindProfile);
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

// ---------- 媒体 ----------

/**
 * 图片轮播：固定窗体 + 两侧固定箭头，只有中间的图片轨道做 translateX 滑动。
 * 两处共用：
 *   - variant 'inline'：主贴里的默认展示（灯箱态），点图再弹覆盖式大图
 *   - variant 'overlay'：点击后弹出的覆盖式灯箱
 * 键盘/指针事件都挂在窗体自己身上（不注册 document 全局监听），随 DOM 一起回收。
 */
function createMediaCarousel(photos, { openUrl, variant = 'inline', startIndex = 0, onZoom = null, onClose = null } = {}) {
  if (!photos.length) return null;
  let current = Math.max(0, Math.min(startIndex, photos.length - 1));

  // 固定窗体：宽高比取自第一张图（切换时不改变窗体大小）
  const framePhoto = photos[0];
  // 浮层才外置箭头、才挂缩放条；栏内保持原样（按钮仍在窗体内）
  const overlay = variant === 'overlay';
  // 栏内轮播与浮层窗体都可 Tab 进入（栏内 Enter 放大、←/→ 切图；浮层可缩放/平移）
  const stage = el('div', {
    class: `pv-x-media-stage pv-x-media-stage-${variant}`,
    tabindex: '0',
    'aria-roledescription': variant === 'inline' ? '图片轮播' : '图片查看',
    'aria-label':
      variant === 'inline'
        ? `${photos.length} 张图片，按 Enter 放大`
        : `${photos.length} 张图片，可缩放、可拖动；方向键切图，+/- 缩放，0 适应`
  });
  if (framePhoto.width && framePhoto.height) stage.style.aspectRatio = `${framePhoto.width} / ${framePhoto.height}`;

  // 图片轨道：所有图并排，靠 translateX 滑动；imgs 留引用给缩放态改 transform
  const track = el('div', { class: 'pv-x-media-track' });
  const imgs = photos.map((photo) =>
    el('img', { class: 'pv-x-media-big', src: photo.url, alt: photo.altText || '', loading: 'lazy', draggable: 'false' })
  );
  const slides = imgs.map((img) => {
    const slide = el('div', { class: 'pv-x-media-slide' }, img);
    track.appendChild(slide);
    return slide;
  });

  const counter = el('span', { class: 'pv-x-media-counter' });
  const closeButton = el('button', {
    class: 'pv-x-media-collapse',
    type: 'button',
    'aria-label': variant === 'overlay' ? '关闭大图' : '收起图片',
    text: '✕'
  });
  const openLink = el('a', { class: 'pv-x-media-open', href: openUrl, target: '_blank', rel: 'noreferrer', text: '在 X 打开' });
  // 浮层：页码、在 X 打开、✕ 全部收在右上角一组，读起来是「一串操作」而不是被拉开的两头
  // 栏内默认态没有「收起」目标（网格已经不在了），只有浮层需要关闭按钮
  const bar = overlay
    ? el(
        'div',
        { class: 'pv-x-media-bar pv-x-media-bar-grouped' },
        el('div', { class: 'pv-x-media-bar-group' }, counter, openLink, closeButton)
      )
    : el('div', { class: 'pv-x-media-bar' }, counter, openLink);

  // 左右切换：浮层里是图片外的左右两栏（垂直居中、固定不动）；栏内沿用贴边叠放（仅多图时出现）
  const prevButton =
    photos.length > 1
      ? el(
          'button',
          { class: 'pv-x-media-nav pv-x-media-prev', type: 'button', 'aria-label': '上一张' },
          svgIcon('chevronLeft', { size: 24 })
        )
      : null;
  const nextButton =
    photos.length > 1
      ? el(
          'button',
          { class: 'pv-x-media-nav pv-x-media-next', type: 'button', 'aria-label': '下一张' },
          svgIcon('chevronRight', { size: 24 })
        )
      : null;

  // ---------- 浮层骨架：左箭头 | 图片视口 | 右箭头 + 底部缩放条 ----------
  // 箭头在三栏的两侧留白里，不压图片；视口宽度由 flex 让出来，syncFrame 直接量视口。
  const viewport = overlay ? el('div', { class: 'pv-x-media-viewport' }) : null;
  const main = overlay ? el('div', { class: 'pv-x-media-main' }) : null;
  const shell = overlay ? el('div', { class: 'pv-x-media-shell' }) : null;
  const zoomRange = overlay
    ? el('div', {
        class: 'pv-x-zoom-range',
        role: 'slider',
        tabindex: '0',
        'aria-label': '缩放比例',
        'aria-valuemin': String(MIN_SCALE * 100),
        'aria-valuemax': String(MAX_SCALE * 100),
        'aria-valuenow': '100',
        'aria-valuetext': '100%',
        title: '拖动 / 滚轮缩放'
      })
    : null;
  const zoomValue = overlay ? el('span', { class: 'pv-x-zoom-value', text: '100%' }) : null;
  const zoomOutButton = overlay
    ? el(
        'button',
        { class: 'pv-x-zoom-btn', type: 'button', 'aria-label': '缩小', title: '缩小（-）' },
        svgIcon('minus', { size: 16 })
      )
    : null;
  const zoomInButton = overlay
    ? el(
        'button',
        { class: 'pv-x-zoom-btn', type: 'button', 'aria-label': '放大', title: '放大（+）' },
        svgIcon('plus', { size: 16 })
      )
    : null;
  const zoomFitButton = overlay
    ? el('button', { class: 'pv-x-zoom-fit', type: 'button', 'aria-label': '适应窗口，恢复 100%', text: '适应' })
    : null;
  if (overlay) zoomRange.append(el('div', { class: 'pv-x-zoom-fill' }), el('div', { class: 'pv-x-zoom-thumb' }));
  const zoomBar = overlay
    ? el('div', { class: 'pv-x-media-zoom' }, zoomOutButton, zoomRange, zoomValue, zoomInButton, zoomFitButton)
    : null;
  // 键盘事件挂在整个浮层壳上（Esc 在缩放条上也要能关灯箱）；栏内仍挂窗体
  const keyHost = shell || stage;

  // ---------- 滑动切换（固定窗体，只有中间轨道在动）----------
  // 用 rAF 弹簧而不是 CSS transition：手势驱动的位移必须能中途抓住并反向，
  // CSS 过渡/关键帧做不到（会在反向时出现速度断层的「撞墙感」）。

  const reduceMotion = () => {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (err) {
      return false;
    }
  };
  const width = () => stage.clientWidth || 1;
  const targetOf = (i) => -i * width();
  // 当前轨道的实际位移（px）。这是唯一的真值来源：动画中断时从它继续，不会跳变。
  let x = targetOf(current);
  let velocity = 0;
  let frame = null;
  let lastFrameAt = 0;

  const render = () => {
    track.style.transform = `translateX(${x}px)`;
  };
  const stopAnim = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastFrameAt = 0;
  };

  // ---------- 缩放 / 平移（仅浮层）----------
  // 缩放只作用在当前图片的 transform 上，轨道位移继续负责切图，两者互不干扰。
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let zoomRaf = null;
  let wheelSnapTimer = null;
  const activeImg = () => imgs[current] || null;
  const isZoomed = () => scale > 1.005;
  // 本实例注册的监听统一记账，destroy() 里一次注销（灯箱/栏内的全部监听都走这里）
  const boundListeners = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    boundListeners.push([target, type, handler, options]);
  };
  const frameSize = () => ({ w: stage.clientWidth, h: stage.clientHeight });
  // 视口中心（缩放锚点的原点）
  const contentCenter = () => {
    const rect = stage.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  // 100% 时图片的布局尺寸：offsetWidth/Height 不吃 transform，动画中途读也是对的。
  // 还没解码完（complete=false）就先用视口兜底，免得 cap 退回 4x 把图放大到远超原图。
  const baseSize = () => {
    const img = activeImg();
    if (!img || !img.complete || !img.naturalWidth) return frameSize();
    return { w: img.offsetWidth, h: img.offsetHeight };
  };
  // 放大上限：小图按原图像素的两倍封顶，别放大成一团马赛克
  const zoomCap = () => maxScaleFor(activeImg()?.naturalWidth || 0, baseSize().w);

  const clampZoom = () => {
    const f = frameSize();
    const b = baseSize();
    const next = clampTranslate(tx, ty, { contentW: b.w, contentH: b.h, frameW: f.w, frameH: f.h, scale });
    tx = next.x;
    ty = next.y;
  };
  const paintZoom = () => {
    if (!overlay) return;
    const cap = Math.max(MIN_SCALE, zoomCap());
    const percent = Math.round(scale * 100);
    stage.classList.toggle('pv-x-media-zoomed', isZoomed());
    zoomRange.setAttribute('aria-valuenow', String(percent));
    zoomRange.setAttribute('aria-valuemax', String(Math.round(cap * 100)));
    zoomRange.setAttribute('aria-valuetext', `${percent}%`);
    zoomRange.style.setProperty('--pv-zoom-ratio', String(scaleToRatio(scale, cap)));
    zoomValue.textContent = `${percent}%`;
    zoomOutButton.disabled = scale <= MIN_SCALE + 0.001;
    zoomInButton.disabled = scale >= cap - 0.001;
    zoomFitButton.disabled = scale <= MIN_SCALE + 0.001;
  };
  const applyZoom = () => {
    const img = activeImg();
    if (!img) return;
    img.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
    paintZoom();
  };
  const cancelZoomAnim = () => {
    if (zoomRaf !== null) cancelAnimationFrame(zoomRaf);
    zoomRaf = null;
  };
  // 滚轮停手吸附：被别的缩放入口打断时取消，免得它在补间中途把目标改掉
  const cancelWheelSnap = () => {
    if (wheelSnapTimer !== null) clearTimeout(wheelSnapTimer);
    wheelSnapTimer = null;
  };
  const resetZoom = () => {
    cancelZoomAnim();
    cancelWheelSnap();
    scale = 1;
    tx = 0;
    ty = 0;
    for (const img of imgs) img.style.transform = '';
    if (!overlay) return;
    stage.classList.remove('pv-x-media-zoomed');
    paintZoom();
  };
  /** 以锚点为中心补间缩放（滚轮/滑杆/双击/按钮共用）；reduced-motion 直接落位 */
  const animateZoom = (targetScale, anchorX, anchorY) => {
    if (!overlay) return;
    const next = clampScale(targetScale, zoomCap());
    if (debugEnabled()) {      const b = baseSize();
      const f = frameSize();
      stage.dataset.zoomDebug = JSON.stringify({
        targetScale,
        next,
        scale,
        tx,
        ty,
        cap: zoomCap(),
        baseW: b.w,
        frameW: f.w,
        natural: activeImg()?.naturalWidth || 0
      });
    }
    cancelZoomAnim();
    cancelWheelSnap();
    const center = contentCenter();
    const dx = anchorX - center.x;
    const dy = anchorY - center.y;
    if (reduceMotion() || Math.abs(next - scale) < 0.001) {
      const z = zoomTowards({ scale, tx, ty, nextScale: next, dx, dy });
      scale = z.scale;
      tx = z.tx;
      ty = z.ty;
      clampZoom();
      applyZoom();
      return;
    }
    const from = scale;
    const px = (dx - tx) / scale;
    const py = (dy - ty) / scale;
    const started = performance.now();
    const duration = 90;
    const step = (now) => {
      const k = Math.min(1, (now - started) / duration);
      scale = from + (next - from) * k;
      tx = dx - px * scale;
      ty = dy - py * scale;
      clampZoom();
      applyZoom();
      zoomRaf = k < 1 ? requestAnimationFrame(step) : null;
    };
    zoomRaf = requestAnimationFrame(step);
  };
  /** 拖拽/捏合/滑杆走直接落位，不补间（跟手） */
  const setZoomAt = (targetScale, anchorX, anchorY) => {
    if (!overlay) return;
    cancelZoomAnim();
    cancelWheelSnap();
    const center = contentCenter();
    const next = clampScale(targetScale, zoomCap());
    const z = zoomTowards({ scale, tx, ty, nextScale: next, dx: anchorX - center.x, dy: anchorY - center.y });
    scale = z.scale;
    tx = z.tx;
    ty = z.ty;
    clampZoom();
    applyZoom();
  };
  /** 滚轮缩放：在图片上以光标为中心，在缩放条上以画面中心为中心；每格 ±8%（Shift 20%），停手后吸附 5% */
  const scheduleWheelSnap = () => {
    if (wheelSnapTimer !== null) clearTimeout(wheelSnapTimer);
    wheelSnapTimer = setTimeout(() => {
      wheelSnapTimer = null;
      if (gesture) return; // 手势进行中让手势自己维护 scale
      const snapped = clampScale(Math.round(scale * 20) / 20, zoomCap());
      if (Math.abs(snapped - scale) < 0.001) return;
      const center = contentCenter();
      animateZoom(snapped, center.x, center.y);
    }, 160);
  };
  const wheelZoom = (event, anchorX, anchorY) => {
    if (!overlay) return;
    event.preventDefault();
    if (gesture && gesture.mode === 'pan') return; // 平移手势中滚轮先不抢，避免基准位移对不上
    cancelZoomAnim();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight || 1 : 1;
    // 横向滚轮 / 触控板横扫 / Firefox 的 Shift+wheel 只给 deltaX
    const raw = event.deltaY !== 0 ? event.deltaY : event.deltaX;
    if (!raw) return;
    const notches = (-raw * unit) / 100;
    const factor = Math.pow(event.shiftKey ? 1.2 : 1.08, notches);
    setZoomAt(clampScale(scale * factor, zoomCap()), anchorX, anchorY);
    scheduleWheelSnap();
  };
  const onStageWheel = (event) => wheelZoom(event, event.clientX, event.clientY);

  // 缩放条交互：拖动 / 点轨道 / 滚轮 / 键盘 / ± / 适应
  if (overlay) {
    let sliding = false;
    const scaleFromSlider = (event) => {
      const rect = zoomRange.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const center = contentCenter();
      // 轨道按本张图的像素上限映射：最右端正好等于上限，不出现死区
      const cap = Math.max(MIN_SCALE, zoomCap());
      setZoomAt(ratioToScale(ratio, cap), center.x, center.y);
    };
    const onSliderDown = (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      sliding = true;
      zoomRange.focus({ preventScroll: true });
      try {
        zoomRange.setPointerCapture(event.pointerId);
      } catch (err) {
        // 不支持指针捕获时仍可按点位缩放
      }
      scaleFromSlider(event);
    };
    const onSliderMove = (event) => {
      if (sliding) scaleFromSlider(event);
    };
    const onSliderEnd = () => {
      sliding = false;
    };
    const onSliderWheel = (event) => {
      const center = contentCenter();
      wheelZoom(event, center.x, center.y);
    };
    const onSliderKey = (event) => {
      const center = contentCenter();
      const steps = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.25, PageDown: -0.25 };
      if (event.key in steps) {
        event.preventDefault();
        event.stopPropagation();
        animateZoom(scale + steps[event.key], center.x, center.y);
      } else if (event.key === 'Home') {
        event.preventDefault();
        event.stopPropagation();
        animateZoom(MIN_SCALE, center.x, center.y);
      } else if (event.key === 'End') {
        event.preventDefault();
        event.stopPropagation();
        animateZoom(MAX_SCALE, center.x, center.y);
      }
    };
    const onZoomOut = () => {
      const center = contentCenter();
      animateZoom(scale - 0.25, center.x, center.y);
    };
    const onZoomIn = () => {
      const center = contentCenter();
      animateZoom(scale + 0.25, center.x, center.y);
    };
    const onZoomFit = () => {
      const center = contentCenter();
      animateZoom(MIN_SCALE, center.x, center.y);
    };
    listen(zoomRange, 'pointerdown', onSliderDown);
    listen(zoomRange, 'pointermove', onSliderMove);
    listen(zoomRange, 'pointerup', onSliderEnd);
    listen(zoomRange, 'pointercancel', onSliderEnd);
    listen(zoomRange, 'wheel', onSliderWheel, { passive: false });
    listen(zoomRange, 'keydown', onSliderKey);
    listen(zoomOutButton, 'click', onZoomOut);
    listen(zoomInButton, 'click', onZoomIn);
    listen(zoomFitButton, 'click', onZoomFit);
  }

  // 图片解码完成后按真实像素重算上限：加载前被放大过的值要收回来
  const onImgLoad = (event) => {
    if (event.currentTarget !== activeImg()) return;
    scale = clampScale(scale, zoomCap());
    clampZoom();
    applyZoom();
  };

  const paintButtons = () => {
    if (prevButton) prevButton.disabled = current <= 0;
    if (nextButton) nextButton.disabled = current >= photos.length - 1;
    counter.textContent = `${current + 1} / ${photos.length}`;
    slides.forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== current)));
  };

  /** 弹簧收敛到某张：临界阻尼（无过冲）；带速度释放时略欠阻尼（一点点回弹，因为手势本身有动量） */
  const settle = (targetIndex, v0 = 0) => {
    const next = Math.max(0, Math.min(targetIndex, photos.length - 1));
    // 切图重置缩放：避免下一张带着上一张的位移，也让「拖动=切图」的语义干净
    if (next !== current) resetZoom();
    current = next;
    paintButtons();
    // resetZoom 里的 paintZoom 拿的是上一张的像素上限，切完再按新图刷一次
    if (overlay) paintZoom();
    const to = targetOf(current);
    if (reduceMotion() || photos.length < 2) {
      stopAnim();
      x = to;
      velocity = 0;
      render();
      return;
    }
    stopAnim();
    // Apple 的 response 不是「时长」：ω 由它推出，收敛时间自然涌现
    const response = 0.34;
    const omega = (2 * Math.PI) / response;
    const damping = Math.abs(v0) > 300 ? 0.85 : 1;
    velocity = v0;
    const step = (now) => {
      const dt = lastFrameAt ? Math.min((now - lastFrameAt) / 1000, 1 / 30) : 1 / 60;
      lastFrameAt = now;
      const accel = -omega * omega * (x - to) - 2 * damping * omega * velocity;
      velocity += accel * dt;
      x += velocity * dt;
      if (Math.abs(x - to) < 0.5 && Math.abs(velocity) < 8) {
        x = to;
        velocity = 0;
        render();
        frame = null;
        lastFrameAt = 0;
        return;
      }
      render();
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  const show = (next) => settle(next);
  if (prevButton) listen(prevButton, 'click', () => show(current - 1));
  if (nextButton) listen(nextButton, 'click', () => show(current + 1));

  // 帧高必须相对**所在栏的可见高**，不能用视口单位（单栏时栏只有约 32vh）。
  // 而且这里直接把高度算成**像素**而不是靠百分比：帧一旦被 max-height 截断，
  // 轨道/幻灯片的 height:100% 解析就不再确定，图片会按原始尺寸渲染并被 overflow:hidden 裁掉
  // （表现就是「窗体越大图反而被裁得越多」）。
  // 灯箱（固定窗体）的尺寸分两种：
  //   inline —— 走**单图逻辑**：宽度铺满、高度 = 宽度 × 首图比例（inline aspect-ratio 直接给），
  //            不做任何封顶，所以竖图就是整幅大图、和单图一样大（需要时栏自己滚动）
  //   overlay —— 量的是三栏中间的**视口**（箭头在视口外），在视口可用区域内按首图比例上 contain
  // 浮层必须算像素：帧一旦被间接约束截断，轨道/幻灯片的 height:100% 解析就不可靠，
  // 图片会按原始尺寸渲染并被 overflow:hidden 裁掉。
  const frameRatio = framePhoto.width && framePhoto.height ? framePhoto.height / framePhoto.width : 0;
  const wrapper = () => stage.parentElement; // 浮层：.pv-x-media-viewport（不包含两侧箭头）
  let resizeObserver = null;
  let observedBox = null;
  const syncFrame = () => {
    if (!overlay) return; // 栏内按单图逻辑，不需要测量
    const box = wrapper();
    if (!box || !box.clientWidth || !box.clientHeight) return; // 尚未挂载/尺寸为 0
    // 容器是延迟出现的（layer 在轮播创建之后才 append），首次拿到后补观察
    if (resizeObserver && observedBox !== box) {
      if (observedBox) resizeObserver.unobserve(observedBox);
      resizeObserver.observe(box);
      observedBox = box;
    }
    // 窄屏：两侧留白放不下箭头，退化为贴边叠放，这里扣出给按钮的 12px
    const lightbox = shell?.parentElement;
    const narrow = (lightbox?.clientWidth || box.clientWidth) < 520 || box.clientWidth < 360;
    shell.classList.toggle('is-narrow', narrow);
    const availableWidth = box.clientWidth - (narrow ? 24 : 0);
    const availableHeight = box.clientHeight;
    if (availableWidth <= 0 || availableHeight <= 0) return;
    // 按首图比例 contain 适配：先按宽度铺满，太高就改为按高度收窄
    let width = availableWidth;
    let height = frameRatio ? width * frameRatio : availableHeight;
    if (height > availableHeight) {
      height = availableHeight;
      width = frameRatio ? height / frameRatio : availableWidth;
    }
    stage.style.width = `${Math.round(width)}px`;
    stage.style.height = `${Math.round(height)}px`;
    // 顶部条贴着图片顶边（主区里图片是垂直居中的，条在壳顶需要向下让出居中偏移）
    shell.style.setProperty('--pv-bar-top', `${Math.max(0, Math.round((availableHeight - height) / 2))}px`);
    // 尺寸变了：缩放态的平移量按新帧重新钳制
    if (isZoomed()) {
      clampZoom();
      applyZoom();
    }
  };

  // 侧栏宽度变化后延一帧再量：syncFrame 会切 is-narrow，让被观察的视口在回调投递中自己变宽变窄，
  // 不延迟的话 Chrome 会报 ResizeObserver loop 警告。
  let resizeFrame = null;
  const onResize = () => {
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      if (gesture) return;
      syncFrame();
      // 窗体宽度变了，轨道的像素位移要按新宽度重算
      x = targetOf(current);
      render();
    });
  };
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(onResize);
    if (wrapper()) {
      resizeObserver.observe(wrapper());
      observedBox = wrapper();
    }
  }
  syncFrame();

  // 动量投影：按释放速度推算「将要停在哪」，再吸附到离它最近的一张（不是从释放点就近吸附）
  const project = (v, deceleration = 0.998) => (v / 1000) * deceleration / (1 - deceleration);
  // 边界橡皮筋：越界越难拖，而不是硬停
  const rubberband = (overshoot, dimension, constant = 0.55) =>
    (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));

  // 手势路由：未放大时单指=切图；放大后单指=平移；两指=捏合（浮层）
  let gesture = null; // { mode: 'swipe' | 'pan' | 'pinch', ... }
  let suppressClick = false;
  const pointers = new Map();

  const beginSwipe = (event) => {
    stopAnim(); // 抓住正在滑动的轨道：从当前屏幕值继续
    const now = performance.now();
    gesture = { mode: 'swipe', startX: event.clientX, base: x, samples: [[now, x]] };
    stage.classList.add('pv-x-media-dragging');
  };
  const beginPan = (event) => {
    cancelZoomAnim();
    gesture = { mode: 'pan', startX: event.clientX, startY: event.clientY, baseTx: tx, baseTy: ty };
    stage.classList.add('pv-x-media-dragging');
  };
  const beginPinch = () => {
    cancelZoomAnim();
    cancelWheelSnap();
    const [a, b] = [...pointers.values()];
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const center = contentCenter();
    gesture = {
      mode: 'pinch',
      dist0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      baseScale: scale,
      px: (midX - center.x - tx) / scale,
      py: (midY - center.y - ty) / scale
    };
    stage.classList.add('pv-x-media-dragging');
  };
  const onPointerDown = (event) => {
    if (event.target.closest('button, a')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      stage.setPointerCapture(event.pointerId);
    } catch (err) {
      // 不支持指针捕获：仍可拖动，只是移出元素后不再跟随
    }
    if (overlay) {
      if (pointers.size >= 2) {
        // 第二/第三指落下都重取「当前两指」为基准，避免沿用已经抬起的手指
        beginPinch();
        return;
      }
    } else if (pointers.size > 1) {
      return; // 栏内保持单指切图，第二指先忽略
    }
    if (!overlay && photos.length < 2) return;
    if (isZoomed()) beginPan(event);
    else if (photos.length > 1) beginSwipe(event);
  };
  const onPointerMove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;
    if (gesture.mode === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const target = clampScale(gesture.baseScale * (dist / gesture.dist0), zoomCap());
      const center = contentCenter();
      scale = target;
      tx = midX - center.x - gesture.px * target;
      ty = midY - center.y - gesture.py * target;
      clampZoom();
      applyZoom();
      return;
    }
    if (gesture.mode === 'pan') {
      tx = gesture.baseTx + (event.clientX - gesture.startX);
      ty = gesture.baseTy + (event.clientY - gesture.startY);
      clampZoom();
      applyZoom();
      return;
    }
    const min = targetOf(photos.length - 1);
    const max = 0;
    // 1:1 跟手；越界部分用橡皮筋衰减（软边界，不是硬停）
    let next = gesture.base + (event.clientX - gesture.startX);
    if (next > max) next = max + rubberband(next - max, width());
    else if (next < min) next = min - rubberband(min - next, width());
    x = next;
    render();
    const now = performance.now();
    gesture.samples.push([now, x]);
    while (gesture.samples.length > 2 && now - gesture.samples[0][0] > 90) gesture.samples.shift();
  };
  const onPointerUp = (event) => {
    pointers.delete(event.pointerId);
    if (!overlay && pointers.size > 0) return;
    if (!gesture) return;
    if (gesture.mode === 'pinch') {
      if (pointers.size >= 2) {
        // 三指里抬起一根：剩下仍≥2 指，按当前两指重建捏合基准
        beginPinch();
        return;
      }
      gesture = null;
      stage.classList.remove('pv-x-media-dragging');
      // 手势期间被丢弃的 resize 在这里补算一次
      syncFrame();
      // 捏合可能打断过正在进行的切图：先把轨道吸附回当前张
      if (Math.abs(x - targetOf(current)) > 1) settle(current);
      if (!isZoomed()) {
        // 缩回适应区就自动回到 100%，手势语义随之恢复成切图
        animateZoom(MIN_SCALE, contentCenter().x, contentCenter().y);
      } else if (pointers.size === 1) {
        // 还留着一根指头：直接接成平移，不用重新按下
        const rest = [...pointers.values()][0];
        beginPan({ clientX: rest.x, clientY: rest.y });
      }
      return;
    }
    if (gesture.mode === 'pan') {
      const pan = gesture;
      gesture = null;
      stage.classList.remove('pv-x-media-dragging');
      syncFrame();
      const moved = Math.abs(tx - pan.baseTx) > 6 || Math.abs(ty - pan.baseTy) > 6;
      if (moved) suppressClick = true;
      if (scale < 1.02) animateZoom(MIN_SCALE, contentCenter().x, contentCenter().y);
      return;
    }
    const samples = gesture.samples;
    const last = samples[samples.length - 1];
    const first = samples[0];
    const dt = last[0] - first[0];
    // 释放速度（px/s）：交给收尾弹簧，让拖拽与动画之间没有缝
    const v0 = dt > 0 ? ((last[1] - first[1]) / dt) * 1000 : 0;
    const projected = x + project(v0);
    const targetIndex = Math.max(0, Math.min(Math.round(-projected / width()), photos.length - 1));
    // 拖过一段距离就不算点击（否则松手时会误开大图）
    suppressClick = Math.abs(x - gesture.base) > 6;
    gesture = null;
    stage.classList.remove('pv-x-media-dragging');
    settle(targetIndex, v0);
    syncFrame();
  };
  const onDoubleClick = (event) => {
    if (event.target.closest('button, a')) return;
    event.preventDefault();
    const center = contentCenter();
    // 双击在 100% 与 200% 之间切换，以点击点为中心
    if (isZoomed()) animateZoom(MIN_SCALE, center.x, center.y);
    else animateZoom(2, event.clientX, event.clientY);
  };
  const destroy = () => {
    stopAnim();
    cancelZoomAnim();
    cancelWheelSnap();
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    resizeFrame = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    pointers.clear();
    gesture = null;
    // 本轮播注册过的监听全部注销（keydown/pointer/wheel/dblclick/click/load）
    for (const [target, type, handler, options] of boundListeners) target.removeEventListener(type, handler, options);
    boundListeners.length = 0;
  };
  const close = () => {
    destroy();
    onClose?.();
  };
  function onKey(event) {
    if (event.key === 'Escape' && overlay) {
      // Esc 先关大图，不关弹窗
      event.stopPropagation();
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowRight' && photos.length > 1) {
      event.stopPropagation();
      event.preventDefault();
      show(current + 1);
    } else if (event.key === 'ArrowLeft' && photos.length > 1) {
      event.stopPropagation();
      event.preventDefault();
      show(current - 1);
    } else if (overlay && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      animateZoom(scale + 0.25, contentCenter().x, contentCenter().y);
    } else if (overlay && (event.key === '-' || event.key === '_')) {
      event.preventDefault();
      animateZoom(scale - 0.25, contentCenter().x, contentCenter().y);
    } else if (overlay && event.key === '0') {
      event.preventDefault();
      animateZoom(MIN_SCALE, contentCenter().x, contentCenter().y);
    } else if ((event.key === 'Enter' || event.key === ' ') && !overlay && onZoom && event.target === stage) {
      event.preventDefault();
      onZoom(current, stage);
    }
  }
  // 栏内默认态：点图弹出覆盖式大图（不是替换图片）
  const onInlineClick = (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (event.target.closest('button, a')) return;
    onZoom(current, stage);
  };
  listen(closeButton, 'click', close);
  listen(keyHost, 'keydown', onKey);
  listen(stage, 'pointerdown', onPointerDown);
  listen(stage, 'pointermove', onPointerMove);
  listen(stage, 'pointerup', onPointerUp);
  listen(stage, 'pointercancel', onPointerUp);
  if (overlay) {
    listen(stage, 'dblclick', onDoubleClick);
    listen(stage, 'wheel', onStageWheel, { passive: false });
    for (const img of imgs) listen(img, 'load', onImgLoad);
  } else if (onZoom) {
    listen(stage, 'click', onInlineClick);
  }

  stage.appendChild(track);
  if (overlay) {
    // 三栏：箭头在视口外，图片永远不压按钮；bar 在 main 之后（Tab 顺序：箭头 → 图 → 箭头 → 打开/关闭 → 缩放条）
    viewport.appendChild(stage);
    if (prevButton) main.appendChild(prevButton);
    main.appendChild(viewport);
    if (nextButton) main.appendChild(nextButton);
    shell.append(main, bar, zoomBar);
  } else {
    stage.appendChild(bar);
    if (prevButton) stage.appendChild(prevButton);
    if (nextButton) stage.appendChild(nextButton);
  }

  // 初始位置直接落位（不播动画），按钮可用态、序号与缩放条一并刷新
  x = targetOf(current);
  render();
  paintButtons();
  if (overlay) {
    paintZoom();
    // harness 等场景拿不到 ResizeObserver 回调时可以手动重算
    shell.__syncFrame = syncFrame;
  }
  return {
    mount: overlay ? shell : stage,
    stage,
    destroy,
    // 容器是在创建之后才 append 的，调用方挂载后需要立刻调一次
    syncFrame,
    get index() {
      return current;
    }
  };
}

/** 覆盖式大图灯箱：点主贴/评论里的图片时弹出，内部复用同一个轮播 */
function openMediaLightbox(anchor, photos, index, openUrl, returnFocus = null) {
  const root = (anchor && anchor.closest && anchor.closest('.pv-x-reader')) || (anchor && anchor.parentElement);
  if (!root || !photos.length || root.querySelector('.pv-x-media-lightbox')) return;
  const layer = el('div', {
    class: 'pv-x-media-lightbox',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': '图片查看'
  });
  // 拦截「打开的那一次点击 / 双击的第二下」直接命中背景而瞬间关掉
  const openedAt = performance.now();
  let carousel = null;
  const close = () => {
    carousel?.destroy();
    layer.remove();
    // 焦点还给打开它的图片/轮播
    if (returnFocus && returnFocus.isConnected) {
      try {
        returnFocus.focus({ preventScroll: true });
      } catch (err) {
        returnFocus.focus();
      }
    }
  };
  carousel = createMediaCarousel(photos, { openUrl, variant: 'overlay', startIndex: index, onClose: close });
  layer.appendChild(carousel.mount);
  // 点背景关闭（点图片本身、点顶部条不关）；视口肩部的留白也算背景
  layer.addEventListener('click', (event) => {
    if (performance.now() - openedAt < 300) return;
    const target = event.target;
    if (target === layer || target === carousel.mount) return close();
    if (target.classList && (target.classList.contains('pv-x-media-main') || target.classList.contains('pv-x-media-viewport'))) close();
  });
  root.appendChild(layer);
  carousel.syncFrame();
  // 聚焦窗体让 Esc/方向键/缩放键可用；preventScroll 避免弹层出现时页面跳动
  try {
    carousel.stage.focus({ preventScroll: true });
  } catch (err) {
    carousel.stage.focus();
  }
}

function mediaGrid(model, { openUrl }) {
  const items = (model.media || []).slice(0, 4);
  if (!items.length) return null;
  const photos = items.filter((item) => item.type === 'photo');
  const grid = el('div', { class: `pv-x-media pv-x-media-${items.length}` });
  // 多图且全是图片：默认就是灯箱态（固定窗体 + 两侧箭头 + 左右滑动），不需要先点一下
  if (items.length > 1 && photos.length === items.length) {
    const carousel = createMediaCarousel(photos, {
      openUrl,
      variant: 'inline',
      onZoom: (index, stageNode) => openMediaLightbox(grid, photos, index, openUrl, stageNode)
    });
    grid.classList.add('pv-x-media-carousel');
    grid.appendChild(carousel.mount);
    carousel.syncFrame();
    return grid;
  }
  // 单图：用原始宽高预置容器宽高比 —— 否则图片加载前容器高度为 0，加载后整块内容跳一下
  if (items.length === 1 && items[0].width && items[0].height) {
    grid.style.aspectRatio = `${items[0].width} / ${items[0].height}`;
  }
  for (const item of items) {
    if (item.type === 'photo') {
      // 点图片弹出覆盖式大图灯箱
      const button = el(
        'button',
        { class: 'pv-x-media-item', type: 'button', 'aria-label': '放大图片' },
        el('img', { src: item.url, alt: item.altText || '', loading: 'lazy' })
      );
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openMediaLightbox(grid, photos, photos.indexOf(item), openUrl, button);
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
/**
 * 引用帖卡片（紧凑版）：作者行 + 正文（截两行）+ 右侧小缩略图。
 * 整卡可点，在**新窗口**打开被引用帖；卡内的 @提及/链接保持各自可点。
 */
function quoteCard(model, { bindProfile = null } = {}) {
  const quote = model.quote;
  if (!quote) return null;
  const url = openUrlOf(quote);
  // 被引用的可能是 X 长文：正文往往只剩一条 t.co（displayText 会去掉），
  // 标题与封面在 attachment 里，media 是空的 —— 需要单独走一条分支
  const article = quote.attachment && quote.attachment.type === 'article' ? quote.attachment : null;
  const card = el('div', { class: 'pv-x-quote', role: 'link', tabindex: '0', 'aria-label': '在新窗口打开引用的帖子' });

  const main = el('div', { class: 'pv-x-quote-main' });
  const head = el('div', { class: 'pv-x-quote-head' });
  if (quote.author.avatar) {
    head.appendChild(el('img', { class: 'pv-x-quote-avatar', src: quote.author.avatar, alt: '', loading: 'lazy' }));
  }
  const nameRow = el('div', { class: 'pv-x-quote-name' });
  nameRow.appendChild(el('span', { class: 'pv-x-quote-author', text: quote.author.name || quote.author.handle || '' }));
  if (quote.author.verified) {
    const badge = xIcon('verified');
    if (badge) nameRow.appendChild(el('span', { class: 'pv-x-badge' }, badge));
  }
  if (quote.author.handle) nameRow.appendChild(el('span', { class: 'pv-x-quote-handle', text: `@${quote.author.handle}` }));
  head.appendChild(nameRow);
  main.appendChild(head);

  if (article) {
    const titleRow = el('div', { class: 'pv-x-quote-title' });
    titleRow.appendChild(el('span', { class: 'pv-x-quote-tag', text: '长文' }));
    titleRow.appendChild(
      el('span', { class: 'pv-x-quote-title-text', text: article.title || article.description || '（无标题长文）' })
    );
    main.appendChild(titleRow);
    if (article.title && article.description) {
      main.appendChild(el('div', { class: 'pv-x-quote-text', text: article.description }));
    }
  } else if (displayText(quote)) {
    const body = el('div', { class: 'pv-x-quote-text' });
    appendRichText(body, quote, bindProfile);
    main.appendChild(body);
  }
  card.appendChild(main);

  // 缩略图放右侧：长文用封面，普通帖用首图（视频则是它的海报）
  const thumb = article ? article.image : (quote.media || [])[0] && (quote.media || [])[0].url;
  if (thumb) {
    card.appendChild(el('img', { class: 'pv-x-quote-media', src: thumb, alt: '', loading: 'lazy' }));
  }

  const open = () => window.open(url, '_blank', 'noopener');
  card.addEventListener('click', (event) => {
    // 卡内的 @提及 / 链接等交互优先，不触发整卡跳转
    if (event.target.closest('a, button')) return;
    event.preventDefault();
    open();
  });
  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    open();
  });
  return card;
}

export function renderPost(
  model,
  {
    threadLine = false,
    onAction = null,
    translation = null,
    bindProfile = null,
    compact = false,
    focal = false,
    onOpenComments = null
  } = {}
) {
  const article = el('article', { class: compact ? 'pv-x-post pv-x-post-compact' : 'pv-x-post' });
  if (focal) article.classList.add('pv-x-post-focal');
  // 供「正在回复这条」的高亮与定位使用
  article.dataset.tweetId = model.id;
  // 竖线始终放一个节点，是否显示由 data-thread-next 决定（下一条是它的直接回复时才画，见 syncThreadLines）
  article.dataset.threadNext = threadLine ? 'true' : 'false';
  const column = avatarColumn(model, { bindProfile });
  column.appendChild(el('span', { class: 'pv-x-thread-line', 'aria-hidden': 'true' }));
  article.appendChild(column);
  const isArticle = model.attachment && model.attachment.type === 'article';
  const main = el(
    'div',
    { class: 'pv-x-main' },
    headNode(model, bindProfile, onOpenComments),
    displayText(model) || !isArticle ? textBlock(model, translation, bindProfile) : null,
    isArticle ? (compact ? articleCard(model) : articleReader(model)) : null,
    mediaGrid(model, { openUrl: openUrlOf(model) }),
    // 引用卡放最后：不夹在正文与图片之间
    quoteCard(model, { bindProfile }),
    actionsNode(model, onAction)
  );
  article.appendChild(main);
  return article;
}

/**
 * 评论行。depth 由调用方按视图传入（同一条评论在列表和评论卡里的层级不同，
 * 而模型对象全阅读器共用一份，不能把层级写在模型上）。
 */
export function renderReply(model, { depth = model.depth, ...options } = {}) {
  const article = renderPost(model, { threadLine: false, ...options, compact: true });
  article.classList.add('pv-x-reply');
  article.style.setProperty('--pv-x-depth', String(Math.min(Number(depth) || 0, 3)));
  return article;
}

/**
 * 按显示顺序刷新竖线：下一条是这一条的直接回复时才画（列表追加、排序、插入新回复后调用）。
 * @param {HTMLElement[]} nodes 按显示顺序的评论节点
 * @param {(id:string)=>Object} modelOf 由 id 取模型
 */
export function syncThreadLines(nodes, modelOf) {
  for (let i = 0; i < nodes.length; i += 1) {
    const current = modelOf(nodes[i].dataset.tweetId);
    const next = i + 1 < nodes.length ? modelOf(nodes[i + 1].dataset.tweetId) : null;
    nodes[i].dataset.threadNext = threadContinues(current, next) ? 'true' : 'false';
  }
}

// ---------- 阅读器骨架 ----------

function sortControl(current, onSort) {
  // 排序只作用于已加载的回复（X 的接口按相关度分页）
  const group = el('div', { class: 'pv-x-sort', role: 'group', 'aria-label': '回复排序（仅已加载的回复）' });
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
function composer({ avatar, onSubmit, focalId, draftText = '', onDraftChange = null }) {
  const section = el('section', { class: 'pv-x-composer' });
  const avatarHolder = el('span', { class: 'pv-x-avatar pv-x-avatar-sm' });
  if (avatar) avatarHolder.appendChild(el('img', { src: avatar, alt: '' }));
  const input = el('textarea', { class: 'pv-x-composer-input', rows: '1', placeholder: '发布你的回复', 'aria-label': '回复内容' });
  if (draftText) input.value = draftText;
  // 草稿：正文或回复目标一变就上报，由加载器按主帖 id 暂存
  const reportDraft = () => onDraftChange?.(input.value, targetModel);
  const submit = el('button', { class: 'pv-x-composer-submit', type: 'button', text: '回复', disabled: '' });
  const hint = el('span', { class: 'pv-x-composer-hint' });

  // 回复目标：点某条评论的「回复」时显示「回复 @xxx」，可取消
  let targetModel = null;
  const targetRow = el('div', { class: 'pv-x-composer-target' });
  const targetLabel = el('span', { class: 'pv-x-composer-target-label' });
  const clearTarget = el('button', { class: 'pv-x-composer-target-clear', type: 'button', 'aria-label': '取消回复这条', text: '✕' });
  targetRow.append(targetLabel, clearTarget);
  targetRow.hidden = true;
  clearTarget.addEventListener('click', () => setTarget(null));

  function setTarget(model) {
    targetModel = model && String(model.id) !== String(focalId) ? model : null;
    const who = targetModel && ((targetModel.author && (targetModel.author.handle || targetModel.author.name)) || 'X 用户');
    if (targetModel) {
      targetLabel.textContent = `回复 @${who}`;
      targetRow.hidden = false;
    } else {
      targetRow.hidden = true;
    }
    input.setAttribute('aria-label', targetModel ? `回复 @${who} 的内容` : '回复内容');
    reportDraft();
    return targetModel;
  }

  const autoGrow = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
  };
  input.addEventListener('input', () => {
    autoGrow();
    submit.disabled = !input.value.trim();
    reportDraft();
  });
  if (draftText) submit.disabled = !draftText.trim();
  const send = async () => {
    const text = input.value.trim();
    if (!text || submit.disabled) return;
    submit.disabled = true;
    hint.textContent = '正在发布…';
    try {
      await onSubmit(text, targetModel);
      input.value = '';
      autoGrow();
      hint.textContent = '';
      setTarget(null);
      reportDraft();
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
  return {
    node: section,
    setTarget,
    focus: () => input.focus(),
    // 挂到文档后再量高度（恢复草稿时 scrollHeight 在挂载前为 0）
    syncHeight: autoGrow
  };
}

/**
 * 两个常驻的提示区：状态（role=status，礼貌播报）与错误（role=alert，立即播报）。
 * 读屏只播报「已在文档里的 live 区域」的内容变化，所以随阅读器一起建好，不在出提示时才建。
 */
function toastRegions() {
  return [
    el('div', { class: 'pv-x-toast', role: 'status', 'aria-live': 'polite', 'data-kind': 'status', 'data-visible': 'false' }),
    el('div', { class: 'pv-x-toast', role: 'alert', 'aria-live': 'assertive', 'data-kind': 'alert', 'data-visible': 'false' })
  ];
}

/** 轻提示：tone 为 ok / info / error；error 走 alert 区域并用危险色 */
export function notify(reader, message, tone = 'error') {
  if (!reader) return;
  const kind = tone === 'error' ? 'alert' : 'status';
  let toast = reader.querySelector(`.pv-x-toast[data-kind="${kind}"]`);
  if (!toast) {
    for (const region of toastRegions()) reader.appendChild(region);
    toast = reader.querySelector(`.pv-x-toast[data-kind="${kind}"]`);
  }
  // 同一时刻只显示一条
  for (const other of reader.querySelectorAll('.pv-x-toast')) {
    if (other !== toast) other.dataset.visible = 'false';
  }
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.dataset.visible = 'true';
  clearTimeout(toast.__pvTimer);
  toast.__pvTimer = setTimeout(() => {
    toast.dataset.visible = 'false';
  }, tone === 'error' ? 5000 : 3200);
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
  translationFor,
  bindProfile,
  composerAvatar,
  draftText = '',
  onDraftChange = null
}) {
  // reader 本身不滚动（评论卡、资料卡、提示、灯箱都相对它定位）；
  // columns 是两栏的网格，单栏时它就是唯一的滚动容器（帖子 → 工具行 → 回复框 → 回复）
  const reader = el('div', { class: 'pv-x-reader' });
  const columns = el('div', { class: 'pv-x-columns' });
  const postPane = el('section', { class: 'pv-x-pane pv-x-pane-post', 'aria-label': '帖子' });
  // 回复上下文：只展示被点开那条之前的对话链
  // （「查看 N 条回复」入口只给评论列表里的评论，主贴的回复就在右栏）
  for (const ancestor of ancestors) {
    postPane.appendChild(
      renderPost(ancestor, {
        threadLine: true,
        onAction,
        bindProfile,
        translation: translationFor?.(ancestor),
        compact: true
      })
    );
  }
  // 主贴下面没有同栏的下一条，不画竖线
  const focalNode = renderPost(focal, { threadLine: false, focal: true, onAction, bindProfile, translation: translationFor?.(focal) });
  postPane.appendChild(focalNode);

  const countLabel = el('span', { class: 'pv-x-reply-count', text: `回复 ${formatCount(replyCount)}` });
  const sort = onSort ? sortControl('relevant', onSort) : null;
  const tools = el(
    'div',
    { class: 'pv-x-reply-tools' },
    el('div', { class: 'pv-x-tools-left' }, countLabel, sort),
    el('a', { class: 'pv-x-open', href: openUrl, target: '_blank', rel: 'noreferrer', text: '在 X 打开' })
  );
  const replyPane = el('section', { class: 'pv-x-pane pv-x-pane-replies', 'aria-label': '回复' }, tools);
  const composerView = onSubmitReply
    ? composer({ avatar: composerAvatar, onSubmit: onSubmitReply, focalId: focal.id, draftText, onDraftChange })
    : null;
  if (composerView) replyPane.appendChild(composerView.node);
  const list = el('div', { class: 'pv-x-reply-list' });
  replyPane.appendChild(list);
  columns.append(postPane, replyPane);
  reader.append(columns, ...toastRegions());
  return { reader, columns, postPane, replyPane, tools, list, countLabel, composer: composerView, sort, focalNode };
}
