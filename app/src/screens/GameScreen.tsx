import type { ReactNode } from 'react'

type GameScreenProps = {
  active: boolean
  children: ReactNode
}

export function GameScreen({ active, children }: GameScreenProps) {
  if (!active) return null
  return <>{children}</>
}
