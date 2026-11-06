export const FILE_DRAG = 'application/x-conduit-files'
export type Side = 'local' | 'remote'
export type DragFiles = { side: Side; paths: string[]; serverId?: string }
