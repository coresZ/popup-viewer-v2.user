// 回复草稿暂存（纯逻辑，无 DOM 依赖）。
// 按主帖 id 保存「正文 + 回复目标」：关窗、刷新阅读器、切到别的帖子再回来都能恢复；发送成功后清除。
// v2.3.1 起持久化到 GM 存储 / localStorage（键 popup-viewer:pv2:xDrafts），
// 页面刷新、关标签后也能恢复；最多保留 20 条、7 天过期，写入做 300ms 防抖。
import { gm } from '../utils/gm.js';

const DEFAULT_LIMIT = 20;
const STORAGE_KEY = 'pv2:xDrafts';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const SAVE_DELAY = 300;

/** 回复目标的最小快照：恢复时目标评论可能不在新加载的列表里，靠它还原「回复 @xxx」 */
export function targetSnapshot(model) {
  if (!model || !model.id) return null;
  const author = model.author || {};
  return {
    id: String(model.id),
    depth: model.depth,
    author: { id: author.id || '', name: author.name || '', handle: author.handle || '' }
  };
}

function loadPersisted(limit) {
  const map = new Map();
  let stored = [];
  try {
    stored = gm.getValue(STORAGE_KEY, []);
  } catch {
    stored = [];
  }
  if (typeof stored === 'string') {
    try {
      stored = JSON.parse(stored);
    } catch {
      stored = [];
    }
  }
  if (!Array.isArray(stored)) return map;
  const now = Date.now();
  for (const item of stored) {
    if (!item || !item.id || !item.text || !String(item.text).trim()) continue;
    if (item.ts && now - Number(item.ts) > MAX_AGE) continue;
    map.set(String(item.id), {
      text: String(item.text),
      target: item.target || null,
      ts: Number(item.ts) || now
    });
  }
  while (map.size > limit) map.delete(map.keys().next().value);
  return map;
}

export function createDraftStore(limit = DEFAULT_LIMIT) {
  // 懒加载：非 X 页面不读取 GM 存储，避免所有站点初始化时都为 X 草稿做一次同步读取。
  let drafts = null;
  const store = () => {
    if (!drafts) drafts = loadPersisted(limit);
    return drafts;
  };
  let saveTimer = 0;

  const saveNow = () => {
    saveTimer = 0;
    try {
      const list = [];
      for (const [id, draft] of store()) list.push({ id, text: draft.text, target: draft.target, ts: draft.ts || Date.now() });
      gm.setValue(STORAGE_KEY, list);
    } catch {
      // 存储失败不影响会话内草稿；下次输入会再试
    }
  };
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DELAY);
  };

  return {
    /** @returns {{text:string,target:Object|null}|null} */
    get(focalId) {
      const draft = store().get(String(focalId || ''));
      return draft ? { text: draft.text, target: draft.target } : null;
    },
    /** 正文为空就删除（只选了回复目标、没写字不算草稿） */
    set(focalId, text, target = null) {
      const key = String(focalId || '');
      if (!key) return;
      const value = String(text || '');
      const map = store();
      map.delete(key);
      if (!value.trim()) {
        scheduleSave();
        return;
      }
      map.set(key, { text: value, target: target ? targetSnapshot(target) : null, ts: Date.now() });
      while (map.size > limit) map.delete(map.keys().next().value);
      scheduleSave();
    },
    clear(focalId) {
      store().delete(String(focalId || ''));
      scheduleSave();
    },
    get size() {
      return store().size;
    }
  };
}

/** 全局共用的一份：加载器每次 load 都是新闭包，草稿必须活在模块级 */
export const replyDrafts = createDraftStore();
