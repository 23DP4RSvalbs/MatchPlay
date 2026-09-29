import { Star, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Venue } from '@matchplay/shared/game';
import { Clock } from './Clock';
import { timeOnly } from '../lib/format';

export function VenueCard({
  venue,
  distance,
  selected,
  onSelect,
}: {
  venue: Venue;
  distance: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const live = venue.matches.find((m) => m.status === 'live');
  const upcoming = venue.matches.find((m) => m.status === 'lobby');
  const game = live ?? upcoming;
  return (
    <article className={`venue-card ${selected ? 'selected' : ''}`}>
      <button
        className="venue-thumbnail"
        onClick={onSelect}
        aria-label={`Locate ${venue.name} on map`}
      >
        <img src={venue.image} alt="" loading="lazy" width="112" height="112" />
      </button>
      <div className="venue-card-content">
        <div className="venue-card-meta">
          <span className="rating">
            <Star size={15} />
            {venue.rating?.toFixed(1) ?? 'New'}
          </span>
          {live && <span className="live-label">LIVE MATCH</span>}
          <span className="sport-label">{(game?.sport ?? venue.sports[0]).toUpperCase()}</span>
        </div>
        <Link className="venue-name" to={`/venues/${venue.id}`}>
          {venue.name}
          <ArrowUpRight size={15} />
        </Link>
        <p className="venue-distance">
          {distance.toFixed(1)} km away <span>•</span> {venue.address.split(',')[0]}
          {!live && upcoming && (
            <>
              {' '}
              <span>•</span> {timeOnly(upcoming.startsAt)}
            </>
          )}
        </p>
        {live ? (
          <Link
            className="mini-score"
            to={`/games/${live.id}`}
            aria-label={`View live game ${live.title}`}
          >
            <div>
              <strong>{live.orangeScore}</strong>
              <span className="orange">{live.orangeName.toUpperCase()}</span>
            </div>
            <span className="score-separator">:</span>
            <div>
              <strong>{live.blueScore}</strong>
              <span className="blue">{live.blueName.toUpperCase()}</span>
            </div>
            <p>
              {live.period}
              {live.period === 1
                ? 'ST'
                : live.period === 2
                  ? 'ND'
                  : live.period === 3
                    ? 'RD'
                    : 'TH'}{' '}
              {live.sport === 'Basketball' ? 'QUARTER' : 'PERIOD'}
            </p>
            <Clock match={live} compact />
          </Link>
        ) : upcoming ? (
          <Link to={`/games/${upcoming.id}`} className="players-caption">
            {upcoming.memberCount}/{upcoming.capacity * 2} Players joined{' '}
            <span>(looking for players)</span>
          </Link>
        ) : (
          <p className="players-caption">Open for your next game</p>
        )}
      </div>
    </article>
  );
}
