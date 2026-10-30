import { el, svgIcon, mountUi, deepActiveElement } from '../utils/dom.js';
import { rulesManager } from '../core/RulesManager.js';
import { eventBus } from '../core/EventBus.js';
import { pickElement } from './ElementPicker.js';

const UNDO_MS = 4000;

export function createRulesPanel() {
  const currentHost = () => window.location.hostname;
  let picking = false;
  // 当前查看的站点；null 表示「全部站点」视图
  let viewHost = currentHost();

  const backdrop = el('div', { id: 'pv-rules-panel-backdrop', onclick: () => close() });
  const closeBtn = el('button', { type: 'button', class: 'popup-panel-btn pv-rules-close', title: '关闭 (Esc)', 'aria-label': '关闭', onclick: () => close() });
  closeBtn.appendChild(svgIcon('close', { size: 15 }));
  const hostEl = el('span', { id: 'pv-rules-host' });
  const allBtn = el('button', { type: 'button', class: 'pv-rules-all', 'aria-pressed': 'false', text: '全部站点', onclick: () => toggleAllView() });
  const header = el(
    'div',
    { id: 'pv-rules-panel-header' },
    el('span', { class: 'pv-rules-title', text: '链接规则' }),
    hostEl,
    allBtn,
    closeBtn
  );
  const listEl = el('div', { id: 'pv-rules-list' });
  const pickBtn = el(
    'button',
    { type: 'button', id: 'pv-rules-pick', onclick: () => startPick() },
    svgIcon('plus', { size: 14 }),
    el('span', { text: '点选链接' })
  );
  const backBtn = el('button', { type: 'button', class: 'pv-rules-back hidden', text: '返回本站规则', onclick: () => showHost(currentHost()) });
  const tipEl = el('div', { class: 'pv-rules-tip', text: '点击「点选链接」，在页面上点一下要拦截的帖子链接，即可自动生成规则（仅当前站点生效，弹窗打开）' });
  const body = el('div', { id: 'pv-rules-panel-body' }, tipEl, listEl, pickBtn, backBtn);
  const root = el('div', { id: 'pv-rules-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': '链接规则' }, header, body);

  // ---- toast（可带一个操作按钮，如「撤销」） ----
  const toastText = el('span', { class: 'pv-rules-toast-text' });
  const toastAction = el('button', { type: 'button', class: 'pv-rules-toast-action hidden' });
  const toastEl = el('div', { id: 'pv-rules-toast', role: 'status' }, toastText, toastAction);
  mountUi(toastEl);
  let toastTimer = null;
  let toastHandler = null;
  function hideToast() {
    clearTimeout(toastTimer);
    toastHandler = null;
    toastEl.classList.remove('visible');
  }
  function toast(msg, action) {
    toastText.textContent = msg;
    toastHandler = action ? action.run : null;
    toastAction.textContent = action ? action.label : '';
    toastAction.classList.toggle('hidden', !action);
    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? UNDO_MS : 1600);
  }
  toastAction.addEventListener('click', () => {
    const run = toastHandler;
    hideToast();
    run?.();
  });

  let returnFocus = null;
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focusables = () => [...root.querySelectorAll(FOCUSABLE)].filter((node) => node.getClientRects().length > 0);
  // 规则面板是模态：Tab 在面板内循环，不落到背后的弹窗/页面
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) return;
    const active = deepActiveElement();
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && (active === first || !root.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !root.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  function open(trigger = deepActiveElement()) {
    viewHost = currentHost();
    returnFocus = trigger;
    // 先同步解除 inert：PopupPanel 的 _syncInert 用 MutationObserver 异步同步，
    // 若等 class 变更后再 focus，closeBtn 仍处于 inert 子树，focus() 会静默失败。
    root.inert = false;
    backdrop.inert = false;
    root.classList.add('visible');
    backdrop.classList.add('visible');
    render();
    const focusClose = () => {
      if (!root.classList.contains('visible')) return;
      try {
        closeBtn.focus({ preventScroll: true });
      } catch {}
    };
    focusClose();
    requestAnimationFrame(focusClose);
  }
  function close() {
    if (picking) return;
    const focusInside = root.contains(deepActiveElement());
    root.classList.remove('visible');
    backdrop.classList.remove('visible');
    hideToast();
    if (focusInside && returnFocus && returnFocus.isConnected) {
      try {
        returnFocus.focus({ preventScroll: true });
      } catch {}
    }
    returnFocus = null;
  }

  function toggleAllView() {
    if (viewHost === null) showHost(currentHost());
    else {
      viewHost = null;
      render();
    }
  }
  function showHost(host) {
    viewHost = host;
    render();
  }

  function render() {
    const isAll = viewHost === null;
    const isCurrent = viewHost === currentHost();
    allBtn.classList.toggle('active', isAll);
    allBtn.setAttribute('aria-pressed', isAll ? 'true' : 'false');
    pickBtn.classList.toggle('hidden', !isCurrent);
    backBtn.classList.toggle('hidden', isCurrent);
    tipEl.classList.toggle('hidden', !isCurrent);
    if (isAll) renderHosts();
    else renderList(viewHost);
  }

  function renderHosts() {
    listEl.textContent = '';
    const hosts = rulesManager.listHosts();
    hostEl.textContent = '全部站点（' + hosts.length + ' 个）';
    if (!hosts.length) {
      listEl.appendChild(el('div', { class: 'pv-rules-empty', text: '还没有任何站点的规则' }));
      return;
    }
    for (const h of hosts) {
      const off = h.count - h.enabled;
      listEl.appendChild(
        el(
          'button',
          { type: 'button', class: 'pv-rules-host-row' + (h.host === currentHost() ? ' is-current' : ''), onclick: () => showHost(h.host) },
          el('span', { class: 'pv-rules-host-name', text: h.host }),
          el('span', { class: 'pv-rules-host-count', text: h.count + ' 条' + (off ? '（' + off + ' 条已停用）' : '') })
        )
      );
    }
  }

  function countOnPage(selector) {
    try {
      return document.querySelectorAll(selector).length;
    } catch {
      return -1;
    }
  }

  function renderList(host) {
    listEl.textContent = '';
    const isCurrent = host === currentHost();
    const rules = rulesManager.getRules(host);
    hostEl.textContent = host + '（' + rules.length + ' 条）';
    if (!rules.length) {
      listEl.appendChild(el('div', { class: 'pv-rules-empty', text: isCurrent ? '还没有规则，点击「点选链接」开始' : '该站点没有规则' }));
      return;
    }
    rules.forEach((r, i) => listEl.appendChild(buildRow(host, r, i, isCurrent)));
  }

  function buildRow(host, r, i, isCurrent) {
    const row = el('div', { class: 'pv-rules-row' + (r.disabled ? ' is-disabled' : '') });
    const selId = 'pv-rules-sel-' + i;
    const selEl = el('div', { class: 'pv-rules-row-sel', id: selId, text: r.selector });
    let countText = '';
    if (isCurrent) {
      const n = countOnPage(r.selector);
      countText = n < 0 ? '选择器无效' : '本页匹配 ' + n + ' 个';
    }
    if (r.disabled) countText = (countText ? countText + ' · ' : '') + '已停用';
    const info = el('div', { class: 'pv-rules-row-info' }, selEl, countText ? el('div', { class: 'pv-rules-row-count', text: countText }) : null);

    // 启用开关
    const toggle = el('input', { type: 'checkbox', 'aria-labelledby': selId, title: r.disabled ? '已停用，点击启用' : '已启用，点击停用' });
    toggle.checked = !r.disabled;
    toggle.addEventListener('change', () => {
      rulesManager.updateRule(host, i, { disabled: !toggle.checked });
      render();
      toast(toggle.checked ? '已启用' : '已停用');
    });
    const toggleWrap = el('label', { class: 'pv-switch pv-rules-toggle' }, toggle, el('span', { class: 'pv-switch-track' }));

    const editBtn = el('button', { type: 'button', class: 'pv-rules-edit', title: '编辑选择器', text: '编辑', onclick: () => startEdit(host, i, row, info, r) });

    const del = el('button', { type: 'button', class: 'pv-rules-del', title: '删除', 'aria-label': '删除规则' }, svgIcon('close', { size: 13 }), el('span', { class: 'pv-rules-del-text', text: '再点一次删除' }));
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDelete(del, host, i);
    });
    row.append(info, toggleWrap, editBtn, del);
    return row;
  }

  function startEdit(host, index, row, info, rule) {
    const input = el('input', { type: 'text', class: 'pv-rules-edit-input', value: rule.selector, 'aria-label': '编辑 CSS 选择器' });
    const meta = el('div', { class: 'pv-rules-row-count' });
    const syncMeta = () => {
      const n = countOnPage(input.value.trim());
      meta.textContent = n < 0 ? '选择器无效' : '本页匹配 ' + n + ' 个';
    };
    const save = () => {
      const v = input.value.trim();
      if (v === rule.selector) return render();
      if (countOnPage(v) < 0) return toast('选择器无效');
      if (!rulesManager.updateRule(host, index, { selector: v })) return toast('选择器为空或与已有规则重复');
      render();
      toast('已保存');
    };
    input.addEventListener('input', syncMeta);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        // 只取消编辑，不关闭规则面板
        e.preventDefault();
        e.stopPropagation();
        render();
      }
    });
    const saveBtn = el('button', { type: 'button', class: 'pv-rules-edit', text: '保存', onclick: save });
    const cancelBtn = el('button', { type: 'button', class: 'pv-rules-edit', text: '取消', onclick: () => render() });
    row.textContent = '';
    row.classList.add('is-editing');
    row.append(el('div', { class: 'pv-rules-row-info' }, input, meta), saveBtn, cancelBtn);
    syncMeta();
    input.focus();
    input.select();
  }

  function confirmDelete(btn, host, index) {
    if (btn.dataset.confirm === '1') {
      const rule = { ...rulesManager.getRules(host)[index] };
      rulesManager.removeRule(host, index);
      render();
      toast('已删除', {
        label: '撤销',
        run: () => {
          rulesManager.insertRule(host, index, rule);
          if (root.classList.contains('visible')) render();
          toast('已恢复');
        }
      });
      return;
    }
    btn.dataset.confirm = '1';
    btn.classList.add('confirming');
    btn.title = '再点一次删除';
    setTimeout(() => {
      btn.dataset.confirm = '';
      btn.classList.remove('confirming');
      btn.title = '删除';
    }, 2200);
  }

  async function startPick() {
    if (picking) return;
    picking = true;
    pickBtn.disabled = true;
    // 收起面板露出页面，选完再恢复（同 jav.js）；弹窗与遮罩由外壳监听 picker-start/picker-end 处理
    root.classList.remove('visible');
    backdrop.classList.remove('visible');
    hideToast();
    eventBus.emit('picker-start');
    let selector = null;
    try {
      selector = await pickElement();
    } finally {
      eventBus.emit('picker-end', { selector });
      root.classList.add('visible');
      backdrop.classList.add('visible');
      picking = false;
      pickBtn.disabled = false;
    }
    if (!selector) return;
    rulesManager.addRule(currentHost(), selector);
    viewHost = currentHost();
    render();
    toast('已添加规则');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('visible')) {
      // 规则面板优先级高于弹窗面板：只关规则面板，不再触发弹窗的 Esc 关闭
      e.stopImmediatePropagation();
      close();
    }
  });

  return { root, backdrop, open, close, startPick };
}
