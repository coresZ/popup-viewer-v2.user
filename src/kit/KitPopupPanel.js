import { el, svg, svgIcon } from '../utils/dom.js';

/**
 * PopupKit 用的精简增强弹窗面板：
 * 拖拽 / 全屏 / 刷新 / 新标签页打开 / 关闭 / 快捷键（Esc/F/R）。
 * 全部 DOM id/class 使用 pvk- 前缀，与主脚本（popup-/pv-）及其他脚本隔离。
 * 内联 loading/error 渲染，自包含，不依赖主脚本 UI 模块。
 */
export class KitPopupPanel {
  constructor() {
    this.panel = null;
    this.overlay = null;
    this.titleTextEl = null;
    this.contentArea = null;
    this.maximizeBtn = null;
    this.currentUrl = '';
    this.currentTitle = '';
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
    this.overlay = el('div', { id: 'pvk-overlay', onclick: () => this.close() });
    document.body.appendChild(this.overlay);

    const titleMark = el('span', { class: 'pvk-title-mark' });
    titleMark.appendChild(svgIcon('article', { size: 15 }));
    this.titleTextEl = el('span', { class: 'pvk-title-text', text: '查看内容' });
    const title = el('div', { id: 'pvk-title' }, titleMark, this.titleTextEl);

    const actions = el('div', { id: 'pvk-actions' });
    const makeBtn = (icon, titleText, onClick) => {
      const btn = el('button', { type: 'button', class: 'pvk-btn', title: titleText, onclick: onClick });
      btn.appendChild(svgIcon(icon, { size: 16 }));
      actions.appendChild(btn);
      return btn;
    };
    makeBtn('refresh', '刷新内容 (R)', () => this.refresh());
    this.maximizeBtn = makeBtn('maximize', '全屏 (F)', () => this.toggleFullScreen());
    makeBtn('external', '在新标签页打开', () => {
      if (this.currentUrl) window.open(this.currentUrl, '_blank', 'noopener');
    });
    const closeBtn = makeBtn('close', '关闭 (Esc)', () => this.close());
    closeBtn.id = 'pvk-close';

    const header = el('div', { id: 'pvk-header' }, title, actions);
    this.contentArea = el('div', { id: 'pvk-content' });
    this.panel = el('div', { id: 'pvk-panel' }, header, this.contentArea);
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
    this.currentUrl = opts.url || '';
    this.currentTitle = opts.title || '查看内容';
    this.currentSize = { width: opts.width, height: opts.height };
    this._lastOpen = opts;
    this.titleTextEl.textContent = this.currentTitle;
    this.panel.classList.remove('visible');
    this.isFullScreen = false;
    this._updateMaximizeIcon();
    if (this.currentSize) {
      this.panel.style.setProperty('width', this.currentSize.width || '50%');
      this.panel.style.setProperty('height', this.currentSize.height || '75%');
    } else {
      this.panel.style.removeProperty('width');
      this.panel.style.removeProperty('height');
    }
    // 首次打开居中；后续打开保持拖拽位置（除非未拖过）
    if (!this._dragged) {
      this.panel.style.left = '';
      this.panel.style.top = '';
      this.panel.style.transform = '';
    }
    requestAnimationFrame(() => {
      this.panel.classList.add('visible');
      this.overlay.classList.add('visible');
    });
    this._load(opts);
    this._onOpen?.(opts);
  }
  _load(opts) {
    this._abort?.();
    this._abort = null;
    const content = this.getContentArea();
    content.classList.remove('iframe-direct-load');
    content.innerHTML = '';
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
    content.classList.remove('iframe-direct-load');
    content.innerHTML = '';
    this._showLoading(content);
    this._onRefresh?.(this.currentUrl);
    // 复用原 load 函数，且不清位置（open 里 _dragged 保持原位置）
    this._load(prev);
  }
  close() {
    if (!this.panel) return;
    this._abort?.();
    this._abort = null;
    this.panel.classList.remove('visible');
    this.overlay.classList.remove('visible');
    const url = this.currentUrl;
    setTimeout(() => {
      if (this.contentArea) this.contentArea.innerHTML = '';
      this.currentUrl = '';
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
    this._updateMaximizeIcon();
  }
  _updateMaximizeIcon() {
    if (!this.maximizeBtn) return;
    this.maximizeBtn.innerHTML = '';
    this.maximizeBtn.appendChild(svgIcon(this.isFullScreen ? 'minimize' : 'maximize', { size: 16 }));
    this.maximizeBtn.title = this.isFullScreen ? '恢复 (F)' : '全屏 (F)';
  }
  _setupDrag(header) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
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
      this._dragged = true;
      this._clampToViewport();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
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
      this.panel.style.transition = 'none';
      this.panel.style.left = `${left}px`;
      this.panel.style.top = `${top}px`;
      this.panel.style.transform = 'none';
      void this.panel.offsetWidth;
      this.panel.style.transition = '';
    }
  }
  _setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!this.panel || !this.panel.classList.contains('visible')) return;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'f' || e.key === 'F') this.toggleFullScreen();
      else if (e.key === 'r' || e.key === 'R') {
        if (this.currentUrl && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          this.refresh();
        }
      }
    });
    window.addEventListener('resize', () => {
      if (this.panel && this.panel.classList.contains('visible')) {
        requestAnimationFrame(() => this._clampToViewport());
      }
    });
    // 滚动链兜底：弹窗内容滚到底时不滚动外部页面（overscroll-behavior 之外的保险）
    document.addEventListener(
      'wheel',
      (e) => {
        if (!this.panel || !this.panel.classList.contains('visible')) return;
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
        'div',
        { id: 'pvk-loading' },
        el('div', { class: 'pvk-spinner' }),
        el('div', { class: 'pvk-loading-hint', text: '正在加载内容...' }),
        el('div', { class: 'pvk-loading-sub', text: '请稍候片刻' })
      )
    );
  }
  _showError(container, message) {
    const openBtn = el('button', { text: '在新标签页打开' });
    if (this.currentUrl) {
      openBtn.addEventListener('click', () => window.open(this.currentUrl, '_blank', 'noopener'));
    } else {
      openBtn.disabled = true;
    }
    container.replaceChildren(
      el(
        'div',
        { id: 'pvk-error' },
        svg(
          '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
          { class: 'pvk-error-icon', width: 52, height: 52, 'stroke-width': 1.5 }
        ),
        el('h3', { text: '加载失败' }),
        el('p', { text: message || '无法加载请求的内容' }),
        openBtn
      )
    );
  }
}
