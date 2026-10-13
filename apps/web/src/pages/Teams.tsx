import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Crown, ArrowUpRight } from 'lucide-react';
import type { Match } from '@matchplay/shared/game';
import { api, useMe, useProfile } from '../lib/api';
import { Avatar, Empty, Failure, PageTitle, Skeleton } from '../components/ui';
function Team({ id, meId }: { id: string; meId: string }) {
  const query = useQuery({ queryKey: ['match', id], queryFn: () => api<Match>(`/matches/${id}`) });
  if (!query.data) return query.error ? <Failure error={query.error} /> : <Skeleton cards={1} />;
  const match = query.data;
  const self = match.members.find((m) => m.userId === meId);
  const team = match.members.filter((m) => m.side === self?.side);
  return (
    <section className={`team-card ${self?.side}`}>
      <div className="team-card-heading">
        <div>
          <p className="sport-label">{match.sport.toUpperCase()}</p>
          <h2>{self?.side === 'orange' ? match.orangeName : match.blueName}</h2>
          <p className="muted">{match.title}</p>
        </div>
        <Link to={`/games/${id}`} aria-label={`Open ${match.title}`}>
          <ArrowUpRight />
        </Link>
      </div>
      <div className="team-card-members">
        {team.map((member) => (
          <div key={member.userId}>
            <Avatar name={member.name} />
            <span>{member.name}</span>
            {member.captain && <Crown size={15} />}
          </div>
        ))}
      </div>
      <div className="team-card-footer">
        <span>
          {team.length}/{match.capacity} players
        </span>
        <span>{match.status === 'lobby' ? 'UPCOMING GAME' : match.status.toUpperCase()}</span>
      </div>
    </section>
  );
}
export default function Teams() {
  const profile = useProfile();
  const me = useMe();
  if (profile.isPending)
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  if (profile.error)
    return (
      <div className="page">
        <Failure error={profile.error} />
      </div>
    );
  const games = profile.data.matches.filter((m) => m.status === 'live' || m.status === 'lobby');
  return (
    <div className="page">
      <PageTitle title="YOUR TEAMS" />
      <p className="page-intro">Different courts. Same team spirit.</p>
      <div className="team-grid">
        {games.length ? (
          games.map((m) => <Team key={m.id} id={m.id} meId={me.data?.id ?? ''} />)
        ) : (
          <Empty title="Find your people" text="Join a game and your team will appear here.">
            <Link to="/games" className="button primary">
              Explore games
            </Link>
          </Empty>
        )}
      </div>
    </div>
  );
}
