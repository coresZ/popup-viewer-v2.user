// 灯箱缩放/平移数学回归测试：node tests/xZoomMath.test.mjs
// 百分比约定：以「原图」为 100%；适配显示只是原图的 fitPercent%，放大到 100% 即原图 1:1。
import assert from 'node:assert/strict';
import {
  MIN_SCALE,
  MAX_SCALE,
  clampScale,
  zoomTowards,
  clampTranslate,
  maxScaleFor,
  fitPercent,
  sliderRatioToScale,
  sliderScaleToRatio
} from '../src/x/xZoomMath.js';

// ---- clampScale ----
assert.equal(clampScale(0.5), 1, '低于 1 钳到 1');
assert.equal(clampScale(9), 9, '没有全局 4x：上限由调用方按原图给出');
assert.equal(clampScale(2.5), 2.5);
assert.equal(clampScale(Number.NaN), 1, 'NaN 回落到最小');
assert.equal(clampScale(9, 4), 4, '显式上限仍然生效');
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
  // 超过 4x 的 1:1 目标不再被全局上限截断（大图适配后需要大倍率才能到原图）
  const out = zoomTowards({ scale: 4, tx: 0, ty: 0, nextScale: 9, dx: 50, dy: 0 });
  assert.equal(out.scale, 9);
  // 锚点内容点 (50 - 0) / 4 = 12.5 → 新 tx = 50 - 12.5 * 9
  assert.equal(out.tx, 50 - (50 / 4) * 9);
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

// ---- maxScaleFor：上限 = 原图 1:1，没有 4x 抽象上限 ----
assert.equal(maxScaleFor(0, 0), MAX_SCALE, '尺寸未知时退回兜底上限');
assert.equal(maxScaleFor(4000, 400), 10, '大图的 1:1 倍率可以超过 4');
assert.equal(maxScaleFor(600, 300), 2, '显示宽是原图一半时，放到 1:1 即 2x');
assert.ok(Math.abs(maxScaleFor(400, 300) - 4 / 3) < 1e-3, '按原图 1:1 像素封顶');
assert.equal(maxScaleFor(150, 300), 1, '显示已大于原图时不再放大');
assert.ok(Math.abs(maxScaleFor(750, 334) - 750 / 334) < 1e-3, '长截图按 1:1 精确封顶');
assert.ok(Math.abs(maxScaleFor(3072, 700) - 3072 / 700) < 1e-9, '原图 3072 适配到 700 → 约 4.39x 到达 1:1');

// ---- fitPercent：适配显示相对原图的百分比（缩放条起点） ----
assert.ok(Math.abs(fitPercent(3072, 700) - (700 / 3072) * 100) < 1e-9, '3072 原图适配到 700 ≈ 22.8%');
assert.equal(fitPercent(700, 700), 100, '原图正好填满显示时就是 100%');
assert.equal(fitPercent(400, 700), 100, '原图小于显示框时不会被放大超过 100%');
assert.equal(fitPercent(0, 700), 100, '尺寸未知时退回 100%');
assert.equal(fitPercent(3072, 0), 100, '显示宽未知时退回 100%');

// ---- 滑杆：对「原图百分比」线性，0 = 适配，1 = 原图 100% ----
assert.equal(sliderRatioToScale(0, 23), 1, '左端 = 适配显示');
assert.ok(Math.abs(sliderRatioToScale(1, 23) - 100 / 23) < 1e-9, '右端 = 原图 1:1');
assert.ok(Math.abs(sliderRatioToScale(0.5, 23) - (23 + 38.5) / 23) < 1e-9, '中点的显示百分比 = (23+100)/2');
assert.equal(sliderRatioToScale(-1, 23), 1, '越界比例夹住');
assert.equal(sliderRatioToScale(9, 23), 100 / 23, '越界比例夹住');
assert.equal(sliderRatioToScale(0.5, 100), 1, '已原图显示时任意位置都是 1');

assert.equal(sliderScaleToRatio(1, 23), 0, '适配显示在左端');
assert.equal(sliderScaleToRatio(100 / 23, 23), 1, '原图 1:1 在最右');
assert.ok(Math.abs(sliderScaleToRatio(2.5, 23) - ((2.5 - 1) * 23) / 77) < 1e-9, '线性逆映射');
assert.equal(sliderScaleToRatio(0.5, 23), 0, '低于适配按左端算');
assert.equal(sliderScaleToRatio(99, 23), 1, '超过原图仍贴最右');
assert.equal(sliderScaleToRatio(1, 100), 0, '已原图显示时恒在左端');

// 滑杆任意位置的显示百分比 = fitPct + ratio × (100 − fitPct)，且与逆映射往返一致
{
  const fitPct = 22.8;
  for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
    const scale = sliderRatioToScale(ratio, fitPct);
    const percent = scale * fitPct;
    assert.ok(
      Math.abs(percent - (fitPct + ratio * (100 - fitPct))) < 1e-9,
      `ratio=${ratio} 显示百分比线性`
    );
    assert.ok(Math.abs(sliderScaleToRatio(scale, fitPct) - ratio) < 1e-9, `ratio=${ratio} 往返一致`);
  }
}

console.log('xZoomMath.test.mjs: all assertions passed');
