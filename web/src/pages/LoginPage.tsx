import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { ErrorBox, useAsync } from '../components/ui';

export default function LoginPage() {
  const { user } = useAuth();
  const loc = useLocation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const { busy, error, run } = useAsync();

  if (user) return <Navigate to={(loc.state as { from?: string })?.from ?? '/'} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth(), email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth(), email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
        await sendEmailVerification(cred.user);
      }
    });
  };

  return (
    <div className="login">
      <span className="brand">
        Marca<span>Móvil</span>
      </span>
      <div className="card stack">
        <h2>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
        <button className="btn block" disabled={busy} onClick={() => run(() => signInWithPopup(auth(), new GoogleAuthProvider()))}>
          Continuar con Google
        </button>
        <div className="divider">o con email</div>
        <form className="stack" onSubmit={submit}>
          {mode === 'register' && (
            <label className="field">
              <span className="label">Nombre</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label className="field">
            <span className="label">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="field">
            <span className="label">Contraseña</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          <ErrorBox error={error} />
          {info && <div className="info-box">{info}</div>}
          <button className="btn primary block" disabled={busy}>
            {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
        <div className="row between small">
          <button className="btn ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
          </button>
          {mode === 'login' && (
            <button
              className="btn ghost"
              disabled={!email}
              onClick={() =>
                run(async () => {
                  await sendPasswordResetEmail(auth(), email);
                  setInfo('Te hemos enviado un email para cambiar la contraseña.');
                })
              }
            >
              ¿Olvidaste la contraseña?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
