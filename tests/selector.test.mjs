// 选择器候选排序回归测试（纯逻辑，无需 DOM）：node tests/selector.test.mjs
import assert from 'node:assert/strict';
import { rankCandidates, describeCandidate, isStableClassName } from '../src/utils/selector.js';

const c = (sel, count, kind) => ({ sel, count, kind, note: '' });

// R1：点到链接时，命中链接本身的候选排在容器候选前面，即使容器选择器更短
{
  const list = [c('.main', 12, 'other'), c('.row', 12, 'block'), c('a.thread-title', 12, 'link'), c('.main a', 30, 'other')];
  const out = rankCandidates(list, { hasLink: true });
  assert.equal(out[0].sel, 'a.thread-title');
  assert.equal(out[out.length - 1].kind, 'block', '整块候选排最后');
}

// 整块候选在截断后仍保留一项
{
  const list = [];
  for (let i = 0; i < 12; i++) list.push(c('a.l' + i, 5, 'link'));
  list.push(c('.row', 5, 'block'));
  const out = rankCandidates(list, { hasLink: true, limit: 8 });
  assert.equal(out.length, 8);
  assert.equal(out[7].kind, 'block');
}

// 没点到链接时按匹配数区间 + 长度排序（2~200 优先于唯一匹配）
{
  const out = rankCandidates([c('#only', 1, 'other'), c('.item-long-name', 20, 'other'), c('.it', 20, 'other')], { hasLink: false });
  assert.deepEqual(out.map((x) => x.sel), ['.it', '.item-long-name', '#only']);
}

// R4：通俗描述
assert.match(describeCandidate(c('a.t', 12, 'link')), /只拦截这类链接/);
assert.match(describeCandidate(c('.row', 12, 'block')), /整行任意位置/);
assert.match(describeCandidate(c('#x', 1, 'link')), /只拦截这一个链接/);

// 稳定 class 过滤
assert.equal(isStableClassName('thread-title'), true);
assert.equal(isStableClassName('css-1a2b3c'), false);
assert.equal(isStableClassName('pv-picker-bar'), false);

console.log('selector tests passed');
