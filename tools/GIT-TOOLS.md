# git-tools.mjs 使用说明

一个 Node 编写的 Git 管理工具：一键完成 **构建 → 提交 → 推送**，自动使用项目内配置的 SSH 密钥，避免每次手动指定密钥或身份。

## 前置要求

- **Node.js** ≥ 14（本项目在 22 上测试）
- **Git**（含 `ssh`，Windows 上装 Git for Windows 即可）
- 一个**已绑定到目标仓库账号的 SSH 密钥**（公钥已加到 GitHub/GitLab 等平台）

## 一、安装到新项目

### 1. 复制工具文件

把 `git-tools.mjs` 复制到新项目的 `tools/` 目录下（工具会自动把 `tools/` 的上级当作项目根）：

```
你的项目/
├── tools/
│   └── git-tools.mjs
├── package.json
└── ...源码
```

### 2. 添加 npm scripts

在 `package.json` 的 `scripts` 中加入：

```jsonc
"scripts": {
  "g": "node tools/git-tools.mjs",
  "g:status": "node tools/git-tools.mjs status",
  "g:commit": "node tools/git-tools.mjs commit",
  "g:push": "node tools/git-tools.mjs push",
  "g:publish": "node tools/git-tools.mjs publish"
}
```

### 3. 配置 SSH 密钥

工具默认读取项目根下的 `id_ed25519_coresz` 私钥，两种方式二选一：

- **方式 A（推荐，多项目复用同一身份）**：把对应账号的私钥复制到项目根并命名为 `id_ed25519_coresz`（与 `package.json` 无关，纯文件名约定）
- **方式 B（不同身份）**：编辑 `tools/git-tools.mjs` 第 9 行，把密钥文件名改成你的：

  ```js
  const KEY = join(project, 'id_ed25519_你的密钥名');
  ```

没有密钥文件时工具也能运行（本地 commit/status 正常），只是 push 时不会自动指定密钥，会走系统默认 SSH。

> 安全提醒：私钥不要提交进 git，记得加进 `.gitignore`。

### 4. 初始化仓库

```bash
git init
npm run g -- setup git@github.com:你的用户名/仓库名.git
```

`setup` 会绑定 origin 并把分支改为 `main`。

## 二、命令详解

所有命令统一入口：`npm run g -- <命令> <参数>`

### status — 查看状态

```bash
npm run g -- status
```

显示工作区变更 + 最近 5 条提交。

### commit — 构建 + 暂存 + 提交

```bash
npm run g -- commit "修复了xx问题"
# 或：不传信息，交互输入
npm run g -- commit
```

流程：**先 `npm run build`**（保证构建产物与源码同步）→ `git add -A` → 提交。

- 加 `--no-build` 跳过构建：`npm run g -- commit "改文档" --no-build`

### push — 推送到远程

```bash
npm run g -- push
```

使用上游跟踪分支推送；首次推送建议用 `setup` 或 `publish`。

### publish — 一步到位

```bash
npm run g -- publish "修复了xx问题"
```

= `build` + `commit` + `push`，日常最常用的一条命令。

### setup — 配置远程

```bash
npm run g -- setup git@github.com:user/repo.git
```

origin 不存在则添加，已存在则跳过；始终把当前分支切到 `main`。

## 三、典型工作流

```bash
# 查看状态
npm run g -- status

# 开发完成，一步提交并推送
npm run g -- publish "新增xxx功能"

# 只提交不推送
npm run g -- commit "WIP 中间提交"

# 只推送已有提交
npm run g -- push
```

## 四、多项目 / 多账号

- **同一账号多个项目**：把同一个密钥文件复制到各项目根（同名），各项目各跑各的，互不影响。
- **不同账号不同项目**：每个项目放对应账号的密钥文件，并把 `git-tools.mjs` 里的 `KEY` 改成对应文件名（或直接同名覆盖）。
- 密钥与身份按项目隔离：工具只写仓库级 `.git/config`，不改全局配置。

## 五、常见问题

**Q: push 报 `Permission denied (publickey)`**
- 确认项目根存在私钥文件，且文件名与 `KEY` 常量一致
- 确认该公钥已添加到目标平台账号（GitHub：Settings → SSH and GPG keys）
- 可用 `ssh -T git@github.com`（加 `-i 密钥路径`）验证：应回显 `Hi 用户名`

**Q: 首次 push 卡在 host key 确认**
工具已自动加 `-o StrictHostKeyChecking=accept-new`，正常无需交互；若仍卡住，说明系统 ssh 版本较旧，手动 `ssh -T git@github.com` 接受一次即可。

**Q: commit 时没构建，dist 落后了**
`commit`/`publish` 默认会先 `npm run build`；只有显式加 `--no-build` 才跳过。若没构建过，手动 `npm run build` 后重新提交。

**Q: 想用 HTTPS 而不是 SSH**
把 remote 设成 HTTPS 地址即可；此时 SSH 密钥自动失效（HTTPS 走凭据管理器），工具其余功能不受影响。
