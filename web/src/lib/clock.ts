import type { ClockState, LiveState, MatchRules, Period } from '../types';

export const PLAYING_PERIODS: Period[] = ['1H', '2H', 'ET1', 'ET2'];

export function isPlaying(p: Period): boolean {
  return PLAYING_PERIODS.includes(p);
}

/** Minuto de inicio y duración nominal de cada periodo de juego. */
export function periodBounds(p: Period, rules: MatchRules): { startMin: number; lengthMin: number } | null {
  const h = rules.halfMinutes;
  const e = rules.extraHalfMinutes;
  switch (p) {
    case '1H':
      return { startMin: 0, lengthMin: h };
    case '2H':
      return { startMin: h, lengthMin: h };
    case 'ET1':
      return { startMin: 2 * h, lengthMin: e };
    case 'ET2':
      return { startMin: 2 * h + e, lengthMin: e };
    default:
      return null;
  }
}

export function elapsedMs(clock: ClockState, now: number): number {
  const running = clock.running && clock.startedAt != null ? Math.max(0, now - clock.startedAt) : 0;
  return Math.max(0, clock.accumulatedMs + running);
}

/** Segundos totales de partido que debe mostrar el reloj, o null si no se está jugando. */
export function matchSeconds(state: Pick<LiveState, 'period' | 'clock' | 'rules'>, now: number): number | null {
  const b = periodBounds(state.period, state.rules);
  if (!b) return null;
  return b.startMin * 60 + Math.floor(elapsedMs(state.clock, now) / 1000);
}

export function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Minuto "futbolístico" de un evento: 0:30 es el minuto 1; en el descuento, "45+2'". */
export function minuteLabel(state: Pick<LiveState, 'period' | 'clock' | 'rules'>, now: number): string {
  const b = periodBounds(state.period, state.rules);
  if (!b) {
    if (state.period === 'PEN') return 'Pen.';
    return '';
  }
  const inPeriod = Math.floor(elapsedMs(state.clock, now) / 60000) + 1;
  if (inPeriod > b.lengthMin) return `${b.startMin + b.lengthMin}+${inPeriod - b.lengthMin}'`;
  return `${b.startMin + inPeriod}'`;
}

export const PERIOD_LABEL: Record<Period, string> = {
  PRE: 'Previa',
  '1H': '1ª parte',
  HT: 'Descanso',
  '2H': '2ª parte',
  ET_BREAK: 'Antes de la prórroga',
  ET1: '1ª parte prórroga',
  ET_HT: 'Descanso prórroga',
  ET2: '2ª parte prórroga',
  PEN: 'Penaltis',
  FT: 'Final',
};

/** Etiqueta corta para el marcador del overlay. */
export const PERIOD_SHORT: Record<Period, string> = {
  PRE: 'PREVIA',
  '1H': '1T',
  HT: 'DESC.',
  '2H': '2T',
  ET_BREAK: 'PRÓRR.',
  ET1: 'PR 1',
  ET_HT: 'DESC.',
  ET2: 'PR 2',
  PEN: 'PEN.',
  FT: 'FINAL',
};

/** Siguientes fases posibles desde la actual (la primera es la habitual). */
export function nextPeriods(p: Period): Period[] {
  switch (p) {
    case 'PRE':
      return ['1H'];
    case '1H':
      return ['HT'];
    case 'HT':
      return ['2H'];
    case '2H':
      return ['FT', 'ET_BREAK', 'PEN'];
    case 'ET_BREAK':
      return ['ET1'];
    case 'ET1':
      return ['ET_HT'];
    case 'ET_HT':
      return ['ET2'];
    case 'ET2':
      return ['FT', 'PEN'];
    case 'PEN':
      return ['FT'];
    case 'FT':
      return [];
  }
}

export const NEXT_PERIOD_ACTION: Record<Period, string> = {
  PRE: 'Previa',
  '1H': 'Empezar 1ª parte',
  HT: 'Descanso',
  '2H': 'Empezar 2ª parte',
  ET_BREAK: 'Ir a prórroga',
  ET1: 'Empezar prórroga',
  ET_HT: 'Descanso prórroga',
  ET2: 'Empezar 2ª parte prórroga',
  PEN: 'Tanda de penaltis',
  FT: 'Finalizar partido',
};
