import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Spinner({ full }: { full?: boolean }) {
  return (
    <div className={full ? 'spinner-full' : 'spinner-inline'}>
      <div className="spinner" />
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div className="error-box">{error}</div>;
}

/** Ejecuta una acción asíncrona mostrando estado de carga y error. */
export function useAsync() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(translateError(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export function translateError(e: unknown): string {
  const msg = (e as { code?: string; message?: string })?.code || (e as Error)?.message || String(e);
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/invalid-email': 'El email no es válido.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un poco.',
    'permission-denied': 'No tienes permiso para hacer esto.',
    unavailable: 'Sin conexión con el servidor. Reintentando…',
  };
  return map[msg] ?? (e as Error)?.message ?? msg;
}

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt('Copia el texto:', text);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? '✓ Copiado' : label}
    </button>
  );
}

/** Selector de imagen con vista previa. */
export function ImageField({
  label,
  url,
  onFile,
  busy,
  square,
}: {
  label: string;
  url: string;
  onFile: (f: File) => void;
  busy?: boolean;
  square?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="image-field">
        <div className={`image-preview ${square ? 'square' : ''}`}>{url ? <img src={url} alt="" /> : <span>Sin imagen</span>}</div>
        <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Subiendo…' : url ? 'Cambiar' : 'Subir imagen'}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
