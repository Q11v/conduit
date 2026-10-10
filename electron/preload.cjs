const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  pathForFile: file => webUtils.getPathForFile(file) || null,
  stat: path => ipcRenderer.invoke('conduit:stat', path),
  pick: (opts = {}) => ipcRenderer.invoke('conduit:pick', opts),
  reveal: paths => ipcRenderer.invoke('conduit:reveal', paths),
  confirm: (message, detail, action) => ipcRenderer.invoke('conduit:confirm', { message, detail, action })
})
