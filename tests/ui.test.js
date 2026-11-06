import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import { Window } from 'happy-dom'

const window = new Window({ url: 'http://ui-test.invalid' })
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'MutationObserver',
  'ResizeObserver',
  'CustomEvent',
  'getComputedStyle'
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === 'window' ? window : key === 'getComputedStyle' ? window.getComputedStyle.bind(window) : window[key]
  })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { act, createElement: h, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const output = await build({
  logLevel: 'silent',
  build: {
    ssr: resolve('tests/ui-entry.tsx'),
    write: false,
    minify: false,
    rollupOptions: { output: { codeSplitting: false } }
  }
})
const entry = output.output.find(chunk => chunk.type === 'chunk' && chunk.isEntry)
const code = entry.code.replace(/from\s*(['"])([^'"]+)\1/g, (match, quote, specifier) =>
  specifier.startsWith('.') || specifier.startsWith('/')
    ? match
    : `from ${quote}${import.meta.resolve(specifier)}${quote}`
)
const generated = resolve('tests/.generated')
await mkdir(generated, { recursive: true })
const file = resolve(generated, 'components.mjs')
await writeFile(file, code)
const {
  FilePane,
  TaskCenter,
  Workbench,
  useWorkspaceSettings,
  TopBar,
  applyTheme,
  Notifications,
  notify,
  notifyError,
  clearNotices
} = await import(pathToFileURL(file).href)
let root, container
const tick = () => new Promise(resolve => setImmediate(resolve))
const settle = () =>
  act(async () => {
    await tick()
    await tick()
  })
const listing = (
  path,
  entries = [
    { name: 'folder', type: 'dir', size: null },
    { name: 'file.txt', type: 'file', size: 12 }
  ]
) => ({ ok: true, path, entries, select: null, truncated: false })
beforeEach(async () => {
  if (root) await act(async () => root.unmount())
  clearNotices()
  window.document.body.innerHTML = ''
  window.localStorage.clear()
  globalThis.localStorage = window.localStorage
  container = window.document.createElement('div')
  window.document.body.append(container)
  root = createRoot(container)
  window.desktop = {
    platform: 'darwin',
    list: async path => listing(path),
    confirm: async () => false,
    trash: async () => ({ ok: true }),
    pick: async () => null
  }
  globalThis.fetch = async () => {
    throw new Error('Unexpected network access in UI test')
  }
})
after(async () => {
  if (root) await act(async () => root.unmount())
  await window.happyDOM.cancelAsync()
  window.close()
  await rm(generated, { recursive: true, force: true })
})
const render = async element => {
  await act(async () => root.render(element))
  await settle()
}
const click = async element => {
  assert.ok(element)
  await act(async () => element.click())
  await settle()
}
const dragEvent = (type, dataTransfer) => {
  const event = new window.Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  return event
}
const fileButton = text => [...container.querySelectorAll('tbody button')].find(e => e.textContent.trim() === text)
const button = text => [...container.querySelectorAll('button')].find(e => e.textContent.trim() === text)
const basePane = {
  title: '本地',
  location: '/local',
  selected: [],
  onSelect: () => {},
  onLocation: () => {},
  favorites: [],
  onFavorite: () => {},
  refreshToken: '',
  dragSource: null,
  onDragFiles: () => {},
  onDragFinish: () => {},
  onDropFiles: () => {}
}

test('directory names enter on the first click at successive levels and keep drag separate', async () => {
  const visited = [],
    dragged = []
  function Pane() {
    const [path, setPath] = useState('/local')
    return h(FilePane, { ...basePane, location: path, onLocation: setPath, onDragFiles: files => dragged.push(files) })
  }
  window.desktop.list = async path => {
    visited.push(path)
    return listing(path)
  }
  await render(h(Pane))
  await click(fileButton('folder').querySelector('span'))
  assert.equal(visited.at(-1), '/local/folder')
  await click(fileButton('folder').querySelector('span'))
  assert.equal(visited.at(-1), '/local/folder/folder')
  const name = fileButton('folder')
  assert.equal(name.closest('tr').hasAttribute('draggable'), false)
  assert.equal(name.getAttribute('draggable'), 'true')
  const dataTransfer = new window.DataTransfer()
  await act(async () => name.dispatchEvent(dragEvent('dragstart', dataTransfer)))
  assert.deepEqual(dragged[0].paths, ['/local/folder/folder/folder'])
  assert.equal(visited.at(-1), '/local/folder/folder')
})

test('background refresh retains rows and scroll position while the destination is loading', async () => {
  let resolveRefresh
  const props = { ...basePane }
  await render(h(FilePane, props))
  const row = button('file.txt'),
    scroll = container.querySelector('table').parentElement
  scroll.scrollTop = 120
  window.desktop.list = () =>
    new Promise(resolve => {
      resolveRefresh = resolve
    })
  await render(h(FilePane, { ...props, refreshToken: 'completed-pull' }))
  assert.equal(button('file.txt'), row)
  assert.equal(scroll.scrollTop, 120)
  await act(async () => resolveRefresh(listing('/local')))
  assert.equal(scroll.scrollTop, 120)
})

test('cancelled delete confirmation never calls the trash bridge', async () => {
  let trashCalls = 0
  window.desktop.trash = async () => {
    trashCalls++
    return { ok: true, deleted: ['/local/file.txt'] }
  }
  await render(h(FilePane, { ...basePane, selected: ['/local/file.txt'] }))
  await click(button('删除所选 (1)'))
  assert.equal(trashCalls, 0)
  window.desktop.confirm = async () => true
  await click(button('删除所选 (1)'))
  assert.equal(trashCalls, 1)
})

test('completed tasks default to a compact bar and the main task-center button opens history', async () => {
  const job = {
    id: 'j',
    kind: 'push',
    sourceName: 'release.tar.gz',
    done: true,
    revision: 1,
    targets: [{ key: 't', status: 'done', label: 'host', dir: '/app' }]
  }
  await render(
    h(TaskCenter, {
      jobs: [job],
      pending: new Set(),
      parallel: 4,
      onDismiss: () => {},
      onCancel: () => {},
      onRetry: () => {},
      onReveal: () => {}
    })
  )
  assert.equal(container.textContent.includes('release.tar.gz'), false)
  await click(container.querySelector('[aria-controls="transfer-tasks"]'))
  assert.equal(container.textContent.includes('release.tar.gz'), true)
  assert.equal(container.querySelector('[aria-controls="transfer-tasks"]').getAttribute('aria-expanded'), 'true')
})

test('bookmark switches both locations and dragging submits only the chosen local files', async () => {
  const patches = [],
    pushes = [],
    selectedServers = []
  const server = { id: 's', name: 'host', host: 'fixture.invalid', dirs: [], tags: [], auth: 'key' }
  const c = {
    jobs: [],
    loaded: true,
    servers: [server],
    pullServer: server,
    hosts: { home: '/home/test' },
    statusText: { bad: false },
    pullStatusText: { bad: false },
    preferences: {
      settings: {
        bookmarks: [{ id: 'b', name: 'project', local: '/project', remote: '/srv/project', serverId: 's' }],
        localFavorites: [],
        localDirectory: '/local',
        remoteDirectory: '/remote'
      },
      update: async patch => {
        patches.push(patch)
      }
    },
    choosePullServer: id => selectedServers.push(id),
    runPush: async (...args) => pushes.push(args),
    runPull: async () => {},
    pinPath: () => {},
    unpinPath: () => {}
  }
  globalThis.fetch = async (_url, opts) => ({
    ok: true,
    text: async () => JSON.stringify(listing(JSON.parse(opts.body).path))
  })
  await render(h(Workbench, { c, onManage: () => {} }))
  await click(button('project'))
  assert.deepEqual(selectedServers, ['s'])
  assert.ok(patches.some(p => p.localDirectory === '/project'))
  assert.ok(patches.some(p => p.remoteDirectory === '/srv/project'))
  const local = [...container.querySelectorAll('section')][0],
    remote = [...container.querySelectorAll('section')][1]
  const file = [...local.querySelectorAll('button')].find(e => e.textContent === 'file.txt')
  const dataTransfer = new window.DataTransfer()
  await act(async () => file.dispatchEvent(dragEvent('dragstart', dataTransfer)))
  await settle()
  await act(async () => remote.dispatchEvent(dragEvent('drop', dataTransfer)))
  await settle()
  assert.deepEqual(pushes, [['/project/file.txt', [{ serverId: 's', dir: '/srv/project' }]]])
})

test('workspace settings migrate valid legacy data and serialize rapid updates', async () => {
  const bookmark = { id: 'b', name: 'legacy', local: '/local', remote: '/remote', serverId: 's' }
  window.localStorage.setItem('conduit.bookmarks', JSON.stringify([null, bookmark]))
  window.localStorage.setItem('conduit.local-favorites', JSON.stringify(['/tmp', null]))
  const calls = []
  let release,
    settings = {
      bookmarks: [],
      localFavorites: [],
      localDirectory: '/local',
      remoteDirectory: '/remote',
      remoteServerId: '',
      view: 'workbench',
      legacyImported: true
    }
  let migrated
  window.desktop.settings = {
    get: async legacy => {
      migrated = legacy
      settings = { ...settings, ...legacy }
      return { ok: true, settings }
    },
    update: async patch => {
      calls.push(patch)
      if (calls.length === 1)
        await new Promise(resolve => {
          release = resolve
        })
      settings = { ...settings, ...patch }
      return { ok: true, settings }
    }
  }
  let preferences
  function Settings() {
    preferences = useWorkspaceSettings()
    return h('div', null, preferences.settings?.view)
  }
  await render(h(Settings))
  assert.deepEqual(migrated.bookmarks, [bookmark])
  assert.deepEqual(migrated.localFavorites, ['/tmp'])
  let first, second
  await act(async () => {
    first = preferences.update({ localDirectory: '/new' })
    second = preferences.update({ view: 'plans' })
    await tick()
  })
  assert.equal(calls.length, 1)
  await act(async () => {
    release()
    await Promise.all([first, second])
  })
  assert.equal(preferences.settings.localDirectory, '/new')
  assert.equal(preferences.settings.view, 'plans')
  assert.equal(window.localStorage.getItem('conduit.bookmarks'), JSON.stringify([null, bookmark]))
})

test('theme control switches both directions and applies the document color scheme', async () => {
  function Header() {
    const [theme, setTheme] = useState('dark')
    return h(TopBar, {
      view: 'workbench',
      onView: () => {},
      hosts: null,
      theme,
      onTheme: next => {
        setTheme(next)
        applyTheme(next)
      }
    })
  }
  await render(h(Header))
  await click(container.querySelector('[aria-label="切换到日间模式"]'))
  assert.equal(window.document.documentElement.dataset.theme, 'light')
  assert.equal(window.document.documentElement.style.colorScheme, 'light')
  await click(container.querySelector('[aria-label="切换到夜间模式"]'))
  assert.equal(window.document.documentElement.dataset.theme, 'dark')
})

test('header keeps the brand separate and gives every utility action an icon and label', async () => {
  await render(
    h(TopBar, {
      view: 'workbench',
      onView: () => {},
      theme: 'light',
      onTheme: () => {},
      hosts: {
        configPath: '/fixture/servers.json',
        presetsPath: '/fixture/presets.json',
        settingsPath: '/fixture/settings.json',
        home: '/fixture'
      }
    })
  )
  const nav = container.querySelector('[aria-label="主导航"]')
  assert.equal(nav.textContent.includes('Conduit'), false)
  for (const name of ['活动记录', '夜间', '配置文件', 'GitHub']) {
    const action = [...container.querySelectorAll('button,a')].find(e => e.textContent.trim() === name)
    assert.ok(action, name)
    assert.ok(action.querySelector('svg'), `${name} icon`)
    assert.equal(action.querySelector('span')?.className.includes('hidden') ?? false, false)
  }
})

test('toast errors are deduplicated, dismissible, and can appear again after retry', async () => {
  await render(h(Notifications))
  await act(async () => {
    notifyError('上传失败')
    notifyError('上传失败')
  })
  assert.equal(container.querySelectorAll('[role="alert"]').length, 1)
  assert.ok(container.querySelector('aside').className.includes('fixed'))
  await click(container.querySelector('[aria-label="关闭提示"]'))
  assert.equal(container.querySelectorAll('[role="alert"]').length, 0)
  await act(async () => notifyError('上传失败'))
  assert.equal(container.querySelectorAll('[role="alert"]').length, 1)
  await act(async () => notify('已复制'))
  assert.equal(container.querySelectorAll('[role="status"]').length, 1)
})
