// Modelo de datos compartido entre el panel, el overlay y (en la fase 2) la app móvil.

export type Side = 'home' | 'away';

/** Fases de un partido de fútbol 11. */
export type Period =
  | 'PRE' // previa, antes de empezar
  | '1H' // primera parte
  | 'HT' // descanso
  | '2H' // segunda parte
  | 'ET_BREAK' // pausa antes de la prórroga
  | 'ET1' // primera parte de la prórroga
  | 'ET_HT' // descanso de la prórroga
  | 'ET2' // segunda parte de la prórroga
  | 'PEN' // tanda de penaltis
  | 'FT'; // final

export interface Player {
  id: string;
  number: number | null;
  name: string;
}

/** Datos de un equipo tal y como los ve el overlay. */
export interface TeamInfo {
  id: string;
  name: string;
  shortName: string; // 3-4 letras para el marcador
  primaryColor: string;
  secondaryColor: string;
  crestUrl: string;
  players: Player[];
}

export interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
}

export type EventType = 'goal' | 'yellow' | 'second_yellow' | 'red' | 'sub';

export interface MatchEvent {
  id: string;
  type: EventType;
  /** Para goles: equipo al que sube el gol (en un gol en propia, el rival del jugador). */
  side: Side;
  playerName?: string;
  playerNumber?: number | null;
  /** Solo para cambios: jugador que entra (playerName es el que sale). */
  inName?: string;
  inNumber?: number | null;
  ownGoal?: boolean;
  penalty?: boolean;
  minute: string; // p. ej. "23'" o "45+2'"
  period: Period;
  ts: number;
}

export interface Banner {
  id: string;
  kind: 'event' | 'text';
  event?: MatchEvent;
  title?: string;
  subtitle?: string;
  shownAt: number;
  durationSec: number;
}

export interface ClockState {
  running: boolean;
  /** Hora (ms epoch) en la que se puso en marcha por última vez. */
  startedAt: number | null;
  /** Tiempo acumulado dentro del periodo actual antes de startedAt. */
  accumulatedMs: number;
  /** Minutos de descuento anunciados. */
  addedMinutes: number;
}

export type Scene = 'none' | 'pre' | 'halftime' | 'fulltime';

export type PenaltyResult = 'scored' | 'missed';

export interface MatchRules {
  halfMinutes: number; // 45 en fútbol 11
  extraHalfMinutes: number; // 15
}

/**
 * Documento público `live/{matchId}`: es lo único que lee el overlay.
 * No debe contener nunca datos sensibles (clave de emisión, etc.).
 */
export interface LiveState {
  version: 1;
  clubId: string;
  matchId: string;
  competition: string;
  venue: string;
  round: string;
  home: TeamInfo;
  away: TeamInfo;
  score: Record<Side, number>;
  period: Period;
  clock: ClockState;
  rules: MatchRules;
  events: MatchEvent[];
  penalties: Record<Side, PenaltyResult[]>;
  banner: Banner | null;
  scene: Scene;
  showScorebug: boolean;
  lowerThird: { visible: boolean; title: string; subtitle: string };
  sponsors: Sponsor[];
  sponsorsVisible: boolean;
  sponsorRotateSec: number;
  updatedAt: number;
}

// ---- Documentos privados del club (solo miembros) ----

export type Role = 'admin' | 'operator';

export interface Club {
  id: string;
  name: string;
  memberUids: string[];
  roles: Record<string, Role>;
  memberInfo: Record<string, { email: string; name: string }>;
  invitedEmails: string[];
  createdAt: number;
}

export interface Team extends TeamInfo {
  updatedAt?: number;
}

export type StreamQuality = '480p30' | '720p30' | '1080p30';

export interface StreamConfig {
  /** 'key': clave RTMP pegada a mano. 'oauth': emisión creada con la API de YouTube (fase posterior). */
  mode: 'key' | 'oauth';
  rtmpUrl: string;
  streamKey: string;
  quality: StreamQuality;
  adaptiveBitrate: boolean;
}

export interface Match {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  competition: string;
  venue: string;
  round: string;
  scheduledAt: string; // datetime-local
  status: 'scheduled' | 'live' | 'finished';
  stream: StreamConfig;
  createdAt: number;
  createdBy: string;
}
