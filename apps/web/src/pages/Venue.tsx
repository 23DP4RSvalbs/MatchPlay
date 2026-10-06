import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Star, MapPin } from 'lucide-react';
import type { Venue as VenueType } from '@matchplay/shared/game';
import { api } from '../lib/api';
import { day, month, timeOnly } from '../lib/format';
import { Empty, Failure, Skeleton } from '../components/ui';
export default function Venue() {
  const { id = '' } = useParams();
  const [selected, setSelected] = useState('');
  const query = useQuery({
    queryKey: ['venues', id],
    queryFn: () => api<VenueType>(`/venues/${id}`),
  });
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
  const venue = query.data;
  const sport = venue.sports.includes(selected as (typeof venue.sports)[number])
    ? selected
    : venue.sports[0];
  const games = venue.matches.filter((m) => m.sport === sport && m.status === 'lobby');
  return (
    <div className="venue-page">
      <div className="venue-hero">
        <img src={venue.image} alt={`${venue.name} sports court`} width="1200" height="600" />
        <Link to="/" className="image-back" aria-label="Back to Explore">
          <ArrowLeft />
        </Link>
        <span className="venue-image-note">Illustrative venue photo</span>
      </div>
      <div className="venue-detail">
        <div className="venue-detail-main">
          <h1>{venue.name}</h1>
          <div className="venue-rating-row">
            <span className="rating">
              <Star size={18} />
              {venue.rating?.toFixed(1) ?? 'New'}
            </span>
            <span>({venue.reviewCount} reviews)</span>
            <span>•</span>
            <span>{venue.address}</span>
          </div>
          <p className="venue-description">{venue.description}</p>
          <h2 className="section-label">AVAILABLE SPORTS</h2>
          <div className="sport-chips">
            {venue.sports.map((s) => (
              <button
                key={s}
                className={`chip ${s === sport ? 'active' : ''}`}
                onClick={() => setSelected(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="venue-location">
            <MapPin size={18} />
            <span>Riga, Latvia</span>
            <Link to={`/?venue=${venue.id}`}>View on map ↗</Link>
          </div>
        </div>
        <section className="venue-games">
          <h2 className="section-label">UPCOMING GAMES</h2>
          {games.length ? (
            games.map((game) => (
              <div className="upcoming-card" key={game.id}>
                <div className="date-tile">
                  <strong>{day(game.startsAt)}</strong>
                  <span>{month(game.startsAt)}</span>
                </div>
                <div>
                  <h3>{game.title}</h3>
                  <p>
                    {timeOnly(game.startsAt)} <span>•</span> {game.memberCount}/{game.capacity * 2}{' '}
                    Players joined
                  </p>
                </div>
                <Link to={`/games/${game.id}`} className="join-small">
                  JOIN
                </Link>
              </div>
            ))
          ) : (
            <Empty
              title="Make the first move"
              text={`Organise a ${sport.toLowerCase()} game here.`}
            />
          )}
          {venue.active ? (
            <Link
              to={`/games/new?venue=${venue.id}&sport=${sport}`}
              className="button primary full"
            >
              CREATE GAME
            </Link>
          ) : (
            <p className="form-error">This venue is no longer accepting new games.</p>
          )}
          <p className="sample-note">
            Demo ratings and games. Court booking is arranged with the venue.
          </p>
        </section>
      </div>
    </div>
  );
}
