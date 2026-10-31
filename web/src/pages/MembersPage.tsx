import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { cancelInvite, inviteMember, removeMember, renameClub, setMemberRole } from '../lib/db';
import { ErrorBox, useAsync } from '../components/ui';
import { useClub } from './ClubLayout';
import type { Role } from '../types';

export default function MembersPage() {
  const { club, isAdmin } = useClub();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState(club.name);
  const act = useAsync();
  const admins = club.memberUids.filter((u) => club.roles[u] === 'admin');

  return (
    <div className="stack">
      <h2>Miembros</h2>
      <div className="list">
        {club.memberUids.map((u) => {
          const info = club.memberInfo?.[u];
          const role = club.roles[u];
          const lastAdmin = role === 'admin' && admins.length <= 1;
          return (
            <div key={u} className="list-item">
              <div className="grow">
                <b>{info?.name ?? u}</b> {u === user!.uid && <span className="pill">Tú</span>}
                <div className="muted small">{info?.email}</div>
              </div>
              {isAdmin ? (
                <>
                  <select
                    value={role}
                    disabled={lastAdmin}
                    style={{ width: 'auto' }}
                    onChange={(e) => act.run(() => setMemberRole(club.id, u, e.target.value as Role))}
                  >
                    <option value="admin">Administrador</option>
                    <option value="operator">Operador</option>
                  </select>
                  <button
                    className="btn danger"
                    disabled={lastAdmin}
                    onClick={() => confirm('¿Quitar a este miembro del club?') && act.run(() => removeMember(club.id, u))}
                  >
                    Quitar
                  </button>
                </>
              ) : (
                <span className="pill">{role === 'admin' ? 'Administrador' : 'Operador'}</span>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <>
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              act.run(async () => {
                await inviteMember(club.id, email);
                setEmail('');
              });
            }}
          >
            <h3>Invitar operador</h3>
            <p className="muted small" style={{ margin: 0 }}>
              La persona debe crear una cuenta (o entrar con Google) con este email; verá la invitación al entrar.
            </p>
            <div className="row">
              <input
                type="email"
                required
                placeholder="email@ejemplo.com"
                value={email}
                style={{ flex: 1, minWidth: 200 }}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn primary" disabled={act.busy}>
                Invitar
              </button>
            </div>
            {club.invitedEmails.length > 0 && (
              <div className="list">
                {club.invitedEmails.map((em) => (
                  <div key={em} className="list-item">
                    <span className="grow">{em}</span>
                    <span className="pill">Pendiente</span>
                    <button type="button" className="btn ghost" onClick={() => act.run(() => cancelInvite(club.id, em))}>
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </form>
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              act.run(() => renameClub(club.id, name));
            }}
          >
            <h3>Nombre del club</h3>
            <div className="row">
              <input type="text" required value={name} style={{ flex: 1, minWidth: 200 }} onChange={(e) => setName(e.target.value)} />
              <button className="btn" disabled={act.busy || name.trim() === club.name}>
                Guardar
              </button>
            </div>
          </form>
        </>
      )}
      <ErrorBox error={act.error} />
    </div>
  );
}
