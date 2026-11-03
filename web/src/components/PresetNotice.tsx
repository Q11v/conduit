export function PresetNotice({ name }: { name?: string }) {
  if (!name) return null

  return (
    <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap mb-3 text-[12px]" role="status">
      <span className="text-violet-text">已载入方案：{name}</span>
      <span className="text-mute-3">修改不会自动保存，可另存为新方案。</span>
    </div>
  )
}
