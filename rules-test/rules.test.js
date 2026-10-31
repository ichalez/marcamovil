// Pruebas de las reglas de seguridad contra el emulador de Firebase.
// Ejecutar con: npm test  (arranca el emulador de Firestore y Storage automáticamente)
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-futbol',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
afterAll(() => env.cleanup());

const club = {
  name: 'Club',
  memberUids: ['admin'],
  roles: { admin: 'admin' },
  memberInfo: { admin: { email: 'admin@x.com', name: 'Admin' } },
  invitedEmails: ['op@x.com'],
  createdAt: 1,
};

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'clubs/c1'), club);
    await setDoc(doc(db, 'clubs/c1/matches/m1'), { stream: { streamKey: 'SECRET' } });
    await setDoc(doc(db, 'live/m1'), { clubId: 'c1', matchId: 'm1', score: { home: 0, away: 0 } });
  });
});

const as = (uid, email, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

describe('clubs', () => {
  it('cualquiera puede crear su propio club como admin', async () => {
    const db = as('u1', 'u1@x.com');
    await assertSucceeds(
      setDoc(doc(db, 'clubs/new'), { ...club, memberUids: ['u1'], roles: { u1: 'admin' }, invitedEmails: [] }),
    );
    await assertFails(
      setDoc(doc(db, 'clubs/new2'), { ...club, memberUids: ['u1', 'u2'], roles: { u1: 'admin' }, invitedEmails: [] }),
    );
  });

  it('un extraño no lee ni modifica el club', async () => {
    const db = as('evil', 'evil@x.com');
    await assertFails(getDoc(doc(db, 'clubs/c1')));
    await assertFails(getDoc(doc(db, 'clubs/c1/matches/m1')));
    await assertFails(updateDoc(doc(db, 'clubs/c1'), { memberUids: arrayUnion('evil') }));
  });

  it('las consultas de "mis clubes" e "invitaciones" funcionan', async () => {
    await assertSucceeds(getDocs(query(collection(as('admin', 'admin@x.com'), 'clubs'), where('memberUids', 'array-contains', 'admin'))));
    await assertSucceeds(getDocs(query(collection(as('op', 'op@x.com'), 'clubs'), where('invitedEmails', 'array-contains', 'op@x.com'))));
  });

  const accept = (db, uid, email, role = 'operator') =>
    updateDoc(doc(db, 'clubs/c1'), {
      memberUids: arrayUnion(uid),
      invitedEmails: arrayRemove(email),
      [`roles.${uid}`]: role,
      [`memberInfo.${uid}`]: { email, name: 'Op' },
    });

  it('el invitado verificado puede unirse como operador', async () => {
    const db = as('op', 'op@x.com');
    await assertSucceeds(accept(db, 'op', 'op@x.com'));
    await assertSucceeds(getDoc(doc(db, 'clubs/c1/matches/m1')));
  });

  it('el invitado no puede hacerse admin, ni unirse sin verificar el email', async () => {
    await assertFails(accept(as('op', 'op@x.com'), 'op', 'op@x.com', 'admin'));
    await assertFails(accept(as('op', 'op@x.com', false), 'op', 'op@x.com'));
  });

  it('un no invitado no puede usar la vía de invitación', async () => {
    await assertFails(accept(as('evil', 'evil@x.com'), 'evil', 'evil@x.com'));
  });

  it('un operador no puede cambiar roles', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), 'clubs/c1'), { memberUids: ['admin', 'op'], 'roles.op': 'operator' }),
    );
    await assertFails(updateDoc(doc(as('op', 'op@x.com'), 'clubs/c1'), { 'roles.op': 'admin' }));
  });
});

describe('live', () => {
  it('el overlay lee el directo sin iniciar sesión', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'live/m1')));
  });

  it('solo los miembros escriben el directo', async () => {
    await assertFails(updateDoc(doc(env.unauthenticatedContext().firestore(), 'live/m1'), { 'score.home': 5 }));
    await assertFails(updateDoc(doc(as('evil', 'e@x.com'), 'live/m1'), { 'score.home': 5 }));
    await assertSucceeds(updateDoc(doc(as('admin', 'admin@x.com'), 'live/m1'), { 'score.home': 1 }));
  });

  it('no se puede mover un directo a otro club', async () => {
    await assertFails(updateDoc(doc(as('admin', 'admin@x.com'), 'live/m1'), { clubId: 'otro' }));
  });

  it('crear partido + directo en un batch', async () => {
    const db = as('admin', 'admin@x.com');
    const b = writeBatch(db);
    b.set(doc(db, 'clubs/c1/matches/m2'), { stream: {} });
    b.set(doc(db, 'live/m2'), { clubId: 'c1', matchId: 'm2' });
    await assertSucceeds(b.commit());
    const evil = as('evil', 'e@x.com');
    await assertFails(setDoc(doc(evil, 'live/m3'), { clubId: 'c1', matchId: 'm3' }));
  });
});

describe('storage', () => {
  it('miembros suben imágenes; lectura pública', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'clubs/c1'), club));
    const img = new Uint8Array([137, 80, 78, 71]);
    const adminSt = env.authenticatedContext('admin', { email: 'admin@x.com' }).storage();
    await assertSucceeds(uploadBytes(ref(adminSt, 'clubs/c1/crests/a.png'), img, { contentType: 'image/png' }));
    const evilSt = env.authenticatedContext('evil', { email: 'e@x.com' }).storage();
    await assertFails(uploadBytes(ref(evilSt, 'clubs/c1/crests/b.png'), img, { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(adminSt, 'clubs/c1/crests/c.txt'), img, { contentType: 'text/plain' }));
    await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), 'clubs/c1/crests/a.png')));
  });
});
