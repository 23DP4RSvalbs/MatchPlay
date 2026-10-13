import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { sports, type Match, type Sport } from '@matchplay/shared/game';
import { api, ApiError, json, useAction, useMe, useVenues } from '../lib/api';
import { sportCapacity } from '../lib/format';
import { Button, Failure, PageTitle, Skeleton } from '../components/ui';

const rigaLocal = (date: Date) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Riga',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(' ', 'T');
function rigaUTC(value: string) {
  const guess = new Date(`${value}Z`);
  const offsetText =
    new Intl.DateTimeFormat('en', { timeZone: 'Europe/Riga', timeZoneName: 'shortOffset' })
      .formatToParts(guess)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+2';
  const offset = Number(offsetText.replace('GMT', ''));
  return new Date(guess.getTime() - offset * 3_600_000).toISOString();
}
export default function CreateGame() {
  const me = useMe();
  const venues = useVenues();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [venueId, setVenueId] = useState(params.get('venue') ?? '');
  const [sport, setSport] = useState<Sport | null>(() => {
    const requested = params.get('sport');
    return sports.find((s) => s === requested) ?? null;
  });
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(() => rigaLocal(new Date(Date.now() + 7_200_000)));
  const [capacity, setCapacity] = useState<number | null>(null);
  const [duration, setDuration] = useState(40);
  const [orangeName, setOrangeName] = useState('Team Orange');
  const [blueName, setBlueName] = useState('Team Blue');
  const create = useAction(
    (body: unknown) => api<Match>('/matches', json(body)),
    'Your game is ready. Share the code with your team.',
  );
  const requestedVenue = venues.data?.find((v) => v.id === venueId);
  const selectedSport = sport ?? requestedVenue?.sports[0] ?? 'Basketball';
  const compatibleVenues = venues.data?.filter((v) => v.sports.includes(selectedSport)) ?? [];
  const selectedVenue = compatibleVenues.find((v) => v.id === venueId) ?? compatibleVenues[0];
  const selectedCapacity = capacity ?? sportCapacity[selectedSport];
  async function submit(event: FormEvent) {
    event.preventDefault();
    const game = await create
      .mutateAsync({
        title,
        venueId: selectedVenue?.id,
        sport: selectedSport,
        startsAt: rigaUTC(startsAt),
        capacity: selectedCapacity,
        durationMinutes: duration,
        orangeName,
        blueName,
      })
      .catch(() => null);
    if (game) navigate(`/games/${game.id}`);
  }
  if (me.isPending || venues.isPending)
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  if (!me.data)
    return (
      <div className="page">
        <Failure error={new ApiError(401, 'Sign in')} />
      </div>
    );
  if (venues.error)
    return (
      <div className="page">
        <Failure error={venues.error} />
      </div>
    );
  return (
    <div className="page form-page">
      <PageTitle title="CREATE GAME" back="/games" />
      <form className="form create-form" onSubmit={(e) => void submit(e)}>
        <div className="form-column">
          <h2>A place to play.</h2>
          <p className="muted">Pick your sport and court, then bring your people.</p>
          <fieldset className="sport-picker">
            <legend className="field-label">SPORT</legend>
            <div className="sport-chips">
              {sports.map((s) => (
                <button
                  type="button"
                  className={`chip ${selectedSport === s ? 'active' : ''}`}
                  aria-pressed={selectedSport === s}
                  key={s}
                  onClick={() => {
                    setSport(s);
                    setCapacity(sportCapacity[s]);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            Venue
            <select
              value={selectedVenue?.id ?? ''}
              onChange={(e) => setVenueId(e.target.value)}
              required
              disabled={!compatibleVenues.length}
            >
              {!compatibleVenues.length && <option value="">No venues for this sport</option>}
              {compatibleVenues.map((v) => (
                <option value={v.id} key={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          {selectedVenue && (
            <div className="selected-venue" key={selectedVenue.id}>
              <img src={selectedVenue.image} alt="" />
              <div>
                <strong>{selectedVenue.name}</strong>
                <p>
                  <MapPin size={13} />
                  {selectedVenue.address}
                </p>
              </div>
            </div>
          )}
          <p className="venue-sport-hint" role="status">
            {selectedVenue
              ? `Showing venues for ${selectedSport.toLowerCase()}.`
              : `No ${selectedSport.toLowerCase()} venues available yet. Try another sport.`}
          </p>
          <label>
            Game name
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={80}
              placeholder={`${selectedSport} with friends`}
            />
          </label>
          <label>
            Start time <span className="field-hint">Riga time</span>
            <input
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
        </div>
        <div className="form-column">
          <h2>Make it your game.</h2>
          <div className="form-row">
            <label>
              Players per team
              <input
                type="number"
                value={selectedCapacity}
                min={1}
                max={20}
                required
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </label>
            <label>
              <span>
                Clock length <span className="field-hint">(minutes)</span>
              </span>
              <input
                type="number"
                value={duration}
                min={1}
                max={180}
                required
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            Orange team
            <input
              value={orangeName}
              required
              maxLength={30}
              onChange={(e) => setOrangeName(e.target.value)}
            />
          </label>
          <label>
            Blue team
            <input
              value={blueName}
              required
              maxLength={30}
              onChange={(e) => setBlueName(e.target.value)}
            />
          </label>
          <div className="game-rules" key={selectedSport}>
            <strong>{selectedSport} scoring</strong>
            <p>
              {selectedSport === 'Basketball'
                ? 'Add 1, 2 or 3 points. The organiser controls periods and the game clock.'
                : selectedSport === 'Tennis'
                  ? 'Traditional points, deuce and advantage. Sets are first to 6 games, with a tiebreak at 6-all.'
                  : 'Add one point at a time. The organiser controls periods and the game clock.'}
            </p>
            <p>You start as the orange captain. Assign another captain in the lobby.</p>
          </div>
          <Button className="full" type="submit" busy={create.isPending} disabled={!selectedVenue}>
            CREATE GAME
            <ArrowRight size={19} />
          </Button>
        </div>
      </form>
    </div>
  );
}
