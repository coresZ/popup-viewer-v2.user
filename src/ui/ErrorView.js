import { el, svg } from '../utils/dom.js';

export function showError(container, message, url) {
  container.classList.remove('iframe-direct-load');
  const openBtn = el('button', { text: '在新标签页打开' });
  if (!url) {
    openBtn.disabled = true;
  } else {
    openBtn.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
  }
  const view = el(
    'div',
    { id: 'popup-panel-error' },
    svg(
      '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
      { class: 'pv-error-icon', width: 52, height: 52, 'stroke-width': 1.5 }
    ),
    el('h3', { text: '加载失败' }),
    el('p', { text: message || '无法加载请求的内容' }),
    openBtn
  );
  container.replaceChildren(view);
}
