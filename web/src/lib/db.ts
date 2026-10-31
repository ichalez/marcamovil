// Acceso a Firestore / Storage.
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { User } from 'firebase/auth';
import { db, storage } from '../firebase';
import type { Club, LiveState, Match, Role, Sponsor, Team, TeamInfo } from '../types';
import { createInitialState, type Action } from './actions';

export const clubsCol = () => collection(db(), 'clubs');
export const clubRef = (clubId: string) => doc(db(), 'clubs', clubId);
export const teamsCol = (clubId: string) => collection(db(), 'clubs', clubId, 'teams');
export const teamRef = (clubId: string, teamId: string) => doc(db(), 'clubs', clubId, 'teams', teamId);
export const sponsorsCol = (clubId: string) => collection(db(), 'clubs', clubId, 'sponsors');
export const sponsorRef = (clubId: string, id: string) => doc(db(), 'clubs', clubId, 'sponsors', id);
export const matchesCol = (clubId: string) => collection(db(), 'clubs', clubId, 'matches');
export const matchRef = (clubId: string, id: string) => doc(db(), 'clubs', clubId, 'matches', id);
export const liveRef = (matchId: string) => doc(db(), 'live', matchId);

const displayName = (u: User) => u.displayName || u.email?.split('@')[0] || 'Usuario';

// ---------- Clubes y miembros ----------

export async function createClub(name: string, user: User): Promise<string> {
  const r = doc(clubsCol());
  const club: Omit<Club, 'id'> = {
    name: name.trim(),
    memberUids: [user.uid],
    roles: { [user.uid]: 'admin' },
    memberInfo: { [user.uid]: { email: user.email ?? '', name: displayName(user) } },
    invitedEmails: [],
    createdAt: Date.now(),
  };
  await setDoc(r, club);
  return r.id;
}

export async function inviteMember(clubId: string, email: string) {
  await updateDoc(clubRef(clubId), { invitedEmails: arrayUnion(email.trim().toLowerCase()) });
}

export async function cancelInvite(clubId: string, email: string) {
  await updateDoc(clubRef(clubId), { invitedEmails: arrayRemove(email) });
}

export async function acceptInvite(clubId: string, user: User) {
  const email = (user.email ?? '').toLowerCase();
  await updateDoc(clubRef(clubId), {
    memberUids: arrayUnion(user.uid),
    invitedEmails: arrayRemove(email),
    [`roles.${user.uid}`]: 'operator',
    [`memberInfo.${user.uid}`]: { email, name: displayName(user) },
  });
}

export async function setMemberRole(clubId: string, uid: string, role: Role) {
  await updateDoc(clubRef(clubId), { [`roles.${uid}`]: role });
}

export async function removeMember(clubId: string, uid: string) {
  await updateDoc(clubRef(clubId), {
    memberUids: arrayRemove(uid),
    [`roles.${uid}`]: deleteField(),
    [`memberInfo.${uid}`]: deleteField(),
  });
}

export async function renameClub(clubId: string, name: string) {
  await updateDoc(clubRef(clubId), { name: name.trim() });
}

// ---------- Equipos y patrocinadores ----------

export function newTeamId(clubId: string) {
  return doc(teamsCol(clubId)).id;
}

export async function saveTeam(clubId: string, team: Team) {
  await setDoc(teamRef(clubId, team.id), { ...team, updatedAt: Date.now() });
}

export async function deleteTeam(clubId: string, teamId: string) {
  await deleteDoc(teamRef(clubId, teamId));
}

export async function saveSponsor(clubId: string, s: Sponsor) {
  await setDoc(sponsorRef(clubId, s.id), s);
}

export function newSponsorId(clubId: string) {
  return doc(sponsorsCol(clubId)).id;
}

export async function deleteSponsor(clubId: string, id: string) {
  await deleteDoc(sponsorRef(clubId, id));
}

/** Reduce la imagen (máx. `max` px) y la sube a Storage. Devuelve la URL pública. */
export async function uploadImage(clubId: string, folder: string, file: File, max = 400): Promise<string> {
  const blob = await resizeImage(file, max);
  const path = `clubs/${clubId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
  const r = ref(storage(), path);
  await uploadBytes(r, blob, { contentType: 'image/png', cacheControl: 'public,max-age=31536000' });
  return getDownloadURL(r);
}

async function resizeImage(file: File, max: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('No se pudo leer la imagen'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Error al convertir'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Partidos ----------

export function toTeamInfo(t: Team): TeamInfo {
  return {
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    crestUrl: t.crestUrl,
    players: t.players,
  };
}

async function loadSponsors(clubId: string): Promise<Sponsor[]> {
  const snap = await getDocs(sponsorsCol(clubId));
  return snap.docs.map((d) => d.data() as Sponsor);
}

export async function createMatch(
  clubId: string,
  user: User,
  data: Omit<Match, 'id' | 'createdAt' | 'createdBy' | 'status' | 'homeName' | 'awayName'>,
  home: Team,
  away: Team,
): Promise<string> {
  const r = doc(matchesCol(clubId));
  const sponsors = await loadSponsors(clubId);
  const match: Omit<Match, 'id'> = {
    ...data,
    homeName: home.name,
    awayName: away.name,
    status: 'scheduled',
    createdAt: Date.now(),
    createdBy: user.uid,
  };
  const live = createInitialState({
    clubId,
    matchId: r.id,
    home: toTeamInfo(home),
    away: toTeamInfo(away),
    competition: data.competition,
    venue: data.venue,
    round: data.round,
    sponsors,
  });
  const batch = writeBatch(db());
  batch.set(r, match);
  batch.set(liveRef(r.id), live);
  await batch.commit();
  return r.id;
}

export async function updateMatch(
  clubId: string,
  matchId: string,
  data: Partial<Omit<Match, 'id'>>,
  teams?: { home: Team; away: Team },
) {
  const patch: Partial<Omit<Match, 'id'>> = { ...data };
  if (teams) {
    patch.homeName = teams.home.name;
    patch.awayName = teams.away.name;
  }
  await updateDoc(matchRef(clubId, matchId), patch);
  const liveSnap = await getDoc(liveRef(matchId));
  if (liveSnap.exists()) {
    const livePatch: Partial<LiveState> = { updatedAt: Date.now() };
    if (data.competition !== undefined) livePatch.competition = data.competition;
    if (data.venue !== undefined) livePatch.venue = data.venue;
    if (data.round !== undefined) livePatch.round = data.round;
    if (teams) {
      livePatch.home = toTeamInfo(teams.home);
      livePatch.away = toTeamInfo(teams.away);
    }
    await updateDoc(liveRef(matchId), livePatch);
  }
}

/** Copia al directo los datos actuales de equipos y patrocinadores del club. */
export async function refreshLiveFromClub(clubId: string, matchId: string) {
  const m = (await getDoc(matchRef(clubId, matchId))).data() as Match | undefined;
  if (!m) throw new Error('Partido no encontrado');
  const [h, a, sponsors] = await Promise.all([
    getDoc(teamRef(clubId, m.homeTeamId)),
    getDoc(teamRef(clubId, m.awayTeamId)),
    loadSponsors(clubId),
  ]);
  const patch: Partial<LiveState> = { sponsors, updatedAt: Date.now() };
  if (h.exists()) patch.home = toTeamInfo(h.data() as Team);
  if (a.exists()) patch.away = toTeamInfo(a.data() as Team);
  await updateDoc(liveRef(matchId), patch);
}

export async function deleteMatch(clubId: string, matchId: string) {
  const batch = writeBatch(db());
  batch.delete(matchRef(clubId, matchId));
  batch.delete(liveRef(matchId));
  await batch.commit();
}

export async function setMatchStatus(clubId: string, matchId: string, status: Match['status']) {
  await updateDoc(matchRef(clubId, matchId), { status });
}

/** Aplica una acción sobre el directo dentro de una transacción (seguro con varios operadores). */
export async function applyLive(matchId: string, action: Action) {
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(liveRef(matchId));
    if (!snap.exists()) throw new Error('El directo no existe');
    const next = action(snap.data() as LiveState, Date.now());
    tx.set(liveRef(matchId), next);
  });
}
