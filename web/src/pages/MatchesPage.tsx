import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, query } from 'firebase/firestore';
import { useQuery } from '../hooks/useFirestore';
import { matchesCol } from '../lib/db';
import { ErrorBox, Spinner } from '../components/ui';
import { useClub } from './ClubLayout';
import type { Match } from '../types';

const STATUS: Record<Match['status'], [string, string]> = {
  scheduled: ['Programado', ''],
  live: ['En directo', 'live'],
  finished: ['Finalizado', 'ok'],
};

export function formatDate(v: string) {
  if (!v) return 'Sin fecha';
  const d = new Date(v);
  return d.toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function MatchesPage() {
  const { club } = useClub();
  const q = useMemo(() => query(matchesCol(club.id), orderBy('scheduledAt', 'desc')), [club.id]);
  const matches = useQuery<Match>(q, `m-${club.id}`);
  return (
    <div className="stack">
      <div className="section-title">
        <h2>Partidos</h2>
        <Link className="btn primary" to="nuevo">
          + Nuevo partido
        </Link>
      </div>
      {matches.loading && <Spinner />}
      <ErrorBox error={matches.error} />
      {!matches.loading && matches.data.length === 0 && (
        <div className="empty">No hay partidos. Primero crea los equipos y después el partido.</div>
      )}
      <div className="list">
        {matches.data.map((m) => (
          <div key={m.id} className="list-item">
            <div className="grow">
              <b>
                {m.homeName} – {m.awayName}
              </b>
              <div className="muted small">
                {formatDate(m.scheduledAt)}
                {m.competition && ` · ${m.competition}`}
              </div>
            </div>
            <span className={`pill ${STATUS[m.status][1]}`}>{STATUS[m.status][0]}</span>
            <Link className="btn" to={m.id}>
              Editar
            </Link>
            <Link className="btn primary" to={`/control/${m.id}`}>
              Panel
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
