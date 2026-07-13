/*
 * ShowUp brand mark: a thin cursive S — one continuous pen stroke with wide
 * open bowls — whose upper-left terminal carries a solid filled triangle
 * pointing left. Color versions for print/social live in design/logo-*.svg;
 * this component renders the coral version on the dark brand tile.
 */
export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="104" fill="#0a0a16" />
      <path
        d="M 396 108 C 340 34, 172 30, 132 120 C 100 196, 196 226, 256 256 C 316 286, 412 318, 380 394 C 340 484, 172 480, 116 406"
        fill="none"
        stroke="#E8553E"
        strokeWidth="30"
        strokeLinecap="round"
      />
      <polygon points="146,92 158,200 34,152" fill="#E8553E" />
    </svg>
  )
}

export default function Logo({ markClassName = 'h-9 w-9', textClassName = 'text-xl' }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={markClassName} />
      <span
        className={`font-bold tracking-tight text-ink-900 ${textClassName}`}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        Show<span className="text-primary-600">Up</span>
      </span>
    </span>
  )
}
