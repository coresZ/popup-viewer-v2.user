import { config } from '../config.js';
import { gm } from '../utils/gm.js';
import {
  el,
  svgIcon,
  mountUi,
  eventTarget,
  isEditableEvent,
  isOwnUiNode,
  closestInPath,
  deepActiveElement,
  uiRoot
} from '../utils/dom.js';
import { createUiHost } from '../utils/uiHost.js';
import { clampToViewport, setupDrag, setupResize, setupWheelScrollChain } from '../utils/panelBehavior.js';
import { debugMark } from '../utils/debugFlag.js';
import { settingsManager } from '../core/SettingsManager.js';
import { eventBus } from '../core/EventBus.js';

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
    // 样式在 ensure() 里装：优先装进 Shadow DOM，失败才全局注入（_installStyles）
    this._stylesInstalled = false;
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
    this.rulesPanel = null;
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
  /** 外壳样式：Shadow DOM 可用时装进 shadow root（页面只留论坛装饰那一段），否则按旧方式全局注入。 */
  _installStyles() {
    if (this._stylesInstalled) return;
    this._stylesInstalled = true;
    const root = config.ui?.shadow === false ? null : createUiHost(style);
    if (!root) gm.addStyle(style);
  }
  ensure() {
    if (this.panel) return this.panel;
    this._installStyles();
    // 初始化时 applyTheme 可能早于宿主创建：把主题类补到宿主上
    if (this._theme) this.applyTheme(this._theme);
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
        this.showSettingsNear(this.settingsBtn.getBoundingClientRect(), this.settingsBtn);
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
    this.backBtn.setAttribute('aria-label', '后退');
    this.forwardBtn.setAttribute('aria-label', '前进');
    this.navGroup = el('div', { class: 'pv-footer-nav pv-no-history' }, this.backBtn, this.forwardBtn);
    const navGroup = this.navGroup;
    this.footerHostEl = el('span', { class: 'pv-footer-host' });
    this.footerLinkBtn = el('button', {
      id: 'popup-panel-footer-link',
      class: 'popup-panel-btn',
      title: '在新标签页打开',
      onclick: () => this.handlers.onOpenExternal?.(this.currentUrl)
    });
    this.footerLinkBtn.appendChild(svgIcon('external', { size: 14 }));
    this.footerLinkBtn.setAttribute('aria-label', '在新标签页打开');
    this.footer = el('div', { id: 'popup-panel-footer' }, navGroup, this.footerHostEl, this.footerLinkBtn);
    this.titleTextEl.id = 'popup-panel-title-text';
    this.panel = el(
      'div',
      { id: 'popup-content-panel', role: 'dialog', tabindex: '-1', 'aria-labelledby': 'popup-panel-title-text' },
      header,
      this.contentArea,
      this.footer
    );
    mountUi(this.panel);
    this.floatBtn = el('button', { id: 'pv-float-settings', title: '脚本设置' });
    this.floatBtn.appendChild(svgIcon('settings', { size: 16 }));
    this.floatBtn.addEventListener('click', () => {
      if (this.settingsPopover?.classList.contains('visible')) {
        this.hideSettings();
        return;
      }
      this.showSettingsNear(this.floatBtn.getBoundingClientRect(), this.floatBtn);
    });
    mountUi(this.floatBtn);
    [this.panel, this.overlay].forEach((node) => this._syncInert(node));
    // 点选链接期间把弹窗和遮罩让开，露出整个页面；结束后恢复
    eventBus.on('picker-start', () => {
      this.panel.classList.add('pv-picking');
      this.overlay.classList.add('pv-picking');
    });
    eventBus.on('picker-end', () => {
      this.panel.classList.remove('pv-picking');
      this.overlay.classList.remove('pv-picking');
    });
    // 双击标题全屏仅桌面（鼠标）启用；触屏双击易误触，全屏走工具栏按钮
    if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) {
      header.addEventListener('dblclick', (e) => {
        if (e.target.closest('button')) return;
        this.toggleFullScreen();
      });
    }
    this.contentArea.addEventListener('click', (e) => {
      if (settingsManager.get().popupLinksNewTab !== false) return;
      const link = closestInPath(e, 'a[href]');
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
  /** 设置面板按需创建：首次打开设置/规则前不构建它的上百个表单节点。 */
  ensureSettingsPanel() {
    if (this.settingsPopover) return this.settingsPopover;
    this.settingsPopover = createSettingsPanel({
      onChange: (s) => this.applySettings(s),
      onManageRules: () => this.showRulesPanel(),
      onClose: () => this.hideSettings()
    });
    mountUi(this.settingsPopover);
    this._syncInert(this.settingsPopover);
    document.addEventListener('click', (e) => {
      if (!this.settingsPopover?.classList.contains('visible')) return;
      if (closestInPath(e, '#popup-settings-popover, #popup-panel-settings, #pv-float-settings')) return;
      this.hideSettings();
    });
    return this.settingsPopover;
  }
  /** 规则面板同样按需创建；油猴菜单直接点选时也会先调用这里。 */
  ensureRulesPanel() {
    if (this.rulesPanel) return this.rulesPanel;
    this.rulesPanel = createRulesPanel();
    mountUi(this.rulesPanel.backdrop);
    mountUi(this.rulesPanel.root);
    this._syncInert(this.rulesPanel.root);
    this._syncInert(this.rulesPanel.backdrop);
    return this.rulesPanel;
  }
  show(title, url) {
    debugMark('panel.show');
    this.ensure();
    // 关窗后 350ms 的清空还没执行就又打开：取消它，否则会把新内容清掉
    clearTimeout(this._clearTimer);
    this._clearTimer = null;
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
    this.panel.classList.remove('pv-fullscreen');
    this.isFullScreen = false;
    this.updateMaximizeIcon();
    this.applySettings(settingsManager.get());
    if (!this._returnFocus) this._returnFocus = deepActiveElement();
    requestAnimationFrame(() => {
      this.panel.classList.add('visible');
      // 焦点移到面板本身：快捷键归弹窗、读屏播报对话框；关闭时还给原来的元素
      this.panel.inert = false;
      this._interactedInside = true;
      try {
        this.panel.focus({ preventScroll: true });
      } catch {}
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
    const focusInside = this.panel.contains(deepActiveElement()) || deepActiveElement() === document.body;
    this.panel.classList.remove('visible');
    this.overlay.classList.remove('visible');
    const back = this._returnFocus;
    this._returnFocus = null;
    this._interactedInside = false;
    if (focusInside && back && back.isConnected && back !== document.body && typeof back.focus === 'function') {
      try {
        back.focus({ preventScroll: true });
      } catch {}
    }
    this.handlers.onClose?.();
    clearTimeout(this._clearTimer);
    this._clearTimer = setTimeout(() => {
      this._clearTimer = null;
      this.contentArea.innerHTML = '';
      this.currentUrl = '';
    }, 350);
  }
  setTitle(text) {
    if (!this.titleTextEl) return;
    this.titleTextEl.textContent = text || '查看内容';
    // 标题常被省略号截断：悬停显示全文
    this.titleTextEl.title = text || '';
  }
  updateFooterUrl(url) {
    if (this.footerLinkBtn) this.footerLinkBtn.title = url ? '在新标签页打开：' + url : '在新标签页打开';
    if (this.footerHostEl) {
      let host = '';
      try {
        host = url ? new URL(url).hostname.replace(/^www\./, '') : '';
      } catch {}
      this.footerHostEl.textContent = host;
      this.footerHostEl.title = url || '';
    }
    this.footer?.classList.toggle('empty', !url);
  }
  /** 更新前进/后退按钮可用状态；两个都不可用时整组隐藏。 */
  setNavState(canBack, canForward) {
    if (this.backBtn) this.backBtn.disabled = !canBack;
    if (this.forwardBtn) this.forwardBtn.disabled = !canForward;
    this.navGroup?.classList.toggle('pv-no-history', !canBack && !canForward);
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
    this.floatBtn?.classList.toggle('pv-float-off', s.hideFloatButton === true);
    // 按站点隐藏右下角齿轮（油猴菜单切换）；内联写，避免和 .hidden（弹窗打开时隐藏）互相覆盖
    if (this.floatBtn) this.floatBtn.style.display = s.hideFloatButton === true ? 'none' : '';
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
    this._theme = t;
    // Shadow 模式：主题类挂在宿主元素上（:host(.pv-theme-dark)），不再改宿主页面的 <html>；
    // 回退模式仍挂在 <html> 上（:root.pv-theme-dark）
    const host = uiRoot()?.host;
    const root = host || document.documentElement;
    root.classList.toggle('pv-theme-dark', t === 'dark');
    root.classList.toggle('pv-theme-light', t === 'light');
    if (host) document.documentElement.classList.remove('pv-theme-dark', 'pv-theme-light');
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
  showSettingsNear(rect, trigger = null) {
    this.ensure();
    this.ensureSettingsPanel();
    const margin = 8;
    const pop = this.settingsPopover;
    // 面板实例复用：打开时若停在「最近」先刷一次历史，避免显示上次打开前的旧列表
    pop.refresh?.();
    this._settingsAnchor = rect;
    // 清掉上次的内联尺寸与 sheet 状态，重新测量
    pop.style.maxHeight = '';
    pop.style.width = '';
    pop.style.bottom = '';
    pop.classList.remove('pv-settings-sheet');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    // 手机/窄屏：全宽底部 sheet；不再依赖「上下都放不下」的 fallback（v2.3.1）
    const isSheet = coarse && (vw <= 560 || vh <= 560);
    if (isSheet) pop.classList.add('pv-settings-sheet');
    const popW = pop.offsetWidth || 340;
    const popH = pop.offsetHeight || 320;
    const spaceBelow = vh - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    let left;
    let top = null;
    if (isSheet) {
      left = 0;
    } else if (spaceBelow >= 240) {
      // 优先在锚点下方展开；空间不足时压缩高度而不是顶到视口顶部盖住弹窗头
      top = rect.bottom + margin;
      if (popH > spaceBelow) pop.style.maxHeight = `${Math.floor(spaceBelow)}px`;
    } else if (spaceAbove >= 240) {
      top = rect.top - popH;
    } else {
      top = margin;
    }
    if (top !== null && top < margin) top = margin;

    if (!isSheet) {
      left = rect.right - popW;
      if (left < margin) left = margin;
      if (left + popW > vw - margin) left = vw - margin - popW;
      if (left < margin) left = margin;
    }

    // 设置浮层属于弹窗的一部分：不超过弹窗底边，避免在 900/800px 视口「长出一条腿」
    if (!isSheet && this.panel?.classList.contains('visible')) {
      const panelRect = this.panel.getBoundingClientRect();
      const maxBottom = Math.min(vh - margin, panelRect.bottom - margin);
      const available = Math.floor(maxBottom - top);
      if (available >= 240 && popH > available) {
        pop.style.maxHeight = `${available}px`;
      }
    }

    pop.style.left = `${left}px`;
    if (top === null) {
      // 底部 sheet：高度随 tab 内容变化时仍贴住底边
      pop.style.top = 'auto';
      pop.style.bottom = '0';
    } else {
      pop.style.top = `${top}px`;
    }
    const wasOpen = pop.classList.contains('visible');
    pop.classList.add('visible');
    this.settingsBtn?.classList.add('active');
    if (!wasOpen) {
      // 焦点移入弹层，关闭时还给打开它的按钮
      this._settingsReturnFocus = trigger || deepActiveElement();
      pop.inert = false;
      const first = pop.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      try {
        first?.focus({ preventScroll: true });
      } catch {}
    }
  }
  hideSettings({ restoreFocus = false } = {}) {
    const pop = this.settingsPopover;
    if (!pop) return;
    const wasOpen = pop.classList.contains('visible');
    const focusInside = wasOpen && pop.contains(deepActiveElement());
    pop.classList.remove('visible');
    this.settingsBtn?.classList.remove('active');
    const back = this._settingsReturnFocus;
    this._settingsReturnFocus = null;
    if (wasOpen && (restoreFocus || focusInside) && back && back.isConnected && typeof back.focus === 'function') {
      try {
        back.focus({ preventScroll: true });
      } catch {}
    }
  }
  showRulesPanel() {
    this.ensure();
    this.ensureRulesPanel();
    // hideSettings 会清掉 _settingsReturnFocus，先把「打开设置的那个按钮」记下来；
    // 从悬浮齿轮打开设置时，settingsBtn 在隐藏的弹窗里不可聚焦，不能拿它当归还目标。
    const trigger = this._settingsReturnFocus || this.settingsBtn || deepActiveElement();
    this.hideSettings();
    this.rulesPanel?.open(trigger);
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
      // 全屏用 class（inset:0 + 安全区），不写 100vw/100vh：后者会被滚动条和手机地址栏遮住一截
      this.panel.classList.add('pv-fullscreen');
      void this.panel.offsetWidth;
      this.panel.style.transition = '';
      this.isFullScreen = true;
    } else {
      this.panel.style.transition = 'none';
      this.panel.classList.remove('pv-fullscreen');
      Object.assign(this.panel.style, {
        width: this.preFullScreen.width || '',
        height: this.preFullScreen.height || '',
        top: this.preFullScreen.top || '',
        left: this.preFullScreen.left || '',
        transform: this.preFullScreen.transform || '',
        borderRadius: this.preFullScreen.borderRadius || '',
        maxWidth: this.preFullScreen.maxWidth || '',
        maxHeight: this.preFullScreen.maxHeight || '',
        zIndex: ''
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
  /**
   * 弹窗快捷键。规则（v2.3.0）：
   * - 正在输入（输入框/文本域/可编辑区、输入法组字中）时不处理任何快捷键；
   *   Esc 在脚本自己的输入框里只让它失焦，在宿主页面的输入框里完全不管。
   * - 单字母 F / R 不能带修饰键，且只在「焦点或最近一次点击在弹窗内」或弹窗为模态（有遮罩）时生效，
   *   避免浮动模式下抢宿主网站自己的快捷键。
   * fromFrame：来自弹窗内同源 iframe 的按键（焦点在帖子里），视为弹窗内。
   */
  handleKeydown(e, { fromFrame = false } = {}) {
    if (!this.panel || e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
    const settingsOpen = this.settingsPopover?.classList.contains('visible');
    const panelOpen = this.panel.classList.contains('visible');
    if (!settingsOpen && !panelOpen) return;
    const target = eventTarget(e);
    const editable = isEditableEvent(e);
    const inside = fromFrame || isOwnUiNode(target);
    if (e.key === 'Escape') {
      if (editable) {
        if (inside && target && typeof target.blur === 'function') {
          target.blur();
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }
      if (settingsOpen) {
        // 设置弹层打开时 Esc 只关设置（从悬浮齿轮打开、阅读弹窗未显示时同样有效）
        this.hideSettings({ restoreFocus: true });
        e.stopImmediatePropagation();
        return;
      }
      this.close();
      return;
    }
    if (!panelOpen || editable) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') this.handlers.onBack?.();
      else this.handlers.onForward?.();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const modal = this.overlay?.classList.contains('visible');
    if (!inside && !modal && !this._interactedInside) return;
    const key = String(e.key || '').toLowerCase();
    if (key === 'f') {
      e.preventDefault();
      this.toggleFullScreen();
    } else if (key === 'r' && this.currentUrl) {
      e.preventDefault();
      this.handlers.onRefresh?.(this.currentUrl);
    }
  }
  _setupKeyboard() {
    if (this._onKeydownBound) return;
    this._onKeydownBound = (e) => this.handleKeydown(e);
    document.addEventListener('keydown', this._onKeydownBound);
    // 记住最近一次点击是否在弹窗内：浮动模式下点过弹窗后，F/R 才归弹窗
    document.addEventListener(
      'pointerdown',
      (e) => {
        this._interactedInside = isOwnUiNode(eventTarget(e));
      },
      true
    );
    this._setupFrameKeys();
    // 滚动链兜底：弹窗内容滚到底时不滚动外部页面
    setupWheelScrollChain({
      panel: this.panel,
      contentArea: () => this.contentArea,
      isFullScreen: () => this.isFullScreen
    });
  }
  /**
   * 焦点在帖子 iframe 里时，按键事件到不了宿主 document。
   * 同源 iframe 每次（重新）加载后给它的 document 挂一个转发监听；跨域读不到就跳过。
   */
  _setupFrameKeys() {
    const attach = (iframe) => {
      const bind = () => {
        try {
          const doc = iframe.contentDocument;
          if (!doc || doc.__pv2Keys) return;
          doc.__pv2Keys = true;
          doc.addEventListener('keydown', (e) => this.handleKeydown(e, { fromFrame: true }));
          doc.addEventListener('pointerdown', () => {
            this._interactedInside = true;
          });
        } catch {}
      };
      bind();
      iframe.addEventListener('load', bind);
    };
    const scan = () => {
      for (const iframe of this.contentArea.querySelectorAll('iframe')) {
        if (iframe.__pv2KeysWatched) continue;
        iframe.__pv2KeysWatched = true;
        attach(iframe);
      }
    };
    new MutationObserver(scan).observe(this.contentArea, { childList: true, subtree: true });
  }
  /**
   * 隐藏中的面板/弹层设为 inert：不能 Tab 进去，读屏也读不到；视觉上的淡入淡出不受影响。
   * 以 .visible 类为准自动同步，不必在每个显示/隐藏的地方手动维护。
   */
  _syncInert(node) {
    if (!node) return;
    const sync = () => {
      const hidden = !node.classList.contains('visible');
      node.inert = hidden;
      if (hidden) node.setAttribute('aria-hidden', 'true');
      else node.removeAttribute('aria-hidden');
    };
    sync();
    new MutationObserver(sync).observe(node, { attributes: true, attributeFilter: ['class'] });
  }
}
