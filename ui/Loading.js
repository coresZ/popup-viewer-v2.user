import { el } from '../utils/dom.js';

export function showLoading(container, { title = '正在加载内容...' } = {}) {
  container.classList.remove('iframe-direct-load');
  const view = el(
    'div',
    { id: 'popup-panel-loading' },
    el('div', { class: 'spinner' }),
    el('div', { class: 'pv-loading-hint', text: title }),
    el('div', { class: 'pv-loading-sub', text: '请稍候片刻' })
  );
  container.replaceChildren(view);
  return view;
}
