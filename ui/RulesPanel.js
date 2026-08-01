import { el, svgIcon } from '../utils/dom.js';
import { rulesManager } from '../core/RulesManager.js';
import { pickElement } from './ElementPicker.js';

export function createRulesPanel() {
  const hostname = () => window.location.hostname;
  let picking = false;

  const backdrop = el('div', { id: 'pv-rules-panel-backdrop', onclick: () => close() });
  const closeBtn = el('button', { type: 'button', class: 'popup-panel-btn', title: '关闭 (Esc)', onclick: () => close() });
  closeBtn.appendChild(svgIcon('close', { size: 15 }));
  const hostEl = el('span', { id: 'pv-rules-host' });
  const header = el(
    'div',
    { id: 'pv-rules-panel-header' },
    el('span', { class: 'pv-rules-title', text: '链接规则' }),
    hostEl,
    closeBtn
  );
  const listEl = el('div', { id: 'pv-rules-list' });
  const pickBtn = el(
    'button',
    { type: 'button', id: 'pv-rules-pick', onclick: () => startPick() },
    svgIcon('plus', { size: 14 }),
    el('span', { text: '取选新链接' })
  );
  const body = el(
    'div',
    { id: 'pv-rules-panel-body' },
    el('div', { class: 'pv-rules-tip', text: '点击「取选新链接」，在页面上点一下要拦截的帖子链接，即可自动生成规则（仅当前站点生效，弹窗打开）' }),
    listEl,
    pickBtn
  );
  const root = el('div', { id: 'pv-rules-panel' }, header, body);

  const toastEl = el('div', { id: 'pv-rules-toast' });
  document.body.appendChild(toastEl);
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 1600);
  }

  function open() {
    root.classList.add('visible');
    backdrop.classList.add('visible');
    renderList();
    closeBtn.focus();
  }
  function close() {
    if (picking) return;
    root.classList.remove('visible');
    backdrop.classList.remove('visible');
    toastEl.classList.remove('visible');
  }
  function renderList() {
    listEl.innerHTML = '';
    const rules = rulesManager.getRules(hostname());
    hostEl.textContent = hostname() + '（' + rules.length + ' 条）';
    if (!rules.length) {
      listEl.appendChild(el('div', { class: 'pv-rules-empty', text: '还没有规则，点击「取选新链接」开始' }));
      return;
    }
    rules.forEach((r, i) => {
      const count = (() => {
        try {
          return document.querySelectorAll(r.selector).length;
        } catch {
          return 0;
        }
      })();
      const row = el('div', { class: 'pv-rules-row' });
      const info = el(
        'div',
        { class: 'pv-rules-row-info' },
        el('div', { class: 'pv-rules-row-sel', text: r.selector }),
        el('div', { class: 'pv-rules-row-count', text: '本页匹配 ' + count + ' 个链接' })
      );
      const del = el(
        'button',
        { type: 'button', class: 'pv-rules-del', title: '删除', onclick: (e) => { e.stopPropagation(); confirmDelete(del, i); } },
        svgIcon('close', { size: 13 })
      );
      row.appendChild(info);
      row.appendChild(del);
      listEl.appendChild(row);
    });
  }
  function confirmDelete(btn, index) {
    if (btn.dataset.confirm === '1') {
      rulesManager.removeRule(hostname(), index);
      renderList();
      toast('已删除');
      return;
    }
    btn.dataset.confirm = '1';
    btn.classList.add('confirming');
    setTimeout(() => {
      btn.dataset.confirm = '';
      btn.classList.remove('confirming');
    }, 2200);
  }
  async function startPick() {
    if (picking) return;
    picking = true;
    pickBtn.disabled = true;
    // 收起面板露出页面，选完再恢复（同 jav.js）
    root.classList.remove('visible');
    backdrop.classList.remove('visible');
    const selector = await pickElement();
    root.classList.add('visible');
    backdrop.classList.add('visible');
    picking = false;
    pickBtn.disabled = false;
    if (!selector) return;
    rulesManager.addRule(hostname(), selector);
    renderList();
    toast('已添加规则');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('visible')) close();
  });

  return { root, backdrop, open, close };
}
