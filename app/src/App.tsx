import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardBody,
  Container,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useColorMode,
  useToast,
  VStack,
  Wrap,
  WrapItem,
  Table,
  TableContainer,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@chakra-ui/react'
import { BookOpen, ChevronRight, Dice5, Moon, RotateCw, Sun, Trophy, Users } from 'lucide-react'

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
import { TRACK_EVENTS, exportTrackedEvents, track } from './logic/track'

type Screen = 'game' | 'setup' | 'holes' | 'quick' | 'settlement'

type GameMeta = {
  label: string
  short: string
  Icon: typeof Sun
  rules: string[]
}

const GAME_META: Record<GameType, GameMeta> = {
  skins: {
    label: 'Skins',
    short: 'Skins',
    Icon: Dice5,
    rules: [
      'Each hole is worth 1 skin (+ carries).',
      'Lowest score wins the skin. Ties carry to the next hole.',
      'Winner collects stake from each opponent.',
    ],
  },
  wolf: {
    label: 'Wolf',
    short: 'Wolf',
    Icon: Users,
    rules: [
      'Wolf rotates each hole. Choose partner (or Lone).',
      'Best-ball teams compete each hole for points.',
      'Optional: $/pt settlement based on points.',
    ],
  },
  bbb: {
    label: 'Bingo Bango Bongo',
    short: 'BBB',
    Icon: Trophy,
    rules: [
      'Each hole has 3 awards: Bingo (first on green), Bango (closest), Bongo (first in).',
      'Award-entry only (no strokes). 1 point per award won.',
      'Optional: $/pt settlement based on points.',
    ],
  },
}

function GameRules({ game, defaultOpen = false }: { game: GameType; defaultOpen?: boolean }) {
  const meta = GAME_META[game]
  const [open, setOpen] = useState<boolean>(defaultOpen)

  return (
    <div className="rulesCard">
      <div className="rulesHeader">
        <Button
          variant="tertiary"
          size="sm"
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? 'Hide rules' : 'Show rules'}
          leftIcon={<Icon as={BookOpen} boxSize={4} aria-hidden="true" />}
        >
          Rules
        </Button>
      </div>

      {open && (
        <ul className="rulesList">
          {meta.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

const THEME_KEY = 'rubislabs:golf-bets:theme:v1'
const IOS_HINT_DISMISSED_AT_KEY = 'rubislabs:golf-bets:ios-hint:dismissed-at:v1'
const IOS_HINT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

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

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const touchMac = /Macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || touchMac
  const isWebKit = /WebKit/i.test(ua)
  const notSafari = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)
  return isIOS && isWebKit && !notSafari
}

function shouldShowIOSHint(): boolean {
  if (!isIOSSafari()) return false
  try {
    const raw = localStorage.getItem(IOS_HINT_DISMISSED_AT_KEY)
    if (!raw) return true
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return true
    return Date.now() - ts >= IOS_HINT_COOLDOWN_MS
  } catch {
    return true
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

function roundStakeOrPointsLabel(round: Round): string {
  if (round.game === 'wolf') return wolfLabel(round.wolfPointsPerHole)
  if (round.game === 'bbb') return `$${((round.bbbDollarsPerPointCents || 0) / 100).toFixed(0)}/pt`
  return stakeLabel(round.stakeCents || 0)
}

function roundLastUpdatedLabel(round: Round): string | null {
  if (!round.createdAt || !Number.isFinite(round.createdAt)) return null
  return new Date(round.createdAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function withSelectedMark(selected: boolean, label: string | number): string {
  return selected ? `✓ ${label}` : String(label)
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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const toast = useToast()
  const { colorMode, setColorMode } = useColorMode()

  useEffect(() => {
    // Keep legacy CSS theme in sync while we migrate UI to Chakra.
    applyTheme(theme)
    if (theme !== colorMode) setColorMode(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  // Local persistence
  const [stored, setStored] = useState(() => loadRounds())
  const [showIOSHint, setShowIOSHint] = useState<boolean>(() => shouldShowIOSHint())
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
  const recentRounds = useMemo(
    () =>
      stored.rounds
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 10),
    [stored],
  )
  const activeSavedRound = useMemo(() => {
    const id = stored.activeRoundId
    if (!id) return null
    return stored.rounds.find((r) => r.id === id) || null
  }, [stored])
  const activeRoundThrough = useMemo(() => {
    if (!activeSavedRound) return null
    if (activeSavedRound.game === 'bbb') return computeBBB(activeSavedRound).through

    for (let h = 18; h >= 1; h--) {
      const by = activeSavedRound.strokesByHole[h]
      const complete = activeSavedRound.players.every((p) => typeof by?.[p.id] === 'number')
      if (complete) return h
    }
    return 0
  }, [activeSavedRound])

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
  const undoActionId = useRef(0)
  const undoRef = useRef<{ id: number; timeoutId: number; restore: () => void; toastId: string } | null>(null)

  useEffect(() => {
    return () => {
      if (undoRef.current) window.clearTimeout(undoRef.current.timeoutId)
    }
  }, [])

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

  const nextIncompleteHoleFrom = (fromHole: number): number | null => {
    for (let h = Math.min(18, fromHole + 1); h <= 18; h++) {
      if (!isHoleComplete(h)) return h
    }
    for (let h = 1; h <= Math.max(1, fromHole); h++) {
      if (!isHoleComplete(h)) return h
    }
    return null
  }

  const hasIncompleteHoles = () => {
    for (let h = 1; h <= 18; h++) {
      if (!isHoleComplete(h)) return true
    }
    return false
  }

  const currentHole = () => {
    const through = lastCompletedHole()
    return Math.min(18, through + 1)
  }

  function clearHole(hole: number) {
    if (round.locked) return

    if (round.game === 'bbb') {
      if (!confirm(`Clear all awards for hole ${hole}?`)) return
      track(TRACK_EVENTS.bbb_hole_clear, { hole })
      let previousAwards: ReturnType<typeof emptyHoleAwards> | null = null
      setRound((r) => {
        if (r.game !== 'bbb') return r
        const cur = r.bbbAwardsByHole || {}
        previousAwards = cur[hole as HoleNumber] ? { ...cur[hole as HoleNumber] } : null
        if (!previousAwards) return r
        const next = { ...cur }
        delete next[hole as HoleNumber]
        return { ...r, bbbAwardsByHole: next }
      })
      if (previousAwards) {
        const restoreAwards = previousAwards as ReturnType<typeof emptyHoleAwards>
        registerUndo({
          label: `Cleared hole ${hole}`,
          restore: () =>
            setRound((r) => {
              if (r.game !== 'bbb') return r
              const cur = r.bbbAwardsByHole || {}
              return {
                ...r,
                bbbAwardsByHole: {
                  ...cur,
                  [hole as HoleNumber]: restoreAwards,
                },
              }
            }),
        })
      }
      return
    }

    if (!confirm(`Clear all scores for hole ${hole}?`)) return

    let previousHole: Record<PlayerId, number | null> | null = null
    let didClear = false
    setRound((r) => {
      const holeRec = r.strokesByHole[hole] || {}
      previousHole = { ...holeRec }
      const nextHole: Record<PlayerId, number | null> = { ...holeRec }
      for (const p of r.players) nextHole[p.id] = null
      const hadAnyValue = r.players.some((p) => typeof holeRec[p.id] === 'number')
      if (!hadAnyValue) return r
      didClear = true
      return {
        ...r,
        strokesByHole: {
          ...r.strokesByHole,
          [hole]: nextHole,
        },
      }
    })
    if (didClear && previousHole) {
      const restoreHole = previousHole as Record<PlayerId, number | null>
      registerUndo({
        label: `Cleared hole ${hole}`,
        restore: () =>
          setRound((r) => ({
            ...r,
            strokesByHole: {
              ...r.strokesByHole,
              [hole]: restoreHole,
            },
          })),
      })
    }
  }

  function clearScoreWithUndo(hole: number, playerId: PlayerId) {
    if (round.locked || round.game === 'bbb') return
    let previousValue: number | null | undefined
    setRound((r) => {
      const holeRec = r.strokesByHole[hole] || {}
      previousValue = holeRec[playerId] ?? null
      if (previousValue === null) return r
      return {
        ...r,
        strokesByHole: {
          ...r.strokesByHole,
          [hole]: {
            ...holeRec,
            [playerId]: null,
          },
        },
      }
    })
    if (typeof previousValue !== 'number') return
    const playerName = round.players.find((p) => p.id === playerId)?.name || 'Player'
    registerUndo({
      label: `Cleared ${playerName} on hole ${hole}`,
      restore: () =>
        setRound((r) => {
          const holeRec = r.strokesByHole[hole] || {}
          return {
            ...r,
            strokesByHole: {
              ...r.strokesByHole,
              [hole]: {
                ...holeRec,
                [playerId]: previousValue ?? null,
              },
            },
          }
        }),
    })
  }

  function registerUndo(params: { label: string; restore: () => void }) {
    if (undoRef.current) {
      window.clearTimeout(undoRef.current.timeoutId)
      toast.close(undoRef.current.toastId)
      undoRef.current = null
    }

    const id = ++undoActionId.current
    const toastId = `undo-${id}`
    const timeoutId = window.setTimeout(() => {
      if (undoRef.current?.id === id) undoRef.current = null
      toast.close(toastId)
    }, 8000)

    undoRef.current = { id, timeoutId, restore: params.restore, toastId }

    toast({
      id: toastId,
      duration: 8000,
      position: 'bottom',
      isClosable: true,
      render: () => (
        <Box className="undoToast">
          <Text fontSize="sm" fontWeight={700}>
            {params.label}
          </Text>
          <Button
            size="sm"
            minH="44px"
            variant="secondary"
            onClick={() => {
              const cur = undoRef.current
              if (!cur || cur.id !== id) return
              window.clearTimeout(cur.timeoutId)
              undoRef.current = null
              toast.close(toastId)
              cur.restore()
            }}
            type="button"
          >
            Undo
          </Button>
        </Box>
      ),
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

  function startNew(game: GameType) {
    track(TRACK_EVENTS.round_new, { game })
    setRound(game === 'wolf' ? createEmptyWolfRound() : game === 'bbb' ? createEmptyBBBRound() : createEmptySkinsRound())
    setScreen('setup')
  }

  function loadExistingRound(r: Round, nextScreen: Screen = 'holes') {
    setRound(r)
    setScreen(nextScreen)
    setStored((prev) => {
      const next = { ...prev, activeRoundId: r.id }
      saveRounds(next)
      return next
    })
  }

  function dismissIOSHint() {
    setShowIOSHint(false)
    try {
      localStorage.setItem(IOS_HINT_DISMISSED_AT_KEY, String(Date.now()))
    } catch {
      // ignore
    }
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
      track(TRACK_EVENTS.share_status, { game: round.game })
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
      track(TRACK_EVENTS.share_settlement, { game: 'wolf', centsPerPoint: round.wolfDollarsPerPointCents || 0 })
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
      track(TRACK_EVENTS.share_settlement, { game: 'bbb', centsPerPoint: round.bbbDollarsPerPointCents || 0 })
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
    track(TRACK_EVENTS.round_lock, { game: round.game, screen, andGoToSettlement })
    setRound((r) => ({ ...r, locked: true }))
    if (andGoToSettlement) setScreen('settlement')
  }

  function unlockRound() {
    if (!confirm('Unlock round? This allows edits and may change standings/settlement.')) return
    track(TRACK_EVENTS.round_unlock, { game: round.game, screen })
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
    track(TRACK_EVENTS.bbb_award_set, { hole, award, winnerId })
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

  const quickThrough = round.game === 'bbb' ? bbb?.through ?? 0 : lastCompletedHole()
  const nextIncompleteHole = nextIncompleteHoleFrom(quickHole)

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
          <Stack spacing={3} mb={4}>
            <Text fontSize="sm" fontWeight={800} color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
              No account. Saved on this device.
            </Text>

            {activeSavedRound && (
              <Box borderWidth="1px" borderRadius="12px" p={3} w="full">
                <Text fontSize="sm" fontWeight={700}>
                  Active round
                </Text>
                <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                  {GAME_META[activeSavedRound.game].label} • {activeSavedRound.name || GAME_META[activeSavedRound.game].short}
                </Text>
                <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mb={2}>
                  {activeSavedRound.players.map((p) => p.name).join(', ')}
                </Text>
                <HStack spacing={2} mb={3} flexWrap="wrap">
                  <Box className="pill">Through {activeRoundThrough ?? 0}/18</Box>
                  <Box className="pill">Saved locally</Box>
                </HStack>
                <Button
                  variant="primary"
                  size="md"
                  w="full"
                  type="button"
                  onClick={() => {
                    track(TRACK_EVENTS.nav_screen, { from: 'game', to: 'quick', resume: true, game: activeSavedRound.game })
                    loadExistingRound(activeSavedRound, 'quick')
                  }}
                >
                  Resume active round
                </Button>
              </Box>
            )}

            {showIOSHint && (
              <HStack justify="space-between" align="flex-start" spacing={3} borderWidth="1px" borderRadius="12px" p={3}>
                <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                  On iPhone/iPad: tap Share, then Add to Home Screen (or Bookmark) for faster access.
                </Text>
                <Button size="sm" variant="tertiary" onClick={dismissIOSHint} type="button">
                  Dismiss
                </Button>
              </HStack>
            )}
          </Stack>

          <Text fontSize="md" fontWeight={700} color={theme === 'dark' ? 'gray.300' : 'gray.600'} mb={3}>
            {activeSavedRound ? 'Start a new round' : 'Choose a game'}
          </Text>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
            <Button
              variant={activeSavedRound ? 'secondary' : 'primary'}
              rightIcon={<Icon as={ChevronRight} boxSize={4} aria-hidden="true" />}
              onClick={() => startNew('skins')}
              type="button"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <Icon as={GAME_META.skins.Icon} aria-hidden="true" boxSize={4} />
                {GAME_META.skins.label}
              </span>
            </Button>

            <Button
              variant="secondary"
              rightIcon={<Icon as={ChevronRight} boxSize={4} aria-hidden="true" />}
              onClick={() => startNew('wolf')}
              type="button"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <Icon as={GAME_META.wolf.Icon} aria-hidden="true" boxSize={4} />
                {GAME_META.wolf.label}
              </span>
            </Button>

            <Button
              variant="secondary"
              rightIcon={<Icon as={ChevronRight} boxSize={4} aria-hidden="true" />}
              onClick={() => startNew('bbb')}
              type="button"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <Icon as={GAME_META.bbb.Icon} aria-hidden="true" boxSize={4} />
                {GAME_META.bbb.label}
              </span>
            </Button>
          </SimpleGrid>

          <div style={{ height: 18 }} />

          <HStack justify="space-between" align="center" mb={2}>
            <Text fontSize="sm" fontWeight={800} color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
              Recent rounds
            </Text>

            <Button variant="tertiary" size="sm" type="button" onClick={() => setShowAdvanced((v) => !v)} aria-expanded={showAdvanced}>
              {showAdvanced ? 'Hide advanced' : 'Advanced'}
            </Button>
          </HStack>

          {showAdvanced && (
            <Box borderWidth="1px" borderRadius="12px" p={3} mb={3}>
              <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mb={2}>
                Diagnostics
              </Text>
              <Button
                variant="tertiary"
                size="sm"
                type="button"
                onClick={async () => {
                  try {
                    const payload = exportTrackedEvents()
                    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
                    track(TRACK_EVENTS.debug_export, { eventCount: payload.events.length })
                    alert('Copied debug export JSON to clipboard')
                  } catch {
                    alert('Could not copy debug export. You can open DevTools and read localStorage instead.')
                  }
                }}
                title="Copy local debug events (JSON)"
              >
                Debug export
              </Button>
            </Box>
          )}

          {recentRounds.length > 0 && (
            <>
              <Stack spacing={3} display={{ base: 'flex', md: 'none' }}>
                {recentRounds.map((r) => {
                  const label = r.name || (r.game === 'wolf' ? 'Wolf' : r.game === 'bbb' ? 'BBB' : 'Skins')
                  const lastUpdated = roundLastUpdatedLabel(r)

                  return (
                    <Box key={r.id} borderWidth="1px" borderRadius="12px" p={3}>
                      <Text fontWeight={700}>{label}</Text>
                      <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                        {r.game === 'wolf' ? 'Wolf' : r.game === 'bbb' ? 'BBB' : 'Skins'}
                      </Text>
                      <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                        {r.players.map((p) => p.name).join(', ')}
                      </Text>
                      <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                        {roundStakeOrPointsLabel(r)}
                      </Text>
                      {lastUpdated && (
                        <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                          Last updated {lastUpdated}
                        </Text>
                      )}
                      <SimpleGrid columns={2} spacing={2} mt={3}>
                        <Button
                          variant="tertiary"
                          size="md"
                          minH="44px"
                          onClick={() => loadExistingRound(r)}
                          type="button"
                        >
                          Open
                        </Button>
                        <Button
                          variant="danger"
                          size="md"
                          minH="44px"
                          onClick={() => {
                            const ok = confirm(`Delete “${label}”?`)
                            if (!ok) return
                            deleteExistingRound(r.id)
                          }}
                          type="button"
                        >
                          Delete
                        </Button>
                      </SimpleGrid>
                    </Box>
                  )
                })}
              </Stack>

              <TableContainer w="full" overflowX="auto" borderRadius="16px" display={{ base: 'none', md: 'block' }}>
                <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Game</Th>
                    <Th>Name</Th>
                    <Th>Players</Th>
                    <Th textAlign="right">Stake</Th>
                    <Th textAlign="right">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {recentRounds.map((r) => (
                      <Tr key={r.id}>
                        <Td>
                          <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                            {r.game === 'wolf' ? 'Wolf' : r.game === 'bbb' ? 'BBB' : 'Skins'}
                          </Text>
                        </Td>
                        <Td>{r.name || (r.game === 'wolf' ? 'Wolf' : r.game === 'bbb' ? 'BBB' : 'Skins')}</Td>
                        <Td>
                          <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                            {r.players.map((p) => p.name).join(', ')}
                          </Text>
                        </Td>
                        <Td textAlign="right">
                          {roundStakeOrPointsLabel(r)}
                        </Td>
                        <Td textAlign="right">
                          <Stack
                            direction={{ base: 'column', sm: 'row' }}
                            align={{ base: 'stretch', sm: 'center' }}
                            justify={{ base: 'flex-end', sm: 'flex-end' }}
                            spacing={2}
                            w={{ base: '140px', sm: 'auto' }}
                            ml="auto"
                          >
                            <Button variant="tertiary" size="sm" onClick={() => loadExistingRound(r)} type="button">
                              Open
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                const label = r.name || (r.game === 'wolf' ? 'Wolf' : r.game === 'bbb' ? 'BBB' : 'Skins')
                                const ok = confirm(`Delete “${label}”?`)
                                if (!ok) return
                                deleteExistingRound(r.id)
                              }}
                              type="button"
                            >
                              Delete
                            </Button>
                          </Stack>
                        </Td>
                      </Tr>
                    ))}
                </Tbody>
                </Table>
              </TableContainer>
            </>
          )}
        </Box>
      )}

      {screen === 'setup' && (
        <Card variant="outline">
          <CardBody>
            <Stack spacing={5}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <HStack justify="space-between" align="center" mb={2}>
                    <FormLabel m={0}>Round name</FormLabel>
                    <IconButton
                      aria-label="Reroll name"
                      icon={<Icon as={RotateCw} boxSize={5} aria-hidden="true" />}
                      variant="tertiary"
                      size="sm"
                      onClick={() =>
                        setRound((r) => ({
                          ...r,
                          name: r.game === 'skins' ? randomSkinsName() : r.game === 'wolf' ? randomWolfName() : randomBBBName(),
                        }))
                      }
                      title="Reroll name"
                    />
                  </HStack>
                  <Input
                    value={round.name}
                    onChange={(e) => setRound((r) => ({ ...r, name: e.target.value }))}
                    placeholder="Saturday skins"
                  />
                  <Box mt={3}>
                    <GameRules game={round.game} defaultOpen={false} />
                  </Box>
                </FormControl>

                {round.game === 'skins' ? (
                  <FormControl>
                    <FormLabel>$ per skin</FormLabel>
                    <Input
                      value={dollarsStringFromCents(round.stakeCents || 0)}
                      onChange={(e) => setRound((r) => ({ ...r, stakeCents: centsFromDollarsString(e.target.value) }))}
                      inputMode="decimal"
                      placeholder="5"
                    />
                  </FormControl>
                ) : round.game === 'wolf' ? (
                  <Stack spacing={3}>
                    <FormControl>
                      <FormLabel>Points per hole</FormLabel>
                      <Input
                        value={String(round.wolfPointsPerHole ?? 1)}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          if (!Number.isFinite(n)) return
                          setRound((r) => ({ ...r, wolfPointsPerHole: Math.max(1, Math.min(10, Math.round(n))) }))
                        }}
                        inputMode="numeric"
                        placeholder="1"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>$ per point (optional)</FormLabel>
                      <Input
                        value={dollarsStringFromCents(round.wolfDollarsPerPointCents || 0)}
                        onChange={(e) => setRound((r) => ({ ...r, wolfDollarsPerPointCents: centsFromDollarsString(e.target.value) }))}
                        inputMode="decimal"
                        placeholder=""
                      />
                    </FormControl>
                  </Stack>
                ) : (
                  <FormControl>
                    <FormLabel>$ per point (optional)</FormLabel>
                    <Input
                      value={dollarsStringFromCents(round.bbbDollarsPerPointCents || 0)}
                      onChange={(e) => setRound((r) => ({ ...r, bbbDollarsPerPointCents: centsFromDollarsString(e.target.value) }))}
                      inputMode="decimal"
                      placeholder=""
                    />
                    <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={2}>
                      Settlement uses points × $/pt when set.
                    </Text>
                  </FormControl>
                )}
              </SimpleGrid>

              <Divider />

              <Box>
                <HStack justify="space-between" align="baseline" mb={2}>
                  <Text fontSize="sm" fontWeight={800} color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                    Players
                  </Text>
                  {round.game !== 'wolf' && (
                    <Button onClick={addPlayer} isDisabled={round.players.length >= 4} variant="secondary" size="sm" type="button">
                      + Add player
                    </Button>
                  )}
                </HStack>


                <VStack spacing={3} align="stretch">
                  {round.players.map((p, idx) => (
                    <HStack key={p.id} spacing={3} align="center">
                      <Input
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
                      {round.game === 'skins' && round.players.length > 2 && (
                        <Button variant="tertiary" size="sm" onClick={() => removePlayer(p.id)} type="button">
                          Remove
                        </Button>
                      )}
                    </HStack>
                  ))}
                </VStack>
              </Box>

              <Divider />

              <HStack spacing={3} flexWrap="wrap">
                <Button
                  variant="primary"
                  isDisabled={!canStart}
                  onClick={() => {
                    track(TRACK_EVENTS.round_start, { game: round.game, playerCount: round.players.length })
                    setScreen('quick')
                  }}
                  type="button"
                >
                  Start round →
                </Button>

                <Button
                  variant="secondary"
                  isDisabled={!canStart}
                  onClick={() => {
                    track(TRACK_EVENTS.nav_screen, { from: 'setup', to: 'holes', game: round.game })
                    setScreen('holes')
                  }}
                  type="button"
                >
                  Grid view
                </Button>

                <Button variant="tertiary" onClick={resetToGamePicker} type="button">
                  New game
                </Button>
              </HStack>
            </Stack>
          </CardBody>
        </Card>
      )}

      {screen === 'holes' && (
        <Card variant="outline">
          <CardBody pb={{ base: '96px', md: 6 }}>
            <Stack spacing={4}>
              <HStack justify="space-between" align="flex-start" spacing={4} flexWrap="wrap">
                <Box>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800}>
                    Round
                  </Text>
                  <Text fontSize="lg" fontWeight={800}>
                    {round.name || (round.game === 'wolf' ? 'Wolf' : round.game === 'bbb' ? 'BBB' : 'Skins')}
                  </Text>

                  {round.game === 'skins' && skins && (
                    <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={1}>
                      Carry: {skins.carryToNext} skin(s) (${((skins.carryToNext || 0) * (round.stakeCents || 0) / 100).toFixed(0)})
                      {(() => {
                        const leader = round.players
                          .slice()
                          .sort((a, b) => (skins.skinsWon[b.id] || 0) - (skins.skinsWon[a.id] || 0))[0]
                        const n = leader ? skins.skinsWon[leader.id] || 0 : 0
                        return leader ? ` • Leader: ${leader.name} (${n})` : ''
                      })()}
                    </Text>
                  )}

                  {round.game === 'wolf' && wolf && (
                    <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={1}>
                      Points leader:{' '}
                      {
                        round.players
                          .slice()
                          .sort((a, b) => (wolf.pointsByPlayer[b.id] || 0) - (wolf.pointsByPlayer[a.id] || 0))[0]?.name
                      }
                    </Text>
                  )}

                  {round.game === 'bbb' && bbb && (
                    <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={1}>
                      Points leader:{' '}
                      {
                        round.players
                          .slice()
                          .sort((a, b) => (bbb.pointsByPlayer[b.id] || 0) - (bbb.pointsByPlayer[a.id] || 0))[0]?.name
                      }
                    </Text>
                  )}
                </Box>

                <Wrap spacing={2} justify="flex-end">
                  <WrapItem>
                    {round.locked && (
                      <Box className="pill" aria-label="Locked">
                        Locked <span role="img" aria-label="Locked">✅</span>
                      </Box>
                    )}
                  </WrapItem>

                  <WrapItem>
                    {!round.locked ? (
                      <Button variant="secondary" size="sm" onClick={() => lockRound(false)} type="button" title="Lock disables edits (useful once a round is final)">
                        Lock round
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={unlockRound} type="button">
                        Unlock
                      </Button>
                    )}
                  </WrapItem>

                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={() => setScreen('quick')} type="button">
                      Quick mode
                    </Button>
                  </WrapItem>

                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={() => setScreen('setup')} type="button">
                      ← Setup
                    </Button>
                  </WrapItem>

                  <WrapItem>
                    <Button variant="secondary" size="sm" onClick={copyStatus} type="button" title="Copy a shareable status summary">
                      Share status
                    </Button>
                  </WrapItem>

                  {round.game === 'skins' && settlement && (round.locked || isRoundComplete()) && (
                    <WrapItem>
                      <Button variant={round.locked ? 'primary' : 'secondary'} size="sm" onClick={shareSettlement} type="button" title="Copy the settlement text to paste in the group chat">
                        Share settlement
                      </Button>
                    </WrapItem>
                  )}

                  {round.game === 'bbb' && bbbSettlement && (round.locked || isRoundComplete()) && (
                    <WrapItem>
                      <Button variant={round.locked ? 'primary' : 'secondary'} size="sm" onClick={copyBBBSettlement} type="button" title="Copy the settlement text to paste in the group chat">
                        Share settlement
                      </Button>
                    </WrapItem>
                  )}

                  <WrapItem>
                    <Button variant="primary" size="sm" onClick={() => setScreen('settlement')} type="button">
                      {round.game === 'wolf' || round.game === 'bbb' ? 'Standings →' : 'Settlement →'}
                    </Button>
                  </WrapItem>
                </Wrap>
              </HStack>

            {round.game === 'skins' && settlement && !round.locked && isRoundComplete() && (
              <Card variant="outline" mt={3}>
                <CardBody>
                  <Stack spacing={3}>
                    <Text fontWeight={800}>Round complete</Text>
                    <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                      Lock the round to prevent edits, then share the settlement to the group.
                    </Text>
                    <Wrap spacing={2}>
                      <WrapItem>
                        <Button variant="primary" size="sm" onClick={() => lockRound(true)} type="button">
                          Lock + open settlement →
                        </Button>
                      </WrapItem>
                      <WrapItem>
                        <Button variant="secondary" size="sm" onClick={shareSettlement} type="button">
                          Share settlement
                        </Button>
                      </WrapItem>
                    </Wrap>
                  </Stack>
                </CardBody>
              </Card>
            )}

            {round.game === 'wolf' && wolf && !round.locked && isRoundComplete() && (
              <Card variant="outline" mt={3}>
                <CardBody>
                  <Stack spacing={3}>
                    <Text fontWeight={800}>Round complete</Text>
                    <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                      Lock the round to prevent edits, then share standings (and settlement if $/pt is set).
                    </Text>
                    <Wrap spacing={2}>
                      <WrapItem>
                        <Button variant="primary" size="sm" onClick={() => lockRound(true)} type="button">
                          Lock + open standings →
                        </Button>
                      </WrapItem>
                      <WrapItem>
                        <Button variant="secondary" size="sm" onClick={copyStatus} type="button">
                          Share standings
                        </Button>
                      </WrapItem>
                      {wolfSettlement && (
                        <WrapItem>
                          <Button variant="secondary" size="sm" onClick={copyWolfSettlement} type="button">
                            Share settlement
                          </Button>
                        </WrapItem>
                      )}
                    </Wrap>
                  </Stack>
                </CardBody>
              </Card>
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
                            <Button variant="tertiary" size="sm" type="button" onClick={() => { setQuickHole(hole); setScreen('quick') }}>
                              {hole}
                            </Button>
                          </div>
                          <div className="holeCell">{nameFor(a?.bingo)}</div>
                          <div className="holeCell">{nameFor(a?.bango)}</div>
                          <div className="holeCell">{nameFor(a?.bongo)}</div>
                          <div className="holeCell" style={{ textAlign: 'right' }}>
                            {done ? <span role="img" aria-label="Complete">✅</span> : <span aria-label="Incomplete">—</span>}
                          </div>
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
                              <Button
                                variant="tertiary"
                                size="sm"
                                onClick={() => clearHole(hole)}
                                isDisabled={!!round.locked}
                                type="button"
                                aria-label={`Clear hole ${hole}`}
                              >
                                Clear
                              </Button>
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
                              <Input
                                size="sm"
                                value={String(round.strokesByHole[hole]?.[p.id] ?? '')}
                                onChange={(e) => setStroke(hole, p.id, e.target.value)}
                                inputMode="numeric"
                                placeholder="-"
                                textAlign="center"
                                aria-label={`Hole ${hole}, ${p.name} strokes`}
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
                              <Button
                                variant="tertiary"
                                size="sm"
                                onClick={() => clearHole(hole)}
                                isDisabled={!!round.locked}
                                type="button"
                                aria-label={`Clear hole ${hole}`}
                              >
                                Clear
                              </Button>
                            </div>
                          </div>

                          <div className="holeCell">
                            <span className="small">{label}</span>
                          </div>

                          {round.players.map((p) => (
                            <div key={p.id} className="holeCell">
                              <Input
                                size="sm"
                                value={String(round.strokesByHole[hole]?.[p.id] ?? '')}
                                onChange={(e) => setStroke(hole, p.id, e.target.value)}
                                inputMode="numeric"
                                placeholder="-"
                                textAlign="center"
                                aria-label={`Hole ${hole}, ${p.name} strokes`}
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
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Box>
                  <Text fontSize="sm" fontWeight={800} color={theme === 'dark' ? 'gray.300' : 'gray.600'} mb={2}>
                    Skins won
                  </Text>
                  <Table size="sm">
                    <Tbody>
                      {round.players.map((p) => (
                        <Tr key={p.id}>
                          <Td>{p.name}</Td>
                          <Td textAlign="right">{skins.skinsWon[p.id] || 0}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight={800} color={theme === 'dark' ? 'gray.300' : 'gray.600'} mb={2}>
                    Per-hole (winner / carry)
                  </Text>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Hole</Th>
                        <Th>Winner</Th>
                        <Th textAlign="right">Skins</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {skins.holeResults.map((hr) => {
                        const winner = hr.winnerId ? round.players.find((p) => p.id === hr.winnerId)?.name : '—'
                        const label = hr.winnerId ? winner : `tie (carry)`
                        return (
                          <Tr key={hr.hole}>
                            <Td>{hr.hole}</Td>
                            <Td>{label}</Td>
                            <Td textAlign="right">{hr.winnerId ? hr.wonSkins : hr.carrySkins ? `+${hr.carrySkins}` : '—'}</Td>
                          </Tr>
                        )
                      })}
                    </Tbody>
                  </Table>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={2}>
                    Note: ties carry 1 skin forward. Carry resets on a win. Ties after 18 remain unresolved.
                  </Text>
                </Box>
              </SimpleGrid>
            )}

            {round.game === 'wolf' && wolf && (
              <Box>
                <Text fontSize="sm" fontWeight={800} color={theme === 'dark' ? 'gray.300' : 'gray.600'} mb={2}>
                  Points (leaderboard)
                </Text>
                <Table size="sm">
                  <Tbody>
                    {round.players
                      .slice()
                      .sort((a, b) => (wolf.pointsByPlayer[b.id] || 0) - (wolf.pointsByPlayer[a.id] || 0))
                      .map((p) => (
                        <Tr key={p.id}>
                          <Td>{p.name}</Td>
                          <Td textAlign="right">{wolf.pointsByPlayer[p.id] || 0}</Td>
                        </Tr>
                      ))}
                  </Tbody>
                </Table>
                <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={2}>
                  Wolf rotates each hole (starting from Player 1 on hole 1). Choose partner in Quick mode (or play Lone Wolf).
                </Text>
              </Box>
            )}

            <Box display={{ base: 'block', md: 'none' }} className="gridEscapeRail" aria-label="Back to quick mode rail">
              <Button
                size="md"
                minH="44px"
                w="full"
                variant="solid"
                onClick={() => setScreen('quick')}
                type="button"
              >
                Back to Quick
              </Button>
            </Box>
            </Stack>
          </CardBody>
        </Card>
      )}

      {screen === 'quick' && (
        <Card variant="outline">
          <CardBody pb={{ base: '112px', md: 6 }}>
            <Stack spacing={4}>
              <HStack justify="space-between" align="flex-start" spacing={3} flexWrap="wrap">
                <Box>
                  <HStack spacing={3} align="center" flexWrap="wrap">
                    <Text fontWeight={800} fontSize="lg">
                      {round.name || GAME_META[round.game].short}
                    </Text>
                    <Box className="pill" aria-label="Progress">
                      Through {quickThrough}/18
                    </Box>
                    <Button variant="tertiary" size="sm" onClick={() => setScreen('settlement')} type="button">
                      Summary →
                    </Button>
                    {round.locked && (
                      <Box className="pill" aria-label="Locked">
                        Locked <span role="img" aria-label="Locked">✅</span>
                      </Box>
                    )}
                  </HStack>

                  {round.game === 'skins' && skins && (
                    <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={1}>
                      Carry: {skins.carryToNext} skin(s) (${((skins.carryToNext || 0) * (round.stakeCents || 0) / 100).toFixed(0)})
                      {(() => {
                        const leader = round.players
                          .slice()
                          .sort((a, b) => (skins.skinsWon[b.id] || 0) - (skins.skinsWon[a.id] || 0))[0]
                        const n = leader ? skins.skinsWon[leader.id] || 0 : 0
                        return leader ? ` • Leader: ${leader.name} (${n})` : ''
                      })()}
                    </Text>
                  )}

                  {round.game === 'wolf' && wolfHole && (
                    <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={1}>
                      {(() => {
                        const wolfName = round.players.find((p) => p.id === wolfHole.wolfId)?.name || 'Wolf'
                        const partnerId = (round.wolfPartnerByHole?.[quickHole as HoleNumber] ?? null) as PlayerId | null
                        const partnerName = partnerId ? round.players.find((p) => p.id === partnerId)?.name : null
                        const otherNames = round.players
                          .filter((p) => p.id !== wolfHole.wolfId && p.id !== partnerId)
                          .map((p) => p.name)
                          .join(' + ')

                        const teams = partnerName ? `Teams: ${wolfName} + ${partnerName} vs ${otherNames}` : `Lone Wolf: ${wolfName} vs ${otherNames}`

                        return `Hole ${quickHole}: Wolf = ${wolfName} • ${teams}`
                      })()}
                    </Text>
                  )}

                  {round.game === 'bbb' && bbb && (
                    <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={1}>
                      BBB • Through {bbb.through}/18 • {round.players
                        .slice()
                        .sort((a, b) => (bbb.pointsByPlayer[b.id] || 0) - (bbb.pointsByPlayer[a.id] || 0))
                        .map((p) => `${p.name} ${bbb.pointsByPlayer[p.id] || 0}`)
                        .join(' • ')}
                    </Text>
                  )}
                </Box>

                <HStack spacing={2} align="center" flexWrap="wrap" justify="flex-end">
                  <Button variant="tertiary" size="sm" onClick={() => setQuickHole((h) => Math.max(1, h - 1))} isDisabled={quickHole <= 1} type="button">
                    ←
                  </Button>

                  <FormControl w="120px">
                    <Input
                      value={String(quickHole)}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (!Number.isFinite(n)) return
                        setQuickHole(Math.max(1, Math.min(18, Math.round(n))))
                      }}
                      inputMode="numeric"
                      aria-label="Hole"
                    />
                  </FormControl>

                  <Button variant="tertiary" size="sm" onClick={() => setQuickHole((h) => Math.min(18, h + 1))} isDisabled={quickHole >= 18} type="button">
                    →
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const next = nextIncompleteHoleFrom(quickHole)
                      if (next !== null) setQuickHole(next)
                    }}
                    isDisabled={nextIncompleteHoleFrom(quickHole) === null}
                    type="button"
                    title="Jump to next incomplete hole"
                  >
                    Next incomplete
                  </Button>

                  <Button variant="secondary" size="sm" onClick={() => setScreen('holes')} type="button">
                    Grid
                  </Button>
                </HStack>
              </HStack>

              <Divider />

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
                    <Wrap spacing={2}>
                      <WrapItem>
                            <Button
                              size="sm"
                              variant={awards[award] === null ? 'solid' : 'outline'}
                          onClick={() => setBBBAwardForHole(hole, award, null)}
                          isDisabled={!!round.locked}
                          type="button"
                          title="No winner / unknown"
                          aria-pressed={awards[award] === null}
                            >
                              {withSelectedMark(awards[award] === null, 'None')}
                            </Button>
                          </WrapItem>
                      {round.players.map((p) => (
                        <WrapItem key={p.id}>
                          <Button
                            size="sm"
                            variant={awards[award] === p.id ? 'solid' : 'outline'}
                            onClick={() => setBBBAwardForHole(hole, award, p.id)}
                            isDisabled={!!round.locked}
                            type="button"
                            aria-pressed={awards[award] === p.id}
                          >
                            {withSelectedMark(awards[award] === p.id, p.name)}
                          </Button>
                        </WrapItem>
                      ))}
                    </Wrap>
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
              <Wrap spacing={2}>
                {round.players
                  .filter((p) => p.id !== wolfHole.wolfId)
                  .map((p) => {
                    const selected = (round.wolfPartnerByHole?.[quickHole as HoleNumber] ?? null) === p.id
                    return (
                      <WrapItem key={p.id}>
                        <Button
                          size="sm"
                          variant={selected ? 'solid' : 'outline'}
                          onClick={() => setWolfPartnerForHole(quickHole as HoleNumber, p.id)}
                          isDisabled={!!round.locked}
                          type="button"
                          aria-pressed={selected}
                        >
                          {withSelectedMark(selected, p.name)}
                        </Button>
                      </WrapItem>
                    )
                  })}
                {(() => {
                  const selected = (round.wolfPartnerByHole?.[quickHole as HoleNumber] ?? null) === null
                  return (
                    <WrapItem>
                      <Button
                        size="sm"
                        variant={selected ? 'solid' : 'outline'}
                        onClick={() => setWolfPartnerForHole(quickHole as HoleNumber, null)}
                        isDisabled={!!round.locked}
                        type="button"
                        title="Play lone wolf"
                        aria-pressed={selected}
                      >
                        {withSelectedMark(selected, 'Lone')}
                      </Button>
                    </WrapItem>
                  )
                })()}
              </Wrap>
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
                      <div className="small">Preset buttons or +/-</div>
                    </div>
                    <div className="quickScore">
                      <Wrap spacing={2} aria-label={`${p.name} quick score buttons`}>
                        {[3, 4, 5, 6, 7].map((n) => (
                          <WrapItem key={n}>
                            <Button
                              size="sm"
                              variant={val === n ? 'solid' : 'outline'}
                              onClick={() => setStroke(quickHole, p.id, String(n))}
                              isDisabled={!!round.locked}
                              type="button"
                              title={`Set ${p.name} to ${n}`}
                              aria-pressed={val === n}
                            >
                              {withSelectedMark(val === n, n)}
                            </Button>
                          </WrapItem>
                        ))}
                      </Wrap>

                      <HStack spacing={2} mt={2}>
                        <IconButton
                          aria-label={`Decrease ${p.name}`}
                          icon={<span aria-hidden="true">−</span>}
                          size="sm"
                          variant="outline"
                          onClick={() => incStroke(quickHole, p.id, -1)}
                          isDisabled={!!round.locked}
                          type="button"
                        />
                        <Box
                          minW="44px"
                          textAlign="center"
                          fontWeight={800}
                          color={typeof val === 'number' ? (theme === 'dark' ? 'brand.300' : 'brand.600') : undefined}
                        >
                          {typeof val === 'number' ? val : '—'}
                        </Box>
                        <IconButton
                          aria-label={`Increase ${p.name}`}
                          icon={<span aria-hidden="true">+</span>}
                          size="sm"
                          variant="outline"
                          onClick={() => incStroke(quickHole, p.id, +1)}
                          isDisabled={!!round.locked}
                          type="button"
                        />
                      </HStack>
                    </div>
                    <Button
                      size="sm"
                      variant="tertiary"
                      isDisabled={!!round.locked}
                      onClick={() => clearScoreWithUndo(quickHole, p.id)}
                      title="Clear score"
                      type="button"
                    >
                      Clear score
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          <Stack spacing={3}>
            {/* Navigation (clean, no weird wrap) */}
            <SimpleGrid columns={3} spacing={2} display={{ base: 'none', md: 'grid' }}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuickHole((h) => Math.max(1, h - 1))}
                isDisabled={quickHole <= 1}
                type="button"
                w="full"
                aria-label="Previous hole"
              >
                Prev
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuickHole(currentHole())}
                type="button"
                title="Jump to the current hole"
                w="full"
                aria-label="Jump to current hole"
              >
                Current
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuickHole((h) => Math.min(18, h + 1))}
                isDisabled={quickHole >= 18}
                type="button"
                w="full"
                aria-label="Next hole"
              >
                Next
              </Button>
            </SimpleGrid>

            <Button
              size="sm"
              variant="solid"
              onClick={() => {
                const nextHole = nextIncompleteHole
                setQuickHole(nextHole ?? 18)
              }}
              isDisabled={!hasIncompleteHoles()}
              type="button"
              w="full"
              display={{ base: 'none', md: 'inline-flex' }}
            >
              Next incomplete
            </Button>

            <Wrap spacing={2} justify={{ base: 'center', sm: 'space-between' }}>
              <WrapItem>
                <Button size="sm" variant="secondary" onClick={copyStatus} type="button" title="Copy a shareable status summary">
                  Share status
                </Button>
              </WrapItem>

              {round.game === 'skins' && settlement && (round.locked || isRoundComplete()) && (
                <WrapItem>
                  <Button size="sm" variant="secondary" onClick={shareSettlement} type="button" title="Copy the settlement text to paste in the group chat">
                    Share settlement
                  </Button>
                </WrapItem>
              )}

              <WrapItem>
                <Button size="sm" variant="secondary" onClick={() => setScreen('settlement')} type="button">
                  {round.game === 'wolf' ? 'Standings →' : 'Settlement →'}
                </Button>
              </WrapItem>

              <WrapItem>
                <Button size="sm" variant="outline" onClick={() => clearHole(quickHole)} isDisabled={!!round.locked} type="button">
                  Clear hole
                </Button>
              </WrapItem>

              <WrapItem>
                <Button size="sm" variant="outline" onClick={() => setScreen('setup')} type="button">
                  Setup
                </Button>
              </WrapItem>

              <WrapItem>
                {round.locked ? (
                  <Button size="sm" variant="outline" onClick={unlockRound} type="button">
                    Unlock
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => lockRound(false)} type="button" title="Lock disables edits (useful once a round is final)">
                    Lock
                  </Button>
                )}
              </WrapItem>

              <WrapItem>
                <Button size="sm" variant="outline" onClick={resetToGamePicker} type="button">
                  New game
                </Button>
              </WrapItem>
            </Wrap>
          </Stack>

          <Box display={{ base: 'block', md: 'none' }} className="quickRail" aria-label="Quick mode navigation rail">
            <SimpleGrid columns={3} spacing={2}>
              <Button
                size="md"
                minH="44px"
                variant="outline"
                onClick={() => setQuickHole((h) => Math.max(1, h - 1))}
                isDisabled={quickHole <= 1}
                type="button"
                w="full"
                aria-label="Previous hole"
              >
                Prev
              </Button>
              <Button
                size="md"
                minH="44px"
                variant="solid"
                onClick={() => {
                  const nextHole = nextIncompleteHole
                  setQuickHole(nextHole ?? 18)
                }}
                isDisabled={!hasIncompleteHoles()}
                type="button"
                w="full"
                aria-label="Next incomplete hole"
              >
                Next incomplete
              </Button>
              <Button
                size="md"
                minH="44px"
                variant="outline"
                onClick={() => setQuickHole((h) => Math.min(18, h + 1))}
                isDisabled={quickHole >= 18}
                type="button"
                w="full"
                aria-label="Next hole"
              >
                Next
              </Button>
            </SimpleGrid>
          </Box>

            </Stack>
          </CardBody>
        </Card>
      )}

      {screen === 'settlement' && round.game === 'skins' && settlement && (
        <Card variant="outline">
          <CardBody>
            <Stack spacing={4}>
              <GameRules game={round.game} defaultOpen={false} />

              <HStack justify="space-between" align="flex-start" spacing={4} flexWrap="wrap">
                <Box>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800}>
                    Settlement
                  </Text>
                  <Text fontSize="lg" fontWeight={800}>
                    {round.name || 'Skins'}
                  </Text>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                    Skins stake: {stakeLabel(round.stakeCents || 0)} (winner collects from each opponent)
                  </Text>
                </Box>

                <Wrap spacing={2} justify="flex-end">
                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={() => setScreen('quick')} type="button">
                      Quick mode
                    </Button>
                  </WrapItem>
                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={() => setScreen('holes')} type="button">
                      ← Back to holes
                    </Button>
                  </WrapItem>
                  <WrapItem>
                    <Button variant="secondary" size="sm" onClick={copySettlement} type="button">
                      Copy settlement
                    </Button>
                  </WrapItem>
                  <WrapItem>
                    <Button variant={round.locked ? 'primary' : 'secondary'} size="sm" onClick={shareSettlement} type="button" title="Copy the settlement text to paste in the group chat">
                      Share settlement
                    </Button>
                  </WrapItem>
                  <WrapItem>
                    <Button variant="secondary" size="sm" onClick={copyStatus} type="button" title="Copy a shareable status summary">
                      Share status
                    </Button>
                  </WrapItem>
                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={resetToGamePicker} type="button">
                      New game
                    </Button>
                  </WrapItem>
                </Wrap>
              </HStack>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Box>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800} mb={2}>
                    Net by player
                  </Text>
                  <Table size="sm">
                    <Tbody>
                      {round.players.map((p) => {
                        const net = settlement.netByPlayer[p.id] || 0
                        return (
                          <Tr key={p.id}>
                            <Td>{p.name}</Td>
                            <Td textAlign="right" className={net >= 0 ? 'positive' : 'negative'}>
                              {net >= 0 ? '+' : '-'}${Math.abs(net / 100).toFixed(2)}
                            </Td>
                          </Tr>
                        )
                      })}
                    </Tbody>
                  </Table>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={2}>
                    Positive = they should receive money. Negative = they owe.
                  </Text>
                </Box>

                <Box>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800} mb={2}>
                    Money (suggested payments)
                  </Text>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>From</Th>
                        <Th>To</Th>
                        <Th textAlign="right">Amount</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {settlement.lines.length === 0 ? (
                        <Tr>
                          <Td colSpan={3}>
                            <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                              No payments needed.
                            </Text>
                          </Td>
                        </Tr>
                      ) : (
                        settlement.lines.map((l, idx) => (
                          <Tr key={idx}>
                            <Td>{l.from.name}</Td>
                            <Td>{l.to.name}</Td>
                            <Td textAlign="right">${(l.amountCents / 100).toFixed(2)}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={2}>
                    This is a suggestion to minimize transactions. Pay via Venmo/Cash App/etc.
                  </Text>
                </Box>
              </SimpleGrid>

              <Box>
                <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800} mb={2}>
                  Shareable text
                </Text>
                <Textarea h="180px" readOnly value={settlementText()} />
              </Box>

              <Wrap spacing={2} justify="flex-end">
                <WrapItem>
                  <Button variant="secondary" size="sm" onClick={copySettlement} type="button">
                    Copy settlement
                  </Button>
                </WrapItem>
                <WrapItem>
                  <Button variant="tertiary" size="sm" onClick={() => setScreen('holes')} type="button">
                    Back
                  </Button>
                </WrapItem>
              </Wrap>
            </Stack>
          </CardBody>
        </Card>
      )}

      {screen === 'settlement' && round.game === 'bbb' && bbb && (
        <Card variant="outline">
          <CardBody>
            <Stack spacing={4}>
              <GameRules game={round.game} defaultOpen={false} />

              <HStack justify="space-between" align="flex-start" spacing={4} flexWrap="wrap">
                <Box>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800}>
                    Standings
                  </Text>
                  <Text fontSize="lg" fontWeight={800}>
                    {round.name || 'BBB'}
                  </Text>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                    Bingo Bango Bongo • award-entry
                  </Text>
                </Box>

                <Wrap spacing={2} justify="flex-end">
                  <WrapItem>
                    <Button variant="secondary" size="sm" onClick={copyStatus} type="button" title="Copy a shareable status summary">
                      Share status
                    </Button>
                  </WrapItem>
                  {bbbSettlement && (
                    <WrapItem>
                      <Button variant={round.locked ? 'primary' : 'secondary'} size="sm" onClick={copyBBBSettlement} type="button" title="Copy BBB settlement to paste in the group chat">
                        Share settlement
                      </Button>
                    </WrapItem>
                  )}
                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={() => setScreen('quick')} type="button">
                      Quick mode
                    </Button>
                  </WrapItem>
                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={() => setScreen('holes')} type="button">
                      ← Back to holes
                    </Button>
                  </WrapItem>
                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={resetToGamePicker} type="button">
                      New game
                    </Button>
                  </WrapItem>
                </Wrap>
              </HStack>

              <Box>
                <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800} mb={2}>
                  Points by player
                </Text>
                <Table size="sm">
                  <Tbody>
                    {round.players
                      .slice()
                      .sort((a, b) => (bbb.pointsByPlayer[b.id] || 0) - (bbb.pointsByPlayer[a.id] || 0))
                      .map((p) => (
                        <Tr key={p.id}>
                          <Td>{p.name}</Td>
                          <Td textAlign="right">{bbb.pointsByPlayer[p.id] || 0}</Td>
                        </Tr>
                      ))}
                  </Tbody>
                </Table>
              </Box>

              {bbbSettlement && (
                <Box>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800} mb={2}>
                    Money (suggested payments)
                  </Text>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>From</Th>
                        <Th>To</Th>
                        <Th textAlign="right">Amount</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {bbbSettlement.lines.length === 0 ? (
                        <Tr>
                          <Td colSpan={3}>
                            <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                              No payments needed.
                            </Text>
                          </Td>
                        </Tr>
                      ) : (
                        bbbSettlement.lines.map((l, idx) => (
                          <Tr key={idx}>
                            <Td>{l.from.name}</Td>
                            <Td>{l.to.name}</Td>
                            <Td textAlign="right">${(l.amountCents / 100).toFixed(2)}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={2}>
                    Based on ${dollarsStringFromCents(round.bbbDollarsPerPointCents || 0)} per point.
                  </Text>
                </Box>
              )}

              <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                Tip: in Quick mode, set Bingo/Bango/Bongo winners (or None) for each hole.
              </Text>
            </Stack>
          </CardBody>
        </Card>
      )}

      {screen === 'settlement' && round.game === 'wolf' && wolf && (
        <Card variant="outline">
          <CardBody>
            <Stack spacing={4}>
              <GameRules game={round.game} defaultOpen={false} />

              <HStack justify="space-between" align="flex-start" spacing={4} flexWrap="wrap">
                <Box>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800}>
                    Standings
                  </Text>
                  <Text fontSize="lg" fontWeight={800}>
                    {round.name || 'Wolf'}
                  </Text>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                    {wolfLabel(round.wolfPointsPerHole)} • Lone Wolf = {round.wolfLoneMultiplier || 2}x
                  </Text>
                </Box>

                <Wrap spacing={2} justify="flex-end">
                  <WrapItem>
                    <Button variant="secondary" size="sm" onClick={copyStatus} type="button" title="Copy a shareable status summary">
                      Share status
                    </Button>
                  </WrapItem>
                  {wolfSettlement && (
                    <WrapItem>
                      <Button variant={round.locked ? 'primary' : 'secondary'} size="sm" onClick={copyWolfSettlement} type="button" title="Copy Wolf settlement to paste in the group chat">
                        Share settlement
                      </Button>
                    </WrapItem>
                  )}
                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={() => setScreen('quick')} type="button">
                      Quick mode
                    </Button>
                  </WrapItem>
                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={() => setScreen('holes')} type="button">
                      ← Back to holes
                    </Button>
                  </WrapItem>
                  <WrapItem>
                    <Button variant="tertiary" size="sm" onClick={resetToGamePicker} type="button">
                      New game
                    </Button>
                  </WrapItem>
                </Wrap>
              </HStack>

              <Box>
                <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800} mb={2}>
                  Points by player
                </Text>
                <Table size="sm">
                  <Tbody>
                    {round.players
                      .slice()
                      .sort((a, b) => (wolf.pointsByPlayer[b.id] || 0) - (wolf.pointsByPlayer[a.id] || 0))
                      .map((p) => (
                        <Tr key={p.id}>
                          <Td>{p.name}</Td>
                          <Td textAlign="right">{wolf.pointsByPlayer[p.id] || 0}</Td>
                        </Tr>
                      ))}
                  </Tbody>
                </Table>
              </Box>

              {wolfSettlement && (
                <Box>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} fontWeight={800} mb={2}>
                    Money (suggested payments)
                  </Text>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>From</Th>
                        <Th>To</Th>
                        <Th textAlign="right">Amount</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {wolfSettlement.lines.length === 0 ? (
                        <Tr>
                          <Td colSpan={3}>
                            <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                              No payments needed.
                            </Text>
                          </Td>
                        </Tr>
                      ) : (
                        wolfSettlement.lines.map((l, idx) => (
                          <Tr key={idx}>
                            <Td>{l.from.name}</Td>
                            <Td>{l.to.name}</Td>
                            <Td textAlign="right">${(l.amountCents / 100).toFixed(2)}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                  <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'} mt={2}>
                    Based on ${dollarsStringFromCents(round.wolfDollarsPerPointCents || 0)} per point.
                  </Text>
                </Box>
              )}

              <Text fontSize="sm" color={theme === 'dark' ? 'gray.300' : 'gray.600'}>
                Tip: pick Wolf partner per hole in Quick mode (or tap Lone).
              </Text>
            </Stack>
          </CardBody>
        </Card>
      )}
    </Container>
  )
}
