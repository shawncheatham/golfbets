import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Container,
  HStack,
  Heading,
  Icon,
  SimpleGrid,
  Text,
  useColorMode,
} from '@chakra-ui/react'
import { ChevronRight, Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'
import './App.css'
import type { GameType, HoleNumber, Player, PlayerId, Round } from './types'
import { computeSkins, stakeLabel } from './logic/skins'
import { computeSettlement } from './logic/settlement'
import { computeBBB, emptyHoleAwards, type BBBAwardType, bbbStatusText } from './logic/bbb'
import { computeWolf, wolfForHole, wolfLabel } from './logic/wolf'
import { computeWolfSettlement } from './logic/wolfSettlement'
import { computeBBBSettlement } from './logic/bbbSettlement'
import { deleteRound, loadRounds, saveRounds, upsertRound } from './storage'
import { track } from './logic/track'

type Screen = 'game' | 'setup' | 'holes' | 'quick' | 'settlement'

const THEME_KEY = 'rubislabs:golf-bets:theme:v1'

function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    // ignore
  }
  // default: dark (matches current design)
  return 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

function centsFromDollarsString(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, '')
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100)
}

function dollarsStringFromCents(cents: number): string {
  if (!cents) return ''
  const d = cents / 100
  return d % 1 === 0 ? `${d.toFixed(0)}` : `${d.toFixed(2)}`
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomSkinsName(): string {
  // A little funny/rowdy, but still "golf tournament" flavored.
  const adjectives = [
    'Back Nine',
    'Cart Path',
    'Breakfast Ball',
    'Mulligan',
    'Sand Trap',
    'Fairway',
    'Range Rat',
    'Caddie Shack',
    'Turn Dog',
    'Sunset',
    'Birdie Juice',
    'Wedge Wizard',
    'Short Game',
    'Greenside',
    'Dad Golf',
  ]

  const nouns = ['Open', 'Invitational', 'Classic', 'Cup', 'Championship', 'Showdown', 'Shootout', 'Rumble', 'Skins Game']

  const suffixes = ['(No Gimmes)', '(All Gimmes)', '(Low Drama)', '(High Drama)', '(Respectfully)', '(Allegedly)']

  const base = `${pick(adjectives)} ${pick(nouns)}`
  // Keep it playful but not always noisy.
  return Math.random() < 0.35 ? `${base} ${pick(suffixes)}` : base
}

function randomWolfName(): string {
  const adjectives = ['Wolf', 'Lone Wolf', 'Pack', 'Cart Path', 'Trash Talk', 'Breakfast Ball', 'Wedge Wizard', 'Birdie Juice', 'Back Nine']
  const nouns = ['Classic', 'Open', 'Invitational', 'Showdown', 'Shootout', 'Rumble']
  const suffixes = ['(No Mercy)', '(Respectfully)', '(Allegedly)', '(No Gimmes)']

  const base = `${pick(adjectives)} ${pick(nouns)}`
  return Math.random() < 0.35 ? `${base} ${pick(suffixes)}` : base
}

function randomBBBName(): string {
  const adjectives = ['Bingo', 'Bango', 'Bongo', 'Dots', 'Green Light', 'Pin High', 'Roller', 'Back Nine']
  const nouns = ['Classic', 'Open', 'Invitational', 'Showdown', 'Shootout', 'Rumble']
  const suffixes = ['(No Gimmes)', '(Respectfully)', '(Allegedly)']
  const base = `${pick(adjectives)} ${pick(nouns)}`
  return Math.random() < 0.35 ? `${base} ${pick(suffixes)}` : base
}

function createEmptySkinsRound(): Round {
  return {
    id: uid('round'),
    game: 'skins',
    name: randomSkinsName(),
    stakeCents: 500,
    players: [
      { id: uid('p'), name: 'Player 1' },
      { id: uid('p'), name: 'Player 2' },
    ],
    strokesByHole: {},
    createdAt: Date.now(),
  }
}

function createEmptyWolfRound(): Round {
  return {
    id: uid('round'),
    game: 'wolf',
    name: randomWolfName(),
    wolfPointsPerHole: 1,
    wolfLoneMultiplier: 2,
    wolfDollarsPerPointCents: 0,
    wolfStartingIndex: 0,
    wolfPartnerByHole: {},
    players: [
      { id: uid('p'), name: 'Player 1' },
      { id: uid('p'), name: 'Player 2' },
      { id: uid('p'), name: 'Player 3' },
      { id: uid('p'), name: 'Player 4' },
    ],
    strokesByHole: {},
    createdAt: Date.now(),
  }
}

function createEmptyBBBRound(): Round {
  return {
    id: uid('round'),
    game: 'bbb',
    name: randomBBBName(),
    players: [
      { id: uid('p'), name: 'Player 1' },
      { id: uid('p'), name: 'Player 2' },
    ],
    strokesByHole: {},
    bbbAwardsByHole: {},
    createdAt: Date.now(),
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('game')
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const { colorMode, setColorMode } = useColorMode()

  useEffect(() => {
    // Keep legacy CSS theme in sync while we migrate UI to Chakra.
    applyTheme(theme)
    if (theme !== colorMode) setColorMode(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  // Local persistence
  const [stored, setStored] = useState(() => loadRounds())
  const [round, setRound] = useState<Round>(() => {
    const st = loadRounds()
    const active = st.activeRoundId ? st.rounds.find((r) => r.id === st.activeRoundId) : undefined
    // If there is an active round, resume it, but keep landing page available.
    return active || createEmptySkinsRound()
  })

  // Avoid writing on initial mount before state settles
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    setStored((prev) => {
      const next = upsertRound(prev, round)
      saveRounds(next)
      return next
    })
  }, [round])

  const skins = useMemo(() => (round.game === 'skins' ? computeSkins(round) : null), [round])
  const settlement = useMemo(() => (round.game === 'skins' ? computeSettlement(round) : null), [round])
  const bbb = useMemo(() => (round.game === 'bbb' ? computeBBB(round) : null), [round])
  const wolf = useMemo(() => (round.game === 'wolf' ? computeWolf(round) : null), [round])
  const wolfSettlement = useMemo(() => {
    if (round.game !== 'wolf' || !wolf) return null
    const cents = round.wolfDollarsPerPointCents || 0
    if (cents <= 0) return null
    return computeWolfSettlement(round.players, wolf.pointsByPlayer, cents)
  }, [round, wolf])

  const bbbSettlement = useMemo(() => {
    if (round.game !== 'bbb' || !bbb) return null
    const cents = round.bbbDollarsPerPointCents || 0
    if (cents <= 0) return null
    return computeBBBSettlement(round.players, bbb.pointsByPlayer, cents)
  }, [round, bbb])

  const allPlayersHaveNames = round.players.every((p) => p.name.trim().length > 0)

  const canStart = useMemo(() => {
    if (!allPlayersHaveNames) return false
    if (round.game === 'skins') {
      return round.players.length >= 2 && round.players.length <= 4 && (round.stakeCents || 0) > 0
    }
    if (round.game === 'bbb') {
      return round.players.length >= 2 && round.players.length <= 4
    }
    // wolf v1: 4 only
    const pts = round.wolfPointsPerHole || 0
    return round.players.length === 4 && pts > 0
  }, [allPlayersHaveNames, round])

  function updatePlayer(id: PlayerId, patch: Partial<Player>) {
    setRound((r) => ({
      ...r,
      players: r.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }

  const focusPlayerId = useRef<PlayerId | null>(null)

  function addPlayer() {
    setRound((r) => {
      if (r.game === 'wolf') return r
      if (r.players.length >= 4) return r
      const id = uid('p')
      focusPlayerId.current = id
      return { ...r, players: [...r.players, { id, name: `Player ${r.players.length + 1}` }] }
    })
  }

  function removePlayer(id: PlayerId) {
    setRound((r) => {
      if (r.game === 'wolf') return r
      if (r.players.length <= 2) return r
      const players = r.players.filter((p) => p.id !== id)
      // If we removed the focused player, clear.
      if (focusPlayerId.current === id) focusPlayerId.current = null
      const strokesByHole: Round['strokesByHole'] = {}
      for (const [holeStr, byPlayer] of Object.entries(r.strokesByHole)) {
        const hole = Number(holeStr)
        const next: Record<PlayerId, number | null> = {}
        for (const p of players) next[p.id] = byPlayer?.[p.id] ?? null
        strokesByHole[hole] = next
      }
      return { ...r, players, strokesByHole }
    })
  }

  function clampStroke(n: number): number {
    // Guardrails: keep plausible golf score range. Still allows bad holes.
    return Math.max(1, Math.min(25, Math.round(n)))
  }

  function setStroke(hole: number, playerId: PlayerId, v: string) {
    if (round.locked) return
    if (round.game === 'bbb') return

    const n = v.trim() === '' ? null : Number(v)
    if (n !== null && (!Number.isFinite(n) || n < 0 || !Number.isInteger(n))) return

    // Error-proofing: confirm extreme values that are commonly fat-fingers.
    if (n !== null) {
      const extreme = n <= 1 || n >= 15
      if (extreme) {
        const who = round.players.find((p) => p.id === playerId)?.name || 'Player'
        if (!confirm(`Set ${who} to ${n} on hole ${hole}?`)) return
      }
    }

    // Wolf: prevent accidental Lone Wolf (must be intentional if no partner selected)
    if (round.game === 'wolf' && n !== null) {
      const partnerId = (round.wolfPartnerByHole?.[hole as HoleNumber] ?? null) as PlayerId | null
      if (partnerId === null) {
        // only prompt when first score is being entered for the hole
        const existing = round.strokesByHole[hole] || {}
        const anyEntered = round.players.some((p) => typeof existing[p.id] === 'number')
        if (!anyEntered) {
          const wolfId = wolfForHole(round, hole as HoleNumber).wolfId
          const wolfName = round.players.find((p) => p.id === wolfId)?.name || 'Wolf'
          if (!confirm(`No partner selected for hole ${hole}. Confirm ${wolfName} is playing Lone Wolf?`)) return
        }
      }
    }

    setRound((r) => {
      const holeRec = r.strokesByHole[hole] || {}
      return {
        ...r,
        strokesByHole: {
          ...r.strokesByHole,
          [hole]: {
            ...holeRec,
            [playerId]: n === null ? null : clampStroke(n),
          },
        },
      }
    })
  }

  function incStroke(hole: number, playerId: PlayerId, delta: number) {
    if (round.locked) return
    if (round.game === 'bbb') return

    setRound((r) => {
      const holeRec = r.strokesByHole[hole] || {}
      const cur = holeRec[playerId]
      const base = typeof cur === 'number' ? cur : 4
      const next = clampStroke(base + delta)
      return {
        ...r,
        strokesByHole: {
          ...r.strokesByHole,
          [hole]: {
            ...holeRec,
            [playerId]: next,
          },
        },
      }
    })
  }

  // Quick-entry mode
  const [quickHole, setQuickHole] = useState<number>(1)

  const isHoleComplete = (h: number) => {
    if (round.game === 'bbb') {
      // Consider a BBB hole “complete” if all 3 awards are assigned (or explicitly None).
      const a = round.bbbAwardsByHole?.[h as HoleNumber]
      if (!a) return false
      // Presence of record isn’t enough; require explicit values (null is allowed).
      return ['bingo', 'bango', 'bongo'].every((k) => k in a)
    }

    const by = round.strokesByHole[h]
    return round.players.every((p) => typeof by?.[p.id] === 'number')
  }

  const firstIncompleteHole = () => {
    for (let h = 1; h <= 18; h++) {
      if (!isHoleComplete(h)) return h
    }
    return 18
  }

  const currentHole = () => {
    const through = lastCompletedHole()
    return Math.min(18, through + 1)
  }

  function clearHole(hole: number) {
    if (round.locked) return

    if (round.game === 'bbb') {
      if (!confirm(`Clear all awards for hole ${hole}?`)) return
      track('bbb_hole_clear', { hole })
      setRound((r) => {
        if (r.game !== 'bbb') return r
        const cur = r.bbbAwardsByHole || {}
        const next = { ...cur }
        delete next[hole as HoleNumber]
        return { ...r, bbbAwardsByHole: next }
      })
      return
    }

    if (!confirm(`Clear all scores for hole ${hole}?`)) return

    setRound((r) => {
      const holeRec = r.strokesByHole[hole] || {}
      const nextHole: Record<PlayerId, number | null> = { ...holeRec }
      for (const p of r.players) nextHole[p.id] = null
      return {
        ...r,
        strokesByHole: {
          ...r.strokesByHole,
          [hole]: nextHole,
        },
      }
    })
  }

  useEffect(() => {
    // When entering quick mode, jump to first incomplete hole.
    if (screen !== 'quick') return
    setQuickHole(firstIncompleteHole())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  function resetToGamePicker() {
    if (!confirm('Start a new game? This will clear the current round on screen (saved rounds remain in Recent).')) {
      return
    }
    setScreen('game')
  }

  function resetSameGame() {
    if (!confirm('Start a new round? This will clear the current round on screen (saved rounds remain in Recent).')) {
      return
    }
    setRound(round.game === 'wolf' ? createEmptyWolfRound() : round.game === 'bbb' ? createEmptyBBBRound() : createEmptySkinsRound())
    setScreen('setup')
  }

  function startNew(game: GameType) {
    track('round_new', { game })
    setRound(game === 'wolf' ? createEmptyWolfRound() : game === 'bbb' ? createEmptyBBBRound() : createEmptySkinsRound())
    setScreen('setup')
  }

  function loadExistingRound(r: Round) {
    setRound(r)
    setScreen('holes')
    setStored((prev) => {
      const next = { ...prev, activeRoundId: r.id }
      saveRounds(next)
      return next
    })
  }

  function deleteExistingRound(id: string) {
    if (!confirm('Delete this saved round?')) return
    setStored((prev) => {
      const next = deleteRound(prev, id)
      saveRounds(next)
      return next
    })
  }

  function lastCompletedHole(): number {
    for (let h = 18; h >= 1; h--) {
      if (isHoleComplete(h)) return h
    }
    return 0
  }

  function settlementText(): string {
    if (!settlement) return ''

    const through = lastCompletedHole()
    const stake = stakeLabel(round.stakeCents || 0)

    const totals = round.players
      .map((p) => {
        const net = settlement.netByPlayer[p.id] || 0
        return { name: p.name, net }
      })
      .sort((a, b) => b.net - a.net)
      .map((x) => {
        const sign = x.net >= 0 ? '+' : '-'
        return `${x.name} ${sign}$${Math.abs(x.net / 100).toFixed(2)}`
      })
      .join('\n')

    const lines = settlement.lines
      .map((l) => `${l.from.name} → ${l.to.name}: $${(l.amountCents / 100).toFixed(2)}`)
      .join('\n')

    return `Golf Bets — Settlement\nRound: ${round.name || 'Skins'}\nSkins • ${stake}/skin • Through ${through}/18\n\nNet:\n${totals}\n\nSuggested payments:\n${lines || '(no payments)'}`
  }

  function statusText(): string {
    const through = lastCompletedHole()

    if (round.game === 'skins' && skins) {
      const stake = stakeLabel(round.stakeCents || 0)
      const carry = skins.carryToNext

      const sorted = round.players
        .map((p) => ({ name: p.name, skins: skins.skinsWon[p.id] || 0 }))
        .sort((a, b) => b.skins - a.skins)

      const leader = sorted[0]
      const leaderLine = leader ? `Leader: ${leader.name} (${leader.skins})` : ''
      const inline = sorted.map((x) => `${x.name} ${x.skins}`).join(' • ')

      return `Skins — Through ${through}/18 — ${stake}/skin — Carry ${carry}\n${leaderLine}\n${inline}`
    }

    if (round.game === 'wolf' && wolf) {
      const pts = wolfLabel(round.wolfPointsPerHole)
      const cents = round.wolfDollarsPerPointCents || 0
      const money = cents > 0 ? ` — $${dollarsStringFromCents(cents)}/pt` : ''

      const sorted = round.players
        .map((p) => ({ name: p.name, pts: wolf.pointsByPlayer[p.id] || 0 }))
        .sort((a, b) => b.pts - a.pts)

      const leader = sorted[0]
      const leaderLine = leader ? `Leader: ${leader.name} (${leader.pts})` : ''
      const inline = sorted.map((x) => `${x.name} ${x.pts}`).join(' • ')

      return `Wolf — Through ${through}/18 — ${pts}${money}\n${leaderLine}\n${inline}`
    }

    if (round.game === 'bbb' && bbb) {
      // Use BBB's own definition of through-hole progress.
      return bbbStatusText(round.players, bbb.through, bbb.pointsByPlayer)
    }

    return `Golf Bets status\nRound: ${round.name || 'Round'}\nThrough: ${through}/18`
  }

  async function copyStatus() {
    try {
      await navigator.clipboard.writeText(statusText())
      track('share_status', { game: round.game })
      alert('Copied status to clipboard')
    } catch {
      alert('Could not copy. You can manually select and copy the text.')
    }
  }

  function wolfSettlementText(): string {
    if (round.game !== 'wolf' || !wolf || !wolfSettlement) return ''
    const through = lastCompletedHole()
    const dollarsPerPoint = dollarsStringFromCents(round.wolfDollarsPerPointCents || 0)

    const pts = round.players
      .map((p) => ({ name: p.name, pts: wolf.pointsByPlayer[p.id] || 0 }))
      .sort((a, b) => b.pts - a.pts)
      .map((x) => `${x.name} ${x.pts}`)
      .join(' • ')

    const lines = wolfSettlement.lines
      .map((l) => `${l.from.name} → ${l.to.name}: $${(l.amountCents / 100).toFixed(2)}`)
      .join('\n')

    return `Golf Bets — Wolf settlement\nRound: ${round.name || 'Wolf'}\nThrough ${through}/18 • $${dollarsPerPoint}/pt\n\nPoints:\n${pts}\n\nSuggested payments:\n${lines || '(no payments)'}`
  }

  async function copyWolfSettlement() {
    try {
      await navigator.clipboard.writeText(wolfSettlementText())
      track('share_settlement', { game: 'wolf', centsPerPoint: round.wolfDollarsPerPointCents || 0 })
      alert('Copied settlement (ready to paste in the group chat)')
    } catch {
      alert('Could not copy. You can manually select and copy the text.')
    }
  }

  function bbbSettlementText(): string {
    if (round.game !== 'bbb' || !bbb || !bbbSettlement) return ''
    const through = bbb.through
    const dollarsPerPoint = dollarsStringFromCents(round.bbbDollarsPerPointCents || 0)

    const pts = round.players
      .map((p) => ({ name: p.name, pts: bbb.pointsByPlayer[p.id] || 0 }))
      .sort((a, b) => b.pts - a.pts)
      .map((x) => `${x.name} ${x.pts}`)
      .join(' • ')

    const lines = bbbSettlement.lines
      .map((l) => `${l.from.name} → ${l.to.name}: $${(l.amountCents / 100).toFixed(2)}`)
      .join('\n')

    return `Golf Bets — BBB settlement\nRound: ${round.name || 'BBB'}\nThrough ${through}/18 • $${dollarsPerPoint}/pt\n\nPoints:\n${pts}\n\nSuggested payments:\n${lines || '(no payments)'}`
  }

  async function copyBBBSettlement() {
    try {
      await navigator.clipboard.writeText(bbbSettlementText())
      track('share_settlement', { game: 'bbb', centsPerPoint: round.bbbDollarsPerPointCents || 0 })
      alert('Copied settlement (ready to paste in the group chat)')
    } catch {
      alert('Could not copy. You can manually select and copy the text.')
    }
  }

  function isRoundComplete(): boolean {
    for (let h = 1; h <= 18; h++) {
      if (!isHoleComplete(h)) return false
    }
    return true
  }

  function lockRound(andGoToSettlement = false) {
    track('round_lock', { game: round.game, screen, andGoToSettlement })
    setRound((r) => ({ ...r, locked: true }))
    if (andGoToSettlement) setScreen('settlement')
  }

  function unlockRound() {
    if (!confirm('Unlock round? This allows edits and may change standings/settlement.')) return
    track('round_unlock', { game: round.game, screen })
    setRound((r) => ({ ...r, locked: false }))
  }

  async function copySettlement() {
    try {
      await navigator.clipboard.writeText(settlementText())
      alert('Copied settlement to clipboard')
    } catch {
      alert('Could not copy. You can manually select and copy the text.')
    }
  }

  async function shareSettlement() {
    try {
      await navigator.clipboard.writeText(settlementText())
      alert('Copied settlement (ready to paste in the group chat)')
    } catch {
      alert('Could not copy. You can manually select and copy the settlement text.')
    }
  }

  function setWolfPartnerForHole(hole: HoleNumber, partnerId: PlayerId | null) {
    if (round.locked) return
    setRound((r) => {
      if (r.game !== 'wolf') return r
      const cur = r.wolfPartnerByHole || {}
      return { ...r, wolfPartnerByHole: { ...cur, [hole]: partnerId } }
    })
  }

  function setBBBAwardForHole(hole: HoleNumber, award: BBBAwardType, winnerId: PlayerId | null) {
    if (round.locked) return
    track('bbb_award_set', { hole, award, winnerId })
    setRound((r) => {
      if (r.game !== 'bbb') return r
      const cur = r.bbbAwardsByHole || {}
      const holeRec = cur[hole] || emptyHoleAwards()
      return {
        ...r,
        bbbAwardsByHole: {
          ...cur,
          [hole]: {
            ...holeRec,
            [award]: winnerId,
          },
        },
      }
    })
  }

  const wolfHole = useMemo(() => {
    if (round.game !== 'wolf') return null
    return wolfForHole(round, quickHole as HoleNumber)
  }, [round, quickHole])

  return (
    <Container maxW="1100px" px={{ base: 4, md: 6 }} py={{ base: 5, md: 7 }}>
      <HStack justify="space-between" align="flex-start" mb={{ base: 5, md: 7 }}>
        <Box>
          <Heading size={{ base: 'lg', md: 'xl' }} letterSpacing="-0.02em">
            Golf Bets
          </Heading>
          <Text fontSize={{ base: 'md', md: 'lg' }} color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={600}>
            Less math, fewer arguments.
          </Text>
        </Box>

        <Button
          variant="secondary"
          leftIcon={
            <Icon as={theme === 'dark' ? Sun : Moon} aria-hidden="true" boxSize={4} />
          }
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          type="button"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </Button>
      </HStack>

      {screen === 'game' && (
        <Box className="card" p={{ base: 4, md: 6 }}>
          <Text fontSize="md" fontWeight={700} color={theme === 'dark' ? 'gray.300' : 'gray.600'} mb={3}>
            Choose a game
          </Text>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
            <Button
              variant="primary"
              rightIcon={<Icon as={ChevronRight} boxSize={4} aria-hidden="true" />}
              onClick={() => startNew('skins')}
              type="button"
            >
              Skins
            </Button>
            <Button
              variant="primary"
              rightIcon={<Icon as={ChevronRight} boxSize={4} aria-hidden="true" />}
              onClick={() => startNew('wolf')}
              type="button"
            >
              Wolf
            </Button>
            <Button
              variant="primary"
              rightIcon={<Icon as={ChevronRight} boxSize={4} aria-hidden="true" />}
              onClick={() => startNew('bbb')}
              type="button"
            >
              Bingo Bango Bongo
            </Button>
          </SimpleGrid>

          {stored.rounds.length > 0 && (
            <>
              <div style={{ height: 18 }} />
              <div className="label">Recent rounds</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Name</th>
                    <th>Players</th>
                    <th style={{ textAlign: 'right' }}>Stake</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stored.rounds
                    .slice()
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                    .slice(0, 10)
                    .map((r) => (
                      <tr key={r.id}>
                        <td className="small">{r.game === 'wolf' ? 'Wolf' : 'Skins'}</td>
                        <td>{r.name || (r.game === 'wolf' ? 'Wolf' : 'Skins')}</td>
                        <td className="small">{r.players.map((p) => p.name).join(', ')}</td>
                        <td style={{ textAlign: 'right' }}>
                          {r.game === 'wolf' ? wolfLabel(r.wolfPointsPerHole) : stakeLabel(r.stakeCents || 0)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn ghost" onClick={() => loadExistingRound(r)} type="button">
                            Open
                          </button>{' '}
                          <button className="btn danger" onClick={() => deleteExistingRound(r.id)} type="button">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
        </Box>
      )}

      {screen === 'setup' && (
        <div className="card">
          <div className="row two">
            <div>
              <div className="labelRow">
                <div className="label">Round name</div>
                {round.game === 'skins' ? (
                  <button
                    className="btn ghost iconBtn"
                    type="button"
                    onClick={() => setRound((r) => ({ ...r, name: randomSkinsName() }))}
                    title="Reroll name"
                  >
                    🎲 Reroll
                  </button>
                ) : round.game === 'wolf' ? (
                  <button
                    className="btn ghost iconBtn"
                    type="button"
                    onClick={() => setRound((r) => ({ ...r, name: randomWolfName() }))}
                    title="Reroll name"
                  >
                    🎲 Reroll
                  </button>
                ) : (
                  <button
                    className="btn ghost iconBtn"
                    type="button"
                    onClick={() => setRound((r) => ({ ...r, name: randomBBBName() }))}
                    title="Reroll name"
                  >
                    🎲 Reroll
                  </button>
                )}
              </div>
              <input
                className="input"
                value={round.name}
                onChange={(e) => setRound((r) => ({ ...r, name: e.target.value }))}
                placeholder="Saturday skins"
              />
            </div>

            {round.game === 'skins' ? (
              <div>
                <div className="label">Stake ($/skin)</div>
                <input
                  className="input"
                  value={dollarsStringFromCents(round.stakeCents || 0)}
                  onChange={(e) => setRound((r) => ({ ...r, stakeCents: centsFromDollarsString(e.target.value) }))}
                  inputMode="decimal"
                  placeholder="5"
                />
                <div className="small">Gross skins. Carryovers on ties. Tie after 18 remains a tie.</div>
              </div>
            ) : round.game === 'wolf' ? (
              <div>
                <div className="label">Points per hole</div>
                <input
                  className="input"
                  value={String(round.wolfPointsPerHole ?? 1)}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isFinite(n)) return
                    setRound((r) => ({ ...r, wolfPointsPerHole: Math.max(1, Math.min(10, Math.round(n))) }))
                  }}
                  inputMode="numeric"
                  placeholder="1"
                />
                <div style={{ height: 10 }} />
                <div className="label">$ per point (optional)</div>
                <input
                  className="input"
                  value={dollarsStringFromCents(round.wolfDollarsPerPointCents || 0)}
                  onChange={(e) => setRound((r) => ({ ...r, wolfDollarsPerPointCents: centsFromDollarsString(e.target.value) }))}
                  inputMode="decimal"
                  placeholder=""
                />
                <div className="small">Wolf (v1): 4 players only. Wolf rotates each hole. In Quick mode, pick the Wolf’s partner (or Lone) before entering scores.</div>
              </div>
            ) : (
              <div>
                <div className="label">$ per point (optional)</div>
                <input
                  className="input"
                  value={dollarsStringFromCents(round.bbbDollarsPerPointCents || 0)}
                  onChange={(e) => setRound((r) => ({ ...r, bbbDollarsPerPointCents: centsFromDollarsString(e.target.value) }))}
                  inputMode="decimal"
                  placeholder=""
                />
                <div className="small">Settlement uses points × $/pt when set.</div>
              </div>
            )}
          </div>

          <div style={{ height: 16 }} />

          <div className="label">Players ({round.game === 'wolf' ? '4' : '2–4'})</div>
          <div className="small">
            {round.game === 'wolf'
              ? 'Wolf is 4 players only (v1). Wolf rotates each hole. Partner is chosen per hole in Quick mode.'
              : ''}
          </div>

          <div className="row">
            {round.players.map((p, idx) => (
              <div key={p.id} className="row two">
                <div>
                  <input
                    className="input"
                    ref={(el) => {
                      if (!el) return
                      if (focusPlayerId.current && focusPlayerId.current === p.id) {
                        queueMicrotask(() => el.focus())
                        focusPlayerId.current = null
                      }
                    }}
                    value={p.name}
                    onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                    placeholder={`Player ${idx + 1}`}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                  {round.game === 'skins' && round.players.length > 2 && (
                    <button className="btn ghost" onClick={() => removePlayer(p.id)} type="button">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {round.game !== 'wolf' && (
                <button className="btn" onClick={addPlayer} disabled={round.players.length >= 4} type="button">
                  + Add player
                </button>
              )}
              <button
                className="btn primary"
                disabled={!canStart}
                onClick={() => {
                  track('round_start', { game: round.game, playerCount: round.players.length })
                  setScreen('quick')
                }}
                type="button"
              >
                Start round →
              </button>
              <button
                className="btn ghost"
                disabled={!canStart}
                onClick={() => {
                  track('nav_screen', { from: 'setup', to: 'holes', game: round.game })
                  setScreen('holes')
                }}
                type="button"
              >
                Grid view
              </button>
              <button className="btn ghost" onClick={resetToGamePicker} type="button">
                Change game
              </button>
              <button className="btn ghost" onClick={resetSameGame} type="button">
                New round
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'holes' && (
        <div className="card">
          <div className="row">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="label">Round</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || (round.game === 'wolf' ? 'Wolf' : round.game === 'bbb' ? 'BBB' : 'Skins')}</div>
                {round.game === 'skins' && skins && (
                  <div className="small">
                    Carry: {skins.carryToNext} skin(s) (${((skins.carryToNext || 0) * (round.stakeCents || 0) / 100).toFixed(0)})
                    {(() => {
                      const leader = round.players
                        .slice()
                        .sort((a, b) => (skins.skinsWon[b.id] || 0) - (skins.skinsWon[a.id] || 0))[0]
                      const n = leader ? skins.skinsWon[leader.id] || 0 : 0
                      return leader ? ` • Leader: ${leader.name} (${n})` : ''
                    })()}
                  </div>
                )}
                {round.game === 'wolf' && wolf && (
                  <div className="small">
                    Points leader: {
                      round.players
                        .slice()
                        .sort((a, b) => (wolf.pointsByPlayer[b.id] || 0) - (wolf.pointsByPlayer[a.id] || 0))[0]?.name
                    }
                  </div>
                )}
                {round.game === 'bbb' && bbb && (
                  <div className="small">
                    Points leader: {
                      round.players
                        .slice()
                        .sort((a, b) => (bbb.pointsByPlayer[b.id] || 0) - (bbb.pointsByPlayer[a.id] || 0))[0]?.name
                    }
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {round.locked ? (
                  <div className="pill" title="Round is locked (edits disabled)">Locked ✅</div>
                ) : (
                  <button className="btn" onClick={() => lockRound(false)} type="button" title="Lock disables edits (useful once a round is final)">
                    Lock round
                  </button>
                )}
                {round.locked && (
                  <button className="btn ghost" onClick={unlockRound} type="button">
                    Unlock
                  </button>
                )}
                <button className="btn ghost" onClick={() => setScreen('quick')} type="button">
                  Quick mode
                </button>
                <button className="btn ghost" onClick={() => setScreen('setup')} type="button">
                  ← Setup
                </button>
                <button className="btn" onClick={copyStatus} type="button" title="Copy a shareable status summary">
                  Share status
                </button>
                {round.game === 'skins' && settlement && (round.locked || isRoundComplete()) && (
                  <button className={round.locked ? 'btn primary' : 'btn'} onClick={shareSettlement} type="button" title="Copy the settlement text to paste in the group chat">
                    Share settlement
                  </button>
                )}
                {round.game === 'bbb' && bbbSettlement && (round.locked || isRoundComplete()) && (
                  <button className={round.locked ? 'btn primary' : 'btn'} onClick={copyBBBSettlement} type="button" title="Copy the settlement text to paste in the group chat">
                    Share settlement
                  </button>
                )}
                <button className="btn primary" onClick={() => setScreen('settlement')} type="button">
                  {round.game === 'wolf' || round.game === 'bbb' ? 'Standings →' : 'Settlement →'}
                </button>
              </div>
            </div>

            {round.game === 'skins' && settlement && !round.locked && isRoundComplete() && (
              <div className="card" style={{ padding: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>Round complete</div>
                <div className="small" style={{ marginBottom: 10 }}>
                  Lock the round to prevent edits, then share the settlement to the group.
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={() => lockRound(true)} type="button">
                    Lock + open settlement →
                  </button>
                  <button className="btn" onClick={shareSettlement} type="button">
                    Share settlement
                  </button>
                </div>
              </div>
            )}

            {round.game === 'wolf' && wolf && !round.locked && isRoundComplete() && (
              <div className="card" style={{ padding: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>Round complete</div>
                <div className="small" style={{ marginBottom: 10 }}>
                  Lock the round to prevent edits, then share standings (and settlement if $/pt is set).
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={() => lockRound(true)} type="button">
                    Lock + open standings →
                  </button>
                  <button className="btn" onClick={copyStatus} type="button">
                    Share standings
                  </button>
                  {wolfSettlement && (
                    <button className="btn" onClick={copyWolfSettlement} type="button">
                      Share settlement
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="holes">
              <div className="holeGrid" style={{ minWidth: round.game === 'wolf' ? 980 : 720 }}>
                {round.game === 'bbb' ? (
                  <>
                    <div className="holeRow skins header">
                      <div className="holeCell">
                        <span className="small">Hole</span>
                      </div>
                      <div className="holeCell">
                        <span className="small">Bingo</span>
                      </div>
                      <div className="holeCell">
                        <span className="small">Bango</span>
                      </div>
                      <div className="holeCell">
                        <span className="small">Bongo</span>
                      </div>
                      <div className="holeCell" style={{ textAlign: 'right' }}>
                        <span className="small">Done</span>
                      </div>
                    </div>

                    {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => {
                      const h = hole as HoleNumber
                      const a = round.bbbAwardsByHole?.[h]

                      const nameFor = (pid: PlayerId | null | undefined) => {
                        if (pid === null) return 'None'
                        if (!pid) return '—'
                        return round.players.find((p) => p.id === pid)?.name || '—'
                      }

                      const done = !!a && ['bingo', 'bango', 'bongo'].every((k) => k in a)

                      return (
                        <div key={hole} className="holeRow skins">
                          <div className="holeCell">
                            <button className="btn ghost" type="button" onClick={() => { setQuickHole(hole); setScreen('quick') }}>
                              {hole}
                            </button>
                          </div>
                          <div className="holeCell">{nameFor(a?.bingo)}</div>
                          <div className="holeCell">{nameFor(a?.bango)}</div>
                          <div className="holeCell">{nameFor(a?.bongo)}</div>
                          <div className="holeCell" style={{ textAlign: 'right' }}>{done ? '✅' : '—'}</div>
                        </div>
                      )
                    })}
                  </>
                ) : round.game === 'wolf' ? (
                  <>
                    <div className="holeRow wolf header">
                      <div className="holeCell">
                        <span className="small">Hole</span>
                      </div>
                      <div className="holeCell">
                        <span className="small">Wolf</span>
                      </div>
                      <div className="holeCell">
                        <span className="small">Pairing</span>
                      </div>
                      <div className="holeCell">
                        <span className="small">Result</span>
                      </div>
                      {round.players.map((p) => (
                        <div key={p.id} className="holeCell">
                          <span className="small">{p.name}</span>
                        </div>
                      ))}
                    </div>

                    {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => {
                      const wid = wolfForHole(round, hole as HoleNumber).wolfId
                      const wolfName = round.players.find((p) => p.id === wid)?.name || 'Wolf'
                      const partnerId = (round.wolfPartnerByHole?.[hole as HoleNumber] ?? null) as PlayerId | null
                      const partnerName = partnerId ? round.players.find((p) => p.id === partnerId)?.name : null
                      const pairingLabel = partnerName ? `Wolf + ${partnerName}` : 'Lone Wolf'

                      const hr = (wolf?.holeResults || []).find((x) => x.hole === (hole as HoleNumber))
                      const centsPerPoint = round.wolfDollarsPerPointCents || 0

                      const resultLabel = (() => {
                        if (!hr || hr.status === 'incomplete') return '—'
                        if (hr.status === 'tie') return 'Tie (0)'

                        // Show Wolf's net change for the hole (includes lone multiplier)
                        const dPts = hr.pointsDeltaByPlayer[wid] || 0
                        const sign = dPts > 0 ? '+' : ''
                        const money = centsPerPoint > 0 ? ` • $${((Math.abs(dPts) * centsPerPoint) / 100).toFixed(0)}` : ''
                        const loneTag = partnerId ? '' : ' (Lone)'
                        return `Wolf ${sign}${dPts}${loneTag}${money}`
                      })()

                      return (
                        <div key={hole} className="holeRow wolf">
                          <div className="holeCell">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <span className="holeNum">{hole}</span>
                              <button className="btn ghost miniBtn" onClick={() => clearHole(hole)} disabled={!!round.locked} type="button">
                                Clear
                              </button>
                            </div>
                          </div>
                          <div className="holeCell">
                            <span className="small" style={{ fontWeight: 700 }}>
                              {wolfName}
                            </span>
                          </div>
                          <div className="holeCell">
                            <span className="small">{pairingLabel}</span>
                          </div>
                          <div className="holeCell">
                            <span className="small">{resultLabel}</span>
                          </div>
                          {round.players.map((p) => (
                            <div key={p.id} className="holeCell">
                              <input
                                className="holeInput"
                                value={round.strokesByHole[hole]?.[p.id] ?? ''}
                                onChange={(e) => setStroke(hole, p.id, e.target.value)}
                                inputMode="numeric"
                                placeholder="-"
                              />
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </>
                ) : (
                  <>
                    <div className="holeRow skins header">
                      <div className="holeCell">
                        <span className="small">Hole</span>
                      </div>
                      <div className="holeCell">
                        <span className="small">Result</span>
                      </div>
                      {round.players.map((p) => (
                        <div key={p.id} className="holeCell">
                          <span className="small">{p.name}</span>
                        </div>
                      ))}
                    </div>

                    {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => {
                      const hr = skins?.holeResults?.find((x) => x.hole === (hole as HoleNumber))
                      const winnerName = hr?.winnerId ? round.players.find((p) => p.id === hr.winnerId)?.name : null
                      const isComplete = isHoleComplete(hole)
                      const dollars = (cents: number) => (cents / 100) % 1 === 0 ? `$${(cents / 100).toFixed(0)}` : `$${(cents / 100).toFixed(2)}`
                      const stake = round.stakeCents || 0
                      const wonCents = hr?.wonSkins ? hr.wonSkins * stake : 0
                      const nextCarrySkins = (hr?.carrySkins || 0) + 1
                      const nextCarryCents = nextCarrySkins * stake

                      const label = !hr
                        ? '—'
                        : !isComplete
                          ? `incomplete (${round.players.filter((p) => typeof round.strokesByHole[hole]?.[p.id] === 'number').length}/${round.players.length})`
                          : hr.winnerId
                            ? `${winnerName || 'Winner'} (+${hr.wonSkins}, ${dollars(wonCents)})`
                            : `tie (carry → ${nextCarrySkins}, ${dollars(nextCarryCents)})`

                      return (
                        <div key={hole} className="holeRow skins">
                          <div className="holeCell">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <span className="holeNum">{hole}</span>
                              <button className="btn ghost miniBtn" onClick={() => clearHole(hole)} disabled={!!round.locked} type="button">
                                Clear
                              </button>
                            </div>
                          </div>

                          <div className="holeCell">
                            <span className="small">{label}</span>
                          </div>

                          {round.players.map((p) => (
                            <div key={p.id} className="holeCell">
                              <input
                                className="holeInput"
                                value={round.strokesByHole[hole]?.[p.id] ?? ''}
                                onChange={(e) => setStroke(hole, p.id, e.target.value)}
                                inputMode="numeric"
                                placeholder="-"
                              />
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            </div>

            <div style={{ height: 14 }} />

            {round.game === 'skins' && skins && (
              <div className="row two">
                <div>
                  <div className="label">Skins won</div>
                  <table className="table">
                    <tbody>
                      {round.players.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td style={{ textAlign: 'right' }}>{skins.skinsWon[p.id] || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="label">Per-hole (winner / carry)</div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Hole</th>
                        <th>Winner</th>
                        <th style={{ textAlign: 'right' }}>Skins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skins.holeResults.map((hr) => {
                        const winner = hr.winnerId ? round.players.find((p) => p.id === hr.winnerId)?.name : '—'
                        const label = hr.winnerId ? winner : `tie (carry)`
                        return (
                          <tr key={hr.hole}>
                            <td>{hr.hole}</td>
                            <td>{label}</td>
                            <td style={{ textAlign: 'right' }}>{hr.winnerId ? hr.wonSkins : hr.carrySkins ? `+${hr.carrySkins}` : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="small">Note: ties carry 1 skin forward. Carry resets on a win. Ties after 18 remain unresolved.</div>
                </div>
              </div>
            )}

            {round.game === 'wolf' && wolf && (
              <div>
                <div className="label">Points (leaderboard)</div>
                <table className="table">
                  <tbody>
                    {round.players
                      .slice()
                      .sort((a, b) => (wolf.pointsByPlayer[b.id] || 0) - (wolf.pointsByPlayer[a.id] || 0))
                      .map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td style={{ textAlign: 'right' }}>{wolf.pointsByPlayer[p.id] || 0}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <div className="small">Wolf rotates each hole (starting from Player 1 on hole 1). Choose partner in Quick mode (or play Lone Wolf).</div>
              </div>
            )}
          </div>
        </div>
      )}

      {screen === 'quick' && (
        <div className="card">
          <div className="quickTop">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || (round.game === 'wolf' ? 'Wolf' : 'Skins')}</div>
              {round.game === 'skins' && skins && (
                <div className="small">
                  Carry: {skins.carryToNext} skin(s) (${((skins.carryToNext || 0) * (round.stakeCents || 0) / 100).toFixed(0)})
                  {(() => {
                    const leader = round.players
                      .slice()
                      .sort((a, b) => (skins.skinsWon[b.id] || 0) - (skins.skinsWon[a.id] || 0))[0]
                    const n = leader ? skins.skinsWon[leader.id] || 0 : 0
                    return leader ? ` • Leader: ${leader.name} (${n})` : ''
                  })()}
                </div>
              )}
              {round.game === 'wolf' && wolfHole && (
                <div className="small">
                  {(() => {
                    const wolfName = round.players.find((p) => p.id === wolfHole.wolfId)?.name || 'Wolf'
                    const partnerId = (round.wolfPartnerByHole?.[quickHole as HoleNumber] ?? null) as PlayerId | null
                    const partnerName = partnerId ? round.players.find((p) => p.id === partnerId)?.name : null
                    const otherNames = round.players
                      .filter((p) => p.id !== wolfHole.wolfId && p.id !== partnerId)
                      .map((p) => p.name)
                      .join(' + ')

                    const teams = partnerName
                      ? `Teams: ${wolfName} + ${partnerName} vs ${otherNames}`
                      : `Lone Wolf: ${wolfName} vs ${otherNames}`

                    return (
                      <>
                        Hole {quickHole}: Wolf = {wolfName}
                        {' • '}Pairing: {partnerName ? `Wolf + ${partnerName}` : 'Lone Wolf'}
                        {' • '}{teams}
                      </>
                    )
                  })()}
                </div>
              )}
              {round.game === 'bbb' && bbb && (
                <div className="small">
                  BBB • Through {bbb.through}/18 • {round.players
                    .slice()
                    .sort((a, b) => (bbb.pointsByPlayer[b.id] || 0) - (bbb.pointsByPlayer[a.id] || 0))
                    .map((p) => `${p.name} ${bbb.pointsByPlayer[p.id] || 0}`)
                    .join(' • ')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {round.locked ? (
                <>
                  <div className="pill" title="Round is locked (edits disabled)">Locked ✅</div>
                  <button className="btn ghost" onClick={unlockRound} type="button">
                    Unlock
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => lockRound(false)} type="button" title="Lock disables edits (useful once a round is final)">
                  Lock round
                </button>
              )}
              <div className="holePicker">
                {quickHole > 1 ? (
                  <button className="btn ghost" onClick={() => setQuickHole((h) => Math.max(1, h - 1))} type="button">
                    ←
                  </button>
                ) : (
                  <span style={{ width: 44 }} />
                )}
                <select
                  className="input"
                  style={{ width: 110, padding: '10px 10px', fontWeight: 800 }}
                  value={quickHole}
                  onChange={(e) => setQuickHole(Number(e.target.value))}
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      Hole {h}
                    </option>
                  ))}
                </select>
                {quickHole < 18 ? (
                  <button className="btn ghost" onClick={() => setQuickHole((h) => Math.min(18, h + 1))} type="button">
                    →
                  </button>
                ) : (
                  <span style={{ width: 44 }} />
                )}
              </div>
              <button className="btn ghost" onClick={() => setScreen('holes')} type="button">
                Grid
              </button>
            </div>
          </div>

          {round.game === 'skins' && skins && (
            <div className="card" style={{ padding: 12, marginTop: 12, marginBottom: 12 }}>
              <div className="label">Hole story</div>
              {(() => {
                const hr = skins.holeResults.find((x) => x.hole === (quickHole as HoleNumber))
                if (!hr) return <div className="small">No data for this hole yet.</div>

                const entered = round.players.filter((p) => typeof round.strokesByHole[quickHole]?.[p.id] === 'number').length
                const total = round.players.length

                if (entered < total) {
                  const atStake = 1 + (hr.carrySkins || 0)
                  return (
                    <div className="small">
                      Enter scores ({entered}/{total}). If this hole has a winner: <b>{atStake}</b> skin(s) at stake.
                    </div>
                  )
                }

                if (hr.winnerId) {
                  const winner = round.players.find((p) => p.id === hr.winnerId)?.name || 'Winner'
                  const wonCents = hr.wonSkins * (round.stakeCents || 0)
                  return (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="pill">Winner: {winner}</span>
                      <span className="pill">Skins: {hr.wonSkins}</span>
                      <span className="pill">Value: {stakeLabel(wonCents)}</span>
                      <span className="pill">Carry resets</span>
                    </div>
                  )
                }

                // Tie
                const before = hr.carrySkins || 0
                const after = before + 1
                const stake = round.stakeCents || 0
                const nextSkins = after + 1
                const nextCents = nextSkins * stake
                return (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="pill">Result: tie</span>
                    <span className="pill">Carry: {before} → {after}</span>
                    <span className="pill">Carry resets</span>
                    <span className="pill">Next hole: {nextSkins} skin(s) ({stakeLabel(nextCents)})</span>
                  </div>
                )
              })()}
            </div>
          )}

          {round.game === 'bbb' && (
            <div className="card" style={{ padding: 12, marginTop: 12, marginBottom: 12 }}>
              <div className="label">Hole awards</div>
              <div className="small">Pick winners for Bingo/Bango/Bongo (or choose None). No ties in v1.</div>
              <div style={{ height: 10 }} />
              {(() => {
                const hole = quickHole as HoleNumber
                const awards = round.bbbAwardsByHole?.[hole] || emptyHoleAwards()

                const renderAward = (award: BBBAwardType, label: string) => (
                  <div style={{ marginBottom: 10 }}>
                    <div className="small" style={{ fontWeight: 800, marginBottom: 6 }}>{label}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        className={`chip ${awards[award] === null ? 'active' : ''}`}
                        onClick={() => setBBBAwardForHole(hole, award, null)}
                        disabled={!!round.locked}
                        type="button"
                        title="No winner / unknown"
                      >
                        None
                      </button>
                      {round.players.map((p) => (
                        <button
                          key={p.id}
                          className={`chip ${awards[award] === p.id ? 'active' : ''}`}
                          onClick={() => setBBBAwardForHole(hole, award, p.id)}
                          disabled={!!round.locked}
                          type="button"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )

                return (
                  <>
                    {renderAward('bingo', 'Bingo (first on green)')}
                    {renderAward('bango', 'Bango (closest to pin)')}
                    {renderAward('bongo', 'Bongo (first to hole out)')}
                  </>
                )
              })()}
            </div>
          )}

          {round.game === 'wolf' && wolfHole && (
            <div className="card" style={{ padding: 12, marginTop: 12, marginBottom: 12 }}>
              <div className="label">Pick partner for this hole</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {round.players
                  .filter((p) => p.id !== wolfHole.wolfId)
                  .map((p) => {
                    const selected = (round.wolfPartnerByHole?.[quickHole as HoleNumber] ?? null) === p.id
                    return (
                      <button
                        key={p.id}
                        className={`chip ${selected ? 'active' : ''}`}
                        onClick={() => setWolfPartnerForHole(quickHole as HoleNumber, p.id)}
                        disabled={!!round.locked}
                        type="button"
                      >
                        {p.name}
                      </button>
                    )
                  })}
                {(() => {
                  const selected = (round.wolfPartnerByHole?.[quickHole as HoleNumber] ?? null) === null
                  return (
                    <button
                      className={`chip ${selected ? 'active' : ''}`}
                      onClick={() => setWolfPartnerForHole(quickHole as HoleNumber, null)}
                      disabled={!!round.locked}
                      type="button"
                      title="Play lone wolf"
                    >
                      Lone
                    </button>
                  )
                })()}
              </div>
              <div className="small">1) Confirm the Wolf above. 2) Tap a partner (or Lone). 3) Enter scores. This pairing is saved per hole.</div>
            </div>
          )}

          {round.game !== 'bbb' && (
            <div className="row">
              {round.players.map((p) => {
                const val = round.strokesByHole[quickHole]?.[p.id]
                return (
                  <div key={p.id} className="incRow">
                    <div>
                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                    </div>
                    <div className="quickScore">
                      <div className="chipRow" aria-label={`${p.name} quick score buttons`}>
                        {[3, 4, 5, 6, 7].map((n) => (
                          <button
                            key={n}
                            className={`chip ${val === n ? 'active' : ''}`}
                            onClick={() => setStroke(quickHole, p.id, String(n))}
                            disabled={!!round.locked}
                            type="button"
                            title={`Set ${p.name} to ${n}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>

                      <div className="stepper">
                        <button className="stepBtn" onClick={() => incStroke(quickHole, p.id, -1)} disabled={!!round.locked} type="button">
                          −
                        </button>
                        <div className="stepVal">{typeof val === 'number' ? val : '—'}</div>
                        <button
                          className="stepBtn"
                          onClick={() => incStroke(quickHole, p.id, +1)}
                          disabled={!!round.locked}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button className="btn ghost" disabled={!!round.locked} onClick={() => setStroke(quickHole, p.id, '')} title="Clear" type="button">
                      Clear
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="footerActions">
              {quickHole > 1 ? (
                <button className="btn ghost" onClick={() => setQuickHole((h) => Math.max(1, h - 1))} type="button">
                  Prev hole
                </button>
              ) : (
                <span />
              )}

              {quickHole < 18 ? (
                <button className="btn primary" onClick={() => setQuickHole((h) => Math.min(18, h + 1))} type="button">
                  Next hole
                </button>
              ) : (
                <span />
              )}
              <button className="btn" onClick={() => setQuickHole(currentHole())} type="button" title="Jump to the current hole">
                Current
              </button>

              <button
                className="btn"
                onClick={() => {
                  // Jump to next incomplete hole; if all complete, stay on 18.
                  for (let h = Math.min(18, quickHole + 1); h <= 18; h++) {
                    if (!isHoleComplete(h)) {
                      setQuickHole(h)
                      return
                    }
                  }
                  // wrap
                  for (let h = 1; h <= quickHole; h++) {
                    if (!isHoleComplete(h)) {
                      setQuickHole(h)
                      return
                    }
                  }
                  setQuickHole(18)
                }}
                type="button"
              >
                Next incomplete
              </button>

              <button className="btn" onClick={copyStatus} type="button" title="Copy a shareable status summary">
                Share status
              </button>

              {round.game === 'skins' && settlement && (round.locked || isRoundComplete()) && (
                <button className="btn" onClick={shareSettlement} type="button" title="Copy the settlement text to paste in the group chat">
                  Share settlement
                </button>
              )}

              <button className="btn primary" onClick={() => setScreen('settlement')} type="button">
                {round.game === 'wolf' ? 'Standings →' : 'Settlement →'}
              </button>

              <button className="btn ghost" onClick={() => clearHole(quickHole)} disabled={!!round.locked} type="button">
                Clear hole
              </button>

              <button className="btn ghost" onClick={() => setScreen('setup')} type="button">
                Setup
              </button>
            </div>
        </div>
      )}

      {screen === 'settlement' && round.game === 'skins' && settlement && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="label">Settlement</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || 'Skins'}</div>
              <div className="small">Skins stake: {stakeLabel(round.stakeCents || 0)} (winner collects from each opponent)</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {round.locked ? (
                <>
                  <div className="pill" title="Round is locked (edits disabled)">Locked ✅</div>
                  <button className="btn ghost" onClick={unlockRound} type="button">
                    Unlock
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => lockRound(false)} type="button" title="Lock disables edits (useful once a round is final)">
                  Lock round
                </button>
              )}
              <button className="btn ghost" onClick={() => setScreen('quick')} type="button">
                Quick mode
              </button>
              <button className="btn ghost" onClick={() => setScreen('holes')} type="button">
                ← Back to holes
              </button>
              <button className="btn" onClick={copySettlement} type="button">
                Copy settlement
              </button>
              <button
                className={round.locked ? 'btn primary' : 'btn'}
                onClick={shareSettlement}
                type="button"
                title="Copy the settlement text to paste in the group chat"
              >
                Share settlement
              </button>
              <button className="btn" onClick={copyStatus} type="button" title="Copy a shareable status summary">
                Share status
              </button>
              <button className="btn ghost" onClick={resetSameGame} type="button">
                New round
              </button>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div className="row two">
            <div>
              <div className="label">Net by player</div>
              <table className="table">
                <tbody>
                  {round.players.map((p) => {
                    const net = settlement.netByPlayer[p.id] || 0
                    return (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td style={{ textAlign: 'right' }} className={net >= 0 ? 'positive' : 'negative'}>
                          {net >= 0 ? '+' : '-'}${Math.abs(net / 100).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="small">Positive = they should receive money. Negative = they owe.</div>
            </div>

            <div>
              <div className="label">Suggested payments</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.lines.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="small">
                        No payments needed.
                      </td>
                    </tr>
                  ) : (
                    settlement.lines.map((l, idx) => (
                      <tr key={idx}>
                        <td>{l.from.name}</td>
                        <td>{l.to.name}</td>
                        <td style={{ textAlign: 'right' }}>${(l.amountCents / 100).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="small">This is a suggestion to minimize transactions. Pay via Venmo/Cash App/etc.</div>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div className="label">Shareable text</div>
          <textarea className="input" style={{ height: 180 }} readOnly value={settlementText()} />

          <div className="footerActions">
            <button className="btn" onClick={copySettlement} type="button">
              Copy settlement
            </button>
            <button className="btn ghost" onClick={() => setScreen('holes')} type="button">
              Back
            </button>
          </div>
        </div>
      )}

      {screen === 'settlement' && round.game === 'bbb' && bbb && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="label">Standings</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || 'BBB'}</div>
              <div className="small">Bingo Bango Bongo • award-entry</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {round.locked ? (
                <>
                  <div className="pill" title="Round is locked (edits disabled)">Locked ✅</div>
                  <button className="btn ghost" onClick={unlockRound} type="button">
                    Unlock
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => lockRound(false)} type="button" title="Lock disables edits (useful once a round is final)">
                  Lock round
                </button>
              )}
              <button className="btn" onClick={copyStatus} type="button" title="Copy a shareable status summary">
                Share status
              </button>
              {bbbSettlement && (
                <button className={round.locked ? 'btn primary' : 'btn'} onClick={copyBBBSettlement} type="button" title="Copy BBB settlement to paste in the group chat">
                  Share settlement
                </button>
              )}
              <button className="btn ghost" onClick={() => setScreen('quick')} type="button">
                Quick mode
              </button>
              <button className="btn ghost" onClick={() => setScreen('holes')} type="button">
                ← Back to holes
              </button>
              <button className="btn ghost" onClick={resetSameGame} type="button">
                New round
              </button>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div className="label">Points by player</div>
          <table className="table">
            <tbody>
              {round.players
                .slice()
                .sort((a, b) => (bbb.pointsByPlayer[b.id] || 0) - (bbb.pointsByPlayer[a.id] || 0))
                .map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td style={{ textAlign: 'right' }}>{bbb.pointsByPlayer[p.id] || 0}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {bbbSettlement && (
            <>
              <div style={{ height: 14 }} />
              <div className="label">Suggested payments</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bbbSettlement.lines.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="small">No payments needed.</td>
                    </tr>
                  ) : (
                    bbbSettlement.lines.map((l, idx) => (
                      <tr key={idx}>
                        <td>{l.from.name}</td>
                        <td>{l.to.name}</td>
                        <td style={{ textAlign: 'right' }}>${(l.amountCents / 100).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="small">Based on ${dollarsStringFromCents(round.bbbDollarsPerPointCents || 0)} per point.</div>
            </>
          )}

          <div style={{ height: 14 }} />

          <div className="small">Tip: in Quick mode, set Bingo/Bango/Bongo winners (or None) for each hole.</div>
        </div>
      )}

      {screen === 'settlement' && round.game === 'wolf' && wolf && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="label">Standings</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || 'Wolf'}</div>
              <div className="small">{wolfLabel(round.wolfPointsPerHole)} • Lone Wolf = {round.wolfLoneMultiplier || 2}x</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {round.locked ? (
                <>
                  <div className="pill" title="Round is locked (edits disabled)">Locked ✅</div>
                  <button className="btn ghost" onClick={unlockRound} type="button">
                    Unlock
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => lockRound(false)} type="button" title="Lock disables edits (useful once a round is final)">
                  Lock round
                </button>
              )}
              <button className="btn" onClick={copyStatus} type="button" title="Copy a shareable status summary">
                Share status
              </button>
              {wolfSettlement && (
                <button className={round.locked ? 'btn primary' : 'btn'} onClick={copyWolfSettlement} type="button" title="Copy Wolf settlement to paste in the group chat">
                  Share settlement
                </button>
              )}
              <button className="btn ghost" onClick={() => setScreen('quick')} type="button">
                Quick mode
              </button>
              <button className="btn ghost" onClick={() => setScreen('holes')} type="button">
                ← Back to holes
              </button>
              <button className="btn ghost" onClick={resetSameGame} type="button">
                New round
              </button>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div className="label">Points by player</div>
          <table className="table">
            <tbody>
              {round.players
                .slice()
                .sort((a, b) => (wolf.pointsByPlayer[b.id] || 0) - (wolf.pointsByPlayer[a.id] || 0))
                .map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td style={{ textAlign: 'right' }}>{wolf.pointsByPlayer[p.id] || 0}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {wolfSettlement && (
            <>
              <div style={{ height: 14 }} />
              <div className="label">Suggested payments</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {wolfSettlement.lines.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="small">No payments needed.</td>
                    </tr>
                  ) : (
                    wolfSettlement.lines.map((l, idx) => (
                      <tr key={idx}>
                        <td>{l.from.name}</td>
                        <td>{l.to.name}</td>
                        <td style={{ textAlign: 'right' }}>${(l.amountCents / 100).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="small">Based on ${dollarsStringFromCents(round.wolfDollarsPerPointCents || 0)} per point.</div>
            </>
          )}

          <div style={{ height: 14 }} />

          <div className="small">Tip: pick Wolf partner per hole in Quick mode (or tap Lone).</div>
        </div>
      )}
    </Container>
  )
}
