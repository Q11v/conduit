# conduit

把本地文件/目录一次推送到多台服务器，也能从服务器拉回本机。macOS 桌面应用（Electron），底层用系统自带的 `ssh` 和 `rsync`。

```bash
npm start          # 构建前端 + 打开窗口
npm run dev        # 前端走 vite 热更新，独立的数据目录和端口，可以和已安装的 App 同时开
npm run dist       # 打包成 release/mac-arm64/conduit.app（未签名，自用）
npm run dist:dmg   # 打包成 dmg
```

未签名的 App 首次打开要在 Finder 里右键 →「打开」。从 Finder/Dock 启动时会从登录 shell 补回 `PATH` 和 `SSH_AUTH_SOCK`，Homebrew 装的 rsync 和 1Password 之类的 agent 都能用。

## 功能

**服务器**：只管怎么连——主机填 `~/.ssh/config` 里的别名或 `user@1.2.3.4`，可选端口、标签、认证方式。「检测」用一次 SSH 验证登录和远端 rsync。

**常用目录**：不在服务器页配置，在用的地方管理。推送选目标时可以临时加路径，点 ☆ 存为常用、点 × 移出；拉取时浏览到某个目录点「存为常用」。常用目录存在服务器配置的 `dirs` 里，可以为空。

**推送**：来源可以拖进窗口、点「选择」或直接填本地路径，文件和目录都行，在下拉里按「服务器 + 目录」逐条勾选，也可以用「临时目标」文本框按 `host:/远程目录` 每行一条填（不入库，仅密钥认证）。底部状态条显示进度，支持全部取消和重试失败项。可选「推送后校验大小」，rsync 结束后回读远端字节数对账。

**拉取**：选一台服务器，在远端文件浏览器里勾选文件或目录（可跨目录多选，换服务器会清空勾选），落地为 `本地目录/<同名>`，同名文件覆盖，本地多余文件不删。完成后「打开本地目录」在 Finder 里定位结果。浏览器每次列一层，单个目录最多列 2000 项。

**方案**：推送存「来源 + 目标」，拉取存「服务器 + 远端路径 + 本地目录」，载入只填表，也可直接开跑。方案里被删掉的服务器载入时会跳过并提示。

**活动记录**：推送、拉取、检测各记一条，点开能看到这次执行的 ssh / rsync 命令、退出码、耗时、传输量和完整 stderr。保留最近 1000 条，存在 `~/Library/Logs/conduit/activity.jsonl`，重启不丢。

**日志文件**：`~/Library/Logs/conduit/conduit.log`，每次 API 调用、每条命令和完整报错都在里面（活动记录页右上「完整日志文件」直接定位），超过 5 MB 轮转成 `conduit.log.1`。

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
| `CONDUIT_LOG_DIR`  | `~/Library/Logs/conduit`         | 日志和活动记录目录 |
| `CONDUIT_PORT`     | `4322`（dev 为 `4323`）          | 内置服务端口       |
| `CONDUIT_TIMEOUT`  | `30`                             | 短命令硬超时（秒） |
| `CONDUIT_PARALLEL` | `4`                              | 推送并发数（1–16） |

依赖：本地 `rsync` + `ssh`，远端 `rsync` + `sshd`。远程目录不存在会自动 `mkdir -p`。

## 开发

- `electron/` 是主进程：启动 `server/`、开窗口，并通过 preload 给前端提供选择框、Finder 定位、确认框、拖入文件的真实路径（`window.desktop`，类型在 `web/src/desktop.d.ts`）
- `server/` 是 Hono 写的 API，纯 Node ESM，由主进程 `start(port)` 拉起；`web/src/` 是 React + Tailwind，构建产物落到 `web/dist/`
- 源码不写注释，行为以代码为准
- 颜色、对比度、描边都集中在 `web/src/index.css`，改色值前先核对 WCAG 对比度
- `npm run lint` / `npm run format` / `npm run typecheck`。TypeScript 7 是原生版本、不再导出 JS 编译器 API，所以 ESLint 用 oxc 解析 TS/TSX，类型检查由 `tsc --noEmit` 负责
- 改完 `server/` 或 `electron/` 要重启 App，前端在 `npm run dev` 下热更新

排障先看活动记录里那一条的详情，或 `~/Library/Logs/conduit/conduit.log`（开发时 `npm start` / `npm run dev` 的终端也有同样输出），命令可以直接复制重跑：

```
[09:25:12] http POST /api/check → 200 49ms
[09:25:12] check prod-web1 ssh -o ConnectTimeout=15 -o BatchMode=yes prod-web1 'command -v rsync …'
[09:25:12] check prod-web1 exit=255 45ms stderr: ssh: Could not resolve hostname prod-web1
[09:25:12] check prod-web1 判定 FAIL: 主机名无法解析
```

## 注意

- 服务只监听 `127.0.0.1` 且不做认证，不要改成 `0.0.0.0`
- 传输没有原子切换，目标目录正被线上读取时可能读到写了一半的文件
