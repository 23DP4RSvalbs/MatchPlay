import { useState, type FormEvent, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, KeyRound, ArrowRight } from 'lucide-react';
import type { MatchSummary } from '@matchplay/shared/game';
import { api, json, useAction, useMe } from '../lib/api';
import { Button, Dialog, Empty, Failure, PageTitle, Skeleton } from '../components/ui';
import { GameCard } from '../components/GameCard';
const tabs = [
  ['lobby', 'Upcoming'],
  ['live', 'Live'],
  ['completed', 'History'],
  ['mine', 'My games'],
] as const;
const sports = ['Basketball', 'Football', 'Volleyball', 'Tennis'] as const;
const sortOptions = [
  { value: 'soonest', label: 'Soonest' },
  { value: 'latest', label: 'Latest' },
  { value: 'sport', label: 'Sport' },
] as const;
export default function Games() {
  const [tab, setTab] = useState('lobby');
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [sortBy, setSortBy] = useState<'soonest' | 'latest' | 'sport'>('soonest');
  const [sportFilter, setSportFilter] = useState<'all' | 'Basketball' | 'Football' | 'Volleyball' | 'Tennis'>('all');
  const me = useMe();
  const navigate = useNavigate();
  const games = useQuery({
    queryKey: ['matches', tab],
    queryFn: () => api<MatchSummary[]>(`/matches?status=${tab}`),
    retry: false,
  });
  const join = useAction((code: string) => api<{ id: string }>('/join-code', json({ code })));
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await join.mutateAsync(code).catch(() => null);
    if (result) navigate(`/games/${result.id}`);
  }
  const sortedGames = useMemo(() => {
    const items = (games.data ?? []).filter((game) => sportFilter === 'all' || game.sport === sportFilter);
    return items.sort((a, b) => {
      if (sortBy === 'latest') return b.startsAt.localeCompare(a.startsAt);
      if (sortBy === 'sport') return a.sport.localeCompare(b.sport) || a.startsAt.localeCompare(b.startsAt);
      return a.startsAt.localeCompare(b.startsAt);
    });
  }, [games.data, sortBy, sportFilter]);
  return (
    <div className="page games-page">
      <PageTitle
        title="GAMES"
        action={
          <Link className="button outline small" to="/games/new">
            <Plus size={17} />
            <span>New game</span>
          </Link>
        }
      />
      <div className="games-toolbar">
        <div className="tabs" role="tablist" aria-label="Game status">
          {tabs.map(([key, label]) => (
            <button
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              key={key}
              className={tab === key ? 'active' : ''}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="code-button"
          onClick={() => (me.data ? setJoining(true) : navigate('/login?next=/games'))}
        >
          <KeyRound size={17} />
          Join with code
        </button>
      </div>
      <div className="games-filters">
        <div className="sort-by">
          <span>Sort by:</span>
          {sortOptions.map((option) => (
            <button
              key={option.value}
              className={sortBy === option.value ? 'active' : ''}
              onClick={() => setSortBy(option.value)}
              aria-pressed={sortBy === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="sport-filter">
          <span>Sport:</span>
          <button
            className={sportFilter === 'all' ? 'active' : ''}
            onClick={() => setSportFilter('all')}
            aria-pressed={sportFilter === 'all'}
          >
            All
          </button>
          {sports.map((sport) => (
            <button
              key={sport}
              className={sportFilter === sport ? 'active' : ''}
              onClick={() => setSportFilter(sport)}
              aria-pressed={sportFilter === sport}
            >
              {sport}
            </button>
          ))}
        </div>
      </div>
      <div className="game-grid">
        {games.isPending ? (
          <Skeleton />
        ) : games.error ? (
          <Failure error={games.error} retry={() => void games.refetch()} />
        ) : sortedGames.length ? (
          sortedGames.map((game) => <GameCard key={game.id} game={game} />)
        ) : (
          <Empty title="Room for a new game" text="Choose a venue and invite your team.">
            <Link to="/games/new" className="button primary">
              Create a game
            </Link>
          </Empty>
        )}
      </div>
      {joining && (
        <Dialog title="Join a game" onClose={() => setJoining(false)}>
          <p className="muted">Enter the code your organiser shared.</p>
          <form className="form" onSubmit={(e) => void submit(e)}>
            <label>
              Game code
              <input
                className="code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                minLength={4}
                maxLength={12}
                required
                autoFocus
                placeholder="HOOPS6"
              />
            </label>
            <Button type="submit" busy={join.isPending}>
              Find game
              <ArrowRight size={17} />
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
