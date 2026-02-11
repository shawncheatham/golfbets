import type { ReactNode } from 'react'

type SettlementBBBScreenProps = {
  active: boolean
  children: ReactNode
}

export function SettlementBBBScreen({ active, children }: SettlementBBBScreenProps) {
  if (!active) return null
  return <>{children}</>
}
