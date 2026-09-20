import { config } from './config.js';
import { logger } from './utils/logger.js';
import { debounce } from './utils/debounce.js';
import { eventBus } from './core/EventBus.js';
import { siteManager } from './core/SiteManager.js';
import { loaderManager } from './core/LoaderManager.js';
import { popupManager } from './core/PopupManager.js';
import { storageManager } from './core/StorageManager.js';
import { PrefetchManager } from './core/PrefetchManager.js';
import { settingsManager } from './core/SettingsManager.js';
import { DiscuzAdapter } from './adapters/DiscuzAdapter.js';
import { TgbAdapter } from './adapters/TgbAdapter.js';
import { LinuxAdapter } from './adapters/LinuxAdapter.js';
import { CiliAdapter } from './adapters/CiliAdapter.js';
import { XAdapter } from './adapters/XAdapter.js';
import { installXBridge, pageWindow, captureState } from './x/xBridge.js';
import { parseThreadSummary } from './x/xModel.js';
import { readXTheme } from './x/xTheme.js';
import { XThreadLoader } from './loaders/XThreadLoader.js';
import { debugMark, showErr } from './utils/debugFlag.js';
import { hijacksFixed } from './utils/dom.js';

const prefetch = new PrefetchManager(loaderManager);

function registerAdapters() {
  siteManager.register(new DiscuzAdapter());
  siteManager.register(new TgbAdapter());
  siteManager.register(new LinuxAdapter());
  siteManager.register(new CiliAdapter());
  siteManager.register(new XAdapter());
}

const X_HOSTS = /(^|\.)(x|twitter)\.com$/i;

// X 专用：安装 GraphQL 网络层（页面上下文补丁 fetch/XHR + webpack operation 发现），
// 并暴露控制台自检入口。弹窗渲染走 C3 的 XThreadLoader，本阶段只做数据层验证。
function installXSupport() {
  if (!X_HOSTS.test(window.location.hostname)) return;
  // X 的 GraphQL 层依赖当前页面的 webpack runtime 与登录会话，只在 x.com 页面注册
  loaderManager.register('xthread', new XThreadLoader());
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
    // 定位自检：面板是否被宿主页面的 transform / CSS 影响而无法居中
    positionDiag: () => {
      const panel = document.getElementById('popup-content-panel');
      const panelStyle = panel ? getComputedStyle(panel) : null;
      const rect = panel ? panel.getBoundingClientRect() : null;
      const bodyStyle = getComputedStyle(document.body);
      const htmlStyle = getComputedStyle(document.documentElement);
      return {
        panel: panelStyle
          ? {
              position: panelStyle.position,
              top: panelStyle.top,
              left: panelStyle.left,
              transform: panelStyle.transform,
              width: panelStyle.width,
              height: panelStyle.height
            }
          : null,
        rect: rect
          ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
          : null,
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
      const panel = document.getElementById('popup-content-panel');
      const area = document.getElementById('popup-content-area');
      const reader = document.querySelector('.pv-x-reader');
      let xRulesFound = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (Array.from(sheet.cssRules).some((rule) => String(rule.selectorText || '').includes('pv-x-reader'))) {
            xRulesFound = true;
            break;
          }
        } catch (err) {
          // 跨域样式表读不到 cssRules，跳过
        }
      }
      return {
        hasPanel: Boolean(panel),
        panelPosition: panel ? getComputedStyle(panel).position : null,
        areaClasses: area ? Array.from(area.classList) : [],
        // 内容区第一个子元素的类名：pv-x-reader = 走了 X 渲染器；有 iframe = 走了抓取渲染
        areaFirstChildClass: area && area.firstElementChild ? area.firstElementChild.className : null,
        areaHtmlHead: area ? area.innerHTML.slice(0, 160) : null,
        hasIframe: Boolean(area && area.querySelector('iframe')),
        loaderModes: Object.keys(loaderManager.loaders),
        readerFound: Boolean(reader),
        readerDisplay: reader ? getComputedStyle(reader).display : null,
        adoptedSheets: 'adoptedStyleSheets' in document ? document.adoptedStyleSheets.length : 'unsupported',
        styleElementCount: document.querySelectorAll('style').length,
        xRulesFound
      };
    }
  };
  try {
    win.__PV2_X__ = api;
  } catch (err) {
    logger.warn('[main] expose __PV2_X__ failed', err);
  }
  logger.log('[PV2] X GraphQL 网络层已安装');
}

// Discuz 类论坛需要「基础链接样式优化」，加标记类避免通用选择器污染其它站点
function applyForumMarker() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  if (siteManager.activeAdapters(hostname, pathname).some((a) => a.forumStyles)) {
    document.documentElement.classList.add('pv-forum');
  }
}

function setupEvents() {
  document.addEventListener(
    'click',
    (e) => {
      if (settingsManager.get().linkIntercept === false) {
        debugMark('click: intercept off');
        return;
      }
      try {
        const handled = siteManager.handleClick(e);
        debugMark('click: ' + (handled ? 'HANDLED' : 'no-match'));
      } catch (err) {
        logger.error('[click] handleClick error', err);
        showErr('click', err);
      }
    },
    true
  );
  document.addEventListener(
    'mouseover',
    (e) => {
      if (settingsManager.get().linkIntercept === false) return;
      // 廉价前置判断：仅在可能命中链接的元素上才进入完整解析，
      // 避免 @match *://*/* 下每次鼠标划过任意元素都跑一遍规则/适配器解析
      const target = e.target;
      if (!target || !target.closest) return;
      if (!target.closest('a, [data-topic-url], [data-href], td.suh, .popup-trigger, .xst')) return;
      const hostname = window.location.hostname;
      let candidate = null;
      try {
        candidate = siteManager.resolveCandidate(e);
      } catch (err) {
        logger.error('[mouseover] resolveCandidate error', err);
      }
      if (candidate) prefetch.schedule(candidate.url, hostname);
    },
    true
  );
  eventBus.on('open-page', ({ url, title }) => {
    try {
      debugMark('open-page: ' + url);
      storageManager.addHistory({ url, title });
      popupManager.open({ url, title });
    } catch (err) {
      logger.error('[open-page] open error', err);
      showErr('open-page', err);
    }
  });
  eventBus.on('settings-changed', (settings) => {
    if (settings.windowMode === 'float') {
      popupManager.hideOverlay();
    } else {
      popupManager.showOverlay();
    }
  });
}

let observer = null;
let debouncedRunEnhancements = null;

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

// 判断当前文档是否为脚本自己的弹窗 iframe（同源时 frameElement 指向 iframe 元素，
// 导航后依然有效；另兼容写入内容的 iframe 上打的标记）
function isOwnPopupIframe() {
  try {
    if (window.__PV2_OWN_IFRAME__) return true;
    const fe = window.frameElement;
    return !!(fe && fe.id === 'popup-panel-iframe');
  } catch {
    return false;
  }
}

function init() {
  // 自己的弹窗 iframe：即使开启「在 iframe 中运行」也不重复注入（防弹窗套弹窗）
  if (isOwnPopupIframe()) {
    debugMark('skipped: own iframe');
    return;
  }
  settingsManager.load();
  // 未开启「在 iframe 中运行」时，iframe 内跳过初始化（运行时等价 @noframes）
  if (isInIframe() && !settingsManager.get().allowInFrame) {
    debugMark('skipped: iframe');
    return;
  }
  popupManager.popup.applyTheme(settingsManager.get().theme);
  // 立即构建 UI（含右下角设置按钮/规则面板），未匹配内置适配器的网站也能访问设置与规则
  popupManager.popup.ensure();
  registerAdapters();
  installXSupport();
  applyForumMarker();
  setupEvents();
  setupObserver();
  debugMark('init ok');
  logger.log('Popup Viewer V2 已启用');
}

function safeInit() {
  if (window.__PV2_INIT__) return; // 防重复（正常事件 + 超时兜底可能先后触发）
  window.__PV2_INIT__ = true;
  try {
    init();
  } catch (err) {
    logger.error('[main] init error', err);
    debugMark('init error: ' + (err && err.message ? err.message : err));
  }
}

debugMark('main-body ok');

function bootstrap() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
    // 兜底：部分沙箱环境（如 iOS Userscripts）DOMContentLoaded 可能不触发，
    // 1.5 秒后未初始化则强制执行
    setTimeout(() => {
      if (!window.__PV2_INIT__) safeInit();
    }, 1500);
  } else {
    safeInit();
  }
}
bootstrap();
