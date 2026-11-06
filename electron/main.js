import { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme, screen } from 'electron'
import { execFileSync } from 'node:child_process'
import { readdir, stat, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path, { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { initialWindowBounds } from './window-layout.js'
import { configureEnvironment } from './environment.js'
import { validateDeletePaths } from '../server/file-actions.js'

const HERE = dirname(fileURLToPath(import.meta.url))
configureEnvironment(process.env, homedir())
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

let currentTheme = 'dark'
let win = null
let url = null

function applyNativeTheme(theme) {
  currentTheme = theme === 'light' ? 'light' : 'dark'
  nativeTheme.themeSource = currentTheme
  win?.setBackgroundColor(currentTheme === 'light' ? '#f4f6fa' : '#08080c')
}
ipcMain.on('conduit:theme:get', event => {
  event.returnValue = currentTheme
})

function createWindow() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  win = new BrowserWindow({
    ...initialWindowBounds(display.workArea),
    backgroundColor: currentTheme === 'light' ? '#f4f6fa' : '#08080c',
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

const respond =
  operation =>
  async (...args) => {
    try {
      return { ok: true, ...(await operation(...args)) }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }
ipcMain.handle(
  'conduit:settings:get',
  respond(async (_e, legacy) => {
    const { migrateSettings } = await import('../server/settings.js')
    const settings = await migrateSettings(legacy)
    applyNativeTheme(settings.theme)
    return { settings }
  })
)
ipcMain.handle(
  'conduit:settings:update',
  respond(async (_e, patch) => {
    const { updateSettings } = await import('../server/settings.js')
    const settings = await updateSettings(patch)
    applyNativeTheme(settings.theme)
    return { settings }
  })
)
ipcMain.handle(
  'conduit:backup:export',
  respond(async () => {
    const { exportBackup } = await import('../server/backup.js')
    const result = await dialog.showSaveDialog(win, {
      defaultPath: join(app.getPath('documents'), `conduit-backup-${new Date().toISOString().slice(0, 10)}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    const data = await exportBackup()
    await writeFile(result.filePath, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
    return { path: result.filePath }
  })
)
ipcMain.handle(
  'conduit:backup:restore',
  respond(async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'conduit 备份', extensions: ['json'] }]
    })
    if (result.canceled) return { canceled: true }
    const { validateBackup, restoreBackup } = await import('../server/backup.js')
    const backup = validateBackup(JSON.parse(await readFile(result.filePaths[0], 'utf8')))
    const choice = await dialog.showMessageBox(win, {
      type: 'warning',
      message: '恢复 conduit 备份？',
      detail: `将替换 ${backup.servers.length} 台服务器、${backup.presets.length} 个方案及书签设置。当前配置会另存副本。备份不包含密码和 SSH 私钥，密码认证可能需要重新填写。请先完成或取消传输。`,
      buttons: ['恢复', '取消'],
      defaultId: 1,
      cancelId: 1
    })
    if (choice.response !== 0) return { canceled: true }
    const { withIdleTransfers } = await import('../server/index.js')
    await withIdleTransfers(() => restoreBackup(backup))
    const { loadSettings } = await import('../server/settings.js')
    applyNativeTheme((await loadSettings()).theme)
    return {}
  })
)
ipcMain.handle(
  'conduit:backup:repair',
  respond(async () => {
    const choice = await dialog.showMessageBox(win, {
      type: 'warning',
      message: '修复损坏的配置？',
      detail: '仅将无法读取的配置替换为对应的 .bak 自动备份，原文件会保留副本。',
      buttons: ['修复', '取消'],
      defaultId: 1,
      cancelId: 1
    })
    if (choice.response !== 0) return { canceled: true }
    const { repairFromBackups } = await import('../server/backup.js')
    const { withIdleTransfers } = await import('../server/index.js')
    const repaired = await withIdleTransfers(repairFromBackups)
    const { loadSettings } = await import('../server/settings.js')
    applyNativeTheme((await loadSettings()).theme)
    return { repaired }
  })
)

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
    const { trashLocalFiles } = await import('../server/index.js')
    return await trashLocalFiles(files, file => shell.trashItem(file))
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
    const { loadSettings } = await import('../server/settings.js')
    try {
      applyNativeTheme((await loadSettings()).theme)
    } catch {
      applyNativeTheme('dark')
    }
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
