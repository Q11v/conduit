interface Window {
  desktop: {
    pathForFile(file: File): string | null
    stat(path: string): Promise<{ size: number; dir: boolean } | null>
    pick(opts?: { dir?: boolean; defaultPath?: string }): Promise<string | null>
    reveal(paths: string[]): Promise<void>
    confirm(message: string, detail?: string, action?: string): Promise<boolean>
  }
}
