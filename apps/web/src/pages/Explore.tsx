import { lazy, Suspense, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, LocateFixed, X, MapPin } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { sports, type Venue } from '@matchplay/shared/game';
import { useVenues } from '../lib/api';
import { distance } from '../lib/format';
import { Button, Dialog, Empty, Failure, Skeleton } from '../components/ui';
import { VenueCard } from '../components/VenueCard';
import { useToast } from '../lib/toast-context';
const VenueMap = lazy(() => import('../components/VenueMap'));
export default function Explore() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search);
  const [sport, setSport] = useState('All');
  const [filters, setFilters] = useState(false);
  const [sort, setSort] = useState('Live first');
  const [selected, setSelected] = useState<string | null>(params.get('venue'));
  const [origin, setOrigin] = useState<[number, number]>([24.105, 56.9496]);
  const [bounds, setBounds] = useState('');
  const toast = useToast();
  const venues = useVenues();
  const visible = useQuery({
    queryKey: ['venues', 'bounds', bounds],
    queryFn: ({ signal }) =>
      fetch(`/api/venues?bounds=${encodeURIComponent(bounds)}`, { signal }).then(async (r) => {
        if (!r.ok) throw new Error('Could not load this map area.');
        return r.json() as Promise<Venue[]>;
      }),
    enabled: !!bounds,
    staleTime: 60_000,
    placeholderData: (prior) => prior,
  });
  const list = useMemo(
    () =>
      (visible.data ?? venues.data ?? [])
        .filter(
          (v) =>
            (sport === 'All' || v.sports.includes(sport as (typeof sports)[number])) &&
            `${v.name} ${v.address} ${v.sports.join(' ')}`.toLowerCase().includes(q.toLowerCase()),
        )
        .map((v) => ({ venue: v, km: distance(v.latitude, v.longitude, origin) }))
        .sort((a, b) =>
          sort === 'Name'
            ? a.venue.name.localeCompare(b.venue.name)
            : sort === 'Live first'
              ? Number(b.venue.matches.some((m) => m.status === 'live')) -
                  Number(a.venue.matches.some((m) => m.status === 'live')) || a.km - b.km
              : a.km - b.km,
        ),
    [visible.data, venues.data, sport, q, origin, sort],
  );
  const mapVenues = useMemo(
    () =>
      (venues.data ?? []).filter(
        (v) =>
          (sport === 'All' || v.sports.includes(sport as (typeof sports)[number])) &&
          `${v.name} ${v.address} ${v.sports.join(' ')}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [venues.data, sport, q],
  );
  const select = useCallback((id: string) => setSelected(id), []);
  const locate = () => {
    if (!navigator.geolocation) {
      toast('Location is unavailable. Showing Riga.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin([pos.coords.longitude, pos.coords.latitude]);
        toast('Showing venues near you.');
      },
      () => toast('Location unavailable. You can still explore Riga.', 'error'),
      { timeout: 10_000 },
    );
  };
  return (
    <div className="explore-layout">
      <section className="map-panel">
        <Suspense
          fallback={
            <div className="map-loading">
              <span className="map-loading-ring" />
              <p>Loading the map…</p>
            </div>
          }
        >
          <VenueMap
            venues={mapVenues}
            selected={selected}
            origin={origin}
            onSelect={select}
            onBounds={setBounds}
          />
        </Suspense>
        <div className="map-search">
          <Search size={23} />
          <input
            aria-label="Search venues or sports"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search venues or sports in Riga…"
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={18} />
            </button>
          )}
          <button
            className={sport !== 'All' ? 'filter-active' : ''}
            aria-label="Filter venues"
            onClick={() => setFilters(true)}
          >
            <SlidersHorizontal size={24} />
          </button>
        </div>
        <button className="locate-button" aria-label="Use my location" onClick={locate}>
          <LocateFixed size={20} />
        </button>
        <div className="map-caption">
          <MapPin size={15} />
          <span>RIGA, LATVIA</span>
        </div>
      </section>
      <section className="venues-panel">
        <div className="sheet-handle" />
        <div className="section-heading">
          <h1>NEARBY VENUES</h1>
          <span>{list.length} FOUND</span>
        </div>
        {sport !== 'All' && (
          <button className="active-filter" onClick={() => setSport('All')}>
            {sport}
            <X size={14} />
          </button>
        )}
        <div className="venue-list">
          {venues.isPending ? (
            <Skeleton />
          ) : venues.error ? (
            <Failure error={venues.error} retry={() => void venues.refetch()} />
          ) : list.length ? (
            list.map(({ venue, km }) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                distance={km}
                selected={venue.id === selected}
                onSelect={() => setSelected(venue.id)}
              />
            ))
          ) : (
            <Empty
              title="No courts found here"
              text="Try another sport, clear the search or move the map."
            >
              <Button
                variant="outline"
                onClick={() => {
                  setSport('All');
                  setSearch('');
                  setBounds('');
                }}
              >
                Reset filters
              </Button>
            </Empty>
          )}
        </div>
        <div className="explore-footer">
          <span>Find your court. Bring your team.</span>
          <Link to="/games/new">Create a game ↗</Link>
        </div>
      </section>
      {filters && (
        <Dialog title="Find your game" onClose={() => setFilters(false)}>
          <div className="filter-section">
            <p className="field-label">SPORT</p>
            <div className="sport-chips">
              {['All', ...sports].map((s) => (
                <button
                  key={s}
                  className={`chip ${sport === s ? 'active' : ''}`}
                  onClick={() => setSport(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <p className="field-label">SORT VENUES</p>
            <div className="sport-chips">
              {['Live first', 'Nearby', 'Name'].map((s) => (
                <button
                  className={`chip ${sort === s ? 'active' : ''}`}
                  key={s}
                  onClick={() => setSort(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Button className="full" onClick={() => setFilters(false)}>
            Show venues
          </Button>
        </Dialog>
      )}
    </div>
  );
}
