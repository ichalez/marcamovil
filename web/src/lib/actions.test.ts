import { describe, expect, it } from 'vitest';
import {
  addCard,
  addGoal,
  adjustClock,
  createInitialState,
  pauseClock,
  redCards,
  removeEvent,
  scorers,
  setPeriod,
  startClock,
  undoLastEvent,
} from './actions';
import { formatClock, matchSeconds, minuteLabel } from './clock';
import type { TeamInfo } from '../types';

const team = (id: string): TeamInfo => ({
  id,
  name: id,
  shortName: id.toUpperCase().slice(0, 3),
  primaryColor: '#f00',
  secondaryColor: '#fff',
  crestUrl: '',
  players: [],
});

const base = () => createInitialState({ clubId: 'c', matchId: 'm', home: team('local'), away: team('visitante'), now: 0 });

describe('reloj', () => {
  it('cuenta desde el minuto de inicio del periodo', () => {
    let s = setPeriod('2H')(base(), 1000);
    expect(matchSeconds(s, 1000)).toBe(45 * 60);
    expect(formatClock(matchSeconds(s, 1000 + 75_000)!)).toBe('46:15');
    s = pauseClock(s, 1000 + 75_000);
    expect(matchSeconds(s, 999_999)).toBe(45 * 60 + 75);
    s = startClock(s, 2_000_000);
    expect(matchSeconds(s, 2_010_000)).toBe(45 * 60 + 85);
  });

  it('ajusta el tiempo y no baja de cero', () => {
    let s = setPeriod('1H')(base(), 0);
    s = adjustClock(-60_000)(s, 10_000);
    expect(matchSeconds(s, 10_000)).toBe(0);
    s = adjustClock(120_000)(s, 10_000);
    expect(matchSeconds(s, 10_000)).toBe(120);
  });

  it('etiqueta el minuto con descuento', () => {
    const s = setPeriod('1H')(base(), 0);
    expect(minuteLabel(s, 30_000)).toBe("1'");
    expect(minuteLabel(s, 44 * 60_000 + 1)).toBe("45'");
    expect(minuteLabel(s, 46 * 60_000 + 1)).toBe("45+2'");
  });
});

describe('eventos', () => {
  it('suma goles, gol en propia al rival, y deshace', () => {
    let s = setPeriod('1H')(base(), 0);
    s = addGoal('home', { name: 'Ana', number: 9 })(s, 60_000);
    s = addGoal('home', { name: 'Luis', number: 4 }, { ownGoal: true })(s, 120_000);
    expect(s.score).toEqual({ home: 1, away: 1 });
    expect(s.banner?.event?.playerName).toBe('Luis');
    s = undoLastEvent(s, 130_000);
    expect(s.score).toEqual({ home: 1, away: 0 });
    s = removeEvent(s.events[0].id)(s, 140_000);
    expect(s.score).toEqual({ home: 0, away: 0 });
  });

  it('convierte la segunda amarilla en expulsión', () => {
    let s = setPeriod('1H')(base(), 0);
    s = addCard('away', 'yellow', { name: 'Pepe', number: 5 })(s, 1);
    expect(redCards(s, 'away')).toBe(0);
    s = addCard('away', 'yellow', { name: 'Pepe', number: 5 })(s, 2);
    expect(s.events[1].type).toBe('second_yellow');
    expect(redCards(s, 'away')).toBe(1);
  });

  it('agrupa goleadores', () => {
    let s = setPeriod('1H')(base(), 0);
    s = addGoal('home', { name: 'Ana' })(s, 60_000);
    s = addGoal('home', { name: 'Ana' }, { penalty: true })(s, 600_000);
    expect(scorers(s, 'home')).toEqual(["Ana 2', 11' (pen.)"]);
  });
});
