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
import { GithubAdapter } from './adapters/GithubAdapter.js';
import { CiliAdapter } from './adapters/CiliAdapter.js';

const prefetch = new PrefetchManager(loaderManager);
let hangingDetached = false;

function registerAdapters() {
  siteManager.register(new DiscuzAdapter());
  siteManager.register(new TgbAdapter());
  siteManager.register(new LinuxAdapter());
  siteManager.register(new GithubAdapter());
  siteManager.register(new CiliAdapter());
}

function isHangingDetached() {
  return hangingDetached || settingsManager.get().hangingMode === true;
}

function setupEvents() {
  document.addEventListener(
    'click',
    (e) => {
      if (isHangingDetached()) return;
      siteManager.handleClick(e);
    },
    true
  );
  document.addEventListener(
    'mouseover',
    (e) => {
      if (isHangingDetached()) return;
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
    if (settings.hangingMode) {
      popupManager.hideOverlay();
      enterHangingDetached();
    } else {
      popupManager.showOverlay();
      exitHangingDetached();
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

function stopObserver() {
  observer?.disconnect();
  observer = null;
}

function enterHangingDetached() {
  if (hangingDetached) return;
  hangingDetached = true;
  popupManager.hideOverlay();
  stopObserver();
  document.documentElement.classList.add('pv-detached');
  document.querySelectorAll('.popup-trigger').forEach((el) => el.classList.remove('popup-trigger'));
  logger.log('固定悬挂模式：入口已关闭，脱离页面监听');
}

function exitHangingDetached() {
  if (!hangingDetached) return;
  hangingDetached = false;
  document.documentElement.classList.remove('pv-detached');
  startObserver();
  siteManager.runEnhancements();
  logger.log('固定悬挂模式：已恢复页面监听');
}

function init() {
  settingsManager.load();
  registerAdapters();
  setupEvents();
  setupObserver();
  logger.log('Popup Viewer V2 已启用');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
