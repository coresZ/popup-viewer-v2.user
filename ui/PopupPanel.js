import { config } from '../config.js';
import { gm } from '../utils/gm.js';
import { el, svgIcon } from '../utils/dom.js';
import { settingsManager } from '../core/SettingsManager.js';
import { createToolbar } from './Toolbar.js';
import { createSettingsPanel } from './SettingsPanel.js';
import style from './style.css';

export class PopupPanel {
  constructor() {
    gm.addStyle(style);
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
    this.currentUrl = '';
    this.isFullScreen = false;
    this.preFullScreen = {};
    this.handlers = {};
    this._onKeydownBound = null;
  }
  ensure() {
    if (this.panel) return this.panel;
    this.overlay = el('div', { id: 'popup-panel-overlay', onclick: () => this.close() });
    document.body.appendChild(this.overlay);
    const titleMark = el('span', { class: 'pv-title-mark' });
    titleMark.appendChild(svgIcon('article', { size: 15 }));
    this.titleTextEl = el('span', { class: 'pv-title-text', text: '查看内容' });
    this.titleEl = el('div', { id: 'popup-panel-title' }, titleMark, this.titleTextEl);
    this.toolbar = createToolbar({
      onRefresh: () => this.handlers.onRefresh?.(this.currentUrl),
      onMaximize: () => this.toggleFullScreen(),
      onOpenExternal: () => this.handlers.onOpenExternal?.(this.currentUrl),
      onClose: () => this.close(),
      onSettings: () => {
        if (this.settingsPopover?.classList.contains('visible')) {
          this.hideSettings();
          return;
        }
        this.showSettingsNear(this.settingsBtn.getBoundingClientRect());
      }
    });
    this.settingsBtn = this.toolbar.settings;
    const header = el('div', { id: 'popup-panel-header' }, this.titleEl, this.toolbar.actions);
    this.contentArea = el('div', { id: 'popup-content-area' });
    this.footerUrlEl = el('span', { id: 'popup-panel-footer-url' });
    const footerOpen = el('button', {
      id: 'popup-panel-footer-open',
      class: 'popup-panel-btn',
      title: '在新标签页打开',
      onclick: () => this.handlers.onOpenExternal?.(this.currentUrl)
    });
    footerOpen.appendChild(svgIcon('external', { size: 14 }));
    this.footer = el('div', { id: 'popup-panel-footer' }, this.footerUrlEl, footerOpen);
    this.panel = el('div', { id: 'popup-content-panel' }, header, this.contentArea, this.footer);
    document.body.appendChild(this.panel);
    this.floatBtn = el('button', { id: 'pv-float-settings', title: '脚本设置' });
    this.floatBtn.appendChild(svgIcon('settings', { size: 16 }));
    this.floatBtn.addEventListener('click', () => {
      if (this.settingsPopover.classList.contains('visible')) {
        this.hideSettings();
        return;
      }
      this.showSettingsNear(this.floatBtn.getBoundingClientRect());
    });
    document.body.appendChild(this.floatBtn);
    this.settingsPopover = createSettingsPanel({ onChange: (s) => this.applySettings(s) });
    document.body.appendChild(this.settingsPopover);
    document.addEventListener('click', (e) => {
      if (!this.settingsPopover?.classList.contains('visible')) return;
      if (
        e.target.closest('#popup-settings-popover') ||
        e.target.closest('#popup-panel-settings') ||
        e.target.closest('#pv-float-settings')
      ) {
        return;
      }
      this.hideSettings();
    });
    header.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      this.toggleFullScreen();
    });
    this.contentArea.addEventListener('click', (e) => {
      if (settingsManager.get().linkIntercept !== false) return;
      const link = e.target.closest?.('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || /^(javascript:|#)/i.test(href.trim())) return;
      e.preventDefault();
      e.stopPropagation();
      const url = link.href;
      this.handlers.onOpenInWindow?.(url, (link.textContent || '').trim());
    });
    this._setupDrag(header);
    this._setupKeyboard();
    return this.panel;
  }
  show(title, url) {
    this.ensure();
    this.floatBtn?.classList.add('hidden');
    this.currentUrl = url || '';
    this.titleTextEl.textContent = title || '查看内容';
    this.footerUrlEl.textContent = url || '';
    this.footerUrlEl.title = url || '';
    this.footer.classList.toggle('empty', !url);
    this.panel.classList.remove('visible');
    // 保留拖动后的窗体位置；若正处于全屏，恢复全屏前位置
    const pos = this.isFullScreen
      ? {
          top: this.preFullScreen.top || '',
          left: this.preFullScreen.left || '',
          transform: this.preFullScreen.transform || ''
        }
      : {
          top: this.panel.style.top,
          left: this.panel.style.left,
          transform: this.panel.style.transform
        };
    Object.assign(this.panel.style, {
      width: '',
      height: '',
      top: pos.top,
      left: pos.left,
      transform: pos.transform,
      maxWidth: '',
      maxHeight: '',
      borderRadius: '',
      zIndex: ''
    });
    this.isFullScreen = false;
    this.updateMaximizeIcon();
    this.applySettings(settingsManager.get());
    requestAnimationFrame(() => {
      this.panel.classList.add('visible');
      if (settingsManager.get().windowMode !== 'float') this.overlay.classList.add('visible');
    });
  }
  close() {
    if (!this.panel) return;
    if (this.isFullScreen) this.toggleFullScreen();
    this.hideSettings();
    this.floatBtn?.classList.remove('hidden');
    this.panel.classList.remove('visible');
    this.overlay.classList.remove('visible');
    this.handlers.onClose?.();
    setTimeout(() => {
      this.contentArea.innerHTML = '';
      this.currentUrl = '';
    }, 350);
  }
  setTitle(text) {
    if (this.titleTextEl) this.titleTextEl.textContent = text || '查看内容';
  }
  updateFooterUrl(url) {
    this.footerUrlEl.textContent = url || '';
    this.footerUrlEl.title = url || '';
    this.footer?.classList.toggle('empty', !url);
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
    this.contentArea?.classList.toggle('pv-hide-scrollbar', s.scrollbarVisible === false);
    const size = config.popup.sizes[nextSize] || config.popup.sizes[config.popup.defaultSize];
    this.panel?.style.setProperty('--popup-width', size.width);
    this.panel?.style.setProperty('--popup-height', size.height);
    if (nextSize === 'phone') {
      this.restorePhonePosition();
    } else if (prevSize === 'phone') {
      this.savePhonePosition();
      this.centerPanel();
    }
  }
  /** 应用外观主题：auto 跟随系统，light/dark 手动覆盖。 */
  applyTheme(theme) {
    const t = theme || 'auto';
    const root = document.documentElement;
    root.classList.toggle('pv-theme-dark', t === 'dark');
    root.classList.toggle('pv-theme-light', t === 'light');
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
      this.panel.style.transform = 'none';
    }
  }
  /** 重置为居中位置。 */
  centerPanel() {
    if (!this.panel || this.isFullScreen) return;
    this.panel.style.left = '';
    this.panel.style.top = '';
    this.panel.style.transform = '';
  }
  hideOverlay() {
    this.overlay?.classList.remove('visible');
  }
  showOverlay() {
    if (this.panel?.classList.contains('visible')) this.overlay?.classList.add('visible');
  }
  /** 在指定锚点旁显示设置面板（锚点为元素 getBoundingClientRect）。 */
  showSettingsNear(rect) {
    const margin = 8;
    const pop = this.settingsPopover;
    const popW = 268;
    const popH = 340;
    let left = rect.right - popW;
    let top = rect.bottom + margin;
    if (left < margin) left = margin;
    if (rect.bottom + popH + margin > window.innerHeight) {
      top = Math.max(margin, rect.top - popH - margin);
    }
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.classList.add('visible');
    this.settingsBtn?.classList.add('active');
  }
  hideSettings() {
    this.settingsPopover?.classList.remove('visible');
    this.settingsBtn?.classList.remove('active');
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
      this.panel.style.transition = 'none';
      Object.assign(this.panel.style, {
        width: '100vw',
        height: '100vh',
        top: '0px',
        left: '0px',
        transform: 'none',
        borderRadius: '0px',
        maxWidth: 'none',
        maxHeight: 'none',
        zIndex: '10002'
      });
      void this.panel.offsetWidth;
      this.panel.style.transition = '';
      this.isFullScreen = true;
    } else {
      this.panel.style.transition = 'none';
      Object.assign(this.panel.style, {
        width: this.preFullScreen.width || '',
        height: this.preFullScreen.height || '',
        top: this.preFullScreen.top || '',
        left: this.preFullScreen.left || '',
        transform: this.preFullScreen.transform || '',
        borderRadius: this.preFullScreen.borderRadius || '',
        maxWidth: this.preFullScreen.maxWidth || '',
        maxHeight: this.preFullScreen.maxHeight || '',
        zIndex: '10000'
      });
      void this.panel.offsetWidth;
      this.panel.style.transition = '';
      this.isFullScreen = false;
    }
    this.updateMaximizeIcon();
  }
  updateMaximizeIcon() {
    if (!this.toolbar) return;
    const btn = this.toolbar.maximize;
    btn.innerHTML = '';
    btn.appendChild(svgIcon(this.isFullScreen ? 'minimize' : 'maximize', { size: 16 }));
    btn.title = this.isFullScreen ? '恢复 (F)' : '全屏 (F)';
  }
  _setupDrag(header) {
    let dragging = false;
    let startX = 0,
      startY = 0,
      startLeft = 0,
      startTop = 0;
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      if (this.isFullScreen) return;
      if (e.button !== 0) return;
      dragging = true;
      const rect = this.panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      this.panel.style.transition = 'none';
      this.panel.style.left = `${rect.left}px`;
      this.panel.style.top = `${rect.top}px`;
      this.panel.style.transform = 'none';
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
      this.panel.style.transition = '';
      if (this.currentPanelSize === 'phone') this.savePhonePosition();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }
  _setupKeyboard() {
    if (this._onKeydownBound) return;
    this._onKeydownBound = (e) => {
      if (!this.panel || !this.panel.classList.contains('visible')) return;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'f' || e.key === 'F') this.toggleFullScreen();
      else if (e.key === 'r' || e.key === 'R') {
        if (this.currentUrl && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          this.handlers.onRefresh?.(this.currentUrl);
        }
      }
    };
    document.addEventListener('keydown', this._onKeydownBound);
  }
}
