import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { query, where } from 'firebase/firestore';
import { reload, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '../hooks/useFirestore';
import { acceptInvite, clubsCol, createClub } from '../lib/db';
import { ErrorBox, Spinner, useAsync } from '../components/ui';
import type { Club } from '../types';

export function TopBar({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="topbar">
      <Link to="/" className="brand">
        Marca<span>Móvil</span>
      </Link>
      <div className="grow">{children}</div>
      {user && (
        <button className="btn ghost small" onClick={() => signOut(auth())} title={user.email ?? ''}>
          Salir
        </button>
      )}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const { busy, error, run } = useAsync();
  const email = (user?.email ?? '').toLowerCase();

  const clubsQ = useMemo(() => query(clubsCol(), where('memberUids', 'array-contains', user!.uid)), [user]);
  const clubs = useQuery<Club>(clubsQ, `clubs-${user!.uid}`);
  const invitesQ = useMemo(() => (email ? query(clubsCol(), where('invitedEmails', 'array-contains', email)) : null), [email]);
  const invites = useQuery<Club>(invitesQ, `inv-${email}`);

  return (
    <>
      <TopBar />
      <div className="page stack">
        <h1>Tus clubes</h1>
        {clubs.loading ? (
          <Spinner />
        ) : clubs.data.length === 0 ? (
          <div className="empty">Aún no perteneces a ningún club. Crea uno o pide que te inviten.</div>
        ) : (
          <div className="list">
            {clubs.data.map((c) => (
              <Link key={c.id} to={`/c/${c.id}`} className="list-item">
                <b className="grow">{c.name}</b>
                <span className="pill">{c.roles[user!.uid] === 'admin' ? 'Administrador' : 'Operador'}</span>
              </Link>
            ))}
          </div>
        )}
        <ErrorBox error={clubs.error} />

        {invites.data.length > 0 && (
          <div className="card stack">
            <h2>Invitaciones pendientes</h2>
            {!user!.emailVerified ? (
              <div className="info-box stack">
                <span>Para aceptar invitaciones tienes que verificar tu email ({email}).</span>
                <div className="row">
                  <button className="btn" onClick={() => run(() => sendEmailVerification(user!))}>
                    Reenviar email
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      run(async () => {
                        await reload(user!);
                        await user!.getIdToken(true);
                        window.location.reload();
                      })
                    }
                  >
                    Ya lo he verificado
                  </button>
                </div>
              </div>
            ) : (
              invites.data.map((c) => (
                <div key={c.id} className="list-item">
                  <b className="grow">{c.name}</b>
                  <button className="btn primary" disabled={busy} onClick={() => run(() => acceptInvite(c.id, user!))}>
                    Unirme
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const id = await createClub(name, user!);
              nav(`/c/${id}`);
            });
          }}
        >
          <h2>Crear club</h2>
          <div className="row">
            <input
              type="text"
              className="grow"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Nombre del club"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn primary" disabled={busy || !name.trim()}>
              Crear
            </button>
          </div>
          <ErrorBox error={error} />
        </form>

        <div className="card row between">
          <div>
            <b>Modo demo</b>
            <div className="muted small">Prueba el panel y el overlay sin tocar datos reales.</div>
          </div>
          <Link className="btn" to="/control/demo">
            Abrir demo
          </Link>
        </div>
      </div>
    </>
  );
}
