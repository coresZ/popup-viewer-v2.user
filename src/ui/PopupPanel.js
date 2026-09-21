import { config } from '../config.js';
import { gm } from '../utils/gm.js';
import { el, svgIcon, mountUi } from '../utils/dom.js';
import { clampToViewport, setupDrag, setupResize, setupWheelScrollChain } from '../utils/panelBehavior.js';
import { debugMark } from '../utils/debugFlag.js';
import { settingsManager } from '../core/SettingsManager.js';

// 本面板自己写入的「取整位移」形如 translate(calc(-50% ± Npx), ...)。
// 用无状态的字符串判定，而不是布尔标记：标记一旦与实际情况不同步
// （例如用户拖动后 transform 被置为 none，标记却仍为 true），
// 下次打开就会把用户拖出来的位置当成自己的清掉，窗体随即偏移半个宽高。
const SNAP_TRANSFORM_RE = /^translate\(calc\(-50%/;
const isSnapTransform = (value) => SNAP_TRANSFORM_RE.test(String(value || '').trim());
import { createToolbar } from './Toolbar.js';
import { createSettingsPanel } from './SettingsPanel.js';
import { createRulesPanel } from './RulesPanel.js';
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
    this.footerLinkBtn = null;
    this.backBtn = null;
    this.forwardBtn = null;
    this.settingsPopover = null;
    this.settingsBtn = null;
    this._settingsAnchor = null;
    this.currentPanelSize = null;
    this.currentUrl = '';
    this.isFullScreen = false;
    this.preFullScreen = {};
    this.handlers = {};
    this._onKeydownBound = null;
    this._snapTimer = null;
    this._centerTimer = null;
  }
  ensure() {
    if (this.panel) return this.panel;
    this.overlay = el('div', { id: 'popup-panel-overlay', onclick: () => this.close() });
    mountUi(this.overlay);
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
    this.header = header;
    this.contentArea = el('div', { id: 'popup-content-area' });
    // 底部导航栏：← 后退 / → 前进 / 链接图标（替代 URL 文本，点击在新标签页打开）
    this.backBtn = el('button', {
      id: 'popup-panel-back',
      class: 'popup-panel-btn',
      title: '后退 (Alt+←)',
      onclick: () => this.handlers.onBack?.()
    });
    this.backBtn.appendChild(svgIcon('arrowLeft', { size: 14 }));
    this.forwardBtn = el('button', {
      id: 'popup-panel-forward',
      class: 'popup-panel-btn',
      title: '前进 (Alt+→)',
      onclick: () => this.handlers.onForward?.()
    });
    this.forwardBtn.appendChild(svgIcon('arrowRight', { size: 14 }));
    const navGroup = el('div', { class: 'pv-footer-nav' }, this.backBtn, this.forwardBtn);
    this.footerLinkBtn = el('button', {
      id: 'popup-panel-footer-link',
      class: 'popup-panel-btn',
      title: '在新标签页打开',
      onclick: () => this.handlers.onOpenExternal?.(this.currentUrl)
    });
    this.footerLinkBtn.appendChild(svgIcon('external', { size: 14 }));
    this.footer = el('div', { id: 'popup-panel-footer' }, navGroup, this.footerLinkBtn);
    this.panel = el('div', { id: 'popup-content-panel' }, header, this.contentArea, this.footer);
    mountUi(this.panel);
    this.floatBtn = el('button', { id: 'pv-float-settings', title: '脚本设置' });
    this.floatBtn.appendChild(svgIcon('settings', { size: 16 }));
    this.floatBtn.addEventListener('click', () => {
      if (this.settingsPopover.classList.contains('visible')) {
        this.hideSettings();
        return;
      }
      this.showSettingsNear(this.floatBtn.getBoundingClientRect());
    });
    mountUi(this.floatBtn);
    this.settingsPopover = createSettingsPanel({
      onChange: (s) => this.applySettings(s),
      onManageRules: () => this.showRulesPanel(),
      onClose: () => this.hideSettings()
    });
    mountUi(this.settingsPopover);
    this.rulesPanel = createRulesPanel();
    mountUi(this.rulesPanel.backdrop);
    mountUi(this.rulesPanel.root);
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
    // 双击标题全屏仅桌面（鼠标）启用；触屏双击易误触，全屏走工具栏按钮
    if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) {
      header.addEventListener('dblclick', (e) => {
        if (e.target.closest('button')) return;
        this.toggleFullScreen();
      });
    }
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
    this._setupResize();
    this._setupKeyboard();
    return this.panel;
  }
  show(title, url) {
    debugMark('panel.show');
    this.ensure();
    this.floatBtn?.classList.add('hidden');
    this.currentUrl = url || '';
    this.titleTextEl.textContent = title || '查看内容';
    this.updateFooterUrl(url);
    this.panel.classList.remove('visible');
    clearTimeout(this._centerTimer);
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
          // 只清掉自己写的「取整位移」：它会压掉 CSS 的居中与 scale 开场动画，且尺寸变化后会过期。
          // 用户拖动/手机模式写入的 transform（none）必须原样保留，否则 left/top 会被当成左上角坐标再叠一次 -50%。
          transform: isSnapTransform(this.panel.style.transform) ? '' : this.panel.style.transform
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
      debugMark('panel.visible');
      if (settingsManager.get().windowMode !== 'float') this.overlay.classList.add('visible');
      this._fixCentering();
      // 开场动画（scale + opacity）结束后再取整位移：
      // 动画中改 transform 会打断过渡，且动画期间 opacity<1 本来也不会有次像素抗锯齿
      clearTimeout(this._snapTimer);
      this._snapTimer = setTimeout(() => this._snapTransform(), 340);
    });
  }
  close() {
    if (!this.panel) return;
    if (this.isFullScreen) this.toggleFullScreen();
    clearTimeout(this._snapTimer);
    clearTimeout(this._centerTimer);
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
    if (this.footerLinkBtn) this.footerLinkBtn.title = url ? '在新标签页打开：' + url : '在新标签页打开';
    this.footer?.classList.toggle('empty', !url);
  }
  /** 更新前进/后退按钮可用状态。 */
  setNavState(canBack, canForward) {
    if (this.backBtn) this.backBtn.disabled = !canBack;
    if (this.forwardBtn) this.forwardBtn.disabled = !canForward;
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
    this._setHandedness(s.handedness);
    this.panel?.classList.toggle('pv-locked', s.locked === true);
    this.panel?.classList.toggle('pv-no-mobile-resize', s.mobileResize === false);
    this.contentArea?.classList.toggle('pv-hide-scrollbar', s.scrollbarVisible === false);
    let width;
    let height;
    if (nextSize === 'custom' && s.customSize) {
      // 自由缩放后的自定义尺寸（像素）
      width = `${s.customSize.width}px`;
      height = `${s.customSize.height}px`;
    } else if (nextSize === 'phone') {
      const m = config.phone.sizes[s.phoneModel] || config.phone.sizes[config.phone.defaultModel];
      const size = config.popup.sizes[config.popup.defaultSize];
      width = m ? m.width : size.width;
      height = m ? m.height : size.height;
    } else if (
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) &&
      (window.innerWidth <= 560 || window.innerHeight <= 560)
    ) {
      // 手机小屏：默认铺近全屏（写入变量而非 CSS 硬编码，四角把手可自由缩放覆盖它）
      width = 'calc(100vw - 12px)';
      height = 'calc(100dvh - 12px)';
    } else {
      const size = config.popup.sizes[nextSize] || config.popup.sizes[config.popup.defaultSize];
      width = size.width;
      height = size.height;
    }
    this.panel?.style.setProperty('--popup-width', width);
    this.panel?.style.setProperty('--popup-height', height);
    // 尺寸变了，之前的取整位移（基于旧宽高）就过期了，必须重算，否则面板会偏离居中
    if (this.panel?.classList.contains('visible')) this._snapTransform();
    // 设置变化可能改变面板内容高度（如手机型号子控件显隐），可见时重新定位，避免尺寸错乱
    if (this.settingsPopover?.classList.contains('visible') && this._settingsAnchor) {
      this.showSettingsNear(this._settingsAnchor);
    }
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
  /** 惯用手：左手模式镜像工具栏（✕ 移到左上角）。 */
  _setHandedness(handedness) {
    if (!this.toolbar || !this.header) return;
    const left = handedness === 'left';
    const acts = this.toolbar.actions;
    const order = left
      ? ['close', 'settings', 'open', 'maximize', 'refresh']
      : ['refresh', 'maximize', 'open', 'settings', 'close'];
    const map = {
      refresh: this.toolbar.refresh,
      maximize: this.toolbar.maximize,
      open: this.toolbar.open,
      settings: this.toolbar.settings,
      close: this.toolbar.close
    };
    order.forEach((id) => acts.appendChild(map[id]));
    // 左手：按钮组整体放左侧、标题放右侧；右手：恢复默认布局
    if (left) {
      if (this.header.firstChild !== acts) this.header.insertBefore(acts, this.header.firstChild);
    } else if (this.header.firstChild !== this.titleEl) {
      this.header.insertBefore(this.titleEl, this.header.firstChild);
    }
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
    this._snapTransform();
    // 居中校正必须等 transform 过渡结束再量。面板从「手机模式/拖动后的 none」切回居中时，
    // -50% 本身正在 0.3s 过渡中；此刻立刻 getBoundingClientRect() 量到的是**还没偏移**的位置，
    // 偏差正好是半个宽高，于是被当成误差写进 left/top，过渡结束后 CSS 再叠一次 -50%，
    // 窗体就跑到左上角（手机 → 小/中/大 走的正是这条路径）。
    clearTimeout(this._centerTimer);
    this._centerTimer = setTimeout(() => {
      if (!this.panel || !this.panel.classList.contains('visible')) return;
      this._fixCentering();
      this._snapTransform();
    }, 340);
  }
  /**
   * 把居中位移取整到整数像素。
   * Chrome 在图层带**非整数位移**时会关闭次像素（LCD）抗锯齿、改用灰度抗锯齿，
   * 同样的字重看起来就更细——弹窗正文与宿主页面字体粗细不一致多半出在这里
   * （面板宽高取视口百分比，一半常是 x.5）。取整后视觉偏移 ≤0.5px，可忽略。
   */
  _snapTransform() {
    if (!this.panel || this.isFullScreen) return;
    if (this.panel.style.left || this.panel.style.top) return; // 用户拖过：由 left/top 定位，无需处理
    const rect = this.panel.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // 用 calc(-50% + 余数) 而不是写死像素：尺寸变化时几何仍然自洽（只是取整暂时失效），
    // 不会像写死 -W/2 那样在换尺寸后整体偏移半个差值
    const offset = (value) => {
      const remainder = value / 2 - Math.round(value / 2);
      return remainder < 0 ? `- ${Math.abs(remainder)}px` : `+ ${remainder}px`;
    };
    this.panel.style.transform = `translate(calc(-50% ${offset(rect.width)}), calc(-50% ${offset(rect.height)}))`;
  }
  /**
   * 居中校正：挂载点已避开被 transform 的祖先，但宿主页面仍可能有别的因素让
   * CSS 的 top/left:50% 算不准（缩放、被覆盖等）。这里实测「窗体中心」与「视口中心」
   * 的偏差并换算成显式像素；用中心点计算，因此不受打开动画 scale 影响。
   * 只在居中模式（用户没拖过、非全屏）下生效。
   */
  _fixCentering() {
    if (!this.panel || this.isFullScreen) return;
    if (this.panel.style.left || this.panel.style.top) return;
    const rect = this.panel.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
    const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const cs = getComputedStyle(this.panel);
    const left = parseFloat(cs.left);
    const top = parseFloat(cs.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    // 视口像素 → 包含块像素：需要扣掉祖先的缩放
    let ancestorScale = 1;
    try {
      const matrix =
        typeof DOMMatrixReadOnly === 'function' ? new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform) : null;
      const panelScale = matrix && matrix.a ? matrix.a : 1;
      if (this.panel.offsetWidth && panelScale) {
        ancestorScale = rect.width / (this.panel.offsetWidth * panelScale) || 1;
      }
    } catch (err) {
      ancestorScale = 1;
    }
    this.panel.style.left = `${left + dx / ancestorScale}px`;
    this.panel.style.top = `${top + dy / ancestorScale}px`;
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
    this._settingsAnchor = rect;
    // 清掉上次的内联尺寸，测量自然高度（CSS 已限高 560px，测量值即稳定值）
    pop.style.maxHeight = '';
    pop.style.width = '';
    const popW = pop.offsetWidth || 280;
    const popH = pop.offsetHeight || 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const isMobile =
      vw <= 560 ||
      vh <= 560 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    let left;
    let top;
    if (popH <= spaceBelow) {
      // 锚点下方放得下
      top = rect.bottom + margin;
    } else if (popH <= spaceAbove) {
      // 锚点上方放得下
      top = rect.top - popH;
    } else if (isMobile) {
      // 移动端：全屏式面板
      top = margin;
      left = margin;
      pop.style.width = `${vw - margin * 2}px`;
      pop.style.maxHeight = `${vh - margin * 2}px`;
    } else {
      // PC 空间不足：贴顶展示（CSS 限高 560px，内部滚动）
      top = margin;
    }
    if (top < margin) top = margin;

    if (left === undefined) {
      left = rect.right - popW;
      if (left < margin) left = margin;
      if (left + popW > vw - margin) left = vw - margin - popW;
      if (left < margin) left = margin;
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
    setupDrag({
      header,
      panel: this.panel,
      isFullScreen: () => this.isFullScreen,
      locked: () => settingsManager.get().locked === true,
      onDragEnd: (info) => {
        if (info && info.locked) return; // 锁定：窗体不移动
        this._clampToViewport();
        if (this.currentPanelSize === 'phone') this.savePhonePosition();
      }
    });
    window.addEventListener('resize', () => {
      if (this.panel?.classList.contains('visible')) {
        requestAnimationFrame(() => {
          this._clampToViewport();
          // 视口变化会改变百分比宽高 → 重算取整位移（几何用 calc(-50%) 已自洽，这里只为恢复抗锯齿取整）
          this._snapTransform();
        });
      }
      // 设置面板可见时同步重新定位，避免缩放窗口后位置错乱
      if (this.settingsPopover?.classList.contains('visible') && this._settingsAnchor) {
        requestAnimationFrame(() => this.showSettingsNear(this._settingsAnchor));
      }
    });
  }
  /** 8 向自由缩放：拖边/角调整窗体大小，释放后持久化为自定义尺寸。 */
  _setupResize() {
    setupResize({
      panel: this.panel,
      isFullScreen: () => this.isFullScreen,
      locked: () => settingsManager.get().locked === true,
      onResizeEnd: (rect) => {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        this.panel.style.setProperty('--popup-width', `${width}px`);
        this.panel.style.setProperty('--popup-height', `${height}px`);
        this.currentPanelSize = 'custom';
        settingsManager.set({ panelSize: 'custom', customSize: { width, height } });
      }
    });
  }
  /**
   * 把弹窗约束回视口内（DevTools 占位 / 窗口缩放后调用），
   * 避免窗体被压缩出可视区域。
   */
  _clampToViewport() {
    clampToViewport(this.panel, { isFullScreen: this.isFullScreen });
  }
  _setupKeyboard() {
    if (this._onKeydownBound) return;
    this._onKeydownBound = (e) => {
      if (!this.panel || !this.panel.classList.contains('visible')) return;
      if (e.key === 'Escape') {
        // 设置弹窗打开时 Esc 只关设置，不关阅读弹窗
        if (this.settingsPopover?.classList.contains('visible')) {
          this.hideSettings();
          e.stopImmediatePropagation();
          return;
        }
        this.close();
      } else if (e.key === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        this.handlers.onBack?.();
      } else if (e.key === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        this.handlers.onForward?.();
      } else if (e.key === 'f' || e.key === 'F') this.toggleFullScreen();
      else if (e.key === 'r' || e.key === 'R') {
        if (this.currentUrl && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          this.handlers.onRefresh?.(this.currentUrl);
        }
      }
    };
    document.addEventListener('keydown', this._onKeydownBound);
    // 滚动链兜底：弹窗内容滚到底时不滚动外部页面
    setupWheelScrollChain({
      panel: this.panel,
      contentArea: () => this.contentArea,
      isFullScreen: () => this.isFullScreen
    });
  }
}
