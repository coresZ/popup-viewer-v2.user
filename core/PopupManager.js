import { logger } from '../utils/logger.js';
import { PopupPanel } from '../ui/PopupPanel.js';
import { showLoading } from '../ui/Loading.js';
import { showError } from '../ui/ErrorView.js';
import { loaderManager } from './LoaderManager.js';

export class PopupManager {
  constructor() {
    this.popup = new PopupPanel();
    this._abort = null;
    this._currentUrl = '';
    this.popup.handlers = {
      onRefresh: (url) => this.load(url),
      onOpenExternal: (url) => url && window.open(url, '_blank', 'noopener'),
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
    contentArea.classList.remove('iframe-direct-load');
    contentArea.innerHTML = '';
    showLoading(contentArea);
    let hostname = 'unknown';
    try {
      hostname = new URL(url).hostname;
    } catch {}
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
}

export const popupManager = new PopupManager();
