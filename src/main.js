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

const prefetch = new PrefetchManager(loaderManager);

function registerAdapters() {
  siteManager.register(new DiscuzAdapter());
  siteManager.register(new TgbAdapter());
  siteManager.register(new LinuxAdapter());
  siteManager.register(new CiliAdapter());
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
      if (settingsManager.get().linkIntercept === false) return;
      siteManager.handleClick(e);
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
    storageManager.addHistory({ url, title });
    popupManager.open({ url, title });
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

function init() {
  settingsManager.load();
  // 未开启「在 iframe 中运行」时，iframe 内跳过初始化（运行时等价 @noframes）
  if (isInIframe() && !settingsManager.get().allowInFrame) {
    return;
  }
  popupManager.popup.applyTheme(settingsManager.get().theme);
  // 立即构建 UI（含右下角设置按钮/规则面板），未匹配内置适配器的网站也能访问设置与规则
  popupManager.popup.ensure();
  registerAdapters();
  applyForumMarker();
  setupEvents();
  setupObserver();
  logger.log('Popup Viewer V2 已启用');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
