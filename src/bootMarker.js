// 引导标记 + 错误捕获：仅调试模式启用（设置「调试标记」或 URL 带 pv2_debug）。
// 位于打包产物最前端、任何模块副作用之前执行，用于定位 iOS 等无控制台环境的
// 注入失败/模块级崩溃。默认完全静默，零副作用。
(function () {
  'use strict';
  var DEBUG = false;
  try {
    if (/(^|[?&#])pv2_debug([&#]|$)/.test(location.search + '#' + location.hash)) {
      DEBUG = true;
    } else {
      var raw = null;
      try {
        var gfn = globalThis['GM_getValue'];
        if (typeof gfn === 'function') raw = gfn('pv2:debug', null);
      } catch (e) {}
      if (raw === null || raw === void 0) {
        try {
          raw = localStorage.getItem('popup-viewer:pv2:debug');
        } catch (e2) {}
      }
      DEBUG = raw === true || raw === 'true' || raw === '1';
    }
  } catch (e) {}
  if (!DEBUG) return;

  try {
    var d = document.createElement('div');
    d.textContent = '[PV2] boot v' + (typeof __PV2_VER__ !== 'undefined' ? __PV2_VER__ : '?');
    d.style.cssText =
      'position:fixed;top:12px;left:12px;z-index:2147483647;background:#7c3aed;color:#fff;padding:6px 12px;font-size:12px;border-radius:6px;font-family:sans-serif';
    (document.body || document.documentElement).appendChild(d);
  } catch (e) {}

  function pvShowErr(text) {
    try {
      var d2 = document.createElement('div');
      d2.textContent = text;
      d2.style.cssText =
        'position:fixed;top:44px;left:12px;z-index:2147483647;max-width:92vw;background:#dc2626;color:#fff;padding:8px 12px;font-size:12px;border-radius:6px;font-family:sans-serif;white-space:pre-wrap;word-break:break-all';
      (document.body || document.documentElement).appendChild(d2);
    } catch (e2) {}
  }

  window.onerror = function (msg, src, line, col, err) {
    var stack = '';
    try {
      if (err && err.stack) stack = String(err.stack).split('\n').slice(0, 3).join(' | ');
    } catch (e3) {}
    pvShowErr('[PV2] ERR: ' + msg + ' @' + line + ':' + col + (stack ? ' :: ' + stack : ''));
    return false;
  };
  window.addEventListener('unhandledrejection', function (e) {
    try {
      pvShowErr('[PV2] REJECT: ' + (e && e.reason && e.reason.message ? e.reason.message : e && e.reason));
    } catch (e4) {}
  });

  // 看门狗：2 秒后若初始化仍未执行，说明模块级崩溃且错误被管理器吞掉
  setTimeout(function () {
    try {
      if (!window.__PV2_INIT__) {
        pvShowErr('[PV2] 初始化未执行：模块级崩溃（被吞）。看右侧序号，最后一个序号所在模块即崩溃点');
      }
    } catch (e5) {}
  }, 2000);
})();
