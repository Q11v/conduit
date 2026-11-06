import { useEffect, useRef, useState } from 'react'
import { Btn as BaseBtn } from './ui'
import { Checkbox } from './ui/checkbox'
import { DirectoryBar } from './DirectoryBar'
import { FileIcon, Folder, Star, Trash } from './Icons'
import { browse, deleteRemoteFiles, formatSize, why } from '../api'
import type { Listing } from '../types'
import { formatModified, sortEntries, type FileSort, type SortKey } from '../lib/file-list'
import type { DragFiles, Side } from '../lib/workspace'
import { notifyError } from '../lib/notifications'
import { FILE_DRAG } from '../lib/workspace'
function Btn({ className = '', ...props }: React.ComponentProps<typeof BaseBtn>) {
  return (
    <BaseBtn {...props} className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs ${className}`} />
  )
}
const join = (dir: string, name: string) => `${dir.replace(/\/$/, '')}/${name}`
const parent = (dir: string) => dir.replace(/\/[^/]+\/?$/, '') || '/'
export function FilePane({
  title,
  location,
  serverId,
  serverLabel,
  selected,
  onSelect,
  onLocation,
  onPickDirectory,
  home,
  favorites,
  onFavorite,
  refreshToken,
  dragSource,
  onDragFiles,
  onDragFinish,
  onDropFiles,
  children
}: {
  title: string
  location: string
  serverId?: string
  serverLabel?: string
  selected: string[]
  onSelect: (paths: string[]) => void
  onLocation: (path: string) => void
  onPickDirectory?: () => void
  home?: string
  favorites: string[]
  onFavorite: (path: string) => void
  refreshToken: string
  dragSource: Side | null
  onDragFiles: (files: DragFiles) => void
  onDragFinish: () => void
  onDropFiles: (files: File[]) => void
  children?: React.ReactNode
}) {
  const [input, setInput] = useState(location)
  const [listing, setListing] = useState<Listing | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [revision, setRevision] = useState(0)
  const [sort, setSort] = useState<FileSort>({ key: 'name', descending: false })
  const [dropOver, setDropOver] = useState(false)
  const dragDepth = useRef(0)
  const side: Side = serverId === undefined ? 'local' : 'remote'
  const accepts = (e: React.DragEvent) =>
    !!listing &&
    !loading &&
    ((e.dataTransfer.types.includes(FILE_DRAG) && dragSource !== null && dragSource !== side) ||
      (side === 'remote' && e.dataTransfer.types.includes('Files')))
  const changeSort = (key: SortKey) =>
    setSort(previous => ({ key, descending: previous.key === key ? !previous.descending : key !== 'name' }))
  useEffect(() => {
    let active = true
    const refresh = async () => {
      await Promise.resolve()
      if (!active) return
      setInput(location)
      setListing(previous => (previous?.path === location ? previous : null))
      setError('')
      setLoading(false)
      if (!location || serverId === '') return
      setLoading(true)
      try {
        const r =
          serverId === undefined
            ? await (window.desktop?.list?.(location) ??
                Promise.resolve({ ok: false as const, error: '请在桌面应用中浏览本地文件' }))
            : await browse(serverId, location)
        if (!active) return
        if (r.ok && 'path' in r) {
          setListing(r as Listing)
          setInput(r.path)
          if (r.path !== location) onLocation(r.path)
          if (r.select) onSelect([r.select])
        } else setError(why(r))
      } catch (e) {
        if (active) setError(String(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    void refresh()
    return () => {
      active = false
    }
  }, [location, serverId, revision, onLocation, onSelect, refreshToken])
  const toggle = (path: string) =>
    onSelect(selected.includes(path) ? selected.filter(p => p !== path) : [...selected, path])
  const canonical = (path: string) => (home && (path === '~' || path.startsWith('~/')) ? home + path.slice(1) : path)
  const favoritePath = favorites.find(path => canonical(path) === listing?.path)
  const entries = sortEntries(listing?.entries ?? [], sort)
  const navigate = (path: string) => {
    if (deleting) return
    onSelect([])
    onLocation(path)
  }
  const deleteSelected = async () => {
    if (!listing || !selected.length || deleting || loading) return
    const directory = listing.path
    const paths = [...selected]
    setDeleting(true)
    let attempted = false
    try {
      const remote = serverId !== undefined
      const confirmed = await window.desktop.confirm(
        remote ? `从服务器删除 ${paths.length} 项？` : `将 ${paths.length} 项移到废纸篓？`,
        `${remote ? '远端删除无法撤销，文件夹及其内容会一并删除。' : '文件夹及其内容会一起移到废纸篓。'}\n\n${serverId ? `服务器：${serverLabel || serverId}\n` : ''}${paths.join('\n')}`,
        remote ? '永久删除' : '移到废纸篓'
      )
      if (!confirmed) return
      attempted = true
      const result = remote
        ? await deleteRemoteFiles(serverId, directory, paths)
        : await window.desktop.trash(directory, paths)
      if (!result.ok) notifyError(why(result))
    } catch (e) {
      notifyError(String(e))
    } finally {
      if (attempted) {
        onSelect([])
        setRevision(v => v + 1)
      }
      setDeleting(false)
    }
  }
  return (
    <section
      className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border hair-2 panel ${dropOver ? 'ring-2 ring-cyan' : ''}`}
      onDragEnter={e => {
        if (accepts(e)) {
          e.preventDefault()
          dragDepth.current++
          setDropOver(true)
        }
      }}
      onDragOver={e => {
        if (accepts(e)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDropOver(false)
      }}
      onDrop={e => {
        const accepted = accepts(e)
        e.preventDefault()
        dragDepth.current = 0
        setDropOver(false)
        if (accepted) onDropFiles(Array.from(e.dataTransfer.files))
      }}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b hair px-4">
        <h2 className="m-0 text-sm font-semibold">{title}</h2>
        {children}
        {selected.length > 0 && (
          <Btn
            disabled={deleting || loading}
            title={serverId === undefined ? '移到废纸篓（冲突时等待传输结束）' : '删除远端文件（冲突时等待传输结束）'}
            onClick={() => void deleteSelected()}
            className="ml-auto text-err-text"
          >
            <Trash size={13} />
            {deleting ? '删除中…' : `删除所选 (${selected.length})`}
          </Btn>
        )}
      </div>
      <DirectoryBar
        title={title}
        value={input}
        path={listing?.path ?? null}
        loading={loading}
        onChange={setInput}
        onPick={onPickDirectory}
        onGo={path => {
          navigate(path)
          setRevision(v => v + 1)
        }}
      />
      <div className="min-h-16 flex-1 overflow-auto">
        {error && (
          <p role="alert" className="px-4 py-5 text-xs text-err-text break-words whitespace-pre-line">
            {error}
          </p>
        )}
        {!loading && !error && serverId === '' && (
          <p className="px-4 py-10 text-center text-xs text-mute">选择或添加一台服务器</p>
        )}
        <table className="w-full min-w-[440px] table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-[76px]" />
            <col className="w-[142px]" />
          </colgroup>
          <thead className="sticky top-0 z-1 bg-ink-panel text-mute">
            <tr className="h-9 border-b hair text-left">
              <th className="pl-4 font-normal">
                <Checkbox
                  aria-label={`全选${title}当前目录`}
                  disabled={!entries.length}
                  checked={entries.length > 0 && entries.every(e => selected.includes(join(listing!.path, e.name)))}
                  onCheckedChange={checked => onSelect(checked ? entries.map(e => join(listing!.path, e.name)) : [])}
                />
              </th>
              {(
                [
                  ['name', '名称'],
                  ['size', '大小'],
                  ['modifiedAt', '修改时间']
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}
                  className="font-normal"
                >
                  <button
                    className={`h-9 w-full cursor-pointer pr-3 text-left hover:text-fg ${sort.key === key ? 'text-fg' : ''}`}
                    onClick={() => changeSort(key)}
                  >
                    {label}
                    {sort.key === key ? (sort.descending ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listing && listing.path !== '/' && (
              <tr className="h-9 border-b hair">
                <td colSpan={4}>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2 pl-10 pr-4 text-left text-xs text-mute hover:bg-fg/3 hover:text-fg cursor-pointer"
                    title="返回上一级目录"
                    aria-label={`${title}：返回上一级目录`}
                    onClick={() => navigate(parent(listing.path))}
                  >
                    <Folder size={16} className="pointer-events-none shrink-0 text-warn-text" />
                    <span className="font-mono">..</span>
                  </button>
                </td>
              </tr>
            )}
            {entries.map(e => {
              const path = join(listing!.path, e.name)
              return (
                <tr
                  key={e.name}
                  className={`h-10 border-b hair ${selected.includes(path) ? 'bg-violet/10' : 'hover:bg-fg/3'}`}
                >
                  <td className="pl-4">
                    <Checkbox
                      aria-label={`选择 ${title} ${e.name}`}
                      checked={selected.includes(path)}
                      onCheckedChange={() => toggle(path)}
                    />
                  </td>
                  <td className="pr-3">
                    <button
                      type="button"
                      draggable
                      onDragStart={event => {
                        const paths = selected.includes(path) ? selected : [path]
                        if (!selected.includes(path)) onSelect(paths)
                        event.dataTransfer.effectAllowed = 'copy'
                        event.dataTransfer.setData(FILE_DRAG, JSON.stringify({ side, paths, serverId }))
                        onDragFiles({ side, paths, serverId })
                      }}
                      onDragEnd={onDragFinish}
                      className="flex w-full min-w-0 select-none items-center gap-2 text-left text-[13px] cursor-pointer active:cursor-grabbing"
                      title={path}
                      onClick={() => (e.type === 'dir' ? navigate(path) : toggle(path))}
                    >
                      {e.type === 'dir' ? (
                        <Folder size={16} className="pointer-events-none shrink-0 text-warn-text" />
                      ) : (
                        <FileIcon size={16} className="pointer-events-none shrink-0 text-file-icon" />
                      )}
                      <span className="pointer-events-none min-w-0 truncate">{e.name}</span>
                    </button>
                  </td>
                  <td
                    className="pr-3 tabular-nums text-mute"
                    title={e.size == null ? undefined : `${e.size.toLocaleString()} 字节`}
                  >
                    {e.type === 'dir' || e.size == null ? '—' : formatSize(e.size)}
                  </td>
                  <td className="pr-3 tabular-nums whitespace-nowrap text-mute">{formatModified(e.modifiedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {listing?.truncated && (
          <p className="p-4 text-xs text-mute">仅显示前 {entries.length} 项，可输入路径进入其他目录。</p>
        )}
      </div>
      {dropOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center bg-cyan/10 pb-12">
          <span className="rounded-lg bg-ink-float px-4 py-2 text-sm text-cyan shadow-lg">
            松开以{side === 'remote' ? '上传到' : '拉取到'}当前目录
          </span>
        </div>
      )}
      <div className="flex h-14 shrink-0 items-center gap-2 border-t hair px-3 text-xs">
        <span className="shrink-0 text-mute">常用目录</span>
        <div className="flex h-11 min-w-0 flex-1 items-start gap-1.5 overflow-x-auto overflow-y-hidden pt-1.5">
          {['~', ...favorites.filter(d => d !== '~')].map(dir => (
            <button
              key={dir}
              type="button"
              title={dir}
              onClick={() => navigate(dir)}
              className={`h-7 max-w-[180px] shrink-0 truncate rounded-md border hair-2 px-2 cursor-pointer hover:bg-fg/8 hover:text-fg ${canonical(dir) === listing?.path ? 'bg-violet/10 text-violet-text' : 'text-mute'}`}
            >
              {dir}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!listing || loading}
          aria-label={`${favoritePath !== undefined ? '取消收藏' : '收藏'}${title}当前目录`}
          title={favoritePath !== undefined ? '取消收藏当前目录' : '收藏当前目录'}
          onClick={() => listing && onFavorite(favoritePath ?? listing.path)}
          className={`shrink-0 cursor-pointer rounded-md p-1.5 hover:bg-fg/8 disabled:opacity-40 disabled:cursor-not-allowed ${favoritePath !== undefined ? 'text-warn-text' : 'text-mute'}`}
        >
          <Star size={14} />
        </button>
      </div>
    </section>
  )
}
