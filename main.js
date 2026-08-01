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

function init() {
  settingsManager.load();
  popupManager.popup.applyTheme(settingsManager.get().theme);
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
