import { useId, useState, type ReactNode } from 'react'
import { Close, Plus } from './Icons'
import { Btn, Chip, Field, IconBtn } from './ui'
import { Combobox } from '@/components/ui/combobox'
import { DialogTitle } from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Auth, ServerDraft } from '../types'
import type { FormMode, Status } from '../useConduit'

interface Props {
  mode: FormMode
  draft: ServerDraft
  msg: Status | null
  keychain: boolean
  hosts: string[]
  tags: string[]
  onChange: (patch: Partial<ServerDraft>) => void
  onClose: () => void
  onCheck: () => void
  onSubmit: () => void
}

const HINT: Record<Auth, string> = {
  key: '走 ssh-agent 和 ~/.ssh/config，本工具不碰你的密钥。ProxyJump 等高级配置自动生效。',
  password:
    '密码存进 macOS 钥匙串，不会写进配置文件。首次连接前需要先在终端手动 ssh 一次确认主机指纹 —— ' +
    '自动接受主机密钥等于放弃中间人防护，所以这一步是故意留给你的。'
}

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-[5px]">
      <span className="text-[12px] text-mute-2">{children}</span>
      {hint && <span className="text-[12px] text-mute-4">{hint}</span>}
    </div>
  )
}

export function ServerForm({ mode, draft, msg, keychain, hosts, tags, onChange, onClose, onCheck, onSubmit }: Props) {
  const isNew = mode === 'new'
  const isPw = draft.auth === 'password'
  const hostId = useId()

  const [tagInput, setTagInput] = useState('')
  const allTags = [...new Set([...tags, ...draft.tags])]
  const toggleTag = (t: string) =>
    onChange({ tags: draft.tags.includes(t) ? draft.tags.filter(x => x !== t) : [...draft.tags, t] })
  const commitTag = () => {
    const t = tagInput.trim().replace(/[,，]/g, '')
    setTagInput('')
    if (t && !draft.tags.includes(t)) onChange({ tags: [...draft.tags, t] })
  }

  const setDir = (i: number, v: string) => onChange({ dirs: draft.dirs.map((d, j) => (j === i ? v : d)) })
  const addDir = () => onChange({ dirs: [...draft.dirs, ''] })
  const removeDir = (i: number) =>
    onChange({
      dirs: draft.dirs.length > 1 ? draft.dirs.filter((_, j) => j !== i) : ['']
    })

  return (
    <>
      <div className="flex items-center gap-2 px-[18px] py-4 border-b hair">
        <DialogTitle className="flex-1">{isNew ? '新增服务器' : '编辑服务器'}</DialogTitle>
        <IconBtn onClick={onClose} aria-label="关闭" className="w-7 h-7 rounded-lg">
          <Close size={13} />
        </IconBtn>
      </div>

      <div className="flex flex-col gap-4 p-[18px]">
        <div className="grid grid-cols-[minmax(0,1fr)_84px] gap-[9px]">
          <div className="min-w-0">
            <label htmlFor={hostId} className="block text-[12px] text-mute-2 mb-[5px]">
              主机
            </label>
            <Combobox
              id={hostId}
              options={hosts}
              spellCheck={false}
              placeholder="user@1.2.3.4 或 ssh 别名"
              value={draft.host}
              onValueChange={host => onChange({ host })}
              className="font-mono"
            />
          </div>
          <Field
            label="端口"
            mono
            inputMode="numeric"
            placeholder="22"
            value={draft.port}
            onChange={e => onChange({ port: e.target.value })}
          />
        </div>

        <div>
          <Label hint="推送时作为目标，拉取时作为浏览起点">常用目录</Label>
          <div className="flex flex-col gap-1.5">
            {draft.dirs.map((d, i) => (
              <div key={i} className="relative">
                <input
                  value={d}
                  onChange={e => setDir(i, e.target.value)}
                  spellCheck={false}
                  aria-label={`常用目录 ${i + 1}`}
                  placeholder="/var/www/releases"
                  className="w-full h-9 pl-[11px] pr-10 rounded-[9px] border field-edge sunken font-mono text-[13px] text-fg outline-0 focus:border-[rgba(124,124,245,.7)]"
                />
                {(draft.dirs.length > 1 || d) && (
                  <IconBtn
                    onClick={() => removeDir(i)}
                    danger
                    aria-label={`删掉常用目录 ${d || i + 1}`}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7"
                  >
                    <Close size={12} />
                  </IconBtn>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addDir}
            className="flex items-center gap-1.5 mt-2 p-0 border-0 bg-transparent text-link text-[12px] cursor-pointer hover:underline"
          >
            <Plus size={12} />
            添加目录
          </button>
        </div>

        <div>
          <Label hint="可多选，推送时可按标签一键勾选">标签</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {allTags.map(t => (
              <Chip key={t} active={draft.tags.includes(t)} onClick={() => toggleTag(t)}>
                {draft.tags.includes(t) ? '✓ ' : ''}
                {t}
              </Chip>
            ))}
            <input
              aria-label="新标签"
              value={tagInput}
              maxLength={20}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
                  e.preventDefault()
                  commitTag()
                }
              }}
              onBlur={commitTag}
              placeholder="+ 新标签，回车添加"
              className="h-6 w-36 px-2 rounded-md border border-dashed border-[rgba(255,255,255,.16)] bg-transparent text-[12px] text-fg outline-0 placeholder:text-mute-4 focus:border-[rgba(124,124,245,.7)]"
            />
          </div>
        </div>

        <div>
          <Label>认证方式</Label>
          <ToggleGroup
            type="single"
            aria-label="认证方式"
            value={draft.auth}
            onValueChange={v => {
              if (v) onChange({ auth: v as Auth })
            }}
          >
            <ToggleGroupItem value="key">SSH 密钥（推荐）</ToggleGroupItem>
            <ToggleGroupItem value="password" disabled={!keychain} title={keychain ? undefined : '需要 macOS 钥匙串'}>
              密码{keychain ? '' : '（需 macOS 钥匙串）'}
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="mt-2 mb-0 text-[12px] leading-relaxed text-mute-2">{HINT[draft.auth]}</p>
          {isPw && (
            <div className="mt-3">
              <Field
                label="密码"
                type="password"
                autoComplete="off"
                placeholder={isNew ? '密码' : '留空＝沿用已存的'}
                value={draft.password}
                onChange={e => onChange({ password: e.target.value })}
              />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <Btn variant="primary" onClick={onSubmit} className="flex-1 py-2 text-[13px] font-semibold">
              {isNew ? '添加' : '保存'}
            </Btn>
            <Btn onClick={onCheck} className="px-3.5 py-2 text-[13px]">
              先测一下
            </Btn>
            <Btn onClick={onClose} className="px-3.5 py-2 text-[13px]">
              取消
            </Btn>
          </div>
          {msg && (
            <p
              className="mt-2.5 mb-0 text-[12px] leading-relaxed whitespace-pre-wrap break-words"
              style={{
                color: msg.bad ? 'var(--color-err-text)' : 'var(--color-mute-2)'
              }}
            >
              {msg.text}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
