import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const css = await readFile(new URL('../web/src/index.css', import.meta.url), 'utf8')
const light = css.match(/html\[data-theme=['"]light['"]\]\s*\{([^}]+)\}/)[1]
const colors = Object.fromEntries([...light.matchAll(/(--color-[\w-]+):\s*(#[0-9a-f]{6})/g)].map(m => [m[1], m[2]]))
const luminance = hex => {
  const rgb = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(n => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
const ratio = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('day-mode small text and state labels retain readable contrast', () => {
  for (const name of [
    'fg',
    'fg-soft',
    'fg-dim',
    'mute',
    'mute-2',
    'mute-3',
    'mute-4',
    'mute-5',
    'violet-text',
    'link',
    'ok-text',
    'warn-text',
    'err-text'
  ]) {
    for (const background of ['ink', 'ink-panel'])
      assert.ok(ratio(colors[`--color-${name}`], colors[`--color-${background}`]) >= 4.5, `${name} on ${background}`)
  }
  assert.ok(ratio('#ffffff', colors['--color-violet-btn']) >= 4.5)
  assert.ok(ratio(colors['--color-cyan-ink'], colors['--color-cyan']) >= 4.5)
})
