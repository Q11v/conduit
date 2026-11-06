const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  theme: ipcRenderer.sendSync('conduit:theme:get'),
  settings: {
    get: legacy => ipcRenderer.invoke('conduit:settings:get', legacy),
    update: patch => ipcRenderer.invoke('conduit:settings:update', patch)
  },
  backup: {
    export: () => ipcRenderer.invoke('conduit:backup:export'),
    restore: () => ipcRenderer.invoke('conduit:backup:restore'),
    repair: () => ipcRenderer.invoke('conduit:backup:repair')
  },
  pathForFile: file => webUtils.getPathForFile(file) || null,
  list: path => ipcRenderer.invoke('conduit:list', path),
  trash: (directory, paths) => ipcRenderer.invoke('conduit:trash', { directory, paths }),
  stat: path => ipcRenderer.invoke('conduit:stat', path),
  pick: (opts = {}) => ipcRenderer.invoke('conduit:pick', opts),
  reveal: paths => ipcRenderer.invoke('conduit:reveal', paths),
  confirm: (message, detail, action) => ipcRenderer.invoke('conduit:confirm', { message, detail, action })
})
