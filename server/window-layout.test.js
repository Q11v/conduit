import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialWindowBounds } from '../electron/window-layout.js'

test('initial window uses available height instead of a fixed 860px', () => {
  const small = initialWindowBounds({ x: 0, y: 25, width: 1440, height: 875 })
  const large = initialWindowBounds({ x: 0, y: 25, width: 1920, height: 1200 })
  assert.ok(large.height > 860)
  assert.ok(large.height > small.height)
  assert.ok(large.height <= 1100)
})

test('window remains within the work area on small and secondary displays', () => {
  for (const area of [
    { x: 0, y: 25, width: 1280, height: 695 },
    { x: -1920, y: 30, width: 1920, height: 1050 },
    { x: 0, y: 0, width: 700, height: 480 }
  ]) {
    const bounds = initialWindowBounds(area)
    assert.ok(bounds.x >= area.x && bounds.y >= area.y)
    assert.ok(bounds.x + bounds.width <= area.x + area.width)
    assert.ok(bounds.y + bounds.height <= area.y + area.height)
    assert.ok(bounds.minWidth <= bounds.width && bounds.minHeight <= bounds.height)
  }
})
