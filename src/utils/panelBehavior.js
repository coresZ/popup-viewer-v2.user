/**
 * 弹窗面板通用交互行为（主面板 PopupPanel 与 KitPopupPanel 共用）：
 * 拖拽 / 视口约束 / 滚动链兜底。抽离后避免两套面板逻辑漂移。
 */
import { svgIcon } from './dom.js';

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
  const applyMove = () => {
    raf = null;
    if (!dragging || dragLocked) return; // 锁定：不跟手移动
    panel.style.left = `${startLeft + (lastX - startX)}px`;
    panel.style.top = `${startTop + (lastY - startY)}px`;
  };
  const finish = (commit) => {
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
    if (e.target.closest('button')) return;
    if (isFullScreen()) return;
    if (e.button !== 0) return;
    dragging = true;
    dragLocked = locked();
    const rect = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!dragLocked) {
      panel.style.transition = 'none';
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.transform = 'none';
      panel.classList.add('pv-dragging');
      document.body.style.cursor = 'grabbing';
    }
    if (POINTER_EVENTS) {
      pointerId = e.pointerId;
      try {
        header.setPointerCapture(e.pointerId);
      } catch {}
    }
    e.preventDefault();
  });
  const move = (e) => {
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
  document.addEventListener(
    'wheel',
    (e) => {
      if (!panel || !panel.classList.contains('visible')) return;
      if (isFullScreen()) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        const content = contentArea();
        if (content && content.contains(e.target)) {
          const { scrollTop, scrollHeight, clientHeight } = content;
          const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
          const canScroll = scrollHeight > clientHeight;
          if (!canScroll || atBottom) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    },
    true
  );
}
