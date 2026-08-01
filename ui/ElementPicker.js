import { el } from '../utils/dom.js';
import { buildSelectorCandidates, isStableClassName } from '../utils/selector.js';

/**
 * 取选模式：可选中任意元素（参考 jav.js 的点选交互）。
 * 悬停高亮 + 提示标签 → 单击生成多个候选选择器 →
 * 候选按钮/可编辑输入/实时匹配数 → 确认。
 * @returns {Promise<string|null>} 选择器；取消返回 null
 */
export function pickElement() {
  return new Promise((resolve) => {
    let done = false;
    let phase = 'hover';
    let hoverEl = null;
    let cands = [];

    const overlay = el('div', { class: 'pv-picker-overlay' });
    const hint = el('div', { class: 'pv-picker-bar', id: 'pv-picker-hint' });
    const highlight = el('div', { class: 'pv-picker-highlight hidden' });

    // 确认面板
    const cTitle = el('div', { class: 'pv-picker-c-title', text: '确认选择器' });
    const cCands = el('div', { class: 'pv-picker-cands' });
    const cInput = el('input', { type: 'text', class: 'pv-picker-input', placeholder: '可手动改写选择器' });
    const cMeta = el('div', { class: 'pv-picker-c-meta' });
    const okBtn = el('button', { type: 'button', class: 'pv-picker-btn primary', text: '确认' });
    const againBtn = el('button', { type: 'button', class: 'pv-picker-btn', text: '重新选' });
    const cancelBtn = el('button', { type: 'button', class: 'pv-picker-btn', text: '取消' });
    const cBtns = el('div', { class: 'pv-picker-c-btns' }, againBtn, cancelBtn, okBtn);
    const confirm = el('div', { class: 'pv-picker-confirm hidden' }, cTitle, cCands, cInput, cMeta, cBtns);

    document.body.appendChild(overlay);
    document.body.appendChild(hint);
    document.body.appendChild(confirm);
    document.body.appendChild(highlight);

    // 内联 pointer-events（同 jav.js）：遮罩/提示条永不接收事件，避免被站点 CSS 覆盖
    overlay.style.pointerEvents = 'none';
    hint.style.pointerEvents = 'none';
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
      document.removeEventListener('touchend', onTouchEnd, true);
      window.removeEventListener('scroll', onRepaint, true);
      window.removeEventListener('resize', onRepaint, true);
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      hint.remove();
      confirm.remove();
      highlight.remove();
    }

    function isOwn(el2) {
      return (
        !!el2 &&
        !!el2.closest &&
        el2.closest(
          '.pv-picker-overlay, .pv-picker-confirm, .pv-picker-bar, .pv-picker-highlight, ' +
            '[id^="popup-"], [id^="pv-"]'
        )
      );
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

    function paint(el2) {
      const box = highlight;
      if (!el2 || !el2.getBoundingClientRect) {
        box.classList.add('hidden');
        return;
      }
      const r = el2.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) {
        box.classList.add('hidden');
        return;
      }
      box.style.left = Math.max(0, r.left) + 'px';
      box.style.top = Math.max(0, r.top) + 'px';
      box.style.width = r.width + 'px';
      box.style.height = r.height + 'px';
      box.classList.remove('hidden');
    }

    function onRepaint() {
      if (phase === 'hover' && hoverEl) paint(hoverEl);
    }

    function onMove(e) {
      if (phase !== 'hover') return;
      const el2 = pickFromPoint(e.clientX, e.clientY);
      if (el2 === hoverEl) return;
      hoverEl = el2;
      paint(el2);
      if (el2) {
        const tag = el2.tagName.toLowerCase();
        const cls = Array.prototype.slice.call(el2.classList || []).filter(isStableClassName).slice(0, 2).join('.');
        hint.textContent = '取选：' + tag + (cls ? '.' + cls : '') + (el2.id ? '#' + el2.id : '') + ' · 单击选定 · Esc 取消';
      } else {
        hint.textContent = '取选：移动鼠标高亮，单击要拦截的链接 · Esc 取消';
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

    function showConfirm() {
      cCands.innerHTML = '';
      cands.forEach((c, i) => {
        const btn = el('button', { type: 'button', class: 'pv-picker-cand' + (i === 0 ? ' is-on' : ''), title: c.note || '' });
        btn.appendChild(el('code', { text: c.sel }));
        btn.appendChild(el('em', { text: c.count + ' 个' + (c.note ? ' · ' + c.note : '') }));
        btn.addEventListener('click', () => {
          cCands.querySelectorAll('.pv-picker-cand').forEach((b) => b.classList.remove('is-on'));
          btn.classList.add('is-on');
          cInput.value = c.sel;
          updateMeta(c.sel);
          try {
            const hit = document.body.querySelector(c.sel);
            if (hit) paint(hit);
          } catch {}
        });
        cCands.appendChild(btn);
      });
      cInput.value = cands[0].sel;
      updateMeta(cands[0].sel);
      confirm.classList.remove('hidden');
      cInput.focus();
      cInput.select();
    }

    function updateMeta(sel) {
      let n = 0;
      try {
        n = document.body.querySelectorAll(sel).length;
      } catch {}
      cMeta.textContent = '本页匹配 ' + n + ' 个元素';
    }

    function onClick(e) {
      if (e.target.closest('.pv-picker-confirm') || e.target.closest('.pv-picker-bar')) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (phase !== 'hover') return;
      if (e.button != null && e.button !== 0) return;
      const el2 = pickFromPoint(e.clientX, e.clientY) || hoverEl;
      finishPick(el2);
    }

    function onTouchEnd(e) {
      if (phase !== 'hover') return;
      if (e.target.closest('.pv-picker-confirm') || e.target.closest('.pv-picker-bar')) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      let el2 = null;
      try {
        const t = e.changedTouches && e.changedTouches[0];
        if (t) el2 = pickFromPoint(t.clientX, t.clientY);
      } catch {}
      el2 = el2 || hoverEl;
      finishPick(el2);
    }

    function onKey(e) {
      if (e.key === 'Escape') finish(null);
    }

    okBtn.addEventListener('click', () => {
      const v = cInput.value.trim();
      finish(v || null);
    });
    againBtn.addEventListener('click', () => {
      phase = 'hover';
      confirm.classList.add('hidden');
      hint.classList.remove('hidden');
    });
    cancelBtn.addEventListener('click', () => finish(null));
    cInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = cInput.value.trim();
        finish(v || null);
      }
    });
    cInput.addEventListener('input', () => {
      const v = cInput.value.trim();
      if (v) updateMeta(v);
    });

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseover', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('touchend', onTouchEnd, true);
    window.addEventListener('scroll', onRepaint, true);
    window.addEventListener('resize', onRepaint, true);
    document.addEventListener('keydown', onKey);

    hint.textContent = '取选：移动鼠标高亮，单击要拦截的链接 · Esc 取消';
  });
}
