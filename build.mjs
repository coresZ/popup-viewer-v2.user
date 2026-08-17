import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');
const only = process.argv.filter((a) => a.startsWith('--only=')).map((a) => a.slice(7));

const banner = readFileSync(join(root, 'banner.txt'), 'utf-8').trimEnd();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [join(root, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  outfile: join(root, 'dist', 'popup-viewer-v2.user.js'),
  banner: { js: banner + '\n\n' },
  loader: { '.css': 'text' },
  // 临时：注入引导标记用于 iOS 诊断（定位后移除）
  inject: [join(root, 'src', 'bootMarker.js')],
  // 临时：boot 标记显示构建版本（诊断用）
  define: { __PV2_VER__: JSON.stringify(pkg.version) },
  // 转译到 ES2019（可选链/类静态字段等向下兼容），兼容旧版 Safari/iOS 脚本管理器
  target: 'es2019',
  minify,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'info'
};

/** @type {import('esbuild').BuildOptions} */
const kitOptions = {
  entryPoints: [join(root, 'src', 'kit', 'popupKit.js')],
  bundle: true,
  format: 'iife',
  outfile: join(root, 'dist', 'popup-viewer-kit.js'),
  loader: { '.css': 'text' },
  target: 'es2019',
  minify,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'info'
};

async function run(targets) {
  const jobs = [];
  if (targets.has('main')) jobs.push(build(options));
  if (targets.has('kit')) jobs.push(build(kitOptions));
  await Promise.all(jobs);
}

if (watch) {
  const targets = new Set(only.length ? only : ['main', 'kit']);
  const ctxs = [];
  if (targets.has('main')) ctxs.push(await build({ ...options, watch: true }));
  if (targets.has('kit')) ctxs.push(await build({ ...kitOptions, watch: true }));
  process.stdin.on('data', () => {
    ctxs.forEach((ctx) => ctx.dispose());
  });
} else {
  const targets = new Set(only.length ? only : ['main', 'kit']);
  await run(targets);
  console.log('build done -> dist/popup-viewer-v2.user.js, dist/popup-viewer-kit.js');
}
