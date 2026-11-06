// Electron workArea excludes the menu bar and Dock and may have a negative origin.
export function initialWindowBounds(area) {
  const margin = Math.min(24, Math.floor(Math.min(area.width, area.height) / 40))
  const width = Math.min(1440, Math.max(1000, Math.round(area.width * 0.9)), area.width - margin * 2)
  const height = Math.min(1100, area.height - margin * 2)
  return {
    width,
    height,
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    minWidth: Math.min(760, width),
    minHeight: Math.min(560, height)
  }
}
