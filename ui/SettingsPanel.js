import { el } from '../utils/dom.js';
import { settingsManager } from '../core/SettingsManager.js';
import { eventBus } from '../core/EventBus.js';

export function createSettingsPanel({ onChange }) {
  const SIZE_ORDER = ['small', 'medium', 'large', 'phone'];
  const SIZE_LABELS = { small: '小', medium: '中', large: '大', phone: '手机' };
  const THEME_ORDER = ['auto', 'light', 'dark'];
  const THEME_LABELS = { auto: '跟随系统', light: '浅色', dark: '深色' };
  const persist = () => {
    onChange?.(settingsManager.get());
    eventBus.emit('settings-changed', settingsManager.get());
  };
  const makeSeg = (order, labels, getKey, setKey) => {
    const btns = {};
    const group = el('div', { class: 'pv-seg' });
    const sync = () => {
      const current = getKey();
      Object.entries(btns).forEach(([k, b]) => b.classList.toggle('active', k === current));
    };
    order.forEach((k) => {
      const btn = el('button', {
        type: 'button',
        class: 'pv-seg-item',
        text: labels[k],
        onclick: () => {
          settingsManager.set({ [setKey]: k });
          sync();
          persist();
        }
      });
      btns[k] = btn;
      group.appendChild(btn);
    });
    sync();
    return { group, sync };
  };
  const sizeSeg = makeSeg(SIZE_ORDER, SIZE_LABELS, () => settingsManager.get().panelSize, 'panelSize');
  const themeSeg = makeSeg(THEME_ORDER, THEME_LABELS, () => settingsManager.get().theme || 'auto', 'theme');
  const scrollSwitch = el('input', { type: 'checkbox', id: 'pv-settings-scroll' });
  scrollSwitch.checked = settingsManager.get().scrollbarVisible !== false;
  scrollSwitch.addEventListener('change', () => {
    settingsManager.set({ scrollbarVisible: scrollSwitch.checked });
    persist();
  });
  const linkInterceptSwitch = el('input', { type: 'checkbox', id: 'pv-settings-link-intercept' });
  linkInterceptSwitch.checked = settingsManager.get().linkIntercept !== false;
  linkInterceptSwitch.addEventListener('change', () => {
    settingsManager.set({ linkIntercept: linkInterceptSwitch.checked });
    if (!linkInterceptSwitch.checked) windowModeSeg.sync();
    persist();
  });
  const windowModeSeg = makeSeg(
    ['coupled', 'float'],
    { coupled: '跟随页面', float: '独立悬浮' },
    () => settingsManager.get().windowMode || 'coupled',
    'windowMode'
  );
  const resetBtn = el('button', { type: 'button', class: 'pv-settings-reset', text: '恢复默认' });
  resetBtn.addEventListener('click', () => {
    settingsManager.reset();
    scrollSwitch.checked = settingsManager.get().scrollbarVisible !== false;
    linkInterceptSwitch.checked = settingsManager.get().linkIntercept !== false;
    sizeSeg.sync();
    themeSeg.sync();
    windowModeSeg.sync();
    persist();
  });
  return el(
    'div',
    { id: 'popup-settings-popover' },
    el(
      'div',
      { class: 'pv-settings-row' },
      el('span', { class: 'pv-settings-label', text: '窗体滚动条' }),
      el('label', { class: 'pv-switch' }, scrollSwitch, el('span', { class: 'pv-switch-track' }))
    ),
    el(
      'div',
      { class: 'pv-settings-col' },
      el(
        'div',
        { class: 'pv-settings-col-head' },
        el('span', { class: 'pv-settings-label', text: '页面链接拦截' }),
        el('label', { class: 'pv-switch' }, linkInterceptSwitch, el('span', { class: 'pv-switch-track' }))
      ),
      el('div', {
        class: 'pv-settings-hint',
        text: '开启：页面链接点击在弹窗内打开；关闭：页面链接原页面打开，窗体内容里的链接在窗体内部打开（禁止新标签页），窗体自动切换为独立悬浮'
      })
    ),
    el(
      'div',
      { class: 'pv-settings-col' },
      el('span', { class: 'pv-settings-label', text: '窗体大小' }),
      sizeSeg.group
    ),
    el(
      'div',
      { class: 'pv-settings-col' },
      el('span', { class: 'pv-settings-label', text: '外观主题' }),
      themeSeg.group
    ),
    el(
      'div',
      { class: 'pv-settings-col' },
      el('span', { class: 'pv-settings-label', text: '窗体驻留方式' }),
      windowModeSeg.group,
      el('div', {
        class: 'pv-settings-hint',
        text: '跟随页面：弹窗带遮罩；独立悬浮：无遮罩、页面可交互，点击链接仍在弹窗内打开内容'
      })
    ),
    el('div', { class: 'pv-settings-footer' }, resetBtn)
  );
}
