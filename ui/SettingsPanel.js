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
  const hangingSwitch = el('input', { type: 'checkbox', id: 'pv-settings-hanging' });
  hangingSwitch.checked = settingsManager.get().hangingMode === true;
  hangingSwitch.addEventListener('change', () => {
    settingsManager.set({ hangingMode: hangingSwitch.checked });
    persist();
  });
  const resetBtn = el('button', { type: 'button', class: 'pv-settings-reset', text: '恢复默认' });
  resetBtn.addEventListener('click', () => {
    settingsManager.reset();
    scrollSwitch.checked = settingsManager.get().scrollbarVisible !== false;
    hangingSwitch.checked = settingsManager.get().hangingMode === true;
    sizeSeg.sync();
    themeSeg.sync();
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
      el(
        'div',
        { class: 'pv-settings-col-head' },
        el('span', { class: 'pv-settings-label', text: '固定悬挂模式' }),
        el('label', { class: 'pv-switch' }, hangingSwitch, el('span', { class: 'pv-switch-track' }))
      ),
      el('div', {
        class: 'pv-settings-hint',
        text: '首次打开内容后关闭入口，不再响应页面点击，窗口与页面相互独立；关闭该模式或刷新页面后恢复'
      })
    ),
    el('div', { class: 'pv-settings-footer' }, resetBtn)
  );
}
