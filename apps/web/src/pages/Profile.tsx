import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Flame, Globe, Pencil, LogOut, Shield, ArrowUpRight } from 'lucide-react';
import { api, json, useAction, useProfile } from '../lib/api';
import { Avatar, Button, Dialog, Failure, Skeleton } from '../components/ui';
import { GameCard } from '../components/GameCard';
export default function Profile() {
  const query = useProfile();
  const [editing, setEditing] = useState(false);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const update = useAction((body: unknown) => api('/me', json(body, 'PATCH')), 'Profile updated.');
  const logout = useAction(() => api('/auth/sign-out', json({})));
  if (query.isPending)
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  if (query.error)
    return (
      <div className="page">
        <Failure error={query.error} retry={() => void query.refetch()} />
      </div>
    );
  const p = query.data;
  const since = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
    new Date(p.user.createdAt),
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    const result = await update.mutateAsync({ name, city }).catch(() => null);
    if (result) {
      await client.invalidateQueries({ queryKey: ['me'] });
      setEditing(false);
    }
  }
  return (
    <div className="profile-page">
      <header className="profile-header">
        <Avatar name={p.user.name} />
        <h1>{p.user.name}</h1>
        <p>
          Athlete since {since} <span>•</span> {p.user.city}
        </p>
        <button
          className="profile-edit"
          aria-label="Edit profile"
          onClick={() => {
            setName(p.user.name);
            setCity(p.user.city);
            setEditing(true);
          }}
        >
          <Pencil size={18} />
        </button>
      </header>
      <div className="profile-body">
        <div className="profile-stats-column">
          <h2 className="section-label">OVERALL STATS</h2>
          <div className="stats-grid">
            <div>
              <strong>{p.played}</strong>
              <span>Games Played</span>
            </div>
            <div>
              <strong className="green">{p.won}</strong>
              <span>Matches Won</span>
            </div>
            <div>
              <strong className="orange stat-name">{p.favoriteSport}</strong>
              <span>Favorite Sport</span>
            </div>
            <div>
              <strong className="stat-name">{p.topVenue}</strong>
              <span>Top Venue</span>
            </div>
          </div>
          <h2 className="section-label achievement-title">ACHIEVEMENTS</h2>
          <div className="achievement-grid">
            <div className={p.played >= 20 ? 'earned' : 'locked'}>
              <Award className="gold" size={28} />
              <span>20 Games</span>
            </div>
            <div className={p.streak >= 5 ? 'earned' : 'locked'}>
              <Flame className="orange" size={29} />
              <span>5 Streak</span>
            </div>
            <div className={p.venuesVisited >= 2 ? 'earned' : 'locked'}>
              <Globe className="blue" size={29} />
              <span>Explorer</span>
            </div>
          </div>
          <p className="achievement-note">Play 20 games, win 5 in a row, or play at 2 venues.</p>
          <div className="profile-actions">
            {p.user.role === 'admin' && (
              <Link to="/admin">
                <Shield size={17} />
                Admin panel
                <ArrowUpRight size={17} />
              </Link>
            )}
            <button
              disabled={logout.isPending}
              onClick={async () => {
                const result = await logout.mutateAsync().catch(() => null);
                if (result) {
                  client.clear();
                  navigate('/login');
                }
              }}
            >
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </div>
        <section className="profile-history">
          <div className="section-heading">
            <h2 className="section-label">RECENT GAMES</h2>
            <Link to="/games">View all ↗</Link>
          </div>
          {p.matches
            .filter((m) => m.status === 'completed')
            .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
            .slice(0, 3)
            .map((m) => (
              <GameCard game={m} key={m.id} />
            ))}
          {!p.played && <p className="muted">Your first result will appear here.</p>}
        </section>
      </div>
      {editing && (
        <Dialog title="Edit profile" onClose={() => setEditing(false)}>
          <form onSubmit={(e) => void save(e)} className="form">
            <label>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={60}
                required
              />
            </label>
            <label>
              City
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                minLength={2}
                maxLength={60}
                required
              />
            </label>
            <Button type="submit" busy={update.isPending}>
              Save changes
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
