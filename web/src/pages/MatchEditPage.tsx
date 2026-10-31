import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDoc, orderBy, query } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '../hooks/useFirestore';
import { createMatch, deleteMatch, matchRef, teamsCol, updateMatch } from '../lib/db';
import { CopyButton, ErrorBox, Spinner, useAsync } from '../components/ui';
import { useClub } from './ClubLayout';
import type { Match, StreamConfig, StreamQuality, Team } from '../types';

export const YT_RTMP = 'rtmp://a.rtmp.youtube.com/live2';

export const QUALITY: Record<StreamQuality, string> = {
  '480p30': '480p · 30 fps · ~1,2 Mbps (conexión muy justa)',
  '720p30': '720p · 30 fps · ~2,5 Mbps (recomendado con 4G)',
  '1080p30': '1080p · 30 fps · ~4,5 Mbps (WiFi o 5G)',
};

type Form = Omit<Match, 'id' | 'createdAt' | 'createdBy' | 'status' | 'homeName' | 'awayName'>;

const defaultStream: StreamConfig = { mode: 'key', rtmpUrl: YT_RTMP, streamKey: '', quality: '720p30', adaptiveBitrate: true };

function defaultDate() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function MatchEditPage() {
  const { club } = useClub();
  const { user } = useAuth();
  const { matchId } = useParams();
  const nav = useNavigate();
  const isNew = !matchId;
  const teamsQ = useMemo(() => query(teamsCol(club.id), orderBy('name')), [club.id]);
  const teams = useQuery<Team>(teamsQ, `teams-${club.id}`);
  const [form, setForm] = useState<Form | null>(
    isNew
      ? { homeTeamId: '', awayTeamId: '', competition: '', venue: '', round: '', scheduledAt: defaultDate(), stream: defaultStream }
      : null,
  );
  const [status, setStatus] = useState<Match['status']>('scheduled');
  const [showKey, setShowKey] = useState(false);
  const act = useAsync();

  useEffect(() => {
    if (isNew) return;
    getDoc(matchRef(club.id, matchId!)).then((s) => {
      if (!s.exists()) return;
      const m = s.data() as Match;
      setStatus(m.status);
      setForm({
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        competition: m.competition,
        venue: m.venue,
        round: m.round,
        scheduledAt: m.scheduledAt,
        stream: { ...defaultStream, ...m.stream },
      });
    });
  }, [club.id, matchId, isNew]);

  if (!form || teams.loading) return <Spinner />;
  if (teams.data.length < 2)
    return (
      <div className="empty stack">
        <span>Necesitas al menos dos equipos (el tuyo y el rival) para crear un partido.</span>
        <div>
          <Link className="btn primary" to="../../equipos/nuevo" relative="path">
            Crear equipo
          </Link>
        </div>
      </div>
    );

  const set = (p: Partial<Form>) => setForm({ ...form, ...p });
  const setStream = (p: Partial<StreamConfig>) => set({ stream: { ...form.stream, ...p } });
  const home = teams.data.find((t) => t.id === form.homeTeamId);
  const away = teams.data.find((t) => t.id === form.awayTeamId);
  const overlayUrl = matchId ? `${window.location.origin}/overlay/${matchId}` : '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!home || !away) return act.setError('Elige los dos equipos.');
    if (home.id === away.id) return act.setError('Los equipos deben ser distintos.');
    act.run(async () => {
      if (isNew) {
        const id = await createMatch(club.id, user!, form, home, away);
        nav(`../${id}`, { relative: 'path', replace: true });
      } else {
        await updateMatch(club.id, matchId!, form, { home, away });
        nav('..', { relative: 'path' });
      }
    });
  };

  const teamSelect = (key: 'homeTeamId' | 'awayTeamId', label: string) => (
    <label className="field">
      <span className="label">{label}</span>
      <select required value={form[key]} onChange={(e) => set({ [key]: e.target.value })}>
        <option value="">Elige equipo…</option>
        {teams.data.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form className="stack" onSubmit={submit}>
      <div className="section-title">
        <h2>{isNew ? 'Nuevo partido' : 'Editar partido'}</h2>
        {!isNew && (
          <Link className="btn primary" to={`/control/${matchId}`}>
            Abrir panel de control
          </Link>
        )}
      </div>

      <div className="card stack">
        <div className="grid2">
          {teamSelect('homeTeamId', 'Local')}
          {teamSelect('awayTeamId', 'Visitante')}
        </div>
        <div className="grid2">
          <label className="field">
            <span className="label">Competición</span>
            <input type="text" placeholder="Liga Regional" value={form.competition} onChange={(e) => set({ competition: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">Jornada / ronda</span>
            <input type="text" placeholder="Jornada 7" value={form.round} onChange={(e) => set({ round: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">Campo</span>
            <input type="text" placeholder="Campo Municipal" value={form.venue} onChange={(e) => set({ venue: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">Fecha y hora</span>
            <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Emisión a YouTube</h3>
        <div className="row">
          <label className="check">
            <input type="radio" checked={form.stream.mode === 'key'} onChange={() => setStream({ mode: 'key' })} />
            Clave de emisión
          </label>
          <label className="check muted" title="Disponible en una fase posterior">
            <input type="radio" disabled checked={form.stream.mode === 'oauth'} onChange={() => setStream({ mode: 'oauth' })} />
            Iniciar sesión con Google (próximamente)
          </label>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          En YouTube Studio → Emitir en directo → Emisión, copia la “Clave de emisión”. Solo la ven los miembros del club y
          la leerá la app del móvil.
        </p>
        <div className="grid2">
          <label className="field">
            <span className="label">URL del servidor</span>
            <input type="text" value={form.stream.rtmpUrl} onChange={(e) => setStream({ rtmpUrl: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">Clave de emisión</span>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                value={form.stream.streamKey}
                placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                onChange={(e) => setStream({ streamKey: e.target.value.trim() })}
              />
              <button type="button" className="btn" onClick={() => setShowKey(!showKey)}>
                {showKey ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </label>
        </div>
        <label className="field">
          <span className="label">Calidad por defecto (se puede cambiar en la app antes de emitir)</span>
          <select value={form.stream.quality} onChange={(e) => setStream({ quality: e.target.value as StreamQuality })}>
            {Object.entries(QUALITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.stream.adaptiveBitrate} onChange={(e) => setStream({ adaptiveBitrate: e.target.checked })} />
          Bajar la calidad automáticamente si la conexión empeora
        </label>
      </div>

      {!isNew && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Overlay</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Esta URL es la que carga la app del móvil. También puedes probarla en OBS como “Fuente de navegador” de 1920×1080.
          </p>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div className="url-box grow">{overlayUrl}</div>
            <CopyButton text={overlayUrl} />
          </div>
          <div className="row">
            <span className="muted small">Estado:</span>
            <select value={status} style={{ width: 'auto' }} onChange={(e) => setStatus(e.target.value as Match['status'])}>
              <option value="scheduled">Programado</option>
              <option value="live">En directo</option>
              <option value="finished">Finalizado</option>
            </select>
            <button type="button" className="btn" onClick={() => act.run(() => updateMatch(club.id, matchId!, { status }))}>
              Guardar estado
            </button>
          </div>
        </div>
      )}

      <ErrorBox error={act.error} />
      <div className="row between">
        {!isNew ? (
          <button
            type="button"
            className="btn danger"
            onClick={() =>
              confirm('¿Borrar el partido y su directo?') &&
              act.run(async () => {
                await deleteMatch(club.id, matchId!);
                nav('..', { relative: 'path' });
              })
            }
          >
            Borrar partido
          </button>
        ) : (
          <span />
        )}
        <div className="row">
          <button type="button" className="btn" onClick={() => nav('..', { relative: 'path' })}>
            Cancelar
          </button>
          <button className="btn primary" disabled={act.busy}>
            {isNew ? 'Crear partido' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  );
}
