# conduit

把本地文件/目录一次推送到多台服务器，也能从服务器拉回本机。底层用系统自带的 `ssh` 和 `rsync`。

```bash
npm start          # 构建前端 + 启动 → http://127.0.0.1:4321
npm run dev        # 前端 5173 带热更新，/api 转发到 4321
npm run serve      # 只启动服务端，不重新构建
```

## 功能

**服务器**：主机填 `~/.ssh/config` 里的别名或 `user@1.2.3.4`，可选端口，一台可配多个常用目录，选认证方式。「测」按钮用一次 SSH 验证登录、远端 rsync、每个目录是否存在且可写。

**推送**：拖文件进浏览器或填本地绝对路径（大文件用后者，字节不经过浏览器），在下拉里按「服务器 + 目录」逐条勾选，也可以用「临时目标」文本框按 `host:/远程目录` 每行一条填（不入库，仅密钥认证）。底部状态条显示进度，支持全部取消和重试失败项。可选「推送后校验大小」，rsync 结束后回读远端字节数对账。

**拉取**：选一台服务器，在远端文件浏览器里勾选文件或目录（可跨目录多选，换服务器会清空勾选），落地为 `本地目录/<同名>`，同名文件覆盖，本地多余文件不删。浏览器每次列一层，单个目录最多列 2000 项。

**方案**：推送存「来源 + 目标」，拉取存「服务器 + 远端路径 + 本地目录」，载入只填表，也可直接开跑。方案里被删掉的服务器载入时会跳过并提示。

**活动记录**：进程内存里的环形缓冲，200 条，重启清空。

推送和拉取共用底部状态条，同一时间只跑一种任务。

## 认证

**SSH 密钥（推荐）**：走 ssh-agent 和 `~/.ssh/config`，不碰你的密钥，`ProxyJump` 等配置自动生效。

**密码**：仅 macOS，存进钥匙串，配置文件里只留 `"auth": "password"` 标记，通过 `SSH_ASKPASS` 喂给 ssh（需要 OpenSSH 8.4+）。askpass 助手只回答密码提示，不回答主机密钥确认，所以首次连接前要先在终端 `ssh` 一次确认指纹。

## 配置

`~/.config/conduit/servers.json`，方案在同目录的 `presets.json`，都是纯文本，可直接手编：

```json
[
  {
    "id": "…",
    "name": "web1",
    "host": "prod-web1",
    "dirs": ["/var/www/releases", "/opt/backup"],
    "group": "生产",
    "auth": "key"
  }
]
```

写入用「临时文件 + rename」，文件损坏时退化成空列表。删除服务器会一并清掉钥匙串里的密码。

| 环境变量           | 默认                             | 作用               |
| ------------------ | -------------------------------- | ------------------ |
| `CONDUIT_CONFIG`   | `~/.config/conduit/servers.json` | 服务器配置路径     |
| `CONDUIT_PRESETS`  | `~/.config/conduit/presets.json` | 方案路径           |
| `PORT`             | `4321`                           | 服务端口           |
| `CONDUIT_TIMEOUT`  | `30`                             | 短命令硬超时（秒） |
| `CONDUIT_PARALLEL` | `4`                              | 推送并发数（1–16） |

依赖：本地 `rsync` + `ssh`，远端 `rsync` + `sshd`。远程目录不存在会自动 `mkdir -p`。

## 开发

- `server/` 是 Hono 写的 API，纯 Node ESM；`web/src/` 是 React + Tailwind，构建产物落到 `web/dist/`
- 源码不写注释，行为以代码为准
- 颜色、对比度、描边都集中在 `web/src/index.css`，改色值前先核对 WCAG 对比度
- `npm run lint` / `npm run format` / `npm run typecheck`。TypeScript 7 是原生版本、不再导出 JS 编译器 API，所以 ESLint 用 oxc 解析 TS/TSX，类型检查由 `tsc --noEmit` 负责
- 改完服务端要重启（路由在启动时固定），改完前端要重新构建，`npm run dev` 下两者都自动

排障先看 `npm start` 的终端：每次 API 调用和每条 ssh/rsync 命令都打在那里，命令可以直接复制重跑。

```
[09:25:12] http POST /api/check → 200 49ms
[09:25:12] check prod-web1 ssh -o ConnectTimeout=15 -o BatchMode=yes prod-web1 'command -v rsync …'
[09:25:12] check prod-web1 exit=255 45ms stderr: ssh: Could not resolve hostname prod-web1
[09:25:12] check prod-web1 判定 FAIL: 主机名无法解析
```

## 注意

- 服务只监听 `127.0.0.1` 且不做认证，不要改成 `0.0.0.0`
- 拖拽上传的文件暂存在 `$TMPDIR/conduit-staging/`，需要时自行清理
- 传输没有原子切换，目标目录正被线上读取时可能读到写了一半的文件
