#!/usr/bin/env node
/**
 * 版本号工具：一次同步 package.json / banner.txt / package-lock.json 三处版本。
 *
 *   node tools/version.mjs                 查看当前版本
 *   node tools/version.mjs bump            递增（2.3.7.1 → 2.3.7.2；三段则补成 2.3.7 → 2.3.7.1）
 *   node tools/version.mjs set 2.3.8       指定版本（发版用）
 *   ... 追加 --build                       改完后自动 npm run build（同步 dist）
 *
 * 只改版本字段，不提交、不打 tag。CHANGELOG 仍需手动补条目。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgPath = join(root, 'package.json');
const lockPath = join(root, 'package-lock.json');
const bannerPath = join(root, 'banner.txt');

const args = process.argv.slice(2);
const withBuild = args.includes('--build');
const [cmd, value] = args.filter((a) => !a.startsWith('--'));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const current = pkg.version;

function nextVersion(v) {
  const parts = v.split('.').map((n) => Number.parseInt(n, 10));
  if (parts.length < 3 || parts.some(Number.isNaN)) {
    throw new Error(`无法解析当前版本: ${v}`);
  }
  if (parts.length === 3) return `${v}.1`;
  parts[3] += 1;
  return parts.slice(0, 4).join('.');
}

if (!cmd) {
  console.log(current);
  process.exit(0);
}
if (cmd !== 'bump' && cmd !== 'set') {
  console.error('用法: node tools/version.mjs [bump | set <x.y.z[.n]>] [--build]');
  process.exit(1);
}

const next = cmd === 'bump' ? nextVersion(current) : value;
if (!next || !/^\d+\.\d+\.\d+(\.\d+)?$/.test(next)) {
  console.error(`版本号格式不符（需 x.y.z 或 x.y.z.n）: ${next ?? '(空)'}`);
  process.exit(1);
}

function replace(file, pattern, replacement) {
  const before = readFileSync(file, 'utf-8');
  if (!before.match(pattern)) throw new Error(`未匹配到版本字段: ${file}`);
  writeFileSync(file, before.replace(pattern, replacement));
}

// package.json：根 version（首个 "version" 字段）
replace(pkgPath, /("version":\s*")[^"]*(")/, `$1${next}$2`);
// package-lock.json：name 锚定，命中顶层与 packages[""] 两处，不会误伤依赖版本
replace(
  lockPath,
  /("name":\s*"popup-viewer-v2",\s*\r?\n\s*"version":\s*")[^"]*(")/g,
  `$1${next}$2`
);
// banner.txt：@version
replace(bannerPath, /^(\/\/ @version\s+)\S+$/m, `$1${next}`);

console.log(`${current} -> ${next}`);

if (withBuild) {
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
  console.log('dist 已重建（记得按需补 CHANGELOG 条目）');
} else {
  console.log('下一步: npm run build  （或加 --build 自动执行）');
}
