// Página pública del overlay: /overlay/:matchId
// Parámetros opcionales: ?bg=green|dark|field (fondo de prueba)
import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLive, DEMO_ID } from '../hooks/useLive';
import { useNow } from '../hooks/useNow';
import { OverlayView, ScaledStage, liveTitle, useTransparentPage } from '../overlay/OverlayView';
import { firebaseConfigured } from '../firebase';

export default function OverlayPage() {
  const { matchId } = useParams();
  const [params] = useSearchParams();
  useTransparentPage(params.get('bg'));
  const canLoad = matchId === DEMO_ID || firebaseConfigured;
  const live = useLive(canLoad ? matchId : undefined);
  const now = useNow(200);

  useEffect(() => {
    if (live.state) document.title = liveTitle(live.state);
  }, [live.state]);

  // Expone el estado para la app móvil (fase 2) y depuración.
  useEffect(() => {
    (window as unknown as { __overlayReady?: boolean }).__overlayReady = !!live.state;
  }, [live.state]);

  if (!live.state) {
    // En emisión no mostramos nada: solo un aviso discreto si hay error y se está probando.
    return params.get('bg') && (live.error || !canLoad) ? (
      <div style={{ color: '#fff', padding: 20, fontFamily: 'sans-serif' }}>{live.error ?? 'Firebase no configurado'}</div>
    ) : null;
  }
  return (
    <ScaledStage>
      <OverlayView state={live.state} now={now} />
    </ScaledStage>
  );
}
