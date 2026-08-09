// ==UserScript==
// @name          页内弹窗打开新帖
// @namespace     http://tampermonkey.net/
// @version       2.0.5
// @description   点击论坛帖子链接，在弹窗中加载内容 (插件化架构 V2)
// @author        cores
// @match         *://*/*
// @grant         GM_xmlhttpRequest
// @grant         GM_addStyle
// @grant         GM_getValue
// @grant         GM_setValue
// @connect       *
// @license       MIT
// ==/UserScript==


(() => {
  // src/config.js
  var config = {
    popup: {
      width: "50%",
      height: "75%",
      maxWidth: "2560px",
      maxHeight: "1440px",
      radius: "12px",
      zIndex: 1e4,
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
    sitePolicy: {
      "linux.do": { iframe: true, scripts: true },
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
      console.log(PREFIX, ...args);
    },
    info(...args) {
      console.info(PREFIX, ...args);
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

  // src/core/EventBus.js
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
      this._handlers.get(event)?.delete(handler);
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
  var has = (fn) => typeof fn === "function";
  function injectStyle(css) {
    const style = document.createElement("style");
    style.type = "text/css";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    return style;
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
      if (has(GM_addStyle)) {
        try {
          return GM_addStyle(css);
        } catch {
        }
      }
      return injectStyle(css);
    },
    xmlhttpRequest(options) {
      if (has(GM_xmlhttpRequest)) {
        return GM_xmlhttpRequest({
          timeout: options.timeout || 15e3,
          ...options
        });
      }
      return fetch(options.url, { method: options.method || "GET" }).then(
        async (res) => options.onload?.({
          status: res.status,
          statusText: res.statusText,
          responseText: await res.text(),
          finalUrl: res.url
        })
      ).catch((err) => options.onerror?.(err));
    },
    getValue(key, fallback) {
      if (has(GM_getValue)) {
        try {
          return GM_getValue(key, fallback);
        } catch {
        }
      }
      return localGet(key, fallback);
    },
    setValue(key, value) {
      if (has(GM_setValue)) {
        try {
          return GM_setValue(key, value);
        } catch {
        }
      }
      return localSet(key, value);
    }
  };

  // src/core/RulesManager.js
  var KEY = "pv2:rules";
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
  var SiteManager = class {
    constructor() {
      this.adapters = [];
      this.enhancers = [];
    }
    register(adapter) {
      this.adapters.push(adapter);
      return adapter;
    }
    registerEnhancer(fn) {
      this.enhancers.push(fn);
      return fn;
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
      if (event.target.closest?.("#popup-content-panel")) return null;
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
      for (const fn of this.enhancers) {
        try {
          fn(hostname, pathname);
        } catch (err) {
          logger.error("enhancer error", err);
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

  // src/loaders/IframeLoader.js
  var IframeLoader = class {
    constructor(sandbox) {
      this.sandbox = sandbox;
    }
    load({ url, hostname, container, onError, onLoad, mobileUA = null, loadingSelector = "#popup-panel-loading" }) {
      logger.debug(`[IframeLoader] direct load ${url}`);
      if (mobileUA) {
        logger.debug("[IframeLoader] 直接 iframe 无法设置移动端 UA：" + url);
      }
      const iframe = el("iframe", {
        id: "popup-panel-iframe",
        sandbox: this.sandbox.buildSandboxAttrs(hostname)
      });
      iframe.style.cssText = "width:100%;height:100%;border:none;background:#fff;";
      let settled = false;
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
      iframe.addEventListener("load", () => {
        if (settled) return;
        container.querySelector(loadingSelector)?.remove();
        container.classList.add("iframe-direct-load");
        finish(onLoad);
      });
      iframe.addEventListener("error", () => finish(onError, `加载 ${url} 失败。`));
      container.querySelector(loadingSelector)?.remove();
      container.appendChild(iframe);
      iframe.src = url;
      return () => {
        clearTimeout(timer);
        iframe.src = "about:blank";
        iframe.remove();
      };
    }
  };

  // src/security/Sanitizer.js
  var Sanitizer = class _Sanitizer {
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
    /**
     * 解析懒加载图片：真实地址常放在 data-original/data-src/data-srcset 等各类 data 属性里，
     * src 多为占位图（懒加载 JS 被净化后不会执行）。只要找到真实地址就换到 src 并绝对化，
     * 不依赖对「占位图文件名」的精确识别——各站点占位图命名千差万别，正则穷举必然漏。
     */
    static REAL_SRC_ATTRS = [
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
      "data-img",
      // Discuz 系论坛（52pojie/wnflb/chiphell 等）附件图：src 为 1x1 none.gif 占位，
      // 真实地址放在 zoomfile/file 属性里，点击时才由 JS 换入
      "zoomfile",
      "file"
    ];
    static PLACEHOLDER_RE = /^(data:|about:|blob:)/i;
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
      for (const attr of _Sanitizer.REAL_SRC_ATTRS) {
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
      for (const attr of _Sanitizer.REAL_SRC_ATTRS) img.removeAttribute(attr);
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
      for (const node of toRemove) node.parentNode?.removeChild(node);
    }
    _sanitizeAttrs(node) {
      const attrs = node.attributes;
      if (!attrs || !attrs.length) return;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const name = attrs[i].name;
        const value = attrs[i].value;
        if (this.dangerousEventAttrs.test(name)) {
          node.removeAttribute(name);
          continue;
        }
        if (name.toLowerCase() === "srcdoc") {
          node.removeAttribute(name);
          continue;
        }
        if (name === "href") {
          const scheme = String(value).trim().split(":")[0].toLowerCase();
          if (["javascript", "data", "vbscript", "file"].includes(scheme)) {
            node.removeAttribute(name);
          }
        }
        if (name === "src" || name === "poster") {
          const scheme = String(value).trim().split(":")[0].toLowerCase();
          if (["javascript", "vbscript", "file"].includes(scheme)) {
            node.removeAttribute(name);
          }
        }
      }
    }
  };
  var sanitizer = new Sanitizer();

  // src/core/SettingsManager.js
  var KEY2 = "pv2:settings";
  var SITE_KEY = "pv2:siteSettings";
  var GLOBAL_KEYS = ["theme", "allowInFrame"];
  function defaultGlobal() {
    return { theme: "auto", allowInFrame: false };
  }
  function defaultSite() {
    return {
      scrollbarVisible: config.popup.scrollbarVisible,
      panelSize: config.popup.defaultSize,
      windowMode: "coupled",
      linkIntercept: true,
      phoneModel: config.phone.defaultModel,
      phonePosition: null
    };
  }
  function currentSiteKey() {
    try {
      return window.location.hostname || "unknown";
    } catch {
      return "unknown";
    }
  }
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
      if (!config.popup.sizes[this.site.panelSize]) {
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

  // src/loaders/IframeRenderer.js
  var IMG_REAL_ATTRS = [
    // Discuz 系论坛（52pojie/wnflb/chiphell 等）附件图：src 为 1x1 none.gif 占位，
    // 真实地址放在 zoomfile/file 属性里，点击时才由 JS 换入
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
  function renderIntoIframe({ html, url, container, sandboxAttrs, head = "", linkIntercept, loadingSelector = "#popup-panel-loading" }) {
    container.querySelector(loadingSelector)?.remove();
    container.classList.add("iframe-direct-load");
    const iframe = el("iframe", {
      id: "popup-panel-iframe",
      sandbox: sandboxAttrs
    });
    iframe.style.cssText = "width:100%;height:100%;border:none;background:#fff;";
    container.appendChild(iframe);
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(buildDocument(html, url, head));
    iframeDoc.close();
    const runFixes = () => {
      if (!iframe.isConnected || !iframe.contentWindow) return;
      try {
        fixLinks(iframeDoc, linkIntercept);
        injectReadStyle(iframeDoc);
        fixImages(iframeDoc);
      } catch (err) {
        logger.error("[renderIntoIframe] manipulate error", err);
      }
    };
    iframe.addEventListener("load", runFixes);
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
        for (const attr of IMG_REAL_ATTRS) {
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

  // src/loaders/RequestLoader.js
  var RequestLoader = class {
    constructor() {
      this.sandboxAttrs = "allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts";
    }
    load({ url, hostname, keepScripts = false, container, onError, onLoad, mobileUA = null, linkIntercept, loadingSelector }) {
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
              sandboxAttrs: this.sandboxAttrs,
              linkIntercept,
              loadingSelector
            });
            onLoad?.();
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
        try {
          abort?.abort?.();
        } catch {
        }
        const iframe = container.querySelector("#popup-panel-iframe");
        iframe?.remove();
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
            onLoad?.();
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
        try {
          abort?.abort?.();
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
    constructor(sandboxAttrs) {
      this.sandboxAttrs = sandboxAttrs || "allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts";
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
          try {
            req?.abort?.();
          } catch {
          }
        };
      });
      return { promise, abort };
    }
    load({ url, keepScripts = false, container, onError, onLoad, mobileUA = null, linkIntercept, loadingSelector }) {
      logger.debug(`[CacheLoader] ${url}`);
      const cached = this._readCache(url);
      if (cached != null) {
        logger.debug(`[CacheLoader] cache hit: ${url}`);
        renderIntoIframe({
          html: cached.body,
          head: cached.head,
          url,
          container,
          sandboxAttrs: this.sandboxAttrs,
          linkIntercept,
          loadingSelector
        });
        onLoad?.();
        return () => {
          container.querySelector("#popup-panel-iframe")?.remove();
        };
      }
      const { promise, abort } = this.prefetch(url, keepScripts, mobileUA);
      promise.then((result) => {
        renderIntoIframe({
          html: result.body,
          head: result.head,
          url,
          container,
          sandboxAttrs: this.sandboxAttrs,
          linkIntercept,
          loadingSelector
        });
        onLoad?.();
      }).catch((error) => onError?.(error.message));
      return () => {
        try {
          abort?.();
        } catch {
        }
        container.querySelector("#popup-panel-iframe")?.remove();
      };
    }
  };

  // src/core/LoaderManager.js
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
     * 解析应使用的加载方式。
     */
    resolveMode(url, hostname) {
      const policy = this.sandbox.policyFor(hostname);
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
      const keepScripts = this._keepScripts(hostname);
      return this.loaders.cache.prefetch(url, keepScripts, this._mobileUA());
    }
    /**
     * 手机模式下返回对应的移动端 UA，否则 null。
     */
    _mobileUA() {
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
    _keepScripts(hostname) {
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
      const keepScripts = ctx.keepScripts !== void 0 ? ctx.keepScripts : this._keepScripts(hostname);
      const mobileUA = ctx.mobileUA !== void 0 ? ctx.mobileUA : this._mobileUA();
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
        onLoad: ctx.onLoad
      });
      return () => {
        try {
          abort?.();
        } catch (err) {
          logger.warn("[LoaderManager] abort error", err);
        }
      };
    }
  };
  var loaderManager = new LoaderManager();

  // src/ui/Toolbar.js
  function createToolbar(handlers) {
    const actions = el("div", { id: "popup-panel-actions" });
    const makeBtn = (id, icon, title, onClick) => {
      const btn = el("button", { id, class: "popup-panel-btn", title, onclick: onClick });
      btn.appendChild(svgIcon(icon));
      actions.appendChild(btn);
      return btn;
    };
    const refresh = makeBtn("popup-panel-refresh", "refresh", "刷新内容 (R)", () => handlers.onRefresh?.());
    const maximize = makeBtn("popup-panel-maximize", "maximize", "全屏 (F)", () => handlers.onMaximize?.());
    const open = makeBtn("popup-panel-open-in-new", "external", "在新标签页打开", () => handlers.onOpenExternal?.());
    const settings = makeBtn("popup-panel-settings", "settings", "设置", () => handlers.onSettings?.());
    const close = makeBtn("popup-panel-close", "close", "关闭 (Esc)", () => handlers.onClose?.());
    return { actions, refresh, maximize, open, settings, close };
  }

  // src/ui/SettingsPanel.js
  function createSettingsPanel({ onChange, onManageRules }) {
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
      onChange?.(settingsManager.get());
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
    const makeSeg = (order, labels, getKey, setKey, { icons = {}, defaultOf, onChange: onChange2 } = {}) => {
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
              settingsManager.set({ [setKey]: k });
              sync();
              onChange2?.();
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
      onChange: syncPhoneModels
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
    const resetBtn = el("button", { type: "button", class: "pv-settings-reset", text: "恢复默认" });
    resetBtn.addEventListener("click", () => {
      settingsManager.reset();
      scrollSwitch.checked = settingsManager.get().scrollbarVisible !== false;
      linkInterceptSwitch.checked = settingsManager.get().linkIntercept !== false;
      allowInFrameSwitch.checked = settingsManager.get().allowInFrame === true;
      sizeSeg.sync();
      themeSeg.sync();
      windowModeSeg.sync();
      phoneModelSeg.sync();
      syncPhoneModels();
      persist();
    });
    const manageRulesBtn = el("button", { type: "button", class: "pv-settings-reset", text: "管理", onclick: () => onManageRules?.() });
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
    return el(
      "div",
      { id: "popup-settings-popover" },
      group("窗体行为"),
      rowBlock("窗体滚动条", "显示或隐藏窗体内的滚动条", scrollSwitchWrap),
      colBlock("窗体驻留方式", "弹窗遮罩与页面交互", windowModeSeg.group, "跟随页面：弹窗带遮罩；独立悬浮：无遮罩、页面可交互，点击链接仍在弹窗内打开内容"),
      sizeBlock,
      group("交互控制"),
      rowBlock("页面链接拦截", "开启后页面链接在弹窗内打开", linkInterceptSwitchWrap, "开启：页面链接点击在弹窗内打开；关闭：页面链接原页面打开，窗体内容里的链接在窗体内部打开（禁止新标签页），窗体自动切换为独立悬浮"),
      rowBlock("链接规则", "拦截本站指定链接并在弹窗打开", manageRulesBtn, "规则按当前站点生效；点「取选」直接在页面上点一下链接即可生成，无需写选择器"),
      group("外观"),
      colBlock("外观主题", "跟随系统或手动指定", themeSeg.group),
      group("高级"),
      rowBlock("在 iframe 中运行", "默认关闭（等同 @noframes）", allowInFrameWrap, "风险：开启后脚本会在页面内所有 iframe 中运行（含广告、嵌入内容等），可能增加页面开销、出现多个悬浮按钮，或与嵌入页面产生样式冲突；仅在确有需要时开启"),
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
        document.removeEventListener("keydown", onKey);
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
        if (e.key === "Escape") finish(null);
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
      document.addEventListener("keydown", onKey);
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
      if (e.key === "Escape" && root.classList.contains("visible")) close();
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
  max-height: calc(100vh - 32px);\r
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
  bottom: 20px;\r
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
#popup-panel-footer-url {\r
  flex: 1;\r
  min-width: 0;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  direction: rtl;\r
  text-align: left;\r
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
`;

  // src/ui/PopupPanel.js
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
      this.footerUrlEl = null;
      this.settingsPopover = null;
      this.settingsBtn = null;
      this.currentPanelSize = null;
      this.currentUrl = "";
      this.isFullScreen = false;
      this.preFullScreen = {};
      this.handlers = {};
      this._onKeydownBound = null;
    }
    ensure() {
      if (this.panel) return this.panel;
      this.overlay = el("div", { id: "popup-panel-overlay", onclick: () => this.close() });
      document.body.appendChild(this.overlay);
      const titleMark = el("span", { class: "pv-title-mark" });
      titleMark.appendChild(svgIcon("article", { size: 15 }));
      this.titleTextEl = el("span", { class: "pv-title-text", text: "查看内容" });
      this.titleEl = el("div", { id: "popup-panel-title" }, titleMark, this.titleTextEl);
      this.toolbar = createToolbar({
        onRefresh: () => this.handlers.onRefresh?.(this.currentUrl),
        onMaximize: () => this.toggleFullScreen(),
        onOpenExternal: () => this.handlers.onOpenExternal?.(this.currentUrl),
        onClose: () => this.close(),
        onSettings: () => {
          if (this.settingsPopover?.classList.contains("visible")) {
            this.hideSettings();
            return;
          }
          this.showSettingsNear(this.settingsBtn.getBoundingClientRect());
        }
      });
      this.settingsBtn = this.toolbar.settings;
      const header = el("div", { id: "popup-panel-header" }, this.titleEl, this.toolbar.actions);
      this.contentArea = el("div", { id: "popup-content-area" });
      this.footerUrlEl = el("span", { id: "popup-panel-footer-url" });
      const footerOpen = el("button", {
        id: "popup-panel-footer-open",
        class: "popup-panel-btn",
        title: "在新标签页打开",
        onclick: () => this.handlers.onOpenExternal?.(this.currentUrl)
      });
      footerOpen.appendChild(svgIcon("external", { size: 14 }));
      this.footer = el("div", { id: "popup-panel-footer" }, this.footerUrlEl, footerOpen);
      this.panel = el("div", { id: "popup-content-panel" }, header, this.contentArea, this.footer);
      document.body.appendChild(this.panel);
      this.floatBtn = el("button", { id: "pv-float-settings", title: "脚本设置" });
      this.floatBtn.appendChild(svgIcon("settings", { size: 16 }));
      this.floatBtn.addEventListener("click", () => {
        if (this.settingsPopover.classList.contains("visible")) {
          this.hideSettings();
          return;
        }
        this.showSettingsNear(this.floatBtn.getBoundingClientRect());
      });
      document.body.appendChild(this.floatBtn);
      this.settingsPopover = createSettingsPanel({
        onChange: (s) => this.applySettings(s),
        onManageRules: () => this.showRulesPanel()
      });
      document.body.appendChild(this.settingsPopover);
      this.rulesPanel = createRulesPanel();
      document.body.appendChild(this.rulesPanel.backdrop);
      document.body.appendChild(this.rulesPanel.root);
      document.addEventListener("click", (e) => {
        if (!this.settingsPopover?.classList.contains("visible")) return;
        if (e.target.closest("#popup-settings-popover") || e.target.closest("#popup-panel-settings") || e.target.closest("#pv-float-settings")) {
          return;
        }
        this.hideSettings();
      });
      header.addEventListener("dblclick", (e) => {
        if (e.target.closest("button")) return;
        this.toggleFullScreen();
      });
      this.contentArea.addEventListener("click", (e) => {
        if (settingsManager.get().linkIntercept !== false) return;
        const link = e.target.closest?.("a[href]");
        if (!link) return;
        const href = link.getAttribute("href");
        if (!href || /^(javascript:|#)/i.test(href.trim())) return;
        e.preventDefault();
        e.stopPropagation();
        const url = link.href;
        this.handlers.onOpenInWindow?.(url, (link.textContent || "").trim());
      });
      this._setupDrag(header);
      this._setupKeyboard();
      return this.panel;
    }
    show(title, url) {
      this.ensure();
      this.floatBtn?.classList.add("hidden");
      this.currentUrl = url || "";
      this.titleTextEl.textContent = title || "查看内容";
      this.footerUrlEl.textContent = url || "";
      this.footerUrlEl.title = url || "";
      this.footer.classList.toggle("empty", !url);
      this.panel.classList.remove("visible");
      const pos = this.isFullScreen ? {
        top: this.preFullScreen.top || "",
        left: this.preFullScreen.left || "",
        transform: this.preFullScreen.transform || ""
      } : {
        top: this.panel.style.top,
        left: this.panel.style.left,
        transform: this.panel.style.transform
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
        if (settingsManager.get().windowMode !== "float") this.overlay.classList.add("visible");
      });
    }
    close() {
      if (!this.panel) return;
      if (this.isFullScreen) this.toggleFullScreen();
      this.hideSettings();
      this.floatBtn?.classList.remove("hidden");
      this.panel.classList.remove("visible");
      this.overlay.classList.remove("visible");
      this.handlers.onClose?.();
      setTimeout(() => {
        this.contentArea.innerHTML = "";
        this.currentUrl = "";
      }, 350);
    }
    setTitle(text) {
      if (this.titleTextEl) this.titleTextEl.textContent = text || "查看内容";
    }
    updateFooterUrl(url) {
      this.footerUrlEl.textContent = url || "";
      this.footerUrlEl.title = url || "";
      this.footer?.classList.toggle("empty", !url);
    }
    /**
     * 应用设置到面板：滚动条显隐 + 窗体大小预设 + 手机模式位置记忆。
     */
    applySettings(s) {
      this.ensure();
      const prevSize = this.currentPanelSize;
      const nextSize = s.panelSize || config.popup.defaultSize;
      this.currentPanelSize = nextSize;
      this.applyTheme(s.theme);
      this.contentArea?.classList.toggle("pv-hide-scrollbar", s.scrollbarVisible === false);
      const size = config.popup.sizes[nextSize] || config.popup.sizes[config.popup.defaultSize];
      let width = size.width;
      let height = size.height;
      if (nextSize === "phone") {
        const m = config.phone.sizes[s.phoneModel] || config.phone.sizes[config.phone.defaultModel];
        if (m) {
          width = m.width;
          height = m.height;
        }
      }
      this.panel?.style.setProperty("--popup-width", width);
      this.panel?.style.setProperty("--popup-height", height);
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
    }
    hideOverlay() {
      this.overlay?.classList.remove("visible");
    }
    showOverlay() {
      if (this.panel?.classList.contains("visible")) this.overlay?.classList.add("visible");
    }
    /** 在指定锚点旁显示设置面板（锚点为元素 getBoundingClientRect）。 */
    showSettingsNear(rect) {
      const margin = 8;
      const pop = this.settingsPopover;
      const popW = pop.offsetWidth || 280;
      const popH = pop.offsetHeight || 320;
      let left = rect.right - popW;
      let top = rect.bottom + margin;
      if (left < margin) left = margin;
      if (rect.bottom + popH + margin > window.innerHeight) {
        top = Math.max(margin, rect.top - popH - margin);
      }
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      pop.classList.add("visible");
      this.settingsBtn?.classList.add("active");
    }
    hideSettings() {
      this.settingsPopover?.classList.remove("visible");
      this.settingsBtn?.classList.remove("active");
    }
    showRulesPanel() {
      this.hideSettings();
      this.rulesPanel?.open();
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
      let dragging = false;
      let startX = 0, startY = 0, startLeft = 0, startTop = 0;
      header.addEventListener("mousedown", (e) => {
        if (e.target.closest("button")) return;
        if (this.isFullScreen) return;
        if (e.button !== 0) return;
        dragging = true;
        const rect = this.panel.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        this.panel.style.transition = "none";
        this.panel.style.left = `${rect.left}px`;
        this.panel.style.top = `${rect.top}px`;
        this.panel.style.transform = "none";
        e.preventDefault();
      });
      const move = (e) => {
        if (!dragging) return;
        this.panel.style.left = `${startLeft + (e.clientX - startX)}px`;
        this.panel.style.top = `${startTop + (e.clientY - startY)}px`;
      };
      const up = () => {
        if (!dragging) return;
        dragging = false;
        this.panel.style.transition = "";
        this._clampToViewport();
        if (this.currentPanelSize === "phone") this.savePhonePosition();
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      window.addEventListener("resize", () => {
        if (this.panel?.classList.contains("visible")) {
          requestAnimationFrame(() => this._clampToViewport());
        }
      });
    }
    /**
     * 把弹窗约束回视口内（DevTools 占位 / 窗口缩放后调用），
     * 避免窗体被压缩出可视区域。
     */
    _clampToViewport() {
      if (!this.panel || this.isFullScreen) return;
      const rect = this.panel.getBoundingClientRect();
      const pad = 8;
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
        this.panel.style.transition = "none";
        this.panel.style.left = `${left}px`;
        this.panel.style.top = `${top}px`;
        this.panel.style.transform = "none";
        void this.panel.offsetWidth;
        this.panel.style.transition = "";
      }
    }
    _setupKeyboard() {
      if (this._onKeydownBound) return;
      this._onKeydownBound = (e) => {
        if (!this.panel || !this.panel.classList.contains("visible")) return;
        if (e.key === "Escape") this.close();
        else if (e.key === "f" || e.key === "F") this.toggleFullScreen();
        else if (e.key === "r" || e.key === "R") {
          if (this.currentUrl && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.handlers.onRefresh?.(this.currentUrl);
          }
        }
      };
      document.addEventListener("keydown", this._onKeydownBound);
      document.addEventListener(
        "wheel",
        (e) => {
          if (!this.panel || !this.panel.classList.contains("visible")) return;
          if (this.isFullScreen) {
            e.preventDefault();
            e.stopPropagation();
          } else {
            const content = this.contentArea;
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
  var PopupManager = class {
    constructor() {
      this.popup = new PopupPanel();
      this._abort = null;
      this._currentUrl = "";
      this.popup.handlers = {
        onRefresh: (url) => this.load(url),
        onOpenExternal: (url) => url && window.open(url, "_blank", "noopener"),
        onOpenInWindow: (url, linkText) => {
          if (!url) return;
          if (linkText) this.popup.setTitle(linkText);
          this.popup.updateFooterUrl(url);
          this.load(url);
        },
        onClose: () => {
          this._abort?.();
          this._abort = null;
        }
      };
    }
    /**
     * 打开弹窗并加载内容。
     */
    open({ url, title }) {
      this._currentUrl = url;
      this.popup.show(title, url);
      this.load(url);
    }
    /**
     * 加载指定 URL 内容到弹窗内容区。
     */
    load(url) {
      this._abort?.();
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
        }
      });
    }
    close() {
      this._abort?.();
      this._abort = null;
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
      if (!config.prefetch.enabled) return;
      if (this.loader.resolveMode(url, hostname) !== "cache") return;
      if (this.loader.hasCached(url)) return;
      if (this._current?.url === url) return;
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
      if (this._current?.url === url) return;
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
        if (this._current?.url === url) this._current = null;
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
    /** 从点击事件的目标元素中解析出可打开的链接信息 */
    parseClick(event) {
      return null;
    }
    /** 返回该站点可增强的链接选择器列表 */
    getEnhanceSelectors() {
      return [];
    }
    /** 对某个 DOM 元素应用视觉增强（添加 popup-trigger 类等） */
    enhance(element) {
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
    constructor(hostnamePatterns = ["chiphell", "wnflb", "52pojie"]) {
      super();
      this.name = "Discuz";
      this.forumStyles = true;
      this.patterns = hostnamePatterns;
    }
    match(hostname) {
      return this.patterns.some((p) => hostname.includes(p));
    }
    parseClick(event) {
      const link = event.target.closest?.("a.xst");
      if (link) {
        const url = this.resolveHref(link.href, window.location.href);
        if (url) {
          return { url, title: (link.textContent || "").trim() || "查看帖子", element: link };
        }
      }
      const suhTd = event.target.closest?.("td.suh");
      if (suhTd) {
        const a = event.target.closest?.("a") || suhTd.querySelector("a");
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
      const titleDiv = event.target.closest?.("div.tittle_data");
      const link = titleDiv?.querySelector("a");
      if (!titleDiv || !link) return null;
      const url = this.resolveHref(link.href, window.location.href);
      if (!url) return null;
      return { url, title: link.title || (link.textContent || "").trim() || "查看博客", element: link };
    }
    _parseSpmatch(event) {
      const link = event.target.closest?.(".Nbbs-tiezi-lists a");
      if (!link) return null;
      const url = this.resolveHref(link.href, window.location.href);
      if (!url) return null;
      return { url, title: link.title || (link.textContent || "").trim() || "查看内容", element: link };
    }
    _parseGeneric(event) {
      const titleLink = event.target.closest?.(".Nbbs-tiezi-lists .middle-list-tittle a[href]");
      if (titleLink) {
        const url2 = this.resolveHref(titleLink.href, window.location.href);
        if (url2) {
          return { url: url2, title: titleLink.title || (titleLink.textContent || "").trim() || "查看帖子", element: titleLink };
        }
      }
      const block = event.target.closest?.(".Nbbs-tiezi-lists [data-topic-url]");
      if (block) {
        const url2 = this.resolveHref(block.dataset.topicUrl, window.location.href);
        if (url2) {
          const container2 = block.closest(".Nbbs-tiezi-lists");
          const titleA = container2?.querySelector(".middle-list-tittle a");
          const title = titleA?.title || (titleA?.textContent || "").trim() || "查看帖子";
          return { url: url2, title, element: block };
        }
      }
      const target = event.target;
      const titleDiv = target.closest?.("div.items-content-tittle.popup-trigger");
      const remarkDiv = target.closest?.("div.items-content-remark.popup-trigger");
      const container = titleDiv || remarkDiv;
      if (!container || !container.closest("div.items-list-content")) return null;
      let linkElement = null;
      let url = null;
      if (container.parentElement?.tagName === "A") {
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
      const link = event.target.closest?.("div.items-content-tittle a");
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
          const link = titleDataDiv?.querySelector("a");
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
        if (!containerDiv.closest("div.items-list-content")) return;
        let linkElement = null;
        let url = null;
        const innerLink = containerDiv.querySelector("a");
        if (innerLink) {
          linkElement = innerLink;
          url = this.resolveHref(innerLink.dataset.href, window.location.href) || this.resolveHref(innerLink.getAttribute("href"), window.location.href);
        } else if (containerDiv.parentElement?.tagName === "A") {
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
      const link = event.target.closest?.("a.title.raw-link.raw-topic-link");
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
      return hostname.includes("cili.");
    }
    parseClick(event) {
      const tableRow = event.target.closest?.("tr");
      if (!tableRow) return null;
      const firstTd = tableRow.querySelector("td:first-child");
      if (!firstTd || !firstTd.contains(event.target)) return null;
      const link = firstTd.querySelector("a");
      if (!link) return null;
      const url = this.resolveHref(link.href, window.location.href);
      if (!url) return null;
      const title = (link.querySelector("b")?.textContent || link.textContent || "").trim() || "查看内容";
      return { url, title, element: link };
    }
    enhance(doc) {
      doc.querySelectorAll("tr").forEach((row) => {
        const firstCell = row.querySelector("td:first-child");
        const link = firstCell?.querySelector("a");
        if (firstCell && link && link.href && !link.href.startsWith("javascript:")) {
          firstCell.classList.add("popup-trigger");
        }
      });
    }
  };

  // src/main.js
  var prefetch = new PrefetchManager(loaderManager);
  function registerAdapters() {
    siteManager.register(new DiscuzAdapter());
    siteManager.register(new TgbAdapter());
    siteManager.register(new LinuxAdapter());
    siteManager.register(new CiliAdapter());
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
        if (settingsManager.get().linkIntercept === false) return;
        siteManager.handleClick(e);
      },
      true
    );
    document.addEventListener(
      "mouseover",
      (e) => {
        if (settingsManager.get().linkIntercept === false) return;
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
      storageManager.addHistory({ url, title });
      popupManager.open({ url, title });
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
  function init() {
    settingsManager.load();
    if (isInIframe() && !settingsManager.get().allowInFrame) {
      return;
    }
    popupManager.popup.applyTheme(settingsManager.get().theme);
    popupManager.popup.ensure();
    registerAdapters();
    applyForumMarker();
    setupEvents();
    setupObserver();
    logger.log("Popup Viewer V2 已启用");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
