import type { ReactNode } from 'react'

type SettlementSkinsScreenProps = {
  active: boolean
  children: ReactNode
}

export function SettlementSkinsScreen({ active, children }: SettlementSkinsScreenProps) {
  if (!active) return null
  return <>{children}</>
}
