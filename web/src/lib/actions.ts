// Acciones puras sobre el estado en directo: (estado, ahora, ...) => nuevo estado.
// Se usan tanto con Firebase (dentro de una transacción) como en el modo demo.

import type {
  LiveState,
  MatchEvent,
  MatchRules,
  PenaltyResult,
  Period,
  Scene,
  Side,
  Sponsor,
  TeamInfo,
} from '../types';
import { elapsedMs, isPlaying, minuteLabel } from './clock';

export type Action = (s: LiveState, now: number) => LiveState;

export const BANNER_SECONDS = 8;

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');

function clone(s: LiveState): LiveState {
  return JSON.parse(JSON.stringify(s)) as LiveState;
}

function touch(s: LiveState, now: number): LiveState {
  s.updatedAt = now;
  return s;
}

export function createInitialState(params: {
  clubId: string;
  matchId: string;
  home: TeamInfo;
  away: TeamInfo;
  competition?: string;
  venue?: string;
  round?: string;
  sponsors?: Sponsor[];
  rules?: MatchRules;
  now?: number;
}): LiveState {
  return {
    version: 1,
    clubId: params.clubId,
    matchId: params.matchId,
    competition: params.competition ?? '',
    venue: params.venue ?? '',
    round: params.round ?? '',
    home: params.home,
    away: params.away,
    score: { home: 0, away: 0 },
    period: 'PRE',
    clock: { running: false, startedAt: null, accumulatedMs: 0, addedMinutes: 0 },
    rules: params.rules ?? { halfMinutes: 45, extraHalfMinutes: 15 },
    events: [],
    penalties: { home: [], away: [] },
    banner: null,
    scene: 'pre',
    showScorebug: true,
    lowerThird: { visible: false, title: '', subtitle: '' },
    sponsors: params.sponsors ?? [],
    sponsorsVisible: true,
    sponsorRotateSec: 10,
    updatedAt: params.now ?? Date.now(),
  };
}

// ---------- Reloj y fases ----------

export const setPeriod =
  (period: Period): Action =>
  (s0, now) => {
    const s = clone(s0);
    s.period = period;
    const playing = isPlaying(period);
    s.clock = { running: playing, startedAt: playing ? now : null, accumulatedMs: 0, addedMinutes: 0 };
    // Al empezar a jugar se quita la escena a pantalla completa.
    if (playing) s.scene = 'none';
    return touch(s, now);
  };

export const startClock: Action = (s0, now) => {
  if (s0.clock.running || !isPlaying(s0.period)) return s0;
  const s = clone(s0);
  s.clock.running = true;
  s.clock.startedAt = now;
  return touch(s, now);
};

export const pauseClock: Action = (s0, now) => {
  if (!s0.clock.running) return s0;
  const s = clone(s0);
  s.clock.accumulatedMs = elapsedMs(s0.clock, now);
  s.clock.running = false;
  s.clock.startedAt = null;
  return touch(s, now);
};

export const adjustClock =
  (deltaMs: number): Action =>
  (s0, now) => {
    const s = clone(s0);
    const current = elapsedMs(s0.clock, now);
    s.clock.accumulatedMs = Math.max(0, current + deltaMs);
    if (s.clock.running) s.clock.startedAt = now;
    return touch(s, now);
  };

/** Pone el reloj del periodo actual en un tiempo concreto (en segundos dentro del periodo). */
export const setClockInPeriod =
  (seconds: number): Action =>
  (s0, now) => {
    const s = clone(s0);
    s.clock.accumulatedMs = Math.max(0, seconds * 1000);
    if (s.clock.running) s.clock.startedAt = now;
    return touch(s, now);
  };

export const setAddedMinutes =
  (minutes: number): Action =>
  (s0, now) => {
    const s = clone(s0);
    s.clock.addedMinutes = Math.max(0, Math.min(30, Math.round(minutes)));
    return touch(s, now);
  };

// ---------- Eventos ----------

function pushEvent(s: LiveState, ev: MatchEvent, showBanner: boolean, now: number) {
  s.events.push(ev);
  if (showBanner) {
    s.banner = { id: ev.id, kind: 'event', event: ev, shownAt: now, durationSec: BANNER_SECONDS };
  }
}

export interface PlayerRef {
  name?: string;
  number?: number | null;
}

export const addGoal =
  (
    playerSide: Side,
    player: PlayerRef,
    opts: { ownGoal?: boolean; penalty?: boolean; showBanner?: boolean } = {},
  ): Action =>
  (s0, now) => {
    const s = clone(s0);
    const side = opts.ownGoal ? other(playerSide) : playerSide;
    s.score[side] += 1;
    pushEvent(
      s,
      {
        id: uid(),
        type: 'goal',
        side,
        playerName: player.name || undefined,
        playerNumber: player.number ?? null,
        ownGoal: opts.ownGoal || undefined,
        penalty: opts.penalty || undefined,
        minute: minuteLabel(s0, now),
        period: s0.period,
        ts: now,
      },
      opts.showBanner ?? true,
      now,
    );
    return touch(s, now);
  };

function samePlayer(ev: MatchEvent, side: Side, p: PlayerRef): boolean {
  if (ev.side !== side) return false;
  if (p.number != null && ev.playerNumber != null) return ev.playerNumber === p.number;
  return !!p.name && ev.playerName === p.name;
}

export const addCard =
  (side: Side, color: 'yellow' | 'red', player: PlayerRef, showBanner = true): Action =>
  (s0, now) => {
    const s = clone(s0);
    let type: MatchEvent['type'] = color;
    if (color === 'yellow' && (player.name || player.number != null)) {
      const already = s0.events.some((e) => e.type === 'yellow' && samePlayer(e, side, player));
      if (already) type = 'second_yellow';
    }
    pushEvent(
      s,
      {
        id: uid(),
        type,
        side,
        playerName: player.name || undefined,
        playerNumber: player.number ?? null,
        minute: minuteLabel(s0, now),
        period: s0.period,
        ts: now,
      },
      showBanner,
      now,
    );
    return touch(s, now);
  };

export const addSub =
  (side: Side, out: PlayerRef, inn: PlayerRef, showBanner = true): Action =>
  (s0, now) => {
    const s = clone(s0);
    pushEvent(
      s,
      {
        id: uid(),
        type: 'sub',
        side,
        playerName: out.name || undefined,
        playerNumber: out.number ?? null,
        inName: inn.name || undefined,
        inNumber: inn.number ?? null,
        minute: minuteLabel(s0, now),
        period: s0.period,
        ts: now,
      },
      showBanner,
      now,
    );
    return touch(s, now);
  };

export const removeEvent =
  (eventId: string): Action =>
  (s0, now) => {
    const ev = s0.events.find((e) => e.id === eventId);
    if (!ev) return s0;
    const s = clone(s0);
    s.events = s.events.filter((e) => e.id !== eventId);
    if (ev.type === 'goal') s.score[ev.side] = Math.max(0, s.score[ev.side] - 1);
    if (s.banner?.id === eventId) s.banner = null;
    return touch(s, now);
  };

export const undoLastEvent: Action = (s0, now) => {
  const last = s0.events[s0.events.length - 1];
  return last ? removeEvent(last.id)(s0, now) : s0;
};

export const replayBanner =
  (eventId: string): Action =>
  (s0, now) => {
    const ev = s0.events.find((e) => e.id === eventId);
    if (!ev) return s0;
    const s = clone(s0);
    s.banner = { id: uid(), kind: 'event', event: ev, shownAt: now, durationSec: BANNER_SECONDS };
    return touch(s, now);
  };

/** Corrige el marcador a mano, sin registrar evento. */
export const changeScore =
  (side: Side, delta: number): Action =>
  (s0, now) => {
    const s = clone(s0);
    s.score[side] = Math.max(0, s.score[side] + delta);
    return touch(s, now);
  };

// ---------- Penaltis ----------

export const addPenalty =
  (side: Side, result: PenaltyResult): Action =>
  (s0, now) => {
    const s = clone(s0);
    s.penalties[side].push(result);
    return touch(s, now);
  };

export const undoPenalty =
  (side: Side): Action =>
  (s0, now) => {
    const s = clone(s0);
    s.penalties[side].pop();
    return touch(s, now);
  };

export function penaltyScore(s: Pick<LiveState, 'penalties'>, side: Side): number {
  return s.penalties[side].filter((r) => r === 'scored').length;
}

// ---------- Gráficos ----------

export const setScene =
  (scene: Scene): Action =>
  (s0, now) => ({ ...s0, scene, updatedAt: now });

export const setShowScorebug =
  (show: boolean): Action =>
  (s0, now) => ({ ...s0, showScorebug: show, updatedAt: now });

export const setLowerThird =
  (lt: Partial<LiveState['lowerThird']>): Action =>
  (s0, now) => ({ ...s0, lowerThird: { ...s0.lowerThird, ...lt }, updatedAt: now });

export const showTextBanner =
  (title: string, subtitle: string, durationSec = BANNER_SECONDS): Action =>
  (s0, now) => ({
    ...s0,
    banner: { id: uid(), kind: 'text', title, subtitle, shownAt: now, durationSec },
    updatedAt: now,
  });

export const hideBanner: Action = (s0, now) => ({ ...s0, banner: null, updatedAt: now });

export const setSponsorsVisible =
  (visible: boolean): Action =>
  (s0, now) => ({ ...s0, sponsorsVisible: visible, updatedAt: now });

export const setSponsorRotate =
  (sec: number): Action =>
  (s0, now) => ({ ...s0, sponsorRotateSec: Math.max(3, Math.min(120, Math.round(sec))), updatedAt: now });

export const setSponsors =
  (sponsors: Sponsor[]): Action =>
  (s0, now) => ({ ...s0, sponsors, updatedAt: now });

export const updateTeams =
  (home: TeamInfo, away: TeamInfo): Action =>
  (s0, now) => ({ ...s0, home, away, updatedAt: now });

export const updateMeta =
  (meta: Partial<Pick<LiveState, 'competition' | 'venue' | 'round'>>): Action =>
  (s0, now) => ({ ...s0, ...meta, updatedAt: now });

/** Vuelve a dejar el partido como al principio (mantiene equipos y patrocinadores). */
export const resetMatch: Action = (s0, now) =>
  createInitialState({
    clubId: s0.clubId,
    matchId: s0.matchId,
    home: s0.home,
    away: s0.away,
    competition: s0.competition,
    venue: s0.venue,
    round: s0.round,
    sponsors: s0.sponsors,
    rules: s0.rules,
    now,
  });

// ---------- Derivados ----------

export function redCards(s: Pick<LiveState, 'events'>, side: Side): number {
  return s.events.filter((e) => e.side === side && (e.type === 'red' || e.type === 'second_yellow')).length;
}

/** Goles agrupados por jugador, para las pantallas de descanso y final. */
export function scorers(s: Pick<LiveState, 'events'>, side: Side): string[] {
  const map = new Map<string, string[]>();
  for (const e of s.events) {
    if (e.type !== 'goal' || e.side !== side) continue;
    const name = e.playerName || 'Gol';
    const suffix = e.ownGoal ? ' (p.p.)' : e.penalty ? ' (pen.)' : '';
    const list = map.get(name) ?? [];
    list.push(e.minute + suffix);
    map.set(name, list);
  }
  return [...map.entries()].map(([name, mins]) => `${name} ${mins.join(', ')}`);
}
