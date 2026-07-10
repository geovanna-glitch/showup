export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.55" stopColor="#C13BC4" />
          <stop offset="1" stopColor="#FF7A59" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#logo-bg)" />
      <path
        d="M 166 344 C 180 375 213 394 258 394 C 308 394 344 362 344 319 C 344 276 314 254 258 239 C 202 224 172 204 172 164 C 172 125 206 96 258 96 C 294 96 322 109 340 131 L 374 90"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="52"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 330 86 L 378 86 L 378 134"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="52"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Logo({ markClassName = 'h-9 w-9', textClassName = 'text-xl' }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={markClassName} />
      <span className={`font-extrabold tracking-tight text-ink-900 ${textClassName}`}>
        Show<span className="text-primary-600">Up</span>
      </span>
    </span>
  )
}
