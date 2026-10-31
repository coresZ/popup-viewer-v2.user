// 灯箱缩放/平移的纯数学：不碰 DOM，便于单测（node tests/xZoomMath.test.mjs）。
// 坐标约定：平移量 (tx, ty) 相对「内容居中」位置；锚点 (dx, dy) 相对视口中心。

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;

/** 缩放钳在 [1, 上限]；上限默认 4x，可传按原图像素算出的更小值。 */
export function clampScale(scale, max = MAX_SCALE) {
  return Math.min(max, Math.max(MIN_SCALE, Number.isFinite(scale) ? scale : MIN_SCALE));
}

/**
 * 以锚点为原点从 scale 缩到 nextScale：锚点下的内容点在缩放前后保持同一相对位置。
 * 返回的平移量还需要再做一次 clampTranslate。
 */
export function zoomTowards({ scale, tx, ty, nextScale, dx, dy }) {
  const from = scale > 0 ? scale : MIN_SCALE;
  const to = clampScale(nextScale);
  const k = to / from;
  return { scale: to, tx: dx - (dx - tx) * k, ty: dy - (dy - ty) * k };
}

/**
 * 平移钳制：内容（缩放后）小于视口时该轴居中；大于视口时不允许把图拖出留白。
 * 内容框取图片 100% 时的实际渲染框，不是窗体框。
 */
export function clampTranslate(tx, ty, { contentW, contentH, frameW, frameH, scale }) {
  const scaledW = Math.max(0, contentW) * scale;
  const scaledH = Math.max(0, contentH) * scale;
  const limitX = Math.max(0, (scaledW - Math.max(0, frameW)) / 2);
  const limitY = Math.max(0, (scaledH - Math.max(0, frameH)) / 2);
  const axis = (value, limit) => Math.min(limit, Math.max(-limit, Number.isFinite(value) ? value : 0)) + 0;
  return { x: axis(tx, limitX), y: axis(ty, limitY) };
}

/** 放大上限：最多 4x，且不把图放大到原图像素的两倍以上（小图不至于糊成马赛克）。 */
export function maxScaleFor(naturalW, baseW) {
  if (!(baseW > 0) || !(naturalW > 0)) return MAX_SCALE;
  return Math.min(MAX_SCALE, Math.max(2, (naturalW / baseW) * 2));
}

/** 滑杆 0–1 比例 ↔ 缩放值（上限会按每张图的像素上限动态收窄，滑杆轨道不设死区）。 */
export function ratioToScale(ratio, cap = MAX_SCALE) {
  const max = Math.max(MIN_SCALE, cap);
  const r = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  return MIN_SCALE + r * (max - MIN_SCALE);
}

export function scaleToRatio(scale, cap = MAX_SCALE) {
  const max = Math.max(MIN_SCALE, cap);
  if (max <= MIN_SCALE) return 0;
  return (clampScale(scale, max) - MIN_SCALE) / (max - MIN_SCALE);
}
