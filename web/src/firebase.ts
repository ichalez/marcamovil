import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** false si no se ha configurado .env.local: entonces solo funciona el modo demo. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

if (firebaseConfigured) {
  app = initializeApp(config);
  _auth = getAuth(app);
  _db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  _storage = getStorage(app);
  // Desarrollo local contra los emuladores de Firebase (firebase emulators:start).
  if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    const host = window.location.hostname;
    connectAuthEmulator(_auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(_db, host, 8080);
    connectStorageEmulator(_storage, host, 9199);
  }
}

function need<T>(v: T | null, name: string): T {
  if (!v) throw new Error(`Firebase no está configurado (${name}). Revisa web/.env.local`);
  return v;
}

export const auth = () => need(_auth, 'auth');
export const db = () => need(_db, 'firestore');
export const storage = () => need(_storage, 'storage');
