import { el, mountUi, closestInPath, isOwnUiNode } from '../utils/dom.js';
import { buildSelectorCandidates, isStableClassName } from '../utils/selector.js';

const MAX_HITS = 200; // 确认阶段最多高亮的命中数
const TAP_SLOP = 10; // 触摸位移超过该像素视为滑动，不算点选

/**
 * 点选链接模式：可选中任意元素（参考 jav.js 的点选交互）。
 * 悬停高亮 + 提示条 → 单击/点按生成多个候选 →
 * 候选用通俗描述展示并高亮页面上全部命中，原始选择器收在「高级」里 → 确认。
 * 自身节点（遮罩/提示条/确认框/高亮框）一律通过 mountUi 挂载；被检查的页面元素留在页面文档里。
 * @returns {Promise<string|null>} 选择器；取消返回 null
 */
export function pickElement() {
  return new Promise((resolve) => {
    let done = false;
    let phase = 'hover';
    let hoverEl = null;
    let cands = [];
    let activeSel = '';
    let touchStart = null;

    const coarse = (() => {
      try {
        return window.matchMedia('(pointer: coarse)').matches;
      } catch {
        return false;
      }
    })();
    const IDLE_HINT = coarse ? '点选链接：点按要拦截的链接' : '点选链接：移动鼠标高亮，单击要拦截的链接 · Esc 取消';

    const overlay = el('div', { class: 'pv-picker-overlay' });
    const hintText = el('span', { class: 'pv-picker-bar-text', text: IDLE_HINT });
    const hintCancel = el('button', { type: 'button', class: 'pv-picker-bar-cancel', text: '取消' });
    const hint = el('div', { class: 'pv-picker-bar', id: 'pv-picker-hint', role: 'status' }, hintText, hintCancel);
    const highlight = el('div', { class: 'pv-picker-highlight hidden' });
    const hits = el('div', { class: 'pv-picker-hits' });

    // 确认面板
    const cTitle = el('div', { class: 'pv-picker-c-title', text: '要拦截哪些链接？' });
    const cCands = el('div', { class: 'pv-picker-cands', role: 'radiogroup', 'aria-label': '候选范围' });
    const cMeta = el('div', { class: 'pv-picker-c-meta' });
    const cInput = el('input', { type: 'text', class: 'pv-picker-input', placeholder: '可手动改写选择器', 'aria-label': 'CSS 选择器' });
    const cAdv = el(
      'details',
      { class: 'pv-picker-adv' },
      el('summary', { text: '高级（CSS 选择器）' }),
      cInput
    );
    const okBtn = el('button', { type: 'button', class: 'pv-picker-btn primary', text: '确认' });
    const againBtn = el('button', { type: 'button', class: 'pv-picker-btn', text: '重新选' });
    const cancelBtn = el('button', { type: 'button', class: 'pv-picker-btn', text: '取消' });
    const cBtns = el('div', { class: 'pv-picker-c-btns' }, againBtn, cancelBtn, okBtn);
    const confirm = el('div', { class: 'pv-picker-confirm hidden', role: 'dialog', 'aria-label': '确认点选的链接' }, cTitle, cCands, cMeta, cAdv, cBtns);

    mountUi(overlay);
    mountUi(hits);
    mountUi(highlight);
    mountUi(hint);
    mountUi(confirm);

    // 内联 pointer-events（同 jav.js）：遮罩/提示条/高亮永不接收事件，避免被站点 CSS 覆盖；
    // 提示条里的「取消」单独接收点击
    overlay.style.pointerEvents = 'none';
    hint.style.pointerEvents = 'none';
    hits.style.pointerEvents = 'none';
    hintCancel.style.pointerEvents = 'auto';
    confirm.style.pointerEvents = 'auto';

    function finish(sel) {
      if (done) return;
      done = true;
      cleanup();
      resolve(sel);
    }
    function cleanup() {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseover', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      window.removeEventListener('scroll', onRepaint, true);
      window.removeEventListener('resize', onRepaint, true);
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      hint.remove();
      confirm.remove();
      highlight.remove();
      hits.remove();
    }

    const OWN_SEL = '.pv-picker-overlay, .pv-picker-confirm, .pv-picker-bar, .pv-picker-highlight, .pv-picker-hits';
    function isOwn(el2) {
      if (!el2 || el2.nodeType !== 1) return false;
      if (isOwnUiNode(el2)) return true;
      try {
        return !!el2.closest(OWN_SEL);
      } catch {
        return false;
      }
    }
    /** 事件是否落在脚本自己的点选界面上（含 shadow 内） */
    function inOwnUi(e) {
      return !!closestInPath(e, '.pv-picker-confirm, .pv-picker-bar');
    }
    function resolveTarget(raw) {
      let el2 = raw;
      if (!el2 || el2.nodeType !== 1) el2 = el2 && el2.parentElement;
      if (!el2 || el2.nodeType !== 1) return null;
      if (isOwn(el2)) return null;
      // 抬升无稳定 class 的 span
      if (el2.tagName === 'SPAN' && el2.parentElement) {
        const firstCls = String((el2.className || '').toString().split(/\s+/).filter(Boolean)[0] || '');
        const p = el2.parentElement;
        if ((!firstCls || !isStableClassName(firstCls)) && p && p !== document.body && p.tagName !== 'BODY') {
          el2 = p;
        }
      }
      return el2;
    }
    /** 用坐标取最上层「非自属」元素，避免点到遮罩/提示条 */
    function pickFromPoint(x, y) {
      let els;
      try {
        els = document.elementsFromPoint(x, y);
      } catch {
        return null;
      }
      for (const el2 of els || []) {
        if (isOwn(el2)) continue;
        return resolveTarget(el2);
      }
      return null;
    }

    function placeBox(box, el2) {
      if (!el2 || !el2.getBoundingClientRect) return false;
      const r = el2.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) return false;
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
      box.style.left = Math.round(Math.max(0, r.left)) + 'px';
      box.style.top = Math.round(Math.max(0, r.top)) + 'px';
      box.style.width = Math.round(r.width) + 'px';
      box.style.height = Math.round(r.height) + 'px';
      return true;
    }
    function paint(el2) {
      highlight.classList.toggle('hidden', !placeBox(highlight, el2));
    }

    /** R4：高亮页面上该选择器的全部命中（最多 MAX_HITS 个，只画可视区内的） */
    function showMatches(sel) {
      activeSel = sel || '';
      let list = [];
      if (activeSel) {
        try {
          list = Array.prototype.slice.call(document.body.querySelectorAll(activeSel), 0, MAX_HITS);
        } catch {
          list = [];
        }
      }
      let used = 0;
      for (const node of list) {
        if (isOwn(node)) continue;
        let box = hits.children[used];
        if (!box) box = hits.appendChild(el('div', { class: 'pv-picker-hit' }));
        if (placeBox(box, node)) used++;
      }
      while (hits.children.length > used) hits.lastChild.remove();
    }

    function onRepaint() {
      if (phase === 'hover' && hoverEl) paint(hoverEl);
      else if (phase === 'confirm') showMatches(activeSel);
    }

    function onMove(e) {
      if (phase !== 'hover') return;
      const el2 = pickFromPoint(e.clientX, e.clientY);
      if (el2 === hoverEl) return;
      hoverEl = el2;
      paint(el2);
      if (el2 && !coarse) {
        const tag = el2.tagName.toLowerCase();
        const cls = Array.prototype.slice.call(el2.classList || []).filter(isStableClassName).slice(0, 2).join('.');
        hintText.textContent = '点选链接：' + tag + (cls ? '.' + cls : '') + (el2.id ? '#' + el2.id : '') + ' · 单击选定 · Esc 取消';
      } else {
        hintText.textContent = IDLE_HINT;
      }
    }

    function finishPick(el2) {
      if (!el2) return;
      cands = buildSelectorCandidates(el2);
      if (!cands.length) return;
      phase = 'confirm';
      highlight.classList.add('hidden');
      hint.classList.add('hidden');
      showConfirm();
    }

    function selectCand(i) {
      const c = cands[i];
      if (!c) return;
      Array.prototype.forEach.call(cCands.children, (b, j) => {
        b.classList.toggle('is-on', j === i);
        b.setAttribute('aria-checked', j === i ? 'true' : 'false');
      });
      cInput.value = c.sel;
      updateMeta(c.sel);
    }

    function showConfirm() {
      cCands.textContent = '';
      cands.forEach((c, i) => {
        const btn = el(
          'button',
          {
            type: 'button',
            class: 'pv-picker-cand' + (c.kind === 'block' ? ' is-block' : ''),
            role: 'radio',
            title: (c.desc || c.sel) + (c.note ? ' · ' + c.note : '') + '\n' + c.sel,
            'aria-label': (c.desc || c.sel) + '，选择器 ' + c.sel
          },
          // 可见文本只放实际选择器；中文解释（只拦截这类链接/整行任意位置等）
          // 放进 title 提示，避免候选框被中文说明撑高。
          el('code', { class: 'pv-picker-cand-sel', text: c.sel }),
          el('em', { text: '本页 ' + c.count + ' 个' })
        );
        btn.addEventListener('click', () => selectCand(i));
        cCands.appendChild(btn);
      });
      confirm.classList.remove('hidden');
      selectCand(0);
      okBtn.focus();
    }

    function updateMeta(sel) {
      let n = 0;
      try {
        n = document.body.querySelectorAll(sel).length;
      } catch {
        cMeta.textContent = '选择器无效';
        showMatches('');
        return;
      }
      cMeta.textContent = '本页匹配 ' + n + ' 个' + (n ? '（已在页面上框出' + (n > MAX_HITS ? '前 ' + MAX_HITS + ' 个' : '') + '）' : '');
      showMatches(sel);
    }

    function onClick(e) {
      if (inOwnUi(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (phase !== 'hover') return;
      if (e.button != null && e.button !== 0) return;
      const el2 = pickFromPoint(e.clientX, e.clientY) || hoverEl;
      finishPick(el2);
    }

    function onTouchStart(e) {
      const t = e.touches && e.touches[0];
      touchStart = t ? { x: t.clientX, y: t.clientY } : null;
    }

    function onTouchEnd(e) {
      if (phase !== 'hover') return;
      if (inOwnUi(e)) return;
      const t = e.changedTouches && e.changedTouches[0];
      // R3：滑动（位移 > TAP_SLOP）是在滚动页面，不算点选
      if (t && touchStart && Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > TAP_SLOP) {
        touchStart = null;
        return;
      }
      touchStart = null;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      let el2 = null;
      try {
        if (t) el2 = pickFromPoint(t.clientX, t.clientY);
      } catch {}
      if (el2) {
        hoverEl = el2;
        paint(el2);
      }
      finishPick(el2 || hoverEl);
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        // 点选模式优先级最高：仅取消点选，不让弹窗面板的 Esc 同时关闭弹窗
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        finish(null);
      }
    }

    const submit = () => {
      const v = cInput.value.trim();
      finish(v || null);
    };
    okBtn.addEventListener('click', submit);
    againBtn.addEventListener('click', () => {
      phase = 'hover';
      showMatches('');
      confirm.classList.add('hidden');
      hint.classList.remove('hidden');
      hintText.textContent = IDLE_HINT;
    });
    cancelBtn.addEventListener('click', () => finish(null));
    hintCancel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      finish(null);
    });
    cInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
    cInput.addEventListener('input', () => {
      const v = cInput.value.trim();
      Array.prototype.forEach.call(cCands.children, (b, j) => b.classList.toggle('is-on', !!cands[j] && cands[j].sel === v));
      if (v) updateMeta(v);
    });

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseover', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchend', onTouchEnd, true);
    window.addEventListener('scroll', onRepaint, true);
    window.addEventListener('resize', onRepaint, true);
    // capture 阶段注册，确保先于弹窗面板的 keydown 处理 Esc
    document.addEventListener('keydown', onKey, true);
  });
}
