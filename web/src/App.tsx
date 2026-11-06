import { useEffect, useState } from 'react'
import { TopBar } from './components/TopBar'
import { TaskCenter } from './components/TaskCenter'
import { Workbench } from './components/Workbench'
import { PlansView } from './components/PlansView'
import { ActivityView } from './components/ActivityView'
import { ServersView } from './components/ServersView'
import { ServerFormModal } from './components/ServerFormModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog'
import { useConduit } from './useConduit'

export default function App() {
  const c = useConduit()
  const { setView } = c
  const [manage, setManage] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const modifier = window.desktop?.platform === 'darwin' ? e.metaKey : e.ctrlKey
      if (!modifier || e.altKey || e.shiftKey || e.repeat || document.querySelector('[role="dialog"]')) return
      const view = ({ '1': 'workbench', '2': 'plans' } as const)[e.key as '1' | '2']
      if (!view) return
      e.preventDefault()
      setView(view)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setView])

  return (
    <div className="relative flex h-dvh min-h-0 flex-col bg-ink overflow-hidden">
      <TopBar view={c.view} onView={c.setView} hosts={c.hosts} />
      <main className="relative min-h-0 flex-1 w-full max-w-[1400px] mx-auto overflow-y-auto px-6 pt-7 pb-6">
        {/* Keep the workbench mounted so switching pages preserves both directory positions. */}
        <div hidden={c.view !== 'workbench'}>
          <Workbench c={c} onManage={() => setManage(true)} />
        </div>
        {c.view === 'plans' && <PlansView c={c} />}
        {c.view === 'log' && (
          <ActivityView
            events={c.activity}
            failedOnly={c.failedOnly}
            onFailedOnly={c.setFailedOnly}
            logFile={c.hosts?.logFile ?? ''}
          />
        )}
      </main>
      <TaskCenter
        jobs={c.jobs}
        pending={c.pendingTasks}
        parallel={c.hosts?.parallel ?? 4}
        onDismiss={c.dismissJob}
        onCancel={c.cancelJob}
        onRetry={c.retry}
        onReveal={c.revealJob}
      />
      <Dialog open={manage} onOpenChange={setManage}>
        <DialogContent aria-describedby={undefined} side="right" className="flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>管理服务器</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <ServersView
              compact
              loaded={c.loaded}
              servers={c.servers}
              tags={c.tags}
              checks={c.checks}
              probeOf={c.probeOf}
              onCheck={c.check}
              onCheckAll={c.checkAll}
              onEdit={c.openEdit}
              onRemove={c.remove}
              onNew={c.openNew}
              onReorder={c.reorderServers}
            />
          </div>
        </DialogContent>
      </Dialog>
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
