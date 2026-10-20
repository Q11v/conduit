const { createHash } = require('node:crypto')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const LC_UUID = 0x1b
const MH_MAGIC_64 = 0xfeedfacf
const FAT_MAGIC = 0xcafebabe

function patchSlice(buf, offset, seed) {
  if (buf.readUInt32LE(offset) !== MH_MAGIC_64) throw new Error('不是 64 位 Mach-O')
  const cputype = buf.readUInt32LE(offset + 4)
  const ncmds = buf.readUInt32LE(offset + 16)
  let p = offset + 32
  for (let i = 0; i < ncmds; i++) {
    const cmd = buf.readUInt32LE(p)
    const size = buf.readUInt32LE(p + 4)
    if (cmd === LC_UUID) {
      const uuid = createHash('sha256').update(`${seed}:${cputype}`).digest().subarray(0, 16)
      uuid[6] = (uuid[6] & 0x0f) | 0x50
      uuid[8] = (uuid[8] & 0x3f) | 0x80
      uuid.copy(buf, p + 8)
      return
    }
    p += size
  }
  throw new Error('找不到 LC_UUID')
}

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'darwin') return
  const { productFilename, id } = ctx.packager.appInfo
  const exe = join(ctx.appOutDir, `${productFilename}.app`, 'Contents', 'MacOS', productFilename)
  const buf = readFileSync(exe)
  const seed = id || productFilename
  if (buf.readUInt32BE(0) === FAT_MAGIC) {
    const n = buf.readUInt32BE(4)
    for (let i = 0; i < n; i++) patchSlice(buf, buf.readUInt32BE(8 + i * 20 + 8), seed)
  } else {
    patchSlice(buf, 0, seed)
  }
  writeFileSync(exe, buf)
}
