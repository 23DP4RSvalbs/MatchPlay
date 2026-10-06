import { Compass, Trophy, UsersRound, UserRound, MapPin, ArrowUpRight } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../lib/api';
import { usePublicStream } from '../lib/useStream';
import { useReveals } from '../lib/useReveals';
import { Avatar } from './ui';

const navigation = [
  { to: '/', label: 'Explore', Icon: Compass },
  { to: '/games', label: 'Games', Icon: Trophy },
  { to: '/teams', label: 'Teams', Icon: UsersRound },
  { to: '/profile', label: 'Profile', Icon: UserRound },
];
export function Shell() {
  usePublicStream();
  const motionRef = useReveals();
  const me = useMe();
  const { pathname } = useLocation();
  const activeClass = (to: string, isActive: boolean) =>
    isActive || (to === '/' && pathname.startsWith('/venues/')) ? 'active' : '';
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="MatchPlay home">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24">
              <path d="M4 19V5l8 9 8-9v14" />
            </svg>
          </span>
          Match<span>Play</span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navigation.map(({ to, label, Icon }) => (
            <NavLink
              to={to}
              end={to === '/'}
              key={to}
              className={({ isActive }) => activeClass(to, isActive)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <span className="location">
            <MapPin size={15} />
            Riga, Latvia
          </span>
          {me.data ? (
            <Link to="/profile" aria-label="Open your profile">
              <Avatar name={me.data.name} />
            </Link>
          ) : (
            <Link to="/login" className="sign-in">
              Sign in <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </header>
      <main ref={motionRef}>
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        {navigation.map(({ to, label, Icon }) => (
          <NavLink
            to={to}
            end={to === '/'}
            key={to}
            className={({ isActive }) => activeClass(to, isActive)}
          >
            <Icon size={26} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
