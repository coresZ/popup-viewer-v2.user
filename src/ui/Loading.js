import { el } from '../utils/dom.js';

/** 等待超过这么久，补一句「还在加载」和备用出口（v2.3.0）。 */
const SLOW_HINT_MS = 3000;

export function showLoading(container, { title = '正在加载内容…', url = '' } = {}) {
  container.classList.remove('iframe-direct-load');
  const sub = el('div', { class: 'pv-loading-sub', text: '请稍候' });
  const view = el(
    'div',
    { id: 'popup-panel-loading', role: 'status', 'aria-live': 'polite' },
    el('div', { class: 'pv-spinner spinner', 'aria-hidden': 'true' }),
    el('div', { class: 'pv-loading-hint', text: title }),
    sub
  );
  container.replaceChildren(view);
  setTimeout(() => {
    if (!view.isConnected) return;
    sub.textContent = '还在加载，网站响应较慢';
    if (url) {
      view.appendChild(
        el('button', {
          type: 'button',
          class: 'pv-loading-open',
          text: '在新标签页打开',
          onclick: () => window.open(url, '_blank', 'noopener')
        })
      );
    }
  }, SLOW_HINT_MS);
  return view;
}
