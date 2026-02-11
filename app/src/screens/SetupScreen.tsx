import type { ReactNode } from 'react'

type SetupScreenProps = {
  active: boolean
  children: ReactNode
}

export function SetupScreen({ active, children }: SetupScreenProps) {
  if (!active) return null
  return <>{children}</>
}
