import type { ReactNode } from 'react'

type HolesScreenProps = {
  active: boolean
  children: ReactNode
}

export function HolesScreen({ active, children }: HolesScreenProps) {
  if (!active) return null
  return <>{children}</>
}
