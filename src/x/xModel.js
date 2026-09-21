// X（x.com）GraphQL 响应数据层。
//
// C1 阶段只实现「数据层自检」所需的最小子集：解包 + 收集 + 原帖/评论归属判定。
// C2 会在此文件补齐完整模型（媒体变体、引用帖、长文 article、实体区间、DOM 兜底合并），
// 逻辑同样移植自本地 peek 项目（MIT，Copyright (c) 2026 xuntianx）的 extension/core.js。

const MAX_UNWRAP_HOPS = 6;
// /{handle}/status/{id}，兼容 /i/web/status/{id} 这类内部路径
const STATUS_PATTERN = /^\/(?:i\/web\/)?([^/?#]+)\/status\/(\d+)/i;

/** 分页是否继续：没有新增、游标为空、游标重复，三者任一即停止（与 peek 一致） */
export function replyCursorAfterPage(previousCursor, nextCursor, addedCount) {
  const next = String(nextCursor || '');
  return Number(addedCount) > 0 && next && next !== String(previousCursor || '') ? next : null;
}

/**
 * 是否值得翻译：去掉链接与 @提及后按字符集判断（沿用 peek 的规则）。
 * 中文帖、纯链接、纯表情都不必请求翻译。
 */
export function shouldOfferTranslation(text) {
  const plain = String(text || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@[A-Za-z0-9_]+/g, ' ')
    .trim();
  if (!plain) return false;
  const han = (plain.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (plain.match(/[A-Za-z\u00c0-\u024f]/g) || []).length;
  const japaneseKorean = (plain.match(/[\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const cyrillic = (plain.match(/[\u0400-\u04ff]/g) || []).length;
  if (japaneseKorean >= 2 || cyrillic >= 4) return true;
  return latin >= 6 && han < Math.max(4, latin * 0.35);
}

/** 源语言的中文标签（X 会返回本地化名称，缺失时按语言码兜底） */
export function sourceLanguageLabel(entry) {
  if (entry && entry.localizedSourceLanguage) return entry.localizedSourceLanguage;
  const language = String((entry && entry.sourceLanguage) || '').toLowerCase();
  const names = { en: '英语', ja: '日语', ko: '韩语', es: '西班牙语', fr: '法语', de: '德语', ru: '俄语' };
  return names[language] || '外语';
}

/** 从 X 帖子链接里取出帖子 ID */
export function postIdFromUrl(href, base = 'https://x.com/') {
  if (!href || typeof href !== 'string') return null;
  try {
    const url = new URL(href, base);
    const match = url.pathname.match(STATUS_PATTERN);
    return match ? match[2] : null;
  } catch (err) {
    return null;
  }
}

/**
 * 从任意包装层级里取出真正的 tweet 节点（同时具备 legacy 与 rest_id 才算完整）。
 * 与 peek 一致：先判完整节点，再依次走 .tweet / .result，最多 6 跳。
 */
export function unwrapResult(value) {
  let current = value && typeof value === 'object' ? value : null;
  for (let index = 0; current && index < MAX_UNWRAP_HOPS; index += 1) {
    if (current.legacy && current.rest_id) return current;
    if (current.tweet && typeof current.tweet === 'object') {
      current = current.tweet;
      continue;
    }
    if (current.result && typeof current.result === 'object') {
      current = current.result;
      continue;
    }
    break;
  }
  return current && current.legacy && current.rest_id ? current : null;
}

/**
 * 深度收集 payload 里所有 tweet 结果节点。
 * 命中即返回、不再下钻（引用帖只存在于 quoted_status_result 内，不会混进平铺列表）。
 */
function collectTweetNodes(value, out = [], seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return out;
  seen.add(value);
  const result = (value.tweet_results && value.tweet_results.result) || (value.tweetResult && value.tweetResult.result) || null;
  if (result) {
    out.push(result);
    return out;
  }
  for (const key of Object.keys(value)) {
    let child;
    try {
      child = value[key];
    } catch (err) {
      continue;
    }
    collectTweetNodes(child, out, seen);
  }
  return out;
}

/**
 * 取出用户节点。不能复用 unwrapResult：X 的用户节点已迁移到 core/avatar 结构，
 * 很多不带 legacy，而 unwrapResult 要求 legacy + rest_id 同时存在（否则整条作者信息全空）。
 */
function unwrapUser(value) {
  let current = value && typeof value === 'object' ? value : null;
  for (let index = 0; current && index < 4; index += 1) {
    const legacy = current.legacy;
    const core = current.core;
    if (
      (legacy && legacy.screen_name) ||
      (core && core.screen_name) ||
      (current.avatar && current.avatar.image_url) ||
      current.__typename === 'User'
    ) {
      return current;
    }
    if (current.result && typeof current.result === 'object') {
      current = current.result;
      continue;
    }
    break;
  }
  return current && (current.legacy || current.core) ? current : null;
}

const VARIANT_KEYS = ['video_info', 'videoInfo', 'media_info', 'video_config'];

function variantsOf(item) {
  const groups = [];
  for (const key of VARIANT_KEYS) {
    const holder = item[key];
    if (!holder) continue;
    if (Array.isArray(holder.variants)) groups.push(holder.variants);
    if (holder.video_info && Array.isArray(holder.video_info.variants)) groups.push(holder.video_info.variants);
  }
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    for (const variant of group) {
      const url = variant && variant.url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(variant);
    }
  }
  return out;
}

// X 的变体用 content_type（下划线）；驼峰写法一并兼容，否则只剩 URL 后缀这一条判据，
// 无扩展名的变体（如 https://video.twimg.com/xxx）会直接丢掉播放地址
const variantType = (variant) => String(variant.content_type || variant.contentType || '');
const isMp4 = (variant) => /video\/mp4/i.test(variantType(variant)) || /\.mp4(?:\?|$)/i.test(String(variant.url || ''));
const isHls = (variant) => /mpegurl/i.test(variantType(variant)) || /\.m3u8(?:\?|$)/i.test(String(variant.url || ''));

/** 选一档 MP4：优先不超过目标码率的最高档，否则取最低档（避免直接拉最高码率） */
function selectMp4(variants, targetBitrate = 1200000) {
  const measured = variants.filter((variant) => Number(variant.bitrate) > 0).sort((a, b) => a.bitrate - b.bitrate);
  const within = measured.filter((variant) => variant.bitrate <= targetBitrate);
  return (within.length ? within[within.length - 1] : measured[0]) || variants[0] || null;
}

/** 提取媒体（图片 / 视频 / GIF），图片与视频海报都保留，供渲染层使用 */
function mediaItems(tweet, legacy) {
  const modern = Array.isArray(tweet.media) ? tweet.media : (tweet.media && (tweet.media.all || tweet.media.media)) || [];
  const list = mediaListOf(legacy, modern);
  const items = [];
  for (const raw of list) {
    const variants = variantsOf(raw);
    const mp4s = variants.filter(isMp4);
    const hls = variants.find(isHls) || null;
    const rawType = String(raw.type || raw.media_type || raw.__typename || '').toLowerCase();
    const hasVideo = mp4s.length > 0 || Boolean(raw.video_info || raw.videoInfo || raw.video_config);
    const type = rawType.includes('animated') || rawType === 'gif' ? 'animated_gif' : rawType.includes('video') || hasVideo ? 'video' : 'photo';
    const chosen = type === 'photo' ? null : selectMp4(mp4s);
    const poster = String(raw.media_url_https || raw.media_url || '');
    const item = {
      type,
      url: poster,
      videoUrl: chosen ? String(chosen.url) : '',
      hlsUrl: hls ? String(hls.url) : '',
      width: Number((raw.original_info && raw.original_info.width) || (raw.sizes && raw.sizes.large && raw.sizes.large.w)) || 0,
      height: Number((raw.original_info && raw.original_info.height) || (raw.sizes && raw.sizes.large && raw.sizes.large.h)) || 0,
      altText: String(raw.ext_alt_text || '')
    };
    if (item.url || item.videoUrl || item.hlsUrl) items.push(item);
  }
  return items;
}

/** 深度搜索指定字段名（article 的结构随 X 版本漂移，靠这个兜底） */
function findNamedValue(root, names, maxDepth = 5, seen = new Set()) {
  if (!root || typeof root !== 'object' || maxDepth < 0 || seen.has(root)) return null;
  seen.add(root);
  for (const name of names) {
    const value = root[name];
    if (value !== undefined && value !== null) return value;
  }
  for (const key of Object.keys(root)) {
    let child;
    try {
      child = root[key];
    } catch (err) {
      continue;
    }
    const found = findNamedValue(child, names, maxDepth - 1, seen);
    if (found !== null) return found;
  }
  return null;
}

/** 取出长文（Article）主体：X 有过四种包装形态 */
function articleResult(tweet) {
  let current =
    (tweet.article && tweet.article.article_results && tweet.article.article_results.result) ||
    (tweet.article && tweet.article.result) ||
    (tweet.article_results && tweet.article_results.result) ||
    tweet.article ||
    null;
  for (let index = 0; current && index < 5; index += 1) {
    // 判定「这就是长文主体」：标题/摘要/封面之外，只有正文块（content_state / plain_text）也算，
    // 否则「有正文但没有标题封面」的长文会被整个丢掉
    if (
      current.title ||
      current.preview_text ||
      current.cover_media ||
      current.cover_image ||
      current.content_state ||
      current.contentState ||
      current.plain_text ||
      current.plainText
    ) {
      return current;
    }
    if (current.result) current = current.result;
    else if (current.article) current = current.article;
    else break;
  }
  return null;
}

/** 长文正文：content_state 块优先，退化为 plain_text 按空行分段 */
function articleContent(article) {
  const state =
    (article && (article.content_state || article.contentState)) || findNamedValue(article, ['content_state', 'contentState'], 5) || null;
  const rawBlocks = (state && state.blocks) || [];
  const entityMap = (state && (state.entityMap || state.entity_map || state.entities)) || {};
  const blocks = [];
  for (const block of rawBlocks) {
    if (!block) continue;
    blocks.push({
      key: String(block.key || ''),
      type: String(block.type || 'unstyled'),
      text: String(block.text || ''),
      depth: Number(block.depth) || 0,
      inlineStyles: Array.isArray(block.inlineStyleRanges)
        ? block.inlineStyleRanges.map((range) => ({
            offset: Number(range.offset) || 0,
            length: Number(range.length) || 0,
            style: String(range.style || '')
          }))
        : [],
      entityRanges: Array.isArray(block.entityRanges)
        ? block.entityRanges.map((range) => ({
            offset: Number(range.offset) || 0,
            length: Number(range.length) || 0,
            key: String(range.key)
          }))
        : []
    });
  }
  if (!blocks.length) {
    const plain = String((article && (article.plain_text || article.plainText)) || '');
    plain
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((text, index) => {
        blocks.push({ key: `plain-${index}`, type: 'unstyled', text, depth: 0, inlineStyles: [], entityRanges: [] });
      });
  }
  const entities = {};
  for (const [key, value] of Object.entries(entityMap)) {
    const data = (value && value.data) || {};
    entities[key] = {
      type: String((value && value.type) || ''),
      url: String(data.url || data.href || data.src || ''),
      image: String(data.src || data.image || data.url || ''),
      width: Number(data.width) || 0,
      height: Number(data.height) || 0,
      alt: String(data.alt || data.caption || '')
    };
  }
  return { blocks, entities };
}

/** 长文链接：推文实体里指向 /i/article/ 的那条 */
function articleUrlFromEntities(legacy) {
  const urls = (legacy.entities && legacy.entities.urls) || [];
  for (const entry of urls) {
    const expanded = String((entry && (entry.expanded_url || entry.url)) || '');
    if (/(?:x|twitter)\.com\/i\/article\//i.test(expanded)) return expanded;
  }
  return '';
}

/** 组装长文附件（无长文时返回 null） */
function articleAttachment(tweet, legacy) {
  const article = articleResult(tweet);
  if (!article) return null;
  // 封面只在真正的封面节点里找：回退到「整个 article」会把正文内联图、甚至链接 URL 当成封面，
  // 还会带上无关的宽高。找不到封面节点就不给封面。
  const cover = findNamedValue(article, ['cover_media', 'cover_image', 'preview_image'], 3);
  const articleUrl = articleUrlFromEntities(legacy);
  return {
    type: 'article',
    url: articleUrl,
    title: String(article.title || ''),
    description: String(article.preview_text || article.description || article.summary || ''),
    image: cover ? String(findNamedValue(cover, ['original_img_url', 'media_url_https', 'image_url'], 5) || '') : '',
    imageWidth: cover ? Number(findNamedValue(cover, ['original_img_width', 'width'], 5)) || 0 : 0,
    imageHeight: cover ? Number(findNamedValue(cover, ['original_img_height', 'height'], 5)) || 0 : 0,
    content: articleContent(article)
  };
}

/**
 * 从长文响应里补出正文（TweetDetail 有时只给封面与摘要，正文要另取一次）。
 * 返回新的 content（blocks/entities），取不到返回 null。
 */
export function articleContentFromPayload(json) {
  const nodes = collectTweetNodes((json && json.data) || json);
  for (const node of nodes) {
    const tweet = unwrapResult(node);
    const article = tweet ? articleResult(tweet) : null;
    if (!article) continue;
    const content = articleContent(article);
    if (content.blocks.length) return content;
  }
  // 兜底：整个 payload 里深挖 content_state / plain_text
  const state = findNamedValue((json && json.data) || json, ['content_state', 'contentState'], 12);
  if (state && Array.isArray(state.blocks) && state.blocks.length) return articleContent({ content_state: state });
  return null;
}

/**
 * 从补全响应里取出指定帖子的全文（含实体）。
 * 用于「显示更多」：TweetDetail 给的是截断版，TweetResultByRestId 通常带 note_tweet 全文。
 * 取不到全文返回 null（调用方据此降级）。
 */
export function fullTextFromPayload(json, tweetId) {
  const nodes = collectTweetNodes((json && json.data) || json);
  const target = String(tweetId || '');
  for (const node of nodes) {
    const model = liteModel(node);
    if (model && model.id === target && model.hasFullText) {
      return { text: model.text, entities: model.entities };
    }
  }
  return null;
}

/** 数值兜底：非有限数一律归 0 */
function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * X 的 entities.indices 以「码点」计数，而 JS 字符串是 UTF-16。
 * 含 emoji（代理对）的帖子若直接拿 indices 切片，偏移会整体错位——必须先建映射表。
 */
function codePointMap(text) {
  const map = [];
  let codePoint = 0;
  for (let index = 0; index < text.length; ) {
    map[codePoint] = index;
    const code = text.codePointAt(index);
    index += code > 0xffff ? 2 : 1;
    codePoint += 1;
  }
  map[codePoint] = text.length;
  return map;
}

/**
 * 取媒体列表：在多个候选位置里选**第一个非空**的。
 * 坑：`extended_entities.media` 可能是空数组，用 `||` 串联会因为空数组是真值而短路，
 * 从而漏掉 `entities.media` 里的媒体。
 */
function mediaListOf(legacy, modern) {
  const candidates = [
    legacy && legacy.extended_entities && legacy.extended_entities.media,
    legacy && legacy.entities && legacy.entities.media,
    modern
  ];
  return candidates.find((value) => Array.isArray(value) && value.length > 0) || [];
}

/** 取首个媒体实体的 indices（用于把媒体帖末尾那条 t.co 链接排除在可见文本之外） */
function firstMediaIndices(legacy) {
  const media = mediaListOf(legacy, null);
  const first = media[0];
  return first && Array.isArray(first.indices) ? first.indices : null;
}

/**
 * 把 legacy.entities / note_tweet.entity_set 转成可渲染的区间。
 * 覆盖 @提及、#话题、$代码、普通链接；@提及额外带上作者信息（供悬停资料卡使用）。
 *
 * 关键：区间在**全文**坐标系上计算，再裁到可见窗口内并平移到窗口坐标系。
 * 否则当 display_text_range 起点不为 0（回复帖会跳过开头的 @提及）时，
 * 所有实体索引都会错位，把无关字符渲染成提及链接。
 */
function entityRanges(entitySet, text, window_ = { start: 0, end: text.length }) {
  const ranges = [];
  if (!entitySet) return ranges;
  const map = codePointMap(text);
  const at = (index) => (map[index] === undefined ? text.length : map[index]);
  const add = (entry, kind, url, label) => {
    const indices = entry && entry.indices;
    if (!Array.isArray(indices) || indices.length < 2) return null;
    const start = at(Number(indices[0]) || 0);
    const end = at(Number(indices[1]) || 0);
    if (end <= start) return null;
    // 只保留完全落在可见窗口内的实体（被窗口裁掉的，例如 display_text_range 跳过的开头提及）
    if (start < window_.start || end > window_.end) return null;
    const range = { start: start - window_.start, end: end - window_.start, kind, url: url || '', label: label || '', author: null };
    ranges.push(range);
    return range;
  };
  for (const entry of entitySet.urls || []) {
    const expanded = String((entry && (entry.expanded_url || entry.url)) || '');
    add(entry, 'url', expanded, String((entry && entry.display_url) || expanded));
  }
  for (const entry of entitySet.user_mentions || []) {
    const handle = String((entry && entry.screen_name) || '');
    if (!handle) continue;
    const range = add(entry, 'mention', `https://x.com/${handle}`, `@${handle}`);
    if (range) {
      range.author = {
        id: String((entry && (entry.id_str || entry.id)) || ''),
        name: String((entry && entry.name) || handle),
        handle,
        avatar: '',
        verified: false
      };
    }
  }
  for (const entry of entitySet.hashtags || []) {
    const tag = String((entry && entry.text) || '');
    if (!tag) continue;
    add(entry, 'hashtag', `https://x.com/hashtag/${encodeURIComponent(tag)}`, `#${tag}`);
  }
  for (const entry of entitySet.symbols || []) {
    const symbol = String((entry && entry.text) || '');
    if (!symbol) continue;
    add(entry, 'symbol', `https://x.com/search?q=${encodeURIComponent(`$${symbol}`)}`, `$${symbol}`);
  }
  return ranges.sort((a, b) => a.start - b.start || b.end - a.end);
}

/**
 * 可见正文窗口（UTF-16 偏移区间）。
 * 优先用 display_text_range（媒体帖末尾的 t.co、回复帖开头的 @提及 都在范围之外），
 * 没有该字段时按首个媒体实体的起点截断。
 */
function visibleWindow(legacy, fullText) {
  const map = codePointMap(fullText);
  const range = Array.isArray(legacy.display_text_range) ? legacy.display_text_range : null;
  if (range && range.length === 2) {
    const start = map[Number(range[0])] || 0;
    const rawEnd = map[Number(range[1])];
    return { start, end: rawEnd === undefined ? fullText.length : rawEnd };
  }
  const mediaIndices = firstMediaIndices(legacy);
  if (mediaIndices) {
    const cut = map[Number(mediaIndices[0])];
    if (cut !== undefined) return { start: 0, end: cut };
  }
  return { start: 0, end: fullText.length };
}

/** C1 用的轻量字段抽取（C2 会被完整 tweetModel 取代） */
/**
 * 引用帖：X 把它放在 quoted_status_result.result 里（也可能包一层 TweetWithVisibilityResults）。
 * 只解一层——引用帖自己再引用别人时，X 界面同样只显示一层，避免递归展开。
 */
function quotedModel(tweet) {
  const holder = tweet.quoted_status_result || tweet.quoted_tweet_results || tweet.quoted_tweet;
  if (!holder || typeof holder !== 'object') return null;
  const node = holder.result || holder.tweet || holder;
  const quoted = unwrapResult(node);
  return quoted ? liteModel(quoted, false) : null;
}

function liteModel(node, withQuote = true) {
  const tweet = unwrapResult(node);
  if (!tweet) return null;
  const legacy = tweet.legacy || {};
  const user = unwrapUser(tweet.core && tweet.core.user_results) || unwrapUser(tweet.user_results);
  const userLegacy = (user && user.legacy) || {};
  const userCore = (user && user.core) || {};
  const perspectives = (user && user.relationship_perspectives) || {};
  const counts = (user && user.relationship_counts) || {};
  const bio = (user && user.profile_bio) || {};
  const noteText = tweet.note_tweet && tweet.note_tweet.note_tweet_results && tweet.note_tweet.note_tweet_results.result;
  const media = mediaItems(tweet, legacy);
  // 长贴（note tweet）的实体在 entity_set 里，普通帖在 legacy.entities。
  // 两者必须与各自对应的正文配对，否则索引会错位。
  const noteFullText = noteText && typeof noteText.text === 'string' ? noteText.text : '';
  const usingNoteText = Boolean(noteFullText);
  const entitySet = (usingNoteText && noteText.entity_set) || legacy.entities || null;
  const fullText = noteFullText || String(legacy.full_text || legacy.text || '');
  /**
   * 显示窗口必须与正文来源配对：
   * `legacy.display_text_range` 是**截断版 legacy 文本**的坐标，而 note 文本本身就是全文。
   * 若把它套到 note 全文上，会把全文按 legacy 的范围（约 280 字）再截一刀——
   * 表现为长贴「没显示全」，且因为已拿到全文而不出「显示更多」按钮。
   */
  const window_ = usingNoteText ? { start: 0, end: fullText.length } : visibleWindow(legacy, fullText);
  const text = fullText.slice(window_.start, window_.end).replace(/[ \t]+$/, '');
  // 正文是否被 X 截断：note_tweet 已带全文时无需处理，否则需要「显示更多」去补全
  const truncated = Boolean(legacy.truncated) || (!usingNoteText && /…$/.test(fullText.trim()));
  return {
    id: String(tweet.rest_id || legacy.id_str || ''),
    inReplyToId: String(legacy.in_reply_to_status_id_str || ''),
    conversationId: String(legacy.conversation_id_str || ''),
    text,
    // @提及 / #话题 / $代码 / 链接的可渲染区间（含码点→UTF-16 偏移换算与显示窗口裁剪）
    entities: entityRanges(entitySet, fullText, window_),
    // 是否已拿到全文；needsExpand 表示需要「显示更多」补全（供渲染层出按钮）
    hasFullText: usingNoteText,
    needsExpand: truncated && !usingNoteText,
    createdAt: String(legacy.created_at || ''),
    author: {
      id: String((user && user.rest_id) || userLegacy.id_str || ''),
      name: String(userLegacy.name || userCore.name || ''),
      handle: String(userLegacy.screen_name || userCore.screen_name || ''),
      // 头像：legacy 用 _normal 小图，换成 _200x200 才够清晰；新结构在 avatar.image_url
      avatar: String(
        userLegacy.profile_image_url_https || (user && user.avatar && user.avatar.image_url) || ''
      ).replace('_normal.', '_200x200.'),
      verified: Boolean(user && (user.is_blue_verified || userLegacy.verified)),
      // 资料卡所需字段
      description: String(userLegacy.description || userCore.description || bio.description || ''),
      followers: numberValue(userLegacy.followers_count !== undefined ? userLegacy.followers_count : counts.followers_count !== undefined ? counts.followers_count : counts.followers),
      followingCount: numberValue(userLegacy.friends_count !== undefined ? userLegacy.friends_count : counts.following_count !== undefined ? counts.following_count : counts.following),
      viewerFollowing: Boolean(userLegacy.following || perspectives.following),
      followRequestSent: Boolean(userLegacy.follow_request_sent || perspectives.follow_request_sent),
      followsViewer: Boolean(userLegacy.followed_by || perspectives.followed_by)
    },
    counts: {
      replies: Number(legacy.reply_count) || 0,
      likes: Number(legacy.favorite_count) || 0,
      reposts: Number(legacy.retweet_count) || 0,
      bookmarks: Number(legacy.bookmark_count) || 0,
      views: Number(tweet.views && tweet.views.count) || 0
    },
    // 当前登录用户与这条帖子的互动状态，用于按钮的激活色与乐观更新
    flags: {
      liked: Boolean(legacy.favorited),
      reposted: Boolean(legacy.retweeted || (legacy.current_user_retweet && legacy.current_user_retweet.id_str)),
      bookmarked: Boolean(legacy.bookmarked)
    },
    media,
    mediaCount: media.length,
    attachment: articleAttachment(tweet, legacy),
    // 被引用的帖子（一层）；没有引用时为 null
    quote: withQuote ? quotedModel(tweet) : null
  };
}

/** 找到 cursorType 为 Bottom 的游标（回退 ShowMoreThreads/ShowMoreThread） */
export function bottomCursor(value) {
  if (!value || typeof value !== 'object') return null;
  const seen = new Set();
  let fallback = null;
  const walk = (node) => {
    // seen 真正生效：避免畸形/自引用 payload 造成无限递归
    if (!node || typeof node !== 'object' || seen.has(node)) return null;
    seen.add(node);
    const type = String(node.cursorType || '');
    if (/^Bottom$/i.test(type) && typeof node.value === 'string') return node.value;
    if (/^(?:ShowMoreThreads|ShowMoreThread)$/i.test(type) && typeof node.value === 'string' && !fallback) fallback = node.value;
    for (const key of Object.keys(node)) {
      let child;
      try {
        child = node[key];
      } catch (err) {
        continue;
      }
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  return walk(value) || fallback;
}

/**
 * C1 数据层自检：解出原帖、判定评论归属、给出游标。
 * fail-closed：找不到原帖时 focal 为 null（X 会往响应里注入推荐模块，不能当成评论）。
 */
export function parseThreadSummary(json, focalTweetId) {
  const nodes = collectTweetNodes((json && json.data) || json);
  // 按 id 去重：X 会在「推荐/发现更多」等模块里重复同一条帖子，
  // 不去重会让评论数与节点数虚高
  const byId = new Map();
  for (const node of nodes) {
    const model = liteModel(node);
    if (model && model.id) byId.set(model.id, model);
  }
  const models = [...byId.values()];
  const focalId = String(focalTweetId || '');
  const focal = byId.get(focalId) || null;
  const cursor = bottomCursor((json && json.data) || json);

  const descendsFromFocal = (model) => {
    if (!model || model.id === focalId) return false;
    if (model.inReplyToId === focalId) return true;
    const visited = new Set([model.id]);
    let parentId = model.inReplyToId;
    while (parentId && !visited.has(parentId)) {
      if (parentId === focalId) return true;
      visited.add(parentId);
      const parent = byId.get(parentId);
      parentId = parent ? parent.inReplyToId : '';
    }
    return false;
  };

  // 嵌套线程拍平成 depth（0 = 直接回复），用于 X 那样的缩进渲染
  const replyDepth = (model) => {
    let depth = 0;
    const visited = new Set([model.id]);
    let parentId = model.inReplyToId;
    while (parentId && parentId !== focalId && byId.has(parentId) && !visited.has(parentId)) {
      depth += 1;
      visited.add(parentId);
      parentId = byId.get(parentId).inReplyToId;
    }
    return Math.min(depth, 3);
  };

  const replies = models.filter(descendsFromFocal).map((model) => ({ ...model, depth: replyDepth(model) }));

  // 回复上下文：从通知等入口点开一条回复时，把它的上级对话链带出来
  const ancestors = [];
  if (focal) {
    const visited = new Set([focal.id]);
    let parentId = focal.inReplyToId;
    while (parentId && byId.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      ancestors.unshift(parent);
      parentId = parent.inReplyToId;
    }
    const root = byId.get(focal.conversationId);
    if (root && root.id !== focal.id && !ancestors.some((model) => model.id === root.id)) ancestors.unshift(root);
  }
  const mediaTotal = models.reduce((sum, model) => sum + model.mediaCount, 0);
  return {
    focalFound: Boolean(focal),
    focal,
    ancestors,
    replies,
    replyCount: replies.length,
    nodeCount: models.length,
    mediaTotal,
    cursor
  };
}
