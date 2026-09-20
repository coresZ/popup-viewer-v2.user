// X（x.com）GraphQL 网络层 —— 运行在页面上下文，用当前登录会话读取帖子与评论。
//
// 机制移植自本地 peek 项目（MIT，Copyright (c) 2026 xuntianx，
// https://github.com/DoraRabbitYan/peek ，版本 0.8.10）的 extension/page-bridge.js：
//   - document 生命周期内补丁 fetch / XMLHttpRequest，捕获 X 自己请求里的鉴权头与 TweetDetail 模板
//   - 从页面 webpack runtime 动态发现 GraphQL operation（queryId / featureSwitches / fieldToggles），不硬编码
//   - 端点 /i/api/graphql/{queryId}/{operationName}，读操作 GET、写操作 POST
// 用户脚本无需 peek 的 MAIN world + postMessage 桥（那是扩展隔离世界的产物），故此处为直接调用。
//
// 安全约束：鉴权头只留在内存，不写存储、不打日志（captureState 也只回掩码后的状态）。

import { logger } from '../utils/logger.js';

const GRAPHQL_PATH = /\/graphql\/([^/]+)\/([^/?#]+)/;
// 翻译走 REST（不是 GraphQL），路径形态很怪，故优先复用捕获到的模板
const TRANSLATION_PATH = /\/translation\/service\/translateTweet(?:\.json)?(?:[?#]|$)/;
// 只记这几个鉴权头，避免把整站请求头都存下来
const AUTH_HEADER_NAMES = new Set([
  'authorization',
  'x-twitter-auth-type',
  'x-twitter-active-user',
  'x-twitter-client-language',
  'x-client-uuid'
]);

const captured = {
  auth: Object.create(null),
  templates: new Map(),
  translationTemplate: null,
  bearerSource: null
};
let webpackRuntime = null;
let transactionIdFn;
const operationCache = new Map();

/** 用户脚本沙箱下的真实页面 window（TM 需 @grant unsafeWindow） */
export function pageWindow() {
  try {
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
  } catch (err) {
    logger.debug('[xBridge] unsafeWindow unavailable', err);
  }
  return window;
}

// ---------- 请求捕获 ----------

function normalizeHeaders(headers) {
  const out = {};
  if (!headers) return out;
  try {
    if (typeof headers.forEach === 'function' && typeof headers.get === 'function') {
      headers.forEach((value, key) => {
        out[String(key).toLowerCase()] = value;
      });
      return out;
    }
  } catch (err) {
    logger.debug('[xBridge] Headers normalize failed', err);
  }
  if (Array.isArray(headers)) {
    for (const pair of headers) {
      if (Array.isArray(pair) && pair.length >= 2) out[String(pair[0]).toLowerCase()] = pair[1];
    }
    return out;
  }
  if (typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) out[String(key).toLowerCase()] = value;
  }
  return out;
}

function rememberRequest(win, url, method, headers, body) {
  if (!url) return;
  const absolute = String(url);
  const normalized = normalizeHeaders(headers);
  for (const name of AUTH_HEADER_NAMES) {
    const value = normalized[name];
    if (value && !captured.auth[name]) captured.auth[name] = value;
  }
  const match = absolute.match(GRAPHQL_PATH);
  if (match) {
    captured.templates.set(match[2], {
      url: absolute,
      method: String(method || 'GET').toUpperCase(),
      headers: normalized,
      body: typeof body === 'string' ? body : null
    });
  }
  if (TRANSLATION_PATH.test(absolute)) {
    captured.translationTemplate = { url: absolute, headers: normalized };
  }
}

function patchFetch(win) {
  const original = win.fetch;
  if (typeof original !== 'function' || original.__pv2Patched) return;
  const patched = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input && input.url;
      const method = (init && init.method) || (input && input.method) || 'GET';
      const headers = (init && init.headers) || (input && input.headers);
      rememberRequest(win, url, method, headers, init && init.body);
    } catch (err) {
      logger.debug('[xBridge] fetch capture failed', err);
    }
    return Reflect.apply(original, this, [input, init]);
  };
  patched.__pv2Patched = true;
  try {
    win.fetch = patched;
  } catch (err) {
    logger.warn('[xBridge] fetch patch rejected', err);
  }
}

function patchXhr(win) {
  const XHR = win.XMLHttpRequest;
  if (!XHR || !XHR.prototype || XHR.prototype.__pv2Patched) return;
  const proto = XHR.prototype;
  const originalOpen = proto.open;
  const originalSetHeader = proto.setRequestHeader;
  const originalSend = proto.send;
  proto.open = function (method, url, ...rest) {
    try {
      this.__pv2Request = { method, url, headers: {} };
    } catch (err) {
      logger.debug('[xBridge] xhr open capture failed', err);
    }
    return Reflect.apply(originalOpen, this, [method, url, ...rest]);
  };
  proto.setRequestHeader = function (name, value) {
    try {
      if (this.__pv2Request) this.__pv2Request.headers[String(name).toLowerCase()] = value;
    } catch (err) {
      logger.debug('[xBridge] xhr header capture failed', err);
    }
    return Reflect.apply(originalSetHeader, this, [name, value]);
  };
  proto.send = function (body) {
    try {
      const req = this.__pv2Request;
      if (req) rememberRequest(win, req.url, req.method, req.headers, body);
    } catch (err) {
      logger.debug('[xBridge] xhr send capture failed', err);
    }
    // 观察失败绝不能影响 X 自己的请求
    return Reflect.apply(originalSend, this, [body === void 0 ? null : body]);
  };
  proto.__pv2Patched = true;
}

// ---------- webpack runtime 内省 ----------

function getWebpackRuntime(win) {
  if (webpackRuntime) return webpackRuntime;
  let chunkName = null;
  try {
    chunkName = Object.keys(win).find((name) => name.startsWith('webpackChunk') && Array.isArray(win[name]));
  } catch (err) {
    logger.debug('[xBridge] webpack scan failed', err);
  }
  const chunk = chunkName ? win[chunkName] : null;
  if (!chunk) return null;
  let runtime = null;
  try {
    chunk.push([[`pv2-${Date.now()}`], {}, (candidate) => {
      runtime = candidate;
    }]);
  } catch (err) {
    logger.debug('[xBridge] webpack probe failed', err);
    return null;
  }
  if (runtime && runtime.c && runtime.m) webpackRuntime = runtime;
  return webpackRuntime;
}

function deepFind(value, predicate, maxDepth = 5, seen = new Set()) {
  if (!value || typeof value !== 'object' || maxDepth < 0 || seen.has(value)) return null;
  seen.add(value);
  try {
    if (predicate(value)) return value;
  } catch (err) {
    logger.debug('[xBridge] predicate failed', err);
  }
  for (const key of Object.keys(value)) {
    let child;
    try {
      child = value[key];
    } catch (err) {
      continue;
    }
    const found = deepFind(child, predicate, maxDepth - 1, seen);
    if (found) return found;
  }
  return null;
}

/** 在两处找目标：模块缓存 → 模块工厂（先用源码字符串廉价过滤） */
function scanRuntime(runtime, sourceNeedle, predicate) {
  if (!runtime) return null;
  for (const module of Object.values(runtime.c || {})) {
    const found = deepFind(module && module.exports, predicate);
    if (found) return found;
  }
  for (const [moduleId, factory] of Object.entries(runtime.m || {})) {
    let source = '';
    try {
      source = Function.prototype.toString.call(factory);
    } catch (err) {
      continue;
    }
    if (sourceNeedle && !source.includes(sourceNeedle)) continue;
    try {
      const exports = runtime(moduleId);
      const found = deepFind(exports && (exports.exports || exports), predicate);
      if (found) return found;
    } catch (err) {
      // 部分模块依赖特定环境，忽略
    }
  }
  return null;
}

export function findOperation(win, operationName) {
  if (operationCache.has(operationName)) return operationCache.get(operationName);
  const predicate = (value) => value && value.operationName === operationName && typeof value.queryId === 'string';
  const found = scanRuntime(getWebpackRuntime(win), operationName, predicate) || null;
  operationCache.set(operationName, found);
  return found;
}

/** X 的 x-client-transaction-id 签名函数（成员名 kc、arity 3），找不到不阻断请求 */
function findTransactionIdFunction(win) {
  const predicate = (value) => {
    const candidate = value && value.kc;
    return typeof candidate === 'function' && candidate.length === 3;
  };
  return scanRuntime(getWebpackRuntime(win), 'x-client-transaction-id', predicate)?.kc || null;
}

function toggleMap(items) {
  const result = {};
  for (const item of items || []) {
    if (typeof item === 'string') result[item] = true;
    else if (item && typeof item.name === 'string') result[item.name] = item.value === void 0 ? true : item.value;
  }
  return result;
}

// ---------- 请求头 ----------

function csrfToken(win) {
  try {
    return decodeURIComponent((String(win.document.cookie).match(/(?:^|;\s*)ct0=([^;]+)/) || [])[1] || '');
  } catch (err) {
    return '';
  }
}

/**
 * 兜底：直接从 webpack 模块源码里找 web 端 bearer（不硬编码，找不到就算了）。
 * 正常路径是捕获 X 自己请求里的 authorization 头。
 */
function discoverBearer(win) {
  const runtime = getWebpackRuntime(win);
  if (!runtime) return null;
  for (const factory of Object.values(runtime.m || {})) {
    let source = '';
    try {
      source = Function.prototype.toString.call(factory);
    } catch (err) {
      continue;
    }
    if (!source.includes('Bearer ')) continue;
    const match = source.match(/Bearer\s+([A-Za-z0-9%_-]{30,})/);
    if (match) return `Bearer ${match[1]}`;
  }
  return null;
}

async function requestHeaders(win, path, method, requiresCsrf) {
  const headers = { 'content-type': 'application/json' };
  headers['x-twitter-active-user'] = captured.auth['x-twitter-active-user'] || 'yes';
  headers['x-twitter-auth-type'] = captured.auth['x-twitter-auth-type'] || 'OAuth2Session';
  let authorization = captured.auth.authorization;
  if (!authorization) {
    authorization = discoverBearer(win);
    if (authorization) captured.bearerSource = 'webpack';
  } else {
    captured.bearerSource = captured.bearerSource || 'request';
  }
  if (!authorization) throw new Error('还没有捕获到 X 登录请求，请刷新 X 页面后重试');
  headers.authorization = authorization;
  for (const name of ['x-twitter-client-language', 'x-client-uuid']) {
    if (captured.auth[name]) headers[name] = captured.auth[name];
  }
  const csrf = csrfToken(win);
  if (csrf) headers['x-csrf-token'] = csrf;
  if (requiresCsrf && !csrf) throw new Error('当前 X 登录会话缺少 CSRF 信息，请刷新后重试');
  try {
    if (transactionIdFn === void 0) transactionIdFn = findTransactionIdFunction(win);
    if (typeof transactionIdFn === 'function') {
      const transactionId = await transactionIdFn(win.location.host, path, method);
      if (transactionId && !String(transactionId).startsWith('e:')) headers['x-client-transaction-id'] = transactionId;
    }
  } catch (err) {
    // X 目前允许部分操作不带该头，保持请求可用
    logger.debug('[xBridge] transaction id unavailable', err);
  }
  return headers;
}

async function readJson(response) {
  const json = await response.json().catch(() => null);
  if (!response.ok || (json && json.errors && json.errors.length)) {
    const message = (json && json.errors && json.errors[0] && json.errors[0].message) || `X 请求失败（${response.status}）`;
    throw new Error(message);
  }
  return json;
}

// ---------- 业务请求 ----------

export async function graphql(win, operationName, variables, method = 'POST', signal) {
  const operation = findOperation(win, operationName);
  if (!operation) throw new Error(`当前 X 页面尚未加载 ${operationName} 操作，请刷新页面后重试`);
  const path = `/i/api/graphql/${operation.queryId}/${operationName}`;
  const metadata = operation.metadata || {};
  const features = toggleMap(metadata.featureSwitches);
  const fieldToggles = toggleMap(metadata.fieldToggles);
  const headers = await requestHeaders(win, path, method, method === 'POST');
  if (method === 'GET') {
    const url = new URL(path, win.location.origin);
    url.searchParams.set('variables', JSON.stringify(variables));
    url.searchParams.set('features', JSON.stringify(features));
    url.searchParams.set('fieldToggles', JSON.stringify(fieldToggles));
    return readJson(await win.fetch(url.toString(), { method, headers, credentials: 'include', cache: 'no-store', signal }));
  }
  return readJson(
    await win.fetch(path, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ variables, features, queryId: operation.queryId })
    })
  );
}

export function readArticle(win, tweetId) {
  return graphql(
    win,
    'TweetResultByRestId',
    { tweetId: String(tweetId), withCommunity: false, includePromotedContent: false, withVoice: false },
    'GET'
  );
}

/** operation 发现失败时，重放捕获到的 TweetDetail 模板（只改 variables） */
async function replayTweetDetail(win, tweetId, cursor) {
  const template = captured.templates.get('TweetDetail');
  if (!template) return null;
  const url = new URL(template.url, win.location.origin);
  let variables = {};
  try {
    variables = JSON.parse(url.searchParams.get('variables') || '{}');
  } catch (err) {
    logger.debug('[xBridge] template variables unparsable', err);
  }
  variables.focalTweetId = String(tweetId);
  if (cursor) variables.cursor = cursor;
  else delete variables.cursor;
  url.searchParams.set('variables', JSON.stringify(variables));
  const headers = { ...template.headers, ...(await requestHeaders(win, url.pathname, template.method, false)) };
  return readJson(await win.fetch(url.toString(), { method: template.method, headers, credentials: 'include', cache: 'no-store' }));
}

/** 读取帖子详情（原帖 + 首屏评论）；cursor 为分页游标 */
export async function readThread(win, tweetId, cursor) {
  const variables = {
    focalTweetId: String(tweetId),
    referrer: 'home',
    with_rux_injections: false,
    rankingMode: 'Relevance',
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true
  };
  if (cursor) variables.cursor = cursor;
  try {
    return await graphql(win, 'TweetDetail', variables, 'GET');
  } catch (primaryError) {
    const replayed = await replayTweetDetail(win, tweetId, cursor).catch((err) => {
      logger.debug('[xBridge] template replay failed', err);
      return null;
    });
    if (replayed) return replayed;
    throw primaryError;
  }
}

// ---------- 互动（点赞 / 转推 / 收藏 / 回复） ----------
// 与 peek 一致：active 表示「当前已激活」，因此要发送的是**反向**操作。
// 注意 repost 的变量名不对称（peek 实测如此）：DeleteRetweet 用 source_tweet_id，
// CreateRetweet 用 tweet_id，照抄不要「修正」。
const ACTIONS = Object.freeze({
  like: { active: 'UnfavoriteTweet', inactive: 'FavoriteTweet' },
  repost: { active: 'DeleteRetweet', inactive: 'CreateRetweet' },
  bookmark: { active: 'DeleteBookmark', inactive: 'CreateBookmark' }
});

export async function toggleAction(win, action, tweetId, active) {
  const mapping = ACTIONS[action];
  if (!mapping) throw new Error('不支持的互动操作');
  const operationName = active ? mapping.active : mapping.inactive;
  const variables =
    action === 'repost' && active
      ? { source_tweet_id: String(tweetId), dark_request: false }
      : action === 'repost'
        ? { tweet_id: String(tweetId), dark_request: false }
        : { tweet_id: String(tweetId) };
  return graphql(win, operationName, variables, 'POST');
}

export async function createReply(win, tweetId, text) {
  const replyText = String(text || '').trim();
  if (!replyText) throw new Error('回复内容不能为空');
  return graphql(
    win,
    'CreateTweet',
    {
      tweet_text: replyText,
      dark_request: false,
      media: { media_entities: [], possibly_sensitive: false },
      semantic_annotation_ids: [],
      disallowed_reply_options: null,
      reply: { in_reply_to_tweet_id: String(tweetId), exclude_reply_user_ids: [] }
    },
    'POST'
  );
}

// ---------- 翻译（REST，非 GraphQL） ----------

/**
 * 用当前登录会话调 X 自己的翻译服务（与 peek 同路径）。
 * 优先复用捕获到的真实请求模板（替换其中的 tweetId），否则用固定兜底路径。
 */
export async function translateTweet(win, tweetId, targetLanguage) {
  const language = String(targetLanguage || 'zh-cn').toLowerCase();
  const fallbackPath = `/i/api/1.1/strato/column/None/tweetId=${tweetId},destinationLanguage=None,translationSource=Some(Google),feature=None,timeout=None,onlyCached=None/translation/service/translateTweet`;
  const template = captured.translationTemplate;
  const url = new URL((template && template.url) || fallbackPath, win.location.origin);
  if (/tweetId=\d+/.test(url.pathname)) url.pathname = url.pathname.replace(/tweetId=\d+/, `tweetId=${tweetId}`);
  else url.pathname = fallbackPath;
  const headers = {
    ...((template && template.headers) || {}),
    ...(await requestHeaders(win, url.pathname, 'GET', false)),
    accept: '*/*',
    'x-twitter-client-language': language
  };
  const response = await win.fetch(url.toString(), { method: 'GET', headers, credentials: 'include', cache: 'no-store' });
  const json = await response.json().catch(() => null);
  const errors = json && json.errors;
  if (!response.ok || (errors && errors.length) || (json && json.translationState === 'Failed')) {
    throw new Error((errors && errors[0] && errors[0].message) || `X 翻译请求失败（${response.status}）`);
  }
  const text = String((json && json.translation) || '').trim();
  if (!text) throw new Error('X 暂时没有返回这条帖子的翻译');
  return {
    text,
    sourceLanguage: String((json && (json.sourceLanguage || json.source_language)) || ''),
    localizedSourceLanguage: String((json && (json.localizedSourceLanguage || json.localized_source_language)) || ''),
    destinationLanguage: String((json && (json.destinationLanguage || json.destination_language)) || language)
  };
}

// ---------- 关注 / 取关 ----------
// X 网页端的关注走 REST（不是 GraphQL）。写入成功后响应可能缺少关系字段，
// 此时做一次有界的读回核对；**绝不因为核对失败就把已提交的写入报成失败**。

/** 从用户对象里读关注关系；id 必须与请求完全一致（数字型 id 会丢精度，按不可信处理） */
function followStateFromUser(user, userId) {
  if (!user) return null;
  const id = user.rest_id || user.id_str || (typeof user.id === 'string' ? user.id : null);
  if (String(id) !== String(userId)) return null;
  const relationship = user.relationship_perspectives || user.legacy || user;
  const following = relationship.following;
  const pending = relationship.follow_request_sent;
  if (typeof following !== 'boolean' && pending !== true) return null;
  const followers = user.relationship_counts
    ? user.relationship_counts.followers_count
    : (user.legacy && user.legacy.followers_count) !== undefined
      ? user.legacy.followers_count
      : user.followers_count;
  return {
    confirmed: true,
    following: following === true,
    followRequestSent: pending === true,
    followers: Number.isFinite(Number(followers)) ? Number(followers) : null
  };
}

export async function toggleFollow(win, userId, active) {
  const id = String(userId || '');
  if (!/^\d+$/.test(id)) throw new Error('用户 ID 无效');
  const path = `/i/api/1.1/friendships/${active ? 'create' : 'destroy'}.json`;
  const headers = await requestHeaders(win, path, 'POST', true);
  headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
  const response = await win.fetch(path, {
    method: 'POST',
    headers,
    credentials: 'include',
    cache: 'no-store',
    body: new URLSearchParams({ user_id: id }).toString()
  });
  const json = await response.json().catch(() => null);
  const errors = json && json.errors;
  if (!response.ok || (errors && errors.length)) {
    throw new Error((errors && errors[0] && errors[0].message) || `X 关注请求失败（${response.status}）`);
  }
  const direct = followStateFromUser(json, id);
  if (direct && (active ? direct.following || direct.followRequestSent : !direct.following && !direct.followRequestSent)) {
    return direct;
  }
  try {
    const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined;
    const profile = await graphql(win, 'UserByRestId', { userId: id }, 'GET', signal);
    const verified = followStateFromUser(profile && profile.data && profile.data.user && profile.data.user.result, id);
    if (verified) return verified;
  } catch (err) {
    // 读回失败不影响已经提交成功的关注请求
    logger.debug('[xBridge] follow read-back failed', err);
  }
  return { confirmed: false };
}

// ---------- 安装与自检 ----------

export function installXBridge(win = pageWindow()) {
  if (!win) return null;
  if (win.__PV2_X_BRIDGE__) return win.__PV2_X_BRIDGE__;
  patchFetch(win);
  patchXhr(win);
  getWebpackRuntime(win);
  const api = {
    readThread: (tweetId, cursor) => readThread(win, tweetId, cursor),
    readArticle: (tweetId) => readArticle(win, tweetId),
    graphql: (operationName, variables, method) => graphql(win, operationName, variables, method),
    toggleAction: (action, tweetId, active) => toggleAction(win, action, tweetId, active),
    createReply: (tweetId, text) => createReply(win, tweetId, text),
    translateTweet: (tweetId, targetLanguage) => translateTweet(win, tweetId, targetLanguage),
    toggleFollow: (userId, active) => toggleFollow(win, userId, active),
    findOperation: (operationName) => findOperation(win, operationName),
    captureState: () => captureState()
  };
  try {
    win.__PV2_X_BRIDGE__ = api;
  } catch (err) {
    logger.warn('[xBridge] expose failed', err);
  }
  return api;
}

/** 自检状态：鉴权头只回是否捕获到，绝不回明文 */
export function captureState() {
  return {
    hasAuthorization: Boolean(captured.auth.authorization),
    bearerSource: captured.bearerSource,
    authHeaders: Object.keys(captured.auth),
    templates: [...captured.templates.keys()],
    hasTranslationTemplate: Boolean(captured.translationTemplate),
    hasWebpackRuntime: Boolean(webpackRuntime)
  };
}
