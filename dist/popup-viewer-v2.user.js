// ==UserScript==
// @name          页内弹窗打开新帖
// @namespace     http://tampermonkey.net/
// @version       2.3.7
// @description   点击论坛帖子链接，在弹窗中加载内容 (插件化架构 V2)
// @author        cores
// @include       *://*/*
// @grant         GM_xmlhttpRequest
// @grant         GM_addStyle
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_registerMenuCommand
// @grant         unsafeWindow
// @connect       *
// @run-at        document-idle
// @license       MIT
// ==/UserScript==


(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/bootMarker.js
  (function() {
    "use strict";
    var DEBUG = false;
    try {
      if (/(^|[?&#])pv2_debug([&#]|$)/.test(location.search + "#" + location.hash)) {
        DEBUG = true;
      } else {
        var raw = null;
        try {
          var gfn = globalThis["GM_getValue"];
          if (typeof gfn === "function") raw = gfn("pv2:debug", null);
        } catch (e) {
        }
        if (raw === null || raw === void 0) {
          try {
            raw = localStorage.getItem("popup-viewer:pv2:debug");
          } catch (e2) {
          }
        }
        DEBUG = raw === true || raw === "true" || raw === "1";
      }
    } catch (e) {
    }
    if (!DEBUG) return;
    try {
      var d = document.createElement("div");
      d.textContent = "[PV2] boot v" + (true ? "2.3.7" : "?");
      d.style.cssText = "position:fixed;top:12px;left:12px;z-index:2147483647;background:#7c3aed;color:#fff;padding:6px 12px;font-size:12px;border-radius:6px;font-family:sans-serif";
      (document.body || document.documentElement).appendChild(d);
    } catch (e) {
    }
    function pvShowErr(text) {
      try {
        var d2 = document.createElement("div");
        d2.textContent = text;
        d2.style.cssText = "position:fixed;top:44px;left:12px;z-index:2147483647;max-width:92vw;background:#dc2626;color:#fff;padding:8px 12px;font-size:12px;border-radius:6px;font-family:sans-serif;white-space:pre-wrap;word-break:break-all";
        (document.body || document.documentElement).appendChild(d2);
      } catch (e2) {
      }
    }
    window.onerror = function(msg, src, line, col, err) {
      var stack = "";
      try {
        if (err && err.stack) stack = String(err.stack).split("\n").slice(0, 3).join(" | ");
      } catch (e3) {
      }
      pvShowErr("[PV2] ERR: " + msg + " @" + line + ":" + col + (stack ? " :: " + stack : ""));
      return false;
    };
    window.addEventListener("unhandledrejection", function(e) {
      try {
        pvShowErr("[PV2] REJECT: " + (e && e.reason && e.reason.message ? e.reason.message : e && e.reason));
      } catch (e4) {
      }
    });
    setTimeout(function() {
      try {
        if (!window.__PV2_INIT__) {
          pvShowErr("[PV2] 初始化未执行：模块级崩溃（被吞）。看右侧序号，最后一个序号所在模块即崩溃点");
        }
      } catch (e5) {
      }
    }, 2e3);
  })();

  // src/config.js
  var config = {
    popup: {
      // 窗体大小预设（可在设置面板切换）
      sizes: {
        small: { width: "40%", height: "60%" },
        medium: { width: "50%", height: "75%" },
        large: { width: "72%", height: "90%" },
        phone: { width: "min(92vw, 400px)", height: "min(85vh, 720px)" }
      },
      defaultSize: "medium",
      scrollbarVisible: true
    },
    // 手机模式预置（尺寸 + 对应移动端 UA，仅影响抓取加载路径）
    phone: {
      sizes: {
        "iphone": {
          label: "iPhone",
          width: "393px",
          height: "852px",
          ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        },
        "iphone-max": {
          label: "Max",
          width: "430px",
          height: "932px",
          ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        },
        "android": {
          label: "安卓",
          width: "412px",
          height: "915px",
          ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
        },
        "small": {
          label: "小屏",
          width: "360px",
          height: "780px",
          ua: "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        }
      },
      defaultModel: "iphone"
    },
    loader: {
      timeout: 15e3,
      // 默认加载方式: 'auto' | 'iframe' | 'request' | 'parser'
      defaultMode: "auto"
    },
    cache: {
      enabled: true,
      ttl: 30 * 60 * 1e3,
      // 30 分钟
      maxEntries: 50
    },
    prefetch: {
      enabled: true,
      hoverDebounceMs: 150
      // 悬停后延迟开始预热，避免鼠标扫过列表时频繁请求
    },
    observer: {
      debounceMs: 300
    },
    // 站点加载策略:
    //   iframe: true  → 使用 iframe 直接加载（页面自带脚本与登录态）
    //   scripts: true → 请求模式下保留目标页 <script> 以正常渲染（仅限信任站点）
    //   xThread: true → 走 X 专用 GraphQL 原生渲染（仅 X 页面注册加载器）
    sitePolicy: {
      "linux.do": { iframe: true, scripts: true },
      // X：内容由客户端 React 渲染，抓取净化拿不到帖子（评论为空）；iframe 又被 X 的框架策略
      // 全站拒绝——含同源，裸 iframe 实测同样白屏。故改为用当前登录会话读内部 GraphQL 自渲染。
      "x.com": { xThread: true },
      "twitter.com": { xThread: true },
      "1cili.com": { iframe: false, scripts: true },
      "s.9cili.mom": { iframe: false, scripts: true },
      unknown: { iframe: false, scripts: false }
    },
    storage: {
      historyKey: "pv2:history",
      favoritesKey: "pv2:favorites"
    },
    maxHistoryEntries: 100,
    ui: {
      // 外壳挂进 Shadow DOM（隔离宿主网站 CSS）；false = 退回 v2.2 的页面内挂载
      shadow: true
    }
  };

  // src/utils/logger.js
  var PREFIX = "[PopupViewer]";
  function configDebug() {
    try {
      return location.search.includes("pv2_debug");
    } catch {
      return false;
    }
  }
  var logger = {
    log(...args) {
      if (configDebug()) console.log(PREFIX, ...args);
    },
    warn(...args) {
      console.warn(PREFIX, ...args);
    },
    error(...args) {
      console.error(PREFIX, ...args);
    },
    debug(...args) {
      if (configDebug()) console.debug(PREFIX, ...args);
    }
  };

  // src/utils/debounce.js
  function debounce(fn, wait = 300, { leading = false } = {}) {
    let timer = null;
    let lastInvoke = 0;
    const wrapper = (...args) => {
      const now = Date.now();
      if (leading && now - lastInvoke > wait) {
        lastInvoke = now;
        return fn.apply(this, args);
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        lastInvoke = Date.now();
        fn.apply(this, args);
      }, wait);
    };
    wrapper.cancel = () => clearTimeout(timer);
    return wrapper;
  }

  // src/utils/debugFlag.js
  var _cached = null;
  function debugEnabled() {
    if (_cached !== null) return _cached;
    _cached = false;
    try {
      if (/(^|[?&#])pv2_debug([&#]|$)/.test(location.search + "#" + location.hash)) {
        _cached = true;
      } else {
        let raw = null;
        try {
          const fn = globalThis["GM_getValue"];
          if (typeof fn === "function") raw = fn("pv2:debug", null);
        } catch (e) {
        }
        if (raw === null || raw === void 0) {
          try {
            raw = localStorage.getItem("popup-viewer:pv2:debug");
          } catch (e2) {
          }
        }
        _cached = raw === true || raw === "true" || raw === "1";
      }
    } catch (e) {
    }
    return _cached;
  }
  function badge(text, top, color) {
    const d = document.createElement("div");
    d.textContent = text;
    d.style.cssText = "position:fixed;top:" + top + "px;left:12px;z-index:2147483647;max-width:92vw;background:" + color + ";color:#fff;padding:6px 12px;font-size:12px;border-radius:6px;font-family:sans-serif;white-space:pre-wrap;word-break:break-all";
    (document.body || document.documentElement).appendChild(d);
  }
  function debugMark(msg) {
    if (!debugEnabled()) return;
    try {
      badge("[PV2] " + msg, 76, "#b45309");
    } catch (e) {
    }
  }
  function showErr(name, err) {
    if (!debugEnabled()) return;
    try {
      let msg = err && err.message ? err.message : String(err);
      if (err && err.stack) {
        msg += " :: " + String(err.stack).split("\n").slice(0, 3).join(" <- ");
      }
      badge("[PV2] " + name + " ERR: " + msg, 108, "#dc2626");
    } catch (e) {
    }
  }
  var modSeq = 0;
  function markMod(name) {
    if (!debugEnabled()) return;
    try {
      modSeq++;
      const d = document.createElement("div");
      d.textContent = modSeq + ". " + name;
      d.style.cssText = "position:fixed;top:" + (12 + (modSeq - 1) * 22) + "px;right:12px;z-index:2147483647;background:#334155;color:#fff;padding:2px 8px;font-size:11px;border-radius:4px;font-family:sans-serif";
      (document.body || document.documentElement).appendChild(d);
    } catch (e) {
    }
  }

  // src/core/EventBus.js
  markMod("EventBus");
  var EventBus = class {
    constructor() {
      this._handlers = /* @__PURE__ */ new Map();
    }
    on(event, handler) {
      if (!this._handlers.has(event)) this._handlers.set(event, /* @__PURE__ */ new Set());
      this._handlers.get(event).add(handler);
      return () => this.off(event, handler);
    }
    once(event, handler) {
      const off = this.on(event, (...args) => {
        off();
        handler(...args);
      });
      return off;
    }
    off(event, handler) {
      var _a;
      (_a = this._handlers.get(event)) == null ? void 0 : _a.delete(handler);
    }
    emit(event, payload) {
      const handlers = this._handlers.get(event);
      if (!handlers) return;
      handlers.forEach((h) => {
        try {
          h(payload, event);
        } catch (err) {
          console.error(`[EventBus] handler error for "${event}"`, err);
        }
      });
    }
    clear(event) {
      if (event) this._handlers.delete(event);
      else this._handlers.clear();
    }
  };
  var eventBus = new EventBus();

  // src/security/UrlResolver.js
  markMod("UrlResolver");
  var UrlResolver = class {
    constructor(base = window.location.href) {
      this.base = base;
    }
    /**
     * 将任意 href 解析为绝对 URL，无法解析时返回 null。
     */
    resolve(href) {
      if (!href || typeof href !== "string") return null;
      try {
        return new URL(href, this.base).href;
      } catch {
        return null;
      }
    }
    /**
     * 是否为当前页面内的锚点跳转（#xxx），这类点击不应拦截。
     */
    isSamePageAnchor(href) {
      const resolved = this.resolve(href);
      if (!resolved) return false;
      try {
        const current = new URL(this.base);
        const target = new URL(resolved);
        return target.origin === current.origin && target.pathname === current.pathname && !!target.hash && target.href !== current.href;
      } catch {
        return false;
      }
    }
    /**
     * 是否为可安全加载的 http(s) 地址。
     */
    isHttpUrl(href) {
      const resolved = this.resolve(href);
      if (!resolved) return false;
      return /^https?:$/i.test(new URL(resolved).protocol);
    }
    /**
     * 是否禁止拦截的危险协议（javascript:、data:、vbscript: 等）。
     */
    isDangerous(href) {
      if (!href) return false;
      const scheme = String(href).trim().split(":")[0].toLowerCase();
      return ["javascript", "data", "vbscript", "file"].includes(scheme);
    }
  };
  var urlResolver = new UrlResolver();

  // src/utils/gm.js
  function gmApi(name) {
    try {
      const fn = globalThis[name];
      return typeof fn === "function" ? fn : null;
    } catch {
      return null;
    }
  }
  function injectStyle(css) {
    const style = document.createElement("style");
    style.type = "text/css";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    return style;
  }
  function adoptStyle(css) {
    try {
      if (typeof CSSStyleSheet !== "function" || !("adoptedStyleSheets" in document)) return null;
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      return sheet;
    } catch (err) {
      console.warn("[PopupViewer] adoptedStyleSheets failed", err);
      return null;
    }
  }
  function localGet(key, fallback) {
    try {
      const raw = localStorage.getItem("popup-viewer:" + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  function localSet(key, value) {
    try {
      localStorage.setItem("popup-viewer:" + key, JSON.stringify(value));
    } catch {
    }
  }
  var gm = {
    /** 油猴菜单命令；无 GM 环境时返回 false（调用方保留悬浮齿轮作为入口）。 */
    registerMenuCommand(caption, onClick) {
      const fn = gmApi("GM_registerMenuCommand");
      if (!fn) return false;
      try {
        fn(caption, onClick);
        return true;
      } catch {
        return false;
      }
    },
    addStyle(css) {
      let node = null;
      const fn = gmApi("GM_addStyle");
      if (fn) {
        try {
          node = fn(css);
        } catch (err) {
          console.warn("[PopupViewer] GM_addStyle failed, fallback to <style>", err);
        }
      }
      if (!node) {
        try {
          node = injectStyle(css);
        } catch (err) {
          console.warn("[PopupViewer] injectStyle failed", err);
        }
      }
      adoptStyle(css);
      return node;
    },
    xmlhttpRequest(options) {
      const fn = gmApi("GM_xmlhttpRequest");
      if (fn) {
        const onTimeout = options.ontimeout || (options.onerror ? () => options.onerror({ timeout: true, error: "请求超时" }) : void 0);
        return fn({
          timeout: options.timeout || 15e3,
          ...options,
          ontimeout: onTimeout
        });
      }
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), options.timeout || 15e3) : null;
      const clearTimer = () => {
        if (timer) clearTimeout(timer);
      };
      const promise = fetch(options.url, {
        method: options.method || "GET",
        signal: controller ? controller.signal : void 0
      }).then(async (res) => {
        var _a;
        clearTimer();
        (_a = options.onload) == null ? void 0 : _a.call(options, {
          status: res.status,
          statusText: res.statusText,
          responseText: await res.text(),
          finalUrl: res.url
        });
      }).catch((err) => {
        var _a, _b;
        clearTimer();
        if (aborted) return;
        if (err && err.name === "AbortError") (_a = options.onerror) == null ? void 0 : _a.call(options, { timeout: true, error: "请求超时" });
        else (_b = options.onerror) == null ? void 0 : _b.call(options, err);
      });
      let aborted = false;
      if (controller)
        promise.abort = () => {
          aborted = true;
          controller.abort();
        };
      return promise;
    },
    getValue(key, fallback) {
      const fn = gmApi("GM_getValue");
      if (fn) {
        try {
          return fn(key, fallback);
        } catch {
        }
      }
      return localGet(key, fallback);
    },
    setValue(key, value) {
      const fn = gmApi("GM_setValue");
      if (fn) {
        try {
          return fn(key, value);
        } catch {
        }
      }
      return localSet(key, value);
    }
  };

  // src/core/RulesManager.js
  var KEY = "pv2:rules";
  markMod("RulesManager");
  var RulesManager = class {
    constructor() {
      this.rules = {};
      this._loaded = false;
    }
    load() {
      if (this._loaded) return this.rules;
      this._loaded = true;
      const raw = gm.getValue(KEY, {});
      if (raw && typeof raw === "object") {
        this.rules = {};
        for (const [host, list] of Object.entries(raw)) {
          if (Array.isArray(list)) {
            this.rules[host] = list.filter((r) => r && typeof r.selector === "string" && r.selector.trim()).map((r) => r.disabled === true ? { selector: r.selector.trim(), disabled: true } : { selector: r.selector.trim() });
          }
        }
      }
      return this.rules;
    }
    getRules(hostname) {
      return this.load()[hostname] || [];
    }
    addRule(hostname, selector) {
      const rules = this.getRules(hostname);
      if (!rules.some((r) => r.selector === selector)) {
        rules.push({ selector });
        this.load()[hostname] = rules;
        this._persist();
      }
      return rules;
    }
    /** 修改规则（selector / disabled）。新选择器为空或与其它规则重复时返回 false。 */
    updateRule(hostname, index, patch) {
      const rules = this.getRules(hostname);
      const rule = rules[index];
      if (!rule) return false;
      if ("selector" in patch) {
        const sel = String(patch.selector || "").trim();
        if (!sel || rules.some((r, i) => i !== index && r.selector === sel)) return false;
        rule.selector = sel;
      }
      if ("disabled" in patch) {
        if (patch.disabled) rule.disabled = true;
        else delete rule.disabled;
      }
      this.load()[hostname] = rules;
      this._persist();
      return true;
    }
    /** 把规则插回指定位置（撤销删除用）。 */
    insertRule(hostname, index, rule) {
      const rules = this.getRules(hostname);
      if (!rule || rules.some((r) => r.selector === rule.selector)) return rules;
      rules.splice(Math.max(0, Math.min(index, rules.length)), 0, { ...rule });
      this.load()[hostname] = rules;
      this._persist();
      return rules;
    }
    /** 所有有规则的站点：[{ host, count, enabled }]，按条数降序。 */
    listHosts() {
      return Object.entries(this.load()).filter(([, list]) => Array.isArray(list) && list.length).map(([host, list]) => ({ host, count: list.length, enabled: list.filter((r) => !r.disabled).length })).sort((a, b) => b.count - a.count || a.host.localeCompare(b.host));
    }
    removeRule(hostname, index) {
      const rules = this.getRules(hostname);
      rules.splice(index, 1);
      this.load()[hostname] = rules;
      this._persist();
      return rules;
    }
    _persist() {
      gm.setValue(KEY, this.rules);
    }
    /**
     * 命中当前站点用户规则的链接。
     * @returns {{url:string,title:string,element:Element}|null}
     */
    match(event, hostname) {
      const rules = this.getRules(hostname);
      if (!rules.length) return null;
      const target = event.target;
      let clickedLink = null;
      try {
        clickedLink = target && target.closest ? target.closest("a[href]") : null;
      } catch {
      }
      for (const rule of rules) {
        if (!rule || rule.disabled) continue;
        let el2 = null;
        try {
          el2 = target && target.closest ? target.closest(rule.selector) : null;
        } catch {
          el2 = null;
        }
        if (!el2) continue;
        const link = this._extractLink(el2);
        if (!link) continue;
        if (clickedLink && clickedLink !== el2 && link.element !== clickedLink && el2.contains(clickedLink)) continue;
        return link;
      }
      return null;
    }
    _extractLink(el2) {
      const get = (a) => el2.getAttribute ? el2.getAttribute(a) : null;
      if (el2.tagName === "A") {
        const href = get("href");
        const url = this._resolve(href);
        if (url) return { url, title: el2.title || (el2.textContent || "").trim() || "查看内容", element: el2 };
      }
      const dataUrl = get("data-topic-url") || get("data-href");
      if (dataUrl) {
        const url = this._resolve(dataUrl);
        if (url) {
          return {
            url,
            title: el2.title || (el2.textContent || "").trim().slice(0, 60) || "查看内容",
            element: el2
          };
        }
      }
      const inner = el2.querySelector ? el2.querySelector("a[href]") : null;
      if (inner) {
        const url = this._resolve(inner.getAttribute("href"));
        if (url) return { url, title: inner.title || (inner.textContent || "").trim() || "查看内容", element: inner };
      }
      const outer = el2.closest ? el2.closest("a[href]") : null;
      if (outer) {
        const url = this._resolve(outer.getAttribute("href"));
        if (url) return { url, title: outer.title || (outer.textContent || "").trim() || "查看内容", element: outer };
      }
      return null;
    }
    _resolve(href) {
      if (!href || typeof href !== "string") return null;
      try {
        return new URL(href, window.location.href).href;
      } catch {
        return null;
      }
    }
  };
  var rulesManager = new RulesManager();

  // src/utils/dom.js
  var ICON_PATHS = {
    article: {
      path: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>'
    },
    close: { path: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' },
    plus: { path: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>' },
    minus: { path: '<line x1="5" y1="12" x2="19" y2="12"></line>' },
    info: {
      path: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
    },
    smartphone: {
      path: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line>'
    },
    external: {
      path: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>'
    },
    refresh: {
      path: '<path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>'
    },
    maximize: {
      path: '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>'
    },
    minimize: {
      path: '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line>'
    },
    arrowLeft: {
      path: '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>'
    },
    arrowRight: {
      path: '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>'
    },
    // 图片切换用的细箭头（无杆，X 灯箱左右两侧的样式）
    chevronLeft: {
      path: '<polyline points="15 18 9 12 15 6"></polyline>'
    },
    chevronRight: {
      path: '<polyline points="9 18 15 12 9 6"></polyline>'
    },
    resize: {
      path: '<polyline points="7 17 17 7"></polyline><line x1="10" y1="17" x2="17" y2="17"></line><line x1="17" y1="10" x2="17" y2="17"></line>'
    },
    settings: {
      path: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'
    }
  };
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === void 0) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    for (const child of children.flat()) {
      if (child == null) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }
  function svg(inner, attrs = {}) {
    const ns = "http://www.w3.org/2000/svg";
    const node = document.createElementNS(ns, "svg");
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("fill", "none");
    node.setAttribute("stroke", "currentColor");
    node.setAttribute("stroke-width", "2");
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    const holder = document.createElement("div");
    holder.innerHTML = inner.trim();
    moveSvgChildren(node, holder);
    return node;
  }
  function moveSvgChildren(svgParent, container) {
    for (const child of [...container.childNodes]) {
      if (child.nodeType !== 1) continue;
      const el2 = document.createElementNS(svgParent.namespaceURI, child.localName);
      for (const attr of [...child.attributes]) el2.setAttribute(attr.name, attr.value);
      moveSvgChildren(el2, child);
      svgParent.appendChild(el2);
    }
  }
  function svgIcon(iconName, { size = 18 } = {}) {
    const icon = ICON_PATHS[iconName];
    if (!icon) return svg("", { width: size, height: size });
    const node = svg(icon.path, { width: size, height: size });
    for (const [key, value] of Object.entries(icon.attrs || {})) node.setAttribute(key, value);
    return node;
  }
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }
  function hijacksFixed(node) {
    if (!node) return false;
    try {
      const cs = getComputedStyle(node);
      if (cs.transform && cs.transform !== "none") return true;
      if (cs.filter && cs.filter !== "none") return true;
      if (cs.perspective && cs.perspective !== "none") return true;
      if (cs.willChange && cs.willChange.includes("transform")) return true;
      if (cs.contain && /paint|layout|strict|content/.test(cs.contain)) return true;
    } catch (err) {
      return false;
    }
    return false;
  }
  function pickMountPoint() {
    const body = document.body;
    const html = document.documentElement;
    if (body && !hijacksFixed(body)) return body;
    if (html && !hijacksFixed(html)) return html;
    return body || html;
  }
  var uiShadowRoot = null;
  function setUiRoot(root) {
    uiShadowRoot = root || null;
  }
  function uiRoot() {
    return uiShadowRoot;
  }
  function uiQuery(selector) {
    return (uiShadowRoot || document).querySelector(selector);
  }
  function mountUi(node) {
    if (uiShadowRoot) {
      uiShadowRoot.appendChild(node);
      return uiShadowRoot;
    }
    const parent = pickMountPoint();
    if (parent) parent.appendChild(node);
    return parent;
  }
  function eventPath(event) {
    if (event && typeof event.composedPath === "function") {
      const path = event.composedPath();
      if (path && path.length) return path;
    }
    const out = [];
    for (let node = event && event.target; node; node = node.parentNode || node.host) out.push(node);
    return out;
  }
  function eventTarget(event) {
    for (const node of eventPath(event)) if (node && node.nodeType === 1) return node;
    return event ? event.target : null;
  }
  function closestInPath(event, selector) {
    for (const node of eventPath(event)) {
      if (node && node.nodeType === 1 && typeof node.matches === "function") {
        try {
          if (node.matches(selector)) return node;
        } catch {
          return null;
        }
      }
    }
    return null;
  }
  var EDITABLE_INPUT_TYPES = /^(text|search|email|url|tel|password|number|date|datetime-local|month|time|week)$/i;
  function isEditableElement(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = node.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") return EDITABLE_INPUT_TYPES.test(node.type || "text");
    return node.isContentEditable === true;
  }
  function isEditableEvent(event) {
    return isEditableElement(eventTarget(event));
  }
  function deepActiveElement() {
    let node = document.activeElement;
    while (node && node.shadowRoot && node.shadowRoot.activeElement) node = node.shadowRoot.activeElement;
    return node;
  }
  function isOwnUiNode(node) {
    var _a;
    if (!node || node.nodeType !== 1) return false;
    if (uiShadowRoot && (((_a = node.getRootNode) == null ? void 0 : _a.call(node)) === uiShadowRoot || node === uiShadowRoot.host)) return true;
    try {
      return !!node.closest('[id^="popup-"], [id^="pv-"], [id^="pv2-"]');
    } catch {
      return false;
    }
  }

  // src/core/SiteManager.js
  markMod("SiteManager");
  var SiteManager = class {
    constructor() {
      this.adapters = [];
    }
    register(adapter) {
      this.adapters.push(adapter);
      return adapter;
    }
    activeAdapters(hostname, pathname) {
      return this.adapters.filter((a) => a.match(hostname, pathname));
    }
    /**
     * 解析点击/悬停目标是否为可打开的链接。
     * 不修改事件，供点击拦截与悬停预热共用。
     * @returns {{url:string,title:string,element:Element}|null}
     */
    resolveCandidate(event) {
      if (isOwnUiNode(eventTarget(event)) || isOwnUiNode(event.target)) return null;
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;
      const ruleHit = rulesManager.match(event, hostname);
      if (ruleHit) {
        const { url, title, element } = ruleHit;
        if (url && urlResolver.isHttpUrl(url) && !urlResolver.isDangerous(url) && !urlResolver.isSamePageAnchor(url)) {
          return { url, title: title || "查看内容", element };
        }
      }
      for (const adapter of this.activeAdapters(hostname, pathname)) {
        let parsed;
        try {
          parsed = adapter.parseClick(event);
        } catch (err) {
          logger.error(`[${adapter.name}] parseClick error`, err);
          continue;
        }
        if (!parsed || !parsed.url) continue;
        const url = urlResolver.resolve(parsed.url);
        if (!url || !urlResolver.isHttpUrl(url)) continue;
        if (urlResolver.isDangerous(parsed.url)) continue;
        if (urlResolver.isSamePageAnchor(url)) return null;
        return { url, title: parsed.title || "查看内容", element: parsed.element };
      }
      return null;
    }
    /**
     * 全局链接点击入口（capture 阶段）。
     * @returns {boolean} 是否已处理
     */
    handleClick(event) {
      if (event.defaultPrevented) return false;
      const candidate = this.resolveCandidate(event);
      if (!candidate) return false;
      event.preventDefault();
      event.stopPropagation();
      logger.debug(`opening ${candidate.title} -> ${candidate.url}`);
      eventBus.emit("open-page", { url: candidate.url, title: candidate.title, element: candidate.element });
      return true;
    }
    /**
     * 对当前页面执行所有适配器的视觉增强。
     */
    runEnhancements() {
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;
      for (const adapter of this.activeAdapters(hostname, pathname)) {
        try {
          adapter.enhance(document, hostname, pathname);
        } catch (err) {
          logger.error(`[${adapter.name}] enhance error`, err);
        }
      }
    }
  };
  var siteManager = new SiteManager();

  // src/security/Sandbox.js
  var Sandbox = class {
    constructor(policy = {}) {
      this.policy = policy;
    }
    /**
     * 获取站点策略，未知站点回退到 unknown 策略。
     * 支持子域名匹配（如 www.1cili.com 命中 1cili.com 策略）。
     */
    policyFor(hostname) {
      if (!hostname) return this.policy.unknown || { iframe: false, scripts: false };
      if (this.policy[hostname]) return this.policy[hostname];
      for (const key of Object.keys(this.policy)) {
        if (key === "unknown") continue;
        if (hostname.endsWith("." + key)) return this.policy[key];
      }
      return this.policy.unknown || { iframe: false, scripts: false };
    }
    /**
     * 生成 sandbox 属性字符串。
     * scripts=true 时允许脚本执行；否则不包含 allow-scripts/allow-same-origin。
     */
    buildSandboxAttrs(hostname, extra = []) {
      const p = this.policyFor(hostname);
      const attrs = [
        "allow-forms",
        "allow-modals",
        "allow-pointer-lock",
        "allow-popups",
        // 允许弹窗/新标签页逃逸沙箱：右键「用 Google 搜索」等需在新标签页打开，
        // 否则会被加载进弹窗 iframe 内，被目标站 X-Frame-Options 拒绝
        "allow-popups-to-escape-sandbox",
        "allow-presentation"
      ];
      if (p.scripts) {
        attrs.push("allow-same-origin", "allow-scripts");
      }
      return [...attrs, ...extra].join(" ");
    }
    /**
     * 该站点是否允许直接 iframe 加载。
     */
    allowsIframe(hostname) {
      return this.policyFor(hostname).iframe === true;
    }
  };
  function createDefaultSandbox(policy) {
    return new Sandbox(policy);
  }
  function contentSandboxAttrs(keepScripts = false) {
    const attrs = [
      "allow-forms",
      "allow-modals",
      "allow-pointer-lock",
      "allow-popups",
      "allow-popups-to-escape-sandbox",
      "allow-presentation",
      "allow-same-origin"
    ];
    if (keepScripts) attrs.push("allow-scripts");
    return attrs.join(" ");
  }

  // src/core/SettingsManager.js
  var KEY2 = "pv2:settings";
  var SITE_KEY = "pv2:siteSettings";
  var GLOBAL_KEYS = ["theme", "allowInFrame", "handedness", "mobileResize"];
  function defaultGlobal() {
    return { theme: "auto", allowInFrame: false, handedness: "right", mobileResize: false, uiRev: 1 };
  }
  function defaultSite() {
    return {
      scrollbarVisible: config.popup.scrollbarVisible,
      panelSize: config.popup.defaultSize,
      windowMode: "coupled",
      linkIntercept: true,
      // 窗体内容里的链接在新标签页打开（原先与 linkIntercept 绑在一起，现已拆开）
      popupLinksNewTab: true,
      phoneModel: config.phone.defaultModel,
      phonePosition: null,
      customSize: null,
      locked: false
    };
  }
  function currentSiteKey() {
    try {
      return window.location.hostname || "unknown";
    } catch {
      return "unknown";
    }
  }
  markMod("SettingsManager");
  var SettingsManager = class {
    constructor() {
      this.global = defaultGlobal();
      this.site = defaultSite();
      this.siteKey = "unknown";
      this._loaded = false;
    }
    load() {
      if (this._loaded) return this.get();
      this._loaded = true;
      this.siteKey = currentSiteKey();
      const g = gm.getValue(KEY2, null);
      if (g && typeof g === "object") {
        this.global = { ...defaultGlobal(), ...g };
        if (g.uiRev !== 1) this.global.mobileResize = false;
      }
      const all = gm.getValue(SITE_KEY, null);
      if (all && typeof all === "object" && all[this.siteKey]) {
        const stored = all[this.siteKey];
        this.site = { ...defaultSite(), ...stored };
        if (!("popupLinksNewTab" in stored) && stored.linkIntercept === false) this.site.popupLinksNewTab = false;
      }
      if (!config.popup.sizes[this.site.panelSize] && this.site.panelSize !== "custom") {
        this.site.panelSize = defaultSite().panelSize;
      }
      if (!config.phone.sizes[this.site.phoneModel]) {
        this.site.phoneModel = defaultSite().phoneModel;
      }
      this._applyInvariants();
      return this.get();
    }
    /** 该设置键是否按站点保存（不在 GLOBAL_KEYS 里即为站点键）。 */
    isSiteKey(key) {
      return !GLOBAL_KEYS.includes(key);
    }
    /** 当前生效设置 = 全局 + 当前站点设置。 */
    get() {
      return { ...this.global, ...this.site };
    }
    set(partial) {
      for (const [key, value] of Object.entries(partial)) {
        if (GLOBAL_KEYS.includes(key)) this.global[key] = value;
        else this.site[key] = value;
      }
      this._applyInvariants();
      this._persist();
      return this.get();
    }
    reset() {
      this.global = defaultGlobal();
      this.site = defaultSite();
      this._applyInvariants();
      this._persist();
      return this.get();
    }
    _applyInvariants() {
      if (this.site.linkIntercept === false) this.site.windowMode = "float";
    }
    _persist() {
      gm.setValue(KEY2, this.global);
      const all = gm.getValue(SITE_KEY, null) || {};
      all[this.siteKey] = this.site;
      gm.setValue(SITE_KEY, all);
    }
  };
  var settingsManager = new SettingsManager();

  // src/security/Sanitizer.js
  markMod("Sanitizer");
  var REAL_SRC_ATTRS = [
    "zoomfile",
    "file",
    "data-src",
    "data-original",
    "data-lazy-src",
    "data-actualsrc",
    "data-src-real",
    "data-real-src",
    "data-url",
    "data-large",
    "data-big",
    "data-hd-src",
    "data-original-src",
    "data-echo",
    "data-lazyload",
    "data-lazy-load",
    "data-full",
    "data-img"
  ];
  var _Sanitizer = class _Sanitizer {
    constructor() {
      this.removedTags = /* @__PURE__ */ new Set([
        "script",
        "iframe",
        "frame",
        "frameset",
        "object",
        "embed",
        "applet",
        "form",
        "link",
        "meta",
        "base",
        "noscript"
      ]);
      this.dangerousEventAttrs = /^on[a-z]+$/i;
    }
    /**
     * 净化 HTML 字符串。
     * @param {string} html 原始 HTML
     * @param {string} [baseUrl] 用于绝对化样式链接
     * @param {Object} [options]
     * @param {boolean} [options.keepScripts=false] 保留 <script>（仅信任站点，需在沙箱 iframe 中渲染）
     * @returns {{head:string, body:string}} head 为保留的样式标签，body 为净化后的内容。
     */
    sanitize(html, baseUrl, options = {}) {
      if (!html) return { head: "", body: "" };
      const doc = new DOMParser().parseFromString(html, "text/html");
      const head = this._collectHead(doc, baseUrl);
      this._purge(doc, options);
      this._resolveLazyImages(doc, baseUrl);
      const title = (doc.title || "").trim().slice(0, 200);
      return { head, body: doc.body ? doc.body.innerHTML : "", title };
    }
    _resolveLazyImages(doc, baseUrl) {
      doc.querySelectorAll("img").forEach((img) => {
        const real = this._firstRealAttr(img);
        if (real) {
          const resolved = this._absolutize(real, baseUrl);
          if (resolved) img.setAttribute("src", resolved);
          this._clearRealAttrs(img);
          img.classList.remove("lazy");
          img.loading = "lazy";
          return;
        }
        if (this._resolveSrcset(img, baseUrl)) {
          this._clearRealAttrs(img);
          img.classList.remove("lazy");
          img.loading = "lazy";
        }
      });
    }
    _firstRealAttr(img) {
      for (const attr of REAL_SRC_ATTRS) {
        const value = img.getAttribute(attr);
        if (value && value.trim()) return value.trim();
      }
      return null;
    }
    _absolutize(value, baseUrl) {
      if (!value) return null;
      if (/^(javascript|vbscript|file):/i.test(value.trim())) return null;
      try {
        return new URL(value, baseUrl || void 0).href;
      } catch {
        return value;
      }
    }
    /**
     * 处理 data-srcset / data-original-set：绝对化并写回 srcset；
     * src 仍是占位图时用第一个候选作为兜底 src。返回是否处理过。
     */
    _resolveSrcset(img, baseUrl) {
      const raw = img.getAttribute("data-srcset") || img.getAttribute("data-original-set");
      if (!raw) return false;
      const absolute = raw.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
        const parts = entry.split(/\s+/);
        const url = parts[0];
        if (!url) return entry;
        try {
          return new URL(url, baseUrl || void 0).href + (parts.length > 1 ? " " + parts.slice(1).join(" ") : "");
        } catch {
          return entry;
        }
      });
      if (absolute.length) img.setAttribute("srcset", absolute.join(", "));
      img.removeAttribute("data-srcset");
      img.removeAttribute("data-original-set");
      const cur = (img.getAttribute("src") || "").trim();
      const first = absolute[0] ? absolute[0].split(/\s+/)[0] : null;
      if (first && (!cur || _Sanitizer.PLACEHOLDER_RE.test(cur))) img.setAttribute("src", first);
      return true;
    }
    _clearRealAttrs(img) {
      for (const attr of REAL_SRC_ATTRS) img.removeAttribute(attr);
    }
    /**
     * 收集原页面的样式（stylesheet 链接与 head 中的 <style> 块），
     * 并对样式链接做绝对化，避免因丢失 <base> 导致 CSS 404。
     * 样式链接可能位于 head 或 body（如淘股吧），需全文档收集。
     */
    _collectHead(doc, baseUrl) {
      const parts = [];
      const seen = /* @__PURE__ */ new Set();
      const pick = (node) => {
        const key = node.outerHTML;
        if (seen.has(key)) return;
        seen.add(key);
        const clone = node.cloneNode(true);
        if (clone.tagName === "LINK" && clone.getAttribute("href")) {
          try {
            clone.setAttribute("href", new URL(clone.getAttribute("href"), baseUrl).href);
          } catch {
          }
        }
        parts.push(clone.outerHTML);
      };
      doc.querySelectorAll("link[rel], head style").forEach((node) => {
        if (node.tagName === "LINK") {
          const rel = (node.getAttribute("rel") || "").toLowerCase();
          const href = (node.getAttribute("href") || "").toLowerCase();
          const isStyle = rel.includes("stylesheet") || href.endsWith(".css") || rel.includes("preload") && (node.getAttribute("as") || "").toLowerCase() === "style";
          if (!isStyle) return;
        }
        pick(node);
      });
      return parts.join("");
    }
    _purge(doc, { keepScripts = false } = {}) {
      var _a;
      const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
      const toRemove = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeType === Node.COMMENT_NODE) {
          toRemove.push(node);
          continue;
        }
        const tag = node.tagName ? node.tagName.toLowerCase() : "";
        const isScript = tag === "script";
        if (this.removedTags.has(tag) && !(keepScripts && isScript)) {
          toRemove.push(node);
          continue;
        }
        this._sanitizeAttrs(node);
      }
      for (const node of toRemove) (_a = node.parentNode) == null ? void 0 : _a.removeChild(node);
    }
    _sanitizeAttrs(node) {
      const attrs = node.attributes;
      if (!attrs || !attrs.length) return;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const name = attrs[i].name.toLowerCase();
        const value = attrs[i].value;
        if (this.dangerousEventAttrs.test(name)) {
          node.removeAttribute(attrs[i].name);
          continue;
        }
        if (name === "srcdoc") {
          node.removeAttribute(attrs[i].name);
          continue;
        }
        if (name === "href" || name === "xlink:href") {
          const scheme = String(value).trim().split(":")[0].toLowerCase();
          if (["javascript", "data", "vbscript", "file"].includes(scheme)) {
            node.removeAttribute(attrs[i].name);
          }
        }
        if (name === "src" || name === "poster" || name === "background") {
          const scheme = String(value).trim().split(":")[0].toLowerCase();
          if (["javascript", "vbscript", "file"].includes(scheme)) {
            node.removeAttribute(attrs[i].name);
          }
        }
      }
    }
  };
  /**
   * 解析懒加载图片：真实地址常放在 data-original/data-src/data-srcset 等各类 data 属性里，
   * src 多为占位图（懒加载 JS 被净化后不会执行）。只要找到真实地址就换到 src 并绝对化，
   * 不依赖对「占位图文件名」的精确识别——各站点占位图命名千差万别，正则穷举必然漏。
   */
  __publicField(_Sanitizer, "PLACEHOLDER_RE", /^(data:|about:|blob:)/i);
  var Sanitizer = _Sanitizer;
  var sanitizer = new Sanitizer();

  // src/loaders/IframeRenderer.js
  function readIframeLocation(iframe) {
    try {
      const win = iframe.contentWindow;
      if (!win || !win.location || !win.location.href) return null;
      const href = win.location.href;
      if (!href || href === "about:blank") return null;
      let title = "";
      try {
        title = iframe.contentDocument && iframe.contentDocument.title || "";
      } catch (e) {
      }
      return { url: href, title };
    } catch (e) {
      return null;
    }
  }
  function renderIntoIframe({ html, url, container, sandboxAttrs, head = "", title = "", linkIntercept, loadingSelector = "#popup-panel-loading", onNavigate }) {
    var _a;
    (_a = container.querySelector(loadingSelector)) == null ? void 0 : _a.remove();
    container.classList.add("iframe-direct-load");
    const iframe = el("iframe", {
      id: "popup-panel-iframe",
      sandbox: sandboxAttrs
    });
    try {
      iframe.contentWindow.__PV2_OWN_IFRAME__ = true;
    } catch {
    }
    iframe.style.cssText = "width:100%;height:100%;border:none;background:#fff;";
    container.appendChild(iframe);
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(buildDocument(html, url, head, title));
    iframeDoc.close();
    const runFixes = () => {
      if (!iframe.isConnected || !iframe.contentWindow) return;
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        fixLinks(doc, linkIntercept);
        injectReadStyle(doc);
        fixImages(doc);
      } catch (err) {
        logger.error("[renderIntoIframe] manipulate error", err);
      }
    };
    let firstLoad = true;
    iframe.addEventListener("load", () => {
      runFixes();
      if (firstLoad) {
        firstLoad = false;
        return;
      }
      if (onNavigate) {
        const loc = readIframeLocation(iframe);
        if (loc && !isHostDocumentUrl(loc.url)) onNavigate(loc.url, loc.title);
      }
    });
    if (iframeDoc.readyState === "complete") iframe.dispatchEvent(new Event("load"));
    [1500, 3500].forEach((delay) => setTimeout(runFixes, delay));
    return iframe;
  }
  function isHostDocumentUrl(href) {
    try {
      return String(href).split("#")[0] === String(window.location.href).split("#")[0];
    } catch {
      return false;
    }
  }
  function escapeHtml(text) {
    return String(text || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  }
  function buildDocument(html, url, head = "", title = "") {
    const baseHref = buildBaseHref(url);
    return '<!DOCTYPE html><html><head><base href="' + escapeHtml(baseHref) + '"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + escapeHtml(title) + "</title>" + head + "</head><body>" + html + "</body></html>";
  }
  function buildBaseHref(url) {
    try {
      const u = new URL(url);
      let base = u.origin ? u.origin + u.pathname : u.pathname;
      if (!/\.[a-z0-9]+$/i.test(u.pathname) && !u.pathname.endsWith("/")) base += "/";
      return base;
    } catch {
      return url;
    }
  }
  function popupLinksOpenNewTab(explicit) {
    if (explicit !== void 0) return explicit;
    return settingsManager.get().popupLinksNewTab !== false;
  }
  function fixLinks(iframeDoc, linkIntercept) {
    const openNewTab = popupLinksOpenNewTab(linkIntercept);
    iframeDoc.querySelectorAll("a[href]").forEach((link) => {
      if (openNewTab) link.target = "_blank";
      const href = link.getAttribute("href");
      if (!href || href.trim().startsWith("javascript:")) return;
      try {
        link.href = new URL(href, iframeDoc.baseURI).href;
      } catch {
      }
    });
  }
  function injectReadStyle(iframeDoc) {
    const style = iframeDoc.createElement("style");
    style.textContent = "body{font-family:Segoe UI,sans-serif;padding:10px;word-wrap:break-word;overflow-wrap:break-word;overscroll-behavior:contain;}img,video,iframe{max-width:100%;height:auto;}a{color:#007bff;text-decoration:none;}a:hover{text-decoration:underline;}a:visited{color:#6a0dad;}";
    iframeDoc.head.insertBefore(style, iframeDoc.head.firstChild);
  }
  function fixImages(iframeDoc) {
    iframeDoc.querySelectorAll("img").forEach((img) => {
      img.loading = "eager";
      const cur = img.getAttribute("src") || "";
      const isPlaceholderSrc = !cur || /(?:none|placeholder|loading|blank|spacer|1x1|pixel)(?:\.gif|\.png|\.jpg|\.jpeg|\.webp)?$/i.test(cur);
      if (isPlaceholderSrc || img.complete && img.naturalWidth === 0) {
        for (const attr of REAL_SRC_ATTRS) {
          const value = img.getAttribute(attr);
          if (value && value.trim()) {
            try {
              img.src = new URL(value.trim(), iframeDoc.baseURI).href;
            } catch {
              img.src = value.trim();
            }
            img.removeAttribute(attr);
            break;
          }
        }
      }
      const dsrcset = img.getAttribute("data-srcset") || img.getAttribute("data-original-set");
      if (dsrcset) {
        const first = dsrcset.split(",")[0].trim().split(/\s+/)[0];
        if (first) {
          try {
            img.src = new URL(first, iframeDoc.baseURI).href;
          } catch {
            img.src = first;
          }
        }
        img.removeAttribute("data-srcset");
        img.removeAttribute("data-original-set");
      }
      if (img.complete && img.naturalWidth === 0 && img.src && !/^data:/i.test(img.src)) {
        const s = img.src;
        img.src = "";
        img.src = s;
      }
    });
  }

  // src/loaders/IframeLoader.js
  var IframeLoader = class {
    constructor(sandbox) {
      this.sandbox = sandbox;
    }
    load({ url, hostname, container, onError, onLoad, mobileUA = null, loadingSelector = "#popup-panel-loading", onNavigate }) {
      var _a;
      logger.debug(`[IframeLoader] direct load ${url}`);
      if (mobileUA) {
        logger.debug("[IframeLoader] 直接 iframe 无法设置移动端 UA：" + url);
      }
      const iframe = el("iframe", {
        id: "popup-panel-iframe",
        sandbox: this.sandbox.buildSandboxAttrs(hostname)
      });
      try {
        iframe.contentWindow.__PV2_OWN_IFRAME__ = true;
      } catch {
      }
      iframe.style.cssText = "width:100%;height:100%;border:none;background:#fff;";
      let settled = false;
      let firstLoad = true;
      let lastUrl = url;
      const finish = (fn, ...args) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(...args);
      };
      const timer = setTimeout(() => {
        var _a2, _b;
        if (settled) return;
        try {
          const href = iframe.contentWindow && iframe.contentWindow.location.href;
          if (href && href !== "about:blank") {
            (_a2 = container.querySelector(loadingSelector)) == null ? void 0 : _a2.remove();
            container.classList.add("iframe-direct-load");
            finish(onLoad);
            return;
          }
        } catch {
          (_b = container.querySelector(loadingSelector)) == null ? void 0 : _b.remove();
          container.classList.add("iframe-direct-load");
          finish(onLoad);
          return;
        }
        logger.warn(`[IframeLoader] timeout loading ${url}`);
        onError(`加载 ${url} 超时或被阻止，请尝试在新标签页打开。`);
      }, config.loader.timeout);
      const pollTimer = setInterval(() => {
        if (!iframe.isConnected) {
          clearInterval(pollTimer);
          return;
        }
        const loc = readIframeLocation(iframe);
        if (loc && loc.url !== lastUrl) {
          lastUrl = loc.url;
          onNavigate == null ? void 0 : onNavigate(loc.url, loc.title);
        }
      }, 800);
      iframe.addEventListener("load", () => {
        var _a2;
        try {
          if (iframe.contentWindow && iframe.contentWindow.location.href === "about:blank") return;
        } catch {
        }
        if (firstLoad) {
          firstLoad = false;
          const loc2 = readIframeLocation(iframe);
          if (loc2) lastUrl = loc2.url;
          if (!settled) {
            (_a2 = container.querySelector(loadingSelector)) == null ? void 0 : _a2.remove();
            container.classList.add("iframe-direct-load");
            finish(onLoad);
          }
          return;
        }
        const loc = readIframeLocation(iframe);
        if (loc && loc.url !== lastUrl) {
          lastUrl = loc.url;
          onNavigate == null ? void 0 : onNavigate(loc.url, loc.title);
        }
      });
      iframe.addEventListener("error", () => finish(onError, `加载 ${url} 失败。`));
      (_a = container.querySelector(loadingSelector)) == null ? void 0 : _a.remove();
      iframe.src = url;
      container.appendChild(iframe);
      return () => {
        clearTimeout(timer);
        clearInterval(pollTimer);
        iframe.src = "about:blank";
        iframe.remove();
      };
    }
  };

  // src/loaders/RequestLoader.js
  var RequestLoader = class {
    load({ url, hostname, keepScripts = false, container, onError, onLoad, mobileUA = null, linkIntercept, loadingSelector, onNavigate }) {
      logger.debug(`[RequestLoader] fetch ${url}`);
      const abort = gm.xmlhttpRequest({
        method: "GET",
        url,
        timeout: config.loader.timeout,
        ...mobileUA ? { headers: { "User-Agent": mobileUA } } : {},
        onload: (response) => {
          if (response.status !== 200) {
            onError(`加载失败 (HTTP ${response.status})`);
            return;
          }
          try {
            const result = sanitizer.sanitize(response.responseText, url, { keepScripts });
            renderIntoIframe({
              html: result.body,
              head: result.head,
              title: result.title,
              url,
              container,
              sandboxAttrs: contentSandboxAttrs(keepScripts),
              linkIntercept,
              loadingSelector,
              onNavigate
            });
            onLoad == null ? void 0 : onLoad();
          } catch (error) {
            logger.error("[RequestLoader] process content error", error);
            onError("内容解析失败: " + error.message);
          }
        },
        onerror: (error) => {
          logger.error("[RequestLoader] request error", error);
          onError(error && error.timeout ? "请求超时" : "网络请求失败");
        }
      });
      return () => {
        var _a;
        try {
          (_a = abort == null ? void 0 : abort.abort) == null ? void 0 : _a.call(abort);
        } catch {
        }
        const iframe = container.querySelector("#popup-panel-iframe");
        iframe == null ? void 0 : iframe.remove();
      };
    }
  };

  // src/loaders/ParserLoader.js
  var ParserLoader = class {
    load({ url, hostname, keepScripts, container, onError, onLoad, mobileUA = null, linkIntercept }) {
      logger.debug(`[ParserLoader] fetch & parse ${url}`);
      const abort = gm.xmlhttpRequest({
        method: "GET",
        url,
        timeout: config.loader.timeout,
        ...mobileUA ? { headers: { "User-Agent": mobileUA } } : {},
        onload: (response) => {
          if (response.status !== 200) {
            onError(`加载失败 (HTTP ${response.status})`);
            return;
          }
          try {
            const { body: sanitizedBody } = sanitizer.sanitize(response.responseText, url);
            const doc = new DOMParser().parseFromString(
              `<!DOCTYPE html><html><body>${sanitizedBody}</body></html>`,
              "text/html"
            );
            this._absolutize(doc, url, linkIntercept);
            const body = clear(container);
            const wrap = doc.body;
            while (wrap.firstChild) body.appendChild(wrap.firstChild);
            container.classList.remove("iframe-direct-load");
            onLoad == null ? void 0 : onLoad();
          } catch (error) {
            logger.error("[ParserLoader] parse error", error);
            onError("内容解析失败: " + error.message);
          }
        },
        onerror: (error) => {
          logger.error("[ParserLoader] request error", error);
          onError(error && error.timeout ? "请求超时" : "网络请求失败");
        }
      });
      return () => {
        var _a;
        try {
          (_a = abort == null ? void 0 : abort.abort) == null ? void 0 : _a.call(abort);
        } catch {
        }
      };
    }
    _absolutize(doc, baseUrl, linkIntercept) {
      const base = baseUrl;
      doc.querySelectorAll("[href],[src],[poster],[data-src]").forEach((node) => {
        ["href", "src", "poster", "data-src"].forEach((attr) => {
          const raw = node.getAttribute(attr);
          if (!raw || /^(javascript|data|mailto|tel|#):/i.test(raw.trim())) return;
          try {
            node.setAttribute(attr, new URL(raw, base).href);
          } catch {
          }
        });
      });
      const openNewTab = linkIntercept !== void 0 ? linkIntercept : settingsManager.get().popupLinksNewTab !== false;
      doc.querySelectorAll("a[href]").forEach((link) => {
        if (openNewTab) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
      });
      doc.querySelectorAll("img").forEach((img) => {
        img.loading = img.loading || "lazy";
      });
    }
  };

  // src/loaders/CacheLoader.js
  var CacheLoader = class {
    constructor() {
      this.cache = /* @__PURE__ */ new Map();
      this.inflight = /* @__PURE__ */ new Map();
    }
    has(url) {
      return this._readCache(url) != null;
    }
    _readCache(url) {
      const entry = this.cache.get(url);
      if (!entry) return null;
      if (Date.now() - entry.time > config.cache.ttl) {
        this.cache.delete(url);
        return null;
      }
      return entry;
    }
    _writeCache(url, result) {
      if (this.cache.size >= config.cache.maxEntries) {
        const oldest = this.cache.keys().next().value;
        this.cache.delete(oldest);
      }
      this.cache.set(url, { head: result.head, body: result.body, title: result.title || "", time: Date.now() });
    }
    /**
     * 发起抓取并缓存，返回 { promise, abort }。
     * 同一 URL 的并发请求会去重复用。
     */
    prefetch(url, keepScripts = false, mobileUA = null) {
      const cached = this._readCache(url);
      if (cached != null) return { promise: Promise.resolve(cached), abort: () => {
      } };
      const existing = this.inflight.get(url);
      if (existing) return existing;
      const entry = this._fetch(url, keepScripts, mobileUA);
      const cleanup = () => this.inflight.delete(url);
      entry.promise.then(cleanup, cleanup);
      this.inflight.set(url, entry);
      return entry;
    }
    _fetch(url, keepScripts, mobileUA = null) {
      let abort = () => {
      };
      const promise = new Promise((resolve, reject) => {
        const req = gm.xmlhttpRequest({
          method: "GET",
          url,
          timeout: config.loader.timeout,
          ...mobileUA ? { headers: { "User-Agent": mobileUA } } : {},
          onload: (response) => {
            if (response.status !== 200) {
              reject(new Error(`加载失败 (HTTP ${response.status})`));
              return;
            }
            try {
              const result = sanitizer.sanitize(response.responseText, url, { keepScripts });
              if (config.cache.enabled) this._writeCache(url, result);
              resolve(result);
            } catch (error) {
              logger.error("[CacheLoader] process error", error);
              reject(new Error("内容解析失败: " + error.message));
            }
          },
          onerror: (error) => {
            logger.error("[CacheLoader] request error", error);
            reject(new Error(error && error.timeout ? "请求超时" : "网络请求失败"));
          }
        });
        abort = () => {
          var _a;
          try {
            (_a = req == null ? void 0 : req.abort) == null ? void 0 : _a.call(req);
          } catch {
          }
        };
      });
      return { promise, abort };
    }
    load({ url, keepScripts = false, container, onError, onLoad, mobileUA = null, linkIntercept, loadingSelector, onNavigate }) {
      logger.debug(`[CacheLoader] ${url}`);
      const cached = this._readCache(url);
      if (cached != null) {
        logger.debug(`[CacheLoader] cache hit: ${url}`);
        renderIntoIframe({
          html: cached.body,
          head: cached.head,
          title: cached.title,
          url,
          container,
          sandboxAttrs: contentSandboxAttrs(keepScripts),
          linkIntercept,
          loadingSelector,
          onNavigate
        });
        onLoad == null ? void 0 : onLoad();
        return () => {
          var _a;
          (_a = container.querySelector("#popup-panel-iframe")) == null ? void 0 : _a.remove();
        };
      }
      const { promise, abort } = this.prefetch(url, keepScripts, mobileUA);
      promise.then((result) => {
        renderIntoIframe({
          html: result.body,
          head: result.head,
          title: result.title,
          url,
          container,
          sandboxAttrs: contentSandboxAttrs(keepScripts),
          linkIntercept,
          loadingSelector,
          onNavigate
        });
        onLoad == null ? void 0 : onLoad();
      }).catch((error) => onError == null ? void 0 : onError(error.message));
      return () => {
        var _a;
        try {
          abort == null ? void 0 : abort();
        } catch {
        }
        (_a = container.querySelector("#popup-panel-iframe")) == null ? void 0 : _a.remove();
      };
    }
  };

  // src/core/LoaderManager.js
  markMod("LoaderManager");
  var LoaderManager = class {
    constructor() {
      this.sandbox = createDefaultSandbox(config.sitePolicy);
      this.loaders = {
        iframe: new IframeLoader(this.sandbox),
        request: new RequestLoader(),
        parser: new ParserLoader(),
        cache: new CacheLoader()
      };
    }
    /**
     * 注册额外的加载方式。主脚本按需注册（如 X 的 GraphQL 加载器），
     * 避免这些实现被静态打进 PopupKit 库产物。
     */
    register(mode, loader) {
      this.loaders[mode] = loader;
      return loader;
    }
    /** 按模式取加载器（未注册时返回 null，避免外部直接摸 this.loaders 内部表） */
    get(mode) {
      return this.loaders[mode] || null;
    }
    /**
     * 解析应使用的加载方式。
     */
    resolveMode(url, hostname) {
      const policy = this.sandbox.policyFor(hostname);
      if (policy.xThread && this.loaders.xthread) return "xthread";
      if (policy.iframe) return "iframe";
      const mode = config.loader.defaultMode;
      if (mode === "iframe") return "iframe";
      if (mode === "parser") return "parser";
      if (mode === "request") return "request";
      if (config.cache.enabled) return "cache";
      return "request";
    }
    /**
     * 内容是否已在缓存中。
     */
    hasCached(url) {
      return this.loaders.cache.has(url);
    }
    /**
     * 预热缓存：后台抓取并净化 HTML，点击时可立即渲染。
     * 仅当解析结果为 cache 模式时有效。
     */
    prefetch(url) {
      const hostname = this._hostnameOf(url);
      const keepScripts = this.keepScriptsFor(hostname);
      return this.loaders.cache.prefetch(url, keepScripts, this.mobileUA());
    }
    /**
     * 手机模式下返回对应的移动端 UA，否则 null。
     */
    mobileUA() {
      const s = settingsManager.get();
      if (s.panelSize !== "phone") return null;
      const m = config.phone.sizes[s.phoneModel] || config.phone.sizes[config.phone.defaultModel];
      return m ? m.ua : null;
    }
    _hostnameOf(url) {
      try {
        return new URL(url).hostname;
      } catch {
        return "unknown";
      }
    }
    /** 该站点抓取净化时是否保留 <script>（仅信任站点）。 */
    keepScriptsFor(hostname) {
      return this.sandbox.policyFor(hostname).scripts === true;
    }
    /**
     * 加载内容到容器。
     * @param {string} url
     * @param {Object} ctx { container, hostname, onError, onLoad, keepScripts?, mobileUA?, linkIntercept?, loadingSelector? }
     * @returns {Function} abort 函数
     */
    load(url, ctx) {
      const hostname = ctx.hostname || this._hostnameOf(url);
      const mode = this.resolveMode(url, hostname);
      const loader = this.loaders[mode] || this.loaders.request;
      const keepScripts = ctx.keepScripts !== void 0 ? ctx.keepScripts : this.keepScriptsFor(hostname);
      const mobileUA = ctx.mobileUA !== void 0 ? ctx.mobileUA : this.mobileUA();
      const linkIntercept = ctx.linkIntercept !== void 0 ? ctx.linkIntercept : void 0;
      logger.log(`[LoaderManager] mode=${mode} scripts=${keepScripts} ${url}`);
      const abort = loader.load({
        url,
        hostname,
        keepScripts,
        mobileUA,
        linkIntercept,
        loadingSelector: ctx.loadingSelector,
        container: ctx.container,
        onError: ctx.onError,
        onLoad: ctx.onLoad,
        onNavigate: ctx.onNavigate
      });
      return () => {
        try {
          abort == null ? void 0 : abort();
        } catch (err) {
          logger.warn("[LoaderManager] abort error", err);
        }
      };
    }
  };
  var loaderManager = new LoaderManager();

  // src/utils/uiHost.js
  var HOST_ID = "pv2-ui-host";
  var PAGE_START = "/* @pv-page-start */";
  var PAGE_END = "/* @pv-page-end */";
  function extractPageCss(css) {
    const out = [];
    let from = 0;
    for (; ; ) {
      const start = css.indexOf(PAGE_START, from);
      if (start < 0) break;
      const end = css.indexOf(PAGE_END, start);
      if (end < 0) break;
      out.push(css.slice(start + PAGE_START.length, end));
      from = end + PAGE_END.length;
    }
    return out.join("\n");
  }
  function toShadowCss(css) {
    return css.replace(/:root\.pv-theme-dark/g, ":host(.pv-theme-dark)").replace(/:root\.pv-theme-light/g, ":host(.pv-theme-light)").replace(/:root:not\(\.pv-theme-light\)/g, ":host(:not(.pv-theme-light))").replace(/:root(?![\w-])/g, ":host");
  }
  function injectInto(root, css) {
    let ok = false;
    try {
      if (typeof CSSStyleSheet === "function" && "adoptedStyleSheets" in root) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
        ok = true;
      }
    } catch {
    }
    if (!ok) {
      const style = document.createElement("style");
      style.textContent = css;
      root.appendChild(style);
    }
  }
  function stylesApplied(root) {
    const probe = document.createElement("div");
    probe.className = "pv-style-probe";
    root.appendChild(probe);
    const ok = probe.offsetWidth === 13;
    probe.remove();
    return ok;
  }
  function createUiHost(css) {
    if (!css || typeof document === "undefined" || !document.documentElement) return null;
    const existing = document.getElementById(HOST_ID);
    if (existing && existing.shadowRoot) {
      setUiRoot(existing.shadowRoot);
      return existing.shadowRoot;
    }
    let host = null;
    try {
      host = document.createElement("div");
      host.id = HOST_ID;
      host.setAttribute(
        "style",
        "all: initial !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; overflow: visible !important; z-index: 2147483000 !important; display: block !important;"
      );
      const root = host.attachShadow({ mode: "open" });
      injectInto(root, toShadowCss(css) + "\n.pv-style-probe{position:absolute;width:13px;height:1px;visibility:hidden}");
      const parent = pickMountPoint();
      parent.appendChild(host);
      if (!stylesApplied(root)) throw new Error("shadow styles not applied");
      setUiRoot(root);
      const pageCss = extractPageCss(css);
      if (pageCss.trim()) gm.addStyle(pageCss);
      return root;
    } catch (err) {
      console.warn("[PopupViewer] Shadow DOM 不可用，回退到页面内挂载", err);
      try {
        host == null ? void 0 : host.remove();
      } catch {
      }
      setUiRoot(null);
      return null;
    }
  }

  // src/utils/panelBehavior.js
  function clampToViewport(panel, { isFullScreen = false, pad = 8 } = {}) {
    if (!panel || isFullScreen) return;
    const rect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left;
    let top = rect.top;
    if (rect.width > vw - pad * 2) {
      left = pad;
    } else {
      if (left < pad) left = pad;
      else if (left + rect.width > vw - pad) left = vw - pad - rect.width;
    }
    if (rect.height > vh - pad * 2) {
      top = pad;
    } else {
      if (top < pad) top = pad;
      else if (top + rect.height > vh - pad) top = vh - pad - rect.height;
    }
    if (left !== rect.left || top !== rect.top) {
      panel.style.transition = "none";
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.transform = "none";
      void panel.offsetWidth;
      panel.style.transition = "";
    }
  }
  var POINTER_EVENTS = typeof PointerEvent !== "undefined";
  function setupDrag({ header, panel, isFullScreen = () => false, locked = () => false, onDragEnd }) {
    const DOWN = POINTER_EVENTS ? "pointerdown" : "mousedown";
    const MOVE = POINTER_EVENTS ? "pointermove" : "mousemove";
    const UP = POINTER_EVENTS ? "pointerup" : "mouseup";
    let dragging = false;
    let dragLocked = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let lastX = 0;
    let lastY = 0;
    let raf = null;
    const THRESHOLD = 4;
    let pending = false;
    const applyMove = () => {
      raf = null;
      if (!dragging || dragLocked) return;
      panel.style.left = `${Math.round(startLeft + (lastX - startX))}px`;
      panel.style.top = `${Math.round(startTop + (lastY - startY))}px`;
    };
    const beginDrag = () => {
      var _a;
      pending = false;
      dragging = true;
      if (dragLocked) return;
      const rect = panel.getBoundingClientRect();
      startLeft = Math.round(rect.left);
      startTop = Math.round(rect.top);
      panel.style.transition = "none";
      panel.style.left = `${startLeft}px`;
      panel.style.top = `${startTop}px`;
      panel.style.transform = "none";
      panel.classList.add("pv-dragging");
      document.body.style.cursor = "grabbing";
      try {
        (_a = window.getSelection()) == null ? void 0 : _a.removeAllRanges();
      } catch {
      }
    };
    const finish = (commit) => {
      if (pending) {
        pending = false;
        if (POINTER_EVENTS && pointerId != null) {
          try {
            header.releasePointerCapture(pointerId);
          } catch {
          }
          pointerId = null;
        }
        return;
      }
      if (!dragging) return;
      const info = { locked: dragLocked };
      dragging = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      panel.classList.remove("pv-dragging");
      document.body.style.cursor = "";
      panel.style.transition = "";
      if (POINTER_EVENTS && pointerId != null) {
        try {
          header.releasePointerCapture(pointerId);
        } catch {
        }
        pointerId = null;
      }
      if (commit) onDragEnd == null ? void 0 : onDragEnd(info);
    };
    header.addEventListener(DOWN, (e) => {
      if (closestInPath(e, "button, a, input")) return;
      if (isFullScreen()) return;
      if (e.button !== 0) return;
      pending = true;
      dragging = false;
      dragLocked = locked();
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (POINTER_EVENTS) {
        pointerId = e.pointerId;
        try {
          header.setPointerCapture(e.pointerId);
        } catch {
        }
      }
      if (e.pointerType && e.pointerType !== "mouse") e.preventDefault();
    });
    const move = (e) => {
      if (pending) {
        if (Math.abs(e.clientX - startX) < THRESHOLD && Math.abs(e.clientY - startY) < THRESHOLD) return;
        beginDrag();
      }
      if (!dragging) return;
      lastX = e.clientX;
      lastY = e.clientY;
      if (!raf) raf = requestAnimationFrame(applyMove);
    };
    document.addEventListener(MOVE, move);
    document.addEventListener(UP, () => finish(true));
    if (POINTER_EVENTS) document.addEventListener("pointercancel", () => finish(false));
  }
  var RESIZE_CURSOR = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    nw: "nwse-resize",
    se: "nwse-resize"
  };
  function setupResize({ panel, isFullScreen = () => false, locked = () => false, minWidth = 260, minHeight = 200, onResizeEnd }) {
    const DOWN = POINTER_EVENTS ? "pointerdown" : "mousedown";
    const MOVE = POINTER_EVENTS ? "pointermove" : "mousemove";
    const UP = POINTER_EVENTS ? "pointerup" : "mouseup";
    const dirs = Object.keys(RESIZE_CURSOR);
    let state = null;
    const onDown = (dir, handle) => (e) => {
      if (e.button !== 0) return;
      if (isFullScreen()) return;
      if (locked()) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = panel.getBoundingClientRect();
      panel.style.transition = "none";
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.transform = "none";
      panel.style.setProperty("--popup-width", `${rect.width}px`);
      panel.style.setProperty("--popup-height", `${rect.height}px`);
      state = { dir, startX: e.clientX, startY: e.clientY, rect, handle, pointerId: POINTER_EVENTS ? e.pointerId : null };
      panel.classList.add("pv-resizing");
      document.body.style.cursor = RESIZE_CURSOR[dir];
      if (POINTER_EVENTS) {
        try {
          handle.setPointerCapture(e.pointerId);
        } catch {
        }
      }
      document.addEventListener(MOVE, onMove);
      document.addEventListener(UP, onUp);
      if (POINTER_EVENTS) document.addEventListener("pointercancel", onCancel);
    };
    const onMove = (e) => {
      if (!state) return;
      const { dir, startX, startY, rect } = state;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let { left, top } = rect;
      let width = rect.width;
      let height = rect.height;
      const maxW = window.innerWidth - 16;
      const maxH = window.innerHeight - 16;
      if (dir.includes("e")) width = rect.width + dx;
      if (dir.includes("s")) height = rect.height + dy;
      if (dir.includes("w")) {
        width = rect.width - dx;
        left = rect.left + dx;
      }
      if (dir.includes("n")) {
        height = rect.height - dy;
        top = rect.top + dy;
      }
      if (width < minWidth) {
        if (dir.includes("w")) left = rect.left + (rect.width - minWidth);
        width = minWidth;
      }
      if (width > maxW) {
        if (dir.includes("w")) left = rect.left + (rect.width - maxW);
        width = maxW;
      }
      if (height < minHeight) {
        if (dir.includes("n")) top = rect.top + (rect.height - minHeight);
        height = minHeight;
      }
      if (height > maxH) {
        if (dir.includes("n")) top = rect.top + (rect.height - maxH);
        height = maxH;
      }
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.setProperty("--popup-width", `${width}px`);
      panel.style.setProperty("--popup-height", `${height}px`);
    };
    const finish = (commit) => {
      if (!state) return;
      const st = state;
      state = null;
      panel.classList.remove("pv-resizing");
      panel.style.transition = "";
      document.body.style.cursor = "";
      document.removeEventListener(MOVE, onMove);
      document.removeEventListener(UP, onUp);
      if (POINTER_EVENTS) document.removeEventListener("pointercancel", onCancel);
      if (POINTER_EVENTS && st.pointerId != null) {
        try {
          st.handle.releasePointerCapture(st.pointerId);
        } catch {
        }
      }
      if (commit) onResizeEnd == null ? void 0 : onResizeEnd(panel.getBoundingClientRect());
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    dirs.forEach((dir) => {
      const handle = document.createElement("div");
      handle.className = `pv-resize pv-resize-${dir}`;
      handle.addEventListener(DOWN, onDown(dir, handle));
      panel.appendChild(handle);
    });
    const knobDirs = ["ne", "nw", "se", "sw"];
    knobDirs.forEach((dir) => {
      const knob = document.createElement("div");
      knob.className = `pv-resize-knob pv-resize-knob-${dir}`;
      knob.appendChild(svgIcon("resize", { size: 18 }));
      knob.addEventListener(DOWN, onDown(dir, knob));
      panel.appendChild(knob);
    });
  }
  function setupWheelScrollChain({ panel, contentArea, isFullScreen = () => false }) {
    const canScrollFrom = (node, stop, dy) => {
      var _a;
      for (let el2 = node; el2 && el2.nodeType === 1; el2 = el2.parentElement || ((_a = el2.getRootNode) == null ? void 0 : _a.call(el2).host)) {
        const style = getComputedStyle(el2);
        if (/(auto|scroll)/.test(style.overflowY) && el2.scrollHeight > el2.clientHeight + 1) {
          if (dy < 0 ? el2.scrollTop > 0 : el2.scrollTop + el2.clientHeight < el2.scrollHeight - 1) return true;
        }
        if (el2 === stop) break;
      }
      return false;
    };
    document.addEventListener(
      "wheel",
      (e) => {
        if (!panel || !panel.classList.contains("visible")) return;
        const target = eventTarget(e);
        if (!target || !panel.contains(target)) return;
        if (target.closest && target.closest(".pv-x-media-lightbox")) return;
        if (!e.deltaY) return;
        if (canScrollFrom(target, panel, e.deltaY)) return;
        if (!isFullScreen()) {
          const content = contentArea();
          if (!content || !content.contains(target)) return;
        }
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );
  }

  // src/ui/Toolbar.js
  function createToolbar(handlers) {
    const actions = el("div", { id: "popup-panel-actions" });
    const makeBtn = (id, icon, title, onClick) => {
      const btn = el("button", {
        id,
        type: "button",
        class: "popup-panel-btn",
        title,
        "aria-label": title.replace(/\s*\(.*\)$/, ""),
        onclick: onClick
      });
      btn.appendChild(svgIcon(icon));
      actions.appendChild(btn);
      return btn;
    };
    const refresh = makeBtn("popup-panel-refresh", "refresh", "刷新内容 (R)", () => {
      var _a;
      return (_a = handlers.onRefresh) == null ? void 0 : _a.call(handlers);
    });
    const maximize = makeBtn("popup-panel-maximize", "maximize", "全屏 (F)", () => {
      var _a;
      return (_a = handlers.onMaximize) == null ? void 0 : _a.call(handlers);
    });
    const open = makeBtn("popup-panel-open-in-new", "external", "在新标签页打开", () => {
      var _a;
      return (_a = handlers.onOpenExternal) == null ? void 0 : _a.call(handlers);
    });
    const settings = makeBtn("popup-panel-settings", "settings", "设置", () => {
      var _a;
      return (_a = handlers.onSettings) == null ? void 0 : _a.call(handlers);
    });
    const close = makeBtn("popup-panel-close", "close", "关闭 (Esc)", () => {
      var _a;
      return (_a = handlers.onClose) == null ? void 0 : _a.call(handlers);
    });
    return { actions, refresh, maximize, open, settings, close };
  }

  // src/core/StorageManager.js
  var StorageManager = class {
    constructor() {
      this.historyKey = config.storage.historyKey;
      this.favoritesKey = config.storage.favoritesKey;
    }
    _read(key, fallback) {
      const value = gm.getValue(key, null);
      if (value === null || value === void 0) return fallback;
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return fallback;
        }
      }
      return value;
    }
    _write(key, value) {
      gm.setValue(key, JSON.stringify(value));
    }
    getHistory() {
      return this._read(this.historyKey, []);
    }
    addHistory(entry) {
      const history = this.getHistory();
      const now = Date.now();
      const next = [
        { title: entry.title || "", url: entry.url, time: now },
        ...history.filter((h) => h.url !== entry.url)
      ];
      this._write(this.historyKey, next.slice(0, config.maxHistoryEntries));
      return next;
    }
    clearHistory(host = "") {
      const history = this.getHistory();
      if (!host) {
        this._write(this.historyKey, []);
        return;
      }
      const next = history.filter((h) => {
        try {
          return new URL(h.url).hostname !== host;
        } catch {
          return true;
        }
      });
      this._write(this.historyKey, next);
    }
    getFavorites() {
      return this._read(this.favoritesKey, []);
    }
    addFavorite(entry) {
      const favorites = this.getFavorites();
      if (favorites.some((f) => f.url === entry.url)) return favorites;
      const next = [{ title: entry.title || "", url: entry.url, time: Date.now() }, ...favorites];
      this._write(this.favoritesKey, next);
      return next;
    }
    removeFavorite(url) {
      const next = this.getFavorites().filter((f) => f.url !== url);
      this._write(this.favoritesKey, next);
      return next;
    }
    isFavorite(url) {
      return this.getFavorites().some((f) => f.url === url);
    }
  };
  var storageManager = new StorageManager();

  // src/ui/SettingsPanel.js
  function createSettingsPanel({ onChange, onManageRules, onClose }) {
    var _a, _b;
    const SIZE_ORDER = ["small", "medium", "large", "phone", "custom"];
    const SIZE_LABELS = { small: "小", medium: "中", large: "大", phone: "手机", custom: "自定义" };
    const THEME_ORDER = ["auto", "light", "dark"];
    const THEME_LABELS = { auto: "跟随系统", light: "浅色", dark: "深色" };
    const DEFAULT_SIZE = "medium";
    const DEFAULT_THEME = "auto";
    const PHONE_ORDER = Object.keys(config.phone.sizes);
    const PHONE_LABELS = Object.fromEntries(PHONE_ORDER.map((k) => [k, config.phone.sizes[k].label]));
    const PHONE_ICONS = Object.fromEntries(PHONE_ORDER.map((k) => [k, svgIcon("smartphone", { size: 12 })]));
    const persist = () => {
      onChange == null ? void 0 : onChange(settingsManager.get());
      eventBus.emit("settings-changed", settingsManager.get());
    };
    const tipEl = el("div", { id: "pv-settings-tip", class: "hidden" });
    mountUi(tipEl);
    let tipTarget = null;
    function toggleTip(btn, text) {
      if (tipTarget === btn) {
        hideTip();
        return;
      }
      tipTarget = btn;
      tipEl.textContent = text;
      tipEl.classList.remove("hidden");
      const r = btn.getBoundingClientRect();
      const w = tipEl.offsetWidth;
      let left = r.left;
      if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
      if (left < 8) left = 8;
      tipEl.style.left = left + "px";
      tipEl.style.top = r.bottom + 6 + "px";
    }
    function hideTip() {
      tipTarget = null;
      tipEl.classList.add("hidden");
    }
    function makeTip(text) {
      const btn = el("button", {
        type: "button",
        class: "pv-settings-tip",
        "aria-label": "说明",
        onclick: (e) => {
          e.stopPropagation();
          toggleTip(btn, text);
        }
      });
      btn.appendChild(svgIcon("info", { size: 13 }));
      return btn;
    }
    document.addEventListener("click", (e) => {
      if (tipEl.classList.contains("hidden")) return;
      if (closestInPath(e, ".pv-settings-tip") || eventTarget(e) === tipEl) return;
      hideTip();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideTip();
    });
    const makeSeg = (order, labels, getKey, setKey, { icons = {}, defaultOf, onChange: onChange2, onSet, statusOnly = [], disabledOf, onDisabled } = {}) => {
      const btns = {};
      const group2 = el("div", { class: "pv-seg", role: "group" });
      const sync = () => {
        const current = getKey();
        let reason = "";
        Object.entries(btns).forEach(([k, b]) => {
          const active = k === current;
          b.classList.toggle("active", active);
          b.setAttribute("aria-pressed", active ? "true" : "false");
          b.classList.toggle("is-default", !!defaultOf && k === defaultOf);
          if (statusOnly.includes(k)) b.classList.toggle("hidden", !active);
          const why = disabledOf ? disabledOf(k) : "";
          b.disabled = !!why;
          if (why) {
            b.title = why;
            reason = why;
          } else b.removeAttribute("title");
        });
        onDisabled == null ? void 0 : onDisabled(reason);
      };
      order.forEach((k) => {
        const children = [];
        if (icons[k]) children.push(icons[k]);
        children.push(el("span", { text: labels[k] }));
        const btn = el(
          "button",
          {
            type: "button",
            class: "pv-seg-item",
            onclick: () => {
              if (statusOnly.includes(k) || btn.disabled) return;
              settingsManager.set(onSet ? onSet(k) : { [setKey]: k });
              sync();
              onChange2 == null ? void 0 : onChange2();
              persist();
            }
          },
          ...children
        );
        btns[k] = btn;
        group2.appendChild(btn);
      });
      sync();
      return { group: group2, sync };
    };
    const sizeSeg = makeSeg(SIZE_ORDER, SIZE_LABELS, () => settingsManager.get().panelSize, "panelSize", {
      icons: { phone: svgIcon("smartphone", { size: 12 }) },
      defaultOf: DEFAULT_SIZE,
      onChange: syncPhoneModels,
      onSet: (k) => ({ panelSize: k, customSize: null }),
      statusOnly: ["custom"]
    });
    (_b = (_a = eventBus).on) == null ? void 0 : _b.call(_a, "settings-changed", () => sizeSeg.sync());
    const themeSeg = makeSeg(THEME_ORDER, THEME_LABELS, () => settingsManager.get().theme || "auto", "theme", {
      defaultOf: DEFAULT_THEME
    });
    const windowModeNote = el("div", { class: "pv-settings-note hidden", role: "note" });
    const windowModeSeg = makeSeg(
      ["coupled", "float"],
      { coupled: "遮罩（点空白关闭）", float: "悬浮（不挡页面）" },
      () => settingsManager.get().windowMode || "coupled",
      "windowMode",
      {
        // 不变量：关闭页面链接拦截时只能悬浮（SettingsManager._applyInvariants），置灰并说明原因
        disabledOf: (k) => k === "coupled" && settingsManager.get().linkIntercept === false ? "已关闭「页面链接拦截」，只能使用悬浮" : "",
        onDisabled: (reason) => {
          windowModeNote.textContent = reason;
          windowModeNote.classList.toggle("hidden", !reason);
        }
      }
    );
    const handednessSeg = makeSeg(
      ["right", "left"],
      { right: "右手", left: "左手" },
      () => settingsManager.get().handedness || "right",
      "handedness"
    );
    const phoneModelSeg = makeSeg(
      PHONE_ORDER,
      PHONE_LABELS,
      () => settingsManager.get().phoneModel || config.phone.defaultModel,
      "phoneModel",
      { icons: PHONE_ICONS }
    );
    const phoneModelsWrap = el(
      "div",
      { class: "pv-settings-phone-models hidden", id: "pv-settings-phone-models" },
      el("div", { class: "pv-settings-sub", text: "手机型号" }),
      phoneModelSeg.group
    );
    function syncPhoneModels() {
      phoneModelsWrap.classList.toggle("hidden", settingsManager.get().panelSize !== "phone");
    }
    syncPhoneModels();
    const scrollSwitch = el("input", { type: "checkbox", id: "pv-settings-scroll" });
    scrollSwitch.checked = settingsManager.get().scrollbarVisible !== false;
    scrollSwitch.addEventListener("change", () => {
      settingsManager.set({ scrollbarVisible: scrollSwitch.checked });
      persist();
    });
    const scrollSwitchWrap = el("label", { class: "pv-switch" }, scrollSwitch, el("span", { class: "pv-switch-track" }));
    const lockSwitch = el("input", { type: "checkbox", id: "pv-settings-lock" });
    lockSwitch.checked = settingsManager.get().locked === true;
    lockSwitch.addEventListener("change", () => {
      settingsManager.set({ locked: lockSwitch.checked });
      persist();
    });
    const lockSwitchWrap = el("label", { class: "pv-switch" }, lockSwitch, el("span", { class: "pv-switch-track" }));
    const linkInterceptSwitch = el("input", { type: "checkbox", id: "pv-settings-link-intercept" });
    linkInterceptSwitch.checked = settingsManager.get().linkIntercept !== false;
    linkInterceptSwitch.addEventListener("change", () => {
      settingsManager.set({ linkIntercept: linkInterceptSwitch.checked });
      windowModeSeg.sync();
      persist();
    });
    const linkInterceptSwitchWrap = el("label", { class: "pv-switch" }, linkInterceptSwitch, el("span", { class: "pv-switch-track" }));
    const popupLinksSwitch = el("input", { type: "checkbox", id: "pv-settings-popup-links" });
    popupLinksSwitch.checked = settingsManager.get().popupLinksNewTab !== false;
    popupLinksSwitch.addEventListener("change", () => {
      settingsManager.set({ popupLinksNewTab: popupLinksSwitch.checked });
      persist();
    });
    const popupLinksSwitchWrap = el("label", { class: "pv-switch" }, popupLinksSwitch, el("span", { class: "pv-switch-track" }));
    const allowInFrameSwitch = el("input", { type: "checkbox", id: "pv-settings-iframe" });
    allowInFrameSwitch.checked = settingsManager.get().allowInFrame === true;
    allowInFrameSwitch.addEventListener("change", () => {
      settingsManager.set({ allowInFrame: allowInFrameSwitch.checked });
      persist();
    });
    const allowInFrameWrap = el("label", { class: "pv-switch" }, allowInFrameSwitch, el("span", { class: "pv-switch-track" }));
    const mobileResizeSwitch = el("input", { type: "checkbox", id: "pv-settings-mobile-resize" });
    mobileResizeSwitch.checked = settingsManager.get().mobileResize !== false;
    mobileResizeSwitch.addEventListener("change", () => {
      settingsManager.set({ mobileResize: mobileResizeSwitch.checked });
      persist();
    });
    const mobileResizeSwitchWrap = el("label", { class: "pv-switch" }, mobileResizeSwitch, el("span", { class: "pv-switch-track" }));
    const debugSwitch = el("input", { type: "checkbox", id: "pv-settings-debug" });
    debugSwitch.checked = gm.getValue("pv2:debug", false) === true;
    debugSwitch.addEventListener("change", () => {
      gm.setValue("pv2:debug", debugSwitch.checked);
    });
    const debugSwitchWrap = el("label", { class: "pv-switch" }, debugSwitch, el("span", { class: "pv-switch-track" }));
    const RESET_LABEL = "恢复默认";
    const resetBtn = el("button", {
      type: "button",
      class: "pv-settings-reset",
      text: RESET_LABEL,
      title: "重置全部全局设置和本站设置（不影响其他站点和链接规则）"
    });
    let resetTimer = 0;
    const disarmReset = () => {
      clearTimeout(resetTimer);
      resetTimer = 0;
      resetBtn.classList.remove("confirming");
      resetBtn.textContent = RESET_LABEL;
    };
    resetBtn.addEventListener("click", () => {
      if (!resetTimer) {
        resetBtn.classList.add("confirming");
        resetBtn.textContent = "确认恢复全局+本站设置？";
        resetTimer = setTimeout(disarmReset, 3e3);
        return;
      }
      disarmReset();
      settingsManager.reset();
      popupLinksSwitch.checked = settingsManager.get().popupLinksNewTab !== false;
      scrollSwitch.checked = settingsManager.get().scrollbarVisible !== false;
      lockSwitch.checked = settingsManager.get().locked === true;
      linkInterceptSwitch.checked = settingsManager.get().linkIntercept !== false;
      allowInFrameSwitch.checked = settingsManager.get().allowInFrame === true;
      mobileResizeSwitch.checked = settingsManager.get().mobileResize !== false;
      sizeSeg.sync();
      themeSeg.sync();
      windowModeSeg.sync();
      handednessSeg.sync();
      phoneModelSeg.sync();
      syncPhoneModels();
      persist();
    });
    const manageRulesBtn = el("button", { type: "button", class: "pv-settings-reset", text: "管理", onclick: () => onManageRules == null ? void 0 : onManageRules() });
    const closeBtn = el("button", {
      type: "button",
      class: "pv-settings-close",
      title: "关闭设置",
      "aria-label": "关闭设置",
      onclick: () => onClose == null ? void 0 : onClose()
    });
    closeBtn.appendChild(svgIcon("close", { size: 14 }));
    const head = el(
      "div",
      { class: "pv-settings-head" },
      el("span", { class: "pv-settings-title", text: "设置" }),
      closeBtn
    );
    const group = (title) => el("div", { class: "pv-settings-group" }, el("div", { class: "pv-settings-group-title", text: title }));
    let labelSeq = 0;
    const titleCol = (label, sub, tip, settingKey) => {
      const n = ++labelSeq;
      const labelId = `pv-settings-label-${n}`;
      const subId = `pv-settings-sub-${n}`;
      const site = !!settingKey && settingsManager.isSiteKey(settingKey);
      const col = el(
        "div",
        { class: "pv-settings-title-col" },
        el(
          "div",
          { class: "pv-settings-label-line" },
          el("span", { class: "pv-settings-label", id: labelId, text: label }),
          site ? el("span", { class: "pv-settings-scope", title: "此项按站点分别保存，只影响当前网站", text: "仅本站" }) : null,
          tip ? makeTip(tip) : null
        ),
        sub ? el("div", { class: "pv-settings-sub", id: subId, text: sub }) : null
      );
      return { col, labelId, subId: sub ? subId : null };
    };
    const labelControl = (control, t) => {
      if (control.tagName === "BUTTON") return;
      const target = control.querySelector("input") || control;
      target.setAttribute("aria-labelledby", t.labelId);
      if (t.subId) target.setAttribute("aria-describedby", t.subId);
    };
    const rowBlock = (label, sub, control, tip, settingKey) => {
      const t = titleCol(label, sub, tip, settingKey);
      labelControl(control, t);
      return el("div", { class: "pv-settings-item" }, el("div", { class: "pv-settings-item-head" }, t.col, control));
    };
    const colBlock = (label, sub, control, tip, settingKey, ...extra) => {
      const t = titleCol(label, sub, tip, settingKey);
      labelControl(control, t);
      return el("div", { class: "pv-settings-item" }, el("div", { class: "pv-settings-item-head" }, t.col), control, ...extra);
    };
    const sizeBlock = colBlock("窗体大小", "弹窗的默认尺寸", sizeSeg.group, null, "panelSize", phoneModelsWrap);
    const footer = el("div", { class: "pv-settings-footer" }, resetBtn);
    const RECENT_LIMIT = 20;
    const recentList = el("div", { class: "pv-recent-list" });
    const clearLabel = "清空本站";
    const clearBtn = el("button", { type: "button", class: "pv-settings-reset pv-recent-clear", text: clearLabel });
    let clearTimer = 0;
    const disarmClear = () => {
      clearTimeout(clearTimer);
      clearTimer = 0;
      clearBtn.classList.remove("confirming");
      clearBtn.textContent = clearLabel;
    };
    clearBtn.addEventListener("click", () => {
      if (!clearTimer) {
        clearBtn.classList.add("confirming");
        clearBtn.textContent = "确认清空本站记录？";
        clearTimer = setTimeout(disarmClear, 3e3);
        return;
      }
      disarmClear();
      storageManager.clearHistory(window.location.hostname);
      renderRecent();
    });
    const recentHead = el(
      "div",
      { class: "pv-recent-head" },
      el("span", { class: "pv-settings-group-title", text: "最近打开（本站）" }),
      clearBtn
    );
    function renderRecent() {
      disarmClear();
      recentList.textContent = "";
      let items = [];
      try {
        items = storageManager.getHistory();
      } catch {
      }
      const currentHost = window.location.hostname;
      items = (Array.isArray(items) ? items : []).filter((h) => h && h.url && hostOf(h.url) === currentHost).slice(0, RECENT_LIMIT);
      clearBtn.classList.toggle("hidden", !items.length);
      if (!items.length) {
        recentList.appendChild(el("div", { class: "pv-recent-empty", text: "本站还没有记录，打开过的帖子会显示在这里" }));
        return;
      }
      for (const h of items) {
        const title = h.title || h.url;
        recentList.appendChild(
          el(
            "button",
            {
              type: "button",
              class: "pv-recent-item",
              title: h.url,
              onclick: () => {
                onClose == null ? void 0 : onClose();
                eventBus.emit("open-page", { url: h.url, title: h.title || "" });
              }
            },
            el("span", { class: "pv-recent-title", text: title }),
            el("span", { class: "pv-recent-meta", text: relativeTime(h.time) })
          )
        );
      }
    }
    const commonTab = el("button", {
      type: "button",
      id: "pv-settings-tab-common",
      class: "pv-settings-tab active",
      "aria-controls": "pv-settings-pane-common",
      text: "通用"
    });
    const mobileTab = el("button", {
      type: "button",
      id: "pv-settings-tab-mobile",
      class: "pv-settings-tab",
      "aria-controls": "pv-settings-pane-mobile",
      text: "移动端"
    });
    const recentTab = el("button", {
      type: "button",
      id: "pv-settings-tab-recent",
      class: "pv-settings-tab",
      "aria-controls": "pv-settings-pane-recent",
      text: "最近"
    });
    const tabs = el("div", { class: "pv-settings-tabs", role: "tablist", "aria-label": "设置分类" }, commonTab, mobileTab, recentTab);
    const commonPane = el("div", {
      id: "pv-settings-pane-common",
      class: "pv-settings-pane active",
      role: "tabpanel",
      "aria-labelledby": "pv-settings-tab-common"
    });
    const mobilePane = el("div", {
      id: "pv-settings-pane-mobile",
      class: "pv-settings-pane",
      role: "tabpanel",
      "aria-labelledby": "pv-settings-tab-mobile"
    });
    const recentPane = el("div", {
      id: "pv-settings-pane-recent",
      class: "pv-settings-pane pv-recent-pane",
      role: "tabpanel",
      "aria-labelledby": "pv-settings-tab-recent"
    });
    const TAB_PANES = { common: [commonTab, commonPane], mobile: [mobileTab, mobilePane], recent: [recentTab, recentPane] };
    const TAB_ORDER = ["common", "mobile", "recent"];
    const switchTab = (which) => {
      for (const [k, [tab, pane]] of Object.entries(TAB_PANES)) {
        tab.classList.toggle("active", k === which);
        tab.setAttribute("aria-selected", k === which ? "true" : "false");
        tab.tabIndex = k === which ? 0 : -1;
        pane.classList.toggle("active", k === which);
      }
      footer.classList.toggle("hidden", which === "recent");
      if (which === "recent") renderRecent();
    };
    for (const [k, [tab]] of Object.entries(TAB_PANES)) {
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", () => switchTab(k));
    }
    tabs.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const current = TAB_ORDER.findIndex((k) => TAB_PANES[k][0].classList.contains("active"));
      const next = (current + (e.key === "ArrowRight" ? 1 : -1) + TAB_ORDER.length) % TAB_ORDER.length;
      switchTab(TAB_ORDER[next]);
      TAB_PANES[TAB_ORDER[next]][0].focus();
    });
    switchTab("common");
    recentPane.append(recentHead, recentList);
    commonPane.append(
      group("窗体行为"),
      colBlock("窗体驻留方式", "弹窗遮罩与页面交互", windowModeSeg.group, "遮罩：弹窗带遮罩，点空白处关闭；悬浮：无遮罩、不挡页面，页面可继续操作，点击链接仍在弹窗内打开", "windowMode", windowModeNote),
      sizeBlock,
      rowBlock("窗体滚动条", "显示或隐藏窗体内的滚动条", scrollSwitchWrap, null, "scrollbarVisible"),
      rowBlock("锁定窗体", "锁定后窗体不可拖动、不可缩放", lockSwitchWrap, null, "locked"),
      group("交互控制"),
      rowBlock("页面链接拦截", "开启后页面链接在弹窗内打开", linkInterceptSwitchWrap, "开启：点击页面链接在弹窗内打开；关闭：页面链接按原样在页面打开，窗体只能悬浮（不挡页面）", "linkIntercept"),
      rowBlock("窗体内链接新标签页打开", "弹窗内容里的链接在新标签页打开", popupLinksSwitchWrap, "开启：弹窗内容里的链接在新标签页打开；关闭：在弹窗内部跳转", "popupLinksNewTab"),
      rowBlock("链接规则", "拦截本站指定链接并在弹窗打开", manageRulesBtn, "规则按当前站点生效；点「点选链接」后在页面上点一下链接即可生成，无需写选择器"),
      group("外观"),
      colBlock("外观主题", "跟随系统或手动指定", themeSeg.group, null, "theme"),
      group("高级"),
      rowBlock("在 iframe 中运行", "默认关闭（等同 @noframes）", allowInFrameWrap, "风险：开启后脚本会在页面内所有 iframe 中运行（含广告、嵌入内容等），可能增加页面开销、出现多个悬浮按钮，或与嵌入页面产生样式冲突；仅在确有需要时开启。脚本自己的弹窗 iframe 始终跳过，不会套娃"),
      rowBlock("调试标记", "在页面左上角/右侧显示脚本运行状态与错误标记（下次刷新生效），仅排查问题时开启", debugSwitchWrap, "开启后每次刷新页面会显示：紫色 boot 版本、右侧模块加载序号、橙色初始化状态、红色错误信息；排查完请关闭")
    );
    mobilePane.append(
      group("移动端专属"),
      rowBlock("四角缩放把手", "触屏下窗体四角显示缩放把手，可自由调整窗体大小（默认关闭）", mobileResizeSwitchWrap),
      colBlock("惯用手", "左手：工具栏镜像，关闭按钮移到左上角（移动端单手使用）", handednessSeg.group)
    );
    const topArea = el("div", { class: "pv-settings-top" }, head, tabs);
    const root = el(
      "div",
      { id: "popup-settings-popover", role: "dialog", "aria-label": "设置" },
      topArea,
      commonPane,
      mobilePane,
      recentPane,
      footer
    );
    root.refresh = () => {
      if (recentPane.classList.contains("active")) renderRecent();
    };
    return root;
  }
  function relativeTime(t) {
    const diff = Date.now() - Number(t || 0);
    if (!t || diff < 0) return "";
    const min = Math.floor(diff / 6e4);
    if (min < 1) return "刚刚";
    if (min < 60) return min + " 分钟前";
    const h = Math.floor(min / 60);
    if (h < 24) return h + " 小时前";
    const d = Math.floor(h / 24);
    if (d < 30) return d + " 天前";
    const date = new Date(Number(t));
    return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  }
  function hostOf(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }

  // src/utils/selector.js
  function cssEscapeIdent(s) {
    const t = String(s || "");
    try {
      if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(t);
    } catch {
    }
    return t.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }
  function isStableClassName(c) {
    const s = String(c || "");
    if (!s || s.length < 2 || s.length > 48) return false;
    if (/^(pv-|popup)/i.test(s)) return false;
    if (/^(is-|has-|js-|ng-|v-|css-|sc-|sx-|emotion|svelte-|cssmodule)/i.test(s)) return false;
    if (/^(active|hover|focus|selected|current|open|show|hide|hidden|visible|disabled|checked|on|off)$/i.test(s)) return false;
    if (/^[a-f0-9]{8,}$/i.test(s)) return false;
    if (/\d{5,}/.test(s)) return false;
    return /^[a-zA-Z_:-][\w:-]*$/.test(s);
  }
  function isStableId(id) {
    const s = String(id || "");
    if (!s || s.length > 64) return false;
    if (/^(ember|react|vue|ng|app|pv-|popup)-/i.test(s)) return false;
    if (/^[a-f0-9-]{12,}$/i.test(s)) return false;
    if (/\d{6,}/.test(s)) return false;
    return /^[a-zA-Z][\w:-]*$/.test(s);
  }
  function countMatches(sel) {
    try {
      return document.body ? document.body.querySelectorAll(sel).length : 0;
    } catch {
      return -1;
    }
  }
  function buildSelectorCandidates(el2) {
    const list = [];
    const seen = /* @__PURE__ */ Object.create(null);
    if (!el2 || el2.nodeType !== 1 || !el2.tagName) return list;
    const tag = el2.tagName.toLowerCase();
    const id = el2.id ? String(el2.id) : "";
    const classes = Array.prototype.slice.call(el2.classList || []).filter(isStableClassName).slice(0, 4);
    const push = (sel, note) => {
      const s = String(sel || "").trim();
      if (!s || seen[s]) return;
      const n = countMatches(s);
      if (n < 1) return;
      seen[s] = 1;
      list.push({ sel: s, count: n, note: note || "" });
    };
    if (id && isStableId(id)) push("#" + cssEscapeIdent(id), "id");
    if (classes.length) {
      push("." + classes.map(cssEscapeIdent).join("."), "class");
      push(tag + "." + classes.map(cssEscapeIdent).join("."), "tag+class");
      if (classes[0]) {
        push("." + cssEscapeIdent(classes[0]), "主 class");
        push(tag + "." + cssEscapeIdent(classes[0]), "tag+主 class");
      }
    } else if (tag && tag !== "div" && tag !== "span") {
      push(tag, "标签");
    }
    const outerLink = el2.parentElement && el2.parentElement.closest ? el2.parentElement.closest("a[href]") : null;
    if (outerLink && outerLink !== el2) {
      const lc = Array.prototype.slice.call(outerLink.classList || []).filter(isStableClassName).slice(0, 2);
      if (outerLink.id && isStableId(outerLink.id)) push("#" + cssEscapeIdent(outerLink.id), "链接 id");
      if (lc.length) push("a." + lc.map(cssEscapeIdent).join("."), "链接 class");
      const lp = outerLink.parentElement;
      const lpc = lp ? Array.prototype.slice.call(lp.classList || []).filter(isStableClassName).slice(0, 2) : [];
      if (lpc.length) push(lp.tagName.toLowerCase() + "." + lpc.map(cssEscapeIdent).join(".") + " > a", "父级+链接");
    }
    let p = el2.parentElement;
    let depth = 0;
    while (p && p !== document.body && depth < 4) {
      const pTag = p.tagName.toLowerCase();
      const pClasses = Array.prototype.slice.call(p.classList || []).filter(isStableClassName).slice(0, 2);
      if (pClasses.length) {
        const pSel = pTag + "." + pClasses.map(cssEscapeIdent).join(".");
        if (classes[0]) {
          push(pSel + " " + tag + "." + cssEscapeIdent(classes[0]), "父级范围");
          push(pSel + " ." + cssEscapeIdent(classes[0]), "父级+class");
        }
        push(pSel + " " + tag, "父级+标签");
        if (depth === 0 && pClasses[0]) push("." + cssEscapeIdent(pClasses[0]), "父 class（整块）");
      }
      p = p.parentElement;
      depth++;
    }
    try {
      const parts = [];
      let node = el2;
      let guard = 0;
      while (node && node.nodeType === 1 && node !== document.body && guard < 5) {
        if (node.id && isStableId(node.id)) {
          parts.unshift("#" + cssEscapeIdent(node.id));
          break;
        }
        const t = node.tagName.toLowerCase();
        const parent = node.parentElement;
        if (!parent) break;
        const kids = parent.children;
        let idx = 1;
        let same = 0;
        for (let i = 0; i < kids.length; i++) {
          if (kids[i].tagName === node.tagName) {
            same++;
            if (kids[i] === node) idx = same;
          }
        }
        parts.unshift(same > 1 ? t + ":nth-of-type(" + idx + ")" : t);
        node = parent;
        guard++;
      }
      if (parts.length) push(parts.join(" > "), "路径");
    } catch {
    }
    const link = el2.closest ? el2.closest("a[href]") : null;
    for (const c of list) {
      let selfMatch = false;
      try {
        selfMatch = !!link && link.matches(c.sel);
      } catch {
      }
      c.kind = c.note === "父 class（整块）" ? "block" : selfMatch ? "link" : "other";
      if (c.kind === "block") c.note = "整块（整行任意位置可点）";
      c.desc = describeCandidate(c);
    }
    return rankCandidates(dedupeSameMatches(list), { hasLink: !!link });
  }
  function dedupeSameMatches(list) {
    const kept = [];
    const sorted = list.slice().sort((a, b) => a.sel.length - b.sel.length);
    for (const c of sorted) {
      if (c.count > 800) {
        kept.push(c);
        continue;
      }
      let nodes;
      try {
        nodes = new Set(document.body.querySelectorAll(c.sel));
      } catch {
        continue;
      }
      const dup = kept.some((k) => {
        if (k.count !== c.count || k.kind !== c.kind || !k._nodes) return false;
        for (const n of nodes) if (!k._nodes.has(n)) return false;
        return true;
      });
      if (dup) continue;
      c._nodes = nodes;
      kept.push(c);
    }
    for (const c of kept) delete c._nodes;
    return kept;
  }
  function describeCandidate(c) {
    if (c.kind === "block") return "整行任意位置（点这一块都会打开）";
    if (c.count === 1) return "只拦截这一个链接";
    if (c.kind === "link") return "只拦截这类链接";
    return "同一类元素";
  }
  function rankCandidates(list, { hasLink = false, limit = 8 } = {}) {
    const countScore = (c) => {
      if (c.count >= 2 && c.count <= 200) return 0;
      if (c.count > 200 && c.count <= 800) return 1;
      if (c.count === 1) return 2;
      return 3;
    };
    const kindScore = (c) => {
      if (c.kind === "block") return 2;
      if (hasLink) return c.kind === "link" ? 0 : 1;
      return 0;
    };
    const sorted = list.slice().sort((a, b) => kindScore(a) - kindScore(b) || countScore(a) - countScore(b) || a.sel.length - b.sel.length);
    const block = sorted.filter((c) => c.kind === "block").slice(0, 1);
    const rest = sorted.filter((c) => c.kind !== "block").slice(0, Math.max(0, limit - block.length));
    return rest.concat(block);
  }

  // src/ui/ElementPicker.js
  var MAX_HITS = 200;
  var TAP_SLOP = 10;
  function pickElement() {
    return new Promise((resolve) => {
      let done = false;
      let phase = "hover";
      let hoverEl = null;
      let cands = [];
      let activeSel = "";
      let touchStart = null;
      const coarse = (() => {
        try {
          return window.matchMedia("(pointer: coarse)").matches;
        } catch {
          return false;
        }
      })();
      const IDLE_HINT = coarse ? "点选链接：点按要拦截的链接" : "点选链接：移动鼠标高亮，单击要拦截的链接 · Esc 取消";
      const overlay = el("div", { class: "pv-picker-overlay" });
      const hintText = el("span", { class: "pv-picker-bar-text", text: IDLE_HINT });
      const hintCancel = el("button", { type: "button", class: "pv-picker-bar-cancel", text: "取消" });
      const hint = el("div", { class: "pv-picker-bar", id: "pv-picker-hint", role: "status" }, hintText, hintCancel);
      const highlight = el("div", { class: "pv-picker-highlight hidden" });
      const hits = el("div", { class: "pv-picker-hits" });
      const cTitle = el("div", { class: "pv-picker-c-title", text: "要拦截哪些链接？" });
      const cCands = el("div", { class: "pv-picker-cands", role: "radiogroup", "aria-label": "候选范围" });
      const cMeta = el("div", { class: "pv-picker-c-meta" });
      const cInput = el("input", { type: "text", class: "pv-picker-input", placeholder: "可手动改写选择器", "aria-label": "CSS 选择器" });
      const cAdv = el(
        "details",
        { class: "pv-picker-adv" },
        el("summary", { text: "高级（CSS 选择器）" }),
        cInput
      );
      const okBtn = el("button", { type: "button", class: "pv-picker-btn primary", text: "确认" });
      const againBtn = el("button", { type: "button", class: "pv-picker-btn", text: "重新选" });
      const cancelBtn = el("button", { type: "button", class: "pv-picker-btn", text: "取消" });
      const cBtns = el("div", { class: "pv-picker-c-btns" }, againBtn, cancelBtn, okBtn);
      const confirm = el("div", { class: "pv-picker-confirm hidden", role: "dialog", "aria-label": "确认点选的链接" }, cTitle, cCands, cMeta, cAdv, cBtns);
      mountUi(overlay);
      mountUi(hits);
      mountUi(highlight);
      mountUi(hint);
      mountUi(confirm);
      overlay.style.pointerEvents = "none";
      hint.style.pointerEvents = "none";
      hits.style.pointerEvents = "none";
      hintCancel.style.pointerEvents = "auto";
      confirm.style.pointerEvents = "auto";
      function finish(sel) {
        if (done) return;
        done = true;
        cleanup();
        resolve(sel);
      }
      function cleanup() {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseover", onMove, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("touchstart", onTouchStart, true);
        document.removeEventListener("touchend", onTouchEnd, true);
        window.removeEventListener("scroll", onRepaint, true);
        window.removeEventListener("resize", onRepaint, true);
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        hint.remove();
        confirm.remove();
        highlight.remove();
        hits.remove();
      }
      const OWN_SEL = ".pv-picker-overlay, .pv-picker-confirm, .pv-picker-bar, .pv-picker-highlight, .pv-picker-hits";
      function isOwn(el2) {
        if (!el2 || el2.nodeType !== 1) return false;
        if (isOwnUiNode(el2)) return true;
        try {
          return !!el2.closest(OWN_SEL);
        } catch {
          return false;
        }
      }
      function inOwnUi(e) {
        return !!closestInPath(e, ".pv-picker-confirm, .pv-picker-bar");
      }
      function resolveTarget(raw) {
        let el2 = raw;
        if (!el2 || el2.nodeType !== 1) el2 = el2 && el2.parentElement;
        if (!el2 || el2.nodeType !== 1) return null;
        if (isOwn(el2)) return null;
        if (el2.tagName === "SPAN" && el2.parentElement) {
          const firstCls = String((el2.className || "").toString().split(/\s+/).filter(Boolean)[0] || "");
          const p = el2.parentElement;
          if ((!firstCls || !isStableClassName(firstCls)) && p && p !== document.body && p.tagName !== "BODY") {
            el2 = p;
          }
        }
        return el2;
      }
      function pickFromPoint(x, y) {
        let els;
        try {
          els = document.elementsFromPoint(x, y);
        } catch {
          return null;
        }
        for (const el2 of els || []) {
          if (isOwn(el2)) continue;
          return resolveTarget(el2);
        }
        return null;
      }
      function placeBox(box, el2) {
        if (!el2 || !el2.getBoundingClientRect) return false;
        const r = el2.getBoundingClientRect();
        if (r.width < 1 && r.height < 1) return false;
        if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
        box.style.left = Math.round(Math.max(0, r.left)) + "px";
        box.style.top = Math.round(Math.max(0, r.top)) + "px";
        box.style.width = Math.round(r.width) + "px";
        box.style.height = Math.round(r.height) + "px";
        return true;
      }
      function paint(el2) {
        highlight.classList.toggle("hidden", !placeBox(highlight, el2));
      }
      function showMatches(sel) {
        activeSel = sel || "";
        let list = [];
        if (activeSel) {
          try {
            list = Array.prototype.slice.call(document.body.querySelectorAll(activeSel), 0, MAX_HITS);
          } catch {
            list = [];
          }
        }
        let used = 0;
        for (const node of list) {
          if (isOwn(node)) continue;
          let box = hits.children[used];
          if (!box) box = hits.appendChild(el("div", { class: "pv-picker-hit" }));
          if (placeBox(box, node)) used++;
        }
        while (hits.children.length > used) hits.lastChild.remove();
      }
      function onRepaint() {
        if (phase === "hover" && hoverEl) paint(hoverEl);
        else if (phase === "confirm") showMatches(activeSel);
      }
      function onMove(e) {
        if (phase !== "hover") return;
        const el2 = pickFromPoint(e.clientX, e.clientY);
        if (el2 === hoverEl) return;
        hoverEl = el2;
        paint(el2);
        if (el2 && !coarse) {
          const tag = el2.tagName.toLowerCase();
          const cls = Array.prototype.slice.call(el2.classList || []).filter(isStableClassName).slice(0, 2).join(".");
          hintText.textContent = "点选链接：" + tag + (cls ? "." + cls : "") + (el2.id ? "#" + el2.id : "") + " · 单击选定 · Esc 取消";
        } else {
          hintText.textContent = IDLE_HINT;
        }
      }
      function finishPick(el2) {
        if (!el2) return;
        cands = buildSelectorCandidates(el2);
        if (!cands.length) return;
        phase = "confirm";
        highlight.classList.add("hidden");
        hint.classList.add("hidden");
        showConfirm();
      }
      function selectCand(i) {
        const c = cands[i];
        if (!c) return;
        Array.prototype.forEach.call(cCands.children, (b, j) => {
          b.classList.toggle("is-on", j === i);
          b.setAttribute("aria-checked", j === i ? "true" : "false");
        });
        cInput.value = c.sel;
        updateMeta(c.sel);
      }
      function showConfirm() {
        cCands.textContent = "";
        cands.forEach((c, i) => {
          const btn = el(
            "button",
            {
              type: "button",
              class: "pv-picker-cand" + (c.kind === "block" ? " is-block" : ""),
              role: "radio",
              title: (c.desc || c.sel) + (c.note ? " · " + c.note : "") + "\n" + c.sel,
              "aria-label": (c.desc || c.sel) + "，选择器 " + c.sel
            },
            // 可见文本只放实际选择器；中文解释（只拦截这类链接/整行任意位置等）
            // 放进 title 提示，避免候选框被中文说明撑高。
            el("code", { class: "pv-picker-cand-sel", text: c.sel }),
            el("em", { text: "本页 " + c.count + " 个" })
          );
          btn.addEventListener("click", () => selectCand(i));
          cCands.appendChild(btn);
        });
        confirm.classList.remove("hidden");
        selectCand(0);
        okBtn.focus();
      }
      function updateMeta(sel) {
        let n = 0;
        try {
          n = document.body.querySelectorAll(sel).length;
        } catch {
          cMeta.textContent = "选择器无效";
          showMatches("");
          return;
        }
        cMeta.textContent = "本页匹配 " + n + " 个" + (n ? "（已在页面上框出" + (n > MAX_HITS ? "前 " + MAX_HITS + " 个" : "") + "）" : "");
        showMatches(sel);
      }
      function onClick(e) {
        if (inOwnUi(e)) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        if (phase !== "hover") return;
        if (e.button != null && e.button !== 0) return;
        const el2 = pickFromPoint(e.clientX, e.clientY) || hoverEl;
        finishPick(el2);
      }
      function onTouchStart(e) {
        const t = e.touches && e.touches[0];
        touchStart = t ? { x: t.clientX, y: t.clientY } : null;
      }
      function onTouchEnd(e) {
        if (phase !== "hover") return;
        if (inOwnUi(e)) return;
        const t = e.changedTouches && e.changedTouches[0];
        if (t && touchStart && Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > TAP_SLOP) {
          touchStart = null;
          return;
        }
        touchStart = null;
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        let el2 = null;
        try {
          if (t) el2 = pickFromPoint(t.clientX, t.clientY);
        } catch {
        }
        if (el2) {
          hoverEl = el2;
          paint(el2);
        }
        finishPick(el2 || hoverEl);
      }
      function onKey(e) {
        if (e.key === "Escape") {
          if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
          finish(null);
        }
      }
      const submit = () => {
        const v = cInput.value.trim();
        finish(v || null);
      };
      okBtn.addEventListener("click", submit);
      againBtn.addEventListener("click", () => {
        phase = "hover";
        showMatches("");
        confirm.classList.add("hidden");
        hint.classList.remove("hidden");
        hintText.textContent = IDLE_HINT;
      });
      cancelBtn.addEventListener("click", () => finish(null));
      hintCancel.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        finish(null);
      });
      cInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });
      cInput.addEventListener("input", () => {
        const v = cInput.value.trim();
        Array.prototype.forEach.call(cCands.children, (b, j) => b.classList.toggle("is-on", !!cands[j] && cands[j].sel === v));
        if (v) updateMeta(v);
      });
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseover", onMove, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
      document.addEventListener("touchend", onTouchEnd, true);
      window.addEventListener("scroll", onRepaint, true);
      window.addEventListener("resize", onRepaint, true);
      document.addEventListener("keydown", onKey, true);
    });
  }

  // src/ui/RulesPanel.js
  var UNDO_MS = 4e3;
  function createRulesPanel() {
    const currentHost = () => window.location.hostname;
    let picking = false;
    let viewHost = currentHost();
    const backdrop = el("div", { id: "pv-rules-panel-backdrop", onclick: () => close() });
    const closeBtn = el("button", { type: "button", class: "popup-panel-btn pv-rules-close", title: "关闭 (Esc)", "aria-label": "关闭", onclick: () => close() });
    closeBtn.appendChild(svgIcon("close", { size: 15 }));
    const hostEl = el("span", { id: "pv-rules-host" });
    const allBtn = el("button", { type: "button", class: "pv-rules-all", "aria-pressed": "false", text: "全部站点", onclick: () => toggleAllView() });
    const header = el(
      "div",
      { id: "pv-rules-panel-header" },
      el("span", { class: "pv-rules-title", text: "链接规则" }),
      hostEl,
      allBtn,
      closeBtn
    );
    const listEl = el("div", { id: "pv-rules-list" });
    const pickBtn = el(
      "button",
      { type: "button", id: "pv-rules-pick", onclick: () => startPick() },
      svgIcon("plus", { size: 14 }),
      el("span", { text: "点选链接" })
    );
    const backBtn = el("button", { type: "button", class: "pv-rules-back hidden", text: "返回本站规则", onclick: () => showHost(currentHost()) });
    const tipEl = el("div", { class: "pv-rules-tip", text: "点击「点选链接」，在页面上点一下要拦截的帖子链接，即可自动生成规则（仅当前站点生效，弹窗打开）" });
    const body = el("div", { id: "pv-rules-panel-body" }, tipEl, listEl, pickBtn, backBtn);
    const root = el("div", { id: "pv-rules-panel", role: "dialog", "aria-modal": "true", "aria-label": "链接规则" }, header, body);
    const toastText = el("span", { class: "pv-rules-toast-text" });
    const toastAction = el("button", { type: "button", class: "pv-rules-toast-action hidden" });
    const toastEl = el("div", { id: "pv-rules-toast", role: "status" }, toastText, toastAction);
    mountUi(toastEl);
    let toastTimer = null;
    let toastHandler = null;
    function hideToast() {
      clearTimeout(toastTimer);
      toastHandler = null;
      toastEl.classList.remove("visible");
    }
    function toast(msg, action) {
      toastText.textContent = msg;
      toastHandler = action ? action.run : null;
      toastAction.textContent = action ? action.label : "";
      toastAction.classList.toggle("hidden", !action);
      toastEl.classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(hideToast, action ? UNDO_MS : 1600);
    }
    toastAction.addEventListener("click", () => {
      const run = toastHandler;
      hideToast();
      run == null ? void 0 : run();
    });
    let returnFocus = null;
    const FOCUSABLE2 = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => [...root.querySelectorAll(FOCUSABLE2)].filter((node) => node.getClientRects().length > 0);
    root.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const active = deepActiveElement();
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    });
    function open(trigger = deepActiveElement()) {
      viewHost = currentHost();
      returnFocus = trigger;
      root.inert = false;
      backdrop.inert = false;
      root.classList.add("visible");
      backdrop.classList.add("visible");
      render();
      const focusClose = () => {
        if (!root.classList.contains("visible")) return;
        try {
          closeBtn.focus({ preventScroll: true });
        } catch {
        }
      };
      focusClose();
      requestAnimationFrame(focusClose);
    }
    function close() {
      if (picking) return;
      const focusInside = root.contains(deepActiveElement());
      root.classList.remove("visible");
      backdrop.classList.remove("visible");
      hideToast();
      if (focusInside && returnFocus && returnFocus.isConnected) {
        try {
          returnFocus.focus({ preventScroll: true });
        } catch {
        }
      }
      returnFocus = null;
    }
    function toggleAllView() {
      if (viewHost === null) showHost(currentHost());
      else {
        viewHost = null;
        render();
      }
    }
    function showHost(host) {
      viewHost = host;
      render();
    }
    function render() {
      const isAll = viewHost === null;
      const isCurrent = viewHost === currentHost();
      allBtn.classList.toggle("active", isAll);
      allBtn.setAttribute("aria-pressed", isAll ? "true" : "false");
      pickBtn.classList.toggle("hidden", !isCurrent);
      backBtn.classList.toggle("hidden", isCurrent);
      tipEl.classList.toggle("hidden", !isCurrent);
      if (isAll) renderHosts();
      else renderList(viewHost);
    }
    function renderHosts() {
      listEl.textContent = "";
      const hosts = rulesManager.listHosts();
      hostEl.textContent = "全部站点（" + hosts.length + " 个）";
      if (!hosts.length) {
        listEl.appendChild(el("div", { class: "pv-rules-empty", text: "还没有任何站点的规则" }));
        return;
      }
      for (const h of hosts) {
        const off = h.count - h.enabled;
        listEl.appendChild(
          el(
            "button",
            { type: "button", class: "pv-rules-host-row" + (h.host === currentHost() ? " is-current" : ""), onclick: () => showHost(h.host) },
            el("span", { class: "pv-rules-host-name", text: h.host }),
            el("span", { class: "pv-rules-host-count", text: h.count + " 条" + (off ? "（" + off + " 条已停用）" : "") })
          )
        );
      }
    }
    function countOnPage(selector) {
      try {
        return document.querySelectorAll(selector).length;
      } catch {
        return -1;
      }
    }
    function renderList(host) {
      listEl.textContent = "";
      const isCurrent = host === currentHost();
      const rules = rulesManager.getRules(host);
      hostEl.textContent = host + "（" + rules.length + " 条）";
      if (!rules.length) {
        listEl.appendChild(el("div", { class: "pv-rules-empty", text: isCurrent ? "还没有规则，点击「点选链接」开始" : "该站点没有规则" }));
        return;
      }
      rules.forEach((r, i) => listEl.appendChild(buildRow(host, r, i, isCurrent)));
    }
    function buildRow(host, r, i, isCurrent) {
      const row = el("div", { class: "pv-rules-row" + (r.disabled ? " is-disabled" : "") });
      const selId = "pv-rules-sel-" + i;
      const selEl = el("div", { class: "pv-rules-row-sel", id: selId, text: r.selector });
      let countText = "";
      if (isCurrent) {
        const n = countOnPage(r.selector);
        countText = n < 0 ? "选择器无效" : "本页匹配 " + n + " 个";
      }
      if (r.disabled) countText = (countText ? countText + " · " : "") + "已停用";
      const info = el("div", { class: "pv-rules-row-info" }, selEl, countText ? el("div", { class: "pv-rules-row-count", text: countText }) : null);
      const toggle = el("input", { type: "checkbox", "aria-labelledby": selId, title: r.disabled ? "已停用，点击启用" : "已启用，点击停用" });
      toggle.checked = !r.disabled;
      toggle.addEventListener("change", () => {
        rulesManager.updateRule(host, i, { disabled: !toggle.checked });
        render();
        toast(toggle.checked ? "已启用" : "已停用");
      });
      const toggleWrap = el("label", { class: "pv-switch pv-rules-toggle" }, toggle, el("span", { class: "pv-switch-track" }));
      const editBtn = el("button", { type: "button", class: "pv-rules-edit", title: "编辑选择器", text: "编辑", onclick: () => startEdit(host, i, row, info, r) });
      const del = el("button", { type: "button", class: "pv-rules-del", title: "删除", "aria-label": "删除规则" }, svgIcon("close", { size: 13 }), el("span", { class: "pv-rules-del-text", text: "再点一次删除" }));
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        confirmDelete(del, host, i);
      });
      row.append(info, toggleWrap, editBtn, del);
      return row;
    }
    function startEdit(host, index, row, info, rule) {
      const input = el("input", { type: "text", class: "pv-rules-edit-input", value: rule.selector, "aria-label": "编辑 CSS 选择器" });
      const meta = el("div", { class: "pv-rules-row-count" });
      const syncMeta = () => {
        const n = countOnPage(input.value.trim());
        meta.textContent = n < 0 ? "选择器无效" : "本页匹配 " + n + " 个";
      };
      const save = () => {
        const v = input.value.trim();
        if (v === rule.selector) return render();
        if (countOnPage(v) < 0) return toast("选择器无效");
        if (!rulesManager.updateRule(host, index, { selector: v })) return toast("选择器为空或与已有规则重复");
        render();
        toast("已保存");
      };
      input.addEventListener("input", syncMeta);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          render();
        }
      });
      const saveBtn = el("button", { type: "button", class: "pv-rules-edit", text: "保存", onclick: save });
      const cancelBtn = el("button", { type: "button", class: "pv-rules-edit", text: "取消", onclick: () => render() });
      row.textContent = "";
      row.classList.add("is-editing");
      row.append(el("div", { class: "pv-rules-row-info" }, input, meta), saveBtn, cancelBtn);
      syncMeta();
      input.focus();
      input.select();
    }
    function confirmDelete(btn, host, index) {
      if (btn.dataset.confirm === "1") {
        const rule = { ...rulesManager.getRules(host)[index] };
        rulesManager.removeRule(host, index);
        render();
        toast("已删除", {
          label: "撤销",
          run: () => {
            rulesManager.insertRule(host, index, rule);
            if (root.classList.contains("visible")) render();
            toast("已恢复");
          }
        });
        return;
      }
      btn.dataset.confirm = "1";
      btn.classList.add("confirming");
      btn.title = "再点一次删除";
      setTimeout(() => {
        btn.dataset.confirm = "";
        btn.classList.remove("confirming");
        btn.title = "删除";
      }, 2200);
    }
    async function startPick() {
      if (picking) return;
      picking = true;
      pickBtn.disabled = true;
      root.classList.remove("visible");
      backdrop.classList.remove("visible");
      hideToast();
      eventBus.emit("picker-start");
      let selector = null;
      try {
        selector = await pickElement();
      } finally {
        eventBus.emit("picker-end", { selector });
        root.classList.add("visible");
        backdrop.classList.add("visible");
        picking = false;
        pickBtn.disabled = false;
      }
      if (!selector) return;
      rulesManager.addRule(currentHost(), selector);
      viewHost = currentHost();
      render();
      toast("已添加规则");
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && root.classList.contains("visible")) {
        e.stopImmediatePropagation();
        close();
      }
    });
    return { root, backdrop, open, close, startPick };
  }

  // src/ui/style.css
  var style_default = `/* ===== 站点样式隔离 ===== */\r
/* v2.3.0 起外壳挂在 Shadow DOM 里（src/utils/uiHost.js），宿主网站的 CSS 进不来；\r
   这层重置主要留给回退路径（不支持 Shadow DOM 时外壳直接挂在页面里）。\r
   用 @layer 放进低优先级层，我们自己的样式(非 layer)始终覆盖它；\r
   不碰 #popup-content-area，避免影响弹窗内打开的网站内容。\r
   不再重置 outline：之前的 outline:0 把浏览器默认焦点框一起去掉了，键盘用户看不到焦点。 */\r
@layer pv-reset {\r
  #popup-content-panel,\r
  #popup-panel-header,\r
  #popup-panel-header *,\r
  #popup-panel-footer,\r
  #popup-panel-footer *,\r
  #popup-settings-popover,\r
  #popup-settings-popover *,\r
  #pv-float-settings,\r
  #pv-rules-panel,\r
  #pv-rules-panel *,\r
  #pv-rules-panel-backdrop,\r
  #pv-rules-toast,\r
  #pv-rules-toast *,\r
  #pv-settings-tip,\r
  .pv-picker-overlay,\r
  .pv-picker-bar,\r
  .pv-picker-bar *,\r
  .pv-picker-confirm,\r
  .pv-picker-confirm *,\r
  .pv-picker-highlight {\r
    box-sizing: border-box;\r
    margin: 0;\r
    padding: 0;\r
    border: 0;\r
    background: transparent;\r
    vertical-align: baseline;\r
    text-decoration: none;\r
    text-shadow: none;\r
    font-family: inherit;\r
    font-size: inherit;\r
    font-weight: inherit;\r
    font-style: inherit;\r
    line-height: inherit;\r
    letter-spacing: inherit;\r
    color: inherit;\r
    text-align: left;\r
  }\r
}\r
\r
/* 固定尺寸容器：无层级兜底，确保盒模型不被宿主页面 *{box-sizing} 破坏 */\r
#popup-content-panel,\r
#popup-settings-popover,\r
#pv-float-settings,\r
#pv-rules-panel,\r
#pv-rules-panel-backdrop,\r
#pv-rules-toast {\r
  box-sizing: border-box;\r
}\r
\r
/* 外壳各根元素固定排版：Shadow 宿主是 all:initial，回退路径下又可能继承宿主页面的字号行高 */\r
#popup-settings-popover,\r
#pv-settings-tip,\r
#pv-float-settings,\r
#pv-rules-panel,\r
#pv-rules-toast,\r
.pv-picker-bar,\r
.pv-picker-confirm {\r
  font-family: var(--pv-font);\r
  font-size: var(--pv-fs-sm);\r
  line-height: 1.5;\r
  letter-spacing: normal;\r
  text-transform: none;\r
  color: var(--popup-text);\r
  -webkit-text-size-adjust: 100%;\r
}\r
:is(#popup-content-panel, #popup-settings-popover, #pv-rules-panel, .pv-picker-confirm, .pv-picker-bar)\r
  :is(button, input, select, textarea) {\r
  font: inherit;\r
  letter-spacing: inherit;\r
  text-transform: none;\r
}\r
\r
:root {\r
  --popup-width: 50%;\r
  --popup-height: 75%;\r
  --popup-max-width: 2560px;\r
  --popup-max-height: 1440px;\r
  --popup-radius: 12px;\r
  --popup-z-index: 10000;\r
\r
  /* 色彩设计令牌（浅色） */\r
  --popup-accent: #2563eb;\r
  --popup-accent-hover: #1d4ed8;\r
  --popup-accent-soft: rgba(37, 99, 235, 0.1);\r
  --popup-danger: #dc2626;\r
  --popup-danger-soft: rgba(220, 38, 38, 0.1);\r
  --popup-header-bg: #fafbfc;\r
  --popup-border: #e4e7ec;\r
  --popup-text: #1a2233;\r
  --popup-muted: #64748b;\r
  --popup-faint: #94a3b8;\r
  --popup-bg: #ffffff;\r
  --popup-surface: #ffffff;\r
  --popup-btn-bg: rgba(15, 23, 42, 0.07);\r
  --popup-btn-hover: rgba(15, 23, 42, 0.12);\r
  --popup-btn-active: rgba(15, 23, 42, 0.17);\r
  --popup-focus-ring: rgba(37, 99, 235, 0.4);\r
  --popup-shadow:\r
    0 0 0 1px rgba(15, 23, 42, 0.04),\r
    0 24px 60px -18px rgba(15, 23, 42, 0.28),\r
    0 8px 24px -12px rgba(15, 23, 42, 0.16);\r
  --popup-overlay: rgba(15, 23, 42, 0.28);\r
\r
  /* v2.3.0 新增令牌：对比度达标的配对色 + 刻度 */\r
  --popup-on-accent: #ffffff; /* 强调色/危险色上的文字 */\r
  --popup-border-strong: #7c8ba1; /* 输入框边框、开关关闭态（对白 ≥3:1） */\r
  --popup-focus: var(--popup-accent); /* 焦点框实色 */\r
  --popup-shadow-sm: 0 4px 12px -4px rgba(15, 23, 42, 0.22);\r
  --popup-shadow-md: 0 10px 28px -10px rgba(15, 23, 42, 0.28);\r
  --pv-font: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',\r
    'Noto Sans SC', 'Noto Sans CJK SC', Roboto, sans-serif;\r
  --pv-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\r
  --pv-fs-xs: 12px;\r
  --pv-fs-sm: 13px;\r
  --pv-fs-md: 14px;\r
  --pv-fs-lg: 15px;\r
  --pv-radius-sm: 6px;\r
  --pv-radius-md: 8px;\r
  --pv-radius-lg: 12px;\r
  --pv-dur-1: 120ms;\r
  --pv-dur-2: 200ms;\r
  --pv-dur-3: 280ms;\r
  --pv-ease-out: cubic-bezier(0.16, 1, 0.3, 1);\r
  --pv-hit: 44px; /* 触屏最小热区 */\r
  /* 层级：单一基准，各层 calc 排序 */\r
  --pv-z: 2147483000;\r
}\r
\r
:root.pv-theme-dark {\r
  --popup-on-accent: #0f172a;\r
  --popup-border-strong: #64748b;\r
  --popup-shadow-sm: 0 4px 12px -4px rgba(0, 0, 0, 0.6);\r
  --popup-shadow-md: 0 10px 28px -10px rgba(0, 0, 0, 0.7);\r
}\r
\r
:root.pv-theme-dark {\r
  --popup-accent: #60a5fa;\r
  --popup-accent-hover: #93c5fd;\r
  --popup-accent-soft: rgba(96, 165, 250, 0.14);\r
  --popup-danger: #f87171;\r
  --popup-danger-soft: rgba(248, 113, 113, 0.14);\r
  --popup-header-bg: #121a2b;\r
  --popup-border: #263247;\r
  --popup-text: #e2e8f0;\r
  --popup-muted: #94a3b8;\r
  --popup-faint: #64748b;\r
  --popup-bg: #0f172a;\r
  --popup-surface: #151e30;\r
  --popup-btn-bg: rgba(148, 163, 184, 0.14);\r
  --popup-btn-hover: rgba(148, 163, 184, 0.22);\r
  --popup-btn-active: rgba(148, 163, 184, 0.28);\r
  --popup-focus-ring: rgba(96, 165, 250, 0.5);\r
  --popup-shadow:\r
    0 0 0 1px rgba(255, 255, 255, 0.04),\r
    0 28px 70px -20px rgba(0, 0, 0, 0.72),\r
    0 10px 28px -14px rgba(0, 0, 0, 0.5);\r
  --popup-overlay: rgba(0, 0, 0, 0.52);\r
}\r
\r
@media (prefers-color-scheme: dark) {\r
  :root:not(.pv-theme-light) {\r
    --popup-on-accent: #0f172a;\r
    --popup-border-strong: #64748b;\r
    --popup-shadow-sm: 0 4px 12px -4px rgba(0, 0, 0, 0.6);\r
    --popup-shadow-md: 0 10px 28px -10px rgba(0, 0, 0, 0.7);\r
    --popup-accent: #60a5fa;\r
    --popup-accent-hover: #93c5fd;\r
    --popup-accent-soft: rgba(96, 165, 250, 0.14);\r
    --popup-danger: #f87171;\r
    --popup-danger-soft: rgba(248, 113, 113, 0.14);\r
    --popup-header-bg: #121a2b;\r
    --popup-border: #263247;\r
    --popup-text: #e2e8f0;\r
    --popup-muted: #94a3b8;\r
    --popup-faint: #64748b;\r
    --popup-bg: #0f172a;\r
    --popup-surface: #151e30;\r
    --popup-btn-bg: rgba(148, 163, 184, 0.14);\r
    --popup-btn-hover: rgba(148, 163, 184, 0.22);\r
    --popup-btn-active: rgba(148, 163, 184, 0.28);\r
    --popup-focus-ring: rgba(96, 165, 250, 0.5);\r
    --popup-shadow:\r
      0 0 0 1px rgba(255, 255, 255, 0.04),\r
      0 28px 70px -20px rgba(0, 0, 0, 0.72),\r
      0 10px 28px -14px rgba(0, 0, 0, 0.5);\r
    --popup-overlay: rgba(0, 0, 0, 0.52);\r
  }\r
}\r
\r
/* ===== 基础链接样式优化（仅 Discuz 类论坛生效，避免全站污染） ===== */\r
/* @pv-page-start */\r
/* 只作用于列表里的帖子标题链接；此前的 table tr td a 会连帖子正文里的链接颜色和下划线一起去掉 */\r
html.pv-forum td.suh a,\r
html.pv-forum th.common a.xst {\r
  cursor: pointer;\r
  transition: color 0.2s ease;\r
  text-decoration: none;\r
  position: relative;\r
  color: inherit;\r
}\r
html.pv-forum td.suh a:hover,\r
html.pv-forum th.common a.xst:hover {\r
  color: var(--popup-accent, #2563eb);\r
}\r
/* @pv-page-end */\r
\r
/* ===== 面板核心 ===== */\r
#popup-content-panel {\r
  position: fixed;\r
  z-index: calc(var(--pv-z) + 1);\r
  overscroll-behavior: contain;\r
  background-color: var(--popup-surface);\r
  color: var(--popup-text);\r
  box-shadow: var(--popup-shadow);\r
  display: flex;\r
  flex-direction: column;\r
  /* 外壳根固定排版，不继承宿主页面的字号/行高/字距（v2.3.0） */\r
  font-family: var(--pv-font);\r
  font-size: var(--pv-fs-md);\r
  line-height: 1.5;\r
  letter-spacing: normal;\r
  text-transform: none;\r
  -webkit-text-size-adjust: 100%;\r
  color-scheme: light dark;\r
  overflow: hidden;\r
  opacity: 0;\r
  pointer-events: none;\r
  width: var(--popup-width);\r
  height: var(--popup-height);\r
  max-width: min(var(--popup-max-width), calc(100vw - 24px));\r
  max-height: min(var(--popup-max-height), calc(100vh - 24px));\r
  max-height: min(var(--popup-max-height), calc(100dvh - 24px));\r
  top: 50%;\r
  left: 50%;\r
  border: 1px solid var(--popup-border);\r
  border-radius: var(--popup-radius);\r
  transform: translate(-50%, -50%) scale(0.96);\r
  transform-origin: center;\r
  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);\r
}\r
#popup-content-panel.visible {\r
  opacity: 1;\r
  pointer-events: auto;\r
  transform: translate(-50%, -50%) scale(1);\r
}\r
/* 面板自身获得焦点（打开时）不画框；内部控件各自有 :focus-visible */\r
#popup-content-panel:focus {\r
  outline: none;\r
}\r
/* 点选链接期间让开：完全透明且不接收事件 */\r
#popup-content-panel.pv-picking,\r
#popup-panel-overlay.pv-picking {\r
  opacity: 0 !important;\r
  pointer-events: none !important;\r
}\r
/* 全屏：用 class 而不是内联 100vw/100vh，避开滚动条与手机地址栏 */\r
#popup-content-panel.pv-fullscreen {\r
  inset: 0 !important;\r
  width: auto !important;\r
  height: auto !important;\r
  max-width: none !important;\r
  max-height: none !important;\r
  transform: none !important;\r
  border-radius: 0 !important;\r
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px)\r
    env(safe-area-inset-left, 0px);\r
}\r
\r
/* ===== 拖拽 / 缩放反馈 ===== */\r
#popup-content-panel.pv-dragging,\r
#popup-content-panel.pv-resizing {\r
  user-select: none;\r
  box-shadow:\r
    0 0 0 1px var(--popup-accent-soft),\r
    0 0 0 3px var(--popup-focus-ring),\r
    0 28px 70px -20px rgba(15, 23, 42, 0.4),\r
    0 10px 28px -14px rgba(15, 23, 42, 0.26);\r
}\r
.pv-resize {\r
  position: absolute;\r
  z-index: 3;\r
  touch-action: none;\r
}\r
/* 锁定窗体：不可拖动/缩放（视觉反馈：手柄隐藏、标题栏取消拖拽光标） */\r
#popup-content-panel.pv-locked #popup-panel-header {\r
  cursor: default;\r
}\r
#popup-content-panel.pv-locked #popup-panel-header:active {\r
  cursor: default;\r
}\r
#popup-content-panel.pv-locked .pv-resize,\r
#popup-content-panel.pv-locked .pv-resize-knob {\r
  display: none;\r
}\r
/* 触屏大角把手：四角常驻可见的缩放抓手（桌面默认隐藏，coarse 触屏显示） */\r
.pv-resize-knob {\r
  display: none;\r
  position: absolute;\r
  z-index: 4;\r
  touch-action: none;\r
}\r
@media (pointer: coarse) {\r
  /* 半透明小角标，热区用 ::before 扩到 44px：不再用不透明方块盖住网页四角（v2.3.0） */\r
  .pv-resize-knob {\r
    display: flex;\r
    align-items: center;\r
    justify-content: center;\r
    width: 26px;\r
    height: 26px;\r
    border-radius: var(--pv-radius-md);\r
    border: 1px solid var(--popup-border);\r
    background-color: var(--popup-surface);\r
    color: var(--popup-muted);\r
    opacity: 0.55;\r
    box-shadow: var(--popup-shadow-sm);\r
    transition: opacity var(--pv-dur-1) ease, color var(--pv-dur-1) ease;\r
  }\r
  .pv-resize-knob::before {\r
    content: '';\r
    position: absolute;\r
    inset: -9px;\r
  }\r
  .pv-resize-knob:active {\r
    opacity: 1;\r
    color: var(--popup-accent);\r
  }\r
  .pv-resize-knob svg {\r
    width: 18px;\r
    height: 18px;\r
    fill: none;\r
    stroke: currentColor;\r
    pointer-events: none;\r
  }\r
  /* 位置避开标题栏（54px）与底部栏（38px），不与工具栏/页脚按钮重叠 */\r
  .pv-resize-knob-ne { top: 62px; right: 8px; }\r
  .pv-resize-knob-nw { top: 62px; left: 8px; }\r
  .pv-resize-knob-se { bottom: 46px; right: 8px; }\r
  .pv-resize-knob-sw { bottom: 46px; left: 8px; }\r
  /* 图标指向本角方向：se=↘(0°) ne=↗(-90°) nw=↖(180°) sw=↙(90°) */\r
  .pv-resize-knob-ne svg { transform: rotate(-90deg); }\r
  .pv-resize-knob-nw svg { transform: rotate(180deg); }\r
  .pv-resize-knob-sw svg { transform: rotate(90deg); }\r
}\r
/* 移动端设置关闭「四角缩放把手」时隐藏（触屏） */\r
@media (pointer: coarse) {\r
  #popup-content-panel.pv-no-mobile-resize .pv-resize-knob {\r
    display: none;\r
  }\r
}\r
.pv-resize-n { top: 0; left: 10px; right: 10px; height: 6px; cursor: ns-resize; }\r
.pv-resize-s { bottom: 0; left: 10px; right: 10px; height: 6px; cursor: ns-resize; }\r
.pv-resize-e { right: 0; top: 10px; bottom: 10px; width: 6px; cursor: ew-resize; }\r
.pv-resize-w { left: 0; top: 10px; bottom: 10px; width: 6px; cursor: ew-resize; }\r
.pv-resize-ne { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }\r
.pv-resize-nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }\r
.pv-resize-se { bottom: 0; right: 0; width: 12px; height: 12px; cursor: nwse-resize; }\r
.pv-resize-sw { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }\r
\r
/* ===== 面板头部 ===== */\r
#popup-panel-header {\r
  display: flex;\r
  justify-content: space-between;\r
  align-items: center;\r
  gap: 12px;\r
  padding: 0 10px 0 14px;\r
  background-color: var(--popup-header-bg);\r
  border-bottom: 1px solid var(--popup-border);\r
  height: 54px;\r
  min-height: 54px;\r
  box-sizing: border-box;\r
  cursor: grab;\r
  user-select: none;\r
  touch-action: none;\r
}\r
#popup-panel-header:active {\r
  cursor: grabbing;\r
}\r
#popup-panel-title {\r
  display: flex;\r
  align-items: center;\r
  gap: 9px;\r
  min-width: 0;\r
  flex: 1;\r
}\r
.pv-title-mark {\r
  flex: 0 0 auto;\r
  width: 26px;\r
  height: 26px;\r
  border-radius: 8px;\r
  background: var(--popup-accent-soft);\r
  color: var(--popup-accent);\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
}\r
.pv-title-text {\r
  font-size: var(--pv-fs-lg);\r
  font-weight: 600;\r
  letter-spacing: 0.1px;\r
  color: var(--popup-text);\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
#popup-panel-actions {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  flex: 0 0 auto;\r
}\r
/* 图标按钮：主面板与规则面板共用（规则面板关闭按钮此前拿不到这些基础样式） */\r
:is(#popup-content-panel, #pv-rules-panel) .popup-panel-btn {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  position: relative;\r
  margin: 0;\r
  background-color: var(--popup-btn-bg);\r
  border: 1px solid transparent;\r
  border-radius: var(--pv-radius-md);\r
  width: 34px;\r
  height: 34px;\r
  padding: 0;\r
  box-sizing: border-box;\r
  cursor: pointer;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  flex: 0 0 auto;\r
  font: inherit;\r
  color: var(--popup-muted);\r
  transition: background-color var(--pv-dur-1) ease, color var(--pv-dur-1) ease, transform 80ms ease;\r
}\r
:is(#popup-content-panel, #pv-rules-panel) .popup-panel-btn svg {\r
  display: block;\r
  width: 16px;\r
  height: 16px;\r
  fill: none;\r
  stroke: currentColor;\r
  pointer-events: none;\r
}\r
@media (hover: hover) {\r
  :is(#popup-content-panel, #pv-rules-panel) .popup-panel-btn:hover {\r
    background-color: var(--popup-btn-hover);\r
    color: var(--popup-text);\r
  }\r
  #popup-content-panel .popup-panel-btn#popup-panel-close:hover,\r
  #pv-rules-panel .popup-panel-btn:hover {\r
    color: var(--popup-danger);\r
    background-color: var(--popup-danger-soft);\r
  }\r
  #popup-content-panel .popup-panel-btn#popup-panel-refresh:hover,\r
  #popup-content-panel .popup-panel-btn#popup-panel-open-in-new:hover,\r
  #popup-content-panel .popup-panel-btn#popup-panel-maximize:hover {\r
    color: var(--popup-accent);\r
    background-color: var(--popup-accent-soft);\r
  }\r
}\r
:is(#popup-content-panel, #pv-rules-panel) .popup-panel-btn:active {\r
  transform: scale(0.94);\r
  background-color: var(--popup-btn-active);\r
}\r
:is(#popup-content-panel, #pv-rules-panel) .popup-panel-btn:focus-visible {\r
  outline: 2px solid var(--popup-focus);\r
  outline-offset: 2px;\r
}\r
#popup-content-panel .popup-panel-btn.active {\r
  color: var(--popup-accent);\r
  background-color: var(--popup-accent-soft);\r
}\r
\r
/* ===== 内容区域 ===== */\r
#popup-content-area {\r
  flex: 1;\r
  overflow-y: auto;\r
  overscroll-behavior: contain;\r
  position: relative;\r
  background-color: var(--popup-bg);\r
  padding: 20px;\r
  box-sizing: border-box;\r
  scroll-behavior: smooth;\r
  scrollbar-width: thin;\r
  scrollbar-color: var(--popup-faint) transparent;\r
}\r
#popup-content-area::-webkit-scrollbar {\r
  width: 8px;\r
}\r
#popup-content-area::-webkit-scrollbar-thumb {\r
  background-color: var(--popup-faint);\r
  border-radius: 8px;\r
  border: 2px solid transparent;\r
  background-clip: padding-box;\r
}\r
#popup-content-area::-webkit-scrollbar-thumb:hover {\r
  background-color: var(--popup-muted);\r
  background-clip: padding-box;\r
}\r
#popup-content-area.iframe-direct-load {\r
  padding: 0;\r
  /* iframe 自己负责滚动：外壳不再产生第二条滚动条（v2.3.1） */\r
  overflow: hidden;\r
}\r
/* 设置：隐藏窗体滚动条 */\r
#popup-content-area.pv-hide-scrollbar {\r
  scrollbar-width: none;\r
  -ms-overflow-style: none;\r
}\r
#popup-content-area.pv-hide-scrollbar::-webkit-scrollbar {\r
  display: none;\r
}\r
\r
/* ===== 设置面板 ===== */\r
#popup-settings-popover {\r
  position: fixed;\r
  width: 340px;\r
  max-width: calc(100vw - 16px);\r
  z-index: calc(var(--pv-z) + 3);\r
  /* 桌面固定限高，避免内容增多后忽大忽小；内部滚动 */\r
  max-height: min(560px, calc(100vh - 32px));\r
  max-height: min(560px, calc(100dvh - 32px));\r
  overflow-y: auto;\r
  overflow-x: clip;\r
  /* 预留滚动条槽：切换 tab 时内容长短变化不再让面板左右抖一下 */\r
  scrollbar-gutter: stable;\r
  background-color: var(--popup-surface);\r
  color: var(--popup-text);\r
  font-family: var(--pv-font);\r
  border: 1px solid var(--popup-border);\r
  border-radius: var(--pv-radius-lg);\r
  box-shadow: var(--popup-shadow);\r
  /* 底部不留内边距，sticky 页脚贴底（S4） */\r
  padding: 0 6px 0;\r
  box-sizing: border-box;\r
  font-size: var(--pv-fs-sm);\r
  /* 细滚动条，提示下方还有内容（S4） */\r
  scrollbar-width: thin;\r
  scrollbar-color: var(--popup-border-strong) transparent;\r
  opacity: 0;\r
  pointer-events: none;\r
  transform: translateY(-6px);\r
  transition: opacity 0.18s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);\r
}\r
#popup-settings-popover.visible {\r
  opacity: 1;\r
  pointer-events: auto;\r
  transform: translateY(0);\r
}\r
/* 手机/窄屏：全宽底部 sheet（由 PopupPanel.showSettingsNear 加 class） */\r
#popup-settings-popover.pv-settings-sheet {\r
  width: 100vw;\r
  max-width: 100vw;\r
  max-height: min(85dvh, 720px);\r
  border-radius: 16px 16px 0 0;\r
  border-left: 0;\r
  border-right: 0;\r
  border-bottom: 0;\r
  padding-bottom: max(8px, env(safe-area-inset-bottom));\r
}\r
#popup-settings-popover.pv-settings-sheet .pv-settings-head {\r
  padding-top: 10px;\r
}\r
#popup-settings-popover::-webkit-scrollbar {\r
  width: 6px;\r
}\r
#popup-settings-popover::-webkit-scrollbar-thumb {\r
  background-color: var(--popup-border-strong);\r
  border-radius: 3px;\r
}\r
#popup-settings-popover::-webkit-scrollbar-track {\r
  background: transparent;\r
}\r
/* 滚动容器顶部：标题 + 关闭 + tab 一起吸顶（S2） */\r
.pv-settings-top {\r
  position: sticky;\r
  top: 0;\r
  z-index: 3;\r
  margin: 0 -6px 0;\r
  padding: 6px 6px 0;\r
  background-color: var(--popup-surface);\r
}\r
/* 弹窗头：标题 + 关闭按钮（小屏上弹窗可能盖住 ⚙ 锚点，独立关闭入口） */\r
.pv-settings-head {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: 4px 6px 10px;\r
  border-bottom: 1px solid var(--popup-border);\r
}\r
/* 通用 / 移动端 标签：与 .pv-seg 分段控件同风格（胶囊按钮） */\r
.pv-settings-tabs {\r
  display: flex;\r
  gap: 6px;\r
  padding: 2px 6px 10px;\r
  background-color: var(--popup-surface);\r
}\r
.pv-settings-tab {\r
  flex: 1;\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 4px;\r
  border: 1px solid var(--popup-border);\r
  background: transparent;\r
  color: var(--popup-muted);\r
  font-size: 12px;\r
  padding: 5px 8px;\r
  border-radius: 999px;\r
  cursor: pointer;\r
  white-space: nowrap;\r
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;\r
}\r
@media (hover: hover) {\r
  .pv-settings-tab:hover {\r
    color: var(--popup-text);\r
    border-color: var(--popup-muted);\r
  }\r
}\r
.pv-settings-tab.active {\r
  background-color: var(--popup-accent-soft);\r
  border-color: var(--popup-accent);\r
  color: var(--popup-accent);\r
  font-weight: 600;\r
}\r
.pv-settings-pane {\r
  display: none;\r
}\r
.pv-settings-pane.active {\r
  display: block;\r
}\r
.pv-settings-title {\r
  font-size: 14px;\r
  font-weight: 600;\r
  color: var(--popup-text);\r
}\r
.pv-settings-close {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  margin: 0;\r
  border: 1px solid transparent;\r
  border-radius: 8px;\r
  background-color: var(--popup-btn-bg);\r
  color: var(--popup-muted);\r
  width: 30px;\r
  height: 30px;\r
  padding: 0;\r
  box-sizing: border-box;\r
  cursor: pointer;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;\r
}\r
@media (hover: hover) {\r
  .pv-settings-close:hover {\r
    background-color: var(--popup-btn-hover);\r
    color: var(--popup-text);\r
  }\r
}\r
.pv-settings-close:active {\r
  transform: scale(0.92);\r
}\r
.pv-settings-close svg {\r
  width: 14px;\r
  height: 14px;\r
  fill: none;\r
  stroke: currentColor;\r
  pointer-events: none;\r
}\r
.pv-settings-group {\r
  margin-top: 10px;\r
  padding-top: 10px;\r
  border-top: 1px solid var(--popup-border);\r
}\r
.pv-settings-group:first-child {\r
  margin-top: 0;\r
  padding-top: 0;\r
  border-top: none;\r
}\r
.pv-settings-group-title {\r
  font-size: var(--pv-fs-xs);\r
  font-weight: 600;\r
  color: var(--popup-muted);\r
  padding: 0 6px 6px;\r
}\r
.pv-settings-item {\r
  padding: 7px 6px;\r
  border-radius: 8px;\r
}\r
@media (hover: hover) {\r
  .pv-settings-item:hover {\r
    background-color: var(--popup-btn-hover);\r
  }\r
}\r
.pv-settings-item-head {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 12px;\r
}\r
.pv-settings-item-head + .pv-seg {\r
  margin-top: 8px;\r
}\r
.pv-settings-title-col {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 2px;\r
  min-width: 0;\r
}\r
.pv-settings-label-line {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
}\r
.pv-settings-label {\r
  font-size: 13px;\r
  font-weight: 600;\r
  color: var(--popup-text);\r
}\r
.pv-settings-sub {\r
  font-size: var(--pv-fs-xs);\r
  line-height: 1.4;\r
  color: var(--popup-muted);\r
}\r
.pv-settings-tip {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 16px;\r
  height: 16px;\r
  padding: 0;\r
  border: none;\r
  border-radius: 50%;\r
  background: transparent;\r
  color: var(--popup-muted);\r
  cursor: pointer;\r
  flex: 0 0 auto;\r
}\r
@media (hover: hover) {\r
  .pv-settings-tip:hover {\r
    color: var(--popup-accent);\r
    background-color: var(--popup-accent-soft);\r
  }\r
}\r
.pv-settings-phone-models {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 6px;\r
  margin-top: 8px;\r
  padding-top: 8px;\r
  border-top: 1px dashed var(--popup-border);\r
}\r
.pv-settings-phone-models.hidden {\r
  display: none;\r
}\r
#pv-settings-tip {\r
  position: fixed;\r
  z-index: calc(var(--pv-z) + 6);\r
  width: 220px;\r
  padding: 8px 10px;\r
  background-color: var(--popup-text);\r
  color: var(--popup-bg);\r
  font-size: 12px;\r
  line-height: 1.5;\r
  border-radius: 8px;\r
  box-shadow: var(--popup-shadow);\r
  pointer-events: none;\r
}\r
#pv-settings-tip.hidden {\r
  display: none;\r
}\r
.pv-settings-footer {\r
  display: flex;\r
  justify-content: center;\r
  padding: 10px 0 2px;\r
  border-top: 1px solid var(--popup-border);\r
  margin-top: 4px;\r
}\r
.pv-settings-reset {\r
  border: 1px solid var(--popup-border);\r
  background: transparent;\r
  color: var(--popup-muted);\r
  border-radius: 999px;\r
  padding: 5px 18px;\r
  font-size: 12px;\r
  cursor: pointer;\r
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;\r
}\r
@media (hover: hover) {\r
  .pv-settings-reset:hover {\r
    color: var(--popup-danger);\r
    border-color: var(--popup-danger-soft);\r
    background-color: var(--popup-danger-soft);\r
  }\r
}\r
.pv-settings-reset:focus-visible {\r
  outline: 2px solid var(--popup-focus);\r
  outline-offset: 2px;\r
}\r
/* 开关 */\r
.pv-switch {\r
  position: relative;\r
  display: inline-block;\r
  width: 38px;\r
  height: 22px;\r
  flex: 0 0 auto;\r
  cursor: pointer;\r
}\r
.pv-switch input {\r
  position: absolute;\r
  opacity: 0;\r
  width: 0;\r
  height: 0;\r
}\r
.pv-switch-track {\r
  position: absolute;\r
  inset: 0;\r
  border-radius: 999px;\r
  background-color: var(--popup-border-strong);\r
  transition: background-color 0.2s ease;\r
}\r
.pv-switch-track::after {\r
  content: '';\r
  position: absolute;\r
  left: 2px;\r
  top: 2px;\r
  width: 18px;\r
  height: 18px;\r
  border-radius: 50%;\r
  background-color: #fff;\r
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);\r
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);\r
}\r
.pv-switch input:checked + .pv-switch-track {\r
  background-color: var(--popup-accent);\r
}\r
.pv-switch input:checked + .pv-switch-track::after {\r
  transform: translateX(16px);\r
}\r
.pv-switch input:focus-visible + .pv-switch-track {\r
  outline: 2px solid var(--popup-focus);\r
  outline-offset: 2px;\r
}\r
/* 分段控件（胶囊式） */\r
.pv-seg {\r
  display: flex;\r
  gap: 6px;\r
  padding: 0;\r
  background: transparent;\r
}\r
.pv-seg-item {\r
  flex: 1;\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 4px;\r
  border: 1px solid var(--popup-border);\r
  background: transparent;\r
  color: var(--popup-muted);\r
  font-size: 12px;\r
  padding: 5px 8px;\r
  border-radius: 999px;\r
  cursor: pointer;\r
  white-space: nowrap;\r
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;\r
}\r
@media (hover: hover) {\r
  .pv-seg-item:hover {\r
    color: var(--popup-text);\r
    border-color: var(--popup-muted);\r
  }\r
}\r
.pv-seg-item.active {\r
  background-color: var(--popup-accent-soft);\r
  border-color: var(--popup-accent);\r
  color: var(--popup-accent);\r
  font-weight: 600;\r
}\r
.pv-seg-item:focus-visible {\r
  outline: 2px solid var(--popup-focus);\r
  outline-offset: 2px;\r
}\r
\r
/* ---- 2.2.x：sticky 页脚、作用范围标签、不可选说明、最近列表、焦点与触屏热区 ---- */\r
#popup-settings-popover .pv-settings-footer {\r
  position: sticky;\r
  bottom: 0;\r
  z-index: 1;\r
  margin: 4px -6px 0;\r
  padding: 10px 6px 8px;\r
  background-color: var(--popup-surface);\r
}\r
.pv-settings-footer.hidden,\r
.pv-settings-note.hidden,\r
.pv-seg-item.hidden,\r
.pv-recent-clear.hidden {\r
  display: none !important;\r
}\r
.pv-settings-scope {\r
  flex: 0 0 auto;\r
  padding: 0 5px;\r
  border: 1px solid var(--popup-border);\r
  border-radius: var(--pv-radius-sm);\r
  color: var(--popup-muted);\r
  font-size: var(--pv-fs-xs);\r
  font-weight: 400;\r
  line-height: 16px;\r
  white-space: nowrap;\r
}\r
.pv-settings-note {\r
  margin-top: 6px;\r
  color: var(--popup-muted);\r
  font-size: var(--pv-fs-xs);\r
  line-height: 1.4;\r
}\r
.pv-seg-item:disabled {\r
  cursor: not-allowed;\r
  color: var(--popup-faint);\r
  background: transparent;\r
  text-decoration: line-through;\r
}\r
.pv-settings-reset.confirming {\r
  color: var(--popup-danger);\r
  border-color: var(--popup-danger);\r
  background-color: var(--popup-danger-soft);\r
}\r
.pv-recent-head {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 8px;\r
  padding: 0 0 6px;\r
}\r
.pv-recent-head .pv-settings-group-title {\r
  padding-bottom: 0;\r
}\r
.pv-recent-list {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 2px;\r
  padding-bottom: 8px;\r
}\r
.pv-recent-item {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 2px;\r
  width: 100%;\r
  padding: 7px 6px;\r
  border: none;\r
  border-radius: var(--pv-radius-md);\r
  background: transparent;\r
  color: var(--popup-text);\r
  text-align: left;\r
  cursor: pointer;\r
}\r
.pv-recent-title {\r
  display: -webkit-box;\r
  -webkit-line-clamp: 2;\r
  -webkit-box-orient: vertical;\r
  overflow: hidden;\r
  font-size: var(--pv-fs-sm);\r
  line-height: 1.4;\r
  white-space: normal;\r
}\r
.pv-recent-meta,\r
.pv-recent-empty {\r
  color: var(--popup-muted);\r
  font-size: var(--pv-fs-xs);\r
}\r
.pv-recent-empty {\r
  padding: 16px 6px;\r
  text-align: center;\r
}\r
@media (hover: hover) {\r
  .pv-recent-item:hover {\r
    background-color: var(--popup-btn-hover);\r
  }\r
}\r
.pv-settings-close:focus-visible,\r
.pv-settings-tip:focus-visible,\r
.pv-settings-tab:focus-visible,\r
.pv-settings-reset:focus-visible,\r
.pv-seg-item:focus-visible,\r
.pv-recent-item:focus-visible,\r
.pv-switch input:focus-visible + .pv-switch-track {\r
  outline: 2px solid var(--popup-focus);\r
  outline-offset: 2px;\r
}\r
@media (pointer: coarse) {\r
  .pv-settings-close,\r
  .pv-settings-tab,\r
  .pv-settings-reset,\r
  .pv-seg-item,\r
  .pv-recent-item {\r
    min-height: var(--pv-hit);\r
  }\r
  .pv-settings-close {\r
    min-width: var(--pv-hit);\r
  }\r
  .pv-settings-tip,\r
  .pv-switch {\r
    position: relative;\r
  }\r
  .pv-settings-tip::before,\r
  .pv-switch::before {\r
    content: '';\r
    position: absolute;\r
    top: 50%;\r
    left: 50%;\r
    width: var(--pv-hit);\r
    height: var(--pv-hit);\r
    transform: translate(-50%, -50%);\r
  }\r
}\r
\r
/* ===== 链接规则面板 ===== */\r
#pv-rules-panel-backdrop {\r
  position: fixed;\r
  inset: 0;\r
  z-index: calc(var(--pv-z) + 4);\r
  background-color: var(--popup-overlay);\r
  opacity: 0;\r
  pointer-events: none;\r
  transition: opacity 0.2s ease;\r
}\r
#pv-rules-panel-backdrop.visible {\r
  opacity: 1;\r
  pointer-events: auto;\r
}\r
#pv-rules-panel {\r
  position: fixed;\r
  z-index: calc(var(--pv-z) + 5);\r
  width: 440px;\r
  max-width: calc(100vw - 24px);\r
  max-height: calc(100vh - 48px);\r
  top: 50%;\r
  left: 50%;\r
  transform: translate(-50%, -48%) scale(0.97);\r
  background-color: var(--popup-surface);\r
  color: var(--popup-text);\r
  font-family: var(--pv-font);\r
  border: 1px solid var(--popup-border);\r
  border-radius: var(--pv-radius-lg);\r
  box-shadow: var(--popup-shadow);\r
  display: flex;\r
  flex-direction: column;\r
  font-size: 13px;\r
  overflow: hidden;\r
  opacity: 0;\r
  pointer-events: none;\r
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);\r
}\r
#pv-rules-panel.visible {\r
  opacity: 1;\r
  pointer-events: auto;\r
  transform: translate(-50%, -50%) scale(1);\r
}\r
#pv-rules-panel-header {\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
  padding: 12px 14px;\r
  border-bottom: 1px solid var(--popup-border);\r
  background-color: var(--popup-header-bg);\r
  flex: 0 0 auto;\r
}\r
.pv-rules-title {\r
  font-size: 14px;\r
  font-weight: 600;\r
}\r
#pv-rules-host {\r
  flex: 1;\r
  font-size: var(--pv-fs-xs);\r
  color: var(--popup-muted);\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
#pv-rules-panel-body {\r
  padding: 14px;\r
  overflow-y: auto;\r
  display: flex;\r
  flex-direction: column;\r
  gap: 12px;\r
}\r
.pv-rules-tip {\r
  font-size: var(--pv-fs-xs);\r
  line-height: 1.5;\r
  color: var(--popup-muted);\r
}\r
#pv-rules-list {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 8px;\r
}\r
.pv-rules-empty {\r
  color: var(--popup-muted);\r
  text-align: center;\r
  padding: 18px 0;\r
  border: 1px dashed var(--popup-border);\r
  border-radius: 10px;\r
}\r
.pv-rules-row {\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
  padding: 9px 12px;\r
  border: 1px solid var(--popup-border);\r
  border-radius: 10px;\r
  background-color: var(--popup-bg);\r
}\r
.pv-rules-row-info {\r
  flex: 1;\r
  min-width: 0;\r
  display: flex;\r
  flex-direction: column;\r
  gap: 3px;\r
}\r
.pv-rules-row-sel {\r
  font-family: Consolas, 'Courier New', monospace;\r
  font-size: 12px;\r
  color: var(--popup-accent);\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
.pv-rules-row-count {\r
  font-size: var(--pv-fs-xs);\r
  color: var(--popup-muted);\r
}\r
.pv-rules-del {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 28px;\r
  height: 28px;\r
  padding: 0;\r
  border: 1px solid var(--popup-border);\r
  border-radius: 7px;\r
  background: transparent;\r
  color: var(--popup-muted);\r
  cursor: pointer;\r
  flex: 0 0 auto;\r
}\r
@media (hover: hover) {\r
  .pv-rules-del:hover {\r
    color: var(--popup-danger);\r
    border-color: var(--popup-danger-soft);\r
    background-color: var(--popup-danger-soft);\r
  }\r
}\r
.pv-rules-del.confirming {\r
  color: var(--popup-on-accent);\r
  background-color: var(--popup-danger);\r
  border-color: var(--popup-danger);\r
}\r
#pv-rules-pick {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 6px;\r
  background-color: var(--popup-accent);\r
  border: 1px solid var(--popup-accent);\r
  color: var(--popup-on-accent);\r
  font-weight: 500;\r
  padding: 8px 16px;\r
  border-radius: 8px;\r
  cursor: pointer;\r
  transition: background 0.15s ease;\r
}\r
@media (hover: hover) {\r
  #pv-rules-pick:hover {\r
    background-color: var(--popup-accent-hover);\r
  }\r
}\r
#pv-rules-pick:disabled {\r
  opacity: 0.5;\r
  cursor: not-allowed;\r
}\r
#pv-rules-pick svg {\r
  width: 14px;\r
  height: 14px;\r
}\r
#pv-rules-panel .popup-panel-btn {\r
  width: 30px;\r
  height: 30px;\r
  padding: 0;\r
}\r
@media (hover: hover) {\r
  #pv-rules-panel .popup-panel-btn:hover {\r
    color: var(--popup-danger);\r
    background-color: var(--popup-danger-soft);\r
  }\r
}\r
#pv-rules-toast {\r
  position: fixed;\r
  left: 50%;\r
  bottom: 28px;\r
  transform: translateX(-50%) translateY(8px);\r
  z-index: calc(var(--pv-z) + 7);\r
  background-color: var(--popup-text);\r
  color: var(--popup-bg);\r
  font-family: var(--pv-font);\r
  font-size: 12px;\r
  padding: 8px 16px;\r
  border-radius: 999px;\r
  opacity: 0;\r
  pointer-events: none;\r
  box-shadow: var(--popup-shadow);\r
  transition: opacity 0.18s ease, transform 0.18s ease;\r
}\r
#pv-rules-toast.visible {\r
  opacity: 1;\r
  transform: translateX(-50%) translateY(0);\r
}\r
\r
/* ---- 2.2.x：全部站点、启停、编辑、撤销删除、焦点与触屏热区 ---- */\r
#pv-rules-pick.hidden,\r
.pv-rules-tip.hidden,\r
.pv-rules-back.hidden,\r
.pv-rules-toast-action.hidden {\r
  display: none !important;\r
}\r
#pv-rules-panel .pv-rules-close {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 30px;\r
  height: 30px;\r
  padding: 0;\r
  border: 1px solid transparent;\r
  border-radius: var(--pv-radius-md);\r
  background-color: var(--popup-btn-bg);\r
  color: var(--popup-muted);\r
  cursor: pointer;\r
}\r
#pv-rules-panel .pv-rules-close svg {\r
  width: 15px;\r
  height: 15px;\r
  fill: none;\r
  stroke: currentColor;\r
  pointer-events: none;\r
}\r
.pv-rules-all,\r
.pv-rules-edit,\r
.pv-rules-back,\r
.pv-rules-toast-action {\r
  flex: 0 0 auto;\r
  padding: 4px 10px;\r
  border: 1px solid var(--popup-border-strong);\r
  border-radius: 999px;\r
  background: transparent;\r
  color: var(--popup-text);\r
  font-size: var(--pv-fs-xs);\r
  white-space: nowrap;\r
  cursor: pointer;\r
}\r
.pv-rules-all.active {\r
  border-color: var(--popup-accent);\r
  background-color: var(--popup-accent-soft);\r
  color: var(--popup-accent);\r
}\r
.pv-rules-back {\r
  align-self: center;\r
  margin-top: 8px;\r
}\r
.pv-rules-row.is-disabled .pv-rules-row-sel {\r
  color: var(--popup-muted);\r
  text-decoration: line-through;\r
}\r
.pv-rules-row.is-editing {\r
  align-items: flex-start;\r
}\r
.pv-rules-toggle {\r
  flex: 0 0 auto;\r
}\r
.pv-rules-edit-input {\r
  width: 100%;\r
  box-sizing: border-box;\r
  padding: 6px 9px;\r
  border: 1px solid var(--popup-border-strong);\r
  border-radius: var(--pv-radius-md);\r
  background-color: var(--popup-bg);\r
  color: var(--popup-text);\r
  font-family: var(--pv-mono);\r
  font-size: var(--pv-fs-xs);\r
}\r
.pv-rules-del .pv-rules-del-text {\r
  display: none;\r
}\r
.pv-rules-del.confirming {\r
  width: auto;\r
  padding: 0 8px;\r
  gap: 4px;\r
}\r
.pv-rules-del.confirming .pv-rules-del-text {\r
  display: inline;\r
  font-size: var(--pv-fs-xs);\r
  white-space: nowrap;\r
}\r
.pv-rules-host-row {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 8px;\r
  width: 100%;\r
  padding: 9px 10px;\r
  border: 1px solid var(--popup-border);\r
  border-radius: var(--pv-radius-md);\r
  background: transparent;\r
  color: var(--popup-text);\r
  text-align: left;\r
  cursor: pointer;\r
}\r
.pv-rules-host-row.is-current {\r
  border-color: var(--popup-accent);\r
}\r
.pv-rules-host-name {\r
  overflow: hidden;\r
  font-size: var(--pv-fs-sm);\r
  white-space: nowrap;\r
  text-overflow: ellipsis;\r
}\r
.pv-rules-host-count {\r
  flex: 0 0 auto;\r
  color: var(--popup-muted);\r
  font-size: var(--pv-fs-xs);\r
}\r
#pv-rules-toast {\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
}\r
.pv-rules-toast-action {\r
  border-color: currentColor;\r
  color: inherit;\r
}\r
@media (hover: hover) {\r
  #pv-rules-panel .pv-rules-close:hover,\r
  .pv-rules-all:hover,\r
  .pv-rules-edit:hover,\r
  .pv-rules-back:hover,\r
  .pv-rules-host-row:hover {\r
    background-color: var(--popup-btn-hover);\r
  }\r
}\r
#pv-rules-panel button:focus-visible,\r
#pv-rules-toast button:focus-visible,\r
.pv-rules-edit-input:focus-visible,\r
.pv-rules-toggle input:focus-visible + .pv-switch-track {\r
  outline: 2px solid var(--popup-focus);\r
  outline-offset: 2px;\r
}\r
@media (pointer: coarse) {\r
  #pv-rules-panel button,\r
  #pv-rules-toast button {\r
    min-height: var(--pv-hit);\r
  }\r
  #pv-rules-panel .pv-rules-close,\r
  .pv-rules-del {\r
    min-width: var(--pv-hit);\r
  }\r
}\r
\r
/* ===== 取选链接模式 ===== */\r
.pv-picker-overlay {\r
  position: fixed;\r
  inset: 0;\r
  z-index: calc(var(--pv-z) + 8);\r
  background-color: rgba(15, 23, 42, 0.35);\r
  pointer-events: none;\r
}\r
.pv-picker-bar {\r
  position: fixed;\r
  z-index: calc(var(--pv-z) + 9);\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
  padding: 10px 14px;\r
  border-radius: 10px;\r
  font-size: 13px;\r
  color: var(--popup-text);\r
  background-color: var(--popup-surface);\r
  border: 1px solid var(--popup-border);\r
  box-shadow: var(--popup-shadow);\r
  font-family: var(--pv-font);\r
  pointer-events: none;\r
}\r
#pv-picker-hint {\r
  top: 16px;\r
  left: 50%;\r
  transform: translateX(-50%);\r
  max-width: calc(100vw - 24px);\r
  white-space: nowrap;\r
}\r
#pv-picker-hint b {\r
  font-weight: 700;\r
}\r
.pv-picker-confirm {\r
  position: fixed;\r
  bottom: 20px;\r
  left: 50%;\r
  transform: translateX(-50%);\r
  z-index: calc(var(--pv-z) + 9);\r
  width: min(560px, calc(100vw - 24px));\r
  max-height: calc(100vh - 48px);\r
  overflow-y: auto;\r
  padding: 12px 14px;\r
  border-radius: 12px;\r
  font-size: 13px;\r
  color: var(--popup-text);\r
  background-color: var(--popup-surface);\r
  border: 1px solid var(--popup-border);\r
  box-shadow: var(--popup-shadow);\r
  font-family: var(--pv-font);\r
  display: flex;\r
  flex-direction: column;\r
  gap: 8px;\r
}\r
.pv-picker-confirm.hidden,\r
#pv-picker-hint.hidden,\r
.pv-picker-highlight.hidden {\r
  display: none;\r
}\r
.pv-picker-c-title {\r
  font-weight: 600;\r
  font-size: 13px;\r
}\r
.pv-picker-cands {\r
  display: flex;\r
  flex-wrap: wrap;\r
  gap: 6px;\r
  max-height: 140px;\r
  overflow-y: auto;\r
}\r
.pv-picker-cand {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
  border: 1px solid var(--popup-border);\r
  background: transparent;\r
  color: var(--popup-muted);\r
  border-radius: 8px;\r
  padding: 4px 9px;\r
  font-size: 12px;\r
  cursor: pointer;\r
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;\r
}\r
.pv-picker-cand.is-on {\r
  border-color: var(--popup-accent);\r
  color: var(--popup-accent);\r
  background-color: var(--popup-accent-soft);\r
}\r
.pv-picker-cand-sel {\r
  max-width: 100%;\r
  overflow: hidden;\r
  color: var(--popup-text);\r
  font-family: var(--pv-mono);\r
  font-size: 12px;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.pv-picker-cand.is-on .pv-picker-cand-sel {\r
  color: var(--popup-accent);\r
}\r
.pv-picker-cand code {\r
  font-family: var(--pv-mono);\r
  font-size: var(--pv-fs-xs);\r
}\r
.pv-picker-cand em {\r
  font-style: normal;\r
  color: var(--popup-muted);\r
  font-size: var(--pv-fs-xs);\r
}\r
.pv-picker-input {\r
  padding: 6px 9px;\r
  border: 1px solid var(--popup-border-strong);\r
  border-radius: 8px;\r
  background-color: var(--popup-bg);\r
  color: var(--popup-text);\r
  font-family: var(--pv-mono);\r
  font-size: 12px;\r
  outline: none;\r
  transition: border-color 0.15s ease, box-shadow 0.15s ease;\r
}\r
.pv-picker-input:focus {\r
  border-color: var(--popup-accent);\r
  box-shadow: 0 0 0 3px var(--popup-focus-ring);\r
}\r
.pv-picker-c-meta {\r
  font-size: 12px;\r
  color: var(--popup-muted);\r
}\r
.pv-picker-c-btns {\r
  display: flex;\r
  justify-content: flex-end;\r
  gap: 8px;\r
}\r
.pv-picker-btn {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  border: 1px solid var(--popup-border);\r
  background: transparent;\r
  color: var(--popup-muted);\r
  border-radius: 8px;\r
  padding: 5px 14px;\r
  font-size: 12px;\r
  cursor: pointer;\r
  transition: background 0.15s ease, color 0.15s ease;\r
}\r
@media (hover: hover) {\r
  .pv-picker-btn:hover {\r
    color: var(--popup-accent);\r
    border-color: var(--popup-accent-soft);\r
    background-color: var(--popup-accent-soft);\r
  }\r
}\r
.pv-picker-btn.primary {\r
  background-color: var(--popup-accent);\r
  border-color: var(--popup-accent);\r
  color: var(--popup-on-accent);\r
  font-weight: 500;\r
}\r
@media (hover: hover) {\r
  .pv-picker-btn.primary:hover {\r
    background-color: var(--popup-accent-hover);\r
    color: var(--popup-on-accent);\r
  }\r
}\r
.pv-picker-highlight {\r
  position: fixed;\r
  z-index: calc(var(--pv-z) + 10);\r
  pointer-events: none;\r
  border: 2px solid var(--popup-accent);\r
  border-radius: 4px;\r
  background-color: var(--popup-accent-soft);\r
}\r
\r
/* ---- 2.2.x：全部命中高亮、提示条「取消」、通俗候选与「高级」、焦点与触屏热区 ---- */\r
.pv-picker-hits {\r
  position: fixed;\r
  inset: 0;\r
  z-index: calc(var(--pv-z) + 8);\r
  pointer-events: none;\r
}\r
.pv-picker-hit {\r
  position: fixed;\r
  box-sizing: border-box;\r
  border: 1px dashed var(--popup-accent);\r
  border-radius: 3px;\r
  background-color: var(--popup-accent-soft);\r
  pointer-events: none;\r
}\r
.pv-picker-bar {\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
}\r
.pv-picker-bar-text {\r
  min-width: 0;\r
}\r
.pv-picker-bar-cancel {\r
  flex: 0 0 auto;\r
  padding: 3px 12px;\r
  border: 1px solid currentColor;\r
  border-radius: 999px;\r
  background: transparent;\r
  color: inherit;\r
  font-size: var(--pv-fs-xs);\r
  cursor: pointer;\r
}\r
.pv-picker-cand-desc {\r
  font-size: var(--pv-fs-sm);\r
  font-weight: 600;\r
  color: var(--popup-text);\r
}\r
.pv-picker-cand.is-block .pv-picker-cand-desc {\r
  font-weight: 400;\r
}\r
.pv-picker-adv {\r
  color: var(--popup-muted);\r
  font-size: var(--pv-fs-xs);\r
}\r
.pv-picker-adv > summary {\r
  padding: 4px 0;\r
  cursor: pointer;\r
}\r
.pv-picker-adv[open] > summary {\r
  margin-bottom: 6px;\r
}\r
.pv-picker-adv .pv-picker-input {\r
  width: 100%;\r
  box-sizing: border-box;\r
}\r
.pv-picker-confirm button:focus-visible,\r
.pv-picker-bar-cancel:focus-visible,\r
.pv-picker-adv > summary:focus-visible,\r
.pv-picker-input:focus-visible {\r
  outline: 2px solid var(--popup-focus);\r
  outline-offset: 2px;\r
}\r
@media (pointer: coarse) {\r
  .pv-picker-btn,\r
  .pv-picker-cand,\r
  .pv-picker-bar-cancel,\r
  .pv-picker-adv > summary {\r
    min-height: var(--pv-hit);\r
  }\r
}\r
\r
/* ===== 独立悬浮设置按钮 ===== */\r
#pv-float-settings {\r
  position: fixed;\r
  right: 20px;\r
  /* 抬高到 iPhone 刘海屏 home 指示条安全区之上，避免被遮住/误触 */\r
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));\r
  right: calc(20px + env(safe-area-inset-right, 0px));\r
  z-index: calc(var(--pv-z) + 2);\r
  width: var(--pv-hit);\r
  height: var(--pv-hit);\r
  padding: 0;\r
  border-radius: 50%;\r
  border: 1px solid var(--popup-border);\r
  background-color: var(--popup-surface);\r
  color: var(--popup-muted);\r
  box-shadow: var(--popup-shadow-sm);\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  cursor: pointer;\r
  transition: transform 80ms ease, box-shadow var(--pv-dur-1) ease, color var(--pv-dur-1) ease;\r
}\r
#pv-float-settings svg {\r
  width: 18px;\r
  height: 18px;\r
  fill: none;\r
  stroke: currentColor;\r
  pointer-events: none;\r
}\r
@media (hover: hover) {\r
  #pv-float-settings:hover {\r
    color: var(--popup-accent);\r
    box-shadow: var(--popup-shadow-md);\r
  }\r
}\r
#pv-float-settings:active {\r
  transform: scale(0.94);\r
}\r
#pv-float-settings:focus-visible {\r
  outline: 2px solid var(--popup-focus);\r
  outline-offset: 2px;\r
}\r
#pv-float-settings.hidden {\r
  display: none;\r
}\r
\r
/* ===== 加载状态 ===== */\r
#popup-panel-loading {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  justify-content: center;\r
  height: 100%;\r
  color: var(--popup-muted);\r
  padding: 24px;\r
  font-family: var(--pv-font);\r
  font-size: var(--pv-fs-sm);\r
  line-height: 1.5;\r
}\r
.pv-loading-open {\r
  margin-top: 16px;\r
  padding: 8px 16px;\r
  border: 1px solid var(--popup-border-strong);\r
  border-radius: var(--pv-radius-md);\r
  background: transparent;\r
  color: var(--popup-text);\r
  font: inherit;\r
  cursor: pointer;\r
}\r
.pv-loading-open:focus-visible {\r
  outline: 2px solid var(--popup-focus);\r
  outline-offset: 2px;\r
}\r
.pv-spinner {\r
  width: 38px;\r
  height: 38px;\r
  margin-bottom: 20px;\r
  border: 3px solid var(--popup-accent-soft);\r
  border-radius: 50%;\r
  border-top: 3px solid var(--popup-accent);\r
  animation: pv-spin 0.8s linear infinite;\r
}\r
@keyframes pv-spin {\r
  0% {\r
    transform: rotate(0deg);\r
  }\r
  100% {\r
    transform: rotate(360deg);\r
  }\r
}\r
.pv-loading-hint {\r
  font-size: var(--pv-fs-lg);\r
  font-weight: 500;\r
  color: var(--popup-text);\r
}\r
.pv-loading-sub {\r
  margin-top: 8px;\r
  font-size: var(--pv-fs-sm);\r
  color: var(--popup-muted);\r
}\r
\r
/* ===== 错误状态 ===== */\r
#popup-panel-error {\r
  padding: 32px;\r
  color: var(--popup-text);\r
  font-family: var(--pv-font);\r
  font-size: var(--pv-fs-md);\r
  line-height: 1.5;\r
  text-align: center;\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  justify-content: center;\r
  height: 100%;\r
  box-sizing: border-box;\r
}\r
#popup-panel-error .pv-error-icon {\r
  color: var(--popup-danger);\r
  margin-bottom: 6px;\r
}\r
#popup-panel-error h3 {\r
  margin: 16px 0 8px;\r
  font-weight: 600;\r
  font-size: 17px;\r
  line-height: 1.4;\r
  color: var(--popup-text);\r
}\r
#popup-panel-error p {\r
  margin: 0 0 24px;\r
  color: var(--popup-muted);\r
  max-width: 420px;\r
  font-size: var(--pv-fs-sm);\r
  line-height: 1.6;\r
  word-break: break-word;\r
}\r
#popup-panel-error .pv-error-actions {\r
  display: flex;\r
  gap: 8px;\r
  flex-wrap: wrap;\r
  justify-content: center;\r
}\r
#popup-panel-error button {\r
  min-height: 36px;\r
  padding: 8px 20px;\r
  border: 1px solid var(--popup-border-strong);\r
  border-radius: var(--pv-radius-md);\r
  background: transparent;\r
  color: var(--popup-text);\r
  cursor: pointer;\r
  font: 500 var(--pv-fs-md) / 1.4 var(--pv-font);\r
  transition: background var(--pv-dur-1) ease, border-color var(--pv-dur-1) ease;\r
}\r
/* 主操作：第一个按钮（重试；没有重试时是「在新标签页打开」） */\r
#popup-panel-error .pv-error-actions button:first-child {\r
  background: var(--popup-accent);\r
  border-color: var(--popup-accent);\r
  color: var(--popup-on-accent);\r
}\r
@media (hover: hover) {\r
  #popup-panel-error button:hover {\r
    background: var(--popup-btn-hover);\r
  }\r
  #popup-panel-error .pv-error-actions button:first-child:hover {\r
    background: var(--popup-accent-hover);\r
    border-color: var(--popup-accent-hover);\r
  }\r
}\r
#popup-panel-error button:focus-visible {\r
  outline: 2px solid var(--popup-focus);\r
  outline-offset: 2px;\r
}\r
#popup-panel-error button:disabled {\r
  color: var(--popup-faint);\r
  cursor: not-allowed;\r
}\r
\r
/* ===== iframe ===== */\r
#popup-panel-iframe {\r
  display: block;\r
  width: 100%;\r
  height: 100%;\r
  border: none;\r
  /* 深色主题下加载期间不闪白；帖子自己的背景色加载后覆盖它 */\r
  background-color: var(--popup-bg);\r
}\r
\r
/* ===== 底部状态栏 ===== */\r
#popup-panel-footer {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 10px;\r
  height: 38px;\r
  min-height: 38px;\r
  padding: 0 8px 0 14px;\r
  box-sizing: border-box;\r
  background-color: var(--popup-header-bg);\r
  border-top: 1px solid var(--popup-border);\r
  font-size: var(--pv-fs-xs);\r
  color: var(--popup-muted);\r
}\r
#popup-panel-footer.empty {\r
  display: none;\r
}\r
.pv-footer-nav {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
}\r
/* 弹窗内没有可走的历史时整组隐藏（默认帖内链接新标签页打开，大多数时候用不上） */\r
.pv-footer-nav.pv-no-history {\r
  display: none;\r
}\r
/* 当前所在站点：让用户知道弹窗里是哪个网站 */\r
.pv-footer-host {\r
  flex: 1;\r
  min-width: 0;\r
  overflow: hidden;\r
  white-space: nowrap;\r
  text-overflow: ellipsis;\r
  color: var(--popup-muted);\r
  font-size: var(--pv-fs-xs);\r
}\r
#popup-panel-footer .popup-panel-btn {\r
  width: 28px;\r
  height: 28px;\r
  border-radius: var(--pv-radius-sm);\r
}\r
#popup-panel-footer .popup-panel-btn svg {\r
  width: 14px;\r
  height: 14px;\r
}\r
/* 禁用态：保持可见但能看出不可用（去掉 opacity 叠加，之前实际对比度只有约 1.3:1） */\r
#popup-panel-footer .popup-panel-btn:disabled {\r
  cursor: not-allowed;\r
  background-color: transparent;\r
  color: var(--popup-faint);\r
}\r
#popup-panel-footer .popup-panel-btn:disabled:hover {\r
  background-color: transparent;\r
  color: var(--popup-faint);\r
}\r
\r
/* ===== 链接视觉提示 ===== */\r
/* @pv-page-start */\r
.popup-trigger::after,\r
th.common::after,\r
a.xst::after {\r
  content: '';\r
  position: absolute;\r
  right: 8px;\r
  top: 50%;\r
  width: 16px;\r
  height: 16px;\r
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'%3E%3C/path%3E%3Cpolyline points='15 3 21 3 21 9'%3E%3C/polyline%3E%3Cline x1='10' y1='14' x2='21' y2='3'%3E%3C/line%3E%3C/svg%3E");\r
  background-size: contain;\r
  background-repeat: no-repeat;\r
  transform: translateY(-50%);\r
  opacity: 0;\r
  transition: opacity 0.2s ease-in-out, transform 0.15s ease-in-out;\r
  pointer-events: none;\r
}\r
div.items-content-tittle.popup-trigger,\r
div.tittle_data.popup-trigger,\r
div.items-content-remark.popup-trigger,\r
a.xst {\r
  position: relative;\r
  padding-right: 25px;\r
}\r
div.items-content-tittle.popup-trigger::after,\r
div.tittle_data.popup-trigger::after,\r
div.items-content-remark.popup-trigger::after,\r
a.xst::after {\r
  right: 5px;\r
}\r
.popup-trigger:hover::after,\r
th.common:hover::after,\r
a.xst:hover::after,\r
div.items-content-tittle.popup-trigger:hover::after,\r
div.tittle_data.popup-trigger:hover::after,\r
div.items-content-remark.popup-trigger:hover::after {\r
  opacity: 0.7;\r
  transform: translateY(-50%) scale(1.05);\r
}\r
th.common {\r
  position: relative;\r
}\r
a.xst {\r
  display: inline-block;\r
  transition: color var(--pv-dur-1) ease;\r
}\r
/* 悬停只变色，不再过渡 padding（会让整个论坛列表重排） */\r
a.xst:hover {\r
  color: var(--popup-accent, #2563eb);\r
}\r
a.xst::after {\r
  right: 0;\r
}\r
/* 触屏没有悬停：提示图标常驻半透明 */\r
@media (pointer: coarse) {\r
  .popup-trigger::after,\r
  th.common::after,\r
  a.xst::after {\r
    opacity: 0.45;\r
  }\r
}\r
@media (prefers-reduced-motion: reduce) {\r
  .popup-trigger::after,\r
  th.common::after,\r
  a.xst,\r
  a.xst::after {\r
    transition: none !important;\r
  }\r
}\r
/* @pv-page-end */\r
\r
/* ===== 遮罩层 ===== */\r
#popup-panel-overlay {\r
  position: fixed;\r
  top: 0;\r
  left: 0;\r
  width: 100%;\r
  height: 100%;\r
  background-color: var(--popup-overlay);\r
  opacity: 0;\r
  z-index: var(--pv-z);\r
  transition: opacity var(--pv-dur-3) ease;\r
  pointer-events: none;\r
  backdrop-filter: blur(6px);\r
  -webkit-backdrop-filter: blur(6px);\r
}\r
#popup-panel-overlay.visible {\r
  opacity: 1;\r
  pointer-events: auto;\r
}\r
\r
/* ===== 无障碍：减少动效 ===== */\r
/* 覆盖外壳内所有元素（按下缩放、开关滑块、平滑滚动等此前漏掉了）；spinner 改为透明度呼吸 */\r
@media (prefers-reduced-motion: reduce) {\r
  :is(#popup-content-panel, #popup-panel-overlay, #popup-settings-popover, #pv-float-settings, #pv-rules-panel,\r
      #pv-rules-panel-backdrop, #pv-rules-toast, .pv-picker-bar, .pv-picker-confirm, .pv-picker-overlay,\r
      .pv-picker-highlight),\r
  :is(#popup-content-panel, #popup-settings-popover, #pv-rules-panel, .pv-picker-bar, .pv-picker-confirm) * {\r
    transition-duration: 0.01ms !important;\r
    animation-duration: 0.01ms !important;\r
    scroll-behavior: auto !important;\r
  }\r
  :is(#popup-content-panel, #popup-settings-popover, #pv-rules-panel, #pv-float-settings) :active {\r
    transform: none !important;\r
  }\r
  .pv-spinner,\r
  #popup-content-panel .pv-spinner {\r
    animation: pv-pulse 1.6s ease-in-out infinite !important;\r
    border-top-color: var(--popup-accent-soft);\r
  }\r
}\r
@keyframes pv-pulse {\r
  0%,\r
  100% {\r
    opacity: 0.35;\r
  }\r
  50% {\r
    opacity: 1;\r
  }\r
}\r
@media (prefers-reduced-transparency: reduce) {\r
  #popup-panel-overlay {\r
    backdrop-filter: none;\r
    -webkit-backdrop-filter: none;\r
  }\r
}\r
\r
/* ===== 手机/窄屏适配：窗体不超过视口 ===== */\r
@media (max-width: 560px), (max-height: 560px) {\r
  #popup-content-panel {\r
    max-width: calc(100vw - 16px);\r
    max-height: calc(100vh - 16px);\r
    max-height: calc(100dvh - 16px);\r
  }\r
}\r
\r
/* ===== 触屏适配（pointer: coarse） ===== */\r
@media (pointer: coarse) {\r
  /* 触控目标 44px 标准 */\r
  :is(#popup-content-panel, #pv-rules-panel) .popup-panel-btn {\r
    width: var(--pv-hit);\r
    height: var(--pv-hit);\r
  }\r
  /* 页脚：视觉保持 30px，热区用 ::before 扩到 44px，按钮间距 ≥8px */\r
  #popup-panel-footer {\r
    height: 44px;\r
    min-height: 44px;\r
  }\r
  #popup-panel-footer .popup-panel-btn {\r
    width: 30px;\r
    height: 30px;\r
  }\r
  #popup-panel-footer .popup-panel-btn::before {\r
    content: '';\r
    position: absolute;\r
    inset: -7px;\r
  }\r
  #pv-float-settings {\r
    width: 48px;\r
    height: 48px;\r
  }\r
  /* 缩放手柄加宽，便于手指抓取 */\r
  .pv-resize-n,\r
  .pv-resize-s {\r
    height: 12px;\r
  }\r
  .pv-resize-e,\r
  .pv-resize-w {\r
    width: 12px;\r
  }\r
  .pv-resize-ne,\r
  .pv-resize-nw,\r
  .pv-resize-se,\r
  .pv-resize-sw {\r
    width: 22px;\r
    height: 22px;\r
  }\r
}\r
/* 小屏触屏（手机）：隐藏隐形细条（缩放走四角大把手）；近全屏默认值由 JS 写入变量，保证可自由缩放 */\r
@media (pointer: coarse) and (max-width: 560px), (pointer: coarse) and (max-height: 560px) {\r
  .pv-resize {\r
    display: none;\r
  }\r
}\r
/* 手机竖屏：头部改两行，标题占满第一行，5 个操作按钮平分第二行。\r
   这样标题不再被 5×44px 按钮压到只剩几十像素（v2.3.1）。 */\r
@media (pointer: coarse) and (max-width: 560px) {\r
  #popup-panel-header {\r
    flex-wrap: wrap;\r
    height: auto;\r
    min-height: 0;\r
    padding: 6px 8px 8px;\r
    gap: 6px 8px;\r
  }\r
  #popup-panel-title {\r
    flex: 1 1 100%;\r
    order: 1;\r
  }\r
  #popup-panel-title .pv-title-text {\r
    display: -webkit-box;\r
    -webkit-line-clamp: 2;\r
    -webkit-box-orient: vertical;\r
    white-space: normal;\r
    line-height: 1.35;\r
    font-size: var(--pv-fs-md);\r
  }\r
  #popup-panel-actions {\r
    flex: 1 1 100%;\r
    order: 2;\r
    justify-content: space-between;\r
    gap: 4px;\r
  }\r
  #popup-panel-actions .popup-panel-btn {\r
    flex: 1 1 0;\r
    width: auto;\r
    height: var(--pv-hit);\r
  }\r
}\r
\r
/* ===== X 皮肤（GraphQL 原生渲染）：令牌来自 xTheme.js 读取的 X 实时样式 =====\r
   注意：X 的全局 CSS 是「无层级」的，@layer 挡不住它（层级优先级低于无层级规则），\r
   因此这里全部用无层级 + 高特异性（#popup-content-area / #popup-content-panel 前缀）书写。 */\r
#popup-content-panel.pv-x-skin,\r
#popup-content-panel.pv-x-skin #popup-panel-header,\r
#popup-content-panel.pv-x-skin #popup-panel-footer {\r
  background-color: var(--pv-x-bg, #fff);\r
  color: var(--pv-x-fg, #0f1419);\r
  border-color: var(--pv-x-border, #eff3f4);\r
}\r
#popup-content-panel.pv-x-skin #popup-panel-title,\r
#popup-content-panel.pv-x-skin #popup-panel-footer {\r
  color: var(--pv-x-muted, #536471);\r
}\r
#popup-content-area.pv-x-reader-mode {\r
  /* 两栏各自独立滚动，互不绑定 */\r
  display: flex;\r
  padding: 0;\r
  overflow: hidden;\r
  overscroll-behavior: contain;\r
  background-color: var(--pv-x-bg, #fff);\r
  color: var(--pv-x-fg, #0f1419);\r
  font-family: var(--pv-x-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);\r
}\r
/* 加载中：绝对定位的居中层，避免 loading 视图被 flex/滚动容器挤到一侧 */\r
.pv-x-loading-layer {\r
  position: absolute;\r
  inset: 0;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
}\r
/* reader 本身不滚动：评论卡、资料卡、提示、灯箱都相对它定位 */\r
.pv-x-reader {\r
  position: relative;\r
  flex: 1;\r
  min-width: 0;\r
  min-height: 0;\r
  display: flex;\r
}\r
/* 双栏：左帖子、右回复，各自滚动 */\r
.pv-x-columns {\r
  flex: 1;\r
  min-width: 0;\r
  min-height: 0;\r
  display: grid;\r
  grid-template-columns: minmax(0, 1.04fr) minmax(0, 0.96fr);\r
}\r
.pv-x-pane {\r
  min-width: 0;\r
  min-height: 0;\r
}\r
.pv-x-pane-post {\r
  overflow-y: auto;\r
  overflow-x: hidden;\r
  overscroll-behavior: contain;\r
  border-right: 1px solid var(--pv-x-border, #eff3f4);\r
}\r
/* 右栏：工具行与回复框固定，只有回复列表滚动 */\r
.pv-x-pane-replies {\r
  display: flex;\r
  flex-direction: column;\r
  overflow: hidden;\r
}\r
.pv-x-reply-list {\r
  flex: 1;\r
  min-height: 0;\r
  overflow-y: auto;\r
  overscroll-behavior: contain;\r
}\r
/* 单栏：一个滚动容器，帖子 → 工具行（吸顶）→ 回复框 → 回复 */\r
.pv-x-reader.pv-x-single .pv-x-columns {\r
  display: block;\r
  overflow-y: auto;\r
  overscroll-behavior: contain;\r
}\r
.pv-x-reader.pv-x-single .pv-x-pane-post,\r
.pv-x-reader.pv-x-single .pv-x-reply-list {\r
  overflow: visible;\r
}\r
.pv-x-reader.pv-x-single .pv-x-pane-post {\r
  border-right: none;\r
  border-bottom: 1px solid var(--pv-x-border, #eff3f4);\r
}\r
.pv-x-reader.pv-x-single .pv-x-pane-replies {\r
  display: block;\r
  overflow: visible;\r
}\r
.pv-x-reader.pv-x-single .pv-x-reply-tools {\r
  position: sticky;\r
  top: 0;\r
  z-index: 2;\r
}\r
/* 细滚动条：主题边框色，背景透明 */\r
.pv-x-pane-post,\r
.pv-x-reply-list,\r
.pv-x-reader.pv-x-single .pv-x-columns,\r
.pv-x-card-body {\r
  scrollbar-width: thin;\r
  scrollbar-color: var(--pv-x-scrollbar, #a9b4c0) transparent;\r
}\r
.pv-x-pane-post::-webkit-scrollbar,\r
.pv-x-reply-list::-webkit-scrollbar,\r
.pv-x-columns::-webkit-scrollbar,\r
.pv-x-card-body::-webkit-scrollbar {\r
  width: 6px;\r
  background: transparent;\r
}\r
.pv-x-pane-post::-webkit-scrollbar-thumb,\r
.pv-x-reply-list::-webkit-scrollbar-thumb,\r
.pv-x-columns::-webkit-scrollbar-thumb,\r
.pv-x-card-body::-webkit-scrollbar-thumb {\r
  border-radius: 3px;\r
  background-color: var(--pv-x-scrollbar, #a9b4c0);\r
}\r
/* 「窗体滚动条」关闭时：阅读器内的滚动条也隐藏（渐隐仍保留，提示还能滚） */\r
#popup-content-area.pv-hide-scrollbar .pv-x-pane-post,\r
#popup-content-area.pv-hide-scrollbar .pv-x-reply-list,\r
#popup-content-area.pv-hide-scrollbar .pv-x-columns,\r
#popup-content-area.pv-hide-scrollbar .pv-x-card-body {\r
  scrollbar-width: none;\r
}\r
#popup-content-area.pv-hide-scrollbar .pv-x-pane-post::-webkit-scrollbar,\r
#popup-content-area.pv-hide-scrollbar .pv-x-reply-list::-webkit-scrollbar,\r
#popup-content-area.pv-hide-scrollbar .pv-x-columns::-webkit-scrollbar,\r
#popup-content-area.pv-hide-scrollbar .pv-x-card-body::-webkit-scrollbar {\r
  display: none;\r
}\r
/* 底部渐隐：吸底的伪元素盖住最后 14px（不影响滚动条与点击） */\r
.pv-x-pane-post::after,\r
.pv-x-reply-list::after,\r
.pv-x-card-body::after {\r
  content: '';\r
  position: sticky;\r
  bottom: 0;\r
  display: block;\r
  height: 14px;\r
  margin-top: -14px;\r
  pointer-events: none;\r
  background: linear-gradient(to bottom, transparent, var(--pv-x-bg, #fff));\r
}\r
.pv-x-card-body::after {\r
  height: 12px;\r
  margin-top: -12px;\r
}\r
.pv-x-reply-tools {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 12px;\r
  padding: 10px 16px;\r
  background-color: var(--pv-x-bg, #fff);\r
  border-bottom: 1px solid var(--pv-x-border, #eff3f4);\r
  font-size: 13px;\r
  color: var(--pv-x-muted, #536471);\r
}\r
.pv-x-open {\r
  color: var(--pv-x-accent, #1d9bf0);\r
  white-space: nowrap;\r
}\r
/* 昵称/头像/媒体不显示下划线（与 X 一致；宿主页面的 a{text-decoration} 也会被这里压掉） */\r
.pv-x-name,\r
.pv-x-avatar,\r
.pv-x-media-item,\r
.pv-x-open,\r
.pv-x-video-open {\r
  text-decoration: none;\r
}\r
.pv-x-open:hover {\r
  text-decoration: underline;\r
}\r
.pv-x-post {\r
  display: grid;\r
  grid-template-columns: 40px minmax(0, 1fr);\r
  gap: 12px;\r
  padding: 12px 16px;\r
  border-bottom: 1px solid var(--pv-x-border, #eff3f4);\r
}\r
/* 帖子行本身不可点，不做悬停底色（只有链接、按钮、引用卡有悬停态） */\r
.pv-x-avatar-col {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  min-width: 0;\r
}\r
.pv-x-avatar {\r
  display: block;\r
  width: 40px;\r
  height: 40px;\r
  flex: none;\r
  border-radius: 50%;\r
  overflow: hidden;\r
  background-color: var(--pv-x-soft, #f7f9f9);\r
}\r
.pv-x-avatar img {\r
  display: block;\r
  width: 100%;\r
  height: 100%;\r
  object-fit: cover;\r
  border: 0;\r
}\r
/* 线程竖线：只在下一条是直接回复时画（data-thread-next），并穿过行间距接到下一条头像 */\r
.pv-x-thread-line {\r
  display: none;\r
  flex: 1;\r
  width: 2px;\r
  min-height: 8px;\r
  margin-top: 4px;\r
  background-color: var(--pv-x-border, #eff3f4);\r
}\r
.pv-x-post[data-thread-next='true'] > .pv-x-avatar-col > .pv-x-thread-line {\r
  display: block;\r
  /* 本行下内边距 12 + 分隔线 1 + 下一行上内边距 12 */\r
  margin-bottom: -25px;\r
}\r
.pv-x-post[data-thread-next='true'] {\r
  border-bottom-color: transparent;\r
}\r
.pv-x-reply[data-thread-next='true'] > .pv-x-avatar-col > .pv-x-thread-line {\r
  /* 回复行上下内边距 10 */\r
  margin-bottom: -21px;\r
}\r
/* 主贴正文放大，与上下文、回复拉开层级 */\r
.pv-x-post-focal .pv-x-text {\r
  font-size: 17px;\r
  line-height: 24px;\r
}\r
.pv-x-main {\r
  min-width: 0;\r
}\r
.pv-x-head {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  min-width: 0;\r
  font-size: 15px;\r
  line-height: 20px;\r
}\r
.pv-x-name {\r
  min-width: 0;\r
  flex: 0 1 auto;\r
  font-weight: 700;\r
  color: var(--pv-x-fg, #0f1419);\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
/* 空间不够时 @handle 先截断，再轮到昵称；时间不缩 */\r
.pv-x-head .pv-x-handle {\r
  min-width: 0;\r
  flex: 0 1000 auto;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
.pv-x-head .pv-x-time,\r
.pv-x-head .pv-x-dot {\r
  flex: none;\r
}\r
.pv-x-badge {\r
  width: 18px;\r
  height: 18px;\r
  flex: none;\r
  color: var(--pv-x-accent, #1d9bf0);\r
}\r
.pv-x-badge svg {\r
  display: block;\r
  width: 18px;\r
  height: 18px;\r
  fill: currentColor;\r
}\r
.pv-x-handle,\r
.pv-x-time,\r
.pv-x-dot {\r
  color: var(--pv-x-muted, #536471);\r
  white-space: nowrap;\r
}\r
.pv-x-text {\r
  margin-top: 2px;\r
  font-size: 15px;\r
  line-height: 20px;\r
  white-space: pre-wrap;\r
  overflow-wrap: anywhere;\r
}\r
/* 正文里的 @提及 / #话题 / $代码 / 链接 */\r
.pv-x-entity {\r
  color: var(--pv-x-accent, #1d9bf0);\r
  text-decoration: none;\r
}\r
.pv-x-entity:hover {\r
  text-decoration: underline;\r
}\r
/* 正文被截断时的「显示更多」 */\r
.pv-x-more-text {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  display: block;\r
  margin: 2px 0 0;\r
  padding: 0;\r
  border: 0;\r
  background: none;\r
  color: var(--pv-x-accent, #1d9bf0);\r
  font: inherit;\r
  font-size: 15px;\r
  line-height: 20px;\r
  cursor: pointer;\r
}\r
.pv-x-more-text:hover:not(:disabled) {\r
  text-decoration: underline;\r
}\r
.pv-x-more-text:disabled {\r
  color: var(--pv-x-muted, #536471);\r
  cursor: default;\r
}\r
.pv-x-actions {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 4px;\r
  min-width: 0;\r
  margin-top: 10px;\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 13px;\r
}\r
.pv-x-action {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 6px;\r
  min-width: 0;\r
  /* 按钮复位：X 的全局 CSS 会重置 button，这里显式写全 */\r
  appearance: none;\r
  -webkit-appearance: none;\r
  margin: 0;\r
  padding: 0;\r
  border: 0;\r
  background: none;\r
  font: inherit;\r
  color: inherit;\r
  cursor: pointer;\r
}\r
.pv-x-action svg {\r
  display: block;\r
  width: 18px;\r
  height: 18px;\r
  flex: none;\r
  fill: currentColor;\r
}\r
.pv-x-action-views {\r
  cursor: default;\r
}\r
.pv-x-action[data-action]:hover {\r
  color: var(--pv-x-accent, #1d9bf0);\r
}\r
.pv-x-action-like:hover,\r
.pv-x-action-like[data-active='true'] {\r
  color: var(--pv-x-like, #f91880);\r
}\r
.pv-x-action-repost:hover,\r
.pv-x-action-repost[data-active='true'] {\r
  color: var(--pv-x-repost, #00ba7c);\r
}\r
.pv-x-action-bookmark[data-active='true'] {\r
  color: var(--pv-x-accent, #1d9bf0);\r
}\r
.pv-x-action[data-active='true'] .pv-x-count {\r
  font-weight: 600;\r
}\r
.pv-x-avatar-sm {\r
  width: 32px;\r
  height: 32px;\r
  flex: none;\r
}\r
.pv-x-post-compact .pv-x-text {\r
  font-size: 14px;\r
  line-height: 19px;\r
}\r
.pv-x-post-compact .pv-x-head {\r
  font-size: 13px;\r
  line-height: 18px;\r
  gap: 3px;\r
}\r
.pv-x-post-compact .pv-x-comment-entry {\r
  font-size: 12px;\r
}\r
.pv-x-post-compact .pv-x-actions {\r
  gap: 4px;\r
  margin-top: 6px;\r
  font-size: 12px;\r
}\r
/* 右栏工具行：评论数 + 排序 */\r
.pv-x-tools-left {\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
  min-width: 0;\r
}\r
.pv-x-sort {\r
  display: inline-flex;\r
  gap: 4px;\r
}\r
.pv-x-sort-btn {\r
  appearance: none;\r
  margin: 0;\r
  padding: 2px 8px;\r
  border: 1px solid transparent;\r
  border-radius: 999px;\r
  background: none;\r
  font: inherit;\r
  font-size: 12px;\r
  color: var(--pv-x-muted, #536471);\r
  cursor: pointer;\r
}\r
.pv-x-sort-btn:hover {\r
  background-color: var(--pv-x-hover, rgba(0, 0, 0, 0.03));\r
}\r
.pv-x-sort-btn[aria-pressed='true'] {\r
  color: var(--pv-x-accent, #1d9bf0);\r
  border-color: var(--pv-x-accent, #1d9bf0);\r
}\r
/* 纯文字回复框 */\r
.pv-x-composer {\r
  display: grid;\r
  grid-template-columns: 32px minmax(0, 1fr);\r
  gap: 10px;\r
  padding: 12px 16px;\r
  border-bottom: 1px solid var(--pv-x-border, #eff3f4);\r
}\r
.pv-x-composer-body {\r
  min-width: 0;\r
}\r
/* 回复目标提示（点评论的「回复」时出现，可取消） */\r
.pv-x-composer-target {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  margin-bottom: 2px;\r
  font-size: 13px;\r
}\r
.pv-x-composer-target[hidden] {\r
  display: none;\r
}\r
.pv-x-composer-target-label {\r
  color: var(--pv-x-accent, #1d9bf0);\r
}\r
.pv-x-composer-target-clear {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  margin: 0;\r
  padding: 0 4px;\r
  border: 0;\r
  background: none;\r
  color: var(--pv-x-muted, #536471);\r
  font: inherit;\r
  font-size: 13px;\r
  cursor: pointer;\r
}\r
.pv-x-composer-target-clear:hover {\r
  color: var(--pv-x-fg, #0f1419);\r
}\r
/* 正在回复的那条：高亮，避免「点了回复却不知道回到哪」 */\r
article.pv-x-post[data-reply-target='true'] {\r
  background-color: var(--pv-x-hover, rgba(0, 0, 0, 0.03));\r
  box-shadow: inset 3px 0 0 var(--pv-x-accent, #1d9bf0);\r
}\r
.pv-x-composer-input {\r
  display: block;\r
  width: 100%;\r
  box-sizing: border-box;\r
  padding: 8px 0;\r
  border: 0;\r
  background: none;\r
  color: var(--pv-x-fg, #0f1419);\r
  font: inherit;\r
  font-size: 15px;\r
  line-height: 20px;\r
  resize: none;\r
  overflow-y: auto;\r
}\r
.pv-x-composer-input:focus {\r
  outline: none;\r
}\r
.pv-x-composer-input::placeholder {\r
  color: var(--pv-x-muted, #536471);\r
}\r
.pv-x-composer-foot {\r
  display: flex;\r
  align-items: center;\r
  justify-content: flex-end;\r
  gap: 10px;\r
  min-height: 28px;\r
}\r
.pv-x-composer-hint {\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 12px;\r
  text-align: right;\r
}\r
.pv-x-composer-submit {\r
  appearance: none;\r
  margin: 0;\r
  padding: 6px 16px;\r
  border: 0;\r
  border-radius: 999px;\r
  background-color: var(--pv-x-accent-fill, #0f6fbf);\r
  color: var(--pv-x-on-accent, #fff);\r
  font: inherit;\r
  font-size: 14px;\r
  font-weight: 600;\r
  cursor: pointer;\r
}\r
.pv-x-composer-submit:disabled {\r
  opacity: 0.5;\r
  cursor: default;\r
}\r
/* 滚动到底自动加载 */\r
.pv-x-load-sentinel {\r
  display: flex;\r
  justify-content: center;\r
  padding: 14px;\r
}\r
.pv-x-loading,\r
.pv-x-load-done {\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 13px;\r
}\r
.pv-x-load-sentinel[data-state='none'] {\r
  display: none;\r
}\r
/* 正文下方「查看 N 条回复 ›」：文字链接，打开评论卡 */\r
.pv-x-replies-link {\r
  -webkit-appearance: none;\r
  appearance: none;\r
  display: inline-block;\r
  margin: 6px 0 0;\r
  padding: 0;\r
  border: 0;\r
  background: transparent;\r
  color: var(--pv-x-accent, #1d9bf0);\r
  font: inherit;\r
  font-size: 14px;\r
  line-height: 20px;\r
  cursor: pointer;\r
}\r
.pv-x-replies-link:hover,\r
.pv-x-replies-link[aria-expanded='true'] {\r
  text-decoration: underline;\r
}\r
.pv-x-replies-link[hidden] {\r
  display: none;\r
}\r
/* 阅读器加载层：沿用 X 主题色（不用弹窗主题色，避免深色 X 上出现浅色文字底） */\r
.pv-x-loading-layer {\r
  --popup-text: var(--pv-x-fg, #0f1419);\r
  --popup-muted: var(--pv-x-muted, #536471);\r
  --popup-faint: var(--pv-x-muted, #536471);\r
  --popup-accent: var(--pv-x-accent, #1d9bf0);\r
  --popup-accent-soft: var(--pv-x-border, #eff3f4);\r
}\r
/* 翻译行 */\r
.pv-x-translation-row {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  margin-top: 4px;\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 13px;\r
  line-height: 18px;\r
}\r
.pv-x-translation-link {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  margin: 0;\r
  padding: 0;\r
  border: 0;\r
  background: none;\r
  color: var(--pv-x-accent, #1d9bf0);\r
  font: inherit;\r
  font-size: 13px;\r
  cursor: pointer;\r
}\r
.pv-x-translation-link:hover {\r
  text-decoration: underline;\r
}\r
/* 图片轮播：固定窗体 + 两侧固定箭头，只有中间轨道滑动（栏内默认态与覆盖式灯箱共用） */\r
.pv-x-media.pv-x-media-carousel {\r
  display: flex;\r
  justify-content: center;\r
  aspect-ratio: auto;\r
}\r
.pv-x-media-stage {\r
  position: relative;\r
  /* 栏内：宽度铺满，高度由 inline aspect-ratio（首图比例）决定，与单图逻辑一致；\r
     浮层：宽高由 JS 按浮层可用区域算出（覆盖这里的 100%） */\r
  width: 100%;\r
  overflow: hidden;\r
  /* 不加黑底：图片按比例缩放后，留白处露出页面/浮层背景，避免出现黑边与加载时的黑块 */\r
  background-color: transparent;\r
  outline: none;\r
  /* 横向手势交给我们，纵向留给页面/栏滚动 */\r
  touch-action: pan-y;\r
  user-select: none;\r
  -webkit-user-select: none;\r
}\r
/* 栏内默认态：点图弹出覆盖式大图 */\r
.pv-x-media-stage-inline {\r
  cursor: zoom-in;\r
}\r
/* 覆盖式浮层：宽高由 JS 按视口可用区域与首图比例算出；纵向也交给手势（灯箱内不需要页面滚动） */\r
.pv-x-media-stage-overlay {\r
  cursor: zoom-in;\r
  touch-action: none;\r
  /* 视口是 flex 容器：不压掉 min-width:auto，缩窄面板时会被图片的 min-content 顶住缩不回去 */\r
  min-width: 0;\r
}\r
/* 放大后可拖拽平移：光标换成抓取 */\r
.pv-x-media-stage-overlay.pv-x-media-zoomed {\r
  cursor: grab;\r
}\r
/* 注意：不要给缩放中的图片常驻 will-change: transform —— 它会把合成层的光栅\r
   钉在适配显示时的分辨率上，放大到原图 1:1 时 GPU 只是在拉伸小纹理，必然发糊。\r
   改为手势/补间进行中由 xRender 按需开启，结束即移除并强制按当前缩放重光栅化。 */\r
.pv-x-media-stage.pv-x-media-dragging {\r
  cursor: grabbing;\r
}\r
/* 覆盖式大图灯箱：用磨砂玻璃层而不是黑色遮罩 —— 不压黑，同时把背景内容压下去 */\r
.pv-x-media-lightbox {\r
  position: absolute;\r
  inset: 0;\r
  /* 必须在评论抽屉(7)之上：否则在抽屉里点图，灯箱会开在抽屉背后 */\r
  z-index: 9;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  padding: 12px;\r
  background-color: rgba(128, 128, 128, 0.28);\r
  -webkit-backdrop-filter: blur(14px) saturate(140%);\r
  backdrop-filter: blur(14px) saturate(140%);\r
  overscroll-behavior: contain;\r
}\r
/* 轨道：所有图并排，靠 translateX 滑动；窗体与两侧箭头固定不动 */\r
.pv-x-media-track {\r
  display: flex;\r
  width: 100%;\r
  height: 100%;\r
  will-change: transform;\r
}\r
.pv-x-media-slide {\r
  flex: 0 0 100%;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 100%;\r
  height: 100%;\r
}\r
.pv-x-media-big {\r
  display: block;\r
  max-width: 100%;\r
  /* 相对所在 slide（slide 有确定高度），不再用 70vh：矮栏里图片会超出窗体被裁掉 */\r
  max-height: 100%;\r
  object-fit: contain;\r
  border-radius: 12px;\r
  -webkit-user-drag: none;\r
}\r
/* 浮层里的图再给一点投影，从磨砂背景上"浮"起来 */\r
.pv-x-media-stage-overlay .pv-x-media-big {\r
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.3);\r
}\r
.pv-x-media-bar {\r
  position: absolute;\r
  top: 0;\r
  left: 0;\r
  right: 0;\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 10px;\r
  padding: 8px 10px;\r
}\r
/* 页码与「在 X 打开」放在深色胶囊上：浅色主题下图片留白处也看得清（白字直接压在浅底上会看不见） */\r
.pv-x-media-counter,\r
.pv-x-media-open {\r
  padding: 2px 8px;\r
  border-radius: 999px;\r
  background-color: rgba(0, 0, 0, 0.6);\r
  color: #fff;\r
  font-size: 13px;\r
  line-height: 20px;\r
  text-decoration: none;\r
}\r
.pv-x-media-open:hover {\r
  background-color: rgba(0, 0, 0, 0.75);\r
  text-decoration: underline;\r
}\r
.pv-x-media-collapse {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 32px;\r
  height: 32px;\r
  padding: 0;\r
  border: 0;\r
  border-radius: 50%;\r
  background-color: rgba(255, 255, 255, 0.14);\r
  color: #fff;\r
  font: inherit;\r
  font-size: 15px;\r
  line-height: 1;\r
  cursor: pointer;\r
}\r
.pv-x-media-collapse:hover {\r
  background-color: rgba(255, 255, 255, 0.24);\r
}\r
/* 左右切换箭头：垂直居中贴在图片两侧（与 X 灯箱一致） */\r
.pv-x-media-nav {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  position: absolute;\r
  top: 50%;\r
  transform: translateY(-50%);\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 40px;\r
  height: 40px;\r
  padding: 0;\r
  border: 0;\r
  border-radius: 50%;\r
  background-color: rgba(0, 0, 0, 0.55);\r
  color: #fff;\r
  cursor: pointer;\r
}\r
.pv-x-media-nav svg {\r
  display: block;\r
  width: 24px;\r
  height: 24px;\r
}\r
.pv-x-media-nav:hover:not(:disabled) {\r
  background-color: rgba(0, 0, 0, 0.75);\r
}\r
/* 到边界时按钮不隐藏（位置固定不动），只降透明度并禁用 */\r
.pv-x-media-nav:disabled {\r
  opacity: 0.35;\r
  cursor: default;\r
}\r
.pv-x-media-prev {\r
  left: 10px;\r
}\r
.pv-x-media-next {\r
  right: 10px;\r
}\r
\r
/* ===== 浮层灯箱：三栏骨架 + 底部缩放条（箭头在图片外，图片永远不压按钮） ===== */\r
.pv-x-media-shell {\r
  position: relative;\r
  display: flex;\r
  flex-direction: column;\r
  gap: 10px;\r
  width: 100%;\r
  height: 100%;\r
  min-height: 0;\r
}\r
.pv-x-media-main {\r
  display: flex;\r
  flex: 1;\r
  align-items: stretch;\r
  gap: 12px;\r
  min-height: 0;\r
  position: relative;\r
}\r
.pv-x-media-viewport {\r
  display: flex;\r
  flex: 1;\r
  align-items: center;\r
  justify-content: center;\r
  min-width: 0;\r
  min-height: 0;\r
  overflow: hidden;\r
}\r
/* 视口里的窗体尺寸由 JS 给死，不参与 flex 收缩 */\r
.pv-x-media-viewport > .pv-x-media-stage {\r
  flex: 0 0 auto;\r
}\r
/* 浮层里的箭头是 flex 项：不绝对定位、不压图，纵向居中 */\r
.pv-x-media-shell .pv-x-media-nav {\r
  position: static;\r
  transform: none;\r
  flex: 0 0 auto;\r
  align-self: center;\r
}\r
/* 浮层顶部条挂在壳上、绝对定位并对齐到图片顶边（--pv-bar-top 由 syncFrame 按居中偏移给），\r
   两侧给箭头让位（Tab 顺序也因此排在箭头之后） */\r
.pv-x-media-shell > .pv-x-media-bar {\r
  top: var(--pv-bar-top, 0px);\r
  left: 64px;\r
  right: 64px;\r
  z-index: 1;\r
}\r
/* 页码 /「在 X 打开」/ ✕ 收在右上角同一组里：间隔 8px，不再被 space-between 拉开两头 */\r
.pv-x-media-bar-grouped {\r
  justify-content: flex-end;\r
}\r
.pv-x-media-bar-group {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  min-width: 0;\r
}\r
.pv-x-media-bar-group > * {\r
  flex: 0 0 auto;\r
}\r
/* 窄屏退化：两侧留白放不下时，箭头贴边叠在视口内（32px、半透明） */\r
.pv-x-media-shell.is-narrow .pv-x-media-main {\r
  gap: 0;\r
}\r
.pv-x-media-shell.is-narrow > .pv-x-media-bar {\r
  left: 44px;\r
  right: 44px;\r
}\r
.pv-x-media-shell.is-narrow .pv-x-media-nav {\r
  position: absolute;\r
  top: 50%;\r
  transform: translateY(-50%);\r
  z-index: 1;\r
  width: 32px;\r
  height: 32px;\r
  background-color: rgba(0, 0, 0, 0.45);\r
}\r
.pv-x-media-shell.is-narrow .pv-x-media-prev {\r
  left: 4px;\r
}\r
.pv-x-media-shell.is-narrow .pv-x-media-next {\r
  right: 4px;\r
}\r
/* 底部缩放条：默认 100% 时滑块在最左，滚轮/拖动/点击轨道都可缩放 */\r
.pv-x-media-zoom {\r
  display: flex;\r
  flex: 0 0 auto;\r
  align-self: center;\r
  align-items: center;\r
  gap: 8px;\r
  padding: 5px 10px;\r
  border-radius: 999px;\r
  background-color: rgba(0, 0, 0, 0.55);\r
  color: #fff;\r
  -webkit-backdrop-filter: blur(8px);\r
  backdrop-filter: blur(8px);\r
}\r
.pv-x-zoom-btn {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 26px;\r
  height: 26px;\r
  padding: 0;\r
  border: 0;\r
  border-radius: 50%;\r
  background-color: rgba(255, 255, 255, 0.16);\r
  color: #fff;\r
  cursor: pointer;\r
}\r
.pv-x-zoom-btn:hover:not(:disabled) {\r
  background-color: rgba(255, 255, 255, 0.3);\r
}\r
.pv-x-zoom-btn:disabled,\r
.pv-x-zoom-fit:disabled {\r
  opacity: 0.4;\r
  cursor: default;\r
}\r
.pv-x-zoom-fit {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  padding: 2px 4px;\r
  border: 0;\r
  background: none;\r
  color: #fff;\r
  font: inherit;\r
  font-size: 12px;\r
  opacity: 0.92;\r
  cursor: pointer;\r
}\r
.pv-x-zoom-value {\r
  min-width: 40px;\r
  font-size: 12px;\r
  font-variant-numeric: tabular-nums;\r
  text-align: center;\r
}\r
.pv-x-zoom-range {\r
  position: relative;\r
  width: 132px;\r
  height: 24px;\r
  cursor: pointer;\r
  outline: none;\r
  touch-action: none;\r
}\r
.pv-x-zoom-range::before {\r
  content: '';\r
  position: absolute;\r
  top: 50%;\r
  left: 0;\r
  right: 0;\r
  height: 4px;\r
  margin-top: -2px;\r
  border-radius: 2px;\r
  background-color: rgba(255, 255, 255, 0.3);\r
}\r
.pv-x-zoom-fill {\r
  position: absolute;\r
  top: 50%;\r
  left: 0;\r
  width: calc(var(--pv-zoom-ratio, 0) * 100%);\r
  height: 4px;\r
  margin-top: -2px;\r
  border-radius: 2px;\r
  background-color: #fff;\r
}\r
.pv-x-zoom-thumb {\r
  position: absolute;\r
  top: 50%;\r
  left: calc(var(--pv-zoom-ratio, 0) * 100%);\r
  width: 14px;\r
  height: 14px;\r
  margin: -7px 0 0 -7px;\r
  border-radius: 50%;\r
  background-color: #fff;\r
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);\r
}\r
.pv-x-zoom-range:focus-visible {\r
  outline: 2px solid rgba(255, 255, 255, 0.85);\r
  outline-offset: 4px;\r
  border-radius: 4px;\r
}\r
@media (pointer: coarse) {\r
  .pv-x-zoom-range {\r
    height: 36px;\r
  }\r
  .pv-x-zoom-thumb {\r
    width: 18px;\r
    height: 18px;\r
    margin: -9px 0 0 -9px;\r
  }\r
}\r
/* 降低动效偏好：滑动改为直接落位（不做位移动画） */\r
@media (prefers-reduced-motion: reduce) {\r
  .pv-x-media-track {\r
    transition: none !important;\r
  }\r
}\r
/* 引用帖卡片（紧凑版）：作者行 + 正文截两行 + 右侧小缩略图，整卡可点开新窗口 */\r
.pv-x-quote {\r
  display: flex;\r
  align-items: flex-start;\r
  gap: 10px;\r
  margin-top: 10px;\r
  padding: 8px 10px;\r
  border: 1px solid var(--pv-x-border, #eff3f4);\r
  border-radius: 12px;\r
  cursor: pointer;\r
  transition: background-color 0.15s ease;\r
}\r
.pv-x-quote:hover {\r
  background-color: var(--pv-x-hover, rgba(0, 0, 0, 0.03));\r
}\r
.pv-x-quote:focus-visible {\r
  outline: 2px solid var(--pv-x-accent, #1d9bf0);\r
  outline-offset: 1px;\r
}\r
.pv-x-quote-main {\r
  flex: 1;\r
  min-width: 0;\r
}\r
.pv-x-quote-head {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  min-width: 0;\r
}\r
.pv-x-quote-avatar {\r
  flex: none;\r
  width: 18px;\r
  height: 18px;\r
  border-radius: 50%;\r
  object-fit: cover;\r
}\r
.pv-x-quote-name {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  min-width: 0;\r
  font-size: 14px;\r
  line-height: 18px;\r
}\r
.pv-x-quote-author {\r
  overflow: hidden;\r
  font-weight: 700;\r
  color: var(--pv-x-fg, #0f1419);\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.pv-x-quote-handle {\r
  overflow: hidden;\r
  color: var(--pv-x-muted, #536471);\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
/* 正文只留两行，超出省略 —— 引用卡不能占太多高度 */\r
.pv-x-quote-text {\r
  display: -webkit-box;\r
  -webkit-box-orient: vertical;\r
  -webkit-line-clamp: 2;\r
  overflow: hidden;\r
  margin-top: 2px;\r
  color: var(--pv-x-fg, #0f1419);\r
  font-size: 14px;\r
  line-height: 19px;\r
  overflow-wrap: anywhere;\r
  white-space: pre-wrap;\r
}\r
/* 被引用的是 X 长文：显示「长文」标签 + 标题（摘要另起一行） */\r
.pv-x-quote-title {\r
  display: flex;\r
  align-items: baseline;\r
  gap: 6px;\r
  margin-top: 2px;\r
  font-size: 14px;\r
  line-height: 19px;\r
}\r
.pv-x-quote-tag {\r
  flex: none;\r
  padding: 0 5px;\r
  border-radius: 4px;\r
  background-color: var(--pv-x-hover, rgba(0, 0, 0, 0.06));\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 11px;\r
  line-height: 16px;\r
}\r
.pv-x-quote-title-text {\r
  display: -webkit-box;\r
  -webkit-box-orient: vertical;\r
  -webkit-line-clamp: 2;\r
  overflow: hidden;\r
  color: var(--pv-x-fg, #0f1419);\r
  font-weight: 600;\r
  overflow-wrap: anywhere;\r
}\r
.pv-x-quote-media {\r
  flex: none;\r
  width: 56px;\r
  height: 56px;\r
  border: 1px solid var(--pv-x-border, #eff3f4);\r
  border-radius: 8px;\r
  object-fit: cover;\r
}\r
\r
/* 时间右侧的「查看评论」入口：图标沿用 X 的回复图标 + 数量 */\r
.pv-x-comment-entry {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 3px;\r
  flex: none;\r
  margin-left: 2px;\r
  padding: 1px 5px;\r
  border: 0;\r
  border-radius: 6px;\r
  background: none;\r
  color: var(--pv-x-muted, #536471);\r
  font: inherit;\r
  font-size: 13px;\r
  line-height: 18px;\r
  cursor: pointer;\r
}\r
.pv-x-comment-entry:hover {\r
  background-color: rgba(29, 155, 240, 0.1);\r
  color: var(--pv-x-accent, #1d9bf0);\r
}\r
.pv-x-comment-entry[hidden] {\r
  display: none;\r
}\r
.pv-x-comment-entry svg {\r
  display: block;\r
  width: 15px;\r
  height: 15px;\r
}\r
/* 数字用等宽，避免计数变化时左右抖动 */\r
.pv-x-comment-count {\r
  font-variant-numeric: tabular-nums;\r
}\r
\r
/* 小巧评论卡：只在右侧评论栏内活动（位置由 JS 按栏 rect 反算并夹紧），\r
   有覆盖层但不遮左侧主贴；非模态，无遮罩 */\r
.pv-x-card-layer {\r
  position: absolute;\r
  inset: 0;\r
  z-index: 7;\r
  pointer-events: none;\r
}\r
.pv-x-card {\r
  position: absolute;\r
  display: flex;\r
  flex-direction: column;\r
  max-height: 340px;\r
  pointer-events: auto;\r
  border: 1px solid var(--pv-x-border, #eff3f4);\r
  border-radius: 14px;\r
  background-color: var(--pv-x-bg, #fff);\r
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.06);\r
  outline: none;\r
  opacity: 0;\r
  transform: scale(0.97);\r
  transform-origin: top right;\r
  /* 轻量出现：淡入 + 极小缩放（比滑入轻，符合"小巧"） */\r
  transition: opacity 0.14s ease, transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);\r
}\r
.pv-x-card.visible {\r
  opacity: 1;\r
  transform: scale(1);\r
}\r
/* 指向图标的箭头：只有锚点确实在栏内时才出现（JS 用 data-arrow 控制） */\r
.pv-x-card[data-arrow='up']::before,\r
.pv-x-card[data-arrow='down']::before {\r
  content: '';\r
  position: absolute;\r
  left: var(--pv-card-arrow-left, 24px);\r
  width: 10px;\r
  height: 10px;\r
  background-color: var(--pv-x-bg, #fff);\r
  transform: rotate(45deg);\r
}\r
.pv-x-card[data-arrow='up']::before {\r
  top: -6px;\r
  border-left: 1px solid var(--pv-x-border, #eff3f4);\r
  border-top: 1px solid var(--pv-x-border, #eff3f4);\r
}\r
.pv-x-card[data-arrow='down']::before {\r
  bottom: -6px;\r
  border-right: 1px solid var(--pv-x-border, #eff3f4);\r
  border-bottom: 1px solid var(--pv-x-border, #eff3f4);\r
}\r
.pv-x-card-head {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  flex: 0 0 auto;\r
  padding: 7px 8px 7px 10px;\r
  border-bottom: 1px solid var(--pv-x-border, #eff3f4);\r
}\r
.pv-x-card-title {\r
  flex: 1;\r
  min-width: 0;\r
  overflow: hidden;\r
  color: var(--pv-x-fg, #0f1419);\r
  font-size: 12.5px;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.pv-x-card-title b {\r
  font-weight: 700;\r
}\r
.pv-x-card-when {\r
  margin-left: 4px;\r
  color: var(--pv-x-muted, #536471);\r
  font-weight: 400;\r
}\r
.pv-x-card-btn {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  flex: none;\r
  width: 22px;\r
  height: 22px;\r
  padding: 0;\r
  border: 0;\r
  border-radius: 50%;\r
  background: none;\r
  color: var(--pv-x-muted, #536471);\r
  font: inherit;\r
  font-size: 12px;\r
  line-height: 1;\r
  cursor: pointer;\r
}\r
.pv-x-card-btn:hover {\r
  background-color: var(--pv-x-hover, rgba(0, 0, 0, 0.06));\r
  color: var(--pv-x-accent, #1d9bf0);\r
}\r
/* 刷新中：图标转起来，按钮禁点 */\r
.pv-x-card-btn.pv-x-card-busy {\r
  pointer-events: none;\r
  animation: pv-x-card-spin 0.9s linear infinite;\r
}\r
@keyframes pv-x-card-spin {\r
  to {\r
    transform: rotate(360deg);\r
  }\r
}\r
.pv-x-card-body {\r
  flex: 1;\r
  min-height: 0;\r
  overflow-y: auto;\r
  overscroll-behavior: contain;\r
  padding: 4px 10px 6px;\r
}\r
.pv-x-card-state {\r
  padding: 18px 4px;\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 13px;\r
  text-align: center;\r
}\r
.pv-x-card-state-error {\r
  display: flex;\r
  flex-wrap: wrap;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 8px;\r
  padding: 8px 4px;\r
  color: var(--pv-x-danger, #d0101c);\r
}\r
.pv-x-card-loading {\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 8px;\r
}\r
.pv-x-card-spinner {\r
  width: 14px;\r
  height: 14px;\r
  border: 2px solid var(--pv-x-border, #eff3f4);\r
  border-top-color: var(--pv-x-accent, #1d9bf0);\r
  border-radius: 50%;\r
  animation: pv-spin 0.8s linear infinite;\r
}\r
.pv-x-card-retry,\r
.pv-x-load-retry {\r
  -webkit-appearance: none;\r
  appearance: none;\r
  margin: 0;\r
  padding: 4px 12px;\r
  border: 1px solid currentColor;\r
  border-radius: 999px;\r
  background: transparent;\r
  color: var(--pv-x-danger, #d0101c);\r
  font: inherit;\r
  font-size: 13px;\r
  cursor: pointer;\r
}\r
.pv-x-card-retry:hover,\r
.pv-x-load-retry:hover {\r
  background-color: var(--pv-x-hover, rgba(0, 0, 0, 0.03));\r
}\r
.pv-x-card-foot {\r
  display: block;\r
  flex: 0 0 auto;\r
  padding: 6px 10px;\r
  border-top: 1px solid var(--pv-x-border, #eff3f4);\r
  color: var(--pv-x-accent, #1d9bf0);\r
  font-size: 12.5px;\r
  text-decoration: none;\r
}\r
.pv-x-card-foot:hover {\r
  background-color: var(--pv-x-hover, rgba(0, 0, 0, 0.03));\r
}\r
/* 卡片里的帖子走紧凑排版：头像/字号都小一号 */\r
.pv-x-card-body .pv-x-post {\r
  padding: 6px 0;\r
  border-bottom: 1px solid var(--pv-x-border, #eff3f4);\r
}\r
.pv-x-card-body .pv-x-post:last-child {\r
  border-bottom: 0;\r
}\r
.pv-x-card-body .pv-x-avatar-col {\r
  width: 26px;\r
}\r
.pv-x-card-body .pv-x-avatar {\r
  width: 26px;\r
  height: 26px;\r
}\r
.pv-x-card-body .pv-x-text {\r
  font-size: 13px;\r
  line-height: 18px;\r
}\r
.pv-x-card-body .pv-x-head {\r
  font-size: 12.5px;\r
}\r
.pv-x-card-body .pv-x-actions {\r
  gap: 14px;\r
  margin-top: 4px;\r
  font-size: 11.5px;\r
}\r
/* 降低动效偏好：卡片直接出现/消失 */\r
@media (prefers-reduced-motion: reduce) {\r
  .pv-x-card {\r
    transition: none;\r
  }\r
  .pv-x-card-btn.pv-x-card-busy {\r
    animation: none;\r
  }\r
}\r
\r
/* 作者资料卡（悬停出现，与 X 一致） */\r
.pv-x-profile-trigger {\r
  cursor: pointer;\r
}\r
.pv-x-profile-card {\r
  /* 相对 .pv-x-reader 绝对定位：面板带 transform，fixed 的包含块会变成面板而非视口 */\r
  position: absolute;\r
  /* 高于评论抽屉(7)：在抽屉里悬停作者时资料卡不能被抽屉盖住 */\r
  z-index: 8;\r
  width: 300px;\r
  padding: 16px;\r
  box-sizing: border-box;\r
  border-radius: 16px;\r
  background-color: var(--pv-x-bg, #fff);\r
  color: var(--pv-x-fg, #0f1419);\r
  box-shadow: 0 0 0 1px var(--pv-x-border, #eff3f4), 0 12px 32px rgba(0, 0, 0, 0.18);\r
  font-size: 15px;\r
  line-height: 20px;\r
}\r
.pv-x-profile-top {\r
  display: flex;\r
  align-items: flex-start;\r
  justify-content: space-between;\r
  gap: 12px;\r
  min-height: 64px;\r
}\r
.pv-x-profile-avatar {\r
  display: block;\r
  width: 64px;\r
  height: 64px;\r
  border-radius: 50%;\r
  overflow: hidden;\r
  background-color: var(--pv-x-soft, #f7f9f9);\r
  text-decoration: none;\r
}\r
.pv-x-profile-avatar img {\r
  display: block;\r
  width: 100%;\r
  height: 100%;\r
  object-fit: cover;\r
  border: 0;\r
}\r
.pv-x-profile-follow {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  margin: 0;\r
  padding: 7px 16px;\r
  border: 1px solid var(--pv-x-fg, #0f1419);\r
  border-radius: 999px;\r
  background-color: var(--pv-x-fg, #0f1419);\r
  color: var(--pv-x-bg, #fff);\r
  font: inherit;\r
  font-size: 14px;\r
  font-weight: 700;\r
  cursor: pointer;\r
}\r
.pv-x-profile-follow[data-following='true'] {\r
  background-color: transparent;\r
  color: var(--pv-x-fg, #0f1419);\r
}\r
.pv-x-profile-follow-hover {\r
  display: none;\r
}\r
.pv-x-profile-follow[data-following='true']:hover,\r
.pv-x-profile-follow[data-confirm='true'] {\r
  border-color: var(--pv-x-danger, #d0101c);\r
  background-color: transparent;\r
  color: var(--pv-x-danger, #d0101c);\r
}\r
/* 取关确认态：显示「确认取消关注」（default 文字），不切到悬停文字 */\r
.pv-x-profile-follow[data-confirm='true'] .pv-x-profile-follow-default,\r
.pv-x-profile-follow[data-confirm='true']:hover .pv-x-profile-follow-default {\r
  display: inline;\r
}\r
.pv-x-profile-follow[data-confirm='true']:hover .pv-x-profile-follow-hover {\r
  display: none;\r
}\r
.pv-x-profile-follow[data-following='true']:hover .pv-x-profile-follow-default {\r
  display: none;\r
}\r
.pv-x-profile-follow[data-following='true']:hover .pv-x-profile-follow-hover {\r
  display: inline;\r
}\r
.pv-x-profile-follow:disabled {\r
  opacity: 0.6;\r
  cursor: default;\r
}\r
.pv-x-profile-name {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  margin-top: 10px;\r
  color: var(--pv-x-fg, #0f1419);\r
  font-size: 17px;\r
  font-weight: 700;\r
  text-decoration: none;\r
}\r
.pv-x-profile-name strong {\r
  font-weight: 700;\r
}\r
.pv-x-profile-handle {\r
  display: block;\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 15px;\r
  text-decoration: none;\r
}\r
.pv-x-profile-follows-you {\r
  display: inline-block;\r
  margin-top: 6px;\r
  padding: 1px 6px;\r
  border-radius: 4px;\r
  background-color: var(--pv-x-soft, #f7f9f9);\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 12px;\r
}\r
.pv-x-profile-bio {\r
  margin: 10px 0 0;\r
  font-size: 15px;\r
  line-height: 20px;\r
  overflow-wrap: anywhere;\r
}\r
.pv-x-profile-stats {\r
  display: flex;\r
  gap: 16px;\r
  margin-top: 10px;\r
  font-size: 14px;\r
}\r
.pv-x-profile-stats a {\r
  color: var(--pv-x-muted, #536471);\r
  text-decoration: none;\r
}\r
.pv-x-profile-stats strong {\r
  color: var(--pv-x-fg, #0f1419);\r
  font-weight: 700;\r
}\r
.pv-x-profile-summary {\r
  display: block;\r
  margin-top: 12px;\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 14px;\r
  text-decoration: none;\r
}\r
.pv-x-profile-summary:hover {\r
  text-decoration: underline;\r
}\r
/* X 长文（Article）：封面 + 标题 + 正文排版 */\r
.pv-x-article {\r
  margin-top: 10px;\r
}\r
.pv-x-article-cover {\r
  overflow: hidden;\r
  border: 1px solid var(--pv-x-border, #eff3f4);\r
  border-radius: 16px;\r
}\r
.pv-x-article-cover img {\r
  display: block;\r
  width: 100%;\r
  max-height: 320px;\r
  object-fit: cover;\r
  border: 0;\r
}\r
.pv-x-article-heading {\r
  margin-top: 12px;\r
}\r
.pv-x-article-title {\r
  margin: 0 0 6px;\r
  font-size: 20px;\r
  line-height: 26px;\r
  font-weight: 800;\r
  color: var(--pv-x-fg, #0f1419);\r
}\r
.pv-x-article-open {\r
  color: var(--pv-x-accent, #1d9bf0);\r
  font-size: 13px;\r
  text-decoration: none;\r
}\r
.pv-x-article-open:hover {\r
  text-decoration: underline;\r
}\r
.pv-x-article-content {\r
  margin-top: 10px;\r
}\r
.pv-x-article-p {\r
  margin: 0 0 12px;\r
  font-size: 15px;\r
  line-height: 20px;\r
  overflow-wrap: anywhere;\r
}\r
.pv-x-article-h2,\r
.pv-x-article-h3,\r
.pv-x-article-h4 {\r
  margin: 18px 0 8px;\r
  color: var(--pv-x-fg, #0f1419);\r
  font-weight: 800;\r
}\r
.pv-x-article-h2 {\r
  font-size: 18px;\r
  line-height: 24px;\r
}\r
.pv-x-article-h3 {\r
  font-size: 17px;\r
  line-height: 22px;\r
}\r
.pv-x-article-h4 {\r
  font-size: 16px;\r
  line-height: 21px;\r
}\r
.pv-x-article-quote {\r
  margin: 0 0 12px;\r
  padding: 2px 0 2px 12px;\r
  border-left: 3px solid var(--pv-x-border, #eff3f4);\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 15px;\r
  line-height: 20px;\r
}\r
.pv-x-article-list {\r
  margin: 0 0 12px;\r
  padding-left: 22px;\r
  font-size: 15px;\r
  line-height: 20px;\r
}\r
.pv-x-article-list li {\r
  margin-bottom: 4px;\r
}\r
.pv-x-article-figure {\r
  margin: 12px 0;\r
}\r
.pv-x-article-figure img {\r
  display: block;\r
  width: 100%;\r
  border: 1px solid var(--pv-x-border, #eff3f4);\r
  border-radius: 16px;\r
}\r
/* 评论里的长文：紧凑卡片 */\r
.pv-x-article-card {\r
  display: block;\r
  margin-top: 8px;\r
  overflow: hidden;\r
  border: 1px solid var(--pv-x-border, #eff3f4);\r
  border-radius: 16px;\r
  text-decoration: none;\r
}\r
.pv-x-article-card-cover {\r
  display: block;\r
  width: 100%;\r
  max-height: 200px;\r
  object-fit: cover;\r
}\r
.pv-x-article-card-body {\r
  display: block;\r
  padding: 10px 12px;\r
}\r
.pv-x-article-card-domain {\r
  display: block;\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 13px;\r
}\r
.pv-x-article-card-title {\r
  display: block;\r
  margin-top: 2px;\r
  color: var(--pv-x-fg, #0f1419);\r
  font-size: 15px;\r
  line-height: 20px;\r
}\r
.pv-x-article-card-desc {\r
  display: block;\r
  margin-top: 2px;\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 14px;\r
  line-height: 19px;\r
}\r
/* 轻提示 */\r
.pv-x-toast {\r
  position: absolute;\r
  left: 50%;\r
  bottom: 16px;\r
  transform: translateX(-50%);\r
  max-width: 80%;\r
  padding: 8px 14px;\r
  border-radius: 8px;\r
  background-color: var(--pv-x-fg, #0f1419);\r
  color: var(--pv-x-bg, #fff);\r
  font-size: 13px;\r
  opacity: 0;\r
  pointer-events: none;\r
  transition: opacity 0.18s ease;\r
  /* 最上层：抽屉(7)/资料卡(8)/大图灯箱(9) 都开着时，「链接已复制」这类提示也要可见 */\r
  z-index: 10;\r
}\r
.pv-x-toast[data-visible='true'] {\r
  opacity: 1;\r
}\r
/* 错误提示：底色同阅读器，危险色描边与文字（三套主题对比度都 ≥ 4.5:1） */\r
.pv-x-toast[data-tone='error'] {\r
  border: 1px solid var(--pv-x-danger, #d0101c);\r
  background-color: var(--pv-x-bg, #fff);\r
  color: var(--pv-x-danger, #d0101c);\r
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);\r
}\r
.pv-x-reply {\r
  display: grid;\r
  grid-template-columns: 40px minmax(0, 1fr);\r
  gap: 12px;\r
  padding: 10px 16px 10px calc(16px + var(--pv-x-depth, 0) * 18px);\r
  border-bottom: 1px solid var(--pv-x-border, #eff3f4);\r
}\r
.pv-x-reply:hover {\r
  background-color: var(--pv-x-hover, rgba(0, 0, 0, 0.03));\r
}\r
.pv-x-reply .pv-x-avatar,\r
.pv-x-reply .pv-x-thread-line {\r
  opacity: 0.92;\r
}\r
/* 媒体：固定比例马赛克（X 原生思路）。宽高比由 CSS 给定，加载前即占位，无布局跳动 */\r
.pv-x-media {\r
  display: grid;\r
  gap: 2px;\r
  margin-top: 10px;\r
  max-width: 100%;\r
  border: 1px solid var(--pv-x-border, #eff3f4);\r
  border-radius: 16px;\r
  overflow: hidden;\r
}\r
/* 单图：宽高比由 JS 按原图写入，不裁切 */\r
.pv-x-media-1 {\r
  grid-template-columns: minmax(0, 1fr);\r
  max-height: 460px;\r
}\r
/* 2 图：并排，整体 2:1 */\r
.pv-x-media-2 {\r
  grid-template-columns: repeat(2, minmax(0, 1fr));\r
  aspect-ratio: 2 / 1;\r
  max-height: 300px;\r
}\r
/* 3 图：左一跨两行 + 右侧两张，整体 3:2 */\r
.pv-x-media-3 {\r
  grid-template-columns: repeat(2, minmax(0, 1fr));\r
  grid-template-rows: repeat(2, minmax(0, 1fr));\r
  aspect-ratio: 3 / 2;\r
  max-height: 380px;\r
}\r
.pv-x-media-3 .pv-x-media-item:first-child {\r
  grid-row: span 2;\r
}\r
/* 4 图：2×2 方阵 */\r
.pv-x-media-4 {\r
  grid-template-columns: repeat(2, minmax(0, 1fr));\r
  grid-template-rows: repeat(2, minmax(0, 1fr));\r
  aspect-ratio: 1 / 1;\r
  max-height: 420px;\r
}\r
.pv-x-media-item {\r
  display: block;\r
  position: relative;\r
  min-width: 0;\r
  min-height: 0;\r
  overflow: hidden;\r
  /* 图片项是 <button>：显式复位，避免宿主 button 样式渗入 */\r
  appearance: none;\r
  -webkit-appearance: none;\r
  margin: 0;\r
  padding: 0;\r
  border: 0;\r
  font: inherit;\r
  background-color: var(--pv-x-soft, #f7f9f9);\r
  cursor: zoom-in;\r
}\r
.pv-x-media-item img {\r
  display: block;\r
  width: 100%;\r
  height: 100%;\r
  object-fit: cover;\r
  border: 0;\r
}\r
.pv-x-media-1 .pv-x-media-item img {\r
  object-fit: contain;\r
}\r
.pv-x-media-video {\r
  display: flex;\r
  flex-direction: column;\r
}\r
.pv-x-video {\r
  display: block;\r
  flex: 1;\r
  width: 100%;\r
  min-width: 0;\r
  min-height: 0;\r
  background-color: #000;\r
  object-fit: contain;\r
}\r
.pv-x-video-poster {\r
  display: block;\r
  flex: 1;\r
  width: 100%;\r
  min-height: 0;\r
  object-fit: contain;\r
  border: 0;\r
}\r
.pv-x-video-open {\r
  display: block;\r
  padding: 8px 12px;\r
  background-color: var(--pv-x-bg, #fff);\r
  color: var(--pv-x-accent, #1d9bf0);\r
  font-size: 13px;\r
  text-decoration: none;\r
}\r
.pv-x-empty {\r
  padding: 24px 16px;\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 14px;\r
  text-align: center;\r
}\r
/* 资料卡、大图灯箱：淡入 */\r
@keyframes pv-x-fade-in {\r
  from {\r
    opacity: 0;\r
  }\r
  to {\r
    opacity: 1;\r
  }\r
}\r
.pv-x-profile-card,\r
.pv-x-media-lightbox {\r
  animation: pv-x-fade-in 0.14s ease-out;\r
}\r
@media (prefers-reduced-motion: reduce) {\r
  .pv-x-profile-card,\r
  .pv-x-media-lightbox {\r
    animation: none;\r
  }\r
}\r
/* 触屏：小操作的点击区扩到 ≥ 40px（用 ::before 扩热区，视觉尺寸不变） */\r
@media (pointer: coarse) {\r
  .pv-x-action,\r
  .pv-x-comment-entry,\r
  .pv-x-replies-link,\r
  .pv-x-sort-btn,\r
  .pv-x-more-text,\r
  .pv-x-card-btn,\r
  .pv-x-composer-target-clear,\r
  .pv-x-media-collapse,\r
  .pv-x-media-open,\r
  .pv-x-zoom-btn,\r
  .pv-x-zoom-fit,\r
  .pv-x-open,\r
  .pv-x-translation-link {\r
    position: relative;\r
  }\r
  .pv-x-action::before,\r
  .pv-x-comment-entry::before,\r
  .pv-x-replies-link::before,\r
  .pv-x-sort-btn::before,\r
  .pv-x-more-text::before,\r
  .pv-x-card-btn::before,\r
  .pv-x-composer-target-clear::before,\r
  .pv-x-media-collapse::before,\r
  .pv-x-media-open::before,\r
  .pv-x-zoom-btn::before,\r
  .pv-x-zoom-fit::before,\r
  .pv-x-open::before,\r
  .pv-x-translation-link::before {\r
    content: '';\r
    position: absolute;\r
    top: 50%;\r
    left: 50%;\r
    width: max(100%, 40px);\r
    height: 40px;\r
    transform: translate(-50%, -50%);\r
  }\r
}\r
`;

  // src/ui/PopupPanel.js
  var SNAP_TRANSFORM_RE = /^translate\(calc\(-50%/;
  var isSnapTransform = (value) => SNAP_TRANSFORM_RE.test(String(value || "").trim());
  var PopupPanel = class {
    constructor() {
      this._stylesInstalled = false;
      this.panel = null;
      this.overlay = null;
      this.titleEl = null;
      this.titleTextEl = null;
      this.contentArea = null;
      this.toolbar = null;
      this.footer = null;
      this.footerLinkBtn = null;
      this.backBtn = null;
      this.forwardBtn = null;
      this.settingsPopover = null;
      this.settingsBtn = null;
      this.rulesPanel = null;
      this._settingsAnchor = null;
      this.currentPanelSize = null;
      this.currentUrl = "";
      this.isFullScreen = false;
      this.preFullScreen = {};
      this.handlers = {};
      this._onKeydownBound = null;
      this._snapTimer = null;
      this._centerTimer = null;
    }
    /** 外壳样式：Shadow DOM 可用时装进 shadow root（页面只留论坛装饰那一段），否则按旧方式全局注入。 */
    _installStyles() {
      var _a;
      if (this._stylesInstalled) return;
      this._stylesInstalled = true;
      const root = ((_a = config.ui) == null ? void 0 : _a.shadow) === false ? null : createUiHost(style_default);
      if (!root) gm.addStyle(style_default);
    }
    ensure() {
      if (this.panel) return this.panel;
      this._installStyles();
      if (this._theme) this.applyTheme(this._theme);
      this.overlay = el("div", { id: "popup-panel-overlay", onclick: () => this.close() });
      mountUi(this.overlay);
      const titleMark = el("span", { class: "pv-title-mark" });
      titleMark.appendChild(svgIcon("article", { size: 15 }));
      this.titleTextEl = el("span", { class: "pv-title-text", text: "查看内容" });
      this.titleEl = el("div", { id: "popup-panel-title" }, titleMark, this.titleTextEl);
      this.toolbar = createToolbar({
        onRefresh: () => {
          var _a, _b;
          return (_b = (_a = this.handlers).onRefresh) == null ? void 0 : _b.call(_a, this.currentUrl);
        },
        onMaximize: () => this.toggleFullScreen(),
        onOpenExternal: () => {
          var _a, _b;
          return (_b = (_a = this.handlers).onOpenExternal) == null ? void 0 : _b.call(_a, this.currentUrl);
        },
        onClose: () => this.close(),
        onSettings: () => {
          var _a;
          if ((_a = this.settingsPopover) == null ? void 0 : _a.classList.contains("visible")) {
            this.hideSettings();
            return;
          }
          this.showSettingsNear(this.settingsBtn.getBoundingClientRect(), this.settingsBtn);
        }
      });
      this.settingsBtn = this.toolbar.settings;
      const header = el("div", { id: "popup-panel-header" }, this.titleEl, this.toolbar.actions);
      this.header = header;
      this.contentArea = el("div", { id: "popup-content-area" });
      this.backBtn = el("button", {
        id: "popup-panel-back",
        class: "popup-panel-btn",
        title: "后退 (Alt+←)",
        onclick: () => {
          var _a, _b;
          return (_b = (_a = this.handlers).onBack) == null ? void 0 : _b.call(_a);
        }
      });
      this.backBtn.appendChild(svgIcon("arrowLeft", { size: 14 }));
      this.forwardBtn = el("button", {
        id: "popup-panel-forward",
        class: "popup-panel-btn",
        title: "前进 (Alt+→)",
        onclick: () => {
          var _a, _b;
          return (_b = (_a = this.handlers).onForward) == null ? void 0 : _b.call(_a);
        }
      });
      this.forwardBtn.appendChild(svgIcon("arrowRight", { size: 14 }));
      this.backBtn.setAttribute("aria-label", "后退");
      this.forwardBtn.setAttribute("aria-label", "前进");
      this.navGroup = el("div", { class: "pv-footer-nav pv-no-history" }, this.backBtn, this.forwardBtn);
      const navGroup = this.navGroup;
      this.footerHostEl = el("span", { class: "pv-footer-host" });
      this.footerLinkBtn = el("button", {
        id: "popup-panel-footer-link",
        class: "popup-panel-btn",
        title: "在新标签页打开",
        onclick: () => {
          var _a, _b;
          return (_b = (_a = this.handlers).onOpenExternal) == null ? void 0 : _b.call(_a, this.currentUrl);
        }
      });
      this.footerLinkBtn.appendChild(svgIcon("external", { size: 14 }));
      this.footerLinkBtn.setAttribute("aria-label", "在新标签页打开");
      this.footer = el("div", { id: "popup-panel-footer" }, navGroup, this.footerHostEl, this.footerLinkBtn);
      this.titleTextEl.id = "popup-panel-title-text";
      this.panel = el(
        "div",
        { id: "popup-content-panel", role: "dialog", tabindex: "-1", "aria-labelledby": "popup-panel-title-text" },
        header,
        this.contentArea,
        this.footer
      );
      mountUi(this.panel);
      this.floatBtn = el("button", { id: "pv-float-settings", title: "脚本设置" });
      this.floatBtn.appendChild(svgIcon("settings", { size: 16 }));
      this.floatBtn.addEventListener("click", () => {
        var _a;
        if ((_a = this.settingsPopover) == null ? void 0 : _a.classList.contains("visible")) {
          this.hideSettings();
          return;
        }
        this.showSettingsNear(this.floatBtn.getBoundingClientRect(), this.floatBtn);
      });
      mountUi(this.floatBtn);
      [this.panel, this.overlay].forEach((node) => this._syncInert(node));
      eventBus.on("picker-start", () => {
        this.panel.classList.add("pv-picking");
        this.overlay.classList.add("pv-picking");
      });
      eventBus.on("picker-end", () => {
        this.panel.classList.remove("pv-picking");
        this.overlay.classList.remove("pv-picking");
      });
      if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) {
        header.addEventListener("dblclick", (e) => {
          if (e.target.closest("button")) return;
          this.toggleFullScreen();
        });
      }
      this.contentArea.addEventListener("click", (e) => {
        var _a, _b;
        if (settingsManager.get().popupLinksNewTab !== false) return;
        const link = closestInPath(e, "a[href]");
        if (!link) return;
        const href = link.getAttribute("href");
        if (!href || /^(javascript:|#)/i.test(href.trim())) return;
        e.preventDefault();
        e.stopPropagation();
        const url = link.href;
        (_b = (_a = this.handlers).onOpenInWindow) == null ? void 0 : _b.call(_a, url, (link.textContent || "").trim());
      });
      this._setupDrag(header);
      this._setupResize();
      this._setupKeyboard();
      return this.panel;
    }
    /** 设置面板按需创建：首次打开设置/规则前不构建它的上百个表单节点。 */
    ensureSettingsPanel() {
      if (this.settingsPopover) return this.settingsPopover;
      this.settingsPopover = createSettingsPanel({
        onChange: (s) => this.applySettings(s),
        onManageRules: () => this.showRulesPanel(),
        onClose: () => this.hideSettings()
      });
      mountUi(this.settingsPopover);
      this._syncInert(this.settingsPopover);
      document.addEventListener("click", (e) => {
        var _a;
        if (!((_a = this.settingsPopover) == null ? void 0 : _a.classList.contains("visible"))) return;
        if (closestInPath(e, "#popup-settings-popover, #popup-panel-settings, #pv-float-settings")) return;
        this.hideSettings();
      });
      return this.settingsPopover;
    }
    /** 规则面板同样按需创建；油猴菜单直接点选时也会先调用这里。 */
    ensureRulesPanel() {
      if (this.rulesPanel) return this.rulesPanel;
      this.rulesPanel = createRulesPanel();
      mountUi(this.rulesPanel.backdrop);
      mountUi(this.rulesPanel.root);
      this._syncInert(this.rulesPanel.root);
      this._syncInert(this.rulesPanel.backdrop);
      return this.rulesPanel;
    }
    show(title, url) {
      var _a;
      debugMark("panel.show");
      this.ensure();
      clearTimeout(this._clearTimer);
      this._clearTimer = null;
      (_a = this.floatBtn) == null ? void 0 : _a.classList.add("hidden");
      this.currentUrl = url || "";
      this.titleTextEl.textContent = title || "查看内容";
      this.updateFooterUrl(url);
      this.panel.classList.remove("visible");
      clearTimeout(this._centerTimer);
      const pos = this.isFullScreen ? {
        top: this.preFullScreen.top || "",
        left: this.preFullScreen.left || "",
        transform: this.preFullScreen.transform || ""
      } : {
        top: this.panel.style.top,
        left: this.panel.style.left,
        // 只清掉自己写的「取整位移」：它会压掉 CSS 的居中与 scale 开场动画，且尺寸变化后会过期。
        // 用户拖动/手机模式写入的 transform（none）必须原样保留，否则 left/top 会被当成左上角坐标再叠一次 -50%。
        transform: isSnapTransform(this.panel.style.transform) ? "" : this.panel.style.transform
      };
      Object.assign(this.panel.style, {
        width: "",
        height: "",
        top: pos.top,
        left: pos.left,
        transform: pos.transform,
        maxWidth: "",
        maxHeight: "",
        borderRadius: "",
        zIndex: ""
      });
      this.panel.classList.remove("pv-fullscreen");
      this.isFullScreen = false;
      this.updateMaximizeIcon();
      this.applySettings(settingsManager.get());
      if (!this._returnFocus) this._returnFocus = deepActiveElement();
      requestAnimationFrame(() => {
        this.panel.classList.add("visible");
        this.panel.inert = false;
        this._interactedInside = true;
        try {
          this.panel.focus({ preventScroll: true });
        } catch {
        }
        debugMark("panel.visible");
        if (settingsManager.get().windowMode !== "float") this.overlay.classList.add("visible");
        this._fixCentering();
        clearTimeout(this._snapTimer);
        this._snapTimer = setTimeout(() => this._snapTransform(), 340);
      });
    }
    close() {
      var _a, _b, _c;
      if (!this.panel) return;
      if (this.isFullScreen) this.toggleFullScreen();
      clearTimeout(this._snapTimer);
      clearTimeout(this._centerTimer);
      this.hideSettings();
      (_a = this.floatBtn) == null ? void 0 : _a.classList.remove("hidden");
      const focusInside = this.panel.contains(deepActiveElement()) || deepActiveElement() === document.body;
      this.panel.classList.remove("visible");
      this.overlay.classList.remove("visible");
      const back = this._returnFocus;
      this._returnFocus = null;
      this._interactedInside = false;
      if (focusInside && back && back.isConnected && back !== document.body && typeof back.focus === "function") {
        try {
          back.focus({ preventScroll: true });
        } catch {
        }
      }
      (_c = (_b = this.handlers).onClose) == null ? void 0 : _c.call(_b);
      clearTimeout(this._clearTimer);
      this._clearTimer = setTimeout(() => {
        this._clearTimer = null;
        this.contentArea.innerHTML = "";
        this.currentUrl = "";
      }, 350);
    }
    setTitle(text) {
      if (!this.titleTextEl) return;
      this.titleTextEl.textContent = text || "查看内容";
      this.titleTextEl.title = text || "";
    }
    updateFooterUrl(url) {
      var _a;
      if (this.footerLinkBtn) this.footerLinkBtn.title = url ? "在新标签页打开：" + url : "在新标签页打开";
      if (this.footerHostEl) {
        let host = "";
        try {
          host = url ? new URL(url).hostname.replace(/^www\./, "") : "";
        } catch {
        }
        this.footerHostEl.textContent = host;
        this.footerHostEl.title = url || "";
      }
      (_a = this.footer) == null ? void 0 : _a.classList.toggle("empty", !url);
    }
    /** 更新前进/后退按钮可用状态；两个都不可用时整组隐藏。 */
    setNavState(canBack, canForward) {
      var _a;
      if (this.backBtn) this.backBtn.disabled = !canBack;
      if (this.forwardBtn) this.forwardBtn.disabled = !canForward;
      (_a = this.navGroup) == null ? void 0 : _a.classList.toggle("pv-no-history", !canBack && !canForward);
    }
    /**
     * 应用设置到面板：滚动条显隐 + 窗体大小预设 + 手机模式位置记忆。
     */
    applySettings(s) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      this.ensure();
      const prevSize = this.currentPanelSize;
      const nextSize = s.panelSize || config.popup.defaultSize;
      this.currentPanelSize = nextSize;
      this.applyTheme(s.theme);
      this._setHandedness(s.handedness);
      (_a = this.panel) == null ? void 0 : _a.classList.toggle("pv-locked", s.locked === true);
      (_b = this.floatBtn) == null ? void 0 : _b.classList.toggle("pv-float-off", s.hideFloatButton === true);
      if (this.floatBtn) this.floatBtn.style.display = s.hideFloatButton === true ? "none" : "";
      (_c = this.panel) == null ? void 0 : _c.classList.toggle("pv-no-mobile-resize", s.mobileResize === false);
      (_d = this.contentArea) == null ? void 0 : _d.classList.toggle("pv-hide-scrollbar", s.scrollbarVisible === false);
      let width;
      let height;
      if (nextSize === "custom" && s.customSize) {
        width = `${s.customSize.width}px`;
        height = `${s.customSize.height}px`;
      } else if (nextSize === "phone") {
        const m = config.phone.sizes[s.phoneModel] || config.phone.sizes[config.phone.defaultModel];
        const size = config.popup.sizes[config.popup.defaultSize];
        width = m ? m.width : size.width;
        height = m ? m.height : size.height;
      } else if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches && (window.innerWidth <= 560 || window.innerHeight <= 560)) {
        width = "calc(100vw - 12px)";
        height = "calc(100dvh - 12px)";
      } else {
        const size = config.popup.sizes[nextSize] || config.popup.sizes[config.popup.defaultSize];
        width = size.width;
        height = size.height;
      }
      (_e = this.panel) == null ? void 0 : _e.style.setProperty("--popup-width", width);
      (_f = this.panel) == null ? void 0 : _f.style.setProperty("--popup-height", height);
      if ((_g = this.panel) == null ? void 0 : _g.classList.contains("visible")) this._snapTransform();
      if (((_h = this.settingsPopover) == null ? void 0 : _h.classList.contains("visible")) && this._settingsAnchor) {
        this.showSettingsNear(this._settingsAnchor);
      }
      if (nextSize === "phone") {
        this.restorePhonePosition();
      } else if (prevSize === "phone") {
        this.savePhonePosition();
        this.centerPanel();
      }
    }
    /** 应用外观主题：auto 跟随系统，light/dark 手动覆盖。 */
    applyTheme(theme) {
      var _a;
      const t = theme || "auto";
      this._theme = t;
      const host = (_a = uiRoot()) == null ? void 0 : _a.host;
      const root = host || document.documentElement;
      root.classList.toggle("pv-theme-dark", t === "dark");
      root.classList.toggle("pv-theme-light", t === "light");
      if (host) document.documentElement.classList.remove("pv-theme-dark", "pv-theme-light");
    }
    /** 惯用手：左手模式镜像工具栏（✕ 移到左上角）。 */
    _setHandedness(handedness) {
      if (!this.toolbar || !this.header) return;
      const left = handedness === "left";
      const acts = this.toolbar.actions;
      const order = left ? ["close", "settings", "open", "maximize", "refresh"] : ["refresh", "maximize", "open", "settings", "close"];
      const map = {
        refresh: this.toolbar.refresh,
        maximize: this.toolbar.maximize,
        open: this.toolbar.open,
        settings: this.toolbar.settings,
        close: this.toolbar.close
      };
      order.forEach((id) => acts.appendChild(map[id]));
      if (left) {
        if (this.header.firstChild !== acts) this.header.insertBefore(acts, this.header.firstChild);
      } else if (this.header.firstChild !== this.titleEl) {
        this.header.insertBefore(this.titleEl, this.header.firstChild);
      }
    }
    /** 记录手机模式下的窗体位置（持久化）。 */
    savePhonePosition() {
      if (!this.panel || this.isFullScreen) return;
      if (this.panel.style.left || this.panel.style.top) {
        settingsManager.set({
          phonePosition: { left: this.panel.style.left, top: this.panel.style.top }
        });
      }
    }
    /** 恢复到上次记录的手机模式位置。 */
    restorePhonePosition() {
      if (!this.panel || this.isFullScreen) return;
      const pos = settingsManager.get().phonePosition;
      if (pos && pos.left) {
        this.panel.style.left = pos.left;
        this.panel.style.top = pos.top;
        this.panel.style.transform = "none";
      }
    }
    /** 重置为居中位置。 */
    centerPanel() {
      if (!this.panel || this.isFullScreen) return;
      this.panel.style.left = "";
      this.panel.style.top = "";
      this.panel.style.transform = "";
      this._snapTransform();
      clearTimeout(this._centerTimer);
      this._centerTimer = setTimeout(() => {
        if (!this.panel || !this.panel.classList.contains("visible")) return;
        this._fixCentering();
        this._snapTransform();
      }, 340);
    }
    /**
     * 把居中位移取整到整数像素。
     * Chrome 在图层带**非整数位移**时会关闭次像素（LCD）抗锯齿、改用灰度抗锯齿，
     * 同样的字重看起来就更细——弹窗正文与宿主页面字体粗细不一致多半出在这里
     * （面板宽高取视口百分比，一半常是 x.5）。取整后视觉偏移 ≤0.5px，可忽略。
     */
    _snapTransform() {
      if (!this.panel || this.isFullScreen) return;
      if (this.panel.style.left || this.panel.style.top) return;
      const rect = this.panel.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const offset = (value) => {
        const remainder = value / 2 - Math.round(value / 2);
        return remainder < 0 ? `- ${Math.abs(remainder)}px` : `+ ${remainder}px`;
      };
      this.panel.style.transform = `translate(calc(-50% ${offset(rect.width)}), calc(-50% ${offset(rect.height)}))`;
    }
    /**
     * 居中校正：挂载点已避开被 transform 的祖先，但宿主页面仍可能有别的因素让
     * CSS 的 top/left:50% 算不准（缩放、被覆盖等）。这里实测「窗体中心」与「视口中心」
     * 的偏差并换算成显式像素；用中心点计算，因此不受打开动画 scale 影响。
     * 只在居中模式（用户没拖过、非全屏）下生效。
     */
    _fixCentering() {
      if (!this.panel || this.isFullScreen) return;
      if (this.panel.style.left || this.panel.style.top) return;
      const rect = this.panel.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
      const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      const cs = getComputedStyle(this.panel);
      const left = parseFloat(cs.left);
      const top = parseFloat(cs.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) return;
      let ancestorScale = 1;
      try {
        const matrix = typeof DOMMatrixReadOnly === "function" ? new DOMMatrixReadOnly(cs.transform === "none" ? "" : cs.transform) : null;
        const panelScale = matrix && matrix.a ? matrix.a : 1;
        if (this.panel.offsetWidth && panelScale) {
          ancestorScale = rect.width / (this.panel.offsetWidth * panelScale) || 1;
        }
      } catch (err) {
        ancestorScale = 1;
      }
      this.panel.style.left = `${left + dx / ancestorScale}px`;
      this.panel.style.top = `${top + dy / ancestorScale}px`;
    }
    hideOverlay() {
      var _a;
      (_a = this.overlay) == null ? void 0 : _a.classList.remove("visible");
    }
    showOverlay() {
      var _a, _b;
      if ((_a = this.panel) == null ? void 0 : _a.classList.contains("visible")) (_b = this.overlay) == null ? void 0 : _b.classList.add("visible");
    }
    /** 在指定锚点旁显示设置面板（锚点为元素 getBoundingClientRect）。 */
    showSettingsNear(rect, trigger = null) {
      var _a, _b, _c;
      this.ensure();
      this.ensureSettingsPanel();
      const margin = 8;
      const pop = this.settingsPopover;
      (_a = pop.refresh) == null ? void 0 : _a.call(pop);
      this._settingsAnchor = rect;
      pop.style.maxHeight = "";
      pop.style.width = "";
      pop.style.bottom = "";
      pop.classList.remove("pv-settings-sheet");
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      const isSheet = coarse && (vw <= 560 || vh <= 560);
      if (isSheet) pop.classList.add("pv-settings-sheet");
      const popW = pop.offsetWidth || 340;
      const popH = pop.offsetHeight || 320;
      const spaceBelow = vh - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      let left;
      let top = null;
      if (isSheet) {
        left = 0;
      } else if (spaceBelow >= 240) {
        top = rect.bottom + margin;
        if (popH > spaceBelow) pop.style.maxHeight = `${Math.floor(spaceBelow)}px`;
      } else if (spaceAbove >= 240) {
        top = rect.top - popH;
      } else {
        top = margin;
      }
      if (top !== null && top < margin) top = margin;
      if (!isSheet) {
        left = rect.right - popW;
        if (left < margin) left = margin;
        if (left + popW > vw - margin) left = vw - margin - popW;
        if (left < margin) left = margin;
      }
      if (!isSheet && ((_b = this.panel) == null ? void 0 : _b.classList.contains("visible"))) {
        const panelRect = this.panel.getBoundingClientRect();
        const maxBottom = Math.min(vh - margin, panelRect.bottom - margin);
        const available = Math.floor(maxBottom - top);
        if (available >= 240 && popH > available) {
          pop.style.maxHeight = `${available}px`;
        }
      }
      pop.style.left = `${left}px`;
      if (top === null) {
        pop.style.top = "auto";
        pop.style.bottom = "0";
      } else {
        pop.style.top = `${top}px`;
      }
      const wasOpen = pop.classList.contains("visible");
      pop.classList.add("visible");
      (_c = this.settingsBtn) == null ? void 0 : _c.classList.add("active");
      if (!wasOpen) {
        this._settingsReturnFocus = trigger || deepActiveElement();
        pop.inert = false;
        const first = pop.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        try {
          first == null ? void 0 : first.focus({ preventScroll: true });
        } catch {
        }
      }
    }
    hideSettings({ restoreFocus = false } = {}) {
      var _a;
      const pop = this.settingsPopover;
      if (!pop) return;
      const wasOpen = pop.classList.contains("visible");
      const focusInside = wasOpen && pop.contains(deepActiveElement());
      pop.classList.remove("visible");
      (_a = this.settingsBtn) == null ? void 0 : _a.classList.remove("active");
      const back = this._settingsReturnFocus;
      this._settingsReturnFocus = null;
      if (wasOpen && (restoreFocus || focusInside) && back && back.isConnected && typeof back.focus === "function") {
        try {
          back.focus({ preventScroll: true });
        } catch {
        }
      }
    }
    showRulesPanel() {
      var _a;
      this.ensure();
      this.ensureRulesPanel();
      const trigger = this._settingsReturnFocus || this.settingsBtn || deepActiveElement();
      this.hideSettings();
      (_a = this.rulesPanel) == null ? void 0 : _a.open(trigger);
    }
    getContentArea() {
      this.ensure();
      return this.contentArea;
    }
    toggleFullScreen() {
      if (!this.panel) return;
      if (!this.isFullScreen) {
        this.preFullScreen = {
          width: this.panel.style.width,
          height: this.panel.style.height,
          top: this.panel.style.top,
          left: this.panel.style.left,
          transform: this.panel.style.transform,
          borderRadius: this.panel.style.borderRadius,
          maxWidth: this.panel.style.maxWidth,
          maxHeight: this.panel.style.maxHeight
        };
        this.panel.style.transition = "none";
        this.panel.classList.add("pv-fullscreen");
        void this.panel.offsetWidth;
        this.panel.style.transition = "";
        this.isFullScreen = true;
      } else {
        this.panel.style.transition = "none";
        this.panel.classList.remove("pv-fullscreen");
        Object.assign(this.panel.style, {
          width: this.preFullScreen.width || "",
          height: this.preFullScreen.height || "",
          top: this.preFullScreen.top || "",
          left: this.preFullScreen.left || "",
          transform: this.preFullScreen.transform || "",
          borderRadius: this.preFullScreen.borderRadius || "",
          maxWidth: this.preFullScreen.maxWidth || "",
          maxHeight: this.preFullScreen.maxHeight || "",
          zIndex: ""
        });
        void this.panel.offsetWidth;
        this.panel.style.transition = "";
        this.isFullScreen = false;
      }
      this.updateMaximizeIcon();
    }
    updateMaximizeIcon() {
      if (!this.toolbar) return;
      const btn = this.toolbar.maximize;
      btn.innerHTML = "";
      btn.appendChild(svgIcon(this.isFullScreen ? "minimize" : "maximize", { size: 16 }));
      btn.title = this.isFullScreen ? "恢复 (F)" : "全屏 (F)";
    }
    _setupDrag(header) {
      setupDrag({
        header,
        panel: this.panel,
        isFullScreen: () => this.isFullScreen,
        locked: () => settingsManager.get().locked === true,
        onDragEnd: (info) => {
          if (info && info.locked) return;
          this._clampToViewport();
          if (this.currentPanelSize === "phone") this.savePhonePosition();
        }
      });
      window.addEventListener("resize", () => {
        var _a, _b;
        if ((_a = this.panel) == null ? void 0 : _a.classList.contains("visible")) {
          requestAnimationFrame(() => {
            this._clampToViewport();
            this._snapTransform();
          });
        }
        if (((_b = this.settingsPopover) == null ? void 0 : _b.classList.contains("visible")) && this._settingsAnchor) {
          requestAnimationFrame(() => this.showSettingsNear(this._settingsAnchor));
        }
      });
    }
    /** 8 向自由缩放：拖边/角调整窗体大小，释放后持久化为自定义尺寸。 */
    _setupResize() {
      setupResize({
        panel: this.panel,
        isFullScreen: () => this.isFullScreen,
        locked: () => settingsManager.get().locked === true,
        onResizeEnd: (rect) => {
          const width = Math.round(rect.width);
          const height = Math.round(rect.height);
          this.panel.style.setProperty("--popup-width", `${width}px`);
          this.panel.style.setProperty("--popup-height", `${height}px`);
          this.currentPanelSize = "custom";
          settingsManager.set({ panelSize: "custom", customSize: { width, height } });
        }
      });
    }
    /**
     * 把弹窗约束回视口内（DevTools 占位 / 窗口缩放后调用），
     * 避免窗体被压缩出可视区域。
     */
    _clampToViewport() {
      clampToViewport(this.panel, { isFullScreen: this.isFullScreen });
    }
    /**
     * 弹窗快捷键。规则（v2.3.0）：
     * - 正在输入（输入框/文本域/可编辑区、输入法组字中）时不处理任何快捷键；
     *   Esc 在脚本自己的输入框里只让它失焦，在宿主页面的输入框里完全不管。
     * - 单字母 F / R 不能带修饰键，且只在「焦点或最近一次点击在弹窗内」或弹窗为模态（有遮罩）时生效，
     *   避免浮动模式下抢宿主网站自己的快捷键。
     * fromFrame：来自弹窗内同源 iframe 的按键（焦点在帖子里），视为弹窗内。
     */
    handleKeydown(e, { fromFrame = false } = {}) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      if (!this.panel || e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      const settingsOpen = (_a = this.settingsPopover) == null ? void 0 : _a.classList.contains("visible");
      const panelOpen = this.panel.classList.contains("visible");
      if (!settingsOpen && !panelOpen) return;
      const target = eventTarget(e);
      const editable = isEditableEvent(e);
      const inside = fromFrame || isOwnUiNode(target);
      if (e.key === "Escape") {
        if (editable) {
          if (inside && target && typeof target.blur === "function") {
            target.blur();
            e.preventDefault();
            e.stopImmediatePropagation();
          }
          return;
        }
        if (settingsOpen) {
          this.hideSettings({ restoreFocus: true });
          e.stopImmediatePropagation();
          return;
        }
        this.close();
        return;
      }
      if (!panelOpen || editable) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        if (e.key === "ArrowLeft") (_c = (_b = this.handlers).onBack) == null ? void 0 : _c.call(_b);
        else (_e = (_d = this.handlers).onForward) == null ? void 0 : _e.call(_d);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const modal = (_f = this.overlay) == null ? void 0 : _f.classList.contains("visible");
      if (!inside && !modal && !this._interactedInside) return;
      const key = String(e.key || "").toLowerCase();
      if (key === "f") {
        e.preventDefault();
        this.toggleFullScreen();
      } else if (key === "r" && this.currentUrl) {
        e.preventDefault();
        (_h = (_g = this.handlers).onRefresh) == null ? void 0 : _h.call(_g, this.currentUrl);
      }
    }
    _setupKeyboard() {
      if (this._onKeydownBound) return;
      this._onKeydownBound = (e) => this.handleKeydown(e);
      document.addEventListener("keydown", this._onKeydownBound);
      document.addEventListener(
        "pointerdown",
        (e) => {
          this._interactedInside = isOwnUiNode(eventTarget(e));
        },
        true
      );
      this._setupFrameKeys();
      setupWheelScrollChain({
        panel: this.panel,
        contentArea: () => this.contentArea,
        isFullScreen: () => this.isFullScreen
      });
    }
    /**
     * 焦点在帖子 iframe 里时，按键事件到不了宿主 document。
     * 同源 iframe 每次（重新）加载后给它的 document 挂一个转发监听；跨域读不到就跳过。
     */
    _setupFrameKeys() {
      const attach = (iframe) => {
        const bind = () => {
          try {
            const doc = iframe.contentDocument;
            if (!doc || doc.__pv2Keys) return;
            doc.__pv2Keys = true;
            doc.addEventListener("keydown", (e) => this.handleKeydown(e, { fromFrame: true }));
            doc.addEventListener("pointerdown", () => {
              this._interactedInside = true;
            });
          } catch {
          }
        };
        bind();
        iframe.addEventListener("load", bind);
      };
      const scan = () => {
        for (const iframe of this.contentArea.querySelectorAll("iframe")) {
          if (iframe.__pv2KeysWatched) continue;
          iframe.__pv2KeysWatched = true;
          attach(iframe);
        }
      };
      new MutationObserver(scan).observe(this.contentArea, { childList: true, subtree: true });
    }
    /**
     * 隐藏中的面板/弹层设为 inert：不能 Tab 进去，读屏也读不到；视觉上的淡入淡出不受影响。
     * 以 .visible 类为准自动同步，不必在每个显示/隐藏的地方手动维护。
     */
    _syncInert(node) {
      if (!node) return;
      const sync = () => {
        const hidden = !node.classList.contains("visible");
        node.inert = hidden;
        if (hidden) node.setAttribute("aria-hidden", "true");
        else node.removeAttribute("aria-hidden");
      };
      sync();
      new MutationObserver(sync).observe(node, { attributes: true, attributeFilter: ["class"] });
    }
  };

  // src/ui/Loading.js
  var SLOW_HINT_MS = 3e3;
  function showLoading(container, { title = "正在加载内容…", url = "" } = {}) {
    container.classList.remove("iframe-direct-load");
    const sub = el("div", { class: "pv-loading-sub", text: "请稍候" });
    const view = el(
      "div",
      { id: "popup-panel-loading", role: "status", "aria-live": "polite" },
      el("div", { class: "pv-spinner spinner", "aria-hidden": "true" }),
      el("div", { class: "pv-loading-hint", text: title }),
      sub
    );
    container.replaceChildren(view);
    setTimeout(() => {
      if (!view.isConnected) return;
      sub.textContent = "还在加载，网站响应较慢";
      if (url) {
        view.appendChild(
          el("button", {
            type: "button",
            class: "pv-loading-open",
            text: "在新标签页打开",
            onclick: () => window.open(url, "_blank", "noopener")
          })
        );
      }
    }, SLOW_HINT_MS);
    return view;
  }

  // src/ui/ErrorView.js
  function describeLoadError(message) {
    const text = String(message || "");
    const status = Number((text.match(/HTTP\s*(\d{3})/i) || [])[1]);
    if (status === 404 || status === 410) {
      return { title: "帖子不存在或已被删除", detail: `服务器返回 ${status}`, retry: false };
    }
    if (status === 401 || status === 403) {
      return { title: "没有权限查看", detail: `可能需要登录，或被网站拒绝（${status}）`, retry: false };
    }
    if (status === 429) return { title: "请求太频繁", detail: "网站暂时限制了访问，稍后再试（429）", retry: true };
    if (status >= 500) return { title: "网站暂时出错", detail: `服务器返回 ${status}，稍后再试`, retry: true };
    if (status) return { title: "加载失败", detail: `服务器返回 ${status}`, retry: true };
    if (/超时|timeout/i.test(text)) return { title: "加载超时", detail: "网络较慢或网站没有响应", retry: true };
    if (/网络|network/i.test(text)) return { title: "网络请求失败", detail: "请检查网络连接", retry: true };
    if (/解析/.test(text)) return { title: "内容无法显示", detail: "页面结构无法解析，可在新标签页打开", retry: false };
    return { title: "加载失败", detail: text || "无法加载请求的内容", retry: true };
  }
  function showError(container, message, url, { onRetry } = {}) {
    container.classList.remove("iframe-direct-load");
    const info = describeLoadError(message);
    const openBtn = el("button", { type: "button", class: "pv-error-open", text: "在新标签页打开" });
    if (!url) {
      openBtn.disabled = true;
    } else {
      openBtn.addEventListener("click", () => window.open(url, "_blank", "noopener"));
    }
    const actions = el("div", { class: "pv-error-actions" });
    if (info.retry && onRetry) {
      actions.appendChild(el("button", { type: "button", class: "pv-error-retry", text: "重试", onclick: () => onRetry() }));
    }
    actions.appendChild(openBtn);
    const view = el(
      "div",
      { id: "popup-panel-error", role: "alert" },
      svg(
        '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
        { class: "pv-error-icon", width: 52, height: 52, "stroke-width": 1.5, "aria-hidden": "true" }
      ),
      el("h3", { text: info.title }),
      el("p", { text: info.detail }),
      actions
    );
    container.replaceChildren(view);
  }

  // src/core/PopupManager.js
  markMod("PopupManager");
  var PopupManager = class {
    constructor() {
      this.popup = new PopupPanel();
      this._abort = null;
      this._currentUrl = "";
      this._navHistory = [];
      this._navIndex = -1;
      this._pendingNativeNav = false;
      this._pendingNativeTimer = null;
      this._pendingRevertIndex = -1;
      this._loadToken = 0;
      this._pendingDispose = null;
      this.popup.handlers = {
        onRefresh: (url) => {
          const e = this._navHistory[this._navIndex];
          if (e) e.inFrame = false;
          this.load(url);
        },
        onOpenExternal: (url) => url && window.open(url, "_blank", "noopener"),
        onOpenInWindow: (url, linkText) => {
          if (!url) return;
          this._pushHistory(url, linkText || "");
          this._currentUrl = url;
          if (linkText) this.popup.setTitle(linkText);
          this.popup.updateFooterUrl(url);
          this.load(url);
          this._syncNavState();
        },
        onBack: () => this.back(),
        onForward: () => this.forward(),
        onClose: () => {
          this._deferDispose();
          this._resetHistory();
        }
      };
    }
    /**
     * 打开弹窗并加载内容。
     */
    open({ url, title }) {
      debugMark("popup.open: " + url);
      this._pushHistory(url, title || "");
      this._currentUrl = url;
      this.popup.show(title, url);
      this.load(url);
      this._syncNavState();
    }
    /** 弹窗内后退一步：优先用 iframe 原生浏览器历史（只作用于弹窗内），否则回退到自维护栈重载。 */
    back() {
      if (this._navIndex <= 0) return;
      const entry = this._navHistory[this._navIndex];
      if (entry && entry.inFrame && this._nativeHistoryBack()) {
        const revertIndex = this._navIndex;
        this._navIndex--;
        this._markPendingNativeNav(revertIndex);
        this._applyEntry(this._navHistory[this._navIndex]);
        return;
      }
      this._navIndex--;
      this._navigateToCurrent();
    }
    /** 弹窗内前进一步。 */
    forward() {
      if (this._navIndex >= this._navHistory.length - 1) return;
      const entry = this._navHistory[this._navIndex + 1];
      if (entry && entry.inFrame && this._nativeHistoryForward()) {
        const revertIndex = this._navIndex;
        this._navIndex++;
        this._markPendingNativeNav(revertIndex);
        this._applyEntry(entry);
        return;
      }
      this._navIndex++;
      this._navigateToCurrent();
    }
    /** 尝试调用弹窗内 iframe 的原生 history.back()；不可用（无 iframe/跨域）返回 false。 */
    _nativeHistoryBack() {
      try {
        const iframe = this._currentIframe();
        const win = iframe && iframe.contentWindow;
        if (win && win.history && typeof win.history.back === "function") {
          win.history.back();
          return true;
        }
      } catch {
      }
      return false;
    }
    _nativeHistoryForward() {
      try {
        const iframe = this._currentIframe();
        const win = iframe && iframe.contentWindow;
        if (win && win.history && typeof win.history.forward === "function") {
          win.history.forward();
          return true;
        }
      } catch {
      }
      return false;
    }
    _currentIframe() {
      try {
        const iframe = this.popup.getContentArea().querySelector("#popup-panel-iframe");
        return iframe && iframe.isConnected ? iframe : null;
      } catch {
        return null;
      }
    }
    _markPendingNativeNav(revertIndex) {
      this._pendingNativeNav = true;
      this._pendingRevertIndex = revertIndex;
      clearTimeout(this._pendingNativeTimer);
      this._pendingNativeTimer = setTimeout(() => {
        if (this._pendingNativeNav) {
          this._pendingNativeNav = false;
          this._navIndex = this._pendingRevertIndex;
          this._applyEntry(this._navHistory[this._navIndex]);
        }
      }, 2e3);
    }
    /** 仅同步标题/链接，不重新加载（原生 back/forward 由 iframe 自己完成）。 */
    _applyEntry(entry) {
      if (!entry) return;
      this._currentUrl = entry.url;
      this.popup.setTitle(entry.title);
      this.popup.updateFooterUrl(entry.url);
      this._syncNavState();
    }
    _navigateToCurrent() {
      const entry = this._navHistory[this._navIndex];
      if (!entry) return;
      entry.inFrame = false;
      this._currentUrl = entry.url;
      this.popup.setTitle(entry.title);
      this.popup.updateFooterUrl(entry.url);
      this.load(entry.url);
      this._syncNavState();
    }
    _pushHistory(url, title, inFrame = false) {
      this._navHistory = this._navHistory.slice(0, this._navIndex + 1);
      this._navHistory.push({ url, title: title || "查看内容", inFrame });
      this._navIndex = this._navHistory.length - 1;
      if (this._navHistory.length > 50) {
        this._navHistory.shift();
        this._navIndex--;
      }
    }
    _syncNavState() {
      this.popup.setNavState(this._navIndex > 0, this._navIndex < this._navHistory.length - 1);
    }
    /** iframe 内容内部自主跳转（同源可读时），记入历史并同步标题/链接。 */
    _onInFrameNavigate(url, title) {
      if (!url) return;
      const wasNative = this._pendingNativeNav;
      this._pendingNativeNav = false;
      if (wasNative) clearTimeout(this._pendingNativeTimer);
      if (url === this._currentUrl) return;
      if (/^(content|about:blank)?$/i.test(String(title || "").trim())) title = "";
      if (wasNative) {
        const entry = this._navHistory[this._navIndex];
        if (entry) {
          entry.url = url;
          if (title) entry.title = title;
        }
      } else {
        this._pushHistory(url, title || "", true);
      }
      this._currentUrl = url;
      const cur = this._navHistory[this._navIndex];
      this.popup.setTitle(cur && cur.title || title || "查看内容");
      this.popup.updateFooterUrl(url);
      this._syncNavState();
    }
    /**
     * 加载指定 URL 内容到弹窗内容区。
     */
    load(url) {
      var _a;
      debugMark("popup.load: " + url);
      this._flushDispose();
      (_a = this._abort) == null ? void 0 : _a.call(this);
      this._abort = null;
      const token = ++this._loadToken;
      const current = () => token === this._loadToken;
      const contentArea = this.popup.getContentArea();
      contentArea.classList.remove("iframe-direct-load");
      contentArea.innerHTML = "";
      showLoading(contentArea, { url });
      let hostname = "unknown";
      try {
        hostname = new URL(url).hostname;
      } catch {
      }
      logger.log(`[PopupManager] open ${url}`);
      this._abort = loaderManager.load(url, {
        container: contentArea,
        hostname,
        onError: (message) => {
          if (!current()) return;
          showError(contentArea, message, url, { onRetry: () => this.load(url) });
        },
        // 加载成功后不再清掉 _abort：它同时是清理函数（X 加载器要断开观察器、清翻译队列），
        // 关窗和下一次加载时都必须调用（v2.3.0 前成功后被置 null，清理从不执行）
        onLoad: () => {
        },
        onNavigate: (navUrl, navTitle) => {
          if (current()) this._onInFrameNavigate(navUrl, navTitle);
        }
      });
    }
    /** 关窗时的清理延后到淡出结束，避免内容在动画中途消失；期间重新打开则立即执行。 */
    _deferDispose() {
      const dispose = this._abort;
      this._abort = null;
      this._loadToken++;
      if (!dispose) return;
      this._flushDispose();
      this._pendingDispose = { fn: dispose, timer: setTimeout(() => this._flushDispose(), 360) };
    }
    _flushDispose() {
      const pending = this._pendingDispose;
      if (!pending) return;
      this._pendingDispose = null;
      clearTimeout(pending.timer);
      try {
        pending.fn();
      } catch (err) {
        logger.warn("[PopupManager] dispose error", err);
      }
    }
    _resetHistory() {
      this._navHistory = [];
      this._navIndex = -1;
      this._pendingNativeNav = false;
      clearTimeout(this._pendingNativeTimer);
      this._pendingNativeTimer = null;
      this._pendingRevertIndex = -1;
    }
    close() {
      this.popup.close();
    }
    hideOverlay() {
      this.popup.hideOverlay();
    }
    showOverlay() {
      this.popup.showOverlay();
    }
  };
  var popupManager = new PopupManager();

  // src/core/PrefetchManager.js
  var PrefetchManager = class {
    constructor(loaderManager2) {
      this.loader = loaderManager2;
      this._timer = null;
      this._current = null;
    }
    /**
     * 预约预热某个 URL（带防抖）。
     */
    schedule(url, hostname) {
      var _a;
      if (!config.prefetch.enabled) return;
      if (this.loader.resolveMode(url, hostname) !== "cache") return;
      if (this.loader.hasCached(url)) return;
      if (((_a = this._current) == null ? void 0 : _a.url) === url) return;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._run(url), config.prefetch.hoverDebounceMs);
    }
    cancel() {
      clearTimeout(this._timer);
      this._timer = null;
    }
    abort() {
      this.cancel();
      if (this._current) {
        try {
          this._current.abort();
        } catch {
        }
        this._current = null;
      }
    }
    _run(url) {
      var _a;
      if (((_a = this._current) == null ? void 0 : _a.url) === url) return;
      if (this._current) {
        try {
          this._current.abort();
        } catch {
        }
        this._current = null;
      }
      logger.debug(`[Prefetch] ${url}`);
      const entry = this.loader.prefetch(url);
      this._current = { url, abort: entry.abort };
      const done = () => {
        var _a2;
        if (((_a2 = this._current) == null ? void 0 : _a2.url) === url) this._current = null;
      };
      entry.promise.then(done, done);
    }
  };

  // src/adapters/BaseAdapter.js
  var BaseAdapter = class {
    constructor() {
      this.name = "Base";
    }
    /** 当前页面是否属于该站点 */
    match(hostname, pathname) {
      return false;
    }
    /** 域名精确/子域名匹配：example.com 命中 example.com 与 www.example.com，但不命中 evil-example.com */
    matchDomain(hostname, domains) {
      return domains.some((d) => hostname === d || hostname.endsWith("." + d));
    }
    /** 从点击事件的目标元素中解析出可打开的链接信息 */
    parseClick(event) {
      return null;
    }
    /** 对当前页面 DOM 应用视觉增强（添加 popup-trigger 类等） */
    enhance(doc, hostname, pathname) {
      return false;
    }
    /** 供子类使用的通用 URL 解析辅助 */
    resolveHref(href, base) {
      if (!href || href.startsWith("javascript:")) return null;
      try {
        return new URL(href, base).href;
      } catch {
        return null;
      }
    }
  };

  // src/adapters/DiscuzAdapter.js
  var DiscuzAdapter = class extends BaseAdapter {
    constructor(hostnamePatterns = ["chiphell.com", "wnflb2023.com", "52pojie.cn"]) {
      super();
      this.name = "Discuz";
      this.forumStyles = true;
      this.patterns = hostnamePatterns;
    }
    match(hostname) {
      return this.matchDomain(hostname, this.patterns);
    }
    parseClick(event) {
      var _a, _b, _c, _d, _e, _f;
      const link = (_b = (_a = event.target).closest) == null ? void 0 : _b.call(_a, "a.xst");
      if (link) {
        const url = this.resolveHref(link.href, window.location.href);
        if (url) {
          return { url, title: (link.textContent || "").trim() || "查看帖子", element: link };
        }
      }
      const suhTd = (_d = (_c = event.target).closest) == null ? void 0 : _d.call(_c, "td.suh");
      if (suhTd) {
        const a = ((_f = (_e = event.target).closest) == null ? void 0 : _f.call(_e, "a")) || suhTd.querySelector("a");
        if (a) {
          const url = this.resolveHref(a.href, window.location.href);
          if (url) {
            return {
              url,
              title: a.title || (a.textContent || "").trim() || "查看内容",
              element: a
            };
          }
        }
      }
      return null;
    }
    enhance(doc) {
      doc.querySelectorAll("a.xst").forEach((link) => {
        if (link.href && !link.href.startsWith("javascript:")) {
          const th = link.closest("th.common, th.new, th.lock");
          if (th && !th.classList.contains("common")) th.classList.add("common");
        }
      });
    }
  };

  // src/adapters/TgbAdapter.js
  var TgbAdapter = class extends BaseAdapter {
    constructor() {
      super();
      this.name = "TGB";
    }
    match(hostname, pathname) {
      if (hostname === "shuo.tgb.cn") return pathname.startsWith("/livenews/");
      return hostname === "www.tgb.cn";
    }
    parseClick(event) {
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;
      if (hostname === "www.tgb.cn") {
        if (pathname.startsWith("/blog/") || pathname.startsWith("/user/blog/")) {
          return this._parseBlog(event);
        }
        if (pathname.startsWith("/spmatch/")) {
          return this._parseSpmatch(event);
        }
        return this._parseGeneric(event);
      }
      if (hostname === "shuo.tgb.cn" && pathname.startsWith("/livenews/")) {
        return this._parseLivenews(event);
      }
      return null;
    }
    _parseBlog(event) {
      var _a, _b;
      const titleDiv = (_b = (_a = event.target).closest) == null ? void 0 : _b.call(_a, "div.tittle_data");
      const link = titleDiv == null ? void 0 : titleDiv.querySelector("a");
      if (!titleDiv || !link) return null;
      const url = this.resolveHref(link.href, window.location.href);
      if (!url) return null;
      return { url, title: link.title || (link.textContent || "").trim() || "查看博客", element: link };
    }
    _parseSpmatch(event) {
      var _a, _b;
      const link = (_b = (_a = event.target).closest) == null ? void 0 : _b.call(_a, ".Nbbs-tiezi-lists a");
      if (!link) return null;
      const url = this.resolveHref(link.href, window.location.href);
      if (!url) return null;
      return { url, title: link.title || (link.textContent || "").trim() || "查看内容", element: link };
    }
    _parseGeneric(event) {
      var _a, _b, _c, _d, _e, _f, _g;
      const titleLink = (_b = (_a = event.target).closest) == null ? void 0 : _b.call(_a, ".Nbbs-tiezi-lists .middle-list-tittle a[href]");
      if (titleLink) {
        const url2 = this.resolveHref(titleLink.href, window.location.href);
        if (url2) {
          return { url: url2, title: titleLink.title || (titleLink.textContent || "").trim() || "查看帖子", element: titleLink };
        }
      }
      const block = (_d = (_c = event.target).closest) == null ? void 0 : _d.call(_c, ".Nbbs-tiezi-lists [data-topic-url]");
      if (block) {
        const url2 = this.resolveHref(block.dataset.topicUrl, window.location.href);
        if (url2) {
          const container2 = block.closest(".Nbbs-tiezi-lists");
          const titleA = container2 == null ? void 0 : container2.querySelector(".middle-list-tittle a");
          const title = (titleA == null ? void 0 : titleA.title) || ((titleA == null ? void 0 : titleA.textContent) || "").trim() || "查看帖子";
          return { url: url2, title, element: block };
        }
      }
      const target = event.target;
      const titleDiv = (_e = target.closest) == null ? void 0 : _e.call(target, "div.items-content-tittle.popup-trigger");
      const remarkDiv = (_f = target.closest) == null ? void 0 : _f.call(target, "div.items-content-remark.popup-trigger");
      const container = titleDiv || remarkDiv;
      if (!container || !container.closest("div.items-list-content")) return null;
      let linkElement = null;
      let url = null;
      if (((_g = container.parentElement) == null ? void 0 : _g.tagName) === "A") {
        linkElement = container.parentElement;
        url = this.resolveHref(linkElement.getAttribute("href"), window.location.href);
      } else {
        linkElement = container.querySelector("a");
        if (linkElement) {
          url = this.resolveHref(linkElement.dataset.href, window.location.href) || this.resolveHref(linkElement.getAttribute("href"), window.location.href);
        }
      }
      if (!linkElement || !url) return null;
      return {
        url,
        title: linkElement.title || (linkElement.textContent || "").trim() || (container.textContent || "").trim() || "淘股吧内容",
        element: linkElement
      };
    }
    _parseLivenews(event) {
      var _a, _b;
      const link = (_b = (_a = event.target).closest) == null ? void 0 : _b.call(_a, "div.items-content-tittle a");
      if (!link) return null;
      const url = this.resolveHref(link.href, window.location.href);
      if (!url) return null;
      return { url, title: (link.textContent || "").trim() || "查看资讯", element: link };
    }
    enhance(doc) {
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;
      if (hostname === "shuo.tgb.cn" && pathname.startsWith("/livenews/")) {
        doc.querySelectorAll("div.items-content-tittle").forEach((titleDiv) => {
          const link = titleDiv.querySelector("a");
          if (link && link.href && !link.href.startsWith("javascript:")) {
            titleDiv.classList.add("popup-trigger");
          }
        });
        return;
      }
      if (hostname !== "www.tgb.cn") return;
      if (pathname.startsWith("/blog/") || pathname.startsWith("/user/blog/")) {
        doc.querySelectorAll("div.article_tittle").forEach((articleTitleDiv) => {
          const titleDataDiv = articleTitleDiv.querySelector("div.tittle_data");
          const link = titleDataDiv == null ? void 0 : titleDataDiv.querySelector("a");
          if (titleDataDiv && link && link.href && !link.href.startsWith("javascript:")) {
            titleDataDiv.classList.add("popup-trigger");
          }
        });
        return;
      }
      if (pathname.startsWith("/spmatch/")) {
        doc.querySelectorAll(".Nbbs-tiezi-lists a").forEach((link) => {
          if (link.href && !link.href.startsWith("javascript:")) {
            link.classList.add("popup-trigger");
          }
        });
        return;
      }
      doc.querySelectorAll(".Nbbs-tiezi-lists .middle-list-tittle a[href]").forEach((a) => {
        if (a.href && !a.href.startsWith("javascript:")) a.classList.add("popup-trigger");
      });
      doc.querySelectorAll(".Nbbs-tiezi-lists [data-topic-url]").forEach((n) => n.classList.add("popup-trigger"));
      doc.querySelectorAll("div.items-content-tittle, div.items-content-remark").forEach((containerDiv) => {
        var _a;
        if (!containerDiv.closest("div.items-list-content")) return;
        let linkElement = null;
        let url = null;
        const innerLink = containerDiv.querySelector("a");
        if (innerLink) {
          linkElement = innerLink;
          url = this.resolveHref(innerLink.dataset.href, window.location.href) || this.resolveHref(innerLink.getAttribute("href"), window.location.href);
        } else if (((_a = containerDiv.parentElement) == null ? void 0 : _a.tagName) === "A") {
          linkElement = containerDiv.parentElement;
          url = this.resolveHref(linkElement.getAttribute("href"), window.location.href);
        }
        if (linkElement && url) containerDiv.classList.add("popup-trigger");
      });
    }
  };

  // src/adapters/LinuxAdapter.js
  var LinuxAdapter = class extends BaseAdapter {
    constructor() {
      super();
      this.name = "LinuxDo";
    }
    match(hostname) {
      return hostname === "linux.do";
    }
    parseClick(event) {
      var _a, _b;
      const link = (_b = (_a = event.target).closest) == null ? void 0 : _b.call(_a, "a.title.raw-link.raw-topic-link");
      if (!link) return null;
      const url = this.resolveHref(link.href, window.location.href);
      if (!url) return null;
      return { url, title: (link.textContent || "").trim() || "查看主题", element: link };
    }
    enhance() {
    }
  };

  // src/adapters/CiliAdapter.js
  var CiliAdapter = class extends BaseAdapter {
    constructor() {
      super();
      this.name = "Cili";
    }
    match(hostname) {
      return this.matchDomain(hostname, ["1cili.com", "9cili.mom"]);
    }
    parseClick(event) {
      var _a, _b, _c;
      const tableRow = (_b = (_a = event.target).closest) == null ? void 0 : _b.call(_a, "tr");
      if (!tableRow) return null;
      const firstTd = tableRow.querySelector("td:first-child");
      if (!firstTd || !firstTd.contains(event.target)) return null;
      const link = firstTd.querySelector("a");
      if (!link) return null;
      const url = this.resolveHref(link.href, window.location.href);
      if (!url) return null;
      const title = (((_c = link.querySelector("b")) == null ? void 0 : _c.textContent) || link.textContent || "").trim() || "查看内容";
      return { url, title, element: link };
    }
    enhance(doc) {
      doc.querySelectorAll("tr").forEach((row) => {
        const firstCell = row.querySelector("td:first-child");
        const link = firstCell == null ? void 0 : firstCell.querySelector("a");
        if (firstCell && link && link.href && !link.href.startsWith("javascript:")) {
          firstCell.classList.add("popup-trigger");
        }
      });
    }
  };

  // src/adapters/XAdapter.js
  var X_DOMAINS = ["x.com", "twitter.com"];
  var STATUS_PATTERN = /^\/(?:i\/web\/)?([^/?#]+)\/status\/(\d+)/i;
  var PROFILE_PATTERN = /^\/([A-Za-z0-9_]+)\/?$/;
  var XAdapter = class extends BaseAdapter {
    constructor() {
      super();
      this.name = "X";
    }
    match(hostname) {
      return this.matchDomain(hostname, X_DOMAINS);
    }
    /** 规范化帖子地址：统一为 https://x.com/{handle}/status/{id} */
    normalizePostUrl(href, base = window.location.href) {
      if (!href || typeof href !== "string") return null;
      let url;
      try {
        url = new URL(href, base);
      } catch {
        return null;
      }
      if (!this.match(url.hostname.replace(/^www\./i, ""))) return null;
      const m = url.pathname.match(STATUS_PATTERN);
      if (!m) return null;
      return `https://x.com/${m[1]}/status/${m[2]}`;
    }
    /** 顶层页面当前是否已经是帖子详情页 */
    isDetailPage() {
      return Boolean(this.normalizePostUrl(window.location.href));
    }
    /**
     * 从点击事件解析出应打开的帖子。
     * @returns {{url:string,title:string,element:Element}|null}
     */
    parseClick(event) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return null;
      const target = event.target;
      if (!target || typeof target.closest !== "function") return null;
      const article = target.closest('article[data-testid="tweet"]');
      if (!article) return null;
      if (!this.isTopLevelTweet(article)) return null;
      if (this.shouldSkipTarget(target)) return null;
      const quoteScope = this.findClickedQuoteScope(article, target);
      if (this.isDetailPage() && !quoteScope) return null;
      const quotedUrl = quoteScope ? this.findQuotedPostUrl(article, quoteScope) : null;
      const anchor = target.closest('a[href*="/status/"]');
      const outerUrl = this.findPostUrl(article);
      const url = quotedUrl || this.normalizePostUrl(anchor && anchor.getAttribute("href")) || outerUrl;
      if (!url) return null;
      const scope = quoteScope || article;
      return { url, title: this.titleOf(scope), element: article };
    }
    /** 视觉增强：X 的列表是虚拟化 React 树，这里不做任何 DOM 改写，避免与其渲染冲突 */
    enhance() {
      return false;
    }
    // ---------- 内部：X DOM 解析 ----------
    isTopLevelTweet(article) {
      var _a;
      try {
        return !((_a = article.parentElement) == null ? void 0 : _a.closest('article[data-testid="tweet"]'));
      } catch {
        return true;
      }
    }
    shouldSkipTarget(target) {
      if (target.closest('button, input, textarea, select, [contenteditable="true"], video')) return true;
      if (target.closest('[data-testid="tweetPhoto"]')) return true;
      const anchor = target.closest("a[href]");
      return Boolean(anchor && !this.normalizePostUrl(anchor.getAttribute("href")));
    }
    /** 引用帖卡片：X 用 role=link 的 div 包住，内部同时有身份与内容节点 */
    isQuotedPostLink(node) {
      var _a, _b, _c;
      const hasIdentity = (_a = node == null ? void 0 : node.querySelector) == null ? void 0 : _a.call(node, '[data-testid="Tweet-User-Avatar"], [data-testid="User-Name"]');
      const hasQuotedContent = (_b = node == null ? void 0 : node.querySelector) == null ? void 0 : _b.call(
        node,
        '[data-testid="tweetText"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="article-cover-image"]'
      );
      return Boolean(((_c = node == null ? void 0 : node.matches) == null ? void 0 : _c.call(node, '[role="link"][tabindex="0"]')) && hasIdentity && hasQuotedContent);
    }
    findClickedQuoteScope(article, target) {
      let current = target;
      while (current && current !== article) {
        if (this.isQuotedPostLink(current)) return current;
        current = current.parentElement;
      }
      return null;
    }
    authorProfileHref(scope) {
      const userName = scope.querySelector('[data-testid="User-Name"]');
      return [...(userName == null ? void 0 : userName.querySelectorAll("a[href]")) || []].map((a) => a.getAttribute("href")).find((href) => PROFILE_PATTERN.test(href || "")) || null;
    }
    statusLinks(scope) {
      var _a;
      return [...((_a = scope == null ? void 0 : scope.querySelectorAll) == null ? void 0 : _a.call(scope, 'a[href*="/status/"]')) || []].map((a) => this.normalizePostUrl(a.getAttribute("href"))).filter(Boolean);
    }
    /** 一个作用域内可能同时含外层帖与引用帖的链接，按作者 handle 选出属于本作用域的那条 */
    selectOwnPostUrl(hrefs, profileHref2) {
      var _a, _b;
      const unique = [...new Set(hrefs.filter(Boolean))];
      const handle = ((_b = (_a = String(profileHref2 || "").match(PROFILE_PATTERN)) == null ? void 0 : _a[1]) == null ? void 0 : _b.toLowerCase()) || null;
      if (!handle) return unique[0] || null;
      return unique.find((u) => {
        var _a2;
        try {
          return ((_a2 = new URL(u).pathname.split("/")[1]) == null ? void 0 : _a2.toLowerCase()) === handle;
        } catch {
          return false;
        }
      }) || unique[0] || null;
    }
    findPostUrl(article) {
      return this.selectOwnPostUrl(this.statusLinks(article), this.authorProfileHref(article));
    }
    findQuotedPostUrl(article, quoteScope) {
      const ownUrl = this.findPostUrl(article);
      const direct = quoteScope.matches('a[href*="/status/"]') ? this.normalizePostUrl(quoteScope.getAttribute("href")) : null;
      return [direct, ...this.statusLinks(quoteScope)].find((u) => u && u !== ownUrl) || null;
    }
    titleOf(scope) {
      var _a, _b, _c, _d, _e, _f;
      try {
        const name = (_d = (_c = (_b = (_a = scope.querySelector('[data-testid="User-Name"]')) == null ? void 0 : _a.innerText) == null ? void 0 : _b.split("\n")) == null ? void 0 : _c[0]) == null ? void 0 : _d.trim();
        const text = (_f = (_e = scope.querySelector('[data-testid="tweetText"]')) == null ? void 0 : _e.innerText) == null ? void 0 : _f.trim();
        if (name && text) return `${name}: ${text.slice(0, 60)}`;
        return name || (text ? text.slice(0, 60) : "") || "X 帖子";
      } catch (err) {
        logger.debug("[XAdapter] title parse failed", err);
        return "X 帖子";
      }
    }
  };

  // src/x/xBridge.js
  var GRAPHQL_PATH = /\/graphql\/([^/]+)\/([^/?#]+)/;
  var TRANSLATION_PATH = /\/translation\/service\/translateTweet(?:\.json)?(?:[?#]|$)/;
  var AUTH_HEADER_NAMES = /* @__PURE__ */ new Set([
    "authorization",
    "x-twitter-auth-type",
    "x-twitter-active-user",
    "x-twitter-client-language",
    "x-client-uuid"
  ]);
  var captured = {
    auth: /* @__PURE__ */ Object.create(null),
    templates: /* @__PURE__ */ new Map(),
    translationTemplate: null,
    bearerSource: null
  };
  var webpackRuntime = null;
  var transactionIdFn;
  var transactionIdProbedAt = 0;
  var operationCache = /* @__PURE__ */ new Map();
  function pageWindow() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) return unsafeWindow;
    } catch (err) {
      logger.debug("[xBridge] unsafeWindow unavailable", err);
    }
    return window;
  }
  function normalizeHeaders(headers) {
    const out = {};
    if (!headers) return out;
    try {
      if (typeof headers.forEach === "function" && typeof headers.get === "function") {
        headers.forEach((value, key) => {
          out[String(key).toLowerCase()] = value;
        });
        return out;
      }
    } catch (err) {
      logger.debug("[xBridge] Headers normalize failed", err);
    }
    if (Array.isArray(headers)) {
      for (const pair of headers) {
        if (Array.isArray(pair) && pair.length >= 2) out[String(pair[0]).toLowerCase()] = pair[1];
      }
      return out;
    }
    if (typeof headers === "object") {
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
        method: String(method || "GET").toUpperCase(),
        headers: normalized,
        body: typeof body === "string" ? body : null
      });
    }
    if (TRANSLATION_PATH.test(absolute)) {
      captured.translationTemplate = { url: absolute, headers: normalized };
    }
  }
  function patchFetch(win) {
    const original = win.fetch;
    if (typeof original !== "function" || original.__pv2Patched) return;
    const patched = function(input, init2) {
      try {
        const url = typeof input === "string" ? input : input && input.url;
        const method = init2 && init2.method || input && input.method || "GET";
        const headers = init2 && init2.headers || input && input.headers;
        rememberRequest(win, url, method, headers, init2 && init2.body);
      } catch (err) {
        logger.debug("[xBridge] fetch capture failed", err);
      }
      return Reflect.apply(original, this, [input, init2]);
    };
    patched.__pv2Patched = true;
    try {
      win.fetch = patched;
    } catch (err) {
      logger.warn("[xBridge] fetch patch rejected", err);
    }
  }
  function patchXhr(win) {
    const XHR = win.XMLHttpRequest;
    if (!XHR || !XHR.prototype || XHR.prototype.__pv2Patched) return;
    const proto = XHR.prototype;
    const originalOpen = proto.open;
    const originalSetHeader = proto.setRequestHeader;
    const originalSend = proto.send;
    proto.open = function(method, url, ...rest) {
      try {
        this.__pv2Request = { method, url, headers: {} };
      } catch (err) {
        logger.debug("[xBridge] xhr open capture failed", err);
      }
      return Reflect.apply(originalOpen, this, [method, url, ...rest]);
    };
    proto.setRequestHeader = function(name, value) {
      try {
        if (this.__pv2Request) this.__pv2Request.headers[String(name).toLowerCase()] = value;
      } catch (err) {
        logger.debug("[xBridge] xhr header capture failed", err);
      }
      return Reflect.apply(originalSetHeader, this, [name, value]);
    };
    proto.send = function(body) {
      try {
        const req = this.__pv2Request;
        if (req) rememberRequest(win, req.url, req.method, req.headers, body);
      } catch (err) {
        logger.debug("[xBridge] xhr send capture failed", err);
      }
      return Reflect.apply(originalSend, this, [body === void 0 ? null : body]);
    };
    proto.__pv2Patched = true;
  }
  function getWebpackRuntime(win) {
    if (webpackRuntime) return webpackRuntime;
    let chunkName = null;
    try {
      chunkName = Object.keys(win).find((name) => name.startsWith("webpackChunk") && Array.isArray(win[name]));
    } catch (err) {
      logger.debug("[xBridge] webpack scan failed", err);
    }
    const chunk = chunkName ? win[chunkName] : null;
    if (!chunk) return null;
    let runtime = null;
    try {
      chunk.push([[`pv2-${Date.now()}`], {}, (candidate) => {
        runtime = candidate;
      }]);
    } catch (err) {
      logger.debug("[xBridge] webpack probe failed", err);
      return null;
    }
    if (runtime && runtime.c && runtime.m) webpackRuntime = runtime;
    return webpackRuntime;
  }
  function deepFind(value, predicate, maxDepth = 5, seen = /* @__PURE__ */ new Set()) {
    if (!value || typeof value !== "object" || maxDepth < 0 || seen.has(value)) return null;
    seen.add(value);
    try {
      if (predicate(value)) return value;
    } catch (err) {
      logger.debug("[xBridge] predicate failed", err);
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
  function scanRuntime(runtime, sourceNeedle, predicate) {
    if (!runtime) return null;
    for (const module of Object.values(runtime.c || {})) {
      const found = deepFind(module && module.exports, predicate);
      if (found) return found;
    }
    for (const [moduleId, factory] of Object.entries(runtime.m || {})) {
      let source = "";
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
      }
    }
    return null;
  }
  var OPERATION_MISS_TTL_MS = 5e3;
  function findOperation(win, operationName) {
    const cached = operationCache.get(operationName);
    if (cached && (cached.found || Date.now() - cached.at < OPERATION_MISS_TTL_MS)) return cached.found;
    const predicate = (value) => value && value.operationName === operationName && typeof value.queryId === "string";
    const found = scanRuntime(getWebpackRuntime(win), operationName, predicate) || null;
    operationCache.set(operationName, { found, at: Date.now() });
    return found;
  }
  function findTransactionIdFunction(win) {
    var _a;
    const predicate = (value) => {
      const candidate = value && value.kc;
      return typeof candidate === "function" && candidate.length === 3;
    };
    return ((_a = scanRuntime(getWebpackRuntime(win), "x-client-transaction-id", predicate)) == null ? void 0 : _a.kc) || null;
  }
  function toggleMap(items) {
    const result = {};
    for (const item of items || []) {
      if (typeof item === "string") result[item] = true;
      else if (item && typeof item.name === "string") result[item.name] = item.value === void 0 ? true : item.value;
    }
    return result;
  }
  function csrfToken(win) {
    try {
      return decodeURIComponent((String(win.document.cookie).match(/(?:^|;\s*)ct0=([^;]+)/) || [])[1] || "");
    } catch (err) {
      return "";
    }
  }
  function discoverBearer(win) {
    const runtime = getWebpackRuntime(win);
    if (!runtime) return null;
    for (const factory of Object.values(runtime.m || {})) {
      let source = "";
      try {
        source = Function.prototype.toString.call(factory);
      } catch (err) {
        continue;
      }
      if (!source.includes("Bearer ")) continue;
      const match = source.match(/Bearer\s+([A-Za-z0-9%_-]{30,})/);
      if (match) return `Bearer ${match[1]}`;
    }
    return null;
  }
  async function requestHeaders(win, path, method, requiresCsrf) {
    const headers = { "content-type": "application/json" };
    headers["x-twitter-active-user"] = captured.auth["x-twitter-active-user"] || "yes";
    headers["x-twitter-auth-type"] = captured.auth["x-twitter-auth-type"] || "OAuth2Session";
    let authorization = captured.auth.authorization;
    if (!authorization) {
      authorization = discoverBearer(win);
      if (authorization) captured.bearerSource = "webpack";
    } else {
      captured.bearerSource = captured.bearerSource || "request";
    }
    if (!authorization) throw new Error("还没有捕获到 X 登录请求，请刷新 X 页面后重试");
    headers.authorization = authorization;
    for (const name of ["x-twitter-client-language", "x-client-uuid"]) {
      if (captured.auth[name]) headers[name] = captured.auth[name];
    }
    const csrf = csrfToken(win);
    if (csrf) headers["x-csrf-token"] = csrf;
    if (requiresCsrf && !csrf) throw new Error("当前 X 登录会话缺少 CSRF 信息，请刷新后重试");
    try {
      const transactionId = await resolveTransactionId(win, path, method);
      if (transactionId && !String(transactionId).startsWith("e:")) headers["x-client-transaction-id"] = transactionId;
    } catch (err) {
      logger.debug("[xBridge] transaction id unavailable", err);
    }
    return headers;
  }
  async function resolveTransactionId(win, path, method) {
    if (!transactionIdFn && Date.now() - transactionIdProbedAt > OPERATION_MISS_TTL_MS) {
      transactionIdProbedAt = Date.now();
      transactionIdFn = findTransactionIdFunction(win) || null;
    }
    if (typeof transactionIdFn !== "function") return null;
    return transactionIdFn(win.location.host, path, method);
  }
  async function readJson(response) {
    const json = await response.json().catch(() => null);
    const errors = json && json.errors || [];
    if (!response.ok || !json || !json.data) {
      const message = errors[0] && errors[0].message || `X 请求失败（${response.status}）`;
      throw new Error(message);
    }
    if (errors.length) {
      logger.debug(`[xBridge] ${response.status} 部分数据缺失: ${errors.map((item) => item && item.message).join("; ")}`);
    }
    return json;
  }
  async function graphql(win, operationName, variables, method = "POST", signal) {
    const operation = findOperation(win, operationName);
    if (!operation) throw new Error(`当前 X 页面尚未加载 ${operationName} 操作，请刷新页面后重试`);
    const path = `/i/api/graphql/${operation.queryId}/${operationName}`;
    const metadata = operation.metadata || {};
    const features = toggleMap(metadata.featureSwitches);
    const fieldToggles = toggleMap(metadata.fieldToggles);
    const headers = await requestHeaders(win, path, method, method === "POST");
    if (method === "GET") {
      const url = new URL(path, win.location.origin);
      url.searchParams.set("variables", JSON.stringify(variables));
      url.searchParams.set("features", JSON.stringify(features));
      url.searchParams.set("fieldToggles", JSON.stringify(fieldToggles));
      return readJson(await win.fetch(url.toString(), { method, headers, credentials: "include", cache: "no-store", signal }));
    }
    return readJson(
      await win.fetch(path, {
        method,
        headers,
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ variables, features, queryId: operation.queryId })
      })
    );
  }
  function readArticle(win, tweetId) {
    return graphql(
      win,
      "TweetResultByRestId",
      { tweetId: String(tweetId), withCommunity: false, includePromotedContent: false, withVoice: false },
      "GET"
    );
  }
  async function replayTweetDetail(win, tweetId, cursor) {
    const template = captured.templates.get("TweetDetail");
    if (!template) return null;
    const url = new URL(template.url, win.location.origin);
    let variables = {};
    try {
      variables = JSON.parse(url.searchParams.get("variables") || "{}");
    } catch (err) {
      logger.debug("[xBridge] template variables unparsable", err);
    }
    variables.focalTweetId = String(tweetId);
    if (cursor) variables.cursor = cursor;
    else delete variables.cursor;
    url.searchParams.set("variables", JSON.stringify(variables));
    const headers = { ...template.headers, ...await requestHeaders(win, url.pathname, template.method, false) };
    return readJson(await win.fetch(url.toString(), { method: template.method, headers, credentials: "include", cache: "no-store" }));
  }
  async function readThread(win, tweetId, cursor) {
    const variables = {
      focalTweetId: String(tweetId),
      referrer: "home",
      with_rux_injections: false,
      rankingMode: "Relevance",
      includePromotedContent: true,
      withCommunity: true,
      withQuickPromoteEligibilityTweetFields: true,
      withBirdwatchNotes: true,
      withVoice: true
    };
    if (cursor) variables.cursor = cursor;
    try {
      return await graphql(win, "TweetDetail", variables, "GET");
    } catch (primaryError) {
      const replayed = await replayTweetDetail(win, tweetId, cursor).catch((err) => {
        logger.debug("[xBridge] template replay failed", err);
        return null;
      });
      if (replayed) return replayed;
      throw primaryError;
    }
  }
  var ACTIONS = Object.freeze({
    like: { active: "UnfavoriteTweet", inactive: "FavoriteTweet" },
    repost: { active: "DeleteRetweet", inactive: "CreateRetweet" },
    bookmark: { active: "DeleteBookmark", inactive: "CreateBookmark" }
  });
  async function toggleAction(win, action, tweetId, active) {
    const mapping = ACTIONS[action];
    if (!mapping) throw new Error("不支持的互动操作");
    const operationName = active ? mapping.active : mapping.inactive;
    const variables = action === "repost" && active ? { source_tweet_id: String(tweetId), dark_request: false } : action === "repost" ? { tweet_id: String(tweetId), dark_request: false } : { tweet_id: String(tweetId) };
    return graphql(win, operationName, variables, "POST");
  }
  async function createReply(win, tweetId, text) {
    const replyText = String(text || "").trim();
    if (!replyText) throw new Error("回复内容不能为空");
    return graphql(
      win,
      "CreateTweet",
      {
        tweet_text: replyText,
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: [],
        disallowed_reply_options: null,
        reply: { in_reply_to_tweet_id: String(tweetId), exclude_reply_user_ids: [] }
      },
      "POST"
    );
  }
  async function translateTweet(win, tweetId, targetLanguage) {
    const language = String(targetLanguage || "zh-cn").toLowerCase();
    const fallbackPath = `/i/api/1.1/strato/column/None/tweetId=${tweetId},destinationLanguage=None,translationSource=Some(Google),feature=None,timeout=None,onlyCached=None/translation/service/translateTweet`;
    const template = captured.translationTemplate;
    const url = new URL(template && template.url || fallbackPath, win.location.origin);
    if (/tweetId=\d+/.test(url.pathname)) url.pathname = url.pathname.replace(/tweetId=\d+/, `tweetId=${tweetId}`);
    else url.pathname = fallbackPath;
    const headers = {
      ...template && template.headers || {},
      ...await requestHeaders(win, url.pathname, "GET", false),
      accept: "*/*",
      "x-twitter-client-language": language
    };
    const response = await win.fetch(url.toString(), { method: "GET", headers, credentials: "include", cache: "no-store" });
    const json = await response.json().catch(() => null);
    const errors = json && json.errors;
    if (!response.ok || errors && errors.length || json && json.translationState === "Failed") {
      throw new Error(errors && errors[0] && errors[0].message || `X 翻译请求失败（${response.status}）`);
    }
    const text = String(json && json.translation || "").trim();
    if (!text) throw new Error("X 暂时没有返回这条帖子的翻译");
    return {
      text,
      sourceLanguage: String(json && (json.sourceLanguage || json.source_language) || ""),
      localizedSourceLanguage: String(json && (json.localizedSourceLanguage || json.localized_source_language) || ""),
      destinationLanguage: String(json && (json.destinationLanguage || json.destination_language) || language)
    };
  }
  function followStateFromUser(user, userId) {
    if (!user) return null;
    const id = user.rest_id || user.id_str || (typeof user.id === "string" ? user.id : null);
    if (String(id) !== String(userId)) return null;
    const relationship = user.relationship_perspectives || user.legacy || user;
    const following = relationship.following;
    const pending = relationship.follow_request_sent;
    if (typeof following !== "boolean" && pending !== true) return null;
    const followers = user.relationship_counts ? user.relationship_counts.followers_count : (user.legacy && user.legacy.followers_count) !== void 0 ? user.legacy.followers_count : user.followers_count;
    return {
      confirmed: true,
      following: following === true,
      followRequestSent: pending === true,
      followers: Number.isFinite(Number(followers)) ? Number(followers) : null
    };
  }
  async function toggleFollow(win, userId, active) {
    const id = String(userId || "");
    if (!/^\d+$/.test(id)) throw new Error("用户 ID 无效");
    const path = `/i/api/1.1/friendships/${active ? "create" : "destroy"}.json`;
    const headers = await requestHeaders(win, path, "POST", true);
    headers["content-type"] = "application/x-www-form-urlencoded;charset=UTF-8";
    const response = await win.fetch(path, {
      method: "POST",
      headers,
      credentials: "include",
      cache: "no-store",
      body: new URLSearchParams({ user_id: id }).toString()
    });
    const json = await response.json().catch(() => null);
    const errors = json && json.errors;
    if (!response.ok || errors && errors.length) {
      throw new Error(errors && errors[0] && errors[0].message || `X 关注请求失败（${response.status}）`);
    }
    const direct = followStateFromUser(json, id);
    if (direct && (active ? direct.following || direct.followRequestSent : !direct.following && !direct.followRequestSent)) {
      return direct;
    }
    try {
      const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(4e3) : void 0;
      const profile = await graphql(win, "UserByRestId", { userId: id }, "GET", signal);
      const verified = followStateFromUser(profile && profile.data && profile.data.user && profile.data.user.result, id);
      if (verified) return verified;
    } catch (err) {
      logger.debug("[xBridge] follow read-back failed", err);
    }
    return { confirmed: false };
  }
  var installedApi = null;
  function installXBridge(win = pageWindow()) {
    if (!win) return null;
    if (installedApi) return installedApi;
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
    installedApi = api;
    return api;
  }
  function captureState() {
    return {
      hasAuthorization: Boolean(captured.auth.authorization),
      bearerSource: captured.bearerSource,
      authHeaders: Object.keys(captured.auth),
      templates: [...captured.templates.keys()],
      hasTranslationTemplate: Boolean(captured.translationTemplate),
      hasWebpackRuntime: Boolean(webpackRuntime)
    };
  }

  // src/x/xModel.js
  var MAX_UNWRAP_HOPS = 6;
  var STATUS_PATTERN2 = /^\/(?:i\/web\/)?([^/?#]+)\/status\/(\d+)/i;
  function replyCursorAfterPage(previousCursor, nextCursor, addedCount) {
    const next = String(nextCursor || "");
    return Number(addedCount) > 0 && next && next !== String(previousCursor || "") ? next : null;
  }
  function shouldOfferTranslation(text) {
    const plain = String(text || "").replace(/https?:\/\/\S+/g, " ").replace(/@[A-Za-z0-9_]+/g, " ").trim();
    if (!plain) return false;
    const han = (plain.match(/[\u3400-\u9fff]/g) || []).length;
    const latin = (plain.match(/[A-Za-z\u00c0-\u024f]/g) || []).length;
    const japaneseKorean = (plain.match(/[\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    const cyrillic = (plain.match(/[\u0400-\u04ff]/g) || []).length;
    if (japaneseKorean >= 2 || cyrillic >= 4) return true;
    return latin >= 6 && han < Math.max(4, latin * 0.35);
  }
  function sourceLanguageLabel(entry) {
    if (entry && entry.localizedSourceLanguage) return entry.localizedSourceLanguage;
    const language = String(entry && entry.sourceLanguage || "").toLowerCase();
    const names = { en: "英语", ja: "日语", ko: "韩语", es: "西班牙语", fr: "法语", de: "德语", ru: "俄语" };
    return names[language] || "外语";
  }
  function postIdFromUrl(href, base = "https://x.com/") {
    if (!href || typeof href !== "string") return null;
    try {
      const url = new URL(href, base);
      const match = url.pathname.match(STATUS_PATTERN2);
      return match ? match[2] : null;
    } catch (err) {
      return null;
    }
  }
  function unwrapResult(value) {
    let current = value && typeof value === "object" ? value : null;
    for (let index = 0; current && index < MAX_UNWRAP_HOPS; index += 1) {
      if (current.legacy && current.rest_id) return current;
      if (current.tweet && typeof current.tweet === "object") {
        current = current.tweet;
        continue;
      }
      if (current.result && typeof current.result === "object") {
        current = current.result;
        continue;
      }
      break;
    }
    return current && current.legacy && current.rest_id ? current : null;
  }
  function collectTweetNodes(value, out = [], seen = /* @__PURE__ */ new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return out;
    seen.add(value);
    const result = value.tweet_results && value.tweet_results.result || value.tweetResult && value.tweetResult.result || null;
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
  function unwrapUser(value) {
    let current = value && typeof value === "object" ? value : null;
    for (let index = 0; current && index < 4; index += 1) {
      const legacy = current.legacy;
      const core = current.core;
      if (legacy && legacy.screen_name || core && core.screen_name || current.avatar && current.avatar.image_url || current.__typename === "User") {
        return current;
      }
      if (current.result && typeof current.result === "object") {
        current = current.result;
        continue;
      }
      break;
    }
    return current && (current.legacy || current.core) ? current : null;
  }
  var VARIANT_KEYS = ["video_info", "videoInfo", "media_info", "video_config"];
  function variantsOf(item) {
    const groups = [];
    for (const key of VARIANT_KEYS) {
      const holder = item[key];
      if (!holder) continue;
      if (Array.isArray(holder.variants)) groups.push(holder.variants);
      if (holder.video_info && Array.isArray(holder.video_info.variants)) groups.push(holder.video_info.variants);
    }
    const seen = /* @__PURE__ */ new Set();
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
  var variantType = (variant) => String(variant.content_type || variant.contentType || "");
  var isMp4 = (variant) => /video\/mp4/i.test(variantType(variant)) || /\.mp4(?:\?|$)/i.test(String(variant.url || ""));
  var isHls = (variant) => /mpegurl/i.test(variantType(variant)) || /\.m3u8(?:\?|$)/i.test(String(variant.url || ""));
  function selectMp4(variants, targetBitrate = 12e5) {
    const measured = variants.filter((variant) => Number(variant.bitrate) > 0).sort((a, b) => a.bitrate - b.bitrate);
    const within = measured.filter((variant) => variant.bitrate <= targetBitrate);
    return (within.length ? within[within.length - 1] : measured[0]) || variants[0] || null;
  }
  function mediaItems(tweet, legacy) {
    const modern = Array.isArray(tweet.media) ? tweet.media : tweet.media && (tweet.media.all || tweet.media.media) || [];
    const list = mediaListOf(legacy, modern);
    const items = [];
    for (const raw of list) {
      const variants = variantsOf(raw);
      const mp4s = variants.filter(isMp4);
      const hls = variants.find(isHls) || null;
      const rawType = String(raw.type || raw.media_type || raw.__typename || "").toLowerCase();
      const hasVideo = mp4s.length > 0 || Boolean(raw.video_info || raw.videoInfo || raw.video_config);
      const type = rawType.includes("animated") || rawType === "gif" ? "animated_gif" : rawType.includes("video") || hasVideo ? "video" : "photo";
      const chosen = type === "photo" ? null : selectMp4(mp4s);
      const poster = String(raw.media_url_https || raw.media_url || "");
      const item = {
        type,
        // 直连地址：网格与灯箱都用 media_url_https 原样加载，不改写任何参数
        url: poster,
        videoUrl: chosen ? String(chosen.url) : "",
        hlsUrl: hls ? String(hls.url) : "",
        width: Number(raw.original_info && raw.original_info.width || raw.sizes && raw.sizes.large && raw.sizes.large.w) || 0,
        height: Number(raw.original_info && raw.original_info.height || raw.sizes && raw.sizes.large && raw.sizes.large.h) || 0,
        altText: String(raw.ext_alt_text || "")
      };
      if (item.url || item.videoUrl || item.hlsUrl) items.push(item);
    }
    return items;
  }
  function findNamedValue(root, names, maxDepth = 5, seen = /* @__PURE__ */ new Set()) {
    if (!root || typeof root !== "object" || maxDepth < 0 || seen.has(root)) return null;
    seen.add(root);
    for (const name of names) {
      const value = root[name];
      if (value !== void 0 && value !== null) return value;
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
  function articleResult(tweet) {
    let current = tweet.article && tweet.article.article_results && tweet.article.article_results.result || tweet.article && tweet.article.result || tweet.article_results && tweet.article_results.result || tweet.article || null;
    for (let index = 0; current && index < 5; index += 1) {
      if (current.title || current.preview_text || current.cover_media || current.cover_image || current.content_state || current.contentState || current.plain_text || current.plainText) {
        return current;
      }
      if (current.result) current = current.result;
      else if (current.article) current = current.article;
      else break;
    }
    return null;
  }
  function articleContent(article) {
    const state = article && (article.content_state || article.contentState) || findNamedValue(article, ["content_state", "contentState"], 5) || null;
    const rawBlocks = state && state.blocks || [];
    const entityMap = state && (state.entityMap || state.entity_map || state.entities) || {};
    const blocks = [];
    for (const block of rawBlocks) {
      if (!block) continue;
      blocks.push({
        key: String(block.key || ""),
        type: String(block.type || "unstyled"),
        text: String(block.text || ""),
        depth: Number(block.depth) || 0,
        inlineStyles: Array.isArray(block.inlineStyleRanges) ? block.inlineStyleRanges.map((range) => ({
          offset: Number(range.offset) || 0,
          length: Number(range.length) || 0,
          style: String(range.style || "")
        })) : [],
        entityRanges: Array.isArray(block.entityRanges) ? block.entityRanges.map((range) => ({
          offset: Number(range.offset) || 0,
          length: Number(range.length) || 0,
          key: String(range.key)
        })) : []
      });
    }
    if (!blocks.length) {
      const plain = String(article && (article.plain_text || article.plainText) || "");
      plain.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).forEach((text, index) => {
        blocks.push({ key: `plain-${index}`, type: "unstyled", text, depth: 0, inlineStyles: [], entityRanges: [] });
      });
    }
    const entities = {};
    for (const [key, value] of Object.entries(entityMap)) {
      const data = value && value.data || {};
      entities[key] = {
        type: String(value && value.type || ""),
        url: String(data.url || data.href || data.src || ""),
        image: String(data.src || data.image || data.url || ""),
        width: Number(data.width) || 0,
        height: Number(data.height) || 0,
        alt: String(data.alt || data.caption || "")
      };
    }
    return { blocks, entities };
  }
  function articleUrlFromEntities(legacy) {
    const urls = legacy.entities && legacy.entities.urls || [];
    for (const entry of urls) {
      const expanded = String(entry && (entry.expanded_url || entry.url) || "");
      if (/(?:x|twitter)\.com\/i\/article\//i.test(expanded)) return expanded;
    }
    return "";
  }
  function articleAttachment(tweet, legacy) {
    const article = articleResult(tweet);
    if (!article) return null;
    const cover = findNamedValue(article, ["cover_media", "cover_image", "preview_image"], 3);
    const articleUrl = articleUrlFromEntities(legacy);
    return {
      type: "article",
      url: articleUrl,
      title: String(article.title || ""),
      description: String(article.preview_text || article.description || article.summary || ""),
      image: cover ? String(findNamedValue(cover, ["original_img_url", "media_url_https", "image_url"], 5) || "") : "",
      imageWidth: cover ? Number(findNamedValue(cover, ["original_img_width", "width"], 5)) || 0 : 0,
      imageHeight: cover ? Number(findNamedValue(cover, ["original_img_height", "height"], 5)) || 0 : 0,
      content: articleContent(article)
    };
  }
  function articleContentFromPayload(json) {
    const nodes = collectTweetNodes(json && json.data || json);
    for (const node of nodes) {
      const tweet = unwrapResult(node);
      const article = tweet ? articleResult(tweet) : null;
      if (!article) continue;
      const content = articleContent(article);
      if (content.blocks.length) return content;
    }
    const state = findNamedValue(json && json.data || json, ["content_state", "contentState"], 12);
    if (state && Array.isArray(state.blocks) && state.blocks.length) return articleContent({ content_state: state });
    return null;
  }
  function fullTextFromPayload(json, tweetId) {
    const nodes = collectTweetNodes(json && json.data || json);
    const target = String(tweetId || "");
    for (const node of nodes) {
      const model = liteModel(node);
      if (model && model.id === target && model.hasFullText) {
        return { text: model.text, entities: model.entities };
      }
    }
    return null;
  }
  function numberValue(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function codePointMap(text) {
    const map = [];
    let codePoint = 0;
    for (let index = 0; index < text.length; ) {
      map[codePoint] = index;
      const code = text.codePointAt(index);
      index += code > 65535 ? 2 : 1;
      codePoint += 1;
    }
    map[codePoint] = text.length;
    return map;
  }
  function mediaListOf(legacy, modern) {
    const candidates = [
      legacy && legacy.extended_entities && legacy.extended_entities.media,
      legacy && legacy.entities && legacy.entities.media,
      modern
    ];
    return candidates.find((value) => Array.isArray(value) && value.length > 0) || [];
  }
  function firstMediaIndices(legacy) {
    const media = mediaListOf(legacy, null);
    const first = media[0];
    return first && Array.isArray(first.indices) ? first.indices : null;
  }
  function entityRanges(entitySet, text, window_ = { start: 0, end: text.length }) {
    const ranges = [];
    if (!entitySet) return ranges;
    const map = codePointMap(text);
    const at = (index) => map[index] === void 0 ? text.length : map[index];
    const add = (entry, kind, url, label) => {
      const indices = entry && entry.indices;
      if (!Array.isArray(indices) || indices.length < 2) return null;
      const start = at(Number(indices[0]) || 0);
      const end = at(Number(indices[1]) || 0);
      if (end <= start) return null;
      if (start < window_.start || end > window_.end) return null;
      const range = { start: start - window_.start, end: end - window_.start, kind, url: url || "", label: label || "", author: null };
      ranges.push(range);
      return range;
    };
    for (const entry of entitySet.urls || []) {
      const expanded = String(entry && (entry.expanded_url || entry.url) || "");
      add(entry, "url", expanded, String(entry && entry.display_url || expanded));
    }
    for (const entry of entitySet.user_mentions || []) {
      const handle = String(entry && entry.screen_name || "");
      if (!handle) continue;
      const range = add(entry, "mention", `https://x.com/${handle}`, `@${handle}`);
      if (range) {
        range.author = {
          id: String(entry && (entry.id_str || entry.id) || ""),
          name: String(entry && entry.name || handle),
          handle,
          avatar: "",
          verified: false
        };
      }
    }
    for (const entry of entitySet.hashtags || []) {
      const tag = String(entry && entry.text || "");
      if (!tag) continue;
      add(entry, "hashtag", `https://x.com/hashtag/${encodeURIComponent(tag)}`, `#${tag}`);
    }
    for (const entry of entitySet.symbols || []) {
      const symbol = String(entry && entry.text || "");
      if (!symbol) continue;
      add(entry, "symbol", `https://x.com/search?q=${encodeURIComponent(`$${symbol}`)}`, `$${symbol}`);
    }
    return ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  }
  function visibleWindow(legacy, fullText) {
    const map = codePointMap(fullText);
    const range = Array.isArray(legacy.display_text_range) ? legacy.display_text_range : null;
    if (range && range.length === 2) {
      const start = map[Number(range[0])] || 0;
      const rawEnd = map[Number(range[1])];
      return { start, end: rawEnd === void 0 ? fullText.length : rawEnd };
    }
    const mediaIndices = firstMediaIndices(legacy);
    if (mediaIndices) {
      const cut = map[Number(mediaIndices[0])];
      if (cut !== void 0) return { start: 0, end: cut };
    }
    return { start: 0, end: fullText.length };
  }
  function quotedModel(tweet) {
    const holder = tweet.quoted_status_result || tweet.quoted_tweet_results || tweet.quoted_tweet;
    if (!holder || typeof holder !== "object") return null;
    const node = holder.result || holder.tweet || holder;
    const quoted = unwrapResult(node);
    return quoted ? liteModel(quoted, false) : null;
  }
  function liteModel(node, withQuote = true) {
    const tweet = unwrapResult(node);
    if (!tweet) return null;
    const legacy = tweet.legacy || {};
    const user = unwrapUser(tweet.core && tweet.core.user_results) || unwrapUser(tweet.user_results);
    const userLegacy = user && user.legacy || {};
    const userCore = user && user.core || {};
    const perspectives = user && user.relationship_perspectives || {};
    const counts = user && user.relationship_counts || {};
    const bio = user && user.profile_bio || {};
    const noteText = tweet.note_tweet && tweet.note_tweet.note_tweet_results && tweet.note_tweet.note_tweet_results.result;
    const media = mediaItems(tweet, legacy);
    const noteFullText = noteText && typeof noteText.text === "string" ? noteText.text : "";
    const usingNoteText = Boolean(noteFullText);
    const entitySet = usingNoteText && noteText.entity_set || legacy.entities || null;
    const fullText = noteFullText || String(legacy.full_text || legacy.text || "");
    const window_ = usingNoteText ? { start: 0, end: fullText.length } : visibleWindow(legacy, fullText);
    const text = fullText.slice(window_.start, window_.end).replace(/[ \t]+$/, "");
    const truncated = Boolean(legacy.truncated) || !usingNoteText && /…$/.test(fullText.trim());
    return {
      id: String(tweet.rest_id || legacy.id_str || ""),
      inReplyToId: String(legacy.in_reply_to_status_id_str || ""),
      conversationId: String(legacy.conversation_id_str || ""),
      text,
      // @提及 / #话题 / $代码 / 链接的可渲染区间（含码点→UTF-16 偏移换算与显示窗口裁剪）
      entities: entityRanges(entitySet, fullText, window_),
      // 是否已拿到全文；needsExpand 表示需要「显示更多」补全（供渲染层出按钮）
      hasFullText: usingNoteText,
      needsExpand: truncated && !usingNoteText,
      createdAt: String(legacy.created_at || ""),
      author: {
        id: String(user && user.rest_id || userLegacy.id_str || ""),
        name: String(userLegacy.name || userCore.name || ""),
        handle: String(userLegacy.screen_name || userCore.screen_name || ""),
        // 头像：legacy 用 _normal 小图，换成 _200x200 才够清晰；新结构在 avatar.image_url
        avatar: String(
          userLegacy.profile_image_url_https || user && user.avatar && user.avatar.image_url || ""
        ).replace("_normal.", "_200x200."),
        verified: Boolean(user && (user.is_blue_verified || userLegacy.verified)),
        // 资料卡所需字段
        description: String(userLegacy.description || userCore.description || bio.description || ""),
        followers: numberValue(userLegacy.followers_count !== void 0 ? userLegacy.followers_count : counts.followers_count !== void 0 ? counts.followers_count : counts.followers),
        followingCount: numberValue(userLegacy.friends_count !== void 0 ? userLegacy.friends_count : counts.following_count !== void 0 ? counts.following_count : counts.following),
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
        reposted: Boolean(legacy.retweeted || legacy.current_user_retweet && legacy.current_user_retweet.id_str),
        bookmarked: Boolean(legacy.bookmarked)
      },
      media,
      mediaCount: media.length,
      attachment: articleAttachment(tweet, legacy),
      // 被引用的帖子（一层）；没有引用时为 null
      quote: withQuote ? quotedModel(tweet) : null
    };
  }
  function tweetFromCreateResponse(json) {
    const data = json && json.data || json;
    if (!data || typeof data !== "object") return null;
    const direct = data.create_tweet && data.create_tweet.tweet_results && data.create_tweet.tweet_results.result;
    const node = direct || collectTweetNodes(data)[0] || null;
    const model = node ? liteModel(node) : null;
    return model && model.id ? model : null;
  }
  function mergeModel(target, fresh) {
    if (!target || !fresh || target === fresh) return target || fresh || null;
    const { depth, author, ...rest } = fresh;
    Object.assign(target, rest);
    if (author) {
      if (target.author && typeof target.author === "object") Object.assign(target.author, author);
      else target.author = { ...author };
    }
    return target;
  }
  function threadContinues(model, next) {
    return Boolean(model && next && model.id && String(next.inReplyToId || "") === String(model.id));
  }
  function bottomCursor(value) {
    if (!value || typeof value !== "object") return null;
    const seen = /* @__PURE__ */ new Set();
    let fallback = null;
    const walk = (node) => {
      if (!node || typeof node !== "object" || seen.has(node)) return null;
      seen.add(node);
      const type = String(node.cursorType || "");
      if (/^Bottom$/i.test(type) && typeof node.value === "string") return node.value;
      if (/^(?:ShowMoreThreads|ShowMoreThread)$/i.test(type) && typeof node.value === "string" && !fallback) fallback = node.value;
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
  function parseThreadSummary(json, focalTweetId) {
    const nodes = collectTweetNodes(json && json.data || json);
    const byId = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      const model = liteModel(node);
      if (model && model.id) byId.set(model.id, model);
    }
    const models = [...byId.values()];
    const focalId = String(focalTweetId || "");
    const focal = byId.get(focalId) || null;
    const cursor = bottomCursor(json && json.data || json);
    const descendsFromFocal = (model) => {
      if (!model || model.id === focalId) return false;
      if (model.inReplyToId === focalId) return true;
      const visited = /* @__PURE__ */ new Set([model.id]);
      let parentId = model.inReplyToId;
      while (parentId && !visited.has(parentId)) {
        if (parentId === focalId) return true;
        visited.add(parentId);
        const parent = byId.get(parentId);
        parentId = parent ? parent.inReplyToId : "";
      }
      return false;
    };
    const replyDepth = (model) => {
      let depth = 0;
      const visited = /* @__PURE__ */ new Set([model.id]);
      let parentId = model.inReplyToId;
      while (parentId && parentId !== focalId && byId.has(parentId) && !visited.has(parentId)) {
        depth += 1;
        visited.add(parentId);
        parentId = byId.get(parentId).inReplyToId;
      }
      return Math.min(depth, 3);
    };
    const replies = models.filter(descendsFromFocal).map((model) => ({ ...model, depth: replyDepth(model) }));
    const ancestors = [];
    if (focal) {
      const visited = /* @__PURE__ */ new Set([focal.id]);
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

  // src/x/xTheme.js
  var FALLBACK = {
    light: { bg: "#ffffff", fg: "#0f1419", muted: "#536471", border: "#eff3f4", soft: "#f7f9f9", hover: "rgba(0, 0, 0, 0.03)" },
    dim: { bg: "#15202b", fg: "#f7f9f9", muted: "#8b98a5", border: "#38444d", soft: "#1e2732", hover: "rgba(255, 255, 255, 0.03)" },
    dark: { bg: "#000000", fg: "#e7e9ea", muted: "#71767b", border: "#2f3336", soft: "#16181c", hover: "rgba(255, 255, 255, 0.03)" }
  };
  var ACCENT = "#1d9bf0";
  var ACCENT_TEXT = { light: "#0b6bcb", dim: "#1d9bf0", dark: "#1d9bf0" };
  var ACCENT_FILL = "#0f6fbf";
  var ON_ACCENT = "#ffffff";
  var SCROLLBAR = { light: "#a9b4c0", dim: "#4a5568", dark: "#4a5568" };
  var LIKE = "#f91880";
  var REPOST = "#00ba7c";
  var DANGER = { light: "#d0101c", dim: "#ff6b75", dark: "#ff5c66" };
  var VAR_MAP = {
    bg: "--pv-x-bg",
    fg: "--pv-x-fg",
    muted: "--pv-x-muted",
    border: "--pv-x-border",
    soft: "--pv-x-soft",
    hover: "--pv-x-hover",
    accent: "--pv-x-accent",
    accentText: "--pv-x-accent-text",
    accentFill: "--pv-x-accent-fill",
    onAccent: "--pv-x-on-accent",
    scrollbar: "--pv-x-scrollbar",
    like: "--pv-x-like",
    repost: "--pv-x-repost",
    danger: "--pv-x-danger",
    font: "--pv-x-font"
  };
  function computed(node, prop) {
    if (!node) return null;
    try {
      const value = getComputedStyle(node)[prop];
      return value && value !== "rgba(0, 0, 0, 0)" ? value : null;
    } catch (err) {
      return null;
    }
  }
  function firstComputed(selectors, prop) {
    for (const selector of selectors) {
      let node = null;
      try {
        node = document.querySelector(selector);
      } catch (err) {
        continue;
      }
      const value = computed(node, prop);
      if (value) return value;
    }
    return null;
  }
  function mutedFor(mode) {
    return FALLBACK[mode].muted;
  }
  function borderFor(mode) {
    return FALLBACK[mode].border;
  }
  function readXTheme() {
    const bodyBg = computed(document.body, "backgroundColor");
    const mode = /rgb\(0,\s*0,\s*0\)/.test(bodyBg || "") ? "dark" : /rgb\((?:21|22),\s*(?:31|32),\s*(?:42|43)\)/.test(bodyBg || "") ? "dim" : "light";
    const base = FALLBACK[mode];
    return {
      mode,
      // 采样只保留来源可靠的几项：body 背景、帖子正文色、body 字体；
      // 链接色不用采样值（X 浅色原生 #1d9bf0 对白底仅 3.0:1），走可读主题表。
      bg: bodyBg || base.bg,
      fg: firstComputed(['[data-testid="tweetText"]', 'article[data-testid="tweet"]'], "color") || base.fg,
      muted: mutedFor(mode),
      border: borderFor(mode),
      soft: base.soft,
      hover: base.hover,
      // 文字链接用可读色；采样值在浅色下常是 #1d9bf0（3.0:1），所以直接用主题表
      accent: ACCENT_TEXT[mode] || ACCENT,
      accentText: ACCENT_TEXT[mode] || ACCENT,
      accentFill: ACCENT_FILL,
      onAccent: ON_ACCENT,
      scrollbar: SCROLLBAR[mode] || SCROLLBAR.light,
      like: LIKE,
      repost: REPOST,
      danger: DANGER[mode],
      font: computed(document.body, "fontFamily")
    };
  }
  function applyXSkin(elements, theme = readXTheme()) {
    for (const node of elements) {
      if (!node) continue;
      for (const [key, cssVar] of Object.entries(VAR_MAP)) {
        const value = theme[key];
        if (value) node.style.setProperty(cssVar, value);
      }
    }
    return theme;
  }
  function watchXTheme(callback) {
    if (!document.body) return () => {
    };
    const observer2 = new MutationObserver(() => callback(readXTheme()));
    const options = { attributes: true, attributeFilter: ["style", "class"] };
    observer2.observe(document.body, options);
    if (document.documentElement) observer2.observe(document.documentElement, options);
    return () => observer2.disconnect();
  }

  // src/x/xFormat.js
  function oneDecimal(value) {
    const truncated = Math.floor(value * 10) / 10;
    return Number.isInteger(truncated) ? String(truncated) : truncated.toFixed(1);
  }
  function formatCount(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    if (n < 1e4) return n.toLocaleString("en-US");
    if (n < 1e8) return `${oneDecimal(n / 1e4)}万`;
    return `${oneDecimal(n / 1e8)}亿`;
  }
  function parseTime(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? new Date(value) : null;
    const text = String(value || "").trim();
    if (!text) return null;
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? new Date(ms) : null;
  }
  var pad2 = (n) => String(n).padStart(2, "0");
  function fullTime(value) {
    const date = parseTime(value);
    if (!date) return "";
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  function sinceLabel(at, now = Date.now()) {
    if (!at) return "";
    const seconds = Math.max(0, Math.round((now - at) / 1e3));
    if (seconds < 45) return "刚刚更新";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} 分钟前更新`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} 小时前更新`;
    return `${Math.round(hours / 24)} 天前更新`;
  }

  // src/x/xDrafts.js
  var DEFAULT_LIMIT = 20;
  var STORAGE_KEY = "pv2:xDrafts";
  var MAX_AGE = 7 * 24 * 60 * 60 * 1e3;
  var SAVE_DELAY = 300;
  function targetSnapshot(model) {
    if (!model || !model.id) return null;
    const author = model.author || {};
    return {
      id: String(model.id),
      depth: model.depth,
      author: { id: author.id || "", name: author.name || "", handle: author.handle || "" }
    };
  }
  function loadPersisted(limit) {
    const map = /* @__PURE__ */ new Map();
    let stored = [];
    try {
      stored = gm.getValue(STORAGE_KEY, []);
    } catch {
      stored = [];
    }
    if (typeof stored === "string") {
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
  function createDraftStore(limit = DEFAULT_LIMIT) {
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
      }
    };
    const scheduleSave = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, SAVE_DELAY);
    };
    return {
      /** @returns {{text:string,target:Object|null}|null} */
      get(focalId) {
        const draft = store().get(String(focalId || ""));
        return draft ? { text: draft.text, target: draft.target } : null;
      },
      /** 正文为空就删除（只选了回复目标、没写字不算草稿） */
      set(focalId, text, target = null) {
        const key = String(focalId || "");
        if (!key) return;
        const value = String(text || "");
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
        store().delete(String(focalId || ""));
        scheduleSave();
      },
      get size() {
        return store().size;
      }
    };
  }
  var replyDrafts = createDraftStore();

  // src/x/xIcons.js
  var SELECTORS = {
    reply: ['[data-testid="reply"] svg'],
    repost: ['[data-testid="retweet"] svg'],
    like: ['[data-testid="like"] svg'],
    bookmark: ['[data-testid="bookmark"] svg'],
    share: ['[data-testid="share"] svg'],
    views: ['[data-testid="analytics"] svg', 'a[href$="/analytics"] svg'],
    verified: ['[data-testid="icon-verified"] svg', 'svg[aria-label*="认证"]', 'svg[aria-label*="Verified"]']
  };
  var cache = /* @__PURE__ */ new Map();
  function xIcon(name) {
    const cached = cache.get(name);
    if (cached) return cached.cloneNode(true);
    let source = null;
    for (const selector of SELECTORS[name] || []) {
      try {
        source = document.querySelector(selector);
      } catch (err) {
        source = null;
      }
      if (source && String(source.tagName).toLowerCase() === "svg") break;
      source = null;
    }
    if (!source) return null;
    const clone = source.cloneNode(true);
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    clone.removeAttribute("style");
    clone.setAttribute("aria-hidden", "true");
    clone.setAttribute("focusable", "false");
    cache.set(name, clone);
    return clone.cloneNode(true);
  }
  function primeXIcons() {
    cache.clear();
    for (const name of Object.keys(SELECTORS)) xIcon(name);
  }

  // src/x/xProfileCard.js
  var SHOW_DELAY = 1e3;
  var HIDE_DELAY = 650;
  var UNFOLLOW_CONFIRM_MS = 3e3;
  var FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function profileHref(author) {
    return author.handle ? `https://x.com/${author.handle}` : `https://x.com/i/user/${author.id}`;
  }
  function createProfileCard({ getRoot, onToggleFollow, onNotify }) {
    let card = null;
    let cardKey = "";
    let anchor = null;
    let showTimer = null;
    let hideTimer = null;
    const keyOf = (author) => String(author.id || author.handle || "");
    const clearTimers = () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      showTimer = null;
      hideTimer = null;
    };
    const remove = (returnFocus = false) => {
      clearTimers();
      const trigger = anchor;
      const node = card;
      const active = node && node.getRootNode ? node.getRootNode().activeElement : null;
      const hadFocus = Boolean(node && active && node.contains(active));
      node == null ? void 0 : node.remove();
      card = null;
      cardKey = "";
      anchor = null;
      if ((returnFocus === true || hadFocus) && trigger && trigger.isConnected) {
        try {
          trigger.focus({ preventScroll: true });
        } catch (err) {
          trigger.focus();
        }
      }
    };
    const scheduleHide = () => {
      clearTimers();
      hideTimer = setTimeout(remove, HIDE_DELAY);
    };
    const position = (node, target) => {
      const root = getRoot();
      if (!(node == null ? void 0 : node.isConnected) || !(target == null ? void 0 : target.isConnected) || !root) return;
      const rootRect = root.getBoundingClientRect();
      const anchorRect = target.getBoundingClientRect();
      const cardRect = node.getBoundingClientRect();
      const gap = 4;
      const pad = 8;
      const maxLeft = Math.max(pad, rootRect.width - cardRect.width - pad);
      const left = Math.min(Math.max(pad, anchorRect.left - rootRect.left), maxLeft);
      const below = anchorRect.bottom - rootRect.top + gap;
      const top = below + cardRect.height <= rootRect.height - pad ? below : Math.max(pad, anchorRect.top - rootRect.top - cardRect.height - gap);
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
    };
    const followButton = (author, cardNode) => {
      if (!author.id) return null;
      const button = el(
        "button",
        { class: "pv-x-profile-follow", type: "button" },
        el("span", { class: "pv-x-profile-follow-default" }),
        el("span", { class: "pv-x-profile-follow-hover", text: "取消关注" })
      );
      const refresh = () => {
        const following = Boolean(author.viewerFollowing);
        const pending = !following && Boolean(author.followRequestSent);
        const uncertain = Boolean(author.followStateUnconfirmed);
        const label = uncertain ? "查看状态" : following ? "正在关注" : pending ? "已请求" : "关注";
        button.dataset.following = String(following && !uncertain);
        button.disabled = pending && !uncertain;
        button.title = uncertain ? "请求已提交，点击在 X 个人资料页核对状态" : pending ? "关注请求待批准，可在 X 个人资料页管理" : "";
        button.querySelector(".pv-x-profile-follow-default").textContent = label;
        button.setAttribute("aria-label", `${label} @${author.handle || author.name || "X 用户"}`);
        const followers = cardNode.querySelector(".pv-x-profile-followers-count");
        if (followers) followers.textContent = formatCount(author.followers) || "0";
      };
      refresh();
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        if (author.followStateUnconfirmed) {
          window.open(profileHref(author), "_blank", "noopener");
          return;
        }
        const nextActive = !Boolean(author.viewerFollowing);
        if (!nextActive && button.dataset.confirm !== "true") {
          button.dataset.confirm = "true";
          button.querySelector(".pv-x-profile-follow-default").textContent = "确认取消关注";
          button.setAttribute("aria-label", `确认取消关注 @${author.handle || author.name || "X 用户"}`);
          clearTimeout(button.__pvConfirmTimer);
          button.__pvConfirmTimer = setTimeout(() => {
            delete button.dataset.confirm;
            refresh();
          }, UNFOLLOW_CONFIRM_MS);
          return;
        }
        clearTimeout(button.__pvConfirmTimer);
        delete button.dataset.confirm;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        try {
          const result = await onToggleFollow(author, nextActive);
          refresh();
          if (result && result.confirmed === false) {
            onNotify == null ? void 0 : onNotify("请求已提交，状态暂未同步，可点「查看状态」核对", "info");
          } else if (result && result.following) {
            onNotify == null ? void 0 : onNotify(`已关注 @${author.handle}`, "ok");
          } else if (result && result.followRequestSent) {
            onNotify == null ? void 0 : onNotify(`已发送关注请求 @${author.handle}`, "ok");
          } else if (nextActive) {
            onNotify == null ? void 0 : onNotify(`X 当前显示尚未关注 @${author.handle}`, "info");
          } else {
            onNotify == null ? void 0 : onNotify(`已取消关注 @${author.handle}`, "ok");
          }
        } catch (err) {
          onNotify == null ? void 0 : onNotify(err && err.message ? err.message : "关注操作失败", "error");
        } finally {
          button.disabled = false;
          button.removeAttribute("aria-busy");
          refresh();
        }
      });
      return button;
    };
    const build = (author, href) => {
      const node = el("section", {
        class: "pv-x-profile-card",
        role: "dialog",
        "aria-label": `${author.name || author.handle || "X 用户"} 的账号资料`
      });
      const top = el("div", { class: "pv-x-profile-top" });
      const avatarLink = el("a", { class: "pv-x-profile-avatar", href, target: "_blank", rel: "noreferrer" });
      if (author.avatar) avatarLink.appendChild(el("img", { src: author.avatar, alt: author.name || author.handle || "" }));
      top.appendChild(avatarLink);
      const follow = followButton(author, node);
      if (follow) top.appendChild(follow);
      const nameRow = el("a", { class: "pv-x-profile-name", href, target: "_blank", rel: "noreferrer" });
      nameRow.appendChild(el("strong", { text: author.name || author.handle || "X 用户" }));
      if (author.verified) {
        const badge2 = xIcon("verified");
        if (badge2) nameRow.appendChild(el("span", { class: "pv-x-badge" }, badge2));
      }
      const handleRow = el("a", {
        class: "pv-x-profile-handle",
        href,
        target: "_blank",
        rel: "noreferrer",
        text: `@${author.handle || "unknown"}`
      });
      node.append(top, nameRow, handleRow);
      if (author.followsViewer) node.appendChild(el("div", { class: "pv-x-profile-follows-you", text: "关注了你" }));
      if (author.description) node.appendChild(el("p", { class: "pv-x-profile-bio", text: author.description }));
      const stats = el("div", { class: "pv-x-profile-stats" });
      const followingLink = el("a", { href: `${href.replace(/\/$/, "")}/following`, target: "_blank", rel: "noreferrer" });
      followingLink.append(el("strong", { text: formatCount(author.followingCount) || "0" }), document.createTextNode(" 正在关注"));
      const followersLink = el("a", { href: `${href.replace(/\/$/, "")}/verified_followers`, target: "_blank", rel: "noreferrer" });
      followersLink.append(
        el("strong", { class: "pv-x-profile-followers-count", text: formatCount(author.followers) || "0" }),
        document.createTextNode(" 关注者")
      );
      stats.append(followingLink, followersLink);
      node.appendChild(stats);
      node.appendChild(
        el("a", {
          class: "pv-x-profile-summary",
          href: `https://x.com/i/grok?text=${encodeURIComponent(`请总结 @${author.handle || ""} 的个人资料`)}`,
          target: "_blank",
          rel: "noreferrer",
          text: "个人资料概要"
        })
      );
      node.addEventListener("pointerenter", clearTimers);
      node.addEventListener("pointerleave", scheduleHide);
      node.addEventListener("focusin", () => clearTimeout(hideTimer));
      node.addEventListener("focusout", scheduleHide);
      node.addEventListener("keydown", onCardKeydown);
      return node;
    };
    const focusables = (node) => [...node.querySelectorAll(FOCUSABLE)].filter((item) => !item.hidden);
    function onCardKeydown(event) {
      if (!card) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        remove(true);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables(card);
      if (!items.length) return;
      const active = card.getRootNode ? card.getRootNode().activeElement : null;
      if (event.shiftKey && active === items[0]) {
        event.preventDefault();
        anchor == null ? void 0 : anchor.focus();
      } else if (!event.shiftKey && active === items[items.length - 1]) {
        event.preventDefault();
        remove(true);
      }
    }
    const show = (author, href, target) => {
      const root = getRoot();
      if (!root || !target.isConnected) return;
      const key = keyOf(author);
      if ((card == null ? void 0 : card.isConnected) && cardKey === key) {
        anchor = target;
        position(card, target);
        return;
      }
      remove();
      card = build(author, href);
      cardKey = key;
      anchor = target;
      root.appendChild(card);
      position(card, target);
    };
    const bind = (node, author, href) => {
      if (!node || !author) return;
      node.classList.add("pv-x-profile-trigger");
      node.setAttribute("aria-haspopup", "dialog");
      node.addEventListener("pointerenter", () => {
        clearTimers();
        if ((card == null ? void 0 : card.isConnected) && cardKey === keyOf(author)) {
          anchor = node;
          position(card, node);
          return;
        }
        showTimer = setTimeout(() => show(author, href, node), SHOW_DELAY);
      });
      node.addEventListener("pointerleave", scheduleHide);
      node.addEventListener("focus", () => {
        clearTimers();
        show(author, href, node);
      });
      node.addEventListener("blur", scheduleHide);
      node.addEventListener("keydown", (event) => {
        if (!card || anchor !== node) return;
        if (event.key === "Tab" && !event.shiftKey) {
          const first = focusables(card)[0];
          if (!first) return;
          event.preventDefault();
          clearTimers();
          first.focus();
        } else if (event.key === "Escape") {
          event.stopPropagation();
          event.preventDefault();
          remove(false);
        }
      });
    };
    return {
      bind,
      remove: () => remove(false),
      destroy: () => remove(false),
      isOpen: () => Boolean(card),
      // 弹窗尺寸变化后卡片位置会失效，重新贴回锚点
      reposition: () => {
        if (card && anchor) position(card, anchor);
      }
    };
  }

  // src/x/xZoomMath.js
  var MIN_SCALE = 1;
  var MAX_SCALE = 4;
  function clampScale(scale, max = Infinity) {
    return Math.min(max, Math.max(MIN_SCALE, Number.isFinite(scale) ? scale : MIN_SCALE));
  }
  function zoomTowards({ scale, tx, ty, nextScale, dx, dy }) {
    const from = scale > 0 ? scale : MIN_SCALE;
    const to = clampScale(nextScale);
    const k = to / from;
    return { scale: to, tx: dx - (dx - tx) * k, ty: dy - (dy - ty) * k };
  }
  function clampTranslate(tx, ty, { contentW, contentH, frameW, frameH, scale }) {
    const scaledW = Math.max(0, contentW) * scale;
    const scaledH = Math.max(0, contentH) * scale;
    const limitX = Math.max(0, (scaledW - Math.max(0, frameW)) / 2);
    const limitY = Math.max(0, (scaledH - Math.max(0, frameH)) / 2);
    const axis = (value, limit) => Math.min(limit, Math.max(-limit, Number.isFinite(value) ? value : 0)) + 0;
    return { x: axis(tx, limitX), y: axis(ty, limitY) };
  }
  function maxScaleFor(naturalW, baseW) {
    if (!(baseW > 0) || !(naturalW > 0)) return MAX_SCALE;
    return Math.max(MIN_SCALE, naturalW / baseW);
  }
  function fitPercent(naturalW, baseW) {
    if (!(baseW > 0) || !(naturalW > 0)) return 100;
    return Math.min(100, baseW / naturalW * 100);
  }
  function sliderRatioToScale(ratio, fitPct) {
    const start = Math.min(100, Math.max(1, Number.isFinite(fitPct) ? fitPct : 100));
    const r = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
    return (start + r * (100 - start)) / start;
  }
  function sliderScaleToRatio(scale, fitPct) {
    const start = Math.min(100, Math.max(1, Number.isFinite(fitPct) ? fitPct : 100));
    const s = Number.isFinite(scale) ? scale : MIN_SCALE;
    if (start >= 100) return 0;
    return Math.min(1, Math.max(0, (s - 1) * start / (100 - start)));
  }

  // src/x/xRender.js
  var SORTS = [
    { key: "relevant", label: "相关" },
    { key: "latest", label: "最新" },
    { key: "liked", label: "最多喜欢" }
  ];
  function profileUrlOf(model) {
    const handle = model.author && model.author.handle;
    if (handle) return `https://x.com/${handle}`;
    const id = model.author && model.author.id;
    return id ? `https://x.com/i/user/${id}` : `https://x.com/i/status/${model.id}`;
  }
  function openUrlOf(model) {
    const handle = model.author && model.author.handle;
    return handle ? `https://x.com/${handle}/status/${model.id}` : `https://x.com/i/status/${model.id}`;
  }
  function avatarColumn(model, { link = true, bindProfile = null } = {}) {
    const column = el("div", { class: "pv-x-avatar-col" });
    const avatar = el(link ? "a" : "span", {
      class: "pv-x-avatar",
      href: link ? profileUrlOf(model) : null,
      target: link ? "_blank" : null,
      rel: link ? "noreferrer" : null
    });
    if (model.author && model.author.avatar) avatar.appendChild(el("img", { src: model.author.avatar, alt: "", loading: "lazy" }));
    column.appendChild(avatar);
    if (link) bindProfile == null ? void 0 : bindProfile(avatar, model);
    return column;
  }
  function repliesEntry(model, onOpenComments) {
    if (!onOpenComments) return null;
    const count = countOf(model, "replies");
    const button = el("button", {
      class: "pv-x-comment-entry",
      type: "button",
      "aria-haspopup": "dialog",
      "aria-expanded": "false",
      "data-replies-for": model.id,
      title: count ? `查看这条的 ${count} 条评论` : "查看这条的评论",
      "aria-label": count ? `查看这条的 ${count} 条评论` : "查看这条的评论"
    });
    const icon = xIcon("reply");
    if (icon) button.appendChild(icon);
    button.appendChild(el("span", { class: "pv-x-comment-count", text: count ? formatCount(count) : "" }));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onOpenComments(model, button);
    });
    paintRepliesLink(button, model);
    return button;
  }
  function paintRepliesLink(button, model) {
    if (!button) return;
    const count = countOf(model, "replies");
    button.hidden = !count;
    const label = count ? `查看这条的 ${count} 条评论` : "查看这条的评论";
    button.title = label;
    button.setAttribute("aria-label", label);
    const countNode = button.querySelector(".pv-x-comment-count");
    if (countNode) countNode.textContent = count ? formatCount(count) : "";
  }
  function headNode(model, bindProfile = null, onOpenComments = null) {
    const head = el("div", { class: "pv-x-head" });
    const nameLink = el("a", {
      class: "pv-x-name",
      href: profileUrlOf(model),
      target: "_blank",
      rel: "noreferrer",
      text: model.author && (model.author.name || model.author.handle) || "X 用户"
    });
    head.appendChild(nameLink);
    bindProfile == null ? void 0 : bindProfile(nameLink, model);
    if (model.author && model.author.verified) {
      const badge2 = xIcon("verified");
      if (badge2) head.appendChild(el("span", { class: "pv-x-badge" }, badge2));
    }
    if (model.author && model.author.handle) {
      const handle = el("span", { class: "pv-x-handle", text: `@${model.author.handle}` });
      head.appendChild(handle);
      bindProfile == null ? void 0 : bindProfile(handle, model);
    }
    if (model.createdAt) {
      head.appendChild(el("span", { class: "pv-x-dot", text: "·" }));
      const full = fullTime(model.createdAt);
      const date = new Date(model.createdAt);
      const label = Number.isNaN(date.getTime()) ? full : date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      head.appendChild(
        el("time", {
          class: "pv-x-time",
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
  var ACTIONS2 = [
    { key: "reply", icon: "reply", count: "replies", label: "回复" },
    { key: "repost", icon: "repost", count: "reposts", label: "转推" },
    { key: "like", icon: "like", count: "likes", label: "喜欢" },
    { key: "bookmark", icon: "bookmark", count: "bookmarks", label: "收藏" },
    { key: "share", icon: "share", count: null, label: "复制链接" },
    { key: "views", icon: "views", count: "views", label: "查看", readonly: true }
  ];
  var FLAG_BY_ACTION = { like: "liked", repost: "reposted", bookmark: "bookmarked" };
  var COUNT_BY_ACTION = { reply: "replies", repost: "reposts", like: "likes", bookmark: "bookmarks", views: "views" };
  function countOf(model, key) {
    if (!key) return 0;
    return Number(model && model.counts && model.counts[key]) || 0;
  }
  function paintAction(button, model, key) {
    if (!button) return;
    const flag = FLAG_BY_ACTION[key];
    const active = Boolean(flag && model.flags && model.flags[flag]);
    if (flag) {
      button.dataset.active = active ? "true" : "false";
      if (button.tagName === "BUTTON") button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    const countNode = button.querySelector(".pv-x-count");
    const countKey = COUNT_BY_ACTION[key];
    const spec = ACTIONS2.find((item) => item.key === key);
    const value = countKey ? countOf(model, countKey) : 0;
    if (spec) button.setAttribute("aria-label", value ? `${spec.label} ${formatCount(value)}` : spec.label);
    if (!countNode || !countKey) return;
    countNode.textContent = value ? formatCount(value) : "";
  }
  function actionsNode(model, onAction) {
    const row = el("div", { class: "pv-x-actions" });
    for (const spec of ACTIONS2) {
      const value = spec.count ? countOf(model, spec.count) : 0;
      const icon = xIcon(spec.icon);
      if (!icon && !value && !spec.readonly) continue;
      if (spec.readonly && !value) continue;
      const node = el(spec.readonly ? "span" : "button", {
        class: `pv-x-action pv-x-action-${spec.key}`,
        type: spec.readonly ? null : "button",
        "data-action": spec.key,
        "aria-label": spec.label,
        title: spec.label
      });
      if (icon) node.appendChild(icon);
      if (spec.count) node.appendChild(el("span", { class: "pv-x-count", text: value ? formatCount(value) : "" }));
      if (!spec.readonly && onAction) {
        node.addEventListener("click", (event) => {
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
  function displayText(model) {
    const text = String(model.text || "");
    if (!model.attachment || model.attachment.type !== "article") return text;
    return text.replace(/https?:\/\/t\.co\/\S+/g, "").trim();
  }
  function appendRichText(container, model, bindProfile) {
    const text = displayText(model);
    const ranges = (model.entities || []).filter((range) => range.end > range.start && range.start >= 0);
    if (!ranges.length) {
      container.appendChild(document.createTextNode(text));
      return;
    }
    const prefixOf = { mention: "@", hashtag: "#", symbol: "$" };
    let cursor = 0;
    for (const range of ranges) {
      const start = Math.max(cursor, Math.min(range.start, text.length));
      const end = Math.max(start, Math.min(range.end, text.length));
      if (start > cursor) container.appendChild(document.createTextNode(text.slice(cursor, start)));
      if (end > start) {
        const sliced = text.slice(start, end);
        const prefix = prefixOf[range.kind];
        const label = range.kind === "url" ? range.label || sliced : sliced;
        const valid = range.kind === "url" ? Boolean(range.url) : !prefix || sliced.startsWith(prefix);
        if (!range.url || !valid) {
          container.appendChild(document.createTextNode(sliced));
        } else {
          const link = el("a", {
            class: `pv-x-entity pv-x-entity-${range.kind}`,
            href: range.url,
            target: "_blank",
            rel: "noreferrer",
            text: label
          });
          if (range.kind === "mention" && range.author && bindProfile) {
            bindProfile(link, { id: range.author.id, author: range.author });
          }
          container.appendChild(link);
        }
      }
      cursor = end;
    }
    if (cursor < text.length) container.appendChild(document.createTextNode(text.slice(cursor)));
  }
  function renderTextBlock(block, model, view, bindProfile = null) {
    block.replaceChildren();
    const offered = Boolean(view && view.offered);
    const entry = view && view.entry;
    const showing = Boolean(entry && entry.status === "ready" && view.display !== "original");
    if (offered) {
      const row = el("div", { class: "pv-x-translation-row" });
      if (!entry || entry.status === "queued" || entry.status === "loading") {
        row.appendChild(el("span", { class: "pv-x-translation-note", text: "正在翻译…" }));
      } else if (entry.status === "ready" && showing) {
        row.appendChild(el("span", { class: "pv-x-translation-note", text: `翻译自${sourceLanguageLabel(entry)}` }));
        row.appendChild(
          el("button", { class: "pv-x-translation-link", type: "button", text: "显示原文" })
        );
      } else if (entry.status === "error") {
        row.appendChild(
          el("button", { class: "pv-x-translation-link", type: "button", text: "重试翻译", title: entry.message || "" })
        );
      } else if (entry.status === "ready") {
        row.appendChild(el("button", { class: "pv-x-translation-link", type: "button", text: "显示翻译" }));
      }
      const link = row.querySelector("button");
      if (link) {
        link.addEventListener("click", (event) => {
          var _a, _b, _c;
          event.preventDefault();
          event.stopPropagation();
          if (entry && entry.status === "error") (_a = view.onRetry) == null ? void 0 : _a.call(view);
          else if (entry && entry.status === "ready") (_b = view.onToggle) == null ? void 0 : _b.call(view, showing ? "original" : "translation");
          else (_c = view.onRetry) == null ? void 0 : _c.call(view);
        });
      }
      if (row.childNodes.length) block.appendChild(row);
    }
    const body = el("div", { class: "pv-x-text" });
    if (showing) body.textContent = entry.text;
    else appendRichText(body, model, bindProfile);
    block.appendChild(body);
    if (model.needsExpand) {
      const more = el("button", {
        class: "pv-x-more-text",
        type: "button",
        text: model.expanding ? "正在加载全文…" : "显示更多",
        disabled: model.expanding ? "" : null
      });
      more.addEventListener("click", (event) => {
        var _a;
        event.preventDefault();
        event.stopPropagation();
        (_a = view == null ? void 0 : view.onExpand) == null ? void 0 : _a.call(view, model);
      });
      block.appendChild(more);
    }
  }
  function textBlock(model, view, bindProfile) {
    const block = el("div", { class: "pv-x-translatable", "data-translation-id": model.id });
    renderTextBlock(block, model, view, bindProfile);
    return block;
  }
  function appendInline(container, block) {
    const text = String(block.text || "");
    const ranges = (block.inlineStyles || []).filter((range) => range.length > 0 && range.offset >= 0).sort((a, b) => a.offset - b.offset);
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
        const style = String(range.style || "").toUpperCase();
        const tag = style.includes("BOLD") ? "strong" : style.includes("ITALIC") ? "em" : style.includes("UNDERLINE") ? "u" : style.includes("STRIKETHROUGH") ? "s" : null;
        const chunk = text.slice(start, end);
        container.appendChild(tag ? el(tag, { text: chunk }) : document.createTextNode(chunk));
      }
      cursor = end;
    }
    if (cursor < text.length) container.appendChild(document.createTextNode(text.slice(cursor)));
  }
  function articleBlocks(content) {
    const container = el("div", { class: "pv-x-article-content" });
    let list = null;
    let listTag = "";
    const endList = () => {
      list = null;
      listTag = "";
    };
    for (const block of content.blocks || []) {
      const type = String(block.type || "unstyled");
      if (type === "unordered-list-item" || type === "ordered-list-item") {
        const tag2 = type === "ordered-list-item" ? "ol" : "ul";
        if (!list || listTag !== tag2) {
          list = el(tag2, { class: "pv-x-article-list" });
          listTag = tag2;
          container.appendChild(list);
        }
        const item = el("li");
        appendInline(item, block);
        list.appendChild(item);
        continue;
      }
      endList();
      if (type === "atomic") {
        const range = (block.entityRanges || [])[0];
        const entity = range ? content.entities[range.key] : null;
        if (entity && entity.image) {
          container.appendChild(
            el("figure", { class: "pv-x-article-figure" }, el("img", { src: entity.image, alt: entity.alt || "", loading: "lazy" }))
          );
        }
        continue;
      }
      if (!String(block.text || "").trim()) continue;
      const tag = type === "header-one" ? "h2" : type === "header-two" ? "h3" : type === "header-three" ? "h4" : type === "blockquote" ? "blockquote" : "p";
      const className = tag === "blockquote" ? "pv-x-article-quote" : tag === "p" ? "pv-x-article-p" : tag === "h2" ? "pv-x-article-h2" : tag === "h3" ? "pv-x-article-h3" : "pv-x-article-h4";
      const node = el(tag, { class: className });
      appendInline(node, block);
      container.appendChild(node);
    }
    return container;
  }
  function articleReader(model) {
    const attachment = model.attachment;
    const section = el("section", { class: "pv-x-article" });
    if (attachment.image) {
      section.appendChild(el("div", { class: "pv-x-article-cover" }, el("img", { src: attachment.image, alt: "", loading: "lazy" })));
    }
    const heading = el("header", { class: "pv-x-article-heading" });
    if (attachment.title) heading.appendChild(el("h1", { class: "pv-x-article-title", text: attachment.title }));
    heading.appendChild(
      el("a", {
        class: "pv-x-article-open",
        href: attachment.url || openUrlOf(model),
        target: "_blank",
        rel: "noreferrer",
        text: "在 X 阅读全文"
      })
    );
    section.appendChild(heading);
    if (attachment.content && attachment.content.blocks.length) section.appendChild(articleBlocks(attachment.content));
    else if (attachment.description) section.appendChild(el("p", { class: "pv-x-article-p", text: attachment.description }));
    return section;
  }
  function articleCard(model) {
    const attachment = model.attachment;
    const card = el("a", {
      class: "pv-x-article-card",
      href: attachment.url || openUrlOf(model),
      target: "_blank",
      rel: "noreferrer"
    });
    if (attachment.image) {
      card.appendChild(el("img", { class: "pv-x-article-card-cover", src: attachment.image, alt: "", loading: "lazy" }));
    }
    const body = el("div", { class: "pv-x-article-card-body" });
    body.appendChild(el("span", { class: "pv-x-article-card-domain", text: "x.com · 长文" }));
    if (attachment.title) body.appendChild(el("strong", { class: "pv-x-article-card-title", text: attachment.title }));
    if (attachment.description) body.appendChild(el("span", { class: "pv-x-article-card-desc", text: attachment.description }));
    card.appendChild(body);
    return card;
  }
  function createMediaCarousel(photos, { openUrl, variant = "inline", startIndex = 0, onZoom = null, onClose = null } = {}) {
    if (!photos.length) return null;
    let current = Math.max(0, Math.min(startIndex, photos.length - 1));
    const framePhoto = photos[0];
    const overlay = variant === "overlay";
    const stage = el("div", {
      class: `pv-x-media-stage pv-x-media-stage-${variant}`,
      tabindex: "0",
      "aria-roledescription": variant === "inline" ? "图片轮播" : "图片查看",
      "aria-label": variant === "inline" ? `${photos.length} 张图片，按 Enter 放大` : `${photos.length} 张图片，可缩放、可拖动；方向键切图，+/- 缩放，0 适应`
    });
    if (framePhoto.width && framePhoto.height) stage.style.aspectRatio = `${framePhoto.width} / ${framePhoto.height}`;
    const track = el("div", { class: "pv-x-media-track" });
    const imgs = photos.map(
      (photo) => el("img", {
        class: "pv-x-media-big",
        src: photo.url,
        alt: photo.altText || "",
        loading: "lazy",
        draggable: "false"
      })
    );
    const slides = imgs.map((img) => {
      const slide = el("div", { class: "pv-x-media-slide" }, img);
      track.appendChild(slide);
      return slide;
    });
    const counter = el("span", { class: "pv-x-media-counter" });
    const closeButton = el("button", {
      class: "pv-x-media-collapse",
      type: "button",
      "aria-label": variant === "overlay" ? "关闭大图" : "收起图片",
      text: "✕"
    });
    const openLink = el("a", { class: "pv-x-media-open", href: openUrl, target: "_blank", rel: "noreferrer", text: "在 X 打开" });
    const bar = overlay ? el(
      "div",
      { class: "pv-x-media-bar pv-x-media-bar-grouped" },
      el("div", { class: "pv-x-media-bar-group" }, counter, openLink, closeButton)
    ) : el("div", { class: "pv-x-media-bar" }, counter, openLink);
    const prevButton = photos.length > 1 ? el(
      "button",
      { class: "pv-x-media-nav pv-x-media-prev", type: "button", "aria-label": "上一张" },
      svgIcon("chevronLeft", { size: 24 })
    ) : null;
    const nextButton = photos.length > 1 ? el(
      "button",
      { class: "pv-x-media-nav pv-x-media-next", type: "button", "aria-label": "下一张" },
      svgIcon("chevronRight", { size: 24 })
    ) : null;
    const viewport = overlay ? el("div", { class: "pv-x-media-viewport" }) : null;
    const main = overlay ? el("div", { class: "pv-x-media-main" }) : null;
    const shell = overlay ? el("div", { class: "pv-x-media-shell" }) : null;
    const zoomRange = overlay ? el("div", {
      class: "pv-x-zoom-range",
      role: "slider",
      tabindex: "0",
      "aria-label": "缩放比例",
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": "0",
      "aria-valuetext": "适应窗口",
      title: "拖动 / 滚轮缩放"
    }) : null;
    const zoomValue = overlay ? el("span", { class: "pv-x-zoom-value", text: "100%" }) : null;
    const zoomOutButton = overlay ? el(
      "button",
      { class: "pv-x-zoom-btn", type: "button", "aria-label": "缩小", title: "缩小（-）" },
      svgIcon("minus", { size: 16 })
    ) : null;
    const zoomInButton = overlay ? el(
      "button",
      { class: "pv-x-zoom-btn", type: "button", "aria-label": "放大", title: "放大（+）" },
      svgIcon("plus", { size: 16 })
    ) : null;
    const zoomFitButton = overlay ? el("button", { class: "pv-x-zoom-fit", type: "button", "aria-label": "适应窗口", title: "适应窗口", text: "适应" }) : null;
    if (overlay) zoomRange.append(el("div", { class: "pv-x-zoom-fill" }), el("div", { class: "pv-x-zoom-thumb" }));
    const zoomBar = overlay ? el("div", { class: "pv-x-media-zoom" }, zoomOutButton, zoomRange, zoomValue, zoomInButton, zoomFitButton) : null;
    const keyHost = shell || stage;
    const reduceMotion = () => {
      try {
        return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (err) {
        return false;
      }
    };
    const width = () => stage.clientWidth || 1;
    const targetOf = (i) => -i * width();
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
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let zoomRaf = null;
    let wheelSnapTimer = null;
    const activeImg = () => imgs[current] || null;
    const isZoomed = () => scale > 1.005;
    const boundListeners = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      boundListeners.push([target, type, handler, options]);
    };
    const frameSize = () => ({ w: stage.clientWidth, h: stage.clientHeight });
    const contentCenter = () => {
      const rect = stage.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const baseSize = () => {
      const img = activeImg();
      if (!img || !img.complete || !img.naturalWidth) return frameSize();
      return { w: img.offsetWidth, h: img.offsetHeight };
    };
    const zoomCap = () => {
      var _a;
      return maxScaleFor(((_a = activeImg()) == null ? void 0 : _a.naturalWidth) || 0, baseSize().w);
    };
    const fitPct = () => {
      var _a;
      const img = activeImg();
      const natural = img && img.naturalWidth || ((_a = photos[current]) == null ? void 0 : _a.width) || 0;
      return fitPercent(natural, baseSize().w);
    };
    const setRasterHint = (on) => {
      const img = activeImg();
      if (!img) return;
      img.style.willChange = on ? "transform" : "";
      if (!on) {
        const transform = img.style.transform;
        img.style.transform = "none";
        void img.offsetWidth;
        img.style.transform = transform;
      }
    };
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
      const percent = Math.round(scale * fitPct());
      stage.classList.toggle("pv-x-media-zoomed", isZoomed());
      zoomRange.setAttribute("aria-valuenow", String(percent));
      zoomRange.setAttribute("aria-valuemin", String(Math.round(fitPct())));
      zoomRange.setAttribute("aria-valuemax", "100");
      zoomRange.setAttribute("aria-valuetext", `${percent}%`);
      zoomRange.style.setProperty("--pv-zoom-ratio", String(sliderScaleToRatio(scale, fitPct())));
      zoomValue.textContent = `${percent}%`;
      zoomOutButton.disabled = scale <= MIN_SCALE + 1e-3;
      zoomInButton.disabled = scale >= cap - 1e-3;
      zoomFitButton.disabled = scale <= MIN_SCALE + 1e-3;
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
      for (const img of imgs) img.style.transform = "";
      setRasterHint(false);
      if (!overlay) return;
      stage.classList.remove("pv-x-media-zoomed");
      paintZoom();
    };
    const animateZoom = (targetScale, anchorX, anchorY) => {
      var _a;
      if (!overlay) return;
      const next = clampScale(targetScale, zoomCap());
      if (debugEnabled()) {
        const b = baseSize();
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
          natural: ((_a = activeImg()) == null ? void 0 : _a.naturalWidth) || 0
        });
      }
      cancelZoomAnim();
      cancelWheelSnap();
      setRasterHint(true);
      const center = contentCenter();
      const dx = anchorX - center.x;
      const dy = anchorY - center.y;
      if (reduceMotion() || Math.abs(next - scale) < 1e-3) {
        const z = zoomTowards({ scale, tx, ty, nextScale: next, dx, dy });
        scale = z.scale;
        tx = z.tx;
        ty = z.ty;
        clampZoom();
        applyZoom();
        setRasterHint(false);
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
        if (k < 1) {
          zoomRaf = requestAnimationFrame(step);
        } else {
          zoomRaf = null;
          setRasterHint(false);
        }
      };
      zoomRaf = requestAnimationFrame(step);
    };
    const setZoomAt = (targetScale, anchorX, anchorY) => {
      if (!overlay) return;
      cancelZoomAnim();
      cancelWheelSnap();
      setRasterHint(true);
      const center = contentCenter();
      const next = clampScale(targetScale, zoomCap());
      const z = zoomTowards({ scale, tx, ty, nextScale: next, dx: anchorX - center.x, dy: anchorY - center.y });
      scale = z.scale;
      tx = z.tx;
      ty = z.ty;
      clampZoom();
      applyZoom();
    };
    const scheduleWheelSnap = () => {
      if (wheelSnapTimer !== null) clearTimeout(wheelSnapTimer);
      wheelSnapTimer = setTimeout(() => {
        wheelSnapTimer = null;
        if (gesture) return;
        const snapped = clampScale(Math.round(scale * 20) / 20, zoomCap());
        if (Math.abs(snapped - scale) < 1e-3) {
          setRasterHint(false);
          return;
        }
        const center = contentCenter();
        animateZoom(snapped, center.x, center.y);
      }, 160);
    };
    const wheelZoom = (event, anchorX, anchorY) => {
      if (!overlay) return;
      event.preventDefault();
      if (gesture && gesture.mode === "pan") return;
      cancelZoomAnim();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight || 1 : 1;
      const raw = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      if (!raw) return;
      const notches = -raw * unit / 100;
      const factor = Math.pow(event.shiftKey ? 1.2 : 1.08, notches);
      setZoomAt(clampScale(scale * factor, zoomCap()), anchorX, anchorY);
      scheduleWheelSnap();
    };
    const onStageWheel = (event) => wheelZoom(event, event.clientX, event.clientY);
    if (overlay) {
      let sliding = false;
      const scaleFromSlider = (event) => {
        const rect = zoomRange.getBoundingClientRect();
        if (!rect.width) return;
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const center = contentCenter();
        setZoomAt(sliderRatioToScale(ratio, fitPct()), center.x, center.y);
      };
      const onSliderDown = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        sliding = true;
        setRasterHint(true);
        zoomRange.focus({ preventScroll: true });
        try {
          zoomRange.setPointerCapture(event.pointerId);
        } catch (err) {
        }
        scaleFromSlider(event);
      };
      const onSliderMove = (event) => {
        if (sliding) scaleFromSlider(event);
      };
      const onSliderEnd = () => {
        sliding = false;
        setRasterHint(false);
      };
      const onSliderWheel = (event) => {
        const center = contentCenter();
        wheelZoom(event, center.x, center.y);
      };
      const onSliderKey = (event) => {
        const center = contentCenter();
        const step = (points) => points / Math.max(fitPct(), 1);
        const steps = { ArrowRight: step(5), ArrowUp: step(5), ArrowLeft: step(-5), ArrowDown: step(-5), PageUp: step(25), PageDown: step(-25) };
        if (event.key in steps) {
          event.preventDefault();
          event.stopPropagation();
          animateZoom(scale + steps[event.key], center.x, center.y);
        } else if (event.key === "Home") {
          event.preventDefault();
          event.stopPropagation();
          animateZoom(MIN_SCALE, center.x, center.y);
        } else if (event.key === "End") {
          event.preventDefault();
          event.stopPropagation();
          animateZoom(zoomCap(), center.x, center.y);
        }
      };
      const onZoomOut = () => {
        const center = contentCenter();
        animateZoom(scale - 25 / Math.max(fitPct(), 1), center.x, center.y);
      };
      const onZoomIn = () => {
        const center = contentCenter();
        animateZoom(scale + 25 / Math.max(fitPct(), 1), center.x, center.y);
      };
      const onZoomFit = () => {
        const center = contentCenter();
        animateZoom(MIN_SCALE, center.x, center.y);
      };
      listen(zoomRange, "pointerdown", onSliderDown);
      listen(zoomRange, "pointermove", onSliderMove);
      listen(zoomRange, "pointerup", onSliderEnd);
      listen(zoomRange, "pointercancel", onSliderEnd);
      listen(zoomRange, "wheel", onSliderWheel, { passive: false });
      listen(zoomRange, "keydown", onSliderKey);
      listen(zoomOutButton, "click", onZoomOut);
      listen(zoomInButton, "click", onZoomIn);
      listen(zoomFitButton, "click", onZoomFit);
      paintZoom();
    }
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
      slides.forEach((slide, i) => slide.setAttribute("aria-hidden", String(i !== current)));
    };
    const settle = (targetIndex, v0 = 0) => {
      const next = Math.max(0, Math.min(targetIndex, photos.length - 1));
      if (next !== current) resetZoom();
      current = next;
      paintButtons();
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
      const response = 0.34;
      const omega = 2 * Math.PI / response;
      const damping = Math.abs(v0) > 300 ? 0.85 : 1;
      velocity = v0;
      const step = (now) => {
        const dt = lastFrameAt ? Math.min((now - lastFrameAt) / 1e3, 1 / 30) : 1 / 60;
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
    if (prevButton) listen(prevButton, "click", () => show(current - 1));
    if (nextButton) listen(nextButton, "click", () => show(current + 1));
    const frameRatio = framePhoto.width && framePhoto.height ? framePhoto.height / framePhoto.width : 0;
    const wrapper = () => stage.parentElement;
    let resizeObserver = null;
    let observedBox = null;
    const syncFrame = () => {
      if (!overlay) return;
      const box = wrapper();
      if (!box || !box.clientWidth || !box.clientHeight) return;
      if (resizeObserver && observedBox !== box) {
        if (observedBox) resizeObserver.unobserve(observedBox);
        resizeObserver.observe(box);
        observedBox = box;
      }
      const lightbox = shell == null ? void 0 : shell.parentElement;
      const narrow = ((lightbox == null ? void 0 : lightbox.clientWidth) || box.clientWidth) < 520 || box.clientWidth < 360;
      shell.classList.toggle("is-narrow", narrow);
      const availableWidth = box.clientWidth - (narrow ? 24 : 0);
      const availableHeight = box.clientHeight;
      if (availableWidth <= 0 || availableHeight <= 0) return;
      let width2 = availableWidth;
      let height = frameRatio ? width2 * frameRatio : availableHeight;
      if (height > availableHeight) {
        height = availableHeight;
        width2 = frameRatio ? height / frameRatio : availableWidth;
      }
      stage.style.width = `${Math.round(width2)}px`;
      stage.style.height = `${Math.round(height)}px`;
      shell.style.setProperty("--pv-bar-top", `${Math.max(0, Math.round((availableHeight - height) / 2))}px`);
      if (isZoomed()) {
        clampZoom();
        applyZoom();
      }
    };
    let resizeFrame = null;
    const onResize = () => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        if (gesture) return;
        syncFrame();
        x = targetOf(current);
        render();
      });
    };
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(onResize);
      if (wrapper()) {
        resizeObserver.observe(wrapper());
        observedBox = wrapper();
      }
    }
    syncFrame();
    const project = (v, deceleration = 0.998) => v / 1e3 * deceleration / (1 - deceleration);
    const rubberband = (overshoot, dimension, constant = 0.55) => overshoot * dimension * constant / (dimension + constant * Math.abs(overshoot));
    let gesture = null;
    let suppressClick = false;
    const pointers = /* @__PURE__ */ new Map();
    const beginSwipe = (event) => {
      stopAnim();
      const now = performance.now();
      gesture = { mode: "swipe", startX: event.clientX, base: x, samples: [[now, x]] };
      stage.classList.add("pv-x-media-dragging");
    };
    const beginPan = (event) => {
      cancelZoomAnim();
      gesture = { mode: "pan", startX: event.clientX, startY: event.clientY, baseTx: tx, baseTy: ty };
      stage.classList.add("pv-x-media-dragging");
    };
    const beginPinch = () => {
      cancelZoomAnim();
      cancelWheelSnap();
      setRasterHint(true);
      const [a, b] = [...pointers.values()];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const center = contentCenter();
      gesture = {
        mode: "pinch",
        dist0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        baseScale: scale,
        px: (midX - center.x - tx) / scale,
        py: (midY - center.y - ty) / scale
      };
      stage.classList.add("pv-x-media-dragging");
    };
    const onPointerDown = (event) => {
      if (event.target.closest("button, a")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (err) {
      }
      if (overlay) {
        if (pointers.size >= 2) {
          beginPinch();
          return;
        }
      } else if (pointers.size > 1) {
        return;
      }
      if (!overlay && photos.length < 2) return;
      if (isZoomed()) beginPan(event);
      else if (photos.length > 1) beginSwipe(event);
    };
    const onPointerMove = (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!gesture) return;
      if (gesture.mode === "pinch") {
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
      if (gesture.mode === "pan") {
        tx = gesture.baseTx + (event.clientX - gesture.startX);
        ty = gesture.baseTy + (event.clientY - gesture.startY);
        clampZoom();
        applyZoom();
        return;
      }
      const min = targetOf(photos.length - 1);
      const max = 0;
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
      if (gesture.mode === "pinch") {
        if (pointers.size >= 2) {
          beginPinch();
          return;
        }
        gesture = null;
        stage.classList.remove("pv-x-media-dragging");
        syncFrame();
        if (Math.abs(x - targetOf(current)) > 1) settle(current);
        if (!isZoomed()) {
          animateZoom(MIN_SCALE, contentCenter().x, contentCenter().y);
        } else if (pointers.size === 1) {
          const rest = [...pointers.values()][0];
          beginPan({ clientX: rest.x, clientY: rest.y });
        } else {
          setRasterHint(false);
        }
        return;
      }
      if (gesture.mode === "pan") {
        const pan = gesture;
        gesture = null;
        stage.classList.remove("pv-x-media-dragging");
        syncFrame();
        const moved = Math.abs(tx - pan.baseTx) > 6 || Math.abs(ty - pan.baseTy) > 6;
        if (moved) suppressClick = true;
        if (scale < 1.02) animateZoom(MIN_SCALE, contentCenter().x, contentCenter().y);
        else setRasterHint(false);
        return;
      }
      const samples = gesture.samples;
      const last = samples[samples.length - 1];
      const first = samples[0];
      const dt = last[0] - first[0];
      const v0 = dt > 0 ? (last[1] - first[1]) / dt * 1e3 : 0;
      const projected = x + project(v0);
      const targetIndex = Math.max(0, Math.min(Math.round(-projected / width()), photos.length - 1));
      suppressClick = Math.abs(x - gesture.base) > 6;
      gesture = null;
      stage.classList.remove("pv-x-media-dragging");
      settle(targetIndex, v0);
      syncFrame();
    };
    const onDoubleClick = (event) => {
      if (event.target.closest("button, a")) return;
      event.preventDefault();
      const center = contentCenter();
      if (isZoomed()) animateZoom(MIN_SCALE, center.x, center.y);
      else animateZoom(zoomCap(), event.clientX, event.clientY);
    };
    const destroy = () => {
      stopAnim();
      cancelZoomAnim();
      cancelWheelSnap();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = null;
      resizeObserver == null ? void 0 : resizeObserver.disconnect();
      resizeObserver = null;
      pointers.clear();
      gesture = null;
      for (const [target, type, handler, options] of boundListeners) target.removeEventListener(type, handler, options);
      boundListeners.length = 0;
    };
    const close = () => {
      destroy();
      onClose == null ? void 0 : onClose();
    };
    function onKey(event) {
      if (event.key === "Escape" && overlay) {
        event.stopPropagation();
        event.preventDefault();
        close();
      } else if (event.key === "ArrowRight" && photos.length > 1) {
        event.stopPropagation();
        event.preventDefault();
        show(current + 1);
      } else if (event.key === "ArrowLeft" && photos.length > 1) {
        event.stopPropagation();
        event.preventDefault();
        show(current - 1);
      } else if (overlay && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        animateZoom(scale + 25 / Math.max(fitPct(), 1), contentCenter().x, contentCenter().y);
      } else if (overlay && (event.key === "-" || event.key === "_")) {
        event.preventDefault();
        animateZoom(scale - 25 / Math.max(fitPct(), 1), contentCenter().x, contentCenter().y);
      } else if (overlay && event.key === "0") {
        event.preventDefault();
        animateZoom(MIN_SCALE, contentCenter().x, contentCenter().y);
      } else if ((event.key === "Enter" || event.key === " ") && !overlay && onZoom && event.target === stage) {
        event.preventDefault();
        onZoom(current, stage);
      }
    }
    const onInlineClick = (event) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (event.target.closest("button, a")) return;
      onZoom(current, stage);
    };
    listen(closeButton, "click", close);
    listen(keyHost, "keydown", onKey);
    listen(stage, "pointerdown", onPointerDown);
    listen(stage, "pointermove", onPointerMove);
    listen(stage, "pointerup", onPointerUp);
    listen(stage, "pointercancel", onPointerUp);
    if (overlay) {
      listen(stage, "dblclick", onDoubleClick);
      listen(stage, "wheel", onStageWheel, { passive: false });
      for (const img of imgs) listen(img, "load", onImgLoad);
    } else if (onZoom) {
      listen(stage, "click", onInlineClick);
    }
    stage.appendChild(track);
    if (overlay) {
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
    x = targetOf(current);
    render();
    paintButtons();
    if (overlay) {
      paintZoom();
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
  function openMediaLightbox(anchor, photos, index, openUrl, returnFocus = null) {
    const root = anchor && anchor.closest && anchor.closest(".pv-x-reader") || anchor && anchor.parentElement;
    if (!root || !photos.length || root.querySelector(".pv-x-media-lightbox")) return;
    const layer = el("div", {
      class: "pv-x-media-lightbox",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "图片查看"
    });
    const openedAt = performance.now();
    let carousel = null;
    const close = () => {
      carousel == null ? void 0 : carousel.destroy();
      layer.remove();
      if (returnFocus && returnFocus.isConnected) {
        try {
          returnFocus.focus({ preventScroll: true });
        } catch (err) {
          returnFocus.focus();
        }
      }
    };
    carousel = createMediaCarousel(photos, { openUrl, variant: "overlay", startIndex: index, onClose: close });
    layer.appendChild(carousel.mount);
    layer.addEventListener("click", (event) => {
      if (performance.now() - openedAt < 300) return;
      const target = event.target;
      if (target === layer || target === carousel.mount) return close();
      if (target.classList && (target.classList.contains("pv-x-media-main") || target.classList.contains("pv-x-media-viewport"))) close();
    });
    root.appendChild(layer);
    carousel.syncFrame();
    try {
      carousel.stage.focus({ preventScroll: true });
    } catch (err) {
      carousel.stage.focus();
    }
  }
  function mediaGrid(model, { openUrl }) {
    const items = (model.media || []).slice(0, 4);
    if (!items.length) return null;
    const photos = items.filter((item) => item.type === "photo");
    const grid = el("div", { class: `pv-x-media pv-x-media-${items.length}` });
    if (items.length > 1 && photos.length === items.length) {
      const carousel = createMediaCarousel(photos, {
        openUrl,
        variant: "inline",
        onZoom: (index, stageNode) => openMediaLightbox(grid, photos, index, openUrl, stageNode)
      });
      grid.classList.add("pv-x-media-carousel");
      grid.appendChild(carousel.mount);
      carousel.syncFrame();
      return grid;
    }
    if (items.length === 1 && items[0].width && items[0].height) {
      grid.style.aspectRatio = `${items[0].width} / ${items[0].height}`;
    }
    for (const item of items) {
      if (item.type === "photo") {
        const button = el(
          "button",
          { class: "pv-x-media-item", type: "button", "aria-label": "放大图片" },
          el("img", { src: item.url, alt: item.altText || "", loading: "lazy" })
        );
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openMediaLightbox(grid, photos, photos.indexOf(item), openUrl, button);
        });
        grid.appendChild(button);
        continue;
      }
      const video = el("video", {
        class: "pv-x-video",
        poster: item.url || null,
        controls: "",
        playsinline: "",
        preload: "none"
      });
      const nativeHls = item.hlsUrl && typeof video.canPlayType === "function" && video.canPlayType("application/vnd.apple.mpegurl");
      const source = item.videoUrl || (nativeHls ? item.hlsUrl : "");
      const wrapper = el("div", { class: "pv-x-media-item pv-x-media-video" });
      if (source) {
        video.src = source;
        wrapper.appendChild(video);
      } else {
        wrapper.appendChild(el("img", { class: "pv-x-video-poster", src: item.url, alt: item.altText || "", loading: "lazy" }));
        wrapper.appendChild(
          el("a", { class: "pv-x-video-open", href: openUrl, target: "_blank", rel: "noreferrer", text: "在 X 播放" })
        );
      }
      grid.appendChild(wrapper);
    }
    return grid;
  }
  function quoteCard(model, { bindProfile = null } = {}) {
    const quote = model.quote;
    if (!quote) return null;
    const url = openUrlOf(quote);
    const article = quote.attachment && quote.attachment.type === "article" ? quote.attachment : null;
    const card = el("div", { class: "pv-x-quote", role: "link", tabindex: "0", "aria-label": "在新窗口打开引用的帖子" });
    const main = el("div", { class: "pv-x-quote-main" });
    const head = el("div", { class: "pv-x-quote-head" });
    if (quote.author.avatar) {
      head.appendChild(el("img", { class: "pv-x-quote-avatar", src: quote.author.avatar, alt: "", loading: "lazy" }));
    }
    const nameRow = el("div", { class: "pv-x-quote-name" });
    nameRow.appendChild(el("span", { class: "pv-x-quote-author", text: quote.author.name || quote.author.handle || "" }));
    if (quote.author.verified) {
      const badge2 = xIcon("verified");
      if (badge2) nameRow.appendChild(el("span", { class: "pv-x-badge" }, badge2));
    }
    if (quote.author.handle) nameRow.appendChild(el("span", { class: "pv-x-quote-handle", text: `@${quote.author.handle}` }));
    head.appendChild(nameRow);
    main.appendChild(head);
    if (article) {
      const titleRow = el("div", { class: "pv-x-quote-title" });
      titleRow.appendChild(el("span", { class: "pv-x-quote-tag", text: "长文" }));
      titleRow.appendChild(
        el("span", { class: "pv-x-quote-title-text", text: article.title || article.description || "（无标题长文）" })
      );
      main.appendChild(titleRow);
      if (article.title && article.description) {
        main.appendChild(el("div", { class: "pv-x-quote-text", text: article.description }));
      }
    } else if (displayText(quote)) {
      const body = el("div", { class: "pv-x-quote-text" });
      appendRichText(body, quote, bindProfile);
      main.appendChild(body);
    }
    card.appendChild(main);
    const thumb = article ? article.image : (quote.media || [])[0] && (quote.media || [])[0].url;
    if (thumb) {
      card.appendChild(el("img", { class: "pv-x-quote-media", src: thumb, alt: "", loading: "lazy" }));
    }
    const open = () => window.open(url, "_blank", "noopener");
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      event.preventDefault();
      open();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
    return card;
  }
  function renderPost(model, {
    threadLine = false,
    onAction = null,
    translation = null,
    bindProfile = null,
    compact = false,
    focal = false,
    onOpenComments = null
  } = {}) {
    const article = el("article", { class: compact ? "pv-x-post pv-x-post-compact" : "pv-x-post" });
    if (focal) article.classList.add("pv-x-post-focal");
    article.dataset.tweetId = model.id;
    article.dataset.threadNext = threadLine ? "true" : "false";
    const column = avatarColumn(model, { bindProfile });
    column.appendChild(el("span", { class: "pv-x-thread-line", "aria-hidden": "true" }));
    article.appendChild(column);
    const isArticle = model.attachment && model.attachment.type === "article";
    const main = el(
      "div",
      { class: "pv-x-main" },
      headNode(model, bindProfile, onOpenComments),
      displayText(model) || !isArticle ? textBlock(model, translation, bindProfile) : null,
      isArticle ? compact ? articleCard(model) : articleReader(model) : null,
      mediaGrid(model, { openUrl: openUrlOf(model) }),
      // 引用卡放最后：不夹在正文与图片之间
      quoteCard(model, { bindProfile }),
      actionsNode(model, onAction)
    );
    article.appendChild(main);
    return article;
  }
  function renderReply(model, { depth = model.depth, ...options } = {}) {
    const article = renderPost(model, { threadLine: false, ...options, compact: true });
    article.classList.add("pv-x-reply");
    article.style.setProperty("--pv-x-depth", String(Math.min(Number(depth) || 0, 3)));
    return article;
  }
  function syncThreadLines(nodes, modelOf) {
    for (let i = 0; i < nodes.length; i += 1) {
      const current = modelOf(nodes[i].dataset.tweetId);
      const next = i + 1 < nodes.length ? modelOf(nodes[i + 1].dataset.tweetId) : null;
      nodes[i].dataset.threadNext = threadContinues(current, next) ? "true" : "false";
    }
  }
  function sortControl(current, onSort) {
    const group = el("div", { class: "pv-x-sort", role: "group", "aria-label": "回复排序（仅已加载的回复）" });
    for (const sort of SORTS) {
      const button = el("button", {
        class: "pv-x-sort-btn",
        type: "button",
        "data-sort": sort.key,
        text: sort.label,
        "aria-pressed": sort.key === current ? "true" : "false"
      });
      button.addEventListener("click", () => onSort(sort.key, group));
      group.appendChild(button);
    }
    return group;
  }
  function paintSort(group, current) {
    if (!group) return;
    for (const button of group.querySelectorAll(".pv-x-sort-btn")) {
      button.setAttribute("aria-pressed", button.dataset.sort === current ? "true" : "false");
    }
  }
  function composer({ avatar, onSubmit, focalId, draftText = "", onDraftChange = null }) {
    const section = el("section", { class: "pv-x-composer" });
    const avatarHolder = el("span", { class: "pv-x-avatar pv-x-avatar-sm" });
    if (avatar) avatarHolder.appendChild(el("img", { src: avatar, alt: "" }));
    const input = el("textarea", { class: "pv-x-composer-input", rows: "1", placeholder: "发布你的回复", "aria-label": "回复内容" });
    if (draftText) input.value = draftText;
    const reportDraft = () => onDraftChange == null ? void 0 : onDraftChange(input.value, targetModel);
    const submit = el("button", { class: "pv-x-composer-submit", type: "button", text: "回复", disabled: "" });
    const hint = el("span", { class: "pv-x-composer-hint" });
    let targetModel = null;
    const targetRow = el("div", { class: "pv-x-composer-target" });
    const targetLabel = el("span", { class: "pv-x-composer-target-label" });
    const clearTarget = el("button", { class: "pv-x-composer-target-clear", type: "button", "aria-label": "取消回复这条", text: "✕" });
    targetRow.append(targetLabel, clearTarget);
    targetRow.hidden = true;
    clearTarget.addEventListener("click", () => setTarget(null));
    function setTarget(model) {
      targetModel = model && String(model.id) !== String(focalId) ? model : null;
      const who = targetModel && (targetModel.author && (targetModel.author.handle || targetModel.author.name) || "X 用户");
      if (targetModel) {
        targetLabel.textContent = `回复 @${who}`;
        targetRow.hidden = false;
      } else {
        targetRow.hidden = true;
      }
      input.setAttribute("aria-label", targetModel ? `回复 @${who} 的内容` : "回复内容");
      reportDraft();
      return targetModel;
    }
    const autoGrow = () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
    };
    input.addEventListener("input", () => {
      autoGrow();
      submit.disabled = !input.value.trim();
      reportDraft();
    });
    if (draftText) submit.disabled = !draftText.trim();
    const send = async () => {
      const text = input.value.trim();
      if (!text || submit.disabled) return;
      submit.disabled = true;
      hint.textContent = "正在发布…";
      try {
        await onSubmit(text, targetModel);
        input.value = "";
        autoGrow();
        hint.textContent = "";
        setTarget(null);
        reportDraft();
      } catch (err) {
        hint.textContent = `发布失败：${err && err.message ? err.message : err}`;
      } finally {
        submit.disabled = !input.value.trim();
      }
    };
    submit.addEventListener("click", send);
    input.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        send();
      }
    });
    section.append(
      avatarHolder,
      el("div", { class: "pv-x-composer-body" }, targetRow, input, el("div", { class: "pv-x-composer-foot" }, hint, submit))
    );
    return {
      node: section,
      setTarget,
      focus: () => input.focus(),
      // 挂到文档后再量高度（恢复草稿时 scrollHeight 在挂载前为 0）
      syncHeight: autoGrow
    };
  }
  function toastRegions() {
    return [
      el("div", { class: "pv-x-toast", role: "status", "aria-live": "polite", "data-kind": "status", "data-visible": "false" }),
      el("div", { class: "pv-x-toast", role: "alert", "aria-live": "assertive", "data-kind": "alert", "data-visible": "false" })
    ];
  }
  function notify(reader, message, tone = "error") {
    if (!reader) return;
    const kind = tone === "error" ? "alert" : "status";
    let toast = reader.querySelector(`.pv-x-toast[data-kind="${kind}"]`);
    if (!toast) {
      for (const region of toastRegions()) reader.appendChild(region);
      toast = reader.querySelector(`.pv-x-toast[data-kind="${kind}"]`);
    }
    for (const other of reader.querySelectorAll(".pv-x-toast")) {
      if (other !== toast) other.dataset.visible = "false";
    }
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.dataset.visible = "true";
    clearTimeout(toast.__pvTimer);
    toast.__pvTimer = setTimeout(() => {
      toast.dataset.visible = "false";
    }, tone === "error" ? 5e3 : 3200);
  }
  function renderReader({
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
    draftText = "",
    onDraftChange = null
  }) {
    const reader = el("div", { class: "pv-x-reader" });
    const columns = el("div", { class: "pv-x-columns" });
    const postPane = el("section", { class: "pv-x-pane pv-x-pane-post", "aria-label": "帖子" });
    for (const ancestor of ancestors) {
      postPane.appendChild(
        renderPost(ancestor, {
          threadLine: true,
          onAction,
          bindProfile,
          translation: translationFor == null ? void 0 : translationFor(ancestor),
          compact: true
        })
      );
    }
    const focalNode = renderPost(focal, { threadLine: false, focal: true, onAction, bindProfile, translation: translationFor == null ? void 0 : translationFor(focal) });
    postPane.appendChild(focalNode);
    const countLabel = el("span", { class: "pv-x-reply-count", text: `回复 ${formatCount(replyCount)}` });
    const sort = onSort ? sortControl("relevant", onSort) : null;
    const tools = el(
      "div",
      { class: "pv-x-reply-tools" },
      el("div", { class: "pv-x-tools-left" }, countLabel, sort),
      el("a", { class: "pv-x-open", href: openUrl, target: "_blank", rel: "noreferrer", text: "在 X 打开" })
    );
    const replyPane = el("section", { class: "pv-x-pane pv-x-pane-replies", "aria-label": "回复" }, tools);
    const composerView = onSubmitReply ? composer({ avatar: composerAvatar, onSubmit: onSubmitReply, focalId: focal.id, draftText, onDraftChange }) : null;
    if (composerView) replyPane.appendChild(composerView.node);
    const list = el("div", { class: "pv-x-reply-list" });
    replyPane.appendChild(list);
    columns.append(postPane, replyPane);
    reader.append(columns, ...toastRegions());
    return { reader, columns, postPane, replyPane, tools, list, countLabel, composer: composerView, sort, focalNode };
  }

  // src/x/xCommentCard.js
  var CARD_WIDTH = 340;
  var CARD_GAP = 8;
  var CARD_MAX_HEIGHT = 340;
  var CARD_MIN_HEIGHT = 96;
  var SCROLL_CLOSE_DISTANCE = 24;
  function createCommentCard({
    getRoot,
    getBounds,
    load,
    onAction = null,
    bindProfile = null,
    onOpenExternal = null,
    replyCountOf = null
  }) {
    let layer = null;
    let card = null;
    let body = null;
    let head = null;
    let refreshButton = null;
    let anchorNode = null;
    let currentId = "";
    let refreshing = false;
    const cache2 = /* @__PURE__ */ new Map();
    let anchorTopAtPlace = null;
    let scrollRoot = null;
    const cardAction = onAction ? (key, model, node) => {
      if (key === "reply") close("reply");
      return onAction(key, model, node);
    } : null;
    const isOpen = () => Boolean(card);
    const place = () => {
      if (!card || !layer) return;
      const root = getRoot();
      const bounds = getBounds && getBounds();
      if (!root || !bounds) return;
      const rootRect = root.getBoundingClientRect();
      const paneWidth = bounds.right - bounds.left;
      if (paneWidth <= 0) return;
      const width = Math.max(180, Math.min(CARD_WIDTH, paneWidth - CARD_GAP * 2));
      card.style.width = `${Math.round(width)}px`;
      const paneRight = bounds.right - rootRect.left;
      const right = Math.max(rootRect.width - paneRight + CARD_GAP, CARD_GAP);
      card.style.right = `${Math.round(right)}px`;
      card.style.left = "auto";
      const paneTop = Math.max(bounds.top, rootRect.top) - rootRect.top;
      const paneBottom = Math.min(bounds.bottom, rootRect.bottom) - rootRect.top;
      const maxHeight = Math.max(CARD_MIN_HEIGHT, Math.min(CARD_MAX_HEIGHT, paneBottom - paneTop - CARD_GAP * 2));
      card.style.maxHeight = `${Math.round(maxHeight)}px`;
      const measured = Math.min(card.offsetHeight || 220, maxHeight);
      let top = paneTop + 8;
      let arrow = null;
      if (anchorNode && anchorNode.isConnected) {
        const anchorRect = anchorNode.getBoundingClientRect();
        const anchorCenter = anchorRect.left + anchorRect.width / 2 - rootRect.left;
        const anchorBottom = anchorRect.bottom - rootRect.top;
        const anchorTop = anchorRect.top - rootRect.top;
        const below = anchorBottom + 6;
        const above = anchorTop - 6 - measured;
        if (below + measured <= paneBottom - 8) {
          top = below;
          arrow = "up";
        } else if (above >= paneTop + 8) {
          top = above;
          arrow = "down";
        } else {
          top = Math.max(paneTop + 8, Math.min(below, paneBottom - 8 - measured));
        }
        const cardLeft = paneRight - right - width;
        const arrowLeft = Math.max(14, Math.min(anchorCenter - cardLeft, width - 14));
        card.style.setProperty("--pv-card-arrow-left", `${Math.round(arrowLeft)}px`);
      }
      const maxTop = paneBottom - 8 - measured;
      const finalTop = Math.max(paneTop + 8, Math.min(top, maxTop));
      card.style.top = `${Math.round(finalTop)}px`;
      card.dataset.arrow = arrow && Math.abs(finalTop - top) < 1 ? arrow : "none";
      anchorTopAtPlace = anchorNode && anchorNode.isConnected ? anchorNode.getBoundingClientRect().top : null;
    };
    const paintHead = (data) => {
      if (!head) return;
      head.replaceChildren();
      const count = data ? replyCountOf && data.post ? replyCountOf(data.post) : data.replies.length : 0;
      const title = el("span", { class: "pv-x-card-title" });
      title.appendChild(el("b", { text: data ? count ? `${formatCount(count)} 条回复` : "暂无回复" : "回复" }));
      if (data && data.at) title.appendChild(el("span", { class: "pv-x-card-when", text: `· ${sinceLabel(data.at)}` }));
      head.appendChild(title);
      refreshButton = el("button", {
        class: "pv-x-card-btn pv-x-card-refresh",
        type: "button",
        title: "重新读取",
        "aria-label": "重新读取"
      });
      const icon = svgIcon("refresh", { size: 13 });
      if (icon) refreshButton.appendChild(icon);
      refreshButton.addEventListener("click", () => refresh());
      head.appendChild(refreshButton);
      const closeButton = el("button", {
        class: "pv-x-card-btn pv-x-card-close",
        type: "button",
        title: "关闭",
        "aria-label": "关闭",
        text: "✕"
      });
      closeButton.addEventListener("click", () => close("button"));
      head.appendChild(closeButton);
    };
    const retryButton = (label) => {
      const button = el("button", { class: "pv-x-card-retry", type: "button", text: label });
      button.addEventListener("click", () => {
        const id = currentId;
        if (!id) return;
        cache2.delete(id);
        startLoad(id);
      });
      return button;
    };
    const paintBody = (data, error) => {
      if (!body) return;
      body.replaceChildren();
      body.removeAttribute("aria-busy");
      if (error) {
        body.appendChild(
          el(
            "div",
            { class: "pv-x-card-state pv-x-card-state-error", role: "alert" },
            el("span", { text: `读取失败：${error.message || error}` }),
            retryButton("重试")
          )
        );
        return;
      }
      if (!data) {
        body.setAttribute("aria-busy", "true");
        body.appendChild(
          el("div", { class: "pv-x-card-state pv-x-card-loading", role: "status" }, el("span", { class: "pv-x-card-spinner", "aria-hidden": "true" }), "正在读取回复…")
        );
        return;
      }
      if (!data.replies.length) {
        body.appendChild(el("div", { class: "pv-x-card-state", text: "这条还没有回复" }));
        return;
      }
      const depths = data.depths || /* @__PURE__ */ new Map();
      for (const reply of data.replies) {
        const depth = depths.has(reply.id) ? depths.get(reply.id) : reply.depth;
        body.appendChild(renderReply(reply, { onAction: cardAction, bindProfile, compact: true, depth }));
      }
      const byId = new Map(data.replies.map((reply) => [reply.id, reply]));
      syncThreadLines([...body.querySelectorAll(".pv-x-reply")], (id) => byId.get(id));
    };
    const paintFoot = (data) => {
      if (!card) return;
      const old = card.querySelector(".pv-x-card-foot");
      if (old) old.remove();
      const url = data && data.url;
      if (!url) return;
      const foot = el("a", {
        class: "pv-x-card-foot",
        href: url,
        target: "_blank",
        rel: "noreferrer",
        text: "在 X 打开 ›"
      });
      if (onOpenExternal) {
        foot.addEventListener("click", () => onOpenExternal(url));
      }
      card.appendChild(foot);
    };
    async function open(model, anchor) {
      const id = String(model && model.id || "");
      if (!id) return;
      if (card && currentId === id && anchor && anchor === anchorNode) {
        close("toggle");
        return;
      }
      if (anchorNode && anchorNode !== anchor) anchorNode.setAttribute("aria-expanded", "false");
      anchorNode = anchor || null;
      anchorNode == null ? void 0 : anchorNode.setAttribute("aria-expanded", "true");
      currentId = id;
      if (!card) mount();
      if (!card) return;
      place();
      const cached = cache2.get(id);
      if (cached) {
        paintHead(cached);
        paintBody(cached);
        paintFoot(cached);
        place();
        return;
      }
      await startLoad(id);
    }
    async function startLoad(id) {
      if (!card) return;
      paintHead(null);
      paintBody(null);
      paintFoot(null);
      place();
      try {
        const data = await fetchData(id);
        if (currentId !== id) return;
        paintHead(data);
        paintBody(data);
        paintFoot(data);
        place();
      } catch (err) {
        logger.warn("[xCommentCard] load failed", err);
        if (currentId === id) paintBody(null, err);
      }
    }
    async function fetchData(id) {
      const result = await load(id);
      const data = {
        at: Date.now(),
        post: result.post,
        replies: result.replies || [],
        depths: result.depths || null,
        url: result.url || ""
      };
      cache2.set(id, data);
      return data;
    }
    async function refresh() {
      var _a;
      const id = currentId;
      if (!id || refreshing) return;
      refreshing = true;
      refreshButton == null ? void 0 : refreshButton.classList.add("pv-x-card-busy");
      try {
        const data = await fetchData(id);
        if (currentId !== id || !card) return;
        paintHead(data);
        paintBody(data);
        paintFoot(data);
        place();
      } catch (err) {
        logger.warn("[xCommentCard] refresh failed", err);
        if (currentId === id && body) {
          (_a = body.querySelector(".pv-x-card-refresh-error")) == null ? void 0 : _a.remove();
          const note = el(
            "div",
            { class: "pv-x-card-state pv-x-card-state-error pv-x-card-refresh-error", role: "alert" },
            el("span", { text: `刷新失败：${err.message || err}` })
          );
          const again = el("button", { class: "pv-x-card-retry", type: "button", text: "重试" });
          again.addEventListener("click", () => refresh());
          note.appendChild(again);
          body.prepend(note);
        }
      } finally {
        refreshing = false;
        refreshButton == null ? void 0 : refreshButton.classList.remove("pv-x-card-busy");
      }
    }
    const onKeydown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      close("escape");
    };
    const onDocPointer = (event) => {
      if (!card) return;
      for (const node of eventPath(event)) {
        if (node === card || node === anchorNode) return;
        if (node && node.nodeType === 1 && node.classList && (node.classList.contains("pv-x-profile-card") || node.classList.contains("pv-x-media-lightbox"))) return;
      }
      close("outside");
    };
    const onRootScroll = (event) => {
      if (!card) return;
      const target = event.target;
      if (target && target.nodeType === 1) {
        if (card.contains(target)) return;
        if (target.closest && target.closest(".pv-x-profile-card, .pv-x-media-lightbox")) return;
      }
      if (anchorNode && anchorNode.isConnected && anchorTopAtPlace !== null) {
        const moved = Math.abs(anchorNode.getBoundingClientRect().top - anchorTopAtPlace);
        if (moved < SCROLL_CLOSE_DISTANCE) return;
      }
      close("scroll");
    };
    function mount() {
      const root = getRoot();
      if (!root) return;
      layer = el("div", { class: "pv-x-card-layer" });
      card = el("div", { class: "pv-x-card", role: "dialog", "aria-label": "回复", tabindex: "-1" });
      head = el("div", { class: "pv-x-card-head" });
      body = el("div", { class: "pv-x-card-body" });
      card.append(head, body);
      card.addEventListener("keydown", onKeydown);
      card.addEventListener("click", (event) => event.stopPropagation());
      layer.appendChild(card);
      root.appendChild(layer);
      scrollRoot = root;
      document.addEventListener("pointerdown", onDocPointer, true);
      scrollRoot.addEventListener("scroll", onRootScroll, { capture: true, passive: true });
      requestAnimationFrame(() => card && card.classList.add("visible"));
      try {
        card.focus({ preventScroll: true });
      } catch (err) {
        card.focus();
      }
    }
    const focusInside = (node) => {
      let active = node.getRootNode ? node.getRootNode().activeElement : document.activeElement;
      if (!active) active = document.activeElement;
      return Boolean(active && (active === node || node.contains(active)));
    };
    function close(reason = "button") {
      if (!card) return;
      const cardNode = card;
      const layerNode = layer;
      const trigger = anchorNode;
      const restoreFocus = reason !== "outside" && reason !== "reply" && reason !== "destroy" && reason !== "toggle" && (reason !== "scroll" || focusInside(cardNode));
      card = null;
      body = null;
      head = null;
      refreshButton = null;
      currentId = "";
      anchorNode = null;
      anchorTopAtPlace = null;
      layer = null;
      document.removeEventListener("pointerdown", onDocPointer, true);
      scrollRoot == null ? void 0 : scrollRoot.removeEventListener("scroll", onRootScroll, { capture: true });
      scrollRoot = null;
      trigger == null ? void 0 : trigger.setAttribute("aria-expanded", "false");
      if (restoreFocus && trigger && trigger.isConnected) {
        try {
          trigger.focus({ preventScroll: true });
        } catch (err) {
          trigger.focus();
        }
      }
      cardNode.classList.remove("visible");
      setTimeout(() => {
        cardNode.remove();
        if (layerNode) layerNode.remove();
      }, 160);
    }
    return {
      open,
      close,
      isOpen,
      current: () => currentId,
      /** 面板尺寸/布局变化后由调用方通知，重新夹紧位置 */
      reposition: place,
      /** 某条帖子的缓存失效（例如刚给它发了回复） */
      invalidate(id) {
        cache2.delete(String(id || ""));
      },
      destroy() {
        cache2.clear();
        close("destroy");
      }
    };
  }

  // src/loaders/XThreadLoader.js
  var SINGLE_COLUMN_WIDTH = 640;
  var COUNT_BY_ACTION2 = { reply: "replies", repost: "reposts", like: "likes", bookmark: "bookmarks" };
  var ACTION_LABEL = { like: "点赞", repost: "转推", bookmark: "收藏" };
  var TARGET_LANGUAGE = "zh-cn";
  var MAX_TRANSLATION_CONCURRENCY = 2;
  function currentAccount() {
    const button = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    const img = button && button.querySelector("img");
    const text = String(button && button.innerText || "");
    const handleMatch = text.match(/@([A-Za-z0-9_]+)/);
    const name = text.split("\n").map((line) => line.trim()).find((line) => line && !line.startsWith("@")) || "";
    return {
      avatar: img && (img.currentSrc || img.src) || "",
      handle: handleMatch ? handleMatch[1] : "",
      name
    };
  }
  var XThreadLoader = class {
    /**
     * @param {Object} ctx { url, container, onError, onLoad }
     * @returns {Function} abort
     */
    load({ url, container, onError, onLoad }) {
      const tweetId = postIdFromUrl(url);
      if (!tweetId) {
        onError("无法从链接解析出 X 帖子 ID。");
        return () => {
        };
      }
      const win = pageWindow();
      const bridge = installXBridge(win);
      if (!bridge) {
        onError("X 网络层未安装，请刷新 X 页面后重试。");
        return () => {
        };
      }
      const panel = container.closest && container.closest("#popup-content-panel") || null;
      const account = currentAccount();
      const replies = [];
      const seen = /* @__PURE__ */ new Set();
      const modelsById = /* @__PURE__ */ new Map();
      const listDepths = /* @__PURE__ */ new Map();
      const canonical = (model) => {
        if (!model || !model.id) return model;
        const existing = modelsById.get(model.id);
        if (existing) return mergeModel(existing, model);
        modelsById.set(model.id, model);
        return model;
      };
      let focalModel = null;
      let columnsEl = null;
      let sentinelState = "idle";
      let aborted = false;
      let cursor = null;
      let sortMode = "relevant";
      let loadingMore = false;
      let readerEl = null;
      let replyList = null;
      let countLabel = null;
      let sortGroup = null;
      let composerView = null;
      let resizeObserver = null;
      let sentinelObserver = null;
      let sentinel = null;
      let profileCard = null;
      let replyTarget = null;
      const translationCache = /* @__PURE__ */ new Map();
      const translationDisplay = /* @__PURE__ */ new Map();
      const translationQueue = [];
      const queuedKeys = /* @__PURE__ */ new Set();
      let activeTranslations = 0;
      let translationObserver = null;
      primeXIcons();
      applyXSkin([panel, container]);
      panel == null ? void 0 : panel.classList.add("pv-x-skin");
      container.classList.add("pv-x-reader-mode");
      const stopThemeWatch = watchXTheme((theme) => applyXSkin([panel, container], theme));
      const loadingView = showLoading(container, { title: "正在通过 X 会话读取帖子…" });
      container.replaceChildren(el("div", { class: "pv-x-loading-layer" }, loadingView));
      const syncLayout = () => {
        if (!readerEl) return;
        readerEl.classList.toggle("pv-x-single", container.clientWidth < SINGLE_COLUMN_WIDTH);
        profileCard == null ? void 0 : profileCard.reposition();
        commentCard == null ? void 0 : commentCard.reposition();
      };
      const scrollFocalIntoView = (focalNode, hasAncestors) => {
        if (!hasAncestors || !focalNode || !readerEl) return;
        const single = readerEl.classList.contains("pv-x-single");
        const scroller = single ? columnsEl : readerEl.querySelector(".pv-x-pane-post");
        if (!scroller) return;
        const offset = focalNode.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        scroller.scrollTop += offset;
      };
      const onReaderScroll = (event) => {
        const target = event.target;
        if (target && target.nodeType === 1 && target.closest && target.closest(".pv-x-profile-card, .pv-x-media-lightbox, .pv-x-card")) return;
        profileCard == null ? void 0 : profileCard.remove();
      };
      let disposed = false;
      const cleanup = () => {
        if (disposed) return;
        disposed = true;
        aborted = true;
        stopThemeWatch();
        readerEl == null ? void 0 : readerEl.removeEventListener("scroll", onReaderScroll, true);
        resizeObserver == null ? void 0 : resizeObserver.disconnect();
        resizeObserver = null;
        sentinelObserver == null ? void 0 : sentinelObserver.disconnect();
        sentinelObserver = null;
        translationObserver == null ? void 0 : translationObserver.disconnect();
        translationObserver = null;
        profileCard == null ? void 0 : profileCard.destroy();
        profileCard = null;
        commentCard == null ? void 0 : commentCard.destroy();
        translationQueue.length = 0;
        queuedKeys.clear();
        translationCache.clear();
        if (this.lastThread && this.lastThread.models === modelsById) this.lastThread = null;
        container.classList.remove("pv-x-reader-mode");
        panel == null ? void 0 : panel.classList.remove("pv-x-skin");
      };
      const expandPost = async (model) => {
        if (!model || model.expanding) return;
        model.expanding = true;
        refreshTranslation(model.id);
        try {
          const json = await bridge.readArticle(model.id);
          if (aborted) return;
          const full = fullTextFromPayload(json, model.id);
          if (!full) {
            model.needsExpand = false;
            notify(readerEl, "这条帖子没有更长的正文", "ok");
            return;
          }
          model.text = full.text;
          model.entities = full.entities;
          model.needsExpand = false;
          translationCache.delete(translationKey(model));
        } catch (err) {
          logger.warn("[XThreadLoader] expand full text failed", err);
          notify(readerEl, `展开全文失败：${err && err.message ? err.message : err}（可点「在 X 打开」看原文）`, "error");
        } finally {
          model.expanding = false;
          refreshTranslation(model.id);
        }
      };
      const hydrateArticle = async (model) => {
        var _a;
        if (!model || !model.attachment || model.attachment.type !== "article") return;
        if ((((_a = model.attachment.content) == null ? void 0 : _a.blocks) || []).length) return;
        try {
          const json = await bridge.readArticle(model.id);
          const content = articleContentFromPayload(json);
          if (content) model.attachment.content = content;
        } catch (err) {
          logger.warn("[XThreadLoader] article hydrate failed", err);
        }
      };
      const translationKey = (model) => `${model.id}:${TARGET_LANGUAGE}`;
      const refreshTranslation = (id) => {
        if (!readerEl) return;
        const model = modelsById.get(id);
        if (!model) return;
        for (const block of readerEl.querySelectorAll(`.pv-x-translatable[data-translation-id="${id}"]`)) {
          renderTextBlock(block, model, translationFor(model), bindProfile);
        }
      };
      const translationFor = (model) => ({
        offered: shouldOfferTranslation(model.text),
        entry: translationCache.get(translationKey(model)),
        // 默认自动显示译文（尚无「关闭自动翻译」设置项，用户可用「显示原文」逐条切回）
        display: translationDisplay.get(model.id) || "translation",
        onToggle: (next) => {
          translationDisplay.set(model.id, next);
          refreshTranslation(model.id);
        },
        onRetry: () => enqueueTranslation(model, true, true),
        onExpand: expandPost
      });
      const pumpTranslations = () => {
        if (aborted) return;
        while (activeTranslations < MAX_TRANSLATION_CONCURRENCY && translationQueue.length) {
          const model = translationQueue.shift();
          const key = translationKey(model);
          queuedKeys.delete(key);
          activeTranslations += 1;
          translationCache.set(key, { status: "loading" });
          refreshTranslation(model.id);
          bridge.translateTweet(model.id, TARGET_LANGUAGE).then((result) => {
            if (aborted) return;
            const text = String(result && result.text || "").trim();
            if (!text || text === String(model.text || "").trim()) {
              translationCache.set(key, { status: "unavailable" });
              return;
            }
            translationCache.set(key, {
              status: "ready",
              text,
              sourceLanguage: String(result.sourceLanguage || ""),
              localizedSourceLanguage: String(result.localizedSourceLanguage || ""),
              destinationLanguage: String(result.destinationLanguage || TARGET_LANGUAGE)
            });
          }).catch((error) => {
            if (aborted) return;
            translationCache.set(key, { status: "error", message: error && error.message ? error.message : "翻译失败" });
          }).finally(() => {
            activeTranslations -= 1;
            if (aborted) return;
            refreshTranslation(model.id);
            pumpTranslations();
          });
        }
      };
      const enqueueTranslation = (model, priority = false, force = false) => {
        if (!model || !shouldOfferTranslation(model.text)) return;
        const key = translationKey(model);
        const cached = translationCache.get(key);
        if (!force && cached && cached.status !== "error") return;
        if (force) translationCache.delete(key);
        if (queuedKeys.has(key)) return;
        queuedKeys.add(key);
        translationCache.set(key, { status: "queued" });
        if (priority) translationQueue.unshift(model);
        else translationQueue.push(model);
        refreshTranslation(model.id);
        pumpTranslations();
      };
      const observeTranslations = (nodes) => {
        if (aborted || !readerEl) return;
        const blocks = [];
        for (const node of nodes) {
          for (const block of node.querySelectorAll(".pv-x-translatable")) {
            if (block.__pvObserved) continue;
            block.__pvObserved = true;
            blocks.push(block);
          }
        }
        if (!blocks.length) return;
        if (typeof IntersectionObserver !== "function") {
          for (const block of blocks) enqueueTranslation(modelsById.get(block.dataset.translationId));
          return;
        }
        if (!translationObserver) {
          translationObserver = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                translationObserver == null ? void 0 : translationObserver.unobserve(entry.target);
                enqueueTranslation(modelsById.get(entry.target.dataset.translationId));
              }
            },
            { root: null, rootMargin: "180px 0px", threshold: 0.01 }
          );
        }
        for (const block of blocks) translationObserver.observe(block);
      };
      const applyFollowState = (author, result) => {
        if (result && result.confirmed === false) {
          for (const model of modelsById.values()) {
            if (model.author && String(model.author.id) === String(author.id)) model.author.followStateUnconfirmed = true;
          }
          author.followStateUnconfirmed = true;
          return;
        }
        const active = Boolean(result.following);
        const nextFollowers = Number.isFinite(result.followers) ? result.followers : Math.max(0, Number(author.followers || 0) + Number(active) - Number(Boolean(author.viewerFollowing)));
        for (const model of modelsById.values()) {
          if (!model.author || String(model.author.id) !== String(author.id)) continue;
          model.author.viewerFollowing = active;
          model.author.followStateUnconfirmed = false;
          model.author.followRequestSent = Boolean(result.followRequestSent);
          model.author.followers = nextFollowers;
        }
        author.viewerFollowing = active;
        author.followStateUnconfirmed = false;
        author.followRequestSent = Boolean(result.followRequestSent);
        author.followers = nextFollowers;
      };
      const bindProfile = (node, model) => {
        if (!profileCard || !model || !model.author || !model.author.id) return;
        profileCard.bind(node, model.author, profileUrlOf(model));
      };
      const sortedReplies = () => {
        if (sortMode === "relevant") return replies;
        const copy = [...replies];
        const likesOf = (model) => Number(model && model.counts && model.counts.likes) || 0;
        if (sortMode === "latest") copy.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        else copy.sort((a, b) => likesOf(b) - likesOf(a));
        return copy;
      };
      const updateCount = () => {
        if (!countLabel) return;
        const total = Math.max(Number(focalModel && focalModel.counts && focalModel.counts.replies) || 0, seen.size);
        countLabel.textContent = `回复 ${formatCount(total)}`;
        countLabel.title = `已加载 ${seen.size} 条`;
      };
      const replyNodes = /* @__PURE__ */ new Map();
      const replyNodeFor = (reply) => {
        let node = replyNodes.get(reply.id);
        if (!node) {
          node = renderReply(reply, {
            onAction: handleAction,
            bindProfile,
            // 评论列表里的每条评论都有「查看 N 条回复」入口：点它看这条评论自己的回复
            onOpenComments: openCommentsFor,
            translation: translationFor(reply),
            depth: listDepths.has(reply.id) ? listDepths.get(reply.id) : reply.depth
          });
          replyNodes.set(reply.id, node);
        }
        return node;
      };
      const placeReplies = () => {
        var _a;
        if (!replyList) return;
        const list = sortedReplies();
        const fresh = [];
        (_a = replyList.querySelector(":scope > .pv-x-empty")) == null ? void 0 : _a.remove();
        let ref = replyList.firstChild;
        for (const reply of list) {
          const isNew = !replyNodes.has(reply.id);
          const node = replyNodeFor(reply);
          if (isNew) fresh.push(node);
          if (node === ref) {
            ref = ref.nextSibling;
            continue;
          }
          replyList.insertBefore(node, ref);
        }
        if (sentinel && sentinel.parentNode !== replyList) replyList.appendChild(sentinel);
        else if (sentinel && replyList.lastChild !== sentinel) replyList.appendChild(sentinel);
        if (!list.length && !cursor) {
          replyList.insertBefore(el("div", { class: "pv-x-empty", text: "这条帖子暂时没有可显示的回复" }), sentinel || null);
        }
        syncThreadLines(list.map((reply) => replyNodes.get(reply.id)), (id) => modelsById.get(id));
        markReplyTarget();
        observeTranslations(fresh);
      };
      const setSentinel = (state, message = "") => {
        sentinelState = state;
        if (!replyList) return;
        if (!sentinel) {
          sentinel = el("div", { class: "pv-x-load-sentinel" });
          replyList.appendChild(sentinel);
        }
        sentinel.dataset.state = state;
        sentinel.removeAttribute("role");
        if (state === "loading") {
          sentinel.replaceChildren(el("span", { class: "pv-x-loading", text: "正在加载更多回复…" }));
          observeSentinel();
        } else if (state === "error") {
          sentinelObserver == null ? void 0 : sentinelObserver.disconnect();
          const retry = el("button", { class: "pv-x-load-retry", type: "button", text: "加载失败 · 重试", title: message || null });
          retry.addEventListener("click", () => {
            setSentinel("loading");
            loadMore();
          });
          sentinel.setAttribute("role", "alert");
          sentinel.replaceChildren(retry);
        } else if (state === "done") {
          sentinelObserver == null ? void 0 : sentinelObserver.disconnect();
          sentinel.replaceChildren(el("span", { class: "pv-x-load-done", text: `已显示全部 ${seen.size} 条` }));
        } else {
          sentinelObserver == null ? void 0 : sentinelObserver.disconnect();
          sentinel.replaceChildren();
        }
      };
      const settleSentinel = () => {
        if (cursor) setSentinel("loading");
        else setSentinel(seen.size ? "done" : "none");
      };
      const observeSentinel = () => {
        if (!sentinel || typeof IntersectionObserver !== "function") return;
        if (!sentinelObserver) {
          sentinelObserver = new IntersectionObserver(
            (entries) => {
              if (sentinelState === "loading" && entries.some((entry) => entry.isIntersecting)) loadMore();
            },
            { root: null, rootMargin: "0px 0px 240px 0px", threshold: 0.01 }
          );
        }
        sentinelObserver.unobserve(sentinel);
        sentinelObserver.observe(sentinel);
      };
      const markReplyTarget = () => {
        if (!readerEl) return;
        for (const article2 of readerEl.querySelectorAll('article[data-reply-target="true"]')) {
          delete article2.dataset.replyTarget;
        }
        if (!replyTarget) return;
        const article = readerEl.querySelector(`article[data-tweet-id="${replyTarget.id}"]`);
        if (article) article.dataset.replyTarget = "true";
      };
      const setReplyTarget = (model, { focus = true } = {}) => {
        replyTarget = model && String(model.id) !== String(tweetId) ? model : null;
        composerView == null ? void 0 : composerView.setTarget(replyTarget);
        markReplyTarget();
        if (focus) composerView == null ? void 0 : composerView.focus();
      };
      const onDraftChange = (text, target) => {
        if (target !== replyTarget) {
          replyTarget = target || null;
          markReplyTarget();
        }
        replyDrafts.set(tweetId, text, target);
      };
      const repaintActions = (model, key) => {
        if (!readerEl) return;
        for (const article of readerEl.querySelectorAll(`article[data-tweet-id="${model.id}"]`)) {
          const button = article.querySelector(`:scope > .pv-x-main > .pv-x-actions > .pv-x-action-${key}`);
          if (button) paintAction(button, model, key);
        }
      };
      const repaintReplies = (model) => {
        if (!readerEl || !model) return;
        for (const link of readerEl.querySelectorAll(`.pv-x-comment-entry[data-replies-for="${model.id}"]`)) {
          paintRepliesLink(link, model);
        }
        repaintActions(model, "reply");
      };
      const handleAction = async (key, model, button) => {
        if (key === "reply") {
          setReplyTarget(model);
          return;
        }
        if (String(model.id).startsWith("local-")) {
          notify(readerEl, "这条回复还在同步，请稍后刷新再操作", "info");
          return;
        }
        if (key === "share") {
          const target = openUrlOf(model);
          try {
            await navigator.clipboard.writeText(target);
            notify(readerEl, "链接已复制", "ok");
          } catch (err) {
            notify(readerEl, `复制失败：${target}`, "error");
          }
          return;
        }
        const flag = FLAG_BY_ACTION[key];
        const countKey = COUNT_BY_ACTION2[key];
        if (!flag || !countKey) return;
        const wasActive = Boolean(model.flags[flag]);
        model.flags[flag] = !wasActive;
        model.counts[countKey] = Math.max(0, (Number(model.counts[countKey]) || 0) + (wasActive ? -1 : 1));
        paintAction(button, model, key);
        repaintActions(model, key);
        try {
          await bridge.toggleAction(key, model.id, wasActive);
        } catch (err) {
          logger.warn(`[XThreadLoader] ${key} failed`, err);
          model.flags[flag] = wasActive;
          model.counts[countKey] = Math.max(0, (Number(model.counts[countKey]) || 0) + (wasActive ? 1 : -1));
          paintAction(button, model, key);
          repaintActions(model, key);
          notify(readerEl, `${ACTION_LABEL[key] || key}失败：${err && err.message ? err.message : err}`, "error");
        }
      };
      const handleSort = (next, group) => {
        if (next === sortMode) return;
        sortMode = next;
        paintSort(group, next);
        placeReplies();
      };
      const commentCard = createCommentCard({
        getRoot: () => readerEl,
        // 卡片只在右栏内活动：位置由右栏 rect 反算并夹紧，结构上不会压到左侧主贴
        // 垂直方向夹在评论列表的可见部分里：卡片上沿不会越过回复框下沿
        getBounds: () => {
          if (!replyList || !readerEl) return null;
          const pane = readerEl.querySelector(".pv-x-pane-replies");
          const list = replyList.getBoundingClientRect();
          const paneRect = pane ? pane.getBoundingClientRect() : list;
          const scroller = (columnsEl && readerEl.classList.contains("pv-x-single") ? columnsEl : replyList).getBoundingClientRect();
          const tools = readerEl.querySelector(".pv-x-reply-tools");
          const toolsBottom = tools ? tools.getBoundingClientRect().bottom : scroller.top;
          return {
            top: Math.max(list.top, scroller.top, toolsBottom),
            bottom: Math.min(list.bottom, scroller.bottom),
            left: paneRect.left,
            right: paneRect.right
          };
        },
        bindProfile,
        onAction: handleAction,
        replyCountOf: (model) => Number(model && model.counts && model.counts.replies) || 0,
        load: async (id) => {
          const json = await bridge.readThread(String(id));
          if (aborted) throw new Error("已关闭");
          const summary = parseThreadSummary(json, String(id));
          if (!summary.focalFound || !summary.focal) throw new Error("X 没有返回这条回复");
          const depths = new Map(summary.replies.map((reply) => [reply.id, reply.depth]));
          const post = canonical(summary.focal);
          const cardReplies = summary.replies.map(canonical);
          post.counts.replies = Math.max(Number(post.counts.replies) || 0, cardReplies.length);
          repaintReplies(post);
          return { post, replies: cardReplies, depths, url: openUrlOf(post) };
        }
      });
      const openCommentsFor = (model, anchor) => {
        if (!model || !model.id) return;
        commentCard.open(model, anchor);
      };
      const submitReply = async (text, target) => {
        if (target && String(target.id).startsWith("local-")) throw new Error("这条回复还在同步，暂时不能回复它");
        const inReplyTo = target && target.id ? String(target.id) : tweetId;
        const json = await bridge.createReply(inReplyTo, text);
        replyDrafts.clear(tweetId);
        if (aborted) return;
        const targetDepth = target ? listDepths.has(target.id) ? listDepths.get(target.id) : Number(target.depth) || 0 : -1;
        const real = tweetFromCreateResponse(json);
        const posted = real ? canonical(real) : {
          id: `local-${Date.now()}`,
          text,
          entities: [],
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          author: { id: "", name: account.name || account.handle || "我", handle: account.handle, avatar: account.avatar, verified: false },
          counts: { replies: 0, likes: 0, reposts: 0, bookmarks: 0, views: 0 },
          flags: { liked: false, reposted: false, bookmarked: false },
          media: [],
          inReplyToId: inReplyTo
        };
        if (!real) modelsById.set(posted.id, posted);
        listDepths.set(posted.id, Math.min(targetDepth + 1, 3));
        const parent = target ? modelsById.get(String(target.id)) || target : focalModel;
        if (parent && parent.counts) {
          parent.counts.replies = (Number(parent.counts.replies) || 0) + 1;
          repaintReplies(parent);
        }
        if (target) commentCard.invalidate(target.id);
        if (!seen.has(posted.id)) {
          replies.unshift(posted);
          seen.add(posted.id);
        }
        sortMode = "relevant";
        paintSort(sortGroup, "relevant");
        updateCount();
        placeReplies();
        if (sentinelState === "done" || sentinelState === "none") settleSentinel();
        notify(readerEl, target ? `已回复 @${target.author && target.author.handle || ""}` : "回复已发布", "ok");
      };
      const loadMore = async () => {
        if (aborted || loadingMore || !cursor) return;
        loadingMore = true;
        const previousCursor = cursor;
        try {
          const json = await bridge.readThread(tweetId, previousCursor);
          if (aborted) return;
          const next = parseThreadSummary(json, tweetId);
          let added = 0;
          for (const reply of next.replies) {
            if (seen.has(reply.id)) continue;
            seen.add(reply.id);
            listDepths.set(reply.id, reply.depth);
            replies.push(canonical(reply));
            added += 1;
          }
          cursor = replyCursorAfterPage(previousCursor, next.cursor, added);
          updateCount();
          placeReplies();
          settleSentinel();
        } catch (err) {
          if (aborted) return;
          logger.warn("[XThreadLoader] load more failed", err);
          setSentinel("error", err && err.message ? err.message : String(err));
        } finally {
          loadingMore = false;
        }
      };
      (async () => {
        try {
          const json = await bridge.readThread(tweetId);
          if (aborted) return;
          const summary = parseThreadSummary(json, tweetId);
          if (!summary.focalFound) throw new Error("X 返回了数据，但没有找到这条原帖。");
          cursor = summary.cursor;
          focalModel = canonical(summary.focal);
          for (const ancestor of summary.ancestors) canonical(ancestor);
          for (const reply of summary.replies) {
            seen.add(reply.id);
            listDepths.set(reply.id, reply.depth);
            replies.push(canonical(reply));
          }
          await hydrateArticle(summary.focal);
          if (aborted) return;
          this.lastThread = { tweetId, models: modelsById };
          profileCard = createProfileCard({
            getRoot: () => readerEl,
            onToggleFollow: async (author, nextActive) => {
              const result = await bridge.toggleFollow(author.id, nextActive);
              applyFollowState(author, result);
              return result;
            },
            // ok / info / error 原样传：info 走礼貌播报，不再被当成错误
            onNotify: (message, tone) => notify(readerEl, message, tone || "error")
          });
          const draft = replyDrafts.get(tweetId);
          const built = renderReader({
            focal: focalModel,
            ancestors: summary.ancestors.map((ancestor) => modelsById.get(ancestor.id) || ancestor),
            replyCount: Math.max(Number(focalModel.counts && focalModel.counts.replies) || 0, seen.size),
            openUrl: openUrlOf(focalModel),
            onAction: handleAction,
            onSort: handleSort,
            onSubmitReply: submitReply,
            translationFor,
            bindProfile,
            composerAvatar: account.avatar,
            draftText: draft ? draft.text : "",
            onDraftChange
          });
          readerEl = built.reader;
          columnsEl = built.columns;
          replyList = built.list;
          countLabel = built.countLabel;
          sortGroup = built.sort;
          composerView = built.composer;
          container.replaceChildren(readerEl);
          syncLayout();
          if (typeof ResizeObserver === "function") {
            resizeObserver = new ResizeObserver(syncLayout);
            resizeObserver.observe(container);
          }
          composerView == null ? void 0 : composerView.syncHeight();
          if (draft && draft.target) {
            setReplyTarget(modelsById.get(draft.target.id) || draft.target, { focus: false });
          }
          updateCount();
          placeReplies();
          settleSentinel();
          enqueueTranslation(focalModel, true);
          for (const ancestor of summary.ancestors) enqueueTranslation(modelsById.get(ancestor.id), true);
          observeTranslations([built.postPane]);
          scrollFocalIntoView(built.focalNode, summary.ancestors.length > 0);
          readerEl.addEventListener("scroll", onReaderScroll, { capture: true, passive: true });
        } catch (err) {
          if (aborted) return;
          logger.warn("[XThreadLoader] read thread failed", err);
          container.classList.remove("pv-x-reader-mode");
          onError == null ? void 0 : onError(`${err && err.message ? err.message : err}（X 的接口会变动，可点下方按钮改用新标签页打开）`);
          return;
        }
        if (!aborted) onLoad == null ? void 0 : onLoad();
      })().catch((err) => {
        logger.warn("[XThreadLoader] unexpected failure", err);
      });
      return cleanup;
    }
    /**
     * 自检：当前阅读器里各帖子的正文状态。
     * 排查「长贴没显示全 / 该出『显示更多』却没出」时用它看真实数据。
     */
    diag() {
      const thread = this.lastThread;
      if (!thread) return "no thread loaded";
      const rows = [...thread.models.values()].slice(0, 12).map((model) => ({
        id: model.id,
        textLength: String(model.text || "").length,
        hasFullText: Boolean(model.hasFullText),
        needsExpand: Boolean(model.needsExpand),
        entities: (model.entities || []).length,
        tail: String(model.text || "").slice(-16)
      }));
      return { focalId: thread.tweetId, rows };
    }
  };

  // src/main.js
  var prefetch = new PrefetchManager(loaderManager);
  function registerAdapters() {
    siteManager.register(new DiscuzAdapter());
    siteManager.register(new TgbAdapter());
    siteManager.register(new LinuxAdapter());
    siteManager.register(new CiliAdapter());
    siteManager.register(new XAdapter());
  }
  var X_HOSTS = /(^|\.)(x|twitter)\.com$/i;
  function installXSupport() {
    if (!X_HOSTS.test(window.location.hostname)) return;
    loaderManager.register("xthread", new XThreadLoader());
    const win = pageWindow();
    const bridge = installXBridge(win);
    if (!bridge) return;
    const api = {
      captureState: () => captureState(),
      probe: async (tweetId) => {
        const started = Date.now();
        const json = await bridge.readThread(String(tweetId));
        return { ...parseThreadSummary(json, String(tweetId)), ms: Date.now() - started, state: captureState() };
      },
      probeRaw: (tweetId, cursor) => bridge.readThread(String(tweetId), cursor),
      hasOperation: (name) => Boolean(bridge.findOperation(name)),
      // 观感令牌自检：看 X 皮肤实际拿到的颜色/字体
      theme: () => readXTheme(),
      // 字体自检：对比弹窗正文与宿主 X 帖子正文的字体/字重/抗锯齿，并列出祖先链上的 transform
      fontDiag: () => {
        var _a;
        const describe = (node) => {
          if (!node) return null;
          const cs = getComputedStyle(node);
          const transforms = [];
          const faded = [];
          for (let current = node; current && current !== document.documentElement; current = current.parentElement) {
            const style = getComputedStyle(current);
            const where = current.id || current.className || current.tagName;
            if (style.transform && style.transform !== "none") transforms.push(`${where}: ${style.transform}`);
            if (style.opacity !== "1") faded.push(`${where}: opacity=${style.opacity}`);
            if (style.filter && style.filter !== "none") faded.push(`${where}: filter=${style.filter}`);
          }
          return {
            fontFamily: cs.fontFamily,
            fontWeight: cs.fontWeight,
            fontSize: cs.fontSize,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing,
            color: cs.color,
            opacity: cs.opacity,
            webkitFontSmoothing: cs.webkitFontSmoothing,
            textRendering: cs.textRendering,
            transforms,
            faded
          };
        };
        const panel = uiQuery("#popup-content-panel");
        return {
          mine: describe(uiQuery("#popup-content-area .pv-x-text")),
          xTweet: describe(document.querySelector('[data-testid="tweetText"]')),
          chirpLoaded: typeof ((_a = document.fonts) == null ? void 0 : _a.check) === "function" ? document.fonts.check('15px "TwitterChirp"') : "unsupported",
          panelTransform: panel ? getComputedStyle(panel).transform : null
        };
      },
      // 帖子级自检：各帖子正文长度 / 是否已拿全文 / 是否需要「显示更多」
      postDiag: () => {
        const loader = loaderManager.get("xthread");
        return loader && typeof loader.diag === "function" ? loader.diag() : "no xthread loader";
      },
      // 定位自检：面板是否被宿主页面的 transform / CSS 影响而无法居中
      positionDiag: () => {
        var _a;
        const panel = uiQuery("#popup-content-panel");
        const panelStyle = panel ? getComputedStyle(panel) : null;
        const rect = panel ? panel.getBoundingClientRect() : null;
        const bodyStyle = getComputedStyle(document.body);
        const htmlStyle = getComputedStyle(document.documentElement);
        return {
          panel: panelStyle ? {
            position: panelStyle.position,
            top: panelStyle.top,
            left: panelStyle.left,
            transform: panelStyle.transform,
            width: panelStyle.width,
            height: panelStyle.height
          } : null,
          rect: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
          viewport: { w: window.innerWidth, h: window.innerHeight, scrollY: Math.round(window.scrollY) },
          body: { transform: bodyStyle.transform, position: bodyStyle.position, width: bodyStyle.width },
          html: { transform: htmlStyle.transform, position: htmlStyle.position, width: htmlStyle.width },
          bodyHijacksFixed: hijacksFixed(document.body),
          htmlHijacksFixed: hijacksFixed(document.documentElement),
          mount: uiRoot() ? `shadow:${((_a = uiRoot().host.parentElement) == null ? void 0 : _a.tagName) || "?"}` : panel && panel.parentElement ? `${panel.parentElement.tagName}#${panel.parentElement.id}` : null
        };
      },
      // 样式自检：区分「整表没生效」（CSP 拦内联样式）与「只有 X 皮肤没生效」
      styleDiag: () => {
        const panel = uiQuery("#popup-content-panel");
        const area = uiQuery("#popup-content-area");
        const reader = uiQuery(".pv-x-reader");
        let xRulesFound = false;
        const shadow = uiRoot();
        const sheets = [
          ...Array.from(document.styleSheets),
          ...shadow ? Array.from(shadow.styleSheets || []).concat(shadow.adoptedStyleSheets || []) : []
        ];
        for (const sheet of sheets) {
          try {
            if (Array.from(sheet.cssRules).some((rule) => String(rule.selectorText || "").includes("pv-x-reader"))) {
              xRulesFound = true;
              break;
            }
          } catch (err) {
          }
        }
        return {
          hasPanel: Boolean(panel),
          panelPosition: panel ? getComputedStyle(panel).position : null,
          areaClasses: area ? Array.from(area.classList) : [],
          // 内容区第一个子元素的类名：pv-x-reader = 走了 X 渲染器；有 iframe = 走了抓取渲染
          areaFirstChildClass: area && area.firstElementChild ? area.firstElementChild.className : null,
          areaHtmlHead: area ? area.innerHTML.slice(0, 160) : null,
          hasIframe: Boolean(area && area.querySelector("iframe")),
          loaderModes: Object.keys(loaderManager.loaders),
          readerFound: Boolean(reader),
          readerDisplay: reader ? getComputedStyle(reader).display : null,
          adoptedSheets: "adoptedStyleSheets" in document ? document.adoptedStyleSheets.length : "unsupported",
          styleElementCount: document.querySelectorAll("style").length,
          xRulesFound
        };
      }
    };
    if (debugEnabled()) {
      try {
        win.__PV2_X__ = api;
      } catch (err) {
        logger.warn("[main] expose __PV2_X__ failed", err);
      }
    } else {
      win.__PV2_X__ = void 0;
    }
    logger.log("[PV2] X GraphQL 网络层已安装");
  }
  function applyForumMarker() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    if (siteManager.activeAdapters(hostname, pathname).some((a) => a.forumStyles)) {
      document.documentElement.classList.add("pv-forum");
    }
  }
  function setupEvents() {
    document.addEventListener(
      "click",
      (e) => {
        if (settingsManager.get().linkIntercept === false) {
          debugMark("click: intercept off");
          return;
        }
        try {
          const handled = siteManager.handleClick(e);
          debugMark("click: " + (handled ? "HANDLED" : "no-match"));
        } catch (err) {
          logger.error("[click] handleClick error", err);
          showErr("click", err);
        }
      },
      true
    );
    document.addEventListener(
      "mouseover",
      (e) => {
        if (settingsManager.get().linkIntercept === false) return;
        const target = e.target;
        if (!target || !target.closest) return;
        if (!target.closest("a, [data-topic-url], [data-href], td.suh, .popup-trigger, .xst")) return;
        const hostname = window.location.hostname;
        let candidate = null;
        try {
          candidate = siteManager.resolveCandidate(e);
        } catch (err) {
          logger.error("[mouseover] resolveCandidate error", err);
        }
        if (candidate) prefetch.schedule(candidate.url, hostname);
      },
      true
    );
    eventBus.on("open-page", ({ url, title }) => {
      try {
        debugMark("open-page: " + url);
        storageManager.addHistory({ url, title });
        popupManager.open({ url, title });
      } catch (err) {
        logger.error("[open-page] open error", err);
        showErr("open-page", err);
      }
    });
    eventBus.on("settings-changed", (settings) => {
      if (settings.windowMode === "float") {
        popupManager.hideOverlay();
      } else {
        popupManager.showOverlay();
      }
    });
  }
  function setupMenu() {
    const popup = popupManager.popup;
    const cornerRect = () => {
      const x = window.innerWidth - 20;
      const y = window.innerHeight - 20;
      return { left: x, right: x, top: y, bottom: y, width: 0, height: 0 };
    };
    gm.registerMenuCommand("打开设置", () => {
      const btn = popup.floatBtn;
      const visible = btn && !btn.classList.contains("hidden") && !btn.classList.contains("pv-float-off");
      popup.showSettingsNear(visible ? btn.getBoundingClientRect() : cornerRect());
    });
    gm.registerMenuCommand("在此站点点选链接", () => {
      var _a, _b;
      popup.ensure();
      popup.ensureRulesPanel();
      (_b = (_a = popup.rulesPanel) == null ? void 0 : _a.startPick) == null ? void 0 : _b.call(_a);
    });
    gm.registerMenuCommand("显示/隐藏右下角设置按钮（本站）", () => {
      const next = !settingsManager.get().hideFloatButton;
      settingsManager.set({ hideFloatButton: next });
      popup.applySettings(settingsManager.get());
    });
  }
  var observer = null;
  var debouncedRunEnhancements = null;
  function setupObserver() {
    debouncedRunEnhancements = debounce(
      () => siteManager.runEnhancements(),
      config.observer.debounceMs,
      { leading: true }
    );
    startObserver();
    debouncedRunEnhancements();
    return { runEnhancements: debouncedRunEnhancements, observer };
  }
  function startObserver() {
    if (observer || !debouncedRunEnhancements) return;
    observer = new MutationObserver(debouncedRunEnhancements);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function isInIframe() {
    try {
      return window.top !== window.self;
    } catch {
      return true;
    }
  }
  function isOwnPopupIframe() {
    try {
      if (window.__PV2_OWN_IFRAME__) return true;
      const fe = window.frameElement;
      return !!(fe && fe.id === "popup-panel-iframe");
    } catch {
      return false;
    }
  }
  function init() {
    if (isOwnPopupIframe()) {
      debugMark("skipped: own iframe");
      return;
    }
    settingsManager.load();
    if (isInIframe() && !settingsManager.get().allowInFrame) {
      debugMark("skipped: iframe");
      return;
    }
    popupManager.popup.applyTheme(settingsManager.get().theme);
    const buildUi = () => {
      try {
        popupManager.popup.ensure();
        debugMark("ui ready");
      } catch (err) {
        logger.error("[main] build UI error", err);
        showErr("build-ui", err);
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(buildUi, { timeout: 1200 });
    } else {
      setTimeout(buildUi, 0);
    }
    registerAdapters();
    installXSupport();
    applyForumMarker();
    setupEvents();
    setupObserver();
    if (!isInIframe()) setupMenu();
    debugMark("init ok");
    logger.log("Popup Viewer V2 已启用");
  }
  function safeInit() {
    if (window.__PV2_INIT__) return;
    window.__PV2_INIT__ = true;
    try {
      init();
    } catch (err) {
      logger.error("[main] init error", err);
      debugMark("init error: " + (err && err.message ? err.message : err));
    }
  }
  debugMark("main-body ok");
  function bootstrap() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", safeInit);
      setTimeout(() => {
        if (!window.__PV2_INIT__) safeInit();
      }, 1500);
    } else {
      safeInit();
    }
  }
  bootstrap();
})();
