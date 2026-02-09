import type { SVGProps } from 'react'

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const SkinsBadge = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <ellipse cx="8" cy="8" rx="4.5" ry="2.2" {...common} />
    <path d="M3.5 8v3.8c0 1.2 2 2.2 4.5 2.2s4.5-1 4.5-2.2V8" {...common} />
    <ellipse cx="16.3" cy="12.2" rx="4.2" ry="2.1" {...common} />
    <path d="M12.1 12.2v3.4c0 1.2 1.8 2.1 4.2 2.1s4.2-.9 4.2-2.1v-3.4" {...common} />
    <path d="M16.3 7.4v3.1M14.7 8.9h3.2" {...common} />
  </svg>
)

export const WolfBadge = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M5.2 6.5 8 8.2l2.3-1.1L12 8l1.7-.9L16 8.2l2.8-1.7-.8 4.1c.9.9 1.4 2.1 1.4 3.5 0 3.2-3.2 5.8-7.4 5.8s-7.4-2.6-7.4-5.8c0-1.4.5-2.6 1.4-3.5Z" {...common} />
    <path d="M9.4 14.4h5.2M12 14.4v2.8" {...common} />
    <circle cx="10" cy="12.2" r=".8" fill="currentColor" />
    <circle cx="14" cy="12.2" r=".8" fill="currentColor" />
  </svg>
)

export const BBBBadge = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <circle cx="6.5" cy="12" r="3.3" {...common} />
    <circle cx="12" cy="12" r="3.3" {...common} />
    <circle cx="17.5" cy="12" r="3.3" {...common} />
    <text x="6.5" y="13.2" textAnchor="middle" fontSize="3.1" fill="currentColor" fontWeight="700">
      B
    </text>
    <text x="12" y="13.2" textAnchor="middle" fontSize="3.1" fill="currentColor" fontWeight="700">
      B
    </text>
    <text x="17.5" y="13.2" textAnchor="middle" fontSize="3.1" fill="currentColor" fontWeight="700">
      B
    </text>
  </svg>
)
