import { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme } from 'electron'
import { execFileSync } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path, { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateDeletePaths } from '../server/file-actions.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEV_URL = process.env.CONDUIT_DEV_URL
const PORT = Number(process.env.CONDUIT_PORT || (DEV_URL ? 4323 : 4322))

const expandHome = p => (p === '~' ? homedir() : p?.startsWith('~/') ? join(homedir(), p.slice(2)) : p)

function inheritShellEnv() {
  try {
    const out = execFileSync(
      process.env.SHELL || '/bin/zsh',
      ['-ilc', 'printf "\\n__ENV__%s\\n__ENV__%s" "$PATH" "$SSH_AUTH_SOCK"'],
      { encoding: 'utf8', timeout: 5000 }
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
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 18 } } : {}),
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
  win.webContents.on('did-fail-load', () => setTimeout(() => win?.loadURL(url), 500))
  win.on('closed', () => (win = null))
  win.loadURL(url)
}

if (DEV_URL) app.setPath('userData', `${app.getPath('userData')}-dev`)
if (!app.requestSingleInstanceLock()) app.quit()

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

ipcMain.handle('conduit:stat', async (_e, path) => {
  try {
    const s = await stat(expandHome(path))
    return { size: s.size, dir: s.isDirectory() }
  } catch {
    return null
  }
})

ipcMain.handle('conduit:list', async (_e, path) => {
  try {
    const dir = resolve(expandHome(path || '~'))
    const entries = await readdir(dir, { withFileTypes: true })
    return {
      ok: true,
      path: dir,
      select: null,
      truncated: entries.length > 2000,
      entries: (
        await Promise.all(
          entries.slice(0, 2000).map(async e => {
            try {
              const info = await stat(join(dir, e.name))
              return {
                name: e.name,
                type: info.isDirectory() ? 'dir' : 'file',
                size: info.isDirectory() ? null : info.size,
                modifiedAt: info.mtimeMs
              }
            } catch {
              return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', size: null, modifiedAt: null }
            }
          })
        )
      ).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('conduit:trash', async (_e, { directory, paths }) => {
  const deleted = []
  try {
    const files = validateDeletePaths(directory, paths, path)
    const errors = []
    for (const file of files) {
      try {
        await shell.trashItem(file)
        deleted.push(file)
      } catch (err) {
        errors.push(`${file}: ${err.message}`)
      }
    }
    return errors.length ? { ok: false, deleted, error: errors.join('\n') } : { ok: true, deleted }
  } catch (err) {
    return { ok: false, deleted, error: err.message }
  }
})

ipcMain.handle('conduit:pick', async (_e, { dir, defaultPath }) => {
  const r = await dialog.showOpenDialog(win, {
    defaultPath: expandHome(defaultPath) || undefined,
    properties: dir ? ['openDirectory', 'createDirectory'] : ['openFile', 'openDirectory'],
    buttonLabel: '选择'
  })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('conduit:reveal', async (_e, paths) => {
  if (paths.length === 1) shell.showItemInFolder(expandHome(paths[0]))
  else if (paths.length > 1) await shell.openPath(dirname(expandHome(paths[0])))
})

ipcMain.handle('conduit:confirm', async (_e, { message, detail, action }) => {
  const r = await dialog.showMessageBox(win, {
    type: 'warning',
    message,
    detail,
    buttons: [action || '确定', '取消'],
    defaultId: 1,
    cancelId: 1
  })
  return r.response === 0
})

app
  .whenReady()
  .then(async () => {
    // Match native window chrome and dialogs to the app's dark interface.
    nativeTheme.themeSource = 'dark'
    if (!app.isPackaged) app.dock?.setIcon(join(HERE, '..', 'build', 'icon.png'))
    inheritShellEnv()
    const { start } = await import('../server/index.js')
    let port
    try {
      port = await start(PORT)
    } catch {
      port = await start(0)
    }
    url = DEV_URL || `http://127.0.0.1:${port}/`
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
