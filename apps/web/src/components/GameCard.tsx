import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, UsersRound } from 'lucide-react';
import type { MatchSummary } from '@matchplay/shared/game';
import { schedule } from '../lib/format';
export function GameCard({ game }: { game: MatchSummary }) {
  return (
    <Link to={`/games/${game.id}`} className="game-card">
      <img src={game.image} alt="" loading="lazy" width="100" height="100" />
      <div className="game-card-copy">
        <div className="game-card-meta">
          <span className="sport-label">{game.sport.toUpperCase()}</span>
          <span className={`status ${game.status}`}>
            {game.status === 'lobby' ? 'UPCOMING' : game.status.toUpperCase()}
          </span>
        </div>
        <h2>{game.title}</h2>
        <p>
          <MapPin size={13} />
          {game.venueName}
        </p>
        <div className="game-card-bottom">
          <span>{schedule(game.startsAt)}</span>
          {game.status === 'lobby' ? (
            <span>
              <UsersRound size={14} />
              {game.memberCount}/{game.capacity * 2}
            </span>
          ) : (
            <strong>
              <span className="orange">{game.orangeScore}</span> :{' '}
              <span className="blue">{game.blueScore}</span>
            </strong>
          )}
        </div>
      </div>
      <ArrowUpRight size={18} className="game-arrow" />
    </Link>
  );
}
