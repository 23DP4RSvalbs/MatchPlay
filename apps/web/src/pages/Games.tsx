import { useState, type FormEvent } from 'react';
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
export default function Games() {
  const [tab, setTab] = useState('lobby');
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
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
      <div className="game-grid">
        {games.isPending ? (
          <Skeleton />
        ) : games.error ? (
          <Failure error={games.error} retry={() => void games.refetch()} />
        ) : games.data.length ? (
          [...games.data]
            .sort((a, b) =>
              tab === 'completed'
                ? b.startsAt.localeCompare(a.startsAt)
                : a.startsAt.localeCompare(b.startsAt),
            )
            .map((game) => <GameCard key={game.id} game={game} />)
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
