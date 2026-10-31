import type { LiveState, Player, Sponsor, TeamInfo } from '../types';
import { createInitialState } from './actions';

function svgUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function crest(primary: string, secondary: string, letters: string) {
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><path d="M50 4 L94 18 V58 C94 88 72 106 50 116 C28 106 6 88 6 58 V18 Z" fill="${primary}" stroke="${secondary}" stroke-width="6"/><path d="M50 10 V112" stroke="${secondary}" stroke-width="10" opacity=".35"/><text x="50" y="72" font-family="Arial Black,Arial" font-weight="900" font-size="30" text-anchor="middle" fill="${secondary}">${letters}</text></svg>`,
  );
}

function sponsorLogo(text: string, color: string) {
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><rect x="8" y="20" width="80" height="80" rx="18" fill="${color}"/><circle cx="48" cy="60" r="20" fill="#fff"/><text x="104" y="76" font-family="Arial,Helvetica" font-weight="800" font-size="40" fill="#1b2433">${text}</text></svg>`,
  );
}

const roster = (names: string[]): Player[] =>
  names.map((n, i) => ({ id: `p${i}`, number: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16][i] ?? i + 1, name: n }));

export const DEMO_HOME: TeamInfo = {
  id: 'demo-home',
  name: 'CD Río Verde',
  shortName: 'RIO',
  primaryColor: '#0f8a4a',
  secondaryColor: '#ffffff',
  crestUrl: crest('#0f8a4a', '#ffffff', 'RV'),
  players: roster([
    'Martín', 'Alberto', 'Iker', 'Sergio', 'Dani', 'Óscar', 'Raúl', 'Hugo', 'Pablo', 'Adrián', 'Marcos', 'Javi', 'Leo', 'Nico', 'Rubén',
  ]),
};

export const DEMO_AWAY: TeamInfo = {
  id: 'demo-away',
  name: 'UD Montesol',
  shortName: 'MSL',
  primaryColor: '#c62828',
  secondaryColor: '#ffd54f',
  crestUrl: crest('#c62828', '#ffd54f', 'MS'),
  players: roster([
    'Álvaro', 'Jorge', 'Carlos', 'David', 'Mario', 'Víctor', 'Diego', 'Gonzalo', 'Unai', 'Samuel', 'Bruno', 'Eric', 'Aitor', 'Lucas', 'Gael',
  ]),
};

export const DEMO_SPONSORS: Sponsor[] = [
  { id: 's1', name: 'Panadería Sol', logoUrl: sponsorLogo('Panadería', '#f59e0b') },
  { id: 's2', name: 'Talleres Norte', logoUrl: sponsorLogo('Talleres', '#2563eb') },
  { id: 's3', name: 'Bar La Plaza', logoUrl: sponsorLogo('La Plaza', '#db2777') },
];

export function createDemoState(): LiveState {
  return createInitialState({
    clubId: 'demo',
    matchId: 'demo',
    home: DEMO_HOME,
    away: DEMO_AWAY,
    competition: 'Liga Regional',
    venue: 'Campo Municipal',
    round: 'Jornada 7',
    sponsors: DEMO_SPONSORS,
  });
}
