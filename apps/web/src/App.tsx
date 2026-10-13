import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Skeleton } from './components/ui';
const Explore = lazy(() => import('./pages/Explore'));
const Venue = lazy(() => import('./pages/Venue'));
const Games = lazy(() => import('./pages/Games'));
const Match = lazy(() => import('./pages/Match'));
const CreateGame = lazy(() => import('./pages/CreateGame'));
const Teams = lazy(() => import('./pages/Teams'));
const Profile = lazy(() => import('./pages/Profile'));
const Auth = lazy(() => import('./pages/Auth'));
const Admin = lazy(() => import('./pages/Admin'));
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
            <Route path="venues/:id" element={<Venue />} />
            <Route path="games" element={<Games />} />
            <Route path="games/new" element={<CreateGame />} />
            <Route path="games/:id" element={<Match />} />
            <Route path="teams" element={<Teams />} />
            <Route path="profile" element={<Profile />} />
            <Route path="login" element={<Auth />} />
            <Route path="register" element={<Auth register />} />
            <Route path="admin" element={<Admin />} />
            <Route path="*" element={<Explore />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
