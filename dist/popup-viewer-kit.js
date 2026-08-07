var __PopupKitModule = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/kit/popupKit.js
  var popupKit_exports = {};
  __export(popupKit_exports, {
    PopupKit: () => kit
  });

  // src/kit/kit.css
  var kit_default = "/* PopupKit 独立样式：pvk- 前缀，与 popup-viewer-v2 主脚本（popup-/pv-）\n   及 page-picker-kit（ppk-）完全隔离，避免同页多脚本 ID/CSS 冲突。\n   自包含 loading/error/spinner，不依赖主脚本 Loading.js/ErrorView.js 的样式。 */\n@layer pvk-reset {\n  #pvk-panel,\n  #pvk-panel *,\n  #pvk-overlay,\n  #pvk-loading,\n  #pvk-loading *,\n  #pvk-error,\n  #pvk-error *,\n  .pvk-btn {\n    box-sizing: border-box;\n    margin: 0;\n    padding: 0;\n    border: 0;\n    outline: 0;\n    background: transparent;\n    vertical-align: baseline;\n    text-decoration: none;\n    text-shadow: none;\n    font-family: inherit;\n    font-size: inherit;\n    font-weight: inherit;\n    font-style: inherit;\n    line-height: inherit;\n    letter-spacing: inherit;\n    color: inherit;\n    text-align: left;\n  }\n}\n\n#pvk-panel {\n  box-sizing: border-box;\n}\n\n:root {\n  --pvk-accent: #2563eb;\n  --pvk-accent-hover: #1d4ed8;\n  --pvk-accent-soft: rgba(37, 99, 235, 0.1);\n  --pvk-danger: #dc2626;\n  --pvk-danger-soft: rgba(220, 38, 38, 0.1);\n  --pvk-header-bg: #fafbfc;\n  --pvk-border: #e4e7ec;\n  --pvk-text: #1a2233;\n  --pvk-muted: #64748b;\n  --pvk-faint: #94a3b8;\n  --pvk-bg: #ffffff;\n  --pvk-surface: #ffffff;\n  --pvk-btn-bg: rgba(15, 23, 42, 0.07);\n  --pvk-btn-hover: rgba(15, 23, 42, 0.12);\n  --pvk-btn-active: rgba(15, 23, 42, 0.17);\n  --pvk-focus-ring: rgba(37, 99, 235, 0.4);\n  --pvk-shadow:\n    0 0 0 1px rgba(15, 23, 42, 0.04),\n    0 24px 60px -18px rgba(15, 23, 42, 0.28),\n    0 8px 24px -12px rgba(15, 23, 42, 0.16);\n  --pvk-overlay: rgba(15, 23, 42, 0.28);\n}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n    --pvk-accent: #60a5fa;\n    --pvk-accent-hover: #93c5fd;\n    --pvk-accent-soft: rgba(96, 165, 250, 0.14);\n    --pvk-danger: #f87171;\n    --pvk-danger-soft: rgba(248, 113, 113, 0.14);\n    --pvk-header-bg: #121a2b;\n    --pvk-border: #263247;\n    --pvk-text: #e2e8f0;\n    --pvk-muted: #94a3b8;\n    --pvk-faint: #64748b;\n    --pvk-bg: #0f172a;\n    --pvk-surface: #151e30;\n    --pvk-btn-bg: rgba(148, 163, 184, 0.14);\n    --pvk-btn-hover: rgba(148, 163, 184, 0.22);\n    --pvk-btn-active: rgba(148, 163, 184, 0.28);\n    --pvk-focus-ring: rgba(96, 165, 250, 0.5);\n    --pvk-shadow:\n      0 0 0 1px rgba(255, 255, 255, 0.04),\n      0 28px 70px -20px rgba(0, 0, 0, 0.72),\n      0 10px 28px -14px rgba(0, 0, 0, 0.5);\n    --pvk-overlay: rgba(0, 0, 0, 0.52);\n  }\n}\n\n/* 面板核心 */\n#pvk-panel {\n  position: fixed;\n  z-index: 10000;\n  width: 50%;\n  height: 75%;\n  max-width: min(2560px, calc(100vw - 24px));\n  max-height: min(1440px, calc(100vh - 24px));\n  max-height: min(1440px, calc(100dvh - 24px));\n  top: 50%;\n  left: 50%;\n  overscroll-behavior: contain;\n  transform: translate(-50%, -50%) scale(0.96);\n  transform-origin: center;\n  background-color: var(--pvk-surface);\n  color: var(--pvk-text);\n  box-shadow: var(--pvk-shadow);\n  border: 1px solid var(--pvk-border);\n  border-radius: 12px;\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\n    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);\n}\n#pvk-panel.visible {\n  opacity: 1;\n  pointer-events: auto;\n  transform: translate(-50%, -50%) scale(1);\n}\n\n/* 头部 */\n#pvk-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 0 10px 0 14px;\n  background-color: var(--pvk-header-bg);\n  border-bottom: 1px solid var(--pvk-border);\n  height: 46px;\n  min-height: 46px;\n  flex: 0 0 auto;\n  cursor: grab;\n  user-select: none;\n}\n#pvk-header:active {\n  cursor: grabbing;\n}\n#pvk-title {\n  display: flex;\n  align-items: center;\n  gap: 9px;\n  min-width: 0;\n  flex: 1;\n}\n.pvk-title-mark {\n  flex: 0 0 auto;\n  width: 26px;\n  height: 26px;\n  border-radius: 8px;\n  background: var(--pvk-accent-soft);\n  color: var(--pvk-accent);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n.pvk-title-mark svg {\n  width: 15px;\n  height: 15px;\n  fill: none;\n  stroke: currentColor;\n}\n.pvk-title-text {\n  font-size: 14px;\n  font-weight: 600;\n  letter-spacing: 0.1px;\n  color: var(--pvk-text);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n#pvk-actions {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  flex: 0 0 auto;\n}\n.pvk-btn {\n  width: 32px;\n  height: 32px;\n  padding: 0;\n  border: 1px solid transparent;\n  border-radius: 9px;\n  background-color: var(--pvk-btn-bg);\n  color: var(--pvk-muted);\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex: 0 0 auto;\n  transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;\n}\n.pvk-btn svg {\n  width: 16px;\n  height: 16px;\n  fill: none;\n  stroke: currentColor;\n  pointer-events: none;\n}\n.pvk-btn:hover {\n  background-color: var(--pvk-btn-hover);\n  color: var(--pvk-text);\n}\n.pvk-btn:active {\n  transform: scale(0.92);\n}\n.pvk-btn:focus-visible {\n  outline: 2px solid var(--pvk-focus-ring);\n  outline-offset: 1px;\n}\n#pvk-close:hover {\n  color: var(--pvk-danger);\n  background-color: var(--pvk-danger-soft);\n}\n#pvk-actions .pvk-btn:hover {\n  color: var(--pvk-accent);\n  background-color: var(--pvk-accent-soft);\n}\n\n/* 内容区 */\n#pvk-content {\n  flex: 1;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  position: relative;\n  background-color: var(--pvk-bg);\n  padding: 20px;\n  box-sizing: border-box;\n  scroll-behavior: smooth;\n  scrollbar-width: thin;\n  scrollbar-color: var(--pvk-faint) transparent;\n}\n#pvk-content::-webkit-scrollbar {\n  width: 8px;\n}\n#pvk-content::-webkit-scrollbar-thumb {\n  background-color: var(--pvk-faint);\n  border-radius: 8px;\n  border: 2px solid transparent;\n  background-clip: padding-box;\n}\n#pvk-content.iframe-direct-load {\n  padding: 0;\n}\n#pvk-iframe {\n  width: 100%;\n  height: 100%;\n  border: none;\n  background-color: #fff;\n}\n\n/* 遮罩 */\n#pvk-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 9998;\n  background-color: var(--pvk-overlay);\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.3s ease-in-out;\n  backdrop-filter: blur(6px);\n  -webkit-backdrop-filter: blur(6px);\n}\n#pvk-overlay.visible {\n  opacity: 1;\n  pointer-events: auto;\n}\n\n/* 加载状态 */\n#pvk-loading {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n  color: var(--pvk-muted);\n  padding: 25px;\n}\n.pvk-spinner {\n  width: 38px;\n  height: 38px;\n  margin-bottom: 20px;\n  border: 3px solid var(--pvk-accent-soft);\n  border-radius: 50%;\n  border-top: 3px solid var(--pvk-accent);\n  animation: pvk-spin 0.8s linear infinite;\n}\n@keyframes pvk-spin {\n  0% {\n    transform: rotate(0deg);\n  }\n  100% {\n    transform: rotate(360deg);\n  }\n}\n.pvk-loading-hint {\n  font-size: 15px;\n  font-weight: 500;\n  color: var(--pvk-text);\n}\n.pvk-loading-sub {\n  margin-top: 8px;\n  font-size: 13px;\n  color: var(--pvk-faint);\n}\n\n/* 错误状态 */\n#pvk-error {\n  padding: 35px;\n  color: var(--pvk-text);\n  text-align: center;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n  box-sizing: border-box;\n}\n#pvk-error .pvk-error-icon {\n  color: var(--pvk-danger);\n  margin-bottom: 6px;\n}\n#pvk-error h3 {\n  margin-top: 16px;\n  margin-bottom: 10px;\n  font-weight: 600;\n  font-size: 1.15em;\n}\n#pvk-error p {\n  margin-bottom: 24px;\n  color: var(--pvk-muted);\n  max-width: 420px;\n  line-height: 1.6;\n  word-break: break-all;\n}\n#pvk-error button {\n  padding: 10px 20px;\n  background: var(--pvk-accent);\n  color: #fff;\n  border: none;\n  border-radius: 8px;\n  cursor: pointer;\n  font-weight: 500;\n  font-size: 14px;\n  transition: background 0.15s ease-in-out, transform 0.1s ease-in-out;\n}\n#pvk-error button:hover {\n  background: var(--pvk-accent-hover);\n}\n#pvk-error button:active {\n  transform: scale(0.97);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  #pvk-panel,\n  #pvk-overlay {\n    transition: none;\n  }\n  .pvk-spinner {\n    animation-duration: 1.6s;\n  }\n}\n@media (max-width: 560px), (max-height: 560px) {\n  #pvk-panel {\n    max-width: calc(100vw - 16px);\n    max-height: calc(100vh - 16px);\n  }\n}\n";

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
      "data-img"
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
  var KEY = "pv2:settings";
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
      const g = gm.getValue(KEY, null);
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
      gm.setValue(KEY, this.global);
      const all = gm.getValue(SITE_KEY, null) || {};
      all[this.siteKey] = this.site;
      gm.setValue(SITE_KEY, all);
    }
  };
  var settingsManager = new SettingsManager();

  // src/loaders/IframeRenderer.js
  var IMG_REAL_ATTRS = [
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
      if (!cur || img.complete && img.naturalWidth === 0) {
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

  // src/kit/KitPopupPanel.js
  var KitPopupPanel = class {
    constructor() {
      this.panel = null;
      this.overlay = null;
      this.titleTextEl = null;
      this.contentArea = null;
      this.maximizeBtn = null;
      this.currentUrl = "";
      this.currentTitle = "";
      this.currentSize = null;
      this.isFullScreen = false;
      this.preFullScreen = {};
      this._abort = null;
      this._onOpen = null;
      this._onClose = null;
      this._onRefresh = null;
    }
    setHandlers({ onOpen, onClose, onRefresh } = {}) {
      this._onOpen = onOpen;
      this._onClose = onClose;
      this._onRefresh = onRefresh;
    }
    ensure() {
      if (this.panel) return this.panel;
      this.overlay = el("div", { id: "pvk-overlay", onclick: () => this.close() });
      document.body.appendChild(this.overlay);
      const titleMark = el("span", { class: "pvk-title-mark" });
      titleMark.appendChild(svgIcon("article", { size: 15 }));
      this.titleTextEl = el("span", { class: "pvk-title-text", text: "查看内容" });
      const title = el("div", { id: "pvk-title" }, titleMark, this.titleTextEl);
      const actions = el("div", { id: "pvk-actions" });
      const makeBtn = (icon, titleText, onClick) => {
        const btn = el("button", { type: "button", class: "pvk-btn", title: titleText, onclick: onClick });
        btn.appendChild(svgIcon(icon, { size: 16 }));
        actions.appendChild(btn);
        return btn;
      };
      makeBtn("refresh", "刷新内容 (R)", () => this.refresh());
      this.maximizeBtn = makeBtn("maximize", "全屏 (F)", () => this.toggleFullScreen());
      makeBtn("external", "在新标签页打开", () => {
        if (this.currentUrl) window.open(this.currentUrl, "_blank", "noopener");
      });
      const closeBtn = makeBtn("close", "关闭 (Esc)", () => this.close());
      closeBtn.id = "pvk-close";
      const header = el("div", { id: "pvk-header" }, title, actions);
      this.contentArea = el("div", { id: "pvk-content" });
      this.panel = el("div", { id: "pvk-panel" }, header, this.contentArea);
      document.body.appendChild(this.panel);
      this._setupDrag(header);
      this._setupKeyboard();
      return this.panel;
    }
    /**
     * @param {{url:string,title?:string,width?:string,height?:string,load:Function}} opts
     *        load(container,{onError,onLoad}) 返回 abort
     */
    open(opts) {
      this.ensure();
      this.currentUrl = opts.url || "";
      this.currentTitle = opts.title || "查看内容";
      this.currentSize = { width: opts.width, height: opts.height };
      this._lastOpen = opts;
      this.titleTextEl.textContent = this.currentTitle;
      this.panel.classList.remove("visible");
      this.isFullScreen = false;
      this._updateMaximizeIcon();
      if (this.currentSize) {
        this.panel.style.setProperty("width", this.currentSize.width || "50%");
        this.panel.style.setProperty("height", this.currentSize.height || "75%");
      } else {
        this.panel.style.removeProperty("width");
        this.panel.style.removeProperty("height");
      }
      if (!this._dragged) {
        this.panel.style.left = "";
        this.panel.style.top = "";
        this.panel.style.transform = "";
      }
      requestAnimationFrame(() => {
        this.panel.classList.add("visible");
        this.overlay.classList.add("visible");
        this._onOpen?.(opts);
      });
      this._load(opts);
    }
    _load(opts) {
      this._abort?.();
      this._abort = null;
      const content = this.getContentArea();
      content.classList.remove("iframe-direct-load");
      content.innerHTML = "";
      this._showLoading(content);
      const abort = opts.load(content, {
        onError: (message) => {
          this._abort = null;
          this._showError(content, message);
        },
        onLoad: () => {
          this._abort = null;
        }
      });
      this._abort = abort || null;
    }
    refresh() {
      if (!this.currentUrl || !this._lastOpen) return;
      const prev = this._lastOpen;
      this._abort?.();
      this._abort = null;
      const content = this.getContentArea();
      content.classList.remove("iframe-direct-load");
      content.innerHTML = "";
      this._showLoading(content);
      this._onRefresh?.(this.currentUrl);
      this._load(prev);
    }
    close() {
      if (!this.panel) return;
      this._abort?.();
      this._abort = null;
      this.panel.classList.remove("visible");
      this.overlay.classList.remove("visible");
      const url = this.currentUrl;
      setTimeout(() => {
        if (this.contentArea) this.contentArea.innerHTML = "";
        this.currentUrl = "";
      }, 350);
      this._onClose?.({ url });
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
      this._updateMaximizeIcon();
    }
    _updateMaximizeIcon() {
      if (!this.maximizeBtn) return;
      this.maximizeBtn.innerHTML = "";
      this.maximizeBtn.appendChild(svgIcon(this.isFullScreen ? "minimize" : "maximize", { size: 16 }));
      this.maximizeBtn.title = this.isFullScreen ? "恢复 (F)" : "全屏 (F)";
    }
    _setupDrag(header) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;
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
        this._dragged = true;
        this._clampToViewport();
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
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
      document.addEventListener("keydown", (e) => {
        if (!this.panel || !this.panel.classList.contains("visible")) return;
        if (e.key === "Escape") this.close();
        else if (e.key === "f" || e.key === "F") this.toggleFullScreen();
        else if (e.key === "r" || e.key === "R") {
          if (this.currentUrl && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.refresh();
          }
        }
      });
      window.addEventListener("resize", () => {
        if (this.panel && this.panel.classList.contains("visible")) {
          requestAnimationFrame(() => this._clampToViewport());
        }
      });
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
    _showLoading(container) {
      container.replaceChildren(
        el(
          "div",
          { id: "pvk-loading" },
          el("div", { class: "pvk-spinner" }),
          el("div", { class: "pvk-loading-hint", text: "正在加载内容..." }),
          el("div", { class: "pvk-loading-sub", text: "请稍候片刻" })
        )
      );
    }
    _showError(container, message) {
      const openBtn = el("button", { text: "在新标签页打开" });
      if (this.currentUrl) {
        openBtn.addEventListener("click", () => window.open(this.currentUrl, "_blank", "noopener"));
      } else {
        openBtn.disabled = true;
      }
      container.replaceChildren(
        el(
          "div",
          { id: "pvk-error" },
          svg(
            '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
            { class: "pvk-error-icon", width: 52, height: 52, "stroke-width": 1.5 }
          ),
          el("h3", { text: "加载失败" }),
          el("p", { text: message || "无法加载请求的内容" }),
          openBtn
        )
      );
    }
  };

  // src/kit/popupKit.js
  function createPopupKit() {
    gm.addStyle(kit_default);
    const loaderManager2 = new LoaderManager();
    const panel = new KitPopupPanel();
    panel.setHandlers({
      onOpen: (opts) => {
        kit2._onOpen?.({ url: opts.url, title: opts.title });
      },
      onClose: (info) => {
        kit2._onClose?.(info);
      }
    });
    function hostnameOf(url) {
      try {
        return new URL(url).hostname;
      } catch {
        return "unknown";
      }
    }
    const kit2 = {
      version: "1.1.0",
      /**
       * 在页内弹窗打开一个 URL（多加载器自动选择：iframe 直载 / 抓取净化 / 缓存）。
       * @param {{url:string,title?:string,width?:string,height?:string,linkIntercept?:boolean}} opts
       */
      open(opts) {
        const url = opts && opts.url;
        if (!url) return false;
        const title = (opts.title || "").trim() || "查看内容";
        panel.open({
          url,
          title,
          width: opts.width,
          height: opts.height,
          load: (container, { onError, onLoad }) => {
            const hostname = hostnameOf(url);
            return loaderManager2.load(url, {
              container,
              hostname,
              keepScripts: loaderManager2._keepScripts(hostname),
              linkIntercept: opts.linkIntercept,
              loadingSelector: "#pvk-loading",
              onError,
              onLoad
            });
          }
        });
        return true;
      },
      close() {
        panel.close();
      },
      /** 刷新当前内容（保持窗体位置与尺寸） */
      refresh() {
        panel.refresh();
      },
      /** 当前是否已打开 */
      isOpen() {
        return !!panel.panel && panel.panel.classList.contains("visible");
      },
      /** 是否有缓存内容（供宿主脚本悬停预热判断） */
      hasCached(url) {
        return loaderManager2.hasCached(url);
      },
      /** 后台预热某个 URL（点击时立即渲染） */
      prefetch(url) {
        loaderManager2.prefetch(url);
      },
      get config() {
        return config;
      },
      // 生命周期回调（由宿主脚本设置）
      _onOpen: null,
      _onClose: null
    };
    return kit2;
  }
  var kit = createPopupKit();
  if (typeof window !== "undefined") {
    window.PopupKit = kit;
  }
  return __toCommonJS(popupKit_exports);
})();
