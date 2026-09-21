// ==UserScript==
// @name          页内弹窗打开新帖
// @namespace     http://tampermonkey.net/
// @version       2.1.1
// @description   点击论坛帖子链接，在弹窗中加载内容 (插件化架构 V2)
// @author        cores
// @include       *://*/*
// @grant         GM_xmlhttpRequest
// @grant         GM_addStyle
// @grant         GM_getValue
// @grant         GM_setValue
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
      d.textContent = "[PV2] boot v" + (true ? "2.1.1" : "?");
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
    //   xThread: true → 走 X 专用 GraphQL 原生渲染（见 docs/plan-x-graphql.md）
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
    maxHistoryEntries: 100
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
        return fn({
          timeout: options.timeout || 15e3,
          ...options
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
        var _a;
        clearTimer();
        (_a = options.onerror) == null ? void 0 : _a.call(options, err);
      });
      if (controller) promise.abort = () => controller.abort();
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
            this.rules[host] = list.filter((r) => r && typeof r.selector === "string" && r.selector.trim()).map((r) => ({ selector: r.selector.trim() }));
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
      for (const rule of rules) {
        let el2 = null;
        try {
          el2 = event.target.closest ? event.target.closest(rule.selector) : null;
        } catch {
          el2 = null;
        }
        if (!el2) continue;
        const link = this._extractLink(el2);
        if (link) return link;
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
      var _a, _b;
      if ((_b = (_a = event.target).closest) == null ? void 0 : _b.call(_a, "#popup-content-panel")) return null;
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

  // src/utils/dom.js
  var ICON_PATHS = {
    article: {
      path: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>'
    },
    close: { path: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' },
    plus: { path: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>' },
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
  function mountUi(node) {
    const parent = pickMountPoint();
    if (parent) parent.appendChild(node);
    return parent;
  }

  // src/core/SettingsManager.js
  var KEY2 = "pv2:settings";
  var SITE_KEY = "pv2:siteSettings";
  var GLOBAL_KEYS = ["theme", "allowInFrame", "handedness", "mobileResize"];
  function defaultGlobal() {
    return { theme: "auto", allowInFrame: false, handedness: "right", mobileResize: true };
  }
  function defaultSite() {
    return {
      scrollbarVisible: config.popup.scrollbarVisible,
      panelSize: config.popup.defaultSize,
      windowMode: "coupled",
      linkIntercept: true,
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
      if (g && typeof g === "object") this.global = { ...defaultGlobal(), ...g };
      const all = gm.getValue(SITE_KEY, null);
      if (all && typeof all === "object" && all[this.siteKey]) {
        this.site = { ...defaultSite(), ...all[this.siteKey] };
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
      return { head, body: doc.body ? doc.body.innerHTML : "" };
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
  function renderIntoIframe({ html, url, container, sandboxAttrs, head = "", linkIntercept, loadingSelector = "#popup-panel-loading", onNavigate }) {
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
    iframeDoc.write(buildDocument(html, url, head));
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
        if (loc) onNavigate(loc.url, loc.title);
      }
    });
    if (iframeDoc.readyState === "complete") iframe.dispatchEvent(new Event("load"));
    [1500, 3500].forEach((delay) => setTimeout(runFixes, delay));
    return iframe;
  }
  function buildDocument(html, url, head = "") {
    const baseHref = buildBaseHref(url);
    return '<!DOCTYPE html><html><head><base href="' + baseHref + '"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Content</title>' + head + "</head><body>" + html + "</body></html>";
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
  function fixLinks(iframeDoc, linkIntercept) {
    const openNewTab = linkIntercept !== void 0 ? linkIntercept : settingsManager.get().linkIntercept !== false;
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
      container.appendChild(iframe);
      iframe.src = url;
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
          onError("网络请求失败");
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
          onError("网络请求失败");
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
      const openNewTab = linkIntercept !== void 0 ? linkIntercept : settingsManager.get().linkIntercept !== false;
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
      this.cache.set(url, { head: result.head, body: result.body, time: Date.now() });
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
      entry.promise.finally(() => this.inflight.delete(url));
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
            reject(new Error("网络请求失败"));
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
    const applyMove = () => {
      raf = null;
      if (!dragging || dragLocked) return;
      panel.style.left = `${startLeft + (lastX - startX)}px`;
      panel.style.top = `${startTop + (lastY - startY)}px`;
    };
    const finish = (commit) => {
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
      if (e.target.closest("button")) return;
      if (isFullScreen()) return;
      if (e.button !== 0) return;
      dragging = true;
      dragLocked = locked();
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      lastX = e.clientX;
      lastY = e.clientY;
      if (!dragLocked) {
        panel.style.transition = "none";
        panel.style.left = `${rect.left}px`;
        panel.style.top = `${rect.top}px`;
        panel.style.transform = "none";
        panel.classList.add("pv-dragging");
        document.body.style.cursor = "grabbing";
      }
      if (POINTER_EVENTS) {
        pointerId = e.pointerId;
        try {
          header.setPointerCapture(e.pointerId);
        } catch {
        }
      }
      e.preventDefault();
    });
    const move = (e) => {
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
    document.addEventListener(
      "wheel",
      (e) => {
        if (!panel || !panel.classList.contains("visible")) return;
        if (isFullScreen()) {
          e.preventDefault();
          e.stopPropagation();
        } else {
          const content = contentArea();
          if (content && content.contains(e.target)) {
            const { scrollTop, scrollHeight, clientHeight } = content;
            const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
            const canScroll = scrollHeight > clientHeight;
            if (!canScroll || atBottom) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }
      },
      true
    );
  }

  // src/ui/Toolbar.js
  function createToolbar(handlers) {
    const actions = el("div", { id: "popup-panel-actions" });
    const makeBtn = (id, icon, title, onClick) => {
      const btn = el("button", { id, class: "popup-panel-btn", title, onclick: onClick });
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

  // src/ui/SettingsPanel.js
  function createSettingsPanel({ onChange, onManageRules, onClose }) {
    const SIZE_ORDER = ["small", "medium", "large", "phone"];
    const SIZE_LABELS = { small: "小", medium: "中", large: "大", phone: "手机" };
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
    document.body.appendChild(tipEl);
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
      if (e.target.closest(".pv-settings-tip") || e.target === tipEl) return;
      hideTip();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideTip();
    });
    const makeSeg = (order, labels, getKey, setKey, { icons = {}, defaultOf, onChange: onChange2, onSet } = {}) => {
      const btns = {};
      const group2 = el("div", { class: "pv-seg" });
      const sync = () => {
        const current = getKey();
        Object.entries(btns).forEach(([k, b]) => {
          b.classList.toggle("active", k === current);
          b.classList.toggle("is-default", !!defaultOf && k === defaultOf);
        });
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
      onSet: (k) => ({ panelSize: k, customSize: null })
    });
    const themeSeg = makeSeg(THEME_ORDER, THEME_LABELS, () => settingsManager.get().theme || "auto", "theme", {
      defaultOf: DEFAULT_THEME
    });
    const windowModeSeg = makeSeg(
      ["coupled", "float"],
      { coupled: "跟随页面", float: "独立悬浮" },
      () => settingsManager.get().windowMode || "coupled",
      "windowMode"
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
      if (!linkInterceptSwitch.checked) windowModeSeg.sync();
      persist();
    });
    const linkInterceptSwitchWrap = el("label", { class: "pv-switch" }, linkInterceptSwitch, el("span", { class: "pv-switch-track" }));
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
    const resetBtn = el("button", { type: "button", class: "pv-settings-reset", text: "恢复默认" });
    resetBtn.addEventListener("click", () => {
      settingsManager.reset();
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
    const closeBtn = el("button", { type: "button", class: "pv-settings-close", title: "关闭设置", onclick: () => onClose == null ? void 0 : onClose() });
    closeBtn.appendChild(svgIcon("close", { size: 14 }));
    const head = el(
      "div",
      { class: "pv-settings-head" },
      el("span", { class: "pv-settings-title", text: "设置" }),
      closeBtn
    );
    const group = (title) => el("div", { class: "pv-settings-group" }, el("div", { class: "pv-settings-group-title", text: title }));
    const titleCol = (label, sub, tip) => el(
      "div",
      { class: "pv-settings-title-col" },
      el(
        "div",
        { class: "pv-settings-label-line" },
        el("span", { class: "pv-settings-label", text: label }),
        tip ? makeTip(tip) : null
      ),
      sub ? el("div", { class: "pv-settings-sub", text: sub }) : null
    );
    const rowBlock = (label, sub, control, tip) => el(
      "div",
      { class: "pv-settings-item" },
      el("div", { class: "pv-settings-item-head" }, titleCol(label, sub, tip), control)
    );
    const colBlock = (label, sub, control, tip) => el(
      "div",
      { class: "pv-settings-item" },
      el("div", { class: "pv-settings-item-head" }, titleCol(label, sub, tip)),
      control
    );
    const sizeBlock = el(
      "div",
      { class: "pv-settings-item" },
      el("div", { class: "pv-settings-item-head" }, titleCol("窗体大小", "弹窗的默认尺寸")),
      sizeSeg.group,
      phoneModelsWrap
    );
    const commonTab = el("button", { type: "button", class: "pv-settings-tab active", text: "通用" });
    const mobileTab = el("button", { type: "button", class: "pv-settings-tab", text: "移动端" });
    const tabs = el("div", { class: "pv-settings-tabs" }, commonTab, mobileTab);
    const commonPane = el("div", { class: "pv-settings-pane active" });
    const mobilePane = el("div", { class: "pv-settings-pane" });
    const switchTab = (which) => {
      const isCommon = which === "common";
      commonTab.classList.toggle("active", isCommon);
      mobileTab.classList.toggle("active", !isCommon);
      commonPane.classList.toggle("active", isCommon);
      mobilePane.classList.toggle("active", !isCommon);
    };
    commonTab.addEventListener("click", () => switchTab("common"));
    mobileTab.addEventListener("click", () => switchTab("mobile"));
    commonPane.append(
      group("窗体行为"),
      colBlock("窗体驻留方式", "弹窗遮罩与页面交互", windowModeSeg.group, "跟随页面：弹窗带遮罩；独立悬浮：无遮罩、页面可交互，点击链接仍在弹窗内打开内容"),
      sizeBlock,
      rowBlock("窗体滚动条", "显示或隐藏窗体内的滚动条", scrollSwitchWrap),
      rowBlock("锁定窗体", "锁定后窗体不可拖动、不可缩放", lockSwitchWrap),
      group("交互控制"),
      rowBlock("页面链接拦截", "开启后页面链接在弹窗内打开", linkInterceptSwitchWrap, "开启：页面链接点击在弹窗内打开；关闭：页面链接原页面打开，窗体内容里的链接在窗体内部打开（禁止新标签页），窗体自动切换为独立悬浮"),
      rowBlock("链接规则", "拦截本站指定链接并在弹窗打开", manageRulesBtn, "规则按当前站点生效；点「取选」直接在页面上点一下链接即可生成，无需写选择器"),
      group("外观"),
      colBlock("外观主题", "跟随系统或手动指定", themeSeg.group),
      group("高级"),
      rowBlock("在 iframe 中运行", "默认关闭（等同 @noframes）", allowInFrameWrap, "风险：开启后脚本会在页面内所有 iframe 中运行（含广告、嵌入内容等），可能增加页面开销、出现多个悬浮按钮，或与嵌入页面产生样式冲突；仅在确有需要时开启。脚本自己的弹窗 iframe 始终跳过，不会套娃"),
      rowBlock("调试标记", "在页面左上角/右侧显示脚本运行状态与错误标记（下次刷新生效），仅排查问题时开启", debugSwitchWrap, "开启后每次刷新页面会显示：紫色 boot 版本、右侧模块加载序号、橙色初始化状态、红色错误信息；排查完请关闭")
    );
    mobilePane.append(
      group("移动端专属"),
      rowBlock("四角缩放把手", "触屏下窗体四角显示缩放把手，可自由调整窗体大小", mobileResizeSwitchWrap),
      colBlock("惯用手", "左手：工具栏镜像，关闭按钮移到左上角（移动端单手使用）", handednessSeg.group)
    );
    return el(
      "div",
      { id: "popup-settings-popover" },
      head,
      tabs,
      commonPane,
      mobilePane,
      el("div", { class: "pv-settings-footer" }, resetBtn)
    );
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
    list.sort((a, b) => {
      const score = (c) => {
        if (c.count >= 2 && c.count <= 200) return 0;
        if (c.count === 1) return 2;
        if (c.count > 200 && c.count <= 800) return 1;
        return 3;
      };
      const d = score(a) - score(b);
      if (d) return d;
      return a.sel.length - b.sel.length;
    });
    return list.slice(0, 8);
  }

  // src/ui/ElementPicker.js
  function pickElement() {
    return new Promise((resolve) => {
      let done = false;
      let phase = "hover";
      let hoverEl = null;
      let cands = [];
      const overlay = el("div", { class: "pv-picker-overlay" });
      const hint = el("div", { class: "pv-picker-bar", id: "pv-picker-hint" });
      const highlight = el("div", { class: "pv-picker-highlight hidden" });
      const cTitle = el("div", { class: "pv-picker-c-title", text: "确认选择器" });
      const cCands = el("div", { class: "pv-picker-cands" });
      const cInput = el("input", { type: "text", class: "pv-picker-input", placeholder: "可手动改写选择器" });
      const cMeta = el("div", { class: "pv-picker-c-meta" });
      const okBtn = el("button", { type: "button", class: "pv-picker-btn primary", text: "确认" });
      const againBtn = el("button", { type: "button", class: "pv-picker-btn", text: "重新选" });
      const cancelBtn = el("button", { type: "button", class: "pv-picker-btn", text: "取消" });
      const cBtns = el("div", { class: "pv-picker-c-btns" }, againBtn, cancelBtn, okBtn);
      const confirm = el("div", { class: "pv-picker-confirm hidden" }, cTitle, cCands, cInput, cMeta, cBtns);
      document.body.appendChild(overlay);
      document.body.appendChild(hint);
      document.body.appendChild(confirm);
      document.body.appendChild(highlight);
      overlay.style.pointerEvents = "none";
      hint.style.pointerEvents = "none";
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
        document.removeEventListener("touchend", onTouchEnd, true);
        window.removeEventListener("scroll", onRepaint, true);
        window.removeEventListener("resize", onRepaint, true);
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        hint.remove();
        confirm.remove();
        highlight.remove();
      }
      function isOwn(el2) {
        return !!el2 && !!el2.closest && el2.closest(
          '.pv-picker-overlay, .pv-picker-confirm, .pv-picker-bar, .pv-picker-highlight, [id^="popup-"], [id^="pv-"]'
        );
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
      function paint(el2) {
        const box = highlight;
        if (!el2 || !el2.getBoundingClientRect) {
          box.classList.add("hidden");
          return;
        }
        const r = el2.getBoundingClientRect();
        if (r.width < 1 && r.height < 1) {
          box.classList.add("hidden");
          return;
        }
        box.style.left = Math.max(0, r.left) + "px";
        box.style.top = Math.max(0, r.top) + "px";
        box.style.width = r.width + "px";
        box.style.height = r.height + "px";
        box.classList.remove("hidden");
      }
      function onRepaint() {
        if (phase === "hover" && hoverEl) paint(hoverEl);
      }
      function onMove(e) {
        if (phase !== "hover") return;
        const el2 = pickFromPoint(e.clientX, e.clientY);
        if (el2 === hoverEl) return;
        hoverEl = el2;
        paint(el2);
        if (el2) {
          const tag = el2.tagName.toLowerCase();
          const cls = Array.prototype.slice.call(el2.classList || []).filter(isStableClassName).slice(0, 2).join(".");
          hint.textContent = "取选：" + tag + (cls ? "." + cls : "") + (el2.id ? "#" + el2.id : "") + " · 单击选定 · Esc 取消";
        } else {
          hint.textContent = "取选：移动鼠标高亮，单击要拦截的链接 · Esc 取消";
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
      function showConfirm() {
        cCands.innerHTML = "";
        cands.forEach((c, i) => {
          const btn = el("button", { type: "button", class: "pv-picker-cand" + (i === 0 ? " is-on" : ""), title: c.note || "" });
          btn.appendChild(el("code", { text: c.sel }));
          btn.appendChild(el("em", { text: c.count + " 个" + (c.note ? " · " + c.note : "") }));
          btn.addEventListener("click", () => {
            cCands.querySelectorAll(".pv-picker-cand").forEach((b) => b.classList.remove("is-on"));
            btn.classList.add("is-on");
            cInput.value = c.sel;
            updateMeta(c.sel);
            try {
              const hit = document.body.querySelector(c.sel);
              if (hit) paint(hit);
            } catch {
            }
          });
          cCands.appendChild(btn);
        });
        cInput.value = cands[0].sel;
        updateMeta(cands[0].sel);
        confirm.classList.remove("hidden");
        cInput.focus();
        cInput.select();
      }
      function updateMeta(sel) {
        let n = 0;
        try {
          n = document.body.querySelectorAll(sel).length;
        } catch {
        }
        cMeta.textContent = "本页匹配 " + n + " 个元素";
      }
      function onClick(e) {
        if (e.target.closest(".pv-picker-confirm") || e.target.closest(".pv-picker-bar")) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        if (phase !== "hover") return;
        if (e.button != null && e.button !== 0) return;
        const el2 = pickFromPoint(e.clientX, e.clientY) || hoverEl;
        finishPick(el2);
      }
      function onTouchEnd(e) {
        if (phase !== "hover") return;
        if (e.target.closest(".pv-picker-confirm") || e.target.closest(".pv-picker-bar")) return;
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        let el2 = null;
        try {
          const t = e.changedTouches && e.changedTouches[0];
          if (t) el2 = pickFromPoint(t.clientX, t.clientY);
        } catch {
        }
        el2 = el2 || hoverEl;
        finishPick(el2);
      }
      function onKey(e) {
        if (e.key === "Escape") {
          if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
          finish(null);
        }
      }
      okBtn.addEventListener("click", () => {
        const v = cInput.value.trim();
        finish(v || null);
      });
      againBtn.addEventListener("click", () => {
        phase = "hover";
        confirm.classList.add("hidden");
        hint.classList.remove("hidden");
      });
      cancelBtn.addEventListener("click", () => finish(null));
      cInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const v = cInput.value.trim();
          finish(v || null);
        }
      });
      cInput.addEventListener("input", () => {
        const v = cInput.value.trim();
        if (v) updateMeta(v);
      });
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseover", onMove, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("touchend", onTouchEnd, true);
      window.addEventListener("scroll", onRepaint, true);
      window.addEventListener("resize", onRepaint, true);
      document.addEventListener("keydown", onKey, true);
      hint.textContent = "取选：移动鼠标高亮，单击要拦截的链接 · Esc 取消";
    });
  }

  // src/ui/RulesPanel.js
  function createRulesPanel() {
    const hostname = () => window.location.hostname;
    let picking = false;
    const backdrop = el("div", { id: "pv-rules-panel-backdrop", onclick: () => close() });
    const closeBtn = el("button", { type: "button", class: "popup-panel-btn", title: "关闭 (Esc)", onclick: () => close() });
    closeBtn.appendChild(svgIcon("close", { size: 15 }));
    const hostEl = el("span", { id: "pv-rules-host" });
    const header = el(
      "div",
      { id: "pv-rules-panel-header" },
      el("span", { class: "pv-rules-title", text: "链接规则" }),
      hostEl,
      closeBtn
    );
    const listEl = el("div", { id: "pv-rules-list" });
    const pickBtn = el(
      "button",
      { type: "button", id: "pv-rules-pick", onclick: () => startPick() },
      svgIcon("plus", { size: 14 }),
      el("span", { text: "取选新链接" })
    );
    const body = el(
      "div",
      { id: "pv-rules-panel-body" },
      el("div", { class: "pv-rules-tip", text: "点击「取选新链接」，在页面上点一下要拦截的帖子链接，即可自动生成规则（仅当前站点生效，弹窗打开）" }),
      listEl,
      pickBtn
    );
    const root = el("div", { id: "pv-rules-panel" }, header, body);
    const toastEl = el("div", { id: "pv-rules-toast" });
    document.body.appendChild(toastEl);
    let toastTimer = null;
    function toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("visible"), 1600);
    }
    function open() {
      root.classList.add("visible");
      backdrop.classList.add("visible");
      renderList();
      closeBtn.focus();
    }
    function close() {
      if (picking) return;
      root.classList.remove("visible");
      backdrop.classList.remove("visible");
      toastEl.classList.remove("visible");
    }
    function renderList() {
      listEl.innerHTML = "";
      const rules = rulesManager.getRules(hostname());
      hostEl.textContent = hostname() + "（" + rules.length + " 条）";
      if (!rules.length) {
        listEl.appendChild(el("div", { class: "pv-rules-empty", text: "还没有规则，点击「取选新链接」开始" }));
        return;
      }
      rules.forEach((r, i) => {
        const count = (() => {
          try {
            return document.querySelectorAll(r.selector).length;
          } catch {
            return 0;
          }
        })();
        const row = el("div", { class: "pv-rules-row" });
        const info = el(
          "div",
          { class: "pv-rules-row-info" },
          el("div", { class: "pv-rules-row-sel", text: r.selector }),
          el("div", { class: "pv-rules-row-count", text: "本页匹配 " + count + " 个链接" })
        );
        const del = el(
          "button",
          { type: "button", class: "pv-rules-del", title: "删除", onclick: (e) => {
            e.stopPropagation();
            confirmDelete(del, i);
          } },
          svgIcon("close", { size: 13 })
        );
        row.appendChild(info);
        row.appendChild(del);
        listEl.appendChild(row);
      });
    }
    function confirmDelete(btn, index) {
      if (btn.dataset.confirm === "1") {
        rulesManager.removeRule(hostname(), index);
        renderList();
        toast("已删除");
        return;
      }
      btn.dataset.confirm = "1";
      btn.classList.add("confirming");
      setTimeout(() => {
        btn.dataset.confirm = "";
        btn.classList.remove("confirming");
      }, 2200);
    }
    async function startPick() {
      if (picking) return;
      picking = true;
      pickBtn.disabled = true;
      root.classList.remove("visible");
      backdrop.classList.remove("visible");
      const selector = await pickElement();
      root.classList.add("visible");
      backdrop.classList.add("visible");
      picking = false;
      pickBtn.disabled = false;
      if (!selector) return;
      rulesManager.addRule(hostname(), selector);
      renderList();
      toast("已添加规则");
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && root.classList.contains("visible")) {
        e.stopImmediatePropagation();
        close();
      }
    });
    return { root, backdrop, open, close };
  }

  // src/ui/style.css
  var style_default = `/* ===== 站点样式隔离：抵御宿主网站全局 CSS 对脚本 UI 的干扰 ===== */\r
/* 用 @layer 将重置放入低优先级层，我们自己的样式(非 layer)始终覆盖它。\r
   只作用于脚本 UI 的"外壳"(头部/工具栏/底部/设置/悬浮按钮)，\r
   不碰 #popup-content-area，避免影响弹窗内打开的网站内容。\r
   注意：@layer 无法完全挡住宿主页面同源无层级规则，因此对固定尺寸容器\r
   额外补了无层级的 box-sizing 兜底。 */\r
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
  #pv-picker-overlay,\r
  #pv-picker-overlay *,\r
  .pv-picker-bar,\r
  .pv-picker-bar *,\r
  .pv-picker-confirm,\r
  .pv-picker-confirm *,\r
  .pv-picker-highlight {\r
    box-sizing: border-box;\r
    margin: 0;\r
    padding: 0;\r
    border: 0;\r
    outline: 0;\r
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
html.pv-forum .suh a,\r
html.pv-forum table tr td a,\r
html.pv-forum th.common a {\r
  cursor: pointer;\r
  transition: color 0.2s ease-in-out, text-shadow 0.2s ease-in-out;\r
  text-decoration: none;\r
  position: relative;\r
  color: inherit;\r
}\r
html.pv-forum .suh a:hover,\r
html.pv-forum table tr td a:hover,\r
html.pv-forum th.common a.xst:hover {\r
  color: var(--popup-accent);\r
  text-shadow: 0 0 5px rgba(37, 99, 235, 0.3);\r
}\r
\r
/* ===== 面板核心 ===== */\r
#popup-content-panel {\r
  position: fixed;\r
  z-index: var(--popup-z-index);\r
  overscroll-behavior: contain;\r
  background-color: var(--popup-surface);\r
  color: var(--popup-text);\r
  box-shadow: var(--popup-shadow);\r
  display: flex;\r
  flex-direction: column;\r
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\r
    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\r
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
  .pv-resize-knob {\r
    display: flex;\r
    align-items: center;\r
    justify-content: center;\r
    width: 36px;\r
    height: 36px;\r
    border-radius: 10px;\r
    border: 1px solid var(--popup-border);\r
    background-color: var(--popup-surface);\r
    color: var(--popup-muted);\r
    box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.25);\r
    transition: color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;\r
  }\r
  .pv-resize-knob:active {\r
    transform: scale(0.92);\r
    box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.3);\r
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
  font-size: 15px;\r
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
#popup-content-panel .popup-panel-btn {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  margin: 0;\r
  background-color: #00000012;\r
  background-color: var(--popup-btn-bg);\r
  border: 1px solid transparent;\r
  border-radius: 9px;\r
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
  color: #64748b;\r
  color: var(--popup-muted);\r
  transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out,\r
    transform 0.1s ease-in-out;\r
}\r
#popup-content-panel .popup-panel-btn svg {\r
  display: block;\r
  width: 16px;\r
  height: 16px;\r
  fill: none;\r
  stroke: currentColor;\r
  pointer-events: none;\r
}\r
#popup-content-panel .popup-panel-btn:hover {\r
  background-color: #00000020;\r
  background-color: var(--popup-btn-hover);\r
  color: #1a2233;\r
  color: var(--popup-text);\r
}\r
#popup-content-panel .popup-panel-btn:active {\r
  transform: scale(0.92);\r
  background-color: #0000002a;\r
  background-color: var(--popup-btn-active);\r
}\r
#popup-content-panel .popup-panel-btn:focus-visible {\r
  outline: 2px solid rgba(37, 99, 235, 0.4);\r
  outline: 2px solid var(--popup-focus-ring);\r
  outline-offset: 1px;\r
}\r
#popup-content-panel .popup-panel-btn.active {\r
  color: #2563eb;\r
  color: var(--popup-accent);\r
  background-color: rgba(37, 99, 235, 0.1);\r
  background-color: var(--popup-accent-soft);\r
}\r
#popup-panel-close:hover,\r
#popup-content-panel .popup-panel-btn#popup-panel-close:hover {\r
  color: #dc2626;\r
  color: var(--popup-danger);\r
  background-color: rgba(220, 38, 38, 0.1);\r
  background-color: var(--popup-danger-soft);\r
}\r
#popup-panel-refresh:hover,\r
#popup-panel-open-in-new:hover,\r
#popup-panel-maximize:hover,\r
#popup-content-panel .popup-panel-btn#popup-panel-refresh:hover,\r
#popup-content-panel .popup-panel-btn#popup-panel-open-in-new:hover,\r
#popup-content-panel .popup-panel-btn#popup-panel-maximize:hover {\r
  color: #2563eb;\r
  color: var(--popup-accent);\r
  background-color: rgba(37, 99, 235, 0.1);\r
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
  width: 280px;\r
  z-index: 10002;\r
  /* 桌面固定限高，避免内容增多后忽大忽小；内部滚动 */\r
  max-height: min(560px, calc(100vh - 32px));\r
  max-height: min(560px, calc(100dvh - 32px));\r
  overflow-y: auto;\r
  background-color: var(--popup-surface);\r
  color: var(--popup-text);\r
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\r
    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\r
  border: 1px solid var(--popup-border);\r
  border-radius: 12px;\r
  box-shadow: var(--popup-shadow);\r
  padding: 6px;\r
  box-sizing: border-box;\r
  font-size: 13px;\r
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
/* 设置面板：隐藏滚动条（保留滚动） */\r
#popup-settings-popover {\r
  scrollbar-width: none;\r
  -ms-overflow-style: none;\r
}\r
#popup-settings-popover::-webkit-scrollbar {\r
  display: none;\r
  width: 0;\r
  height: 0;\r
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
  position: sticky;\r
  top: 0;\r
  background-color: var(--popup-surface);\r
  z-index: 1;\r
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
.pv-settings-tab:hover {\r
  color: var(--popup-text);\r
  border-color: var(--popup-muted);\r
}\r
.pv-settings-tab.active {\r
  background-color: var(--popup-accent-soft);\r
  border-color: var(--popup-accent);\r
  color: var(--popup-accent);\r
  font-weight: 600;\r
}\r
.pv-settings-tab:focus-visible {\r
  outline: 2px solid var(--popup-focus-ring);\r
  outline-offset: 1px;\r
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
.pv-settings-close:hover {\r
  background-color: var(--popup-btn-hover);\r
  color: var(--popup-text);\r
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
  font-size: 11px;\r
  font-weight: 600;\r
  letter-spacing: 0.08em;\r
  color: var(--popup-faint);\r
  padding: 0 6px 6px;\r
}\r
.pv-settings-item {\r
  padding: 7px 6px;\r
  border-radius: 8px;\r
}\r
.pv-settings-item:hover {\r
  background-color: var(--popup-btn-hover);\r
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
  font-size: 11px;\r
  line-height: 1.4;\r
  color: var(--popup-faint);\r
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
  color: var(--popup-faint);\r
  cursor: pointer;\r
  flex: 0 0 auto;\r
}\r
.pv-settings-tip:hover {\r
  color: var(--popup-accent);\r
  background-color: var(--popup-accent-soft);\r
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
  z-index: 10005;\r
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
.pv-settings-reset:hover {\r
  color: var(--popup-danger);\r
  border-color: var(--popup-danger-soft);\r
  background-color: var(--popup-danger-soft);\r
}\r
.pv-settings-reset:focus-visible {\r
  outline: 2px solid var(--popup-focus-ring);\r
  outline-offset: 1px;\r
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
  background-color: var(--popup-btn-active);\r
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
  outline: 2px solid var(--popup-focus-ring);\r
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
.pv-seg-item:hover {\r
  color: var(--popup-text);\r
  border-color: var(--popup-muted);\r
}\r
.pv-seg-item.active {\r
  background-color: var(--popup-accent-soft);\r
  border-color: var(--popup-accent);\r
  color: var(--popup-accent);\r
  font-weight: 600;\r
}\r
.pv-seg-item.is-default.active::after {\r
  content: '';\r
  display: block;\r
  width: 4px;\r
  height: 4px;\r
  border-radius: 50%;\r
  background: currentColor;\r
  margin: 2px auto 0;\r
}\r
.pv-seg-item:focus-visible {\r
  outline: 2px solid var(--popup-focus-ring);\r
  outline-offset: 1px;\r
}\r
\r
/* ===== 链接规则面板 ===== */\r
#pv-rules-panel-backdrop {\r
  position: fixed;\r
  inset: 0;\r
  z-index: 10002;\r
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
  z-index: 10003;\r
  width: 440px;\r
  max-width: calc(100vw - 24px);\r
  max-height: calc(100vh - 48px);\r
  top: 50%;\r
  left: 50%;\r
  transform: translate(-50%, -48%) scale(0.97);\r
  background-color: var(--popup-surface);\r
  color: var(--popup-text);\r
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\r
    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\r
  border: 1px solid var(--popup-border);\r
  border-radius: 14px;\r
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
  font-size: 11px;\r
  color: var(--popup-faint);\r
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
  font-size: 11px;\r
  line-height: 1.5;\r
  color: var(--popup-faint);\r
}\r
#pv-rules-list {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 8px;\r
}\r
.pv-rules-empty {\r
  color: var(--popup-faint);\r
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
  font-size: 11px;\r
  color: var(--popup-faint);\r
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
.pv-rules-del:hover {\r
  color: var(--popup-danger);\r
  border-color: var(--popup-danger-soft);\r
  background-color: var(--popup-danger-soft);\r
}\r
.pv-rules-del.confirming {\r
  color: #fff;\r
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
  color: #fff;\r
  font-weight: 500;\r
  padding: 8px 16px;\r
  border-radius: 8px;\r
  cursor: pointer;\r
  transition: background 0.15s ease;\r
}\r
#pv-rules-pick:hover {\r
  background-color: var(--popup-accent-hover);\r
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
#pv-rules-panel .popup-panel-btn:hover {\r
  color: var(--popup-danger);\r
  background-color: var(--popup-danger-soft);\r
}\r
#pv-rules-toast {\r
  position: fixed;\r
  left: 50%;\r
  bottom: 28px;\r
  transform: translateX(-50%) translateY(8px);\r
  z-index: 10006;\r
  background-color: var(--popup-text);\r
  color: var(--popup-bg);\r
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\r
    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\r
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
/* ===== 取选链接模式 ===== */\r
.pv-picker-overlay {\r
  position: fixed;\r
  inset: 0;\r
  z-index: 10010;\r
  background-color: rgba(15, 23, 42, 0.35);\r
  pointer-events: none;\r
}\r
.pv-picker-bar {\r
  position: fixed;\r
  z-index: 10011;\r
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\r
    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\r
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
  z-index: 10011;\r
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\r
    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\r
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
.pv-picker-cand code {\r
  font-family: Consolas, 'Courier New', monospace;\r
  font-size: 11px;\r
}\r
.pv-picker-cand em {\r
  font-style: normal;\r
  color: var(--popup-faint);\r
  font-size: 11px;\r
}\r
.pv-picker-input {\r
  padding: 6px 9px;\r
  border: 1px solid var(--popup-border);\r
  border-radius: 8px;\r
  background-color: var(--popup-bg);\r
  color: var(--popup-text);\r
  font-family: Consolas, 'Courier New', monospace;\r
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
.pv-picker-btn:hover {\r
  color: var(--popup-accent);\r
  border-color: var(--popup-accent-soft);\r
  background-color: var(--popup-accent-soft);\r
}\r
.pv-picker-btn.primary {\r
  background-color: var(--popup-accent);\r
  border-color: var(--popup-accent);\r
  color: #fff;\r
  font-weight: 500;\r
}\r
.pv-picker-btn.primary:hover {\r
  background-color: var(--popup-accent-hover);\r
  color: #fff;\r
}\r
.pv-picker-highlight {\r
  position: fixed;\r
  z-index: 10012;\r
  pointer-events: none;\r
  border: 2px solid var(--popup-accent);\r
  border-radius: 4px;\r
  background-color: var(--popup-accent-soft);\r
  transition: left 0.08s ease, top 0.08s ease, width 0.08s ease, height 0.08s ease;\r
}\r
\r
/* ===== 独立悬浮设置按钮 ===== */\r
#pv-float-settings {\r
  position: fixed;\r
  right: 20px;\r
  /* 抬高到 iPhone 刘海屏 home 指示条安全区之上，避免被遮住/误触 */\r
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));\r
  z-index: 10001;\r
  width: 42px;\r
  height: 42px;\r
  padding: 0;\r
  border-radius: 50%;\r
  border: 1px solid var(--popup-border);\r
  background-color: var(--popup-surface);\r
  color: var(--popup-muted);\r
  box-shadow: 0 4px 16px -4px rgba(15, 23, 42, 0.25);\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  cursor: pointer;\r
  transition: transform 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;\r
}\r
#pv-float-settings svg {\r
  width: 18px;\r
  height: 18px;\r
  fill: none;\r
  stroke: currentColor;\r
  pointer-events: none;\r
}\r
#pv-float-settings:hover {\r
  color: var(--popup-accent);\r
  box-shadow: 0 6px 20px -4px rgba(15, 23, 42, 0.3);\r
}\r
#pv-float-settings:active {\r
  transform: scale(0.92);\r
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
  padding: 25px;\r
}\r
.spinner {\r
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
  font-size: 15px;\r
  font-weight: 500;\r
  color: var(--popup-text);\r
}\r
.pv-loading-sub {\r
  margin-top: 8px;\r
  font-size: 13px;\r
  color: var(--popup-faint);\r
}\r
\r
/* ===== 错误状态 ===== */\r
#popup-panel-error {\r
  padding: 35px;\r
  color: var(--popup-text);\r
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
  margin-top: 16px;\r
  margin-bottom: 10px;\r
  font-weight: 600;\r
  font-size: 1.15em;\r
}\r
#popup-panel-error p {\r
  margin-bottom: 24px;\r
  color: var(--popup-muted);\r
  max-width: 420px;\r
  line-height: 1.6;\r
  word-break: break-all;\r
}\r
#popup-panel-error button {\r
  padding: 10px 20px;\r
  background: var(--popup-accent);\r
  color: #fff;\r
  border: none;\r
  border-radius: 8px;\r
  cursor: pointer;\r
  font-weight: 500;\r
  font-size: 14px;\r
  transition: background 0.15s ease-in-out, transform 0.1s ease-in-out,\r
    box-shadow 0.15s ease-in-out;\r
}\r
#popup-panel-error button:hover {\r
  background: var(--popup-accent-hover);\r
  box-shadow: 0 4px 12px -4px var(--popup-focus-ring);\r
}\r
#popup-panel-error button:active {\r
  transform: scale(0.97);\r
}\r
#popup-panel-error button:focus-visible {\r
  outline: 2px solid var(--popup-focus-ring);\r
  outline-offset: 2px;\r
}\r
#popup-panel-error button:disabled {\r
  opacity: 0.5;\r
  cursor: not-allowed;\r
}\r
\r
/* ===== iframe ===== */\r
#popup-panel-iframe {\r
  width: 100%;\r
  height: 100%;\r
  border: none;\r
  background-color: #fff;\r
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
  font-size: 12px;\r
  color: var(--popup-faint);\r
}\r
#popup-panel-footer.empty {\r
  display: none;\r
}\r
.pv-footer-nav {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
}\r
#popup-panel-footer .popup-panel-btn {\r
  width: 28px;\r
  height: 28px;\r
  border-radius: 7px;\r
}\r
#popup-panel-footer .popup-panel-btn svg {\r
  width: 14px;\r
  height: 14px;\r
}\r
#popup-panel-footer .popup-panel-btn:disabled {\r
  opacity: 0.35;\r
  cursor: default;\r
  background-color: transparent;\r
  color: var(--popup-faint);\r
}\r
#popup-panel-footer .popup-panel-btn:disabled:hover {\r
  background-color: transparent;\r
  color: var(--popup-faint);\r
}\r
\r
/* ===== 链接视觉提示 ===== */\r
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
  transition: color 0.15s ease-in-out, padding-right 0.15s ease-in-out;\r
}\r
a.xst:hover {\r
  color: var(--popup-accent);\r
  padding-right: 30px;\r
}\r
a.xst::after {\r
  right: 0;\r
}\r
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
  z-index: 9998;\r
  transition: opacity 0.3s ease-in-out;\r
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
@media (prefers-reduced-motion: reduce) {\r
  #popup-content-panel,\r
  #popup-panel-overlay,\r
  #popup-settings-popover,\r
  #pv-rules-panel,\r
  #pv-rules-panel-backdrop,\r
  #pv-rules-toast,\r
  .pv-picker-bar,\r
  .pv-picker-confirm,\r
  .pv-picker-overlay,\r
  .pv-picker-highlight {\r
    transition: none;\r
  }\r
  .spinner {\r
    animation-duration: 1.6s;\r
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
  }\r
}\r
\r
/* ===== 触屏适配（pointer: coarse） ===== */\r
@media (pointer: coarse) {\r
  /* 加大触控目标到 44px 标准（页脚按钮除外：页脚高 38px，保持小尺寸防溢出） */\r
  #popup-content-panel .popup-panel-btn {\r
    width: 44px;\r
    height: 44px;\r
  }\r
  #popup-panel-footer .popup-panel-btn {\r
    width: 30px;\r
    height: 30px;\r
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
.pv-x-reader {\r
  position: relative;\r
  flex: 1;\r
  min-width: 0;\r
  min-height: 0;\r
  display: grid;\r
  grid-template-columns: minmax(0, 1.04fr) minmax(0, 0.96fr);\r
}\r
.pv-x-reader.pv-x-single {\r
  grid-template-columns: minmax(0, 1fr);\r
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);\r
}\r
.pv-x-pane {\r
  min-width: 0;\r
  min-height: 0;\r
}\r
/* 左栏：独立滚动，滚动条隐藏 */\r
.pv-x-pane-post {\r
  overflow-y: auto;\r
  overscroll-behavior: contain;\r
  scrollbar-width: none;\r
  -ms-overflow-style: none;\r
}\r
.pv-x-pane-post::-webkit-scrollbar {\r
  display: none;\r
}\r
/* 右栏：工具行与回复框固定，只有评论列表滚动 */\r
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
  scrollbar-width: none;\r
  -ms-overflow-style: none;\r
}\r
.pv-x-reply-list::-webkit-scrollbar {\r
  display: none;\r
}\r
.pv-x-pane-post {\r
  border-right: 1px solid var(--pv-x-border, #eff3f4);\r
}\r
.pv-x-reader.pv-x-single .pv-x-pane-post {\r
  border-right: none;\r
  border-bottom: 1px solid var(--pv-x-border, #eff3f4);\r
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
.pv-x-post:hover {\r
  background-color: var(--pv-x-hover, rgba(0, 0, 0, 0.03));\r
}\r
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
.pv-x-thread-line {\r
  flex: 1;\r
  width: 2px;\r
  min-height: 8px;\r
  margin-top: 4px;\r
  background-color: var(--pv-x-border, #eff3f4);\r
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
  font-weight: 700;\r
  color: var(--pv-x-fg, #0f1419);\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
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
  gap: 22px;\r
  margin-top: 10px;\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 13px;\r
}\r
.pv-x-action {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
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
.pv-x-post-compact .pv-x-actions {\r
  gap: 18px;\r
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
  background-color: var(--pv-x-accent, #1d9bf0);\r
  color: #fff;\r
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
.pv-x-loading {\r
  color: var(--pv-x-muted, #536471);\r
  font-size: 13px;\r
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
/* 覆盖式浮层：宽高同样由 JS 按浮层可用区域与首图比例算出 */\r
.pv-x-media-stage-overlay {\r
  cursor: default;\r
}\r
.pv-x-media-stage.pv-x-media-dragging {\r
  cursor: grabbing;\r
}\r
/* 覆盖式大图灯箱：用磨砂玻璃层而不是黑色遮罩 —— 不压黑，同时把背景内容压下去 */\r
.pv-x-media-lightbox {\r
  position: absolute;\r
  inset: 0;\r
  z-index: 6;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  padding: 12px;\r
  background-color: rgba(128, 128, 128, 0.28);\r
  -webkit-backdrop-filter: blur(14px) saturate(140%);\r
  backdrop-filter: blur(14px) saturate(140%);\r
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
.pv-x-media-counter,\r
.pv-x-media-open {\r
  color: #fff;\r
  font-size: 13px;\r
  text-decoration: none;\r
}\r
.pv-x-media-counter {\r
  opacity: 0.8;\r
}\r
.pv-x-media-open {\r
  opacity: 0.85;\r
}\r
.pv-x-media-open:hover {\r
  opacity: 1;\r
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
.pv-x-quote-media {\r
  flex: none;\r
  width: 56px;\r
  height: 56px;\r
  border: 1px solid var(--pv-x-border, #eff3f4);\r
  border-radius: 8px;\r
  object-fit: cover;\r
}\r
\r
/* 作者资料卡（悬停出现，与 X 一致） */\r
.pv-x-profile-trigger {\r
  cursor: pointer;\r
}\r
.pv-x-profile-card {\r
  /* 相对 .pv-x-reader 绝对定位：面板带 transform，fixed 的包含块会变成面板而非视口 */\r
  position: absolute;\r
  z-index: 6;\r
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
.pv-x-profile-follow[data-following='true']:hover {\r
  border-color: #f4212e;\r
  background-color: rgba(244, 33, 46, 0.1);\r
  color: #f4212e;\r
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
  /* 必须高于大图灯箱(6)与资料卡(6)：否则灯箱开着时「链接已复制」这类提示看不见 */\r
  z-index: 8;\r
}\r
.pv-x-toast[data-visible='true'] {\r
  opacity: 1;\r
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
`;

  // src/ui/PopupPanel.js
  var SNAP_TRANSFORM_RE = /^translate\(calc\(-50%/;
  var isSnapTransform = (value) => SNAP_TRANSFORM_RE.test(String(value || "").trim());
  var PopupPanel = class {
    constructor() {
      gm.addStyle(style_default);
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
    ensure() {
      if (this.panel) return this.panel;
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
          this.showSettingsNear(this.settingsBtn.getBoundingClientRect());
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
      const navGroup = el("div", { class: "pv-footer-nav" }, this.backBtn, this.forwardBtn);
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
      this.footer = el("div", { id: "popup-panel-footer" }, navGroup, this.footerLinkBtn);
      this.panel = el("div", { id: "popup-content-panel" }, header, this.contentArea, this.footer);
      mountUi(this.panel);
      this.floatBtn = el("button", { id: "pv-float-settings", title: "脚本设置" });
      this.floatBtn.appendChild(svgIcon("settings", { size: 16 }));
      this.floatBtn.addEventListener("click", () => {
        if (this.settingsPopover.classList.contains("visible")) {
          this.hideSettings();
          return;
        }
        this.showSettingsNear(this.floatBtn.getBoundingClientRect());
      });
      mountUi(this.floatBtn);
      this.settingsPopover = createSettingsPanel({
        onChange: (s) => this.applySettings(s),
        onManageRules: () => this.showRulesPanel(),
        onClose: () => this.hideSettings()
      });
      mountUi(this.settingsPopover);
      this.rulesPanel = createRulesPanel();
      mountUi(this.rulesPanel.backdrop);
      mountUi(this.rulesPanel.root);
      document.addEventListener("click", (e) => {
        var _a;
        if (!((_a = this.settingsPopover) == null ? void 0 : _a.classList.contains("visible"))) return;
        if (e.target.closest("#popup-settings-popover") || e.target.closest("#popup-panel-settings") || e.target.closest("#pv-float-settings")) {
          return;
        }
        this.hideSettings();
      });
      if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) {
        header.addEventListener("dblclick", (e) => {
          if (e.target.closest("button")) return;
          this.toggleFullScreen();
        });
      }
      this.contentArea.addEventListener("click", (e) => {
        var _a, _b, _c, _d;
        if (settingsManager.get().linkIntercept !== false) return;
        const link = (_b = (_a = e.target).closest) == null ? void 0 : _b.call(_a, "a[href]");
        if (!link) return;
        const href = link.getAttribute("href");
        if (!href || /^(javascript:|#)/i.test(href.trim())) return;
        e.preventDefault();
        e.stopPropagation();
        const url = link.href;
        (_d = (_c = this.handlers).onOpenInWindow) == null ? void 0 : _d.call(_c, url, (link.textContent || "").trim());
      });
      this._setupDrag(header);
      this._setupResize();
      this._setupKeyboard();
      return this.panel;
    }
    show(title, url) {
      var _a;
      debugMark("panel.show");
      this.ensure();
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
      this.isFullScreen = false;
      this.updateMaximizeIcon();
      this.applySettings(settingsManager.get());
      requestAnimationFrame(() => {
        this.panel.classList.add("visible");
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
      this.panel.classList.remove("visible");
      this.overlay.classList.remove("visible");
      (_c = (_b = this.handlers).onClose) == null ? void 0 : _c.call(_b);
      setTimeout(() => {
        this.contentArea.innerHTML = "";
        this.currentUrl = "";
      }, 350);
    }
    setTitle(text) {
      if (this.titleTextEl) this.titleTextEl.textContent = text || "查看内容";
    }
    updateFooterUrl(url) {
      var _a;
      if (this.footerLinkBtn) this.footerLinkBtn.title = url ? "在新标签页打开：" + url : "在新标签页打开";
      (_a = this.footer) == null ? void 0 : _a.classList.toggle("empty", !url);
    }
    /** 更新前进/后退按钮可用状态。 */
    setNavState(canBack, canForward) {
      if (this.backBtn) this.backBtn.disabled = !canBack;
      if (this.forwardBtn) this.forwardBtn.disabled = !canForward;
    }
    /**
     * 应用设置到面板：滚动条显隐 + 窗体大小预设 + 手机模式位置记忆。
     */
    applySettings(s) {
      var _a, _b, _c, _d, _e, _f, _g;
      this.ensure();
      const prevSize = this.currentPanelSize;
      const nextSize = s.panelSize || config.popup.defaultSize;
      this.currentPanelSize = nextSize;
      this.applyTheme(s.theme);
      this._setHandedness(s.handedness);
      (_a = this.panel) == null ? void 0 : _a.classList.toggle("pv-locked", s.locked === true);
      (_b = this.panel) == null ? void 0 : _b.classList.toggle("pv-no-mobile-resize", s.mobileResize === false);
      (_c = this.contentArea) == null ? void 0 : _c.classList.toggle("pv-hide-scrollbar", s.scrollbarVisible === false);
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
      (_d = this.panel) == null ? void 0 : _d.style.setProperty("--popup-width", width);
      (_e = this.panel) == null ? void 0 : _e.style.setProperty("--popup-height", height);
      if ((_f = this.panel) == null ? void 0 : _f.classList.contains("visible")) this._snapTransform();
      if (((_g = this.settingsPopover) == null ? void 0 : _g.classList.contains("visible")) && this._settingsAnchor) {
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
      const t = theme || "auto";
      const root = document.documentElement;
      root.classList.toggle("pv-theme-dark", t === "dark");
      root.classList.toggle("pv-theme-light", t === "light");
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
    showSettingsNear(rect) {
      var _a;
      const margin = 8;
      const pop = this.settingsPopover;
      this._settingsAnchor = rect;
      pop.style.maxHeight = "";
      pop.style.width = "";
      const popW = pop.offsetWidth || 280;
      const popH = pop.offsetHeight || 320;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spaceBelow = vh - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const isMobile = vw <= 560 || vh <= 560 || window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      let left;
      let top;
      if (popH <= spaceBelow) {
        top = rect.bottom + margin;
      } else if (popH <= spaceAbove) {
        top = rect.top - popH;
      } else if (isMobile) {
        top = margin;
        left = margin;
        pop.style.width = `${vw - margin * 2}px`;
        pop.style.maxHeight = `${vh - margin * 2}px`;
      } else {
        top = margin;
      }
      if (top < margin) top = margin;
      if (left === void 0) {
        left = rect.right - popW;
        if (left < margin) left = margin;
        if (left + popW > vw - margin) left = vw - margin - popW;
        if (left < margin) left = margin;
      }
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      pop.classList.add("visible");
      (_a = this.settingsBtn) == null ? void 0 : _a.classList.add("active");
    }
    hideSettings() {
      var _a, _b;
      (_a = this.settingsPopover) == null ? void 0 : _a.classList.remove("visible");
      (_b = this.settingsBtn) == null ? void 0 : _b.classList.remove("active");
    }
    showRulesPanel() {
      var _a;
      this.hideSettings();
      (_a = this.rulesPanel) == null ? void 0 : _a.open();
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
        Object.assign(this.panel.style, {
          width: "100vw",
          height: "100vh",
          top: "0px",
          left: "0px",
          transform: "none",
          borderRadius: "0px",
          maxWidth: "none",
          maxHeight: "none",
          zIndex: "10002"
        });
        void this.panel.offsetWidth;
        this.panel.style.transition = "";
        this.isFullScreen = true;
      } else {
        this.panel.style.transition = "none";
        Object.assign(this.panel.style, {
          width: this.preFullScreen.width || "",
          height: this.preFullScreen.height || "",
          top: this.preFullScreen.top || "",
          left: this.preFullScreen.left || "",
          transform: this.preFullScreen.transform || "",
          borderRadius: this.preFullScreen.borderRadius || "",
          maxWidth: this.preFullScreen.maxWidth || "",
          maxHeight: this.preFullScreen.maxHeight || "",
          zIndex: "10000"
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
    _setupKeyboard() {
      if (this._onKeydownBound) return;
      this._onKeydownBound = (e) => {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!this.panel || !this.panel.classList.contains("visible")) return;
        if (e.key === "Escape") {
          if ((_a = this.settingsPopover) == null ? void 0 : _a.classList.contains("visible")) {
            this.hideSettings();
            e.stopImmediatePropagation();
            return;
          }
          this.close();
        } else if (e.key === "ArrowLeft" && e.altKey) {
          e.preventDefault();
          (_c = (_b = this.handlers).onBack) == null ? void 0 : _c.call(_b);
        } else if (e.key === "ArrowRight" && e.altKey) {
          e.preventDefault();
          (_e = (_d = this.handlers).onForward) == null ? void 0 : _e.call(_d);
        } else if (e.key === "f" || e.key === "F") this.toggleFullScreen();
        else if (e.key === "r" || e.key === "R") {
          if (this.currentUrl && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            (_g = (_f = this.handlers).onRefresh) == null ? void 0 : _g.call(_f, this.currentUrl);
          }
        }
      };
      document.addEventListener("keydown", this._onKeydownBound);
      setupWheelScrollChain({
        panel: this.panel,
        contentArea: () => this.contentArea,
        isFullScreen: () => this.isFullScreen
      });
    }
  };

  // src/ui/Loading.js
  function showLoading(container, { title = "正在加载内容..." } = {}) {
    container.classList.remove("iframe-direct-load");
    const view = el(
      "div",
      { id: "popup-panel-loading" },
      el("div", { class: "spinner" }),
      el("div", { class: "pv-loading-hint", text: title }),
      el("div", { class: "pv-loading-sub", text: "请稍候片刻" })
    );
    container.replaceChildren(view);
    return view;
  }

  // src/ui/ErrorView.js
  function showError(container, message, url) {
    container.classList.remove("iframe-direct-load");
    const openBtn = el("button", { text: "在新标签页打开" });
    if (!url) {
      openBtn.disabled = true;
    } else {
      openBtn.addEventListener("click", () => window.open(url, "_blank", "noopener"));
    }
    const view = el(
      "div",
      { id: "popup-panel-error" },
      svg(
        '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
        { class: "pv-error-icon", width: 52, height: 52, "stroke-width": 1.5 }
      ),
      el("h3", { text: "加载失败" }),
      el("p", { text: message || "无法加载请求的内容" }),
      openBtn
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
          var _a;
          (_a = this._abort) == null ? void 0 : _a.call(this);
          this._abort = null;
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
      (_a = this._abort) == null ? void 0 : _a.call(this);
      this._abort = null;
      const contentArea = this.popup.getContentArea();
      contentArea.classList.remove("iframe-direct-load");
      contentArea.innerHTML = "";
      showLoading(contentArea);
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
          this._abort = null;
          showError(contentArea, message, url);
        },
        onLoad: () => {
          this._abort = null;
        },
        onNavigate: (navUrl, navTitle) => this._onInFrameNavigate(navUrl, navTitle)
      });
    }
    close() {
      var _a;
      (_a = this._abort) == null ? void 0 : _a.call(this);
      this._abort = null;
      this._navHistory = [];
      this._navIndex = -1;
      this._pendingNativeNav = false;
      clearTimeout(this._pendingNativeTimer);
      this._pendingNativeTimer = null;
      this._pendingRevertIndex = -1;
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
    clearHistory() {
      this._write(this.historyKey, []);
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
      entry.promise.finally(() => {
        var _a2;
        if (((_a2 = this._current) == null ? void 0 : _a2.url) === url) this._current = null;
      });
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
  var LIKE = "#f91880";
  var REPOST = "#00ba7c";
  var VAR_MAP = {
    bg: "--pv-x-bg",
    fg: "--pv-x-fg",
    muted: "--pv-x-muted",
    border: "--pv-x-border",
    soft: "--pv-x-soft",
    hover: "--pv-x-hover",
    accent: "--pv-x-accent",
    like: "--pv-x-like",
    repost: "--pv-x-repost",
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
      // 采样只保留来源可靠的几项：body 背景、帖子正文色、话题链接色、body 字体
      bg: bodyBg || base.bg,
      fg: firstComputed(['[data-testid="tweetText"]', 'article[data-testid="tweet"]'], "color") || base.fg,
      muted: mutedFor(mode),
      border: borderFor(mode),
      soft: base.soft,
      hover: base.hover,
      accent: firstComputed(['a[href^="/hashtag"]', 'a[href^="/i/hashtag"]'], "color") || ACCENT,
      like: LIKE,
      repost: REPOST,
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
  function formatCount(value) {
    const n = Number(value) || 0;
    if (n < 1e3) return String(n);
    if (n < 1e4) return `${(n / 1e3).toFixed(1)}K`;
    return `${(n / 1e4).toFixed(1)}万`;
  }
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
    const remove = () => {
      clearTimers();
      card == null ? void 0 : card.remove();
      card = null;
      cardKey = "";
      anchor = null;
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
      return node;
    };
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
      node.addEventListener("focus", () => show(author, href, node));
      node.addEventListener("blur", scheduleHide);
    };
    return {
      bind,
      remove,
      destroy: remove,
      // 弹窗尺寸变化后卡片位置会失效，重新贴回锚点
      reposition: () => {
        if (card && anchor) position(card, anchor);
      }
    };
  }

  // src/x/xRender.js
  var SORTS = [
    { key: "relevant", label: "相关" },
    { key: "latest", label: "最新" },
    { key: "liked", label: "最多喜欢" }
  ];
  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function formatCount2(value) {
    const n = Number(value) || 0;
    if (n < 1e3) return String(n);
    if (n < 1e4) return `${(n / 1e3).toFixed(1)}K`;
    return `${(n / 1e4).toFixed(1)}万`;
  }
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
  function headNode(model, bindProfile = null) {
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
      head.appendChild(el("time", { class: "pv-x-time", text: formatDate(model.createdAt) }));
    }
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
    if (flag) button.dataset.active = model.flags && model.flags[flag] ? "true" : "false";
    const countNode = button.querySelector(".pv-x-count");
    const countKey = COUNT_BY_ACTION[key];
    if (!countNode || !countKey) return;
    const value = countOf(model, countKey);
    countNode.textContent = value ? formatCount2(value) : "";
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
      if (spec.count) node.appendChild(el("span", { class: "pv-x-count", text: value ? formatCount2(value) : "" }));
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
    const stage = el("div", { class: `pv-x-media-stage pv-x-media-stage-${variant}`, tabindex: "-1" });
    if (framePhoto.width && framePhoto.height) stage.style.aspectRatio = `${framePhoto.width} / ${framePhoto.height}`;
    const track = el("div", { class: "pv-x-media-track" });
    const slides = photos.map((photo) => {
      const slide = el(
        "div",
        { class: "pv-x-media-slide" },
        el("img", { class: "pv-x-media-big", src: photo.url, alt: photo.altText || "", loading: "lazy", draggable: "false" })
      );
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
    const barChildren = [
      counter,
      el("a", { class: "pv-x-media-open", href: openUrl, target: "_blank", rel: "noreferrer", text: "在 X 打开" })
    ];
    if (variant === "overlay") barChildren.push(closeButton);
    const bar = el("div", { class: "pv-x-media-bar" }, ...barChildren);
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
    const paintButtons = () => {
      if (prevButton) prevButton.disabled = current <= 0;
      if (nextButton) nextButton.disabled = current >= photos.length - 1;
      counter.textContent = `${current + 1} / ${photos.length}`;
      slides.forEach((slide, i) => slide.setAttribute("aria-hidden", String(i !== current)));
    };
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
    if (prevButton) prevButton.addEventListener("click", () => show(current - 1));
    if (nextButton) nextButton.addEventListener("click", () => show(current + 1));
    const frameRatio = framePhoto.width && framePhoto.height ? framePhoto.height / framePhoto.width : 0;
    const wrapper = () => stage.parentElement;
    let resizeObserver = null;
    let observedBox = null;
    const syncFrame = () => {
      if (variant !== "overlay") return;
      const box = wrapper();
      if (!box) return;
      if (resizeObserver && observedBox !== box) {
        if (observedBox) resizeObserver.unobserve(observedBox);
        resizeObserver.observe(box);
        observedBox = box;
      }
      const availableWidth = box.clientWidth - 24;
      const availableHeight = box.clientHeight - 24;
      if (availableWidth <= 0 || availableHeight <= 0) return;
      let width2 = availableWidth;
      let height = frameRatio ? width2 * frameRatio : availableHeight;
      if (height > availableHeight) {
        height = availableHeight;
        width2 = frameRatio ? height / frameRatio : availableWidth;
      }
      stage.style.width = `${Math.round(width2)}px`;
      stage.style.height = `${Math.round(height)}px`;
    };
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => {
        if (drag) return;
        syncFrame();
        x = targetOf(current);
        render();
      });
      resizeObserver.observe(stage);
    }
    syncFrame();
    const project = (v, deceleration = 0.998) => v / 1e3 * deceleration / (1 - deceleration);
    const rubberband = (overshoot, dimension, constant = 0.55) => overshoot * dimension * constant / (dimension + constant * Math.abs(overshoot));
    let drag = null;
    const onPointerDown = (event) => {
      if (photos.length < 2 || event.target.closest("button, a")) return;
      stopAnim();
      const now = performance.now();
      drag = { startX: event.clientX, base: x, samples: [[now, x]] };
      stage.classList.add("pv-x-media-dragging");
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (err) {
      }
    };
    const onPointerMove = (event) => {
      if (!drag) return;
      const min = targetOf(photos.length - 1);
      const max = 0;
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
      stage.classList.remove("pv-x-media-dragging");
      const samples = drag.samples;
      const last = samples[samples.length - 1];
      const first = samples[0];
      const dt = last[0] - first[0];
      const v0 = dt > 0 ? (last[1] - first[1]) / dt * 1e3 : 0;
      const projected = x + project(v0);
      const targetIndex = Math.max(0, Math.min(Math.round(-projected / width()), photos.length - 1));
      drag = null;
      settle(targetIndex, v0);
    };
    const destroy = () => {
      stopAnim();
      resizeObserver == null ? void 0 : resizeObserver.disconnect();
      resizeObserver = null;
      stage.removeEventListener("keydown", onKey);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
    };
    const close = () => {
      destroy();
      onClose == null ? void 0 : onClose();
    };
    function onKey(event) {
      if (event.key === "Escape" && variant === "overlay") {
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
      }
    }
    closeButton.addEventListener("click", close);
    stage.addEventListener("keydown", onKey);
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
    if (variant === "inline" && onZoom) {
      stage.addEventListener("click", (event) => {
        if (event.target.closest("button, a")) return;
        onZoom(current);
      });
    }
    stage.append(track, bar);
    if (prevButton) stage.appendChild(prevButton);
    if (nextButton) stage.appendChild(nextButton);
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
  function openMediaLightbox(anchor, photos, index, openUrl) {
    const root = anchor && anchor.closest && anchor.closest(".pv-x-reader") || anchor && anchor.parentElement;
    if (!root || !photos.length || root.querySelector(".pv-x-media-lightbox")) return;
    const layer = el("div", {
      class: "pv-x-media-lightbox",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "图片查看"
    });
    let carousel = null;
    const close = () => {
      carousel == null ? void 0 : carousel.destroy();
      layer.remove();
    };
    carousel = createMediaCarousel(photos, { openUrl, variant: "overlay", startIndex: index, onClose: close });
    layer.appendChild(carousel.node);
    layer.addEventListener("click", (event) => {
      if (event.target === layer) close();
    });
    root.appendChild(layer);
    carousel.syncFrame();
    try {
      carousel.node.focus({ preventScroll: true });
    } catch (err) {
      carousel.node.focus();
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
        onZoom: (index) => openMediaLightbox(grid, photos, index, openUrl)
      });
      grid.classList.add("pv-x-media-carousel");
      grid.appendChild(carousel.node);
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
          openMediaLightbox(grid, photos, photos.indexOf(item), openUrl);
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
    if (displayText(quote)) {
      const body = el("div", { class: "pv-x-quote-text" });
      appendRichText(body, quote, bindProfile);
      main.appendChild(body);
    }
    card.appendChild(main);
    const photo = (quote.media || [])[0];
    if (photo && photo.url) {
      card.appendChild(el("img", { class: "pv-x-quote-media", src: photo.url, alt: photo.altText || "", loading: "lazy" }));
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
  function renderPost(model, { threadLine = false, onAction = null, translation = null, bindProfile = null, compact = false } = {}) {
    const article = el("article", { class: compact ? "pv-x-post pv-x-post-compact" : "pv-x-post" });
    article.dataset.tweetId = model.id;
    const column = avatarColumn(model, { bindProfile });
    if (threadLine) column.appendChild(el("span", { class: "pv-x-thread-line" }));
    article.appendChild(column);
    const isArticle = model.attachment && model.attachment.type === "article";
    const main = el(
      "div",
      { class: "pv-x-main" },
      headNode(model, bindProfile),
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
  function renderReply(model, options = {}) {
    const article = renderPost(model, { ...options, threadLine: true, compact: true });
    article.classList.add("pv-x-reply");
    article.style.setProperty("--pv-x-depth", String(Math.min(Number(model.depth) || 0, 3)));
    return article;
  }
  function sortControl(current, onSort) {
    const group = el("div", { class: "pv-x-sort", role: "group", "aria-label": "评论排序" });
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
  function composer({ avatar, onSubmit, focalId }) {
    const section = el("section", { class: "pv-x-composer" });
    const avatarHolder = el("span", { class: "pv-x-avatar pv-x-avatar-sm" });
    if (avatar) avatarHolder.appendChild(el("img", { src: avatar, alt: "" }));
    const input = el("textarea", { class: "pv-x-composer-input", rows: "1", placeholder: "发布你的回复" });
    const submit = el("button", { class: "pv-x-composer-submit", type: "button", text: "回复", disabled: "" });
    const hint = el("span", { class: "pv-x-composer-hint" });
    let targetModel = null;
    const targetRow = el("div", { class: "pv-x-composer-target" });
    const targetLabel = el("span", { class: "pv-x-composer-target-label" });
    const clearTarget = el("button", { class: "pv-x-composer-target-clear", type: "button", "aria-label": "取消回复该评论", text: "✕" });
    targetRow.append(targetLabel, clearTarget);
    targetRow.hidden = true;
    clearTarget.addEventListener("click", () => setTarget(null));
    function setTarget(model) {
      targetModel = model && String(model.id) !== String(focalId) ? model : null;
      if (targetModel) {
        targetLabel.textContent = `回复 @${targetModel.author && (targetModel.author.handle || targetModel.author.name) || "X 用户"}`;
        targetRow.hidden = false;
      } else {
        targetRow.hidden = true;
      }
      return targetModel;
    }
    const autoGrow = () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
    };
    input.addEventListener("input", () => {
      autoGrow();
      submit.disabled = !input.value.trim();
    });
    const send = async () => {
      const text = input.value.trim();
      if (!text || submit.disabled) return;
      submit.disabled = true;
      hint.textContent = "正在发布...";
      try {
        await onSubmit(text, targetModel);
        input.value = "";
        autoGrow();
        hint.textContent = "";
        setTarget(null);
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
    return { node: section, setTarget, focus: () => input.focus() };
  }
  function notify(reader, message, tone = "error") {
    if (!reader) return;
    let toast = reader.querySelector(".pv-x-toast");
    if (!toast) {
      toast = el("div", { class: "pv-x-toast" });
      reader.appendChild(toast);
    }
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.dataset.visible = "true";
    clearTimeout(toast.__pvTimer);
    toast.__pvTimer = setTimeout(() => {
      toast.dataset.visible = "false";
    }, 3200);
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
    composerAvatar
  }) {
    const reader = el("div", { class: "pv-x-reader" });
    const postPane = el("section", { class: "pv-x-pane pv-x-pane-post" });
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
    postPane.appendChild(
      renderPost(focal, { threadLine: true, onAction, bindProfile, translation: translationFor == null ? void 0 : translationFor(focal) })
    );
    const countLabel = el("span", { class: "pv-x-reply-count", text: `评论（${replyCount}）` });
    const sort = onSort ? sortControl("relevant", onSort) : null;
    const tools = el(
      "div",
      { class: "pv-x-reply-tools" },
      el("div", { class: "pv-x-tools-left" }, countLabel, sort),
      el("a", { class: "pv-x-open", href: openUrl, target: "_blank", rel: "noreferrer", text: "在 X 打开" })
    );
    const replyPane = el("section", { class: "pv-x-pane pv-x-pane-replies" }, tools);
    const composerView = onSubmitReply ? composer({ avatar: composerAvatar, onSubmit: onSubmitReply, focalId: focal.id }) : null;
    if (composerView) replyPane.appendChild(composerView.node);
    const list = el("div", { class: "pv-x-reply-list" });
    replyPane.appendChild(list);
    reader.append(postPane, replyPane);
    return { reader, list, countLabel, composer: composerView, sort };
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
    const handleMatch = button && String(button.innerText || "").match(/@([A-Za-z0-9_]+)/);
    return {
      avatar: img && (img.currentSrc || img.src) || "",
      handle: handleMatch ? handleMatch[1] : ""
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
      const panel = document.getElementById("popup-content-panel");
      const account = currentAccount();
      const replies = [];
      const seen = /* @__PURE__ */ new Set();
      const modelsById = /* @__PURE__ */ new Map();
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
      const loadingView = showLoading(container, { title: "正在通过 X 会话读取帖子..." });
      container.replaceChildren(el("div", { class: "pv-x-loading-layer" }, loadingView));
      const syncLayout = () => {
        if (!readerEl) return;
        readerEl.classList.toggle("pv-x-single", container.clientWidth < SINGLE_COLUMN_WIDTH);
        profileCard == null ? void 0 : profileCard.reposition();
      };
      const cleanup = () => {
        aborted = true;
        stopThemeWatch();
        resizeObserver == null ? void 0 : resizeObserver.disconnect();
        resizeObserver = null;
        sentinelObserver == null ? void 0 : sentinelObserver.disconnect();
        sentinelObserver = null;
        translationObserver == null ? void 0 : translationObserver.disconnect();
        translationObserver = null;
        profileCard == null ? void 0 : profileCard.destroy();
        profileCard = null;
        translationQueue.length = 0;
        queuedKeys.clear();
        translationCache.clear();
        this.lastThread = null;
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
      const scheduleTranslationWork = () => {
        translationObserver == null ? void 0 : translationObserver.disconnect();
        translationObserver = null;
        if (!readerEl) return;
        for (const model of modelsById.values()) {
          if (model.depth === void 0) enqueueTranslation(model, true);
        }
        const replyBlocks = [...readerEl.querySelectorAll(".pv-x-reply .pv-x-translatable")];
        if (!replyBlocks.length) return;
        if (typeof IntersectionObserver !== "function") {
          for (const block of replyBlocks) enqueueTranslation(modelsById.get(block.dataset.translationId));
          return;
        }
        translationObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              translationObserver == null ? void 0 : translationObserver.unobserve(entry.target);
              enqueueTranslation(modelsById.get(entry.target.dataset.translationId));
            }
          },
          // 评论列表是右栏唯一滚动区
          { root: replyList, rootMargin: "180px 0px", threshold: 0.01 }
        );
        for (const block of replyBlocks) translationObserver.observe(block);
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
        if (countLabel) countLabel.textContent = `评论（${seen.size}）`;
      };
      const renderReplies = () => {
        if (!replyList) return;
        const scrollTop = replyList.scrollTop;
        replyList.replaceChildren();
        const list = sortedReplies();
        if (!list.length) {
          replyList.appendChild(el("div", { class: "pv-x-empty", text: "这条帖子暂时没有可显示的评论" }));
        }
        for (const reply of list) {
          replyList.appendChild(
            renderReply(reply, {
              onAction: handleAction,
              bindProfile,
              translation: translationFor(reply)
            })
          );
        }
        if (cursor) {
          sentinel = el("div", { class: "pv-x-load-sentinel" }, el("span", { class: "pv-x-loading", text: "正在加载更多评论..." }));
          replyList.appendChild(sentinel);
          observeSentinel();
        } else {
          sentinel = null;
        }
        if (replyList) replyList.scrollTop = scrollTop;
        markReplyTarget();
        scheduleTranslationWork();
      };
      const observeSentinel = () => {
        sentinelObserver == null ? void 0 : sentinelObserver.disconnect();
        if (!sentinel || typeof IntersectionObserver !== "function" || !replyList) return;
        sentinelObserver = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) loadMore();
          },
          // 评论列表是右栏唯一滚动区
          { root: replyList, rootMargin: "0px 0px 240px 0px", threshold: 0.01 }
        );
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
      const setReplyTarget = (model) => {
        replyTarget = model && String(model.id) !== String(tweetId) ? model : null;
        composerView == null ? void 0 : composerView.setTarget(replyTarget);
        markReplyTarget();
        composerView == null ? void 0 : composerView.focus();
      };
      const handleAction = async (key, model, button) => {
        if (key === "reply") {
          setReplyTarget(model);
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
        try {
          await bridge.toggleAction(key, model.id, wasActive);
        } catch (err) {
          logger.warn(`[XThreadLoader] ${key} failed`, err);
          model.flags[flag] = wasActive;
          model.counts[countKey] = Math.max(0, (Number(model.counts[countKey]) || 0) + (wasActive ? 1 : -1));
          paintAction(button, model, key);
          notify(readerEl, `${ACTION_LABEL[key] || key}失败：${err && err.message ? err.message : err}`, "error");
        }
      };
      const handleSort = (next, group) => {
        if (next === sortMode) return;
        sortMode = next;
        paintSort(group, next);
        renderReplies();
      };
      const submitReply = async (text, target) => {
        const inReplyTo = target && target.id ? String(target.id) : tweetId;
        await bridge.createReply(inReplyTo, text);
        if (aborted) return;
        const local = {
          id: `local-${Date.now()}`,
          text,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          author: { name: account.handle ? `@${account.handle}` : "我", handle: account.handle, avatar: account.avatar, verified: false },
          counts: { replies: 0, likes: 0, reposts: 0, bookmarks: 0, views: 0 },
          flags: { liked: false, reposted: false, bookmarked: false },
          media: [],
          depth: target && target.depth !== void 0 ? Math.min(Number(target.depth) + 1, 3) : 0,
          inReplyToId: inReplyTo
        };
        replies.unshift(local);
        seen.add(local.id);
        modelsById.set(local.id, local);
        replyTarget = null;
        composerView == null ? void 0 : composerView.setTarget(null);
        sortMode = "relevant";
        paintSort(sortGroup, "relevant");
        updateCount();
        renderReplies();
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
            replies.push(reply);
            modelsById.set(reply.id, reply);
            added += 1;
          }
          cursor = replyCursorAfterPage(previousCursor, next.cursor, added);
          updateCount();
          renderReplies();
        } catch (err) {
          logger.warn("[XThreadLoader] load more failed", err);
          notify(readerEl, `加载更多评论失败：${err && err.message ? err.message : err}`, "error");
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
          modelsById.set(summary.focal.id, summary.focal);
          for (const ancestor of summary.ancestors) modelsById.set(ancestor.id, ancestor);
          for (const reply of summary.replies) {
            seen.add(reply.id);
            replies.push(reply);
            modelsById.set(reply.id, reply);
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
            onNotify: (message, tone) => notify(readerEl, message, tone === "ok" ? "ok" : "error")
          });
          const built = renderReader({
            focal: summary.focal,
            ancestors: summary.ancestors,
            replyCount: seen.size,
            openUrl: openUrlOf(summary.focal),
            onAction: handleAction,
            onSort: handleSort,
            onSubmitReply: submitReply,
            translationFor,
            bindProfile,
            composerAvatar: account.avatar
          });
          readerEl = built.reader;
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
          updateCount();
          renderReplies();
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
        const panel = document.getElementById("popup-content-panel");
        return {
          mine: describe(document.querySelector("#popup-content-area .pv-x-text")),
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
        const panel = document.getElementById("popup-content-panel");
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
          mount: panel && panel.parentElement ? `${panel.parentElement.tagName}#${panel.parentElement.id}` : null
        };
      },
      // 样式自检：区分「整表没生效」（CSP 拦内联样式）与「只有 X 皮肤没生效」
      styleDiag: () => {
        const panel = document.getElementById("popup-content-panel");
        const area = document.getElementById("popup-content-area");
        const reader = document.querySelector(".pv-x-reader");
        let xRulesFound = false;
        for (const sheet of Array.from(document.styleSheets)) {
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
    popupManager.popup.ensure();
    registerAdapters();
    installXSupport();
    applyForumMarker();
    setupEvents();
    setupObserver();
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
