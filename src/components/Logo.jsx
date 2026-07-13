/*
 * Temporary placeholder branding — no custom mark. The wordmark is plain
 * "ShowUp" text in coral; the small tile is a coral square with a white S
 * (matches the favicon). The real logo will be designed separately and
 * dropped in here later.
 */
export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="104" fill="#E8553E" />
      <text
        x="256"
        y="256"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="320"
        fontWeight="bold"
        fill="#FFFFFF"
      >
        S
      </text>
    </svg>
  )
}

export default function Logo({ markClassName = 'h-9 w-9', textClassName = 'text-xl' }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={markClassName} />
      <span className={`font-extrabold tracking-tight ${textClassName}`} style={{ color: '#E8553E' }}>
        ShowUp
      </span>
    </span>
  )
}
