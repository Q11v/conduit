const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  pathForFile: file => webUtils.getPathForFile(file) || null,
  list: path => ipcRenderer.invoke('conduit:list', path),
  trash: (directory, paths) => ipcRenderer.invoke('conduit:trash', { directory, paths }),
  stat: path => ipcRenderer.invoke('conduit:stat', path),
  pick: (opts = {}) => ipcRenderer.invoke('conduit:pick', opts),
  reveal: paths => ipcRenderer.invoke('conduit:reveal', paths),
  confirm: (message, detail, action) => ipcRenderer.invoke('conduit:confirm', { message, detail, action })
})
