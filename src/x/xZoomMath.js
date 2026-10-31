// 灯箱缩放/平移的纯数学：不碰 DOM，便于单测（node tests/xZoomMath.test.mjs）。
// 坐标约定：平移量 (tx, ty) 相对「内容居中」位置；锚点 (dx, dy) 相对视口中心。
// 百分比约定：缩放百分比以「原图」为 100%——适配显示只是原图的一个缩小比例，
// 放大到 100% 即原图 1:1 像素，再往上只会插值变糊，因此上限就是原图本身。

export const MIN_SCALE = 1;
/** 尺寸未知时的兜底上限；正常情况上限 = 原图 1:1（见 maxScaleFor），不存在全局 4x。 */
export const MAX_SCALE = 4;

/** 缩放钳在 [1, 上限]；上限由调用方按原图像素算出（maxScaleFor），无默认 4x。 */
export function clampScale(scale, max = Infinity) {
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

/**
 * 缩放上限 = 原图 1:1 像素：baseW 是图片适配显示时的布局宽度，naturalW 是实际加载的像素宽。
 * 适配只会缩小图片，所以该值 ≥ 1；再往上放大就是浏览器插值，必然变糊。
 * 尺寸未知（图片还没解码）时退回 MAX_SCALE 兜底，onImgLoad 后会按真实像素收回。
 */
export function maxScaleFor(naturalW, baseW) {
  if (!(baseW > 0) || !(naturalW > 0)) return MAX_SCALE;
  return Math.max(MIN_SCALE, naturalW / baseW);
}

/**
 * 适配显示相对原图的百分比：显示宽 / 原图宽 × 100（≤100，因为图片只会被缩小适配）。
 * 这是缩放条的起点：灯箱打开时显示的就是它，例如 3072px 原图适配到 700px 显示为 23%。
 */
export function fitPercent(naturalW, baseW) {
  if (!(baseW > 0) || !(naturalW > 0)) return 100;
  return Math.min(100, (baseW / naturalW) * 100);
}

/**
 * 缩放条 0–1 比例 → 内部缩放值（1 = 适配显示）。
 * 滑杆对「原图百分比」线性：0 = 适配（fitPct%），1 = 原图 100%，
 * 中间任意刻度的显示百分比 = fitPct + ratio × (100 − fitPct)。
 */
export function sliderRatioToScale(ratio, fitPct) {
  const start = Math.min(100, Math.max(1, Number.isFinite(fitPct) ? fitPct : 100));
  const r = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  return (start + r * (100 - start)) / start;
}

/** 内部缩放值 → 缩放条 0–1 比例（sliderRatioToScale 的逆映射）。 */
export function sliderScaleToRatio(scale, fitPct) {
  const start = Math.min(100, Math.max(1, Number.isFinite(fitPct) ? fitPct : 100));
  const s = Number.isFinite(scale) ? scale : MIN_SCALE;
  if (start >= 100) return 0;
  return Math.min(1, Math.max(0, ((s - 1) * start) / (100 - start)));
}
