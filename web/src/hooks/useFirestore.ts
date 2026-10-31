import { useEffect, useState } from 'react';
import { onSnapshot, type DocumentReference, type Query } from 'firebase/firestore';

export interface Res<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/** Suscripción en tiempo real a un documento. `ref` debe ser estable (usa useMemo o una clave). */
export function useDoc<T>(ref: DocumentReference | null, key: string): Res<T | null> {
  const [res, setRes] = useState<Res<T | null>>({ data: null, loading: !!ref, error: null });
  useEffect(() => {
    if (!ref) {
      setRes({ data: null, loading: false, error: null });
      return;
    }
    setRes((r) => ({ ...r, loading: true }));
    return onSnapshot(
      ref,
      (snap) => setRes({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, loading: false, error: null }),
      (err) => setRes({ data: null, loading: false, error: err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return res;
}

export function useQuery<T>(q: Query | null, key: string): Res<T[]> {
  const [res, setRes] = useState<Res<T[]>>({ data: [], loading: !!q, error: null });
  useEffect(() => {
    if (!q) {
      setRes({ data: [], loading: false, error: null });
      return;
    }
    setRes((r) => ({ ...r, loading: true }));
    return onSnapshot(
      q,
      (snap) => setRes({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), loading: false, error: null }),
      (err) => setRes({ data: [], loading: false, error: err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return res;
}
