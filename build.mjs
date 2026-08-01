import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const banner = readFileSync(join(root, 'banner.txt'), 'utf-8').trimEnd();

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [join(root, 'main.js')],
  bundle: true,
  format: 'iife',
  outfile: join(root, 'a.js'),
  banner: { js: banner + '\n\n' },
  loader: { '.css': 'text' },
  minify: false,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'info'
};

if (watch) {
  const ctx = await build({ ...options, watch: true });
  process.stdin.on('data', () => ctx.dispose());
} else {
  await build(options);
  console.log('build done -> a.js');
}
