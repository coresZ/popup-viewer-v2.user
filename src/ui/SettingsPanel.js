import { el, svgIcon } from '../utils/dom.js';
import { config } from '../config.js';
import { gm } from '../utils/gm.js';
import { settingsManager } from '../core/SettingsManager.js';
import { eventBus } from '../core/EventBus.js';

export function createSettingsPanel({ onChange, onManageRules, onClose }) {
  const SIZE_ORDER = ['small', 'medium', 'large', 'phone'];
  const SIZE_LABELS = { small: '小', medium: '中', large: '大', phone: '手机' };
  const THEME_ORDER = ['auto', 'light', 'dark'];
  const THEME_LABELS = { auto: '跟随系统', light: '浅色', dark: '深色' };
  const DEFAULT_SIZE = 'medium';
  const DEFAULT_THEME = 'auto';
  const PHONE_ORDER = Object.keys(config.phone.sizes);
  const PHONE_LABELS = Object.fromEntries(PHONE_ORDER.map((k) => [k, config.phone.sizes[k].label]));
  const PHONE_ICONS = Object.fromEntries(PHONE_ORDER.map((k) => [k, svgIcon('smartphone', { size: 12 })]));

  const persist = () => {
    onChange?.(settingsManager.get());
    eventBus.emit('settings-changed', settingsManager.get());
  };

  // ---- 说明 Tooltip ----
  const tipEl = el('div', { id: 'pv-settings-tip', class: 'hidden' });
  document.body.appendChild(tipEl);
  let tipTarget = null;
  function toggleTip(btn, text) {
    if (tipTarget === btn) {
      hideTip();
      return;
    }
    tipTarget = btn;
    tipEl.textContent = text;
    tipEl.classList.remove('hidden');
    const r = btn.getBoundingClientRect();
    const w = tipEl.offsetWidth;
    let left = r.left;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    if (left < 8) left = 8;
    tipEl.style.left = left + 'px';
    tipEl.style.top = r.bottom + 6 + 'px';
  }
  function hideTip() {
    tipTarget = null;
    tipEl.classList.add('hidden');
  }
  function makeTip(text) {
    const btn = el('button', {
      type: 'button',
      class: 'pv-settings-tip',
      'aria-label': '说明',
      onclick: (e) => {
        e.stopPropagation();
        toggleTip(btn, text);
      }
    });
    btn.appendChild(svgIcon('info', { size: 13 }));
    return btn;
  }
  document.addEventListener('click', (e) => {
    if (tipEl.classList.contains('hidden')) return;
    if (e.target.closest('.pv-settings-tip') || e.target === tipEl) return;
    hideTip();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTip();
  });

  // ---- 分段控件 ----
  const makeSeg = (order, labels, getKey, setKey, { icons = {}, defaultOf, onChange, onSet } = {}) => {
    const btns = {};
    const group = el('div', { class: 'pv-seg' });
    const sync = () => {
      const current = getKey();
      Object.entries(btns).forEach(([k, b]) => {
        b.classList.toggle('active', k === current);
        b.classList.toggle('is-default', !!defaultOf && k === defaultOf);
      });
    };
    order.forEach((k) => {
      const children = [];
      if (icons[k]) children.push(icons[k]);
      children.push(el('span', { text: labels[k] }));
      const btn = el(
        'button',
        {
          type: 'button',
          class: 'pv-seg-item',
          onclick: () => {
            settingsManager.set(onSet ? onSet(k) : { [setKey]: k });
            sync();
            onChange?.();
            persist();
          }
        },
        ...children
      );
      btns[k] = btn;
      group.appendChild(btn);
    });
    sync();
    return { group, sync };
  };

  const sizeSeg = makeSeg(SIZE_ORDER, SIZE_LABELS, () => settingsManager.get().panelSize, 'panelSize', {
    icons: { phone: svgIcon('smartphone', { size: 12 }) },
    defaultOf: DEFAULT_SIZE,
    onChange: syncPhoneModels,
    onSet: (k) => ({ panelSize: k, customSize: null })
  });
  const themeSeg = makeSeg(THEME_ORDER, THEME_LABELS, () => settingsManager.get().theme || 'auto', 'theme', {
    defaultOf: DEFAULT_THEME
  });
  const windowModeSeg = makeSeg(
    ['coupled', 'float'],
    { coupled: '跟随页面', float: '独立悬浮' },
    () => settingsManager.get().windowMode || 'coupled',
    'windowMode'
  );
  const handednessSeg = makeSeg(
    ['right', 'left'],
    { right: '右手', left: '左手' },
    () => settingsManager.get().handedness || 'right',
    'handedness'
  );
  const phoneModelSeg = makeSeg(
    PHONE_ORDER,
    PHONE_LABELS,
    () => settingsManager.get().phoneModel || config.phone.defaultModel,
    'phoneModel',
    { icons: PHONE_ICONS }
  );
  // 手机型号子控件：仅当窗体大小=手机时显示
  const phoneModelsWrap = el(
    'div',
    { class: 'pv-settings-phone-models hidden', id: 'pv-settings-phone-models' },
    el('div', { class: 'pv-settings-sub', text: '手机型号' }),
    phoneModelSeg.group
  );
  function syncPhoneModels() {
    phoneModelsWrap.classList.toggle('hidden', settingsManager.get().panelSize !== 'phone');
  }
  syncPhoneModels();

  // ---- 开关 ----
  const scrollSwitch = el('input', { type: 'checkbox', id: 'pv-settings-scroll' });
  scrollSwitch.checked = settingsManager.get().scrollbarVisible !== false;
  scrollSwitch.addEventListener('change', () => {
    settingsManager.set({ scrollbarVisible: scrollSwitch.checked });
    persist();
  });
  const scrollSwitchWrap = el('label', { class: 'pv-switch' }, scrollSwitch, el('span', { class: 'pv-switch-track' }));

  const lockSwitch = el('input', { type: 'checkbox', id: 'pv-settings-lock' });
  lockSwitch.checked = settingsManager.get().locked === true;
  lockSwitch.addEventListener('change', () => {
    settingsManager.set({ locked: lockSwitch.checked });
    persist();
  });
  const lockSwitchWrap = el('label', { class: 'pv-switch' }, lockSwitch, el('span', { class: 'pv-switch-track' }));

  const linkInterceptSwitch = el('input', { type: 'checkbox', id: 'pv-settings-link-intercept' });
  linkInterceptSwitch.checked = settingsManager.get().linkIntercept !== false;
  linkInterceptSwitch.addEventListener('change', () => {
    settingsManager.set({ linkIntercept: linkInterceptSwitch.checked });
    if (!linkInterceptSwitch.checked) windowModeSeg.sync();
    persist();
  });
  const linkInterceptSwitchWrap = el('label', { class: 'pv-switch' }, linkInterceptSwitch, el('span', { class: 'pv-switch-track' }));

  const allowInFrameSwitch = el('input', { type: 'checkbox', id: 'pv-settings-iframe' });
  allowInFrameSwitch.checked = settingsManager.get().allowInFrame === true;
  allowInFrameSwitch.addEventListener('change', () => {
    settingsManager.set({ allowInFrame: allowInFrameSwitch.checked });
    persist();
  });
  const allowInFrameWrap = el('label', { class: 'pv-switch' }, allowInFrameSwitch, el('span', { class: 'pv-switch-track' }));

  // 移动端四角缩放把手开关
  const mobileResizeSwitch = el('input', { type: 'checkbox', id: 'pv-settings-mobile-resize' });
  mobileResizeSwitch.checked = settingsManager.get().mobileResize !== false;
  mobileResizeSwitch.addEventListener('change', () => {
    settingsManager.set({ mobileResize: mobileResizeSwitch.checked });
    persist();
  });
  const mobileResizeSwitchWrap = el('label', { class: 'pv-switch' }, mobileResizeSwitch, el('span', { class: 'pv-switch-track' }));

  // 调试标记开关：独立存储键 pv2:debug（调试层在设置加载前就要读取，不走站点设置）
  const debugSwitch = el('input', { type: 'checkbox', id: 'pv-settings-debug' });
  debugSwitch.checked = gm.getValue('pv2:debug', false) === true;
  debugSwitch.addEventListener('change', () => {
    gm.setValue('pv2:debug', debugSwitch.checked);
  });
  const debugSwitchWrap = el('label', { class: 'pv-switch' }, debugSwitch, el('span', { class: 'pv-switch-track' }));

  const resetBtn = el('button', { type: 'button', class: 'pv-settings-reset', text: '恢复默认' });
  resetBtn.addEventListener('click', () => {
    settingsManager.reset();
    scrollSwitch.checked = settingsManager.get().scrollbarVisible !== false;
    lockSwitch.checked = settingsManager.get().locked === true;
    linkInterceptSwitch.checked = settingsManager.get().linkIntercept !== false;
    allowInFrameSwitch.checked = settingsManager.get().allowInFrame === true;
    mobileResizeSwitch.checked = settingsManager.get().mobileResize !== false;
    sizeSeg.sync();
    themeSeg.sync();
    windowModeSeg.sync();
    handednessSeg.sync();
    phoneModelSeg.sync();
    syncPhoneModels();
    persist();
  });
  const manageRulesBtn = el('button', { type: 'button', class: 'pv-settings-reset', text: '管理', onclick: () => onManageRules?.() });

  // ---- 弹窗头：标题 + 关闭按钮（小屏上弹窗可能盖住 ⚙ 锚点，必须有独立关闭入口） ----
  const closeBtn = el('button', { type: 'button', class: 'pv-settings-close', title: '关闭设置', onclick: () => onClose?.() });
  closeBtn.appendChild(svgIcon('close', { size: 14 }));
  const head = el(
    'div',
    { class: 'pv-settings-head' },
    el('span', { class: 'pv-settings-title', text: '设置' }),
    closeBtn
  );

  // ---- 布局 ----
  const group = (title) => el('div', { class: 'pv-settings-group' }, el('div', { class: 'pv-settings-group-title', text: title }));
  const titleCol = (label, sub, tip) =>
    el(
      'div',
      { class: 'pv-settings-title-col' },
      el(
        'div',
        { class: 'pv-settings-label-line' },
        el('span', { class: 'pv-settings-label', text: label }),
        tip ? makeTip(tip) : null
      ),
      sub ? el('div', { class: 'pv-settings-sub', text: sub }) : null
    );
  // 开关行：标题在左，控件在右
  const rowBlock = (label, sub, control, tip) =>
    el(
      'div',
      { class: 'pv-settings-item' },
      el('div', { class: 'pv-settings-item-head' }, titleCol(label, sub, tip), control)
    );
  // 分段行：标题在上，控件占满整行
  const colBlock = (label, sub, control, tip) =>
    el(
      'div',
      { class: 'pv-settings-item' },
      el('div', { class: 'pv-settings-item-head' }, titleCol(label, sub, tip)),
      control
    );
  const sizeBlock = el(
    'div',
    { class: 'pv-settings-item' },
    el('div', { class: 'pv-settings-item-head' }, titleCol('窗体大小', '弹窗的默认尺寸')),
    sizeSeg.group,
    phoneModelsWrap
  );

  // ---- 通用 / 移动端 标签 ----
  const commonTab = el('button', { type: 'button', class: 'pv-settings-tab active', text: '通用' });
  const mobileTab = el('button', { type: 'button', class: 'pv-settings-tab', text: '移动端' });
  const tabs = el('div', { class: 'pv-settings-tabs' }, commonTab, mobileTab);
  const commonPane = el('div', { class: 'pv-settings-pane active' });
  const mobilePane = el('div', { class: 'pv-settings-pane' });
  const switchTab = (which) => {
    const isCommon = which === 'common';
    commonTab.classList.toggle('active', isCommon);
    mobileTab.classList.toggle('active', !isCommon);
    commonPane.classList.toggle('active', isCommon);
    mobilePane.classList.toggle('active', !isCommon);
  };
  commonTab.addEventListener('click', () => switchTab('common'));
  mobileTab.addEventListener('click', () => switchTab('mobile'));

  // 通用页：全部通用设置
  commonPane.append(
    group('窗体行为'),
    colBlock('窗体驻留方式', '弹窗遮罩与页面交互', windowModeSeg.group, '跟随页面：弹窗带遮罩；独立悬浮：无遮罩、页面可交互，点击链接仍在弹窗内打开内容'),
    sizeBlock,
    rowBlock('窗体滚动条', '显示或隐藏窗体内的滚动条', scrollSwitchWrap),
    rowBlock('锁定窗体', '锁定后窗体不可拖动、不可缩放', lockSwitchWrap),
    group('交互控制'),
    rowBlock('页面链接拦截', '开启后页面链接在弹窗内打开', linkInterceptSwitchWrap, '开启：页面链接点击在弹窗内打开；关闭：页面链接原页面打开，窗体内容里的链接在窗体内部打开（禁止新标签页），窗体自动切换为独立悬浮'),
    rowBlock('链接规则', '拦截本站指定链接并在弹窗打开', manageRulesBtn, '规则按当前站点生效；点「取选」直接在页面上点一下链接即可生成，无需写选择器'),
    group('外观'),
    colBlock('外观主题', '跟随系统或手动指定', themeSeg.group),
    group('高级'),
    rowBlock('在 iframe 中运行', '默认关闭（等同 @noframes）', allowInFrameWrap, '风险：开启后脚本会在页面内所有 iframe 中运行（含广告、嵌入内容等），可能增加页面开销、出现多个悬浮按钮，或与嵌入页面产生样式冲突；仅在确有需要时开启。脚本自己的弹窗 iframe 始终跳过，不会套娃'),
    rowBlock('调试标记', '在页面左上角/右侧显示脚本运行状态与错误标记（下次刷新生效），仅排查问题时开启', debugSwitchWrap, '开启后每次刷新页面会显示：紫色 boot 版本、右侧模块加载序号、橙色初始化状态、红色错误信息；排查完请关闭')
  );
  // 移动端页：仅移动端专属设置（移动端特殊处理）
  mobilePane.append(
    group('移动端专属'),
    rowBlock('四角缩放把手', '触屏下窗体四角显示缩放把手，可自由调整窗体大小', mobileResizeSwitchWrap),
    colBlock('惯用手', '左手：工具栏镜像，关闭按钮移到左上角（移动端单手使用）', handednessSeg.group)
  );

  return el(
    'div',
    { id: 'popup-settings-popover' },
    head,
    tabs,
    commonPane,
    mobilePane,
    el('div', { class: 'pv-settings-footer' }, resetBtn)
  );
}
