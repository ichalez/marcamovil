import { useMemo, useState } from 'react';
import { query, orderBy } from 'firebase/firestore';
import { useQuery } from '../hooks/useFirestore';
import { deleteSponsor, newSponsorId, saveSponsor, sponsorsCol, uploadImage } from '../lib/db';
import { ErrorBox, ImageField, Spinner, useAsync } from '../components/ui';
import { useClub } from './ClubLayout';
import type { Sponsor } from '../types';

export default function SponsorsPage() {
  const { club } = useClub();
  const q = useMemo(() => query(sponsorsCol(club.id), orderBy('name')), [club.id]);
  const sponsors = useQuery<Sponsor>(q, `sp-${club.id}`);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const act = useAsync();
  const up = useAsync();

  return (
    <div className="stack">
      <h2>Patrocinadores</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Los logos van rotando arriba a la derecha y salen en las pantallas de previa, descanso y final. Los cambios llegan
        a los partidos ya creados al pulsar “Actualizar desde el club” en el panel.
      </p>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          act.run(async () => {
            await saveSponsor(club.id, { id: newSponsorId(club.id), name: name.trim(), logoUrl: logo });
            setName('');
            setLogo('');
          });
        }}
      >
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow" style={{ minWidth: 200 }}>
            <span className="label">Nombre</span>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <ImageField
            label="Logo (mejor PNG con fondo transparente)"
            url={logo}
            busy={up.busy}
            onFile={(f) => up.run(async () => setLogo(await uploadImage(club.id, 'sponsors', f, 600)))}
          />
          <button className="btn primary" disabled={act.busy || up.busy || !logo || !name.trim()}>
            Añadir
          </button>
        </div>
        <ErrorBox error={act.error || up.error} />
      </form>
      {sponsors.loading && <Spinner />}
      {!sponsors.loading && sponsors.data.length === 0 && <div className="empty">Sin patrocinadores.</div>}
      <div className="list">
        {sponsors.data.map((s) => (
          <div key={s.id} className="list-item">
            <div className="image-preview">
              <img src={s.logoUrl} alt="" />
            </div>
            <b className="grow">{s.name}</b>
            <button className="btn danger" onClick={() => confirm(`¿Borrar ${s.name}?`) && act.run(() => deleteSponsor(club.id, s.id))}>
              Borrar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
