import type { ReactNode } from 'react'

type SettlementWolfScreenProps = {
  active: boolean
  children: ReactNode
}

export function SettlementWolfScreen({ active, children }: SettlementWolfScreenProps) {
  if (!active) return null
  return <>{children}</>
}
