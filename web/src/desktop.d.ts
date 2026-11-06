interface Window {
  desktop: {
    platform: string
    pathForFile(file: File): string | null
    list(path: string): Promise<import('./api').Result<import('./types').Listing>>
    trash(directory: string, paths: string[]): Promise<import('./api').Result<{ deleted: string[] }>>
    stat(path: string): Promise<{ size: number; dir: boolean } | null>
    pick(opts?: { dir?: boolean; defaultPath?: string }): Promise<string | null>
    reveal(paths: string[]): Promise<void>
    confirm(message: string, detail?: string, action?: string): Promise<boolean>
  }
}
