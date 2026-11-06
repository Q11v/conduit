interface Window {
  desktop: {
    platform: string
    theme: 'dark' | 'light'
    settings: {
      get(
        legacy?: Partial<import('./types').WorkspaceSettings>
      ): Promise<import('./api').Result<{ settings: import('./types').WorkspaceSettings }>>
      update(
        patch: Partial<import('./types').WorkspaceSettings>
      ): Promise<import('./api').Result<{ settings: import('./types').WorkspaceSettings }>>
    }
    backup: {
      export(): Promise<import('./api').Result<{ canceled?: boolean; path?: string }>>
      restore(): Promise<import('./api').Result<{ canceled?: boolean }>>
      repair(): Promise<import('./api').Result<{ canceled?: boolean; repaired?: string[] }>>
    }
    pathForFile(file: File): string | null
    list(path: string): Promise<import('./api').Result<import('./types').Listing>>
    trash(directory: string, paths: string[]): Promise<import('./api').Result<{ deleted: string[] }>>
    stat(path: string): Promise<{ size: number; dir: boolean } | null>
    pick(opts?: { dir?: boolean; defaultPath?: string }): Promise<string | null>
    reveal(paths: string[]): Promise<void>
    confirm(message: string, detail?: string, action?: string): Promise<boolean>
  }
}
