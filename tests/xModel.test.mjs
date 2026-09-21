// X 数据层回归测试（纯逻辑，无需浏览器）：node tests/xModel.test.mjs
// 夹具按 X 的 TweetDetail 真实响应结构构造：原帖与评论都在
// data.threaded_conversation_with_injections_v2.instructions[].entries[] 里。
// C2 会在此基础上补齐媒体变体/引用帖/长文的用例。

import assert from 'node:assert/strict';
import {
  parseThreadSummary,
  postIdFromUrl,
  bottomCursor,
  unwrapResult,
  replyCursorAfterPage,
  shouldOfferTranslation,
  sourceLanguageLabel,
  articleContentFromPayload,
  fullTextFromPayload
} from '../src/x/xModel.js';

const user = (id, name, handle, extra = {}) => ({
  result: {
    rest_id: id,
    is_blue_verified: extra.verified === true,
    legacy: {
      name,
      screen_name: handle,
      profile_image_url_https: `https://pbs.twimg.com/${handle}_normal.jpg`,
      ...extra.legacy
    }
  }
});

const tweet = (id, { text, replyTo = '', conversation = '100', user: author, counts = {}, media = [], quote = null, views = null }) => {
  const result = {
    rest_id: id,
    core: { user_results: author },
    legacy: {
      full_text: text,
      created_at: 'Wed Oct 10 20:19:24 +0000 2018',
      conversation_id_str: conversation,
      in_reply_to_status_id_str: replyTo,
      reply_count: counts.replies || 0,
      favorite_count: counts.likes || 0,
      retweet_count: counts.reposts || 0,
      extended_entities: { media }
    }
  };
  if (quote) result.quoted_status_result = quote;
  if (views !== null) result.views = { count: String(views) };
  return result;
};

const entry = (id, result) => ({ entryId: `tweet-${id}`, content: { itemContent: { tweet_results: { result } } } });

const fixture = {
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            entry('100', tweet('100', { text: '原帖正文', user: user('u1', '作者', 'author', { verified: true }), counts: { replies: 2, likes: 5, reposts: 1 }, views: 1234, media: [{ id_str: 'm1', type: 'photo', media_url_https: 'https://pbs.twimg.com/m.jpg' }], quote: { result: tweet('777', { text: '引用帖', user: user('u9', '被引用', 'quoted') }) } })),
            entry('200', tweet('200', { text: '直接回复', replyTo: '100', user: user('u2', '回复者', 'replier') })),
            entry('300', tweet('300', { text: '嵌套回复', replyTo: '200', user: user('u3', '嵌套', 'nested') })),
            // X 会往响应里注入推荐内容，不能当成评论
            entry('900', tweet('900', { text: '推荐内容', replyTo: '555', conversation: '555', user: user('u4', '推荐', 'recommended') })),
            { entryId: 'cursor-bottom-1', content: { cursorType: 'Bottom', value: 'CURSOR_1' } }
          ]
        }
      ]
    }
  }
};

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('xModel');

check('从各种 X 链接解析帖子 ID', () => {
  assert.equal(postIdFromUrl('https://x.com/author/status/100'), '100');
  assert.equal(postIdFromUrl('/author/status/100/photo/1', 'https://x.com/'), '100');
  assert.equal(postIdFromUrl('https://twitter.com/author/status/100?s=20'), '100');
  assert.equal(postIdFromUrl('https://x.com/home'), null);
});

check('解包穿透多层包装，只认同时具备 legacy 与 rest_id 的节点', () => {
  assert.equal(unwrapResult({ result: { rest_id: '1', legacy: {} } }).rest_id, '1');
  assert.equal(unwrapResult({ tweet: { rest_id: '2', legacy: {} } }).rest_id, '2');
  assert.equal(unwrapResult({ result: { rest_id: '3' } }), null);
});

check('识别 Bottom 游标，回退 ShowMoreThreads', () => {
  assert.equal(bottomCursor({ a: { cursorType: 'Bottom', value: 'B' } }), 'B');
  assert.equal(bottomCursor({ a: { cursorType: 'ShowMoreThreads', value: 'S' } }), 'S');
  assert.equal(bottomCursor({ a: {} }), null);
});

check('解出原帖：正文 / 作者 / 认证 / 头像尺寸 / 计数', () => {
  const summary = parseThreadSummary(fixture, '100');
  assert.equal(summary.focalFound, true);
  assert.equal(summary.focal.text, '原帖正文');
  assert.equal(summary.focal.author.handle, 'author');
  assert.equal(summary.focal.author.name, '作者');
  assert.equal(summary.focal.author.verified, true);
  assert.equal(summary.focal.author.avatar, 'https://pbs.twimg.com/author_200x200.jpg');
  assert.equal(summary.focal.counts.likes, 5);
  assert.equal(summary.focal.counts.views, 1234);
  assert.equal(summary.focal.mediaCount, 1);
});

check('评论按 in_reply_to 链归属原帖，推荐内容被排除', () => {
  const summary = parseThreadSummary(fixture, '100');
  assert.equal(summary.replyCount, 2);
  assert.deepEqual(
    summary.replies.map((reply) => reply.id),
    ['200', '300']
  );
  assert.equal(
    summary.replies.some((reply) => reply.id === '900'),
    false
  );
  assert.equal(
    summary.replies.some((reply) => reply.id === '777'),
    false
  );
});

check('嵌套评论拍平成 depth（直接回复 0，嵌套 1）', () => {
  const summary = parseThreadSummary(fixture, '100');
  assert.equal(summary.replies[0].depth, 0);
  assert.equal(summary.replies[1].depth, 1);
});

check('游标透出供分页使用', () => {
  assert.equal(parseThreadSummary(fixture, '100').cursor, 'CURSOR_1');
});

check('fail-closed：原帖不在响应里时不把推荐内容当评论', () => {
  const summary = parseThreadSummary(fixture, '999');
  assert.equal(summary.focalFound, false);
  assert.equal(summary.focal, null);
  assert.equal(summary.replyCount, 0);
});

check('作者节点无 legacy（X 已迁移到 core/avatar）时仍能解出昵称与头像', () => {
  // 回归：此前复用 unwrapResult 解用户节点，它要求 legacy + rest_id 同时存在，
  // 导致新结构用户解包为 null —— 表现为「用户名丢失」
  const modernUser = {
    result: {
      __typename: 'User',
      rest_id: 'u5',
      is_blue_verified: true,
      core: { name: '新结构作者', screen_name: 'modern' },
      avatar: { image_url: 'https://pbs.twimg.com/modern_normal.jpg' }
    }
  };
  const payload = {
    data: {
      threaded_conversation_with_injections_v2: {
        instructions: [{ entries: [entry('500', tweet('500', { text: '新结构帖', user: modernUser }))] }]
      }
    }
  };
  const summary = parseThreadSummary(payload, '500');
  assert.equal(summary.focalFound, true);
  assert.equal(summary.focal.author.name, '新结构作者');
  assert.equal(summary.focal.author.handle, 'modern');
  assert.equal(summary.focal.author.avatar, 'https://pbs.twimg.com/modern_200x200.jpg');
  assert.equal(summary.focal.author.verified, true);
});

check('媒体：图片取 media_url_https 与原始尺寸、保留 alt', () => {
  const photo = { id_str: 'm1', type: 'photo', media_url_https: 'https://pbs.twimg.com/p.jpg', original_info: { width: 1200, height: 800 }, ext_alt_text: '一张图' };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('600', tweet('600', { text: '图', user: user('u6', 'A', 'a'), media: [photo] }))] }] } } };
  const model = parseThreadSummary(payload, '600').focal;
  assert.equal(model.media.length, 1);
  assert.equal(model.media[0].type, 'photo');
  assert.equal(model.media[0].url, 'https://pbs.twimg.com/p.jpg');
  assert.equal(model.media[0].width, 1200);
  assert.equal(model.media[0].altText, '一张图');
});

check('媒体：视频按码率选档（不超过目标的最高档），HLS 另存', () => {
  const video = {
    id_str: 'm2',
    type: 'video',
    media_url_https: 'https://pbs.twimg.com/v.jpg',
    video_info: {
      variants: [
        { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/v.m3u8' },
        { content_type: 'video/mp4', bitrate: 256000, url: 'https://video.twimg.com/v-256.mp4' },
        { content_type: 'video/mp4', bitrate: 832000, url: 'https://video.twimg.com/v-832.mp4' },
        { content_type: 'video/mp4', bitrate: 2176000, url: 'https://video.twimg.com/v-2176.mp4' }
      ]
    }
  };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('700', tweet('700', { text: '视频', user: user('u7', 'B', 'b'), media: [video] }))] }] } } };
  const item = parseThreadSummary(payload, '700').focal.media[0];
  assert.equal(item.type, 'video');
  assert.equal(item.videoUrl, 'https://video.twimg.com/v-832.mp4');
  assert.equal(item.hlsUrl, 'https://video.twimg.com/v.m3u8');
  assert.equal(item.url, 'https://pbs.twimg.com/v.jpg');
});

check('媒体：仅 HLS 的视频不假装有 MP4，GIF 归为 animated_gif', () => {
  const hlsOnly = { id_str: 'm3', type: 'video', media_url_https: 'https://pbs.twimg.com/h.jpg', video_info: { variants: [{ content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/h.m3u8' }] } };
  const gif = { id_str: 'm4', type: 'animated_gif', media_url_https: 'https://pbs.twimg.com/g.jpg', video_info: { variants: [{ content_type: 'video/mp4', bitrate: 0, url: 'https://video.twimg.com/g.mp4' }] } };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('800', tweet('800', { text: 'x', user: user('u8', 'C', 'c'), media: [hlsOnly, gif] }))] }] } } };
  const model = parseThreadSummary(payload, '800').focal;
  assert.equal(model.media[0].type, 'video');
  assert.equal(model.media[0].videoUrl, '');
  assert.equal(model.media[0].hlsUrl, 'https://video.twimg.com/h.m3u8');
  assert.equal(model.media[1].type, 'animated_gif');
  assert.equal(model.media[1].videoUrl, 'https://video.twimg.com/g.mp4');
});

check('互动状态映射到 flags（点赞/转推/收藏，含 current_user_retweet）', () => {
  const withFlags = tweet('110', { text: '已互动', user: user('u11', 'D', 'd') });
  withFlags.legacy.favorited = true;
  withFlags.legacy.bookmarked = true;
  withFlags.legacy.current_user_retweet = { id_str: '110' };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('110', withFlags)] }] } } };
  const model = parseThreadSummary(payload, '110').focal;
  assert.equal(model.flags.liked, true);
  assert.equal(model.flags.bookmarked, true);
  assert.equal(model.flags.reposted, true);
});

check('回复上下文：带出被点开那条之前的对话链', () => {
  const payload = {
    data: {
      threaded_conversation_with_injections_v2: {
        instructions: [
          {
            entries: [
              entry('1000', tweet('1000', { text: '会话根', user: user('r1', '根', 'root') })),
              entry('1001', tweet('1001', { text: '中间', replyTo: '1000', user: user('r2', '中', 'mid') })),
              entry('1002', tweet('1002', { text: '被点开的回复', replyTo: '1001', user: user('r3', '末', 'leaf') }))
            ]
          }
        ]
      }
    }
  };
  const summary = parseThreadSummary(payload, '1002');
  assert.equal(summary.focalFound, true);
  assert.deepEqual(
    summary.ancestors.map((model) => model.id),
    ['1000', '1001']
  );
});

check('分页终止规则：无新增 / 游标为空 / 游标重复都停止', () => {
  assert.equal(replyCursorAfterPage('c1', 'c2', 3), 'c2');
  assert.equal(replyCursorAfterPage('c1', 'c2', 0), null);
  assert.equal(replyCursorAfterPage('c1', 'c1', 3), null);
  assert.equal(replyCursorAfterPage('c1', '', 3), null);
});

check('翻译判定：外语才翻，中文/纯链接/纯提及不翻', () => {
  assert.equal(shouldOfferTranslation('Hello world, this is a fairly long English sentence.'), true);
  assert.equal(shouldOfferTranslation('这是一条中文帖子，不需要翻译'), false);
  assert.equal(shouldOfferTranslation('こんにちは'), true);
  assert.equal(shouldOfferTranslation('안녕하세요'), true);
  assert.equal(shouldOfferTranslation('Привет мир'), true);
  assert.equal(shouldOfferTranslation('https://example.com/some/long/path'), false);
  assert.equal(shouldOfferTranslation('@someone'), false);
  assert.equal(shouldOfferTranslation('ok'), false);
  assert.equal(shouldOfferTranslation(''), false);
});

check('翻译来源标签：优先 X 返回的本地化名称', () => {
  assert.equal(sourceLanguageLabel({ localizedSourceLanguage: '英语' }), '英语');
  assert.equal(sourceLanguageLabel({ sourceLanguage: 'ja' }), '日语');
  assert.equal(sourceLanguageLabel({}), '外语');
});

check('作者资料卡字段：简介 / 关注数 / 粉丝数 / 关系', () => {
  const profileUser = user('u12', '资料', 'prof');
  Object.assign(profileUser.result.legacy, {
    description: '简介文本',
    followers_count: 1234,
    friends_count: 56,
    following: true,
    followed_by: true
  });
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('120', tweet('120', { text: 'x', user: profileUser }))] }] } } };
  const author = parseThreadSummary(payload, '120').focal.author;
  assert.equal(author.id, 'u12');
  assert.equal(author.description, '简介文本');
  assert.equal(author.followers, 1234);
  assert.equal(author.followingCount, 56);
  assert.equal(author.viewerFollowing, true);
  assert.equal(author.followsViewer, true);
});

check('作者资料卡字段：新结构走 relationship_counts / profile_bio', () => {
  const modernUser = {
    result: {
      __typename: 'User',
      rest_id: 'u13',
      core: { name: '新', screen_name: 'modern2' },
      avatar: { image_url: 'https://pbs.twimg.com/m2_normal.jpg' },
      profile_bio: { description: '新结构简介' },
      relationship_counts: { followers_count: 88, following_count: 9 },
      relationship_perspectives: { following: false, follow_request_sent: true }
    }
  };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('130', tweet('130', { text: 'x', user: modernUser }))] }] } } };
  const author = parseThreadSummary(payload, '130').focal.author;
  assert.equal(author.description, '新结构简介');
  assert.equal(author.followers, 88);
  assert.equal(author.followingCount, 9);
  assert.equal(author.viewerFollowing, false);
  assert.equal(author.followRequestSent, true);
});

check('X 长文：解出封面/标题/摘要与 content_state 正文块', () => {
  const articleTweet = tweet('210', { text: 'https://t.co/CNZ3zpQRQw', user: user('u21', 'win98', 'keva7in') });
  articleTweet.article = {
    article_results: {
      result: {
        title: '长文标题',
        preview_text: '摘要文本',
        cover_media: { original_img_url: 'https://pbs.twimg.com/cover.jpg', original_img_width: 1200, original_img_height: 600 },
        content_state: {
          blocks: [
            { key: 'a', type: 'header-one', text: '第一节', entityRanges: [], inlineStyleRanges: [] },
            { key: 'b', type: 'unstyled', text: '正文段落', entityRanges: [], inlineStyleRanges: [{ offset: 0, length: 2, style: 'BOLD' }] },
            { key: 'c', type: 'blockquote', text: '引用', entityRanges: [], inlineStyleRanges: [] },
            { key: 'd', type: 'unordered-list-item', text: '要点一', entityRanges: [], inlineStyleRanges: [] },
            { key: 'e', type: 'atomic', text: ' ', entityRanges: [{ offset: 0, length: 1, key: '1' }], inlineStyleRanges: [] }
          ],
          entityMap: { 1: { type: 'IMAGE', data: { src: 'https://pbs.twimg.com/inline.jpg', width: 800, height: 400, alt: '配图' } } }
        }
      }
    }
  };
  articleTweet.legacy.entities = { urls: [{ url: 'https://t.co/CNZ3zpQRQw', expanded_url: 'https://x.com/i/article/210' }] };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('210', articleTweet)] }] } } };
  const model = parseThreadSummary(payload, '210').focal;
  assert.equal(model.attachment.type, 'article');
  assert.equal(model.attachment.title, '长文标题');
  assert.equal(model.attachment.description, '摘要文本');
  assert.equal(model.attachment.image, 'https://pbs.twimg.com/cover.jpg');
  assert.equal(model.attachment.imageWidth, 1200);
  assert.equal(model.attachment.url, 'https://x.com/i/article/210');
  assert.equal(model.attachment.content.blocks.length, 5);
  assert.equal(model.attachment.content.blocks[0].type, 'header-one');
  // 行内样式（加粗等）必须保留，否则长文正文会整体变成同一字重
  assert.deepEqual(model.attachment.content.blocks[1].inlineStyles, [{ offset: 0, length: 2, style: 'BOLD' }]);
  assert.equal(model.attachment.content.entities['1'].image, 'https://pbs.twimg.com/inline.jpg');
  assert.equal(model.attachment.content.entities['1'].alt, '配图');
});

check('X 长文：无 content_state 时用 plain_text 按空行分段', () => {
  const articleTweet = tweet('220', { text: 'https://t.co/x', user: user('u22', 'A', 'a') });
  articleTweet.article = { result: { title: 'T', plain_text: '第一段\n\n第二段' } };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('220', articleTweet)] }] } } };
  const content = parseThreadSummary(payload, '220').focal.attachment.content;
  assert.deepEqual(
    content.blocks.map((block) => block.text),
    ['第一段', '第二段']
  );
});

check('X 长文：正文缺失时可用 articleContentFromPayload 从响应里补全', () => {
  const payload = {
    data: {
      tweetResult: {
        result: {
          rest_id: '230',
          legacy: { full_text: 'x' },
          article: { article_results: { result: { title: 'T', content_state: { blocks: [{ key: 'a', type: 'unstyled', text: '补全的正文' }] } } } }
        }
      }
    }
  };
  const content = articleContentFromPayload(payload);
  assert.equal(content.blocks.length, 1);
  assert.equal(content.blocks[0].text, '补全的正文');
});

check('非长文帖没有 attachment', () => {
  const summary = parseThreadSummary(fixture, '100');
  assert.equal(summary.focal.attachment, null);
});

check('实体区间：@提及 / #话题 / 链接（含 emoji 的码点偏移换算）', () => {
  // X 的 indices 按码点计，字符串里有 emoji（代理对）时直接切片会整体错位
  const full = 'hi 😀 @alice 你好 #tag https://t.co/abc';
  const withEntities = tweet('300', { text: full, user: user('u30', 'A', 'a') });
  withEntities.legacy.entities = {
    user_mentions: [{ screen_name: 'alice', name: 'Alice', id_str: '999', indices: [5, 11] }],
    hashtags: [{ text: 'tag', indices: [15, 19] }],
    urls: [
      { url: 'https://t.co/abc', expanded_url: 'https://example.com/x', display_url: 'example.com/x', indices: [20, 36] }
    ]
  };
  const payload = {
    data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('300', withEntities)] }] } }
  };
  const model = parseThreadSummary(payload, '300').focal;
  assert.equal(model.entities.length, 3);
  const [mention, hashtag, link] = model.entities;
  assert.equal(full.slice(mention.start, mention.end), '@alice');
  assert.equal(mention.kind, 'mention');
  assert.equal(mention.url, 'https://x.com/alice');
  assert.equal(mention.author.id, '999');
  assert.equal(mention.author.handle, 'alice');
  assert.equal(mention.author.name, 'Alice');
  assert.equal(full.slice(hashtag.start, hashtag.end), '#tag');
  assert.equal(hashtag.url, 'https://x.com/hashtag/tag');
  assert.equal(full.slice(link.start, link.end), 'https://t.co/abc');
  assert.equal(link.url, 'https://example.com/x');
});

check('可见正文：display_text_range 排除媒体帖末尾的 t.co 链接', () => {
  const withRange = tweet('310', { text: '看图 😀 https://t.co/pic', user: user('u31', 'B', 'b') });
  withRange.legacy.display_text_range = [0, 5];
  withRange.legacy.entities = {
    media: [{ type: 'photo', media_url_https: 'https://pbs.twimg.com/p.jpg', indices: [5, 20] }]
  };
  const payload = {
    data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('310', withRange)] }] } }
  };
  const model = parseThreadSummary(payload, '310').focal;
  assert.equal(model.text, '看图 😀');
  assert.equal(model.mediaCount, 1);
});

check('可见正文：无 display_text_range 时按首个媒体实体截断', () => {
  const withMedia = tweet('320', { text: '一张图 https://t.co/pic', user: user('u32', 'C', 'c') });
  withMedia.legacy.entities = {
    media: [{ type: 'photo', media_url_https: 'https://pbs.twimg.com/q.jpg', indices: [4, 18] }]
  };
  const payload = {
    data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('320', withMedia)] }] } }
  };
  assert.equal(parseThreadSummary(payload, '320').focal.text, '一张图');
});

check('实体区间：$代码 也识别为可点链接', () => {
  const withSymbol = tweet('330', { text: 'buy $AAPL now', user: user('u33', 'D', 'd') });
  withSymbol.legacy.entities = { symbols: [{ text: 'AAPL', indices: [4, 9] }] };
  const payload = {
    data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('330', withSymbol)] }] } }
  };
  const range = parseThreadSummary(payload, '330').focal.entities[0];
  assert.equal(range.kind, 'symbol');
  assert.equal(range.url, 'https://x.com/search?q=%24AAPL');
});

check('显示窗口起点不为 0：被跳过的开头 @提及 不得残留为链接', () => {
  // 回归：X 的回复帖会把开头的 @提及 从显示文本里跳掉（display_text_range 起点 > 0）。
  // 若实体索引仍按原文坐标使用，就会把无关字符渲染成提及链接（帖子里没有 @ 却出现标记）。
  const reply = tweet('340', { text: '@bob 这是回复正文', replyTo: '100', user: user('u34', 'E', 'e') });
  reply.legacy.display_text_range = [5, 11];
  reply.legacy.entities = {
    user_mentions: [{ screen_name: 'bob', name: 'Bob', id_str: '777', indices: [0, 4] }]
  };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('340', reply)] }] } } };
  const model = parseThreadSummary(payload, '340').focal;
  assert.equal(model.text, '这是回复正文');
  assert.equal(model.entities.length, 0);
});

check('显示窗口起点不为 0：窗口内的实体偏移被正确平移', () => {
  const reply = tweet('350', { text: '@bob 你好 @alice', replyTo: '100', user: user('u35', 'F', 'f') });
  reply.legacy.display_text_range = [5, 14];
  reply.legacy.entities = {
    user_mentions: [
      { screen_name: 'bob', name: 'Bob', id_str: '777', indices: [0, 4] },
      { screen_name: 'alice', name: 'Alice', id_str: '888', indices: [8, 14] }
    ]
  };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('350', reply)] }] } } };
  const model = parseThreadSummary(payload, '350').focal;
  assert.equal(model.text, '你好 @alice');
  assert.equal(model.entities.length, 1);
  assert.equal(model.entities[0].kind, 'mention');
  assert.equal(model.text.slice(model.entities[0].start, model.entities[0].end), '@alice');
});

check('正文截断：legacy.truncated 且无 note_tweet 时标记 needsExpand', () => {
  const cut = tweet('360', { text: '这是一条很长的帖子，X 在时间线里把它截断了…', user: user('u36', 'G', 'g') });
  cut.legacy.truncated = true;
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('360', cut)] }] } } };
  const model = parseThreadSummary(payload, '360').focal;
  assert.equal(model.needsExpand, true);
  assert.equal(model.hasFullText, false);
});

check('正文截断：note_tweet 已带全文时不出现「显示更多」', () => {
  const long = tweet('370', { text: '截断版…', user: user('u37', 'H', 'h') });
  long.legacy.truncated = true;
  long.note_tweet = { note_tweet_results: { result: { text: '这是完整正文，没有被截断', entity_set: {} } } };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('370', long)] }] } } };
  const model = parseThreadSummary(payload, '370').focal;
  assert.equal(model.text, '这是完整正文，没有被截断');
  assert.equal(model.hasFullText, true);
  assert.equal(model.needsExpand, false);
});

check('fullTextFromPayload：从补全响应里取出全文与实体', () => {
  const payload = {
    data: {
      tweetResult: {
        result: {
          rest_id: '380',
          legacy: { full_text: '截断版…', truncated: true },
          note_tweet: {
            note_tweet_results: {
              result: {
                text: '补全后的完整正文 @alice',
                entity_set: { user_mentions: [{ screen_name: 'alice', name: 'Alice', id_str: '1', indices: [9, 15] }] }
              }
            }
          }
        }
      }
    }
  };
  const full = fullTextFromPayload(payload, '380');
  assert.equal(full.text, '补全后的完整正文 @alice');
  assert.equal(full.entities.length, 1);
  assert.equal(full.entities[0].kind, 'mention');
  assert.equal(fullTextFromPayload(payload, '999'), null);
});

check('长贴全文不得被 legacy 的 display_text_range 截断（回归）', () => {
  // 回归：display_text_range 是截断版 legacy 文本的坐标，套到 note 全文上会把全文再截一刀，
  // 表现为长贴「没显示全」，且因为已拿到全文而不出「显示更多」按钮。
  const long = tweet('390', { text: '截断版开头…', user: user('u39', 'I', 'i') });
  long.legacy.truncated = true;
  long.legacy.display_text_range = [0, 6];
  long.note_tweet = {
    note_tweet_results: {
      result: {
        text: '这是完整的长贴正文，远远超过 legacy 截断版那六个字，必须完整显示出来',
        entity_set: {}
      }
    }
  };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('390', long)] }] } } };
  const model = parseThreadSummary(payload, '390').focal;
  assert.equal(model.text, '这是完整的长贴正文，远远超过 legacy 截断版那六个字，必须完整显示出来');
  assert.equal(model.hasFullText, true);
  assert.equal(model.needsExpand, false);
});

check('长贴：note 文本存在时实体用 entity_set 而非 legacy.entities', () => {
  const long = tweet('395', { text: '@wrong legacy', user: user('u40', 'J', 'j') });
  long.legacy.entities = { user_mentions: [{ screen_name: 'wrong', name: 'W', id_str: '1', indices: [0, 6] }] };
  long.note_tweet = {
    note_tweet_results: {
      result: {
        text: '全文里提到 @right 一次',
        entity_set: { user_mentions: [{ screen_name: 'right', name: 'R', id_str: '2', indices: [6, 12] }] }
      }
    }
  };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('395', long)] }] } } };
  const model = parseThreadSummary(payload, '395').focal;
  assert.equal(model.entities.length, 1);
  assert.equal(model.entities[0].author.handle, 'right');
  assert.equal(model.text.slice(model.entities[0].start, model.entities[0].end), '@right');
});

// ---- 评审回归：以下用例都能拦住实际发生过的 bug ----

check('媒体变体用 content_type（下划线）且 URL 无扩展名时仍能取到播放地址', () => {
  // 回归：代码原先读 variant.contentType，而 X 发的是 content_type →
  // content-type 分支是死的，只剩 URL 后缀判据，无扩展名的变体会丢掉地址。
  // 原有断言恰好因为 fixture URL 都带 .mp4 后缀而通过，属于过拟合。
  const media = [
    {
      id_str: 'm1',
      type: 'video',
      media_url_https: 'https://pbs.twimg.com/poster.jpg',
      video_info: {
        variants: [
          { content_type: 'video/mp4', bitrate: 800000, url: 'https://video.twimg.com/play' },
          { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/playlist' }
        ]
      }
    }
  ];
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('600', tweet('600', { text: '视频', user: user('u60', 'K', 'k'), media }))] }] } } };
  const item = parseThreadSummary(payload, '600').focal.media[0];
  assert.equal(item.type, 'video');
  assert.equal(item.videoUrl, 'https://video.twimg.com/play');
  assert.equal(item.hlsUrl, 'https://video.twimg.com/playlist');
});

check('媒体变体：所有码率都超过目标时取最低档', () => {
  const media = [
    {
      id_str: 'm2',
      type: 'video',
      media_url_https: 'https://pbs.twimg.com/poster.jpg',
      video_info: {
        variants: [
          { content_type: 'video/mp4', bitrate: 5000000, url: 'https://video.twimg.com/hi.mp4' },
          { content_type: 'video/mp4', bitrate: 2000000, url: 'https://video.twimg.com/lo.mp4' }
        ]
      }
    }
  ];
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('610', tweet('610', { text: '视频', user: user('u61', 'L', 'l'), media }))] }] } } };
  assert.equal(parseThreadSummary(payload, '610').focal.media[0].videoUrl, 'https://video.twimg.com/lo.mp4');
});

check('长文只有 content_state（无标题无封面）时仍识别为长文，且不偷正文图当封面', () => {
  // 回归：articleResult 原先只认 title/preview_text/cover_*，这类长文 attachment === null 被整个丢掉
  const art = tweet('620', { text: 'https://t.co/x', user: user('u62', 'M', 'm') });
  art.article = {
    article_results: {
      result: {
        content_state: {
          blocks: [
            { key: 'a', type: 'unstyled', text: '只有正文没有标题' },
            { key: 'b', type: 'atomic', text: ' ', entityRanges: [{ offset: 0, length: 1, key: '1' }] }
          ],
          entityMap: { 1: { type: 'IMAGE', data: { src: 'https://pbs.twimg.com/inline.jpg', width: 800, height: 400 } } }
        }
      }
    }
  };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('620', art)] }] } } };
  const model = parseThreadSummary(payload, '620').focal;
  assert.notEqual(model.attachment, null);
  assert.equal(model.attachment.content.blocks.length, 2);
  // 没有封面节点：不得把正文内联图当封面
  assert.equal(model.attachment.image, '');
  assert.equal(model.attachment.imageWidth, 0);
});

check('重复出现的同一条帖子按 id 去重', () => {
  // 回归：X 会在推荐模块里重复同一条帖子，未去重会让节点数与评论数虚高
  const dup = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('630', tweet('630', { text: '主帖', user: user('u63', 'N', 'n') }))] }] } } };
  dup.data.threaded_conversation_with_injections_v2.instructions[0].entries.push(
    entry('630b', tweet('630', { text: '主帖（重复）', replyTo: '630', user: user('u63', 'N', 'n') }))
  );
  const summary = parseThreadSummary(dup, '630');
  assert.equal(summary.nodeCount, 1);
  assert.equal(summary.replyCount, 0);
  assert.equal(summary.focalFound, true);
});

check('空/畸形响应不抛错（fail-closed）', () => {
  for (const input of [null, undefined, {}, { data: null }]) {
    const summary = parseThreadSummary(input, '1');
    assert.equal(summary.focalFound, false);
    assert.equal(summary.focal, null);
    assert.equal(summary.replyCount, 0);
  }
});

check('链接实体：文字取 display_url（不是正文里的 t.co），href 取 expanded_url', () => {
  // 回归：X 正文里放的是 t.co 短链，界面显示的是 display_url；
  // 渲染层若直接用切片文字，弹窗里就只剩短链。
  const post = tweet('640', { text: '看看这个 https://t.co/abc123', user: user('u64', 'O', 'o') });
  post.legacy.entities = {
    urls: [
      {
        url: 'https://t.co/abc123',
        display_url: 'github.com/foo/bar',
        expanded_url: 'https://github.com/foo/bar',
        indices: [5, 24]
      }
    ]
  };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('640', post)] }] } } };
  const model = parseThreadSummary(payload, '640').focal;
  assert.equal(model.entities.length, 1);
  assert.equal(model.entities[0].kind, 'url');
  assert.equal(model.entities[0].label, 'github.com/foo/bar');
  assert.equal(model.entities[0].url, 'https://github.com/foo/bar');
  // 切片仍是正文里的 t.co（偏移用它定位），换文字是渲染层的职责
  assert.equal(model.text.slice(model.entities[0].start, model.entities[0].end), 'https://t.co/abc123');
});

check('链接实体：没有 display_url 时退回 expanded_url', () => {
  const post = tweet('645', { text: 'https://t.co/xyz', user: user('u65', 'P', 'p') });
  post.legacy.entities = { urls: [{ url: 'https://t.co/xyz', expanded_url: 'https://example.com/a/b', indices: [0, 17] }] };
  const payload = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [entry('645', post)] }] } } };
  const model = parseThreadSummary(payload, '645').focal;
  assert.equal(model.entities[0].label, 'https://example.com/a/b');
  assert.equal(model.entities[0].url, 'https://example.com/a/b');
});

console.log(`\n${passed} passed${process.exitCode ? ', some failed' : ''}`);
