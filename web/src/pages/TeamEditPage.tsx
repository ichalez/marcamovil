import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDoc } from 'firebase/firestore';
import { deleteTeam, newTeamId, saveTeam, teamRef, uploadImage } from '../lib/db';
import { uid } from '../lib/actions';
import { ErrorBox, ImageField, Spinner, useAsync } from '../components/ui';
import { useClub } from './ClubLayout';
import type { Player, Team } from '../types';

const empty = (id: string): Team => ({
  id,
  name: '',
  shortName: '',
  primaryColor: '#1d4ed8',
  secondaryColor: '#ffffff',
  crestUrl: '',
  players: [],
});

/** Convierte texto pegado ("9 Pablo García" por línea) en jugadores. */
function parseRoster(text: string): Player[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d{1,3})[\s.\-–:,;]+(.+)$/);
      return { id: uid(), number: m ? Number(m[1]) : null, name: (m ? m[2] : l).trim() };
    });
}

export default function TeamEditPage() {
  const { club } = useClub();
  const { teamId } = useParams();
  const nav = useNavigate();
  const isNew = teamId === 'nuevo';
  const [team, setTeam] = useState<Team | null>(isNew ? empty(newTeamId(club.id)) : null);
  const [paste, setPaste] = useState('');
  const save = useAsync();
  const upload = useAsync();

  useEffect(() => {
    if (isNew) return;
    getDoc(teamRef(club.id, teamId!)).then((s) => setTeam(s.exists() ? (s.data() as Team) : null));
  }, [club.id, teamId, isNew]);

  if (!team) return <Spinner />;
  const set = (patch: Partial<Team>) => setTeam({ ...team, ...patch });
  const setPlayer = (i: number, patch: Partial<Player>) => {
    const players = [...team.players];
    players[i] = { ...players[i], ...patch };
    set({ players });
  };
  const sorted = () => [...team.players].sort((a, b) => (a.number ?? 999) - (b.number ?? 999));

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save.run(async () => {
          await saveTeam(club.id, {
            ...team,
            name: team.name.trim(),
            shortName: (team.shortName || team.name.slice(0, 3)).trim().toUpperCase(),
            players: sorted().filter((p) => p.name.trim()),
          });
          nav('..', { relative: 'path' });
        });
      }}
    >
      <div className="section-title">
        <h2>{isNew ? 'Nuevo equipo' : team.name}</h2>
      </div>
      <div className="card stack">
        <div className="grid2">
          <label className="field">
            <span className="label">Nombre</span>
            <input type="text" required value={team.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">Abreviatura (marcador, 3-4 letras)</span>
            <input
              type="text"
              maxLength={4}
              value={team.shortName}
              placeholder={team.name.slice(0, 3).toUpperCase()}
              onChange={(e) => set({ shortName: e.target.value.toUpperCase() })}
            />
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span className="label">Color principal</span>
            <input type="color" value={team.primaryColor} onChange={(e) => set({ primaryColor: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">Color secundario</span>
            <input type="color" value={team.secondaryColor} onChange={(e) => set({ secondaryColor: e.target.value })} />
          </label>
          <ImageField
            label="Escudo"
            square
            url={team.crestUrl}
            busy={upload.busy}
            onFile={(f) => upload.run(async () => set({ crestUrl: await uploadImage(club.id, 'crests', f, 400) }))}
          />
        </div>
        <ErrorBox error={upload.error} />
      </div>

      <div className="card stack">
        <div className="section-title">
          <h3 style={{ margin: 0 }}>Plantilla ({team.players.length})</h3>
          <button type="button" className="btn" onClick={() => set({ players: [...team.players, { id: uid(), number: null, name: '' }] })}>
            + Jugador
          </button>
        </div>
        {team.players.map((p, i) => (
          <div key={p.id} className="player-row">
            <input
              type="number"
              min={0}
              max={999}
              placeholder="Nº"
              value={p.number ?? ''}
              onChange={(e) => setPlayer(i, { number: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <input type="text" placeholder="Nombre" value={p.name} onChange={(e) => setPlayer(i, { name: e.target.value })} />
            <button type="button" className="btn ghost icon" onClick={() => set({ players: team.players.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        <details>
          <summary className="muted small" style={{ cursor: 'pointer' }}>
            Pegar lista de jugadores
          </summary>
          <div className="stack" style={{ marginTop: 8 }}>
            <textarea
              rows={6}
              placeholder={'1 Martín\n2 Alberto\n9 Pablo García'}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              disabled={!paste.trim()}
              onClick={() => {
                set({ players: [...team.players, ...parseRoster(paste)] });
                setPaste('');
              }}
            >
              Añadir a la plantilla
            </button>
          </div>
        </details>
      </div>

      <ErrorBox error={save.error} />
      <div className="row between">
        {!isNew ? (
          <button
            type="button"
            className="btn danger"
            onClick={() => confirm(`¿Borrar ${team.name}?`) && save.run(async () => {
              await deleteTeam(club.id, team.id);
              nav('..', { relative: 'path' });
            })}
          >
            Borrar equipo
          </button>
        ) : (
          <span />
        )}
        <div className="row">
          <button type="button" className="btn" onClick={() => nav('..', { relative: 'path' })}>
            Cancelar
          </button>
          <button className="btn primary" disabled={save.busy || upload.busy}>
            Guardar
          </button>
        </div>
      </div>
    </form>
  );
}
