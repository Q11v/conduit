import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

test('HTTP adapter starts on loopback and serves the task API', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'conduit-adapter-'))
  try {
    const code = `const {start}=await import(${JSON.stringify(pathToFileURL(resolve('server/index.js')).href)});const port=await start(0);const response=await fetch('http://127.0.0.1:'+port+'/api/jobs');const data=await response.json();if(response.status!==200||data.jobs.length!==0)throw new Error('Unexpected response');process.stdout.write('ADAPTER_OK\\n',()=>process.exit(0));`
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], {
      timeout: 10000,
      env: {
        ...process.env,
        CONDUIT_DATA_DIR: directory,
        CONDUIT_CONFIG: join(directory, 'servers.json'),
        CONDUIT_PRESETS: join(directory, 'presets.json'),
        CONDUIT_SETTINGS: join(directory, 'settings.json'),
        CONDUIT_LOG_DIR: join(directory, 'logs'),
        CONDUIT_KEYCHAIN_SERVICE: 'conduit-test'
      }
    })
    assert.match(stdout, /ADAPTER_OK/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
