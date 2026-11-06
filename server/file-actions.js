import { posix } from 'node:path'

// File-list actions may only address direct children of the displayed directory.
export function validateDeletePaths(directory, rawPaths, pathApi = posix) {
  if (typeof directory !== 'string' || !pathApi.isAbsolute(directory) || directory.includes('\0')) {
    throw new Error('请先打开有效目录')
  }
  const dir = pathApi.normalize(directory)
  if (!Array.isArray(rawPaths) || rawPaths.length === 0 || rawPaths.length > 2000) {
    throw new Error('请选择要删除的文件或文件夹（最多 2000 项）')
  }
  for (const path of rawPaths) {
    if (
      typeof path !== 'string' ||
      path.includes('\0') ||
      !pathApi.isAbsolute(path) ||
      pathApi.normalize(path) !== path ||
      path.endsWith(pathApi.sep) ||
      path === dir ||
      pathApi.dirname(path) !== dir
    ) {
      throw new Error('只能删除当前目录中选中的文件或文件夹')
    }
  }
  return [...new Set(rawPaths)]
}
