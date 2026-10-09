import { useCallback } from 'react'
import { TopBar } from './components/TopBar'
import { Footer } from './components/Footer'
import { PushCard } from './components/PushCard'
import { PushProgress } from './components/PushProgress'
import { PresetGrid } from './components/PresetGrid'
import { PullView } from './components/PullView'
import { ActivityView } from './components/ActivityView'
import { ServersView } from './components/ServersView'
import { ServerFormModal } from './components/ServerFormModal'
import { SavePresetModal } from './components/SavePresetModal'
import { Hero } from './components/Hero'
import { useConduit } from './useConduit'

export default function App() {
  const c = useConduit()

  const pushName = c.src.split('/').filter(Boolean).pop() || ''
  const pushLabels = [...c.selected.map(t => `${t.server.name}:${t.dir}`), ...c.adhocTargets]
  const save =
    c.saveKind === 'pull'
      ? {
          placeholder: c.pullServer ? `从 ${c.pullServer.name} 拉取` : '新方案',
          primary: c.pullPaths.length ? c.pullPaths.join('\n') : '未选路径',
          secondary: `${c.pullServer?.name ?? '未选服务器'} → 本地 ${c.pullDir.trim() || '（未填）'}`,
          blocked:
            !c.pullServer || c.pullPaths.length === 0
              ? '先勾选至少一个远端路径再保存。'
              : !c.pullDir.trim()
                ? '先填本地目录再保存。'
                : null
        }
      : {
          placeholder: pushName || '新方案',
          primary: c.relink ? '每次推送前选择来源' : c.src.trim() || '未选择来源',
          secondary: pushLabels.length ? pushLabels.join('、') : '未选目标',
          blocked: pushLabels.length === 0 ? '先勾选至少一个目标再保存。' : null
        }

  const removeAdhoc = useCallback(
    (spec: string) => {
      c.setAdhoc(
        c.adhoc
          .split('\n')
          .filter(l => l.trim() !== spec)
          .join('\n')
      )
    },
    [c.adhoc, c.setAdhoc]
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-ink overflow-x-hidden">
      <div
        className="absolute -top-[220px] left-1/2 -translate-x-1/2 w-[1100px] h-[520px] pointer-events-none"
        style={{
          background: 'radial-gradient(closest-side,rgba(102,76,220,.5),rgba(102,76,220,0))'
        }}
      />

      <TopBar view={c.view} onView={c.setView} />

      <div className="relative flex-1 w-full max-w-[1000px] mx-auto px-5 pt-11 pb-16">
        {c.view === 'push' && (
          <div>
            <Hero
              eyebrow="local-first deploy"
              title="一次推送到多台服务器"
              desc="选一个本地文件或目录，勾好目标，剩下的交给 SSH。密钥与配置只留在本机。"
              path={c.hosts?.presetsPath ?? ''}
              home={c.hosts?.home ?? ''}
            />
            <PushCard
              src={c.src}
              size={c.size}
              staging={c.staging}
              onSrc={c.setSrc}
              onFile={c.pickFile}
              selected={c.selected}
              adhocTargets={c.adhocTargets}
              totalTargets={c.totalTargets}
              probeOf={c.probeOf}
              onToggle={c.toggleByKey}
              onRemoveAdhoc={removeAdhoc}
              servers={c.servers}
              tags={c.tags}
              sel={c.sel}
              onToggleDir={c.toggle}
              onToggleTag={c.toggleTag}
              onAddPath={c.addPath}
              onPinPath={c.pinPath}
              adhoc={c.adhoc}
              onAdhoc={c.setAdhoc}
              onGoServers={() => c.setView('servers')}
              status={c.statusText}
              ready={c.ready && c.busy === null}
              busy={c.busy === 'push'}
              verify={c.verify}
              onToggleVerify={c.toggleVerify}
              onPush={c.push}
              onSave={() => c.openSave('push')}
            />
            <PresetGrid
              kind="push"
              loaded={c.loaded}
              presets={c.pushPresets}
              servers={c.servers}
              applied={c.appliedPreset}
              onApply={c.applyPreset}
              onDelete={c.removePreset}
            />
          </div>
        )}

        {c.view === 'pull' && (
          <PullView
            loaded={c.loaded}
            servers={c.servers}
            server={c.pullServer}
            probeOf={c.probeOf}
            onServer={c.choosePullServer}
            paths={c.pullPaths}
            onTogglePath={c.togglePullPath}
            localDir={c.pullDir}
            onLocalDir={c.setPullDir}
            status={c.pullStatusText}
            ready={c.pullReady && c.busy === null}
            busy={c.busy === 'pull'}
            onPull={c.pull}
            onSave={() => c.openSave('pull')}
            onGoServers={() => c.setView('servers')}
            presetsPath={c.hosts?.presetsPath ?? ''}
            home={c.hosts?.home ?? ''}
          />
        )}
        {c.view === 'pull' && c.loaded && (
          <PresetGrid
            kind="pull"
            loaded={c.loaded}
            presets={c.pullPresets}
            servers={c.servers}
            applied={c.appliedPullPreset}
            onApply={c.applyPullPreset}
            onDelete={c.removePreset}
          />
        )}

        {c.view === 'servers' && (
          <ServersView
            loaded={c.loaded}
            servers={c.servers}
            tags={c.tags}
            totalTargets={c.totalTargets}
            checks={c.checks}
            probeOf={c.probeOf}
            configPath={c.hosts?.configPath ?? ''}
            home={c.hosts?.home ?? ''}
            onCheck={c.check}
            onCheckAll={c.checkAll}
            onEdit={c.openEdit}
            onRemove={c.remove}
            onNew={c.openNew}
          />
        )}

        {c.view === 'log' && (
          <ActivityView events={c.activity} failedOnly={c.failedOnly} onFailedOnly={c.setFailedOnly} />
        )}
      </div>

      <Footer />

      {c.job && (
        <PushProgress
          job={c.job}
          onDismiss={c.dismissJob}
          onCancel={c.cancelJob}
          onRetry={c.retry}
          onReveal={c.job.kind === 'pull' && c.hosts?.reveal ? c.revealJob : undefined}
        />
      )}

      <SavePresetModal
        open={c.saveOpen}
        name={c.presetName}
        {...save}
        relink={c.relink}
        onToggleRelink={c.saveKind === 'push' ? c.toggleRelink : undefined}
        msg={c.saveMsg}
        onName={c.setPresetName}
        onSave={c.savePreset}
        onClose={c.closeSave}
      />

      <ServerFormModal
        mode={c.form}
        draft={c.draft}
        msg={c.formMsg}
        keychain={c.hosts?.keychain ?? true}
        hosts={c.hosts?.hosts ?? []}
        tags={c.tags}
        onChange={c.patchDraft}
        onClose={c.closeForm}
        onCheck={c.checkForm}
        onSubmit={c.submitForm}
      />
    </div>
  )
}
