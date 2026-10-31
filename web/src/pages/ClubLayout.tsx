import { useMemo } from 'react';
import { NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useDoc } from '../hooks/useFirestore';
import { useAuth } from '../hooks/useAuth';
import { clubRef } from '../lib/db';
import { ErrorBox, Spinner } from '../components/ui';
import { TopBar } from './HomePage';
import type { Club } from '../types';

export interface ClubCtx {
  club: Club;
  isAdmin: boolean;
}

export const useClub = () => useOutletContext<ClubCtx>();

export default function ClubLayout() {
  const { clubId } = useParams();
  const { user } = useAuth();
  const ref = useMemo(() => clubRef(clubId!), [clubId]);
  const club = useDoc<Club>(ref, `club-${clubId}`);

  if (club.loading) return <Spinner full />;
  if (!club.data)
    return (
      <>
        <TopBar />
        <div className="page">
          <ErrorBox error={club.error ?? 'Club no encontrado o sin acceso.'} />
        </div>
      </>
    );

  const ctx: ClubCtx = { club: club.data, isAdmin: club.data.roles[user!.uid] === 'admin' };
  return (
    <>
      <TopBar>
        <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
          <b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{club.data.name}</b>
        </div>
      </TopBar>
      <div className="page" style={{ paddingBottom: 0 }}>
        <nav className="tabs">
          <NavLink to="partidos">Partidos</NavLink>
          <NavLink to="equipos">Equipos</NavLink>
          <NavLink to="patrocinadores">Patrocinadores</NavLink>
          <NavLink to="miembros">Miembros</NavLink>
        </nav>
      </div>
      <div className="page">
        <Outlet context={ctx} />
      </div>
    </>
  );
}
