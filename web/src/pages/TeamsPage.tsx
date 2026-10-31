import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, query } from 'firebase/firestore';
import { useQuery } from '../hooks/useFirestore';
import { teamsCol } from '../lib/db';
import { ErrorBox, Spinner } from '../components/ui';
import { useClub } from './ClubLayout';
import type { Team } from '../types';

export default function TeamsPage() {
  const { club } = useClub();
  const q = useMemo(() => query(teamsCol(club.id), orderBy('name')), [club.id]);
  const teams = useQuery<Team>(q, `teams-${club.id}`);
  return (
    <div className="stack">
      <div className="section-title">
        <h2>Equipos</h2>
        <Link className="btn primary" to="nuevo">
          + Nuevo equipo
        </Link>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Incluye tus equipos y también los rivales, con su escudo, colores y plantilla.
      </p>
      {teams.loading && <Spinner />}
      <ErrorBox error={teams.error} />
      {!teams.loading && teams.data.length === 0 && <div className="empty">Todavía no hay equipos.</div>}
      <div className="list">
        {teams.data.map((t) => (
          <Link key={t.id} to={t.id} className="list-item">
            {t.crestUrl ? <img className="crest-sm" src={t.crestUrl} alt="" /> : <span className="crest-sm" />}
            <div className="grow">
              <b>{t.name}</b>
              <div className="muted small">
                {t.shortName} · {t.players?.length ?? 0} jugadores
              </div>
            </div>
            <span className="swatch" style={{ background: t.primaryColor }} />
            <span className="swatch" style={{ background: t.secondaryColor }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
