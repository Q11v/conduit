export const tildify = (path: string, home: string) =>
  home && path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
