# 开发说明

## 环境与启动

使用 Node.js 24 或更新版本，运行 `npm ci`，然后选择 `npm run dev` 或 `npm start`。本地需有 `ssh`、`rsync`，macOS 打包需可用的签名工具。当前 Electron 会按需下载本地运行时；离线开发前可用 `npx --no install-electron` 预先安装，打包后的应用已包含运行时。

`npm run dev` 使用 Vite（默认 5173）并将 `/api` 代理到 4323。开发版 Electron 的 userData、JSON 配置、日志和钥匙串服务均与正式版分离。Vite 代理端口固定为 4323；调试时应保持该端口可用。后端端口回退只适合正式版内置页面，不会自动重写 Vite 代理。

修改 `web/src/` 可热更新；修改 `server/`、`electron/`、preload 或环境变量后，必须完整退出并重启应用。刷新页面不会重建主进程和后端。

## 结构

| 路径                                                | 责任                                                |
| --------------------------------------------------- | --------------------------------------------------- |
| `electron/main.js`、`preload.cjs`                   | 窗口、原生对话框、文件浏览、废纸篓和设置 / 备份桥接 |
| `electron/environment.js`                           | 在导入后端前配置正式 / 开发路径与钥匙串命名空间     |
| `server/index.js`                                   | HTTP 接口、任务注册、共享调度、恢复配置时的空闲检查 |
| `server/scheduler.js`、`job-runner.js`              | 并发预算、路径资源锁、取消与重试                    |
| `server/transfer.js`                                | SSH / rsync、远端目录与删除                         |
| `server/json-store.js`                              | 串行配置操作、严格读取、原子写入、备份和恢复        |
| `server/settings.js`、`backup.js`                   | 工作台持久化、旧数据迁移、导入导出和修复            |
| `web/src/useConduit.ts`、`useJobs.ts`               | 服务器 / 方案操作、任务流与错误反馈                 |
| `web/src/useWorkspaceSettings.ts`                   | 原生设置桥接、迁移、顺序保存                        |
| `Workbench.tsx`、`FilePane.tsx`、`DirectoryBar.tsx` | 两侧位置与书签、文件列表、地址栏                    |
| `PlansView.tsx`、`TaskCenter.tsx`                   | 直接编辑 / 执行方案、任务展示                       |
| `web/src/index.css`                                 | 主题颜色、边框、焦点和动画                          |

旧版独立推送、拉取、载入方案页面已移除。新增操作应接入当前工作台或方案页，避免另建一套重复状态。

## 维护约定

- 文件删除必须先校验当前目录与选中路径，再进入与传输共用的调度器。不能只在 UI 判断有没有进行中的任务。
- 添加读写操作时，声明远端主机 / 端口、本地路径及读写模式；保留无冲突任务的并发能力。
- 配置变更通过共享数据锁和 JSON 存储工具完成。读取错误不能静默变成空配置，恢复前必须保留原文件。
- 主题颜色通过 `index.css` 的语义变量维护，新增控件不要硬编码仅适合暗色的底色和文字；主题同步存入设置并更新 Electron 原生外观。
- 持久化用户数据放固定文件。`localStorage` 仅用于读取旧版数据进行迁移，不再承担书签保存。
- 操作错误通过 `lib/notifications.ts` 的统一 Toast 显示；表单校验、目录读取错误保留在对应位置。不要增加底部常驻状态行，普通提示自动消失，错误可关闭。
- 允许写解释行为、约束和取舍的注释。不要为明显代码逐句添加说明。
- 不提交 `web/dist/`、`release/`、`*.tsbuildinfo`、测试临时产物或用户配置。

## 排障

先查看活动记录，再看完整日志。命令、路径、退出码和 stderr 可用于复现；对外分享日志前检查主机名、用户名和目录信息。

浏览失败常见原因包括：未确认 SSH 主机指纹、SSH agent 不可用、目录权限、远端没有 rsync，以及 macOS 局域网权限。密码不会写入导出备份，恢复后若缺少钥匙串条目需重新填写。
