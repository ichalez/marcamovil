// Estado en directo de un partido. Con matchId === 'demo' funciona sin Firebase,
// sincronizando pestañas del mismo navegador (localStorage + BroadcastChannel).
import { useCallback, useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import type { LiveState } from '../types';
import type { Action } from '../lib/actions';
import { applyLive, liveRef } from '../lib/db';
import { createDemoState } from '../lib/demo';

export interface LiveStore {
  state: LiveState | null;
  loading: boolean;
  error: string | null;
  /** true cuando hay escrituras pendientes de confirmar por el servidor. */
  pending: boolean;
  apply: (action: Action) => Promise<void>;
}

export const DEMO_ID = 'demo';
const DEMO_KEY = 'marcamovil-demo-live';

function readDemo(): LiveState {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as LiveState;
  } catch {
    /* sin almacenamiento */
  }
  return createDemoState();
}

let channel: BroadcastChannel | null = null;
function demoChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(DEMO_KEY);
  return channel;
}

export function resetDemo() {
  const s = createDemoState();
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(s));
  } catch {
    /* ignorar */
  }
  demoChannel()?.postMessage(s);
  return s;
}

export function useLive(matchId: string | undefined): LiveStore {
  const isDemo = matchId === DEMO_ID;
  const [state, setState] = useState<LiveState | null>(() => (isDemo ? readDemo() : null));
  const [loading, setLoading] = useState(!isDemo && !!matchId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    if (isDemo) {
      setState(readDemo());
      const ch = demoChannel();
      const onMsg = (e: MessageEvent<LiveState>) => setState(e.data);
      const onStorage = (e: StorageEvent) => {
        if (e.key === DEMO_KEY && e.newValue) setState(JSON.parse(e.newValue));
      };
      ch?.addEventListener('message', onMsg);
      window.addEventListener('storage', onStorage);
      return () => {
        ch?.removeEventListener('message', onMsg);
        window.removeEventListener('storage', onStorage);
      };
    }
    setLoading(true);
    return onSnapshot(
      liveRef(matchId),
      { includeMetadataChanges: true },
      (snap) => {
        setState(snap.exists() ? (snap.data() as LiveState) : null);
        setPending(snap.metadata.hasPendingWrites);
        setError(snap.exists() ? null : 'Este partido no existe o se ha borrado.');
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [matchId, isDemo]);

  const apply = useCallback(
    async (action: Action) => {
      if (!matchId) return;
      if (isDemo) {
        const next = action(readDemo(), Date.now());
        try {
          localStorage.setItem(DEMO_KEY, JSON.stringify(next));
        } catch {
          /* ignorar */
        }
        demoChannel()?.postMessage(next);
        setState(next);
        return;
      }
      setPending(true);
      try {
        await applyLive(matchId, action);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      } finally {
        setPending(false);
      }
    },
    [matchId, isDemo],
  );

  return { state, loading, error, pending, apply };
}
