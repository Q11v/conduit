interface Props {
  size?: number
  className?: string
}

const stroke = (w = 1.8) => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
})

export const Logo = ({ size = 15 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    <path d="M96.77 90.86A48 48 0 1 1 96.77 29.14L79.92 43.28A26 26 0 1 0 79.92 76.72Z" fill="#fff" />
  </svg>
)

export const Servers = ({ size = 14 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.7)}>
    <rect x="2.5" y="3.5" width="19" height="7" rx="2" />
    <rect x="2.5" y="13.5" width="19" height="7" rx="2" />
    <path d="M6.5 7h.01M6.5 17h.01" />
  </svg>
)

export const FileIcon = ({ size = 15, className }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...stroke()}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
    <path d="M14 3v6h6" />
  </svg>
)

export const Upload = ({ size = 15, className }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...stroke(1.7)}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
)

export const Close = ({ size = 15 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2.1)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const Zap = ({ size = 13 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke()}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
)

export const Pencil = ({ size = 13 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke()}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

export const Trash = ({ size = 13 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke()}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
)

export const Plus = ({ size = 15 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2.1)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const Check = ({ size = 11 }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth={3.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const ArrowUp = ({ size = 15 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2.1)}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
)

export const Chevron = ({ size = 13, className }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...stroke(2)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
)

export const Doc = ({ size = 14 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke()}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M8 3v5h7" />
  </svg>
)

export const List = ({ size = 13 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke()}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
)

export const ArrowDown = ({ size = 15 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2.1)}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
)

export const Folder = ({ size = 14, className }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...stroke(1.7)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
)

export const Copy = ({ size = 13 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke()}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
)

export const Key = ({ size = 14 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.7)}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2" />
  </svg>
)

export const Terminal = ({ size = 14 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.7)}>
    <path d="m5 8 4 4-4 4M12 16h7" />
    <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
  </svg>
)

export const Gauge = ({ size = 14 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.7)}>
    <path d="M3.5 17a9 9 0 1 1 17 0" />
    <path d="m12 14 4-5" />
  </svg>
)

export const Github = ({ size = 14 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85l-.01 2.75c0 .26.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>
)

export const More = ({ size = 15, className }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
)
