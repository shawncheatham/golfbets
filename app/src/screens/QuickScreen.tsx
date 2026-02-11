import type { ReactNode } from 'react'

type QuickScreenProps = {
  active: boolean
  children: ReactNode
}

export function QuickScreen({ active, children }: QuickScreenProps) {
  if (!active) return null
  return <>{children}</>
}
