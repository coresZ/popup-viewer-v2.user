/**
 * 弹窗面板通用交互行为（主面板 PopupPanel 与 KitPopupPanel 共用）：
 * 拖拽 / 视口约束 / 滚动链兜底。抽离后避免两套面板逻辑漂移。
 */
import { svgIcon, eventTarget, closestInPath } from './dom.js';

/**
 * 把弹窗约束回视口内（DevTools 占位 / 窗口缩放后调用）。
 */
export function clampToViewport(panel, { isFullScreen = false, pad = 8 } = {}) {
  if (!panel || isFullScreen) return;
  const rect = panel.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.left;
  let top = rect.top;
  if (rect.width > vw - pad * 2) {
    left = pad;
  } else {
    if (left < pad) left = pad;
    else if (left + rect.width > vw - pad) left = vw - pad - rect.width;
  }
  if (rect.height > vh - pad * 2) {
    top = pad;
  } else {
    if (top < pad) top = pad;
    else if (top + rect.height > vh - pad) top = vh - pad - rect.height;
  }
  if (left !== rect.left || top !== rect.top) {
    panel.style.transition = 'none';
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.transform = 'none';
    void panel.offsetWidth;
    panel.style.transition = '';
  }
}

// Pointer Events 鼠标/触屏/笔通用；极老浏览器回退 mouse 事件
const POINTER_EVENTS = typeof PointerEvent !== 'undefined';

/**
 * 头部拖拽。释放时回调 onDragEnd（各自面板做位置记忆/标记）。
 * move 用 rAF 合并避免高频重排；拖拽中给 body 抓取光标 + 面板阴影反馈。
 */
export function setupDrag({ header, panel, isFullScreen = () => false, locked = () => false, onDragEnd }) {
  const DOWN = POINTER_EVENTS ? 'pointerdown' : 'mousedown';
  const MOVE = POINTER_EVENTS ? 'pointermove' : 'mousemove';
  const UP = POINTER_EVENTS ? 'pointerup' : 'mouseup';
  let dragging = false;
  let dragLocked = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let lastX = 0;
  let lastY = 0;
  let raf = null;
  // 按下后移动超过阈值才算拖拽：单击标题栏不再把居中定位改成绝对坐标，标题文字也能选中（v2.3.0）
  const THRESHOLD = 4;
  let pending = false;
  const applyMove = () => {
    raf = null;
    if (!dragging || dragLocked) return; // 锁定：不跟手移动
    // 取整：非整数位移会让 Chrome 关闭次像素抗锯齿，文字变细
    panel.style.left = `${Math.round(startLeft + (lastX - startX))}px`;
    panel.style.top = `${Math.round(startTop + (lastY - startY))}px`;
  };
  const beginDrag = () => {
    pending = false;
    dragging = true;
    if (dragLocked) return;
    const rect = panel.getBoundingClientRect();
    startLeft = Math.round(rect.left);
    startTop = Math.round(rect.top);
    panel.style.transition = 'none';
    panel.style.left = `${startLeft}px`;
    panel.style.top = `${startTop}px`;
    panel.style.transform = 'none';
    panel.classList.add('pv-dragging');
    document.body.style.cursor = 'grabbing';
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  };
  const finish = (commit) => {
    if (pending) {
      pending = false;
      if (POINTER_EVENTS && pointerId != null) {
        try {
          header.releasePointerCapture(pointerId);
        } catch {}
        pointerId = null;
      }
      return;
    }
    if (!dragging) return;
    const info = { locked: dragLocked };
    dragging = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    panel.classList.remove('pv-dragging');
    document.body.style.cursor = '';
    panel.style.transition = '';
    if (POINTER_EVENTS && pointerId != null) {
      try {
        header.releasePointerCapture(pointerId);
      } catch {}
      pointerId = null;
    }
    if (commit) onDragEnd?.(info);
  };
  header.addEventListener(DOWN, (e) => {
    if (closestInPath(e, 'button, a, input')) return;
    if (isFullScreen()) return;
    if (e.button !== 0) return;
    pending = true;
    dragging = false;
    dragLocked = locked();
    startX = e.clientX;
    startY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (POINTER_EVENTS) {
      pointerId = e.pointerId;
      try {
        header.setPointerCapture(e.pointerId);
      } catch {}
    }
    // 触屏：阻止默认以免页面跟着滚动（header 已 touch-action:none）；鼠标不阻止，保留文字选择
    if (e.pointerType && e.pointerType !== 'mouse') e.preventDefault();
  });
  const move = (e) => {
    if (pending) {
      if (Math.abs(e.clientX - startX) < THRESHOLD && Math.abs(e.clientY - startY) < THRESHOLD) return;
      beginDrag();
    }
    if (!dragging) return;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!raf) raf = requestAnimationFrame(applyMove);
  };
  document.addEventListener(MOVE, move);
  document.addEventListener(UP, () => finish(true));
  if (POINTER_EVENTS) document.addEventListener('pointercancel', () => finish(false));
}

const RESIZE_CURSOR = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize'
};

/**
 * 8 向边缘/角落拖拽缩放（Pointer Events，鼠标/触屏通用）。释放时回调 onResizeEnd(rect)。
 * 从左边/上边缩放时同步调整 left/top，保证对边锚定不动。
 */
export function setupResize({ panel, isFullScreen = () => false, locked = () => false, minWidth = 260, minHeight = 200, onResizeEnd }) {
  const DOWN = POINTER_EVENTS ? 'pointerdown' : 'mousedown';
  const MOVE = POINTER_EVENTS ? 'pointermove' : 'mousemove';
  const UP = POINTER_EVENTS ? 'pointerup' : 'mouseup';
  const dirs = Object.keys(RESIZE_CURSOR);
  let state = null;

  const onDown = (dir, handle) => (e) => {
    if (e.button !== 0) return;
    if (isFullScreen()) return;
    if (locked()) return; // 锁定：禁止缩放
    e.preventDefault();
    e.stopPropagation();
    const rect = panel.getBoundingClientRect();
    // 把居中 transform 物化为 left/top 像素位置；尺寸走 --popup-* CSS 变量，
    // 不写内联 width/height，保证之后切换大小预设（也改同一变量）立即生效
    panel.style.transition = 'none';
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.transform = 'none';
    panel.style.setProperty('--popup-width', `${rect.width}px`);
    panel.style.setProperty('--popup-height', `${rect.height}px`);
    state = { dir, startX: e.clientX, startY: e.clientY, rect, handle, pointerId: POINTER_EVENTS ? e.pointerId : null };
    panel.classList.add('pv-resizing');
    document.body.style.cursor = RESIZE_CURSOR[dir];
    if (POINTER_EVENTS) {
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {}
    }
    document.addEventListener(MOVE, onMove);
    document.addEventListener(UP, onUp);
    if (POINTER_EVENTS) document.addEventListener('pointercancel', onCancel);
  };

  const onMove = (e) => {
    if (!state) return;
    const { dir, startX, startY, rect } = state;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let { left, top } = rect;
    let width = rect.width;
    let height = rect.height;
    const maxW = window.innerWidth - 16;
    const maxH = window.innerHeight - 16;

    if (dir.includes('e')) width = rect.width + dx;
    if (dir.includes('s')) height = rect.height + dy;
    if (dir.includes('w')) {
      width = rect.width - dx;
      left = rect.left + dx;
    }
    if (dir.includes('n')) {
      height = rect.height - dy;
      top = rect.top + dy;
    }
    // 上下限约束；从 w/n 边缩放时反向补偿 left/top 保证对边锚定
    if (width < minWidth) {
      if (dir.includes('w')) left = rect.left + (rect.width - minWidth);
      width = minWidth;
    }
    if (width > maxW) {
      if (dir.includes('w')) left = rect.left + (rect.width - maxW);
      width = maxW;
    }
    if (height < minHeight) {
      if (dir.includes('n')) top = rect.top + (rect.height - minHeight);
      height = minHeight;
    }
    if (height > maxH) {
      if (dir.includes('n')) top = rect.top + (rect.height - maxH);
      height = maxH;
    }
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.setProperty('--popup-width', `${width}px`);
    panel.style.setProperty('--popup-height', `${height}px`);
  };

  const finish = (commit) => {
    if (!state) return;
    const st = state;
    state = null;
    panel.classList.remove('pv-resizing');
    panel.style.transition = '';
    document.body.style.cursor = '';
    document.removeEventListener(MOVE, onMove);
    document.removeEventListener(UP, onUp);
    if (POINTER_EVENTS) document.removeEventListener('pointercancel', onCancel);
    if (POINTER_EVENTS && st.pointerId != null) {
      try {
        st.handle.releasePointerCapture(st.pointerId);
      } catch {}
    }
    if (commit) onResizeEnd?.(panel.getBoundingClientRect());
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);

  dirs.forEach((dir) => {
    const handle = document.createElement('div');
    handle.className = `pv-resize pv-resize-${dir}`;
    handle.addEventListener(DOWN, onDown(dir, handle));
    panel.appendChild(handle);
  });

  // 触屏大角把手：四角常驻可见的缩放抓手（桌面端 CSS 隐藏），复用同一套缩放逻辑
  const knobDirs = ['ne', 'nw', 'se', 'sw'];
  knobDirs.forEach((dir) => {
    const knob = document.createElement('div');
    knob.className = `pv-resize-knob pv-resize-knob-${dir}`;
    knob.appendChild(svgIcon('resize', { size: 18 }));
    knob.addEventListener(DOWN, onDown(dir, knob));
    panel.appendChild(knob);
  });
}

/**
 * 滚动链兜底：弹窗内容滚到底时不滚动外部页面
 * （overscroll-behavior: contain 之外的保险）。
 */
export function setupWheelScrollChain({ panel, contentArea, isFullScreen = () => false }) {
  // 从真实目标（穿透 shadow root）往上找：只要弹窗里还有元素能朝这个方向滚，就放行；
  // 都滚不动时才拦，防止滚到外部页面。此前只看内容区本身，X 阅读器两栏（内容区 overflow:hidden）
  // 里的每一次滚轮都会被拦下。
  const canScrollFrom = (node, stop, dy) => {
    for (let el = node; el && el.nodeType === 1; el = el.parentElement || el.getRootNode?.().host) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
      }
      if (el === stop) break;
    }
    return false;
  };
  document.addEventListener(
    'wheel',
    (e) => {
      if (!panel || !panel.classList.contains('visible')) return;
      const target = eventTarget(e);
      if (!target || !panel.contains(target)) return;
      // 灯箱里滚轮是「缩放」语义，且灯箱之上没有可滚动容器：直接放给自己的监听，
      // 否则兜底会在捕获阶段 preventDefault+stopPropagation，灯箱永远收不到。
      if (target.closest && target.closest('.pv-x-media-lightbox')) return;
      if (!e.deltaY) return;
      if (canScrollFrom(target, panel, e.deltaY)) return;
      if (!isFullScreen()) {
        const content = contentArea();
        if (!content || !content.contains(target)) return;
      }
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );
}
