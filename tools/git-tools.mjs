#!/usr/bin/env node
import { execSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import readline from 'node:readline';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const KEY = join(project, 'id_ed25519_coresz');
const HAS_KEY = existsSync(KEY);

// 推送时使用项目内 SSH 密钥（避免手动指定）
const env = { ...process.env };
if (HAS_KEY) {
  env.GIT_SSH_COMMAND = `ssh -i "${KEY}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;
}

function run(args) {
  execFileSync('git', args, { cwd: project, env, stdio: 'inherit' });
}
function out(args) {
  return execFileSync('git', args, { cwd: project, env, encoding: 'utf8' }).trim();
}
function npmRun(script) {
  execSync(`npm run ${script}`, { cwd: project, env, stdio: 'inherit' });
}
function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
async function resolveMessage(explicit) {
  if (explicit) return explicit;
  const m = await prompt('提交信息: ');
  if (!m) {
    console.error('未提供提交信息，已取消');
    process.exit(1);
  }
  return m;
}

const args = process.argv.slice(2);
const cmd = args[0];
const noBuild = args.includes('--no-build');
const explicitMsg = args.slice(1).filter((a) => !a.startsWith('--')).join(' ');
const remoteUrl = args[1];

async function doCommit() {
  run(['add', '-A']);
  const m = await resolveMessage(explicitMsg);
  run(['commit', '-m', m]);
  console.log('\n■ 最近提交');
  run(['log', '--oneline', '-3']);
}

async function main() {
  switch (cmd) {
    case 'status':
      console.log('\n■ 工作区状态');
      run(['status']);
      console.log('\n■ 最近提交');
      run(['log', '--oneline', '-5']);
      break;

    case 'commit':
      if (!noBuild) {
        console.log('\n▶ 构建（src → dist）');
        npmRun('build');
      }
      await doCommit();
      break;

    case 'push':
      console.log('\n▶ 推送到远程');
      run(['push']);
      break;

    case 'publish':
      if (!noBuild) {
        console.log('\n▶ 构建（src → dist）');
        npmRun('build');
      }
      await doCommit();
      console.log('\n▶ 推送到远程');
      run(['push']);
      break;

    case 'setup': {
      console.log('\n▶ 配置远程');
      const remotes = out(['remote']).split(/\s+/).filter(Boolean);
      if (remotes.includes('origin')) {
        console.log('origin 已存在');
      } else if (remoteUrl) {
        run(['remote', 'add', 'origin', remoteUrl]);
      } else {
        console.error('用法: npm run g -- setup <git@github.com:user/repo.git>');
        process.exit(1);
      }
      run(['branch', '-M', 'main']);
      console.log(out(['remote', '-v']));
      break;
    }

    default:
      console.log(`
Git 管理工具（npm run g -- <命令>）

  status    查看工作区状态与最近提交
  commit    构建 + 暂存 + 提交（传消息，未传则交互输入）
  push      推送到远程
  publish   构建 + 提交 + 推送（一步到位）
  setup     配置远程并切到 main（需传仓库地址）

示例:
  npm run g -- status
  npm run g -- publish "修复xxx"
  npm run g -- setup git@github.com:coresZ/popup-viewer-v2.user.git

说明: 推送自动使用项目内 SSH 密钥（id_ed25519_coresz）。
      commit/publish 会先 npm run build，保证 dist 与 src 一致；加 --no-build 可跳过。
`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
