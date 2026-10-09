const { contextBridge, ipcRenderer, webUtils } = require('electron')

// 桌面端能拿到拖入/选择文件的真实路径，不用再经过 /api/upload 暂存
contextBridge.exposeInMainWorld('conduitDesktop', {
  pathForFile: file => webUtils.getPathForFile(file) || null,
  stat: path => ipcRenderer.invoke('conduit:stat', path)
})
