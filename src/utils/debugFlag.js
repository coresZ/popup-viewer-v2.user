// 调试模式开关：设置面板「调试标记」（存 pv2:debug）或 URL 带 pv2_debug 时启用。
// 本模块不得依赖其它模块（模块加载标记自身也要用它），GM API 经 globalThis 安全探测。
let _cached = null;

export function debugEnabled() {
  if (_cached !== null) return _cached;
  _cached = false;
  try {
    if (/(^|[?&#])pv2_debug([&#]|$)/.test(location.search + '#' + location.hash)) {
      _cached = true;
    } else {
      let raw = null;
      try {
        const fn = globalThis['GM_getValue'];
        if (typeof fn === 'function') raw = fn('pv2:debug', null);
      } catch (e) {}
      if (raw === null || raw === undefined) {
        try {
          raw = localStorage.getItem('popup-viewer:pv2:debug');
        } catch (e2) {}
      }
      _cached = raw === true || raw === 'true' || raw === '1';
    }
  } catch (e) {}
  return _cached;
}

function badge(text, top, color) {
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText =
    'position:fixed;top:' + top + 'px;left:12px;z-index:2147483647;max-width:92vw;background:' + color +
    ';color:#fff;padding:6px 12px;font-size:12px;border-radius:6px;font-family:sans-serif;white-space:pre-wrap;word-break:break-all';
  (document.body || document.documentElement).appendChild(d);
}

/** 橙色状态标记（init ok / skipped / 错误等） */
export function debugMark(msg) {
  if (!debugEnabled()) return;
  try {
    badge('[PV2] ' + msg, 76, '#b45309');
  } catch (e) {}
}

/** 红色错误标记（含错误栈前几帧，便于定位） */
export function showErr(name, err) {
  if (!debugEnabled()) return;
  try {
    let msg = err && err.message ? err.message : String(err);
    if (err && err.stack) {
      msg += ' :: ' + String(err.stack).split('\n').slice(0, 3).join(' <- ');
    }
    badge('[PV2] ' + name + ' ERR: ' + msg, 108, '#dc2626');
  } catch (e) {}
}

/** 模块加载序号标记（页面右侧，用于定位模块级崩溃） */
let modSeq = 0;
export function markMod(name) {
  if (!debugEnabled()) return;
  try {
    modSeq++;
    const d = document.createElement('div');
    d.textContent = modSeq + '. ' + name;
    d.style.cssText =
      'position:fixed;top:' + (12 + (modSeq - 1) * 22) + 'px;right:12px;z-index:2147483647;background:#334155;color:#fff;padding:2px 8px;font-size:11px;border-radius:4px;font-family:sans-serif';
    (document.body || document.documentElement).appendChild(d);
  } catch (e) {}
}
