import { el, svgIcon } from '../utils/dom.js';

export function createToolbar(handlers) {
  const actions = el('div', { id: 'popup-panel-actions' });
  const makeBtn = (id, icon, title, onClick) => {
    const btn = el('button', { id, class: 'popup-panel-btn', title, onclick: onClick });
    btn.appendChild(svgIcon(icon));
    actions.appendChild(btn);
    return btn;
  };
  const refresh = makeBtn('popup-panel-refresh', 'refresh', '刷新内容 (R)', () => handlers.onRefresh?.());
  const maximize = makeBtn('popup-panel-maximize', 'maximize', '全屏 (F)', () => handlers.onMaximize?.());
  const open = makeBtn('popup-panel-open-in-new', 'external', '在新标签页打开', () => handlers.onOpenExternal?.());
  const settings = makeBtn('popup-panel-settings', 'settings', '设置', () => handlers.onSettings?.());
  const close = makeBtn('popup-panel-close', 'close', '关闭 (Esc)', () => handlers.onClose?.());
  return { actions, refresh, maximize, open, settings, close };
}
