import { spawn } from 'node:child_process'

const SERVICE = 'conduit'
export const keychainAvailable = process.platform === 'darwin'

function exec(args, stdin) {
  return new Promise(resolve => {
    const child = spawn('security', args)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => {
      stdout += d
    })
    child.stderr.on('data', d => {
      stderr += d
    })
    child.on('error', e => resolve({ code: -1, stdout, stderr: e.message }))
    child.on('close', code => resolve({ code, stdout, stderr }))
    child.stdin.end(stdin ?? '')
  })
}

export async function setPassword(account, password) {
  if (!keychainAvailable) throw new Error('密码存储目前只支持 macOS 钥匙串')
  const hex = Buffer.concat([Buffer.from([0]), Buffer.from(password, 'utf8')]).toString('hex')
  const cmd = `add-generic-password -s ${SERVICE} -a ${account} -X ${hex} -U\n`
  const { code, stderr } = await exec(['-i'], cmd)
  if (code !== 0) throw new Error(`写入钥匙串失败: ${stderr.trim().split('\n')[0]}`)
}

export async function getPassword(account) {
  if (!keychainAvailable) return null
  const { code, stderr } = await exec(['find-generic-password', '-s', SERVICE, '-a', account, '-g'])
  if (code !== 0) return null
  const m = /^password: 0x([0-9A-Fa-f]+)/m.exec(stderr)
  if (!m) return null
  return Buffer.from(m[1], 'hex').subarray(1).toString('utf8')
}

export async function deletePassword(account) {
  if (!keychainAvailable) return
  await exec(['delete-generic-password', '-s', SERVICE, '-a', account])
}
