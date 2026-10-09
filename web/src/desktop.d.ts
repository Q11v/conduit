// Electron preload 注入（electron/preload.cjs），浏览器里不存在
interface Window {
  conduitDesktop?: {
    pathForFile(file: File): string | null
    stat(path: string): Promise<{ size: number; dir: boolean } | null>
  }
}
