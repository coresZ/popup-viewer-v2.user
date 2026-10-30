import { logger } from '../utils/logger.js';
import { PopupPanel } from '../ui/PopupPanel.js';
import { showLoading } from '../ui/Loading.js';
import { showError } from '../ui/ErrorView.js';
import { loaderManager } from './LoaderManager.js';

import { markMod, debugMark } from '../utils/debugFlag.js';
markMod('PopupManager');

export class PopupManager {
  constructor() {
    this.popup = new PopupPanel();
    this._abort = null;
    this._currentUrl = '';
    // 弹窗内浏览历史（← → 导航）
    this._navHistory = [];
    this._navIndex = -1;
    this._pendingNativeNav = false;
    this._pendingNativeTimer = null;
    this._pendingRevertIndex = -1;
    this._loadToken = 0;
    this._pendingDispose = null;
    this.popup.handlers = {
      onRefresh: (url) => {
        // 刷新 = 重建 iframe，原生历史清零，当前条目不再可原生回退
        const e = this._navHistory[this._navIndex];
        if (e) e.inFrame = false;
        this.load(url);
      },
      onOpenExternal: (url) => url && window.open(url, '_blank', 'noopener'),
      onOpenInWindow: (url, linkText) => {
        if (!url) return;
        this._pushHistory(url, linkText || '');
        this._currentUrl = url;
        if (linkText) this.popup.setTitle(linkText);
        this.popup.updateFooterUrl(url);
        this.load(url);
        this._syncNavState();
      },
      onBack: () => this.back(),
      onForward: () => this.forward(),
      onClose: () => {
        // 工具栏 ✕、遮罩、Esc 都走这里：清理加载器并清空弹窗内历史，
        // 否则下次打开会接着旧历史，后退按钮一打开就可点
        this._deferDispose();
        this._resetHistory();
      }
    };
  }
  /**
   * 打开弹窗并加载内容。
   */
  open({ url, title }) {
    debugMark('popup.open: ' + url);
    this._pushHistory(url, title || '');
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
      if (win && win.history && typeof win.history.back === 'function') {
        win.history.back();
        return true;
      }
    } catch {}
    return false;
  }
  _nativeHistoryForward() {
    try {
      const iframe = this._currentIframe();
      const win = iframe && iframe.contentWindow;
      if (win && win.history && typeof win.history.forward === 'function') {
        win.history.forward();
        return true;
      }
    } catch {}
    return false;
  }
  _currentIframe() {
    try {
      const iframe = this.popup.getContentArea().querySelector('#popup-panel-iframe');
      return iframe && iframe.isConnected ? iframe : null;
    } catch {
      return null;
    }
  }
  _markPendingNativeNav(revertIndex) {
    this._pendingNativeNav = true;
    this._pendingRevertIndex = revertIndex;
    clearTimeout(this._pendingNativeTimer);
    // 原生导航未产生 URL 变化（如已到头/被拒）：回滚索引，保持界面与历史一致
    this._pendingNativeTimer = setTimeout(() => {
      if (this._pendingNativeNav) {
        this._pendingNativeNav = false;
        this._navIndex = this._pendingRevertIndex;
        this._applyEntry(this._navHistory[this._navIndex]);
      }
    }, 2000);
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
    entry.inFrame = false; // 重新加载 = 新 iframe，原生历史从零开始
    this._currentUrl = entry.url;
    this.popup.setTitle(entry.title);
    this.popup.updateFooterUrl(entry.url);
    this.load(entry.url);
    this._syncNavState();
  }
  _pushHistory(url, title, inFrame = false) {
    // 新导航：截断前进分支
    this._navHistory = this._navHistory.slice(0, this._navIndex + 1);
    this._navHistory.push({ url, title: title || '查看内容', inFrame });
    this._navIndex = this._navHistory.length - 1;
    // 上限 50 条，防内存膨胀
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
    // 占位标题（旧版模板写的 Content、空串）不覆盖已有标题
    if (/^(content|about:blank)?$/i.test(String(title || '').trim())) title = '';
    if (wasNative) {
      // 原生 back/forward 触发的 URL 变化：原位更新当前条目（SPA 下 URL 可能与记录略有差异）
      const entry = this._navHistory[this._navIndex];
      if (entry) {
        entry.url = url;
        if (title) entry.title = title;
      }
    } else {
      this._pushHistory(url, title || '', true);
    }
    this._currentUrl = url;
    const cur = this._navHistory[this._navIndex];
    this.popup.setTitle((cur && cur.title) || title || '查看内容');
    this.popup.updateFooterUrl(url);
    this._syncNavState();
  }
  /**
   * 加载指定 URL 内容到弹窗内容区。
   */
  load(url) {
    debugMark('popup.load: ' + url);
    this._flushDispose();
    this._abort?.();
    this._abort = null;
    // 每次加载一个令牌：旧请求的迟到回调（错误、完成、跳转）不能写进新内容
    const token = ++this._loadToken;
    const current = () => token === this._loadToken;
    const contentArea = this.popup.getContentArea();
    contentArea.classList.remove('iframe-direct-load');
    contentArea.innerHTML = '';
    showLoading(contentArea, { url });
    let hostname = 'unknown';
    try {
      hostname = new URL(url).hostname;
    } catch {}
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
      onLoad: () => {},
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
      logger.warn('[PopupManager] dispose error', err);
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
    // 走 PopupPanel.close → handlers.onClose 统一清理
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
