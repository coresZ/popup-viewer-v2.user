// 灯箱缩放/平移数学回归测试：node tests/xZoomMath.test.mjs
import assert from 'node:assert/strict';
import {
  MIN_SCALE,
  MAX_SCALE,
  clampScale,
  zoomTowards,
  clampTranslate,
  maxScaleFor,
  ratioToScale,
  scaleToRatio
} from '../src/x/xZoomMath.js';

// ---- clampScale ----
assert.equal(clampScale(0.5), 1, '低于 1 声吸到 1');
assert.equal(clampScale(9), 4, '超过上限落到 4');
assert.equal(clampScale(2.5), 2.5);
assert.equal(clampScale(Number.NaN), 1, 'NaN 回落到最小');
assert.equal(clampScale(3, 2), 2, '更小的动态上限生效');

// ---- zoomTowards：锚点下的内容保持不动 ----
{
  // 锚点在内容中心右侧 100px，内容偏移 20px，放大 2 倍
  const out = zoomTowards({ scale: 1, tx: 20, ty: -10, nextScale: 2, dx: 100, dy: 40 });
  assert.equal(out.scale, 2);
  // 锚点对应内容坐标：(100 - 20) / 1 = 80 → 新平移应使 80 * 2 + tx' = 100
  assert.equal(out.tx, 100 - 80 * 2);
  assert.equal(out.tx, -60);
  assert.equal(out.ty, 40 - ((40 - -10) / 1) * 2);
  assert.equal(out.ty, -60);
}
{
  // 从 2x 缩回 1x：锚点下内容仍不动
  const out = zoomTowards({ scale: 2, tx: -60, ty: -60, nextScale: 1, dx: 100, dy: 40 });
  assert.equal(out.scale, 1);
  assert.equal(out.tx, 20);
  assert.equal(out.ty, -10);
}
{
  // 已到上限时不再放大
  const out = zoomTowards({ scale: 4, tx: 0, ty: 0, nextScale: 9, dx: 50, dy: 0 });
  assert.equal(out.scale, MAX_SCALE);
  assert.equal(out.tx, 50 - 50 * 1);
}

// ---- clampTranslate ----
{
  const frame = { frameW: 300, frameH: 200, contentW: 300, contentH: 200, scale: 1 };
  assert.deepEqual(clampTranslate(80, 80, frame), { x: 0, y: 0 }, '100% 时居中，不可平移');
}
{
  const frame = { frameW: 300, frameH: 200, contentW: 300, contentH: 100, scale: 2 };
  // 横向可拖 ±150，纵向内容 200 = 视口 200，锁 0
  assert.deepEqual(clampTranslate(999, 999, frame), { x: 150, y: 0 });
  assert.deepEqual(clampTranslate(-999, -999, frame), { x: -150, y: 0 });
}
{
  const frame = { frameW: 300, frameH: 200, contentW: 100, contentH: 100, scale: 1 };
  assert.deepEqual(clampTranslate(50, -50, frame), { x: 0, y: 0 }, '内容小于视口时两轴都居中');
}
{
  const frame = { frameW: 0, frameH: 0, contentW: 100, contentH: 100, scale: 1 };
  assert.deepEqual(clampTranslate(10, 10, frame), { x: 10, y: 10 }, '视口未测量时不把图吸到 0');
  assert.deepEqual(clampTranslate(999, 999, frame), { x: 50, y: 50 }, '未测量的视口仍按内容半宽限制');
}

// ---- maxScaleFor ----
assert.equal(maxScaleFor(0, 0), MAX_SCALE, '尺寸未知时给满上限');
assert.equal(maxScaleFor(4000, 400), 4, '大图封顶 4');
assert.equal(maxScaleFor(600, 300), 4, '刚好 2 倍原图像素 → 4x');
assert.ok(Math.abs(maxScaleFor(400, 300) - 2.6667) < 1e-3, '小图按原图像素 2 倍封顶');
assert.equal(maxScaleFor(150, 300), 2, '极小图至少允许 2x');

// ---- 滑杆比例 ----
assert.equal(ratioToScale(0), MIN_SCALE);
assert.equal(ratioToScale(1), MAX_SCALE);
assert.equal(ratioToScale(0.5), 2.5);
assert.equal(ratioToScale(-1), MIN_SCALE, '越界比例夹住');
assert.equal(ratioToScale(9), MAX_SCALE);
assert.equal(scaleToRatio(1), 0);
assert.equal(scaleToRatio(4), 1);
assert.equal(scaleToRatio(0.5), 0, '低于最小按最小算');
assert.equal(scaleToRatio(9), 1, '高于上限按上限算');
assert.equal(scaleToRatio(2.5), 0.5);
assert.ok(Math.abs(scaleToRatio(ratioToScale(0.37)) - 0.37) < 1e-9, '比例往返一致');

// ---- 每张图的上限：滑杆轨道按 cap 映射，最右端一定正好等于 cap ----
assert.equal(ratioToScale(1, 2.07), 2.07, '按上限映射到最右');
assert.equal(ratioToScale(0.5, 3), 2, '上限参与线性映射');
assert.equal(ratioToScale(1, 0.5), 1, '上限低于 1 时按 1 处理');
assert.equal(ratioToScale(0.5, 1), 1, '上限等于 1 时任意位置都是 1');
assert.equal(scaleToRatio(2.07, 2.07), 1, '到上限时滑块在最右');
assert.equal(scaleToRatio(1.535, 2.07), 0.5);
assert.equal(scaleToRatio(4, 2.07), 1, '超过上限仍贴最右');
assert.equal(scaleToRatio(1, 1), 0);

console.log('xZoomMath.test.mjs: all assertions passed');
