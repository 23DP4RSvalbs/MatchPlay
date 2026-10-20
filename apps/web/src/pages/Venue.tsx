import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Clock3 } from 'lucide-react';
import type { Venue as VenueType, VenueAvailability } from '@matchplay/shared/game';
import { ApiError, api } from '../lib/api';
import { day, month, timeOnly } from '../lib/format';
import { Empty, Failure, Skeleton } from '../components/ui';
export default function Venue() {
  const { id = '' } = useParams();
  const [selected, setSelected] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['venues', id],
    queryFn: () => api<VenueType>(`/venues/${id}`),
  });
  const availability = useQuery({
    queryKey: ['venues', id, 'availability'],
    queryFn: () => api<VenueAvailability>(`/venues/${id}/availability`),
    staleTime: 60_000,
  });

  const slotItems = useMemo(
    () => (availability.data?.slots ?? []).filter((slot) => slot.available),
    [availability.data],
  );

  if (query.isPending) return <div className="page"><Skeleton /></div>;
  if (query.error)
    if (query.error instanceof ApiError && query.error.status === 404)
      return (
        <div className="page">
          <Empty title="This venue is missing" text="If you know the location, send it to the admin team and it can be added to the map.">
            <Link className="button primary" to="/venues/new">Suggest this venue</Link>
            <Link className="button outline" to="/">Back to explore</Link>
          </Empty>
        </div>
      );
  if (query.error) return <div className="page"><Failure error={query.error} retry={() => void query.refetch()} /></div>;

  const venue = query.data;
  const sport = venue.sports.includes(selected as (typeof venue.sports)[number]) ? selected : venue.sports[0];
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
            <span className="rating"><Star size={18} />{venue.rating?.toFixed(1) ?? 'New'}</span>
            <span>({venue.reviewCount} reviews)</span>
            <span>•</span>
            <span>{venue.address}</span>
          </div>
          <p className="venue-description">{venue.description}</p>
          <h2 className="section-label">AVAILABLE SPORTS</h2>
          <div className="sport-chips">
            {venue.sports.map((s) => (
              <button key={s} className={`chip ${s === sport ? 'active' : ''}`} onClick={() => setSelected(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="venue-location">
            <MapPin size={18} />
            <span>Riga, Latvia</span>
            <Link to={`/?venue=${venue.id}`}>View on map ↗</Link>
          </div>

          <section className="availability-panel">
            <div className="section-header-row">
              <h2 className="section-label">AVAILABILITY</h2>
              <span className="availability-note">Next 7 days</span>
            </div>
            {availability.isPending ? (
              <Skeleton cards={1} />
            ) : availability.error ? (
              <p className="muted">Availability is temporarily unavailable.</p>
            ) : slotItems.length ? (
              <div className="availability-grid" role="list">
                {slotItems.map((slot) => {
                  const selectedToday = selectedSlot === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      className={`availability-slot ${selectedToday ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(slot.start)}
                    >
                      <Clock3 size={15} />
                      <span>{slot.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty compact">
                <Clock3 size={24} />
                <p>No open slots are available for this venue this week.</p>
              </div>
            )}
          </section>
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
                  <p>{timeOnly(game.startsAt)} <span>•</span> {game.memberCount}/{game.capacity * 2} Players joined</p>
                </div>
                <Link to={`/games/${game.id}`} className="join-small">JOIN</Link>
              </div>
            ))
          ) : (
            <Empty title="Make the first move" text={`Organise a ${sport.toLowerCase()} game here.`} />
          )}
          {venue.active ? (
            <Link
              to={`/games/new?venue=${venue.id}&sport=${sport}${selectedSlot ? `&slot=${encodeURIComponent(selectedSlot)}` : ''}`}
              className="button primary full"
            >
              {selectedSlot ? 'BOOK SELECTED SLOT' : 'CREATE GAME'}
            </Link>
          ) : (
            <p className="form-error">This venue is no longer accepting new games.</p>
          )}
          <p className="sample-note">Demo ratings and games. Court availability updates as the week fills up.</p>
        </section>
      </div>
    </div>
  );
}
