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
export function collectTweetNodes(value, out = [], seen = new Set()) {
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
export function unwrapUser(value) {
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

const isMp4 = (variant) => /video\/mp4/i.test(String(variant.contentType || '')) || /\.mp4(?:\?|$)/i.test(String(variant.url || ''));
const isHls = (variant) => /mpegurl/i.test(String(variant.contentType || '')) || /\.m3u8(?:\?|$)/i.test(String(variant.url || ''));

/** 选一档 MP4：优先不超过目标码率的最高档，否则取最低档（避免直接拉最高码率） */
function selectMp4(variants, targetBitrate = 1200000) {
  const measured = variants.filter((variant) => Number(variant.bitrate) > 0).sort((a, b) => a.bitrate - b.bitrate);
  const within = measured.filter((variant) => variant.bitrate <= targetBitrate);
  return (within.length ? within[within.length - 1] : measured[0]) || variants[0] || null;
}

/** 提取媒体（图片 / 视频 / GIF），图片与视频海报都保留，供渲染层使用 */
function mediaItems(tweet, legacy) {
  const modern = Array.isArray(tweet.media) ? tweet.media : (tweet.media && (tweet.media.all || tweet.media.media)) || [];
  const list =
    (legacy.extended_entities && legacy.extended_entities.media) ||
    (legacy.entities && legacy.entities.media) ||
    modern ||
    [];
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
    if (current.title || current.preview_text || current.cover_media || current.cover_image) return current;
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
  const cover = findNamedValue(article, ['cover_media', 'cover_image', 'preview_image'], 3) || article;
  return {
    type: 'article',
    url: articleUrlFromEntities(legacy),
    sourceUrl: articleUrlFromEntities(legacy),
    domain: 'x.com',
    title: String(article.title || ''),
    description: String(article.preview_text || article.description || article.summary || ''),
    image: String(
      findNamedValue(cover, ['original_img_url', 'media_url_https', 'image_url', 'url'], 5) || ''
    ),
    imageWidth: Number(findNamedValue(cover, ['original_img_width', 'width'], 5)) || 0,
    imageHeight: Number(findNamedValue(cover, ['original_img_height', 'height'], 5)) || 0,
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

/** 数值兜底：非有限数一律归 0 */
function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** C1 用的轻量字段抽取（C2 会被完整 tweetModel 取代） */
function liteModel(node) {
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
  return {
    id: String(tweet.rest_id || legacy.id_str || ''),
    inReplyToId: String(legacy.in_reply_to_status_id_str || ''),
    conversationId: String(legacy.conversation_id_str || ''),
    text: (noteText && typeof noteText.text === 'string' ? noteText.text : '') || String(legacy.full_text || legacy.text || ''),
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
    isNoteTweet: Boolean(noteText && typeof noteText.text === 'string' && noteText.text)
  };
}

/** 找到 cursorType 为 Bottom 的游标（回退 ShowMoreThreads/ShowMoreThread） */
export function bottomCursor(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  let fallback = null;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return null;
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
  const models = nodes.map(liteModel).filter((model) => model && model.id);
  const byId = new Map(models.map((model) => [model.id, model]));
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
