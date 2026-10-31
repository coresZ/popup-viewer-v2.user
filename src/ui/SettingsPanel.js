import { el, svgIcon, mountUi, closestInPath, eventTarget } from '../utils/dom.js';
import { config } from '../config.js';
import { gm } from '../utils/gm.js';
import { settingsManager } from '../core/SettingsManager.js';
import { eventBus } from '../core/EventBus.js';
import { storageManager } from '../core/StorageManager.js';

export function createSettingsPanel({ onChange, onManageRules, onClose }) {
  // custom：拖拽缩放后的自定义尺寸，只作为状态显示，不可点选
  const SIZE_ORDER = ['small', 'medium', 'large', 'phone', 'custom'];
  const SIZE_LABELS = { small: '小', medium: '中', large: '大', phone: '手机', custom: '自定义' };
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
  mountUi(tipEl);
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
    if (closestInPath(e, '.pv-settings-tip') || eventTarget(e) === tipEl) return;
    hideTip();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTip();
  });

  // ---- 分段控件 ----
  // statusOnly：只在当前值等于它时显示、不可点（如「自定义」尺寸）；
  // disabledOf(k)：返回原因字符串时该项置灰不可选，原因写进 title 并通过 onDisabled 回调外显
  const makeSeg = (order, labels, getKey, setKey, { icons = {}, defaultOf, onChange, onSet, statusOnly = [], disabledOf, onDisabled } = {}) => {
    const btns = {};
    const group = el('div', { class: 'pv-seg', role: 'group' });
    const sync = () => {
      const current = getKey();
      let reason = '';
      Object.entries(btns).forEach(([k, b]) => {
        const active = k === current;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
        b.classList.toggle('is-default', !!defaultOf && k === defaultOf);
        if (statusOnly.includes(k)) b.classList.toggle('hidden', !active);
        const why = disabledOf ? disabledOf(k) : '';
        b.disabled = !!why;
        if (why) {
          b.title = why;
          reason = why;
        } else b.removeAttribute('title');
      });
      onDisabled?.(reason);
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
            if (statusOnly.includes(k) || btn.disabled) return;
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
    onSet: (k) => ({ panelSize: k, customSize: null }),
    statusOnly: ['custom']
  });
  // 拖拽缩放会把 panelSize 改成 custom：设置变化时刷新尺寸分段的高亮
  eventBus.on?.('settings-changed', () => sizeSeg.sync());
  const themeSeg = makeSeg(THEME_ORDER, THEME_LABELS, () => settingsManager.get().theme || 'auto', 'theme', {
    defaultOf: DEFAULT_THEME
  });
  // 「遮罩」不可选时的原因说明（S2）
  const windowModeNote = el('div', { class: 'pv-settings-note hidden', role: 'note' });
  const windowModeSeg = makeSeg(
    ['coupled', 'float'],
    { coupled: '遮罩（点空白关闭）', float: '悬浮（不挡页面）' },
    () => settingsManager.get().windowMode || 'coupled',
    'windowMode',
    {
      // 不变量：关闭页面链接拦截时只能悬浮（SettingsManager._applyInvariants），置灰并说明原因
      disabledOf: (k) => (k === 'coupled' && settingsManager.get().linkIntercept === false ? '已关闭「页面链接拦截」，只能使用悬浮' : ''),
      onDisabled: (reason) => {
        windowModeNote.textContent = reason;
        windowModeNote.classList.toggle('hidden', !reason);
      }
    }
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
    windowModeSeg.sync(); // 开关两个方向都要刷新「遮罩」项的可用状态
    persist();
  });
  const linkInterceptSwitchWrap = el('label', { class: 'pv-switch' }, linkInterceptSwitch, el('span', { class: 'pv-switch-track' }));

  // 窗体内链接新标签页打开（S2：从 linkIntercept 拆出的独立开关，按站点保存）
  const popupLinksSwitch = el('input', { type: 'checkbox', id: 'pv-settings-popup-links' });
  popupLinksSwitch.checked = settingsManager.get().popupLinksNewTab !== false;
  popupLinksSwitch.addEventListener('change', () => {
    settingsManager.set({ popupLinksNewTab: popupLinksSwitch.checked });
    persist();
  });
  const popupLinksSwitchWrap = el('label', { class: 'pv-switch' }, popupLinksSwitch, el('span', { class: 'pv-switch-track' }));

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

  // 恢复默认：两步确认。第一次点击进入确认态（约 3 秒），再点才重置全局 + 本站设置
  const RESET_LABEL = '恢复默认';
  const resetBtn = el('button', {
    type: 'button',
    class: 'pv-settings-reset',
    text: RESET_LABEL,
    title: '重置全部全局设置和本站设置（不影响其他站点和链接规则）'
  });
  let resetTimer = 0;
  const disarmReset = () => {
    clearTimeout(resetTimer);
    resetTimer = 0;
    resetBtn.classList.remove('confirming');
    resetBtn.textContent = RESET_LABEL;
  };
  resetBtn.addEventListener('click', () => {
    if (!resetTimer) {
      resetBtn.classList.add('confirming');
      resetBtn.textContent = '确认恢复全局+本站设置？';
      resetTimer = setTimeout(disarmReset, 3000);
      return;
    }
    disarmReset();
    settingsManager.reset();
    popupLinksSwitch.checked = settingsManager.get().popupLinksNewTab !== false;
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
  const closeBtn = el('button', {
    type: 'button',
    class: 'pv-settings-close',
    title: '关闭设置',
    'aria-label': '关闭设置',
    onclick: () => onClose?.()
  });
  closeBtn.appendChild(svgIcon('close', { size: 14 }));
  const head = el(
    'div',
    { class: 'pv-settings-head' },
    el('span', { class: 'pv-settings-title', text: '设置' }),
    closeBtn
  );

  // ---- 布局 ----
  const group = (title) => el('div', { class: 'pv-settings-group' }, el('div', { class: 'pv-settings-group-title', text: title }));
  // settingKey：对应的设置键；按站点保存的键在标题旁标「仅本站」（S1）
  let labelSeq = 0;
  const titleCol = (label, sub, tip, settingKey) => {
    const n = ++labelSeq;
    const labelId = `pv-settings-label-${n}`;
    const subId = `pv-settings-sub-${n}`;
    const site = !!settingKey && settingsManager.isSiteKey(settingKey);
    const col = el(
      'div',
      { class: 'pv-settings-title-col' },
      el(
        'div',
        { class: 'pv-settings-label-line' },
        el('span', { class: 'pv-settings-label', id: labelId, text: label }),
        site ? el('span', { class: 'pv-settings-scope', title: '此项按站点分别保存，只影响当前网站', text: '仅本站' }) : null,
        tip ? makeTip(tip) : null
      ),
      sub ? el('div', { class: 'pv-settings-sub', id: subId, text: sub }) : null
    );
    return { col, labelId, subId: sub ? subId : null };
  };
  // 给控件补可访问名称：开关 input / 分段 group 指向标题与说明（V4）
  const labelControl = (control, t) => {
    if (control.tagName === 'BUTTON') return; // 按钮保留自身文字作为名称
    const target = control.querySelector('input') || control;
    target.setAttribute('aria-labelledby', t.labelId);
    if (t.subId) target.setAttribute('aria-describedby', t.subId);
  };
  // 开关行：标题在左，控件在右
  const rowBlock = (label, sub, control, tip, settingKey) => {
    const t = titleCol(label, sub, tip, settingKey);
    labelControl(control, t);
    return el('div', { class: 'pv-settings-item' }, el('div', { class: 'pv-settings-item-head' }, t.col, control));
  };
  // 分段行：标题在上，控件占满整行；extra 为控件下方的附加节点
  const colBlock = (label, sub, control, tip, settingKey, ...extra) => {
    const t = titleCol(label, sub, tip, settingKey);
    labelControl(control, t);
    return el('div', { class: 'pv-settings-item' }, el('div', { class: 'pv-settings-item-head' }, t.col), control, ...extra);
  };
  const sizeBlock = colBlock('窗体大小', '弹窗的默认尺寸', sizeSeg.group, null, 'panelSize', phoneModelsWrap);

  const footer = el('div', { class: 'pv-settings-footer' }, resetBtn);

  // ---- 最近（E3）：最近打开的 20 条，点击在弹窗里重新打开 ----
  const RECENT_LIMIT = 20;
  const recentList = el('div', { class: 'pv-recent-list' });
  const clearLabel = '清空本站';
  const clearBtn = el('button', { type: 'button', class: 'pv-settings-reset pv-recent-clear', text: clearLabel });
  let clearTimer = 0;
  const disarmClear = () => {
    clearTimeout(clearTimer);
    clearTimer = 0;
    clearBtn.classList.remove('confirming');
    clearBtn.textContent = clearLabel;
  };
  clearBtn.addEventListener('click', () => {
    if (!clearTimer) {
      clearBtn.classList.add('confirming');
      clearBtn.textContent = '确认清空本站记录？';
      clearTimer = setTimeout(disarmClear, 3000);
      return;
    }
    disarmClear();
    storageManager.clearHistory(window.location.hostname);
    renderRecent();
  });
  const recentHead = el(
    'div',
    { class: 'pv-recent-head' },
    el('span', { class: 'pv-settings-group-title', text: '最近打开（本站）' }),
    clearBtn
  );
  function renderRecent() {
    disarmClear();
    recentList.textContent = '';
    let items = [];
    try {
      items = storageManager.getHistory();
    } catch {}
    const currentHost = window.location.hostname;
    // 设置面板的「最近」只展示当前站点的历史，避免跨站记录串台；
    // 存储层仍然保留全部记录，后续如需「全部站点」视图可直接放开这个过滤。
    items = (Array.isArray(items) ? items : [])
      .filter((h) => h && h.url && hostOf(h.url) === currentHost)
      .slice(0, RECENT_LIMIT);
    clearBtn.classList.toggle('hidden', !items.length);
    if (!items.length) {
      recentList.appendChild(el('div', { class: 'pv-recent-empty', text: '本站还没有记录，打开过的帖子会显示在这里' }));
      return;
    }
    for (const h of items) {
      const title = h.title || h.url;
      recentList.appendChild(
        el(
          'button',
          {
            type: 'button',
            class: 'pv-recent-item',
            title: h.url,
            onclick: () => {
              onClose?.();
              eventBus.emit('open-page', { url: h.url, title: h.title || '' });
            }
          },
          el('span', { class: 'pv-recent-title', text: title }),
          el('span', { class: 'pv-recent-meta', text: relativeTime(h.time) })
        )
      );
    }
  }

  // ---- 通用 / 移动端 / 最近 标签 ----
  const commonTab = el('button', {
    type: 'button',
    id: 'pv-settings-tab-common',
    class: 'pv-settings-tab active',
    'aria-controls': 'pv-settings-pane-common',
    text: '通用'
  });
  const mobileTab = el('button', {
    type: 'button',
    id: 'pv-settings-tab-mobile',
    class: 'pv-settings-tab',
    'aria-controls': 'pv-settings-pane-mobile',
    text: '移动端'
  });
  const recentTab = el('button', {
    type: 'button',
    id: 'pv-settings-tab-recent',
    class: 'pv-settings-tab',
    'aria-controls': 'pv-settings-pane-recent',
    text: '最近'
  });
  const tabs = el('div', { class: 'pv-settings-tabs', role: 'tablist', 'aria-label': '设置分类' }, commonTab, mobileTab, recentTab);
  const commonPane = el('div', {
    id: 'pv-settings-pane-common',
    class: 'pv-settings-pane active',
    role: 'tabpanel',
    'aria-labelledby': 'pv-settings-tab-common'
  });
  const mobilePane = el('div', {
    id: 'pv-settings-pane-mobile',
    class: 'pv-settings-pane',
    role: 'tabpanel',
    'aria-labelledby': 'pv-settings-tab-mobile'
  });
  const recentPane = el('div', {
    id: 'pv-settings-pane-recent',
    class: 'pv-settings-pane pv-recent-pane',
    role: 'tabpanel',
    'aria-labelledby': 'pv-settings-tab-recent'
  });
  const TAB_PANES = { common: [commonTab, commonPane], mobile: [mobileTab, mobilePane], recent: [recentTab, recentPane] };
  const TAB_ORDER = ['common', 'mobile', 'recent'];
  const switchTab = (which) => {
    for (const [k, [tab, pane]] of Object.entries(TAB_PANES)) {
      tab.classList.toggle('active', k === which);
      tab.setAttribute('aria-selected', k === which ? 'true' : 'false');
      tab.tabIndex = k === which ? 0 : -1;
      pane.classList.toggle('active', k === which);
    }
    // 「最近」页不需要「恢复默认」
    footer.classList.toggle('hidden', which === 'recent');
    if (which === 'recent') renderRecent();
  };
  for (const [k, [tab]] of Object.entries(TAB_PANES)) {
    tab.setAttribute('role', 'tab');
    tab.addEventListener('click', () => switchTab(k));
  }
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const current = TAB_ORDER.findIndex((k) => TAB_PANES[k][0].classList.contains('active'));
    const next = (current + (e.key === 'ArrowRight' ? 1 : -1) + TAB_ORDER.length) % TAB_ORDER.length;
    switchTab(TAB_ORDER[next]);
    TAB_PANES[TAB_ORDER[next]][0].focus();
  });
  // 初始只有当前 tab 在 Tab 键序列里，符合 tablist 的 roving tabindex 约定
  switchTab('common');
  recentPane.append(recentHead, recentList);

  // 通用页：全部通用设置
  commonPane.append(
    group('窗体行为'),
    colBlock('窗体驻留方式', '弹窗遮罩与页面交互', windowModeSeg.group, '遮罩：弹窗带遮罩，点空白处关闭；悬浮：无遮罩、不挡页面，页面可继续操作，点击链接仍在弹窗内打开', 'windowMode', windowModeNote),
    sizeBlock,
    rowBlock('窗体滚动条', '显示或隐藏窗体内的滚动条', scrollSwitchWrap, null, 'scrollbarVisible'),
    rowBlock('锁定窗体', '锁定后窗体不可拖动、不可缩放', lockSwitchWrap, null, 'locked'),
    group('交互控制'),
    rowBlock('页面链接拦截', '开启后页面链接在弹窗内打开', linkInterceptSwitchWrap, '开启：点击页面链接在弹窗内打开；关闭：页面链接按原样在页面打开，窗体只能悬浮（不挡页面）', 'linkIntercept'),
    rowBlock('窗体内链接新标签页打开', '弹窗内容里的链接在新标签页打开', popupLinksSwitchWrap, '开启：弹窗内容里的链接在新标签页打开；关闭：在弹窗内部跳转', 'popupLinksNewTab'),
    rowBlock('链接规则', '拦截本站指定链接并在弹窗打开', manageRulesBtn, '规则按当前站点生效；点「点选链接」后在页面上点一下链接即可生成，无需写选择器'),
    group('外观'),
    colBlock('外观主题', '跟随系统或手动指定', themeSeg.group, null, 'theme'),
    group('高级'),
    rowBlock('在 iframe 中运行', '默认关闭（等同 @noframes）', allowInFrameWrap, '风险：开启后脚本会在页面内所有 iframe 中运行（含广告、嵌入内容等），可能增加页面开销、出现多个悬浮按钮，或与嵌入页面产生样式冲突；仅在确有需要时开启。脚本自己的弹窗 iframe 始终跳过，不会套娃'),
    rowBlock('调试标记', '在页面左上角/右侧显示脚本运行状态与错误标记（下次刷新生效），仅排查问题时开启', debugSwitchWrap, '开启后每次刷新页面会显示：紫色 boot 版本、右侧模块加载序号、橙色初始化状态、红色错误信息；排查完请关闭')
  );
  // 移动端页：仅移动端专属设置（移动端特殊处理）
  mobilePane.append(
    group('移动端专属'),
    rowBlock('四角缩放把手', '触屏下窗体四角显示缩放把手，可自由调整窗体大小（默认关闭）', mobileResizeSwitchWrap),
    colBlock('惯用手', '左手：工具栏镜像，关闭按钮移到左上角（移动端单手使用）', handednessSeg.group)
  );

  // sticky 顶部：标题 + 关闭 + tab 一起固定，滚动时不会只剩 tab 或漏出下方内容
  const topArea = el('div', { class: 'pv-settings-top' }, head, tabs);

  const root = el(
    'div',
    { id: 'popup-settings-popover', role: 'dialog', 'aria-label': '设置' },
    topArea,
    commonPane,
    mobilePane,
    recentPane,
    footer
  );
  // 每次打开设置都重读一次历史：面板实例是复用的，停在「最近」时直接复用旧列表会显示上一次的数据
  root.refresh = () => {
    if (recentPane.classList.contains('active')) renderRecent();
  };
  return root;
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期 */
function relativeTime(t) {
  const diff = Date.now() - Number(t || 0);
  if (!t || diff < 0) return '';
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + ' 分钟前';
  const h = Math.floor(min / 60);
  if (h < 24) return h + ' 小时前';
  const d = Math.floor(h / 24);
  if (d < 30) return d + ' 天前';
  const date = new Date(Number(t));
  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
}
function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
