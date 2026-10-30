import { el, svg } from '../utils/dom.js';

/**
 * 把加载器给出的技术性错误转成用户能看懂的说明（v2.3.0）。
 * @returns {{title:string, detail:string, retry:boolean}}
 */
export function describeLoadError(message) {
  const text = String(message || '');
  const status = Number((text.match(/HTTP\s*(\d{3})/i) || [])[1]);
  if (status === 404 || status === 410) {
    return { title: '帖子不存在或已被删除', detail: `服务器返回 ${status}`, retry: false };
  }
  if (status === 401 || status === 403) {
    return { title: '没有权限查看', detail: `可能需要登录，或被网站拒绝（${status}）`, retry: false };
  }
  if (status === 429) return { title: '请求太频繁', detail: '网站暂时限制了访问，稍后再试（429）', retry: true };
  if (status >= 500) return { title: '网站暂时出错', detail: `服务器返回 ${status}，稍后再试`, retry: true };
  if (status) return { title: '加载失败', detail: `服务器返回 ${status}`, retry: true };
  if (/超时|timeout/i.test(text)) return { title: '加载超时', detail: '网络较慢或网站没有响应', retry: true };
  if (/网络|network/i.test(text)) return { title: '网络请求失败', detail: '请检查网络连接', retry: true };
  if (/解析/.test(text)) return { title: '内容无法显示', detail: '页面结构无法解析，可在新标签页打开', retry: false };
  return { title: '加载失败', detail: text || '无法加载请求的内容', retry: true };
}

export function showError(container, message, url, { onRetry } = {}) {
  container.classList.remove('iframe-direct-load');
  const info = describeLoadError(message);
  const openBtn = el('button', { type: 'button', class: 'pv-error-open', text: '在新标签页打开' });
  if (!url) {
    openBtn.disabled = true;
  } else {
    openBtn.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
  }
  const actions = el('div', { class: 'pv-error-actions' });
  if (info.retry && onRetry) {
    actions.appendChild(el('button', { type: 'button', class: 'pv-error-retry', text: '重试', onclick: () => onRetry() }));
  }
  actions.appendChild(openBtn);
  const view = el(
    'div',
    { id: 'popup-panel-error', role: 'alert' },
    svg(
      '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
      { class: 'pv-error-icon', width: 52, height: 52, 'stroke-width': 1.5, 'aria-hidden': 'true' }
    ),
    el('h3', { text: info.title }),
    el('p', { text: info.detail }),
    actions
  );
  container.replaceChildren(view);
}
