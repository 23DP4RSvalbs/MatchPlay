import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Skeleton } from './components/ui';
import { useMe } from './lib/api';

const Explore = lazy(() => import('./pages/Explore'));
const Venue = lazy(() => import('./pages/Venue'));
const SuggestVenue = lazy(() => import('./pages/SuggestVenue'));
const Games = lazy(() => import('./pages/Games'));
const Match = lazy(() => import('./pages/Match'));
const CreateGame = lazy(() => import('./pages/CreateGame'));
const Teams = lazy(() => import('./pages/Teams'));
const Profile = lazy(() => import('./pages/Profile'));
const Auth = lazy(() => import('./pages/Auth'));
const Admin = lazy(() => import('./pages/Admin'));

function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  }

  if (me.isError || !me.data) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (admin && me.data.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="page">
            <Skeleton />
          </div>
        }
      >
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Explore />} />
            <Route path="venues/new" element={<SuggestVenue />} />
            <Route path="venues/:id" element={<Venue />} />
            <Route path="games" element={<Games />} />
            <Route
              path="games/new"
              element={
                <RequireAuth>
                  <CreateGame />
                </RequireAuth>
              }
            />
            <Route path="games/:id" element={<Match />} />
            <Route path="teams" element={<Teams />} />
            <Route
              path="profile"
              element={
                <RequireAuth>
                  <Profile />
                </RequireAuth>
              }
            />
            <Route path="login" element={<Auth />} />
            <Route path="register" element={<Auth register />} />
            <Route
              path="admin"
              element={
                <RequireAuth admin>
                  <Admin />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Explore />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
