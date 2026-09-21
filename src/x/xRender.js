// X 版式渲染：把 xModel 的模型渲染成贴近 X 原生的帖子/评论结构。
// 双栏阅读器：左栏原帖（含回复上下文链）、右栏评论，各自独立滚动。
// 交互（点赞/转推/收藏/回复/复制链接/排序/翻译/图片放大）参照本地 peek 项目的行为。
// 图标来自 xIcons（克隆 X 实时 DOM），颜色字体来自 xTheme（读取 X 实时样式）。

import { el, svgIcon } from '../utils/dom.js';
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

/** 计数字段的统一读取：模型缺 counts 时归 0，而不是抛错（一次抛错会让整次渲染被当成加载失败） */
function countOf(model, key) {
  if (!key) return 0;
  return Number(model && model.counts && model.counts[key]) || 0;
}

/** 按钮的激活态与数字由这里统一刷新（乐观更新与回滚都复用它） */
export function paintAction(button, model, key) {
  if (!button) return;
  const flag = FLAG_BY_ACTION[key];
  if (flag) button.dataset.active = model.flags && model.flags[flag] ? 'true' : 'false';
  const countNode = button.querySelector('.pv-x-count');
  const countKey = COUNT_BY_ACTION[key];
  if (!countNode || !countKey) return;
  const value = countOf(model, countKey);
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
  const stage = el('div', { class: `pv-x-media-stage pv-x-media-stage-${variant}`, tabindex: '-1' });
  if (framePhoto.width && framePhoto.height) stage.style.aspectRatio = `${framePhoto.width} / ${framePhoto.height}`;

  // 图片轨道：所有图并排，靠 translateX 滑动
  const track = el('div', { class: 'pv-x-media-track' });
  const slides = photos.map((photo) => {
    const slide = el(
      'div',
      { class: 'pv-x-media-slide' },
      el('img', { class: 'pv-x-media-big', src: photo.url, alt: photo.altText || '', loading: 'lazy', draggable: 'false' })
    );
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
  const barChildren = [
    counter,
    el('a', { class: 'pv-x-media-open', href: openUrl, target: '_blank', rel: 'noreferrer', text: '在 X 打开' })
  ];
  // 栏内默认态没有「收起」目标（网格已经不在了），只有浮层需要关闭按钮
  if (variant === 'overlay') barChildren.push(closeButton);
  const bar = el('div', { class: 'pv-x-media-bar' }, ...barChildren);

  // 左右切换：箭头垂直居中贴在窗体两侧，窗体不动、只有轨道滑动（仅多图时出现）
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
  const paintButtons = () => {
    if (prevButton) prevButton.disabled = current <= 0;
    if (nextButton) nextButton.disabled = current >= photos.length - 1;
    counter.textContent = `${current + 1} / ${photos.length}`;
    slides.forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== current)));
  };

  /** 弹簧收敛到某张：临界阻尼（无过冲）；带速度释放时略欠阻尼（一点点回弹，因为手势本身有动量） */
  const settle = (targetIndex, v0 = 0) => {
    current = Math.max(0, Math.min(targetIndex, photos.length - 1));
    paintButtons();
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
  if (prevButton) prevButton.addEventListener('click', () => show(current - 1));
  if (nextButton) nextButton.addEventListener('click', () => show(current + 1));

  // 帧高必须相对**所在栏的可见高**，不能用视口单位（单栏时栏只有约 32vh）。
  // 而且这里直接把高度算成**像素**而不是靠百分比：帧一旦被 max-height 截断，
  // 轨道/幻灯片的 height:100% 解析就不再确定，图片会按原始尺寸渲染并被 overflow:hidden 裁掉
  // （表现就是「窗体越大图反而被裁得越多」）。
  // 灯箱（固定窗体）的尺寸分两种：
  //   inline —— 走**单图逻辑**：宽度铺满、高度 = 宽度 × 首图比例（inline aspect-ratio 直接给），
  //            不做任何封顶，所以竖图就是整幅大图、和单图一样大（需要时栏自己滚动）
  //   overlay —— 在浮层可用区域内按首图比例做 contain 适配，宽高都算成像素
  // 浮层必须算像素：帧一旦被间接约束截断，轨道/幻灯片的 height:100% 解析就不可靠，
  // 图片会按原始尺寸渲染并被 overflow:hidden 裁掉。
  const frameRatio = framePhoto.width && framePhoto.height ? framePhoto.height / framePhoto.width : 0;
  const wrapper = () => stage.parentElement; // 浮层：.pv-x-media-lightbox
  let resizeObserver = null;
  let observedBox = null;
  const syncFrame = () => {
    if (variant !== 'overlay') return; // 栏内按单图逻辑，不需要测量
    const box = wrapper();
    if (!box) return;
    // 容器是延迟出现的（layer 在轮播创建之后才 append），首次拿到后补观察
    if (resizeObserver && observedBox !== box) {
      if (observedBox) resizeObserver.unobserve(observedBox);
      resizeObserver.observe(box);
      observedBox = box;
    }
    const availableWidth = box.clientWidth - 24; // 浮层左右各 12px 内边距
    const availableHeight = box.clientHeight - 24;
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
  };

  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => {
      if (drag) return;
      syncFrame();
      // 窗体宽度变了，轨道的像素位移要按新宽度重算
      x = targetOf(current);
      render();
    });
    resizeObserver.observe(stage);
  }
  syncFrame();

  // 动量投影：按释放速度推算「将要停在哪」，再吸附到离它最近的一张（不是从释放点就近吸附）
  const project = (v, deceleration = 0.998) => (v / 1000) * deceleration / (1 - deceleration);
  // 边界橡皮筋：越界越难拖，而不是硬停
  const rubberband = (overshoot, dimension, constant = 0.55) =>
    (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));

  let drag = null; // { startX, base, samples: [[t, x]] }
  const onPointerDown = (event) => {
    if (photos.length < 2 || event.target.closest('button, a')) return;
    stopAnim(); // 抓住正在滑动的轨道：从当前屏幕值继续
    const now = performance.now();
    drag = { startX: event.clientX, base: x, samples: [[now, x]] };
    stage.classList.add('pv-x-media-dragging');
    try {
      stage.setPointerCapture(event.pointerId);
    } catch (err) {
      // 不支持指针捕获：仍可拖动，只是移出元素后不再跟随
    }
  };
  const onPointerMove = (event) => {
    if (!drag) return;
    const min = targetOf(photos.length - 1);
    const max = 0;
    // 1:1 跟手；越界部分用橡皮筋衰减（软边界，不是硬停）
    let next = drag.base + (event.clientX - drag.startX);
    if (next > max) next = max + rubberband(next - max, width());
    else if (next < min) next = min - rubberband(min - next, width());
    x = next;
    render();
    const now = performance.now();
    drag.samples.push([now, x]);
    while (drag.samples.length > 2 && now - drag.samples[0][0] > 90) drag.samples.shift();
  };
  const onPointerUp = () => {
    if (!drag) return;
    stage.classList.remove('pv-x-media-dragging');
    const samples = drag.samples;
    const last = samples[samples.length - 1];
    const first = samples[0];
    const dt = last[0] - first[0];
    // 释放速度（px/s）：交给收尾弹簧，让拖拽与动画之间没有缝
    const v0 = dt > 0 ? ((last[1] - first[1]) / dt) * 1000 : 0;
    const projected = x + project(v0);
    const targetIndex = Math.max(0, Math.min(Math.round(-projected / width()), photos.length - 1));
    drag = null;
    settle(targetIndex, v0);
  };
  const destroy = () => {
    stopAnim();
    resizeObserver?.disconnect();
    resizeObserver = null;
    stage.removeEventListener('keydown', onKey);
    stage.removeEventListener('pointerdown', onPointerDown);
    stage.removeEventListener('pointermove', onPointerMove);
    stage.removeEventListener('pointerup', onPointerUp);
    stage.removeEventListener('pointercancel', onPointerUp);
  };
  const close = () => {
    destroy();
    onClose?.();
  };
  function onKey(event) {
    if (event.key === 'Escape' && variant === 'overlay') {
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
    }
  }
  closeButton.addEventListener('click', close);
  stage.addEventListener('keydown', onKey);
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);
  // 栏内默认态：点图弹出覆盖式大图（不是替换图片）
  if (variant === 'inline' && onZoom) {
    stage.addEventListener('click', (event) => {
      if (event.target.closest('button, a')) return;
      onZoom(current);
    });
  }

  stage.append(track, bar);
  if (prevButton) stage.appendChild(prevButton);
  if (nextButton) stage.appendChild(nextButton);

  // 初始位置直接落位（不播动画），按钮可用态与序号一并刷新
  x = targetOf(current);
  render();
  paintButtons();
  return {
    node: stage,
    destroy,
    // 容器是在创建之后才 append 的，调用方挂载后需要立刻调一次
    syncFrame,
    get index() {
      return current;
    }
  };
}

/** 覆盖式大图灯箱：点主贴/评论里的图片时弹出，内部复用同一个轮播 */
function openMediaLightbox(anchor, photos, index, openUrl) {
  const root = (anchor && anchor.closest && anchor.closest('.pv-x-reader')) || (anchor && anchor.parentElement);
  if (!root || !photos.length || root.querySelector('.pv-x-media-lightbox')) return;
  const layer = el('div', {
    class: 'pv-x-media-lightbox',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': '图片查看'
  });
  let carousel = null;
  const close = () => {
    carousel?.destroy();
    layer.remove();
  };
  carousel = createMediaCarousel(photos, { openUrl, variant: 'overlay', startIndex: index, onClose: close });
  layer.appendChild(carousel.node);
  // 点背景关闭（点图片本身不关）
  layer.addEventListener('click', (event) => {
    if (event.target === layer) close();
  });
  root.appendChild(layer);
  carousel.syncFrame();
  // 聚焦窗体让 Esc/方向键可用；preventScroll 避免弹层出现时页面跳动
  try {
    carousel.node.focus({ preventScroll: true });
  } catch (err) {
    carousel.node.focus();
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
      onZoom: (index) => openMediaLightbox(grid, photos, index, openUrl)
    });
    grid.classList.add('pv-x-media-carousel');
    grid.appendChild(carousel.node);
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
        openMediaLightbox(grid, photos, photos.indexOf(item), openUrl);
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
  { threadLine = false, onAction = null, translation = null, bindProfile = null, compact = false } = {}
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
    displayText(model) || !isArticle ? textBlock(model, translation, bindProfile) : null,
    isArticle ? (compact ? articleCard(model) : articleReader(model)) : null,
    mediaGrid(model, { openUrl: openUrlOf(model) }),
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
  return { node: section, setTarget, focus: () => input.focus() };
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
        bindProfile,
        translation: translationFor?.(ancestor),
        compact: true
      })
    );
  }
  postPane.appendChild(
    renderPost(focal, { threadLine: true, onAction, bindProfile, translation: translationFor?.(focal) })
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
  return { reader, list, countLabel, composer: composerView, sort };
}
