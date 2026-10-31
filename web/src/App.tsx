import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { firebaseConfigured } from './firebase';
import OverlayPage from './pages/OverlayPage';
import { Spinner } from './components/ui';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ClubLayout = lazy(() => import('./pages/ClubLayout'));
const MatchesPage = lazy(() => import('./pages/MatchesPage'));
const MatchEditPage = lazy(() => import('./pages/MatchEditPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const TeamEditPage = lazy(() => import('./pages/TeamEditPage'));
const SponsorsPage = lazy(() => import('./pages/SponsorsPage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const ControlPage = lazy(() => import('./pages/ControlPage'));
const SetupNeeded = lazy(() => import('./pages/SetupNeeded'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (!firebaseConfigured) return <SetupNeeded />;
  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner full />}>
      <Routes>
        {/* El overlay es público: lo abren el móvil emisor u OBS sin iniciar sesión. */}
        <Route path="/overlay/:matchId" element={<OverlayPage />} />
        <Route path="/control/demo" element={<ControlPage demo />} />
        <Route path="/login" element={firebaseConfigured ? <LoginPage /> : <SetupNeeded />} />
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/control/:matchId" element={<RequireAuth><ControlPage /></RequireAuth>} />
        <Route path="/c/:clubId" element={<RequireAuth><ClubLayout /></RequireAuth>}>
          <Route index element={<Navigate to="partidos" replace />} />
          <Route path="partidos" element={<MatchesPage />} />
          <Route path="partidos/nuevo" element={<MatchEditPage />} />
          <Route path="partidos/:matchId" element={<MatchEditPage />} />
          <Route path="equipos" element={<TeamsPage />} />
          <Route path="equipos/:teamId" element={<TeamEditPage />} />
          <Route path="patrocinadores" element={<SponsorsPage />} />
          <Route path="miembros" element={<MembersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
