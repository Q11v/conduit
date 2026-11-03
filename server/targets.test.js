import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sshEndpoint } from './targets.js'

test('SSH aliases and explicit addresses share a target lock, including configured ports', () => {
  const config = 'Host production\n  HostName 192.0.2.1\n  Port 2222\n'
  assert.equal(sshEndpoint('root@production', undefined, config), sshEndpoint('deploy@192.0.2.1', 2222, config))
  assert.notEqual(sshEndpoint('production', 22, config), sshEndpoint('production', undefined, config))
  assert.equal(sshEndpoint('ROOT@EXAMPLE.COM', undefined, ''), 'example.com:22')
})
