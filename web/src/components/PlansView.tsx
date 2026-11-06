import { useState } from 'react'
import { Btn as BaseBtn } from './ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { updatePreset, why } from '../api'
import type { Preset } from '../types'
import type { useConduit } from '../useConduit'

function Btn({ className = '', ...props }: React.ComponentProps<typeof BaseBtn>) {
  return (
    <BaseBtn {...props} className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs ${className}`} />
  )
}

type Controller = ReturnType<typeof useConduit>
const field = 'w-full rounded-lg border field-edge sunken p-2 text-[13px] text-fg outline-none focus:border-violet'

export function PlansView({ c }: { c: Controller }) {
  const [filter, setFilter] = useState<'all' | 'push' | 'pull'>('all')
  const [draft, setDraft] = useState<Preset | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const list = c.presets.filter(p => filter === 'all' || p.kind === filter)
  const serverName = (id: string) => c.servers.find(s => s.id === id)?.name ?? '服务器已删除'
  const save = async () => {
    if (!draft || saving) return
    setSaving(true)
    try {
      const result = await updatePreset(draft.id, draft)
      if (!result.ok) {
        setMessage(why(result))
        return
      }
      await c.reloadPresets()
      setDraft(null)
    } catch (e) {
      setMessage(String(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold">方案</h1>
          <p className="mt-1.5 text-[13px] text-mute">保存常用传输，直接执行或编辑。</p>
        </div>
        <Btn onClick={() => c.setView('workbench')}>去工作台创建</Btn>
      </div>
      <div className="mb-4 flex gap-2">
        {(['all', 'push', 'pull'] as const).map(v => (
          <Btn key={v} onClick={() => setFilter(v)} className={filter === v ? 'bg-white/10 text-fg' : ''}>
            {v === 'all' ? '全部' : v === 'push' ? '上传' : '拉取'}
          </Btn>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border hair-2 panel">
        {!c.loaded && <p className="p-8 text-center text-sm text-mute">载入中…</p>}
        {c.loaded && !list.length && (
          <div className="p-10 text-center text-sm text-mute">暂无方案。在工作台选择文件和位置后，存为方案。</div>
        )}
        {list.map(p => (
          <article key={p.id} className="flex flex-wrap items-center gap-4 border-b hair p-5 last:border-b-0">
            <span
              className={`rounded-md px-2 py-1 text-xs ${p.kind === 'push' ? 'bg-violet/10 text-violet-text' : 'bg-cyan/10 text-cyan'}`}
            >
              {p.kind === 'push' ? '↑ 上传' : '↓ 拉取'}
            </span>
            <div className="min-w-0 flex-1 basis-[350px]">
              <h2 className="m-0 mb-1 text-sm font-semibold">{p.name}</h2>
              <p className="text-xs text-mute break-all">
                {p.kind === 'push'
                  ? `${p.src || '执行时选择来源'} → ${[...p.targets.map(t => `${serverName(t.serverId)}：${t.dir || '默认目录'}`), ...p.adhoc].join('、')}`
                  : `${serverName(p.serverId)}：${p.paths.join('、')} → ${p.localDir}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Btn
                onClick={() => {
                  setDraft(structuredClone(p))
                  setMessage('')
                }}
              >
                编辑
              </Btn>
              <Btn
                variant={p.kind === 'push' ? 'primary' : 'cyan'}
                disabled={c.busyPresets.has(p.id)}
                onClick={() => {
                  void (p.kind === 'push' ? c.applyPreset(p, true) : c.applyPullPreset(p, true))
                }}
              >
                {c.busyPresets.has(p.id) ? '执行中…' : p.kind === 'push' ? '上传' : '拉取'}
              </Btn>
              <Btn onClick={() => void c.removePreset(p.id)} className="text-mute">
                删除
              </Btn>
            </div>
          </article>
        ))}
      </div>
      <p role="status" className="mt-3 text-xs text-mute">
        {c.statusText.bad ? c.statusText.text : c.pullStatusText.bad ? c.pullStatusText.text : ''}
      </p>
      <Dialog
        open={draft !== null}
        onOpenChange={open => {
          if (!open) setDraft(null)
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>编辑方案</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4 p-5"
              onSubmit={e => {
                e.preventDefault()
                void save()
              }}
            >
              <label className="block space-y-1 text-xs text-mute">
                <span>名称</span>
                <input
                  required
                  className={field}
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              {draft.kind === 'push' ? (
                <>
                  <label className="block space-y-1 text-xs text-mute">
                    <span>本地文件或目录（留空则每次选择）</span>
                    <input
                      className={`${field} font-mono`}
                      value={draft.src}
                      onChange={e => setDraft({ ...draft, src: e.target.value })}
                    />
                  </label>
                  <div className="space-y-2 text-xs text-mute">
                    <span>目标服务器和目录</span>
                    {draft.targets.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <select
                          aria-label={`目标服务器 ${i + 1}`}
                          className={`${field} flex-1`}
                          value={t.serverId}
                          onChange={e =>
                            setDraft({
                              ...draft,
                              targets: draft.targets.map((v, j) => (j === i ? { ...v, serverId: e.target.value } : v))
                            })
                          }
                        >
                          {!c.servers.some(s => s.id === t.serverId) && (
                            <option value={t.serverId}>服务器已删除</option>
                          )}
                          {c.servers.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label={`目标目录 ${i + 1}`}
                          placeholder="默认目录"
                          className={`${field} flex-1 font-mono`}
                          value={t.dir ?? ''}
                          onChange={e =>
                            setDraft({
                              ...draft,
                              targets: draft.targets.map((v, j) =>
                                j === i ? { ...v, dir: e.target.value || null } : v
                              )
                            })
                          }
                        />
                        <Btn
                          type="button"
                          aria-label={`移除目标 ${i + 1}`}
                          onClick={() => setDraft({ ...draft, targets: draft.targets.filter((_, j) => j !== i) })}
                        >
                          ×
                        </Btn>
                      </div>
                    ))}
                    <Btn
                      type="button"
                      disabled={!c.servers.length}
                      onClick={() =>
                        setDraft({ ...draft, targets: [...draft.targets, { serverId: c.servers[0].id, dir: null }] })
                      }
                    >
                      添加目标
                    </Btn>
                  </div>
                  {draft.adhoc.length > 0 && (
                    <label className="block space-y-1 text-xs text-mute">
                      <span>其他 SSH 目标（每行一个）</span>
                      <textarea
                        className={`${field} font-mono`}
                        value={draft.adhoc.join('\n')}
                        onChange={e => setDraft({ ...draft, adhoc: e.target.value.split('\n') })}
                      />
                    </label>
                  )}
                </>
              ) : (
                <>
                  <label className="block space-y-1 text-xs text-mute">
                    <span>服务器</span>
                    <select
                      className={field}
                      value={draft.serverId}
                      onChange={e => setDraft({ ...draft, serverId: e.target.value })}
                    >
                      {!c.servers.some(s => s.id === draft.serverId) && (
                        <option value={draft.serverId}>服务器已删除</option>
                      )}
                      {c.servers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1 text-xs text-mute">
                    <span>远端文件或目录（每行一个）</span>
                    <textarea
                      required
                      rows={4}
                      className={`${field} font-mono`}
                      value={draft.paths.join('\n')}
                      onChange={e => setDraft({ ...draft, paths: e.target.value.split('\n') })}
                    />
                  </label>
                  <label className="block space-y-1 text-xs text-mute">
                    <span>保存到本地目录</span>
                    <input
                      required
                      className={`${field} font-mono`}
                      value={draft.localDir}
                      onChange={e => setDraft({ ...draft, localDir: e.target.value })}
                    />
                  </label>
                </>
              )}
              {message && (
                <p role="alert" className="text-xs text-err-text">
                  {message}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Btn type="button" onClick={() => setDraft(null)}>
                  取消
                </Btn>
                <Btn type="submit" variant="primary" disabled={saving}>
                  {saving ? '保存中…' : '保存修改'}
                </Btn>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
