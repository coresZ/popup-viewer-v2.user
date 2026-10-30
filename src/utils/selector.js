// 从用户点击的元素推导候选 CSS 选择器（供「取选链接」使用）
export function cssEscapeIdent(s) {
  const t = String(s || '');
  try {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(t);
  } catch {}
  return t.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

export function isStableClassName(c) {
  const s = String(c || '');
  if (!s || s.length < 2 || s.length > 48) return false;
  if (/^(pv-|popup)/i.test(s)) return false;
  if (/^(is-|has-|js-|ng-|v-|css-|sc-|sx-|emotion|svelte-|cssmodule)/i.test(s)) return false;
  if (/^(active|hover|focus|selected|current|open|show|hide|hidden|visible|disabled|checked|on|off)$/i.test(s)) return false;
  if (/^[a-f0-9]{8,}$/i.test(s)) return false;
  if (/\d{5,}/.test(s)) return false;
  return /^[a-zA-Z_:-][\w:-]*$/.test(s);
}

export function isStableId(id) {
  const s = String(id || '');
  if (!s || s.length > 64) return false;
  if (/^(ember|react|vue|ng|app|pv-|popup)-/i.test(s)) return false;
  if (/^[a-f0-9-]{12,}$/i.test(s)) return false;
  if (/\d{6,}/.test(s)) return false;
  return /^[a-zA-Z][\w:-]*$/.test(s);
}

function countMatches(sel) {
  try {
    return document.body ? document.body.querySelectorAll(sel).length : 0;
  } catch {
    return -1;
  }
}

/**
 * 生成若干候选选择器（含 id / class / 父级范围 / nth-child 路径），
 * 匹配数 2~200 的优先，返回最多 8 个。
 */
export function buildSelectorCandidates(el) {
  const list = [];
  const seen = Object.create(null);
  if (!el || el.nodeType !== 1 || !el.tagName) return list;

  const tag = el.tagName.toLowerCase();
  const id = el.id ? String(el.id) : '';
  const classes = Array.prototype.slice.call(el.classList || []).filter(isStableClassName).slice(0, 4);

  const push = (sel, note) => {
    const s = String(sel || '').trim();
    if (!s || seen[s]) return;
    const n = countMatches(s);
    if (n < 1) return;
    seen[s] = 1;
    list.push({ sel: s, count: n, note: note || '' });
  };

  if (id && isStableId(id)) push('#' + cssEscapeIdent(id), 'id');
  if (classes.length) {
    push('.' + classes.map(cssEscapeIdent).join('.'), 'class');
    push(tag + '.' + classes.map(cssEscapeIdent).join('.'), 'tag+class');
    if (classes[0]) {
      push('.' + cssEscapeIdent(classes[0]), '主 class');
      push(tag + '.' + cssEscapeIdent(classes[0]), 'tag+主 class');
    }
  } else if (tag && tag !== 'div' && tag !== 'span') {
    push(tag, '标签');
  }

  // 点在链接内部的子元素上：补充直接命中链接本身的候选（R1）
  const outerLink = el.parentElement && el.parentElement.closest ? el.parentElement.closest('a[href]') : null;
  if (outerLink && outerLink !== el) {
    const lc = Array.prototype.slice.call(outerLink.classList || []).filter(isStableClassName).slice(0, 2);
    if (outerLink.id && isStableId(outerLink.id)) push('#' + cssEscapeIdent(outerLink.id), '链接 id');
    if (lc.length) push('a.' + lc.map(cssEscapeIdent).join('.'), '链接 class');
    const lp = outerLink.parentElement;
    const lpc = lp ? Array.prototype.slice.call(lp.classList || []).filter(isStableClassName).slice(0, 2) : [];
    if (lpc.length) push(lp.tagName.toLowerCase() + '.' + lpc.map(cssEscapeIdent).join('.') + ' > a', '父级+链接');
  }

  // 父级 + 自身（适合卡片内标题/链接）
  let p = el.parentElement;
  let depth = 0;
  while (p && p !== document.body && depth < 4) {
    const pTag = p.tagName.toLowerCase();
    const pClasses = Array.prototype.slice.call(p.classList || []).filter(isStableClassName).slice(0, 2);
    if (pClasses.length) {
      const pSel = pTag + '.' + pClasses.map(cssEscapeIdent).join('.');
      if (classes[0]) {
        push(pSel + ' ' + tag + '.' + cssEscapeIdent(classes[0]), '父级范围');
        push(pSel + ' .' + cssEscapeIdent(classes[0]), '父级+class');
      }
      push(pSel + ' ' + tag, '父级+标签');
      if (depth === 0 && pClasses[0]) push('.' + cssEscapeIdent(pClasses[0]), '父 class（整块）');
    }
    p = p.parentElement;
    depth++;
  }

  // 短路径 nth-child（兜底）
  try {
    const parts = [];
    let node = el;
    let guard = 0;
    while (node && node.nodeType === 1 && node !== document.body && guard < 5) {
      if (node.id && isStableId(node.id)) {
        parts.unshift('#' + cssEscapeIdent(node.id));
        break;
      }
      const t = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (!parent) break;
      const kids = parent.children;
      let idx = 1;
      let same = 0;
      for (let i = 0; i < kids.length; i++) {
        if (kids[i].tagName === node.tagName) {
          same++;
          if (kids[i] === node) idx = same;
        }
      }
      parts.unshift(same > 1 ? t + ':nth-of-type(' + idx + ')' : t);
      node = parent;
      guard++;
    }
    if (parts.length) push(parts.join(' > '), '路径');
  } catch {}

  // R1：点到的是链接（或链接内部）时，标记哪些候选命中链接本身
  const link = el.closest ? el.closest('a[href]') : null;
  for (const c of list) {
    let selfMatch = false;
    try {
      selfMatch = !!link && link.matches(c.sel);
    } catch {}
    c.kind = c.note === '父 class（整块）' ? 'block' : selfMatch ? 'link' : 'other';
    if (c.kind === 'block') c.note = '整块（整行任意位置可点）';
    c.desc = describeCandidate(c);
  }
  return rankCandidates(dedupeSameMatches(list), { hasLink: !!link });
}

/**
 * 命中完全相同的一组元素的候选只留一个（选择器最短的）：
 * 否则确认框里会出现几条描述、数量都一样的选项，用户无从选择。
 */
function dedupeSameMatches(list) {
  const kept = [];
  const sorted = list.slice().sort((a, b) => a.sel.length - b.sel.length);
  for (const c of sorted) {
    if (c.count > 800) {
      kept.push(c);
      continue;
    }
    let nodes;
    try {
      nodes = new Set(document.body.querySelectorAll(c.sel));
    } catch {
      continue;
    }
    const dup = kept.some((k) => {
      if (k.count !== c.count || k.kind !== c.kind || !k._nodes) return false;
      for (const n of nodes) if (!k._nodes.has(n)) return false;
      return true;
    });
    if (dup) continue;
    c._nodes = nodes;
    kept.push(c);
  }
  for (const c of kept) delete c._nodes;
  return kept;
}

/** 候选的通俗描述（R4）：给普通用户看，原始选择器放到「高级」里。 */
export function describeCandidate(c) {
  if (c.kind === 'block') return '整行任意位置（点这一块都会打开）';
  if (c.count === 1) return '只拦截这一个链接';
  if (c.kind === 'link') return '只拦截这类链接';
  return '同一类元素';
}

/**
 * 候选排序（纯函数，便于单测）：
 * 1. 点到链接时，命中链接本身的候选在前；「整块」容器候选排最后但始终保留一项；
 * 2. 同类里按匹配数区间（2~200 最佳）再按选择器长度。
 */
export function rankCandidates(list, { hasLink = false, limit = 8 } = {}) {
  const countScore = (c) => {
    if (c.count >= 2 && c.count <= 200) return 0;
    if (c.count > 200 && c.count <= 800) return 1;
    if (c.count === 1) return 2;
    return 3;
  };
  const kindScore = (c) => {
    if (c.kind === 'block') return 2;
    if (hasLink) return c.kind === 'link' ? 0 : 1;
    return 0;
  };
  const sorted = list.slice().sort((a, b) => kindScore(a) - kindScore(b) || countScore(a) - countScore(b) || a.sel.length - b.sel.length);
  const block = sorted.filter((c) => c.kind === 'block').slice(0, 1);
  const rest = sorted.filter((c) => c.kind !== 'block').slice(0, Math.max(0, limit - block.length));
  return rest.concat(block);
}

/** 取最优候选（单值场景用） */
export function deriveSelector(el) {
  const cands = buildSelectorCandidates(el);
  return cands.length ? cands[0].sel : 'a[href]';
}
