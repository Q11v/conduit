import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { execFileSync } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// 固定端口，保证 origin 不变，localStorage 里的视图/拉取目录才能跨启动保留；被占用时退回随机端口
const PORT = Number(process.env.CONDUIT_DESKTOP_PORT || 4322)

// 从 Finder/Dock 启动的 App 拿不到 shell 里的 PATH（Homebrew 的 rsync 等），从登录 shell 补回来
function inheritShellEnv() {
  if (process.platform === 'win32') return
  try {
    const out = execFileSync(
      process.env.SHELL || '/bin/zsh',
      ['-ilc', 'printf "\\n__ENV__%s\\n__ENV__%s" "$PATH" "$SSH_AUTH_SOCK"'],
      {
        encoding: 'utf8',
        timeout: 5000
      }
    )
    const [, path, sock] = out.split('\n__ENV__')
    if (path) process.env.PATH = path.trim()
    if (sock?.trim()) process.env.SSH_AUTH_SOCK = sock.trim()
  } catch {}
}

let win = null
let url = null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#08080c',
    title: 'conduit',
    webPreferences: { preload: join(HERE, 'preload.cjs') }
  })
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target)) shell.openExternal(target)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, target) => {
    if (!target.startsWith(url)) {
      e.preventDefault()
      shell.openExternal(target)
    }
  })
  win.on('closed', () => (win = null))
  win.loadURL(url)
}

if (!app.requestSingleInstanceLock()) app.quit()

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

ipcMain.handle('conduit:stat', async (_e, path) => {
  try {
    const s = await stat(path)
    return { size: s.size, dir: s.isDirectory() }
  } catch {
    return null
  }
})

app
  .whenReady()
  .then(async () => {
    inheritShellEnv()
    const { start } = await import('../server/index.js')
    let port
    try {
      port = await start(PORT)
    } catch {
      port = await start(0)
    }
    url = `http://127.0.0.1:${port}/`
    createWindow()
  })
  .catch(err => {
    dialog.showErrorBox('conduit 启动失败', err.stack || err.message)
    app.quit()
  })

app.on('activate', () => {
  if (!win && url) createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
