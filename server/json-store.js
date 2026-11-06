import { readFile, writeFile, mkdir, rename, unlink, copyFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

let pending = Promise.resolve()
export function withDataLock(operation) {
  const result = pending.then(operation)
  pending = result.catch(() => {})
  return result
}

export async function readJson(file, validate, fallback) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return structuredClone(fallback)
    throw err
  }
  try {
    const value = JSON.parse(text)
    if (!validate(value)) throw new Error('数据格式不正确')
    return value
  } catch (err) {
    throw new Error(
      `无法读取配置 ${file}：${err.message}。原文件已保留，可从顶部「配置文件」修复自动备份或导入备份。`,
      { cause: err }
    )
  }
}

export async function atomicWrite(file, text) {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, text, { mode: 0o600 })
    await rename(temporary, file)
  } finally {
    await unlink(temporary).catch(() => {})
  }
}

export async function writeJson(file, value, validate) {
  if (!validate(value)) throw new Error('配置格式不正确')
  // Validate the existing file before replacing it or its last usable backup.
  await readJson(file, validate, value)
  try {
    await atomicWrite(`${file}.bak`, await readFile(file, 'utf8'))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  await atomicWrite(file, JSON.stringify(value, null, 2) + '\n')
}

export async function replaceFiles(entries) {
  const originals = []
  const suffix = `.before-restore-${Date.now()}-${randomUUID()}`
  for (const [file] of entries) {
    try {
      const text = await readFile(file, 'utf8')
      await copyFile(file, file + suffix)
      originals.push([file, text])
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      originals.push([file, null])
    }
  }
  try {
    for (const [file, value] of entries) await atomicWrite(file, JSON.stringify(value, null, 2) + '\n')
  } catch (err) {
    for (const [file, text] of originals) {
      if (text === null) await unlink(file).catch(() => {})
      else await atomicWrite(file, text)
    }
    throw err
  }
}
