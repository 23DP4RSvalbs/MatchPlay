import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sports, type VenueInput, type VenueRequest } from '@matchplay/shared/game';
import { api, json, useAction } from '../lib/api';
import { Button, PageTitle } from '../components/ui';
import PlaceMap from '../components/PlaceMap';

type ReverseGeocodeResult = {
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

function buildAddress(result: ReverseGeocodeResult) {
  const parts = [
    [result.address?.road, result.address?.house_number].filter(Boolean).join(' '),
    result.address?.suburb ?? result.address?.neighbourhood,
    result.address?.city ??
      result.address?.town ??
      result.address?.village ??
      result.address?.municipality,
    result.address?.county,
    result.address?.state,
    result.address?.country,
  ].filter((part): part is string => Boolean(part));
  return parts.join(', ') || result.display_name || '';
}

const emptyForm = (): VenueInput => ({
  name: '',
  address: '',
  latitude: 56.957,
  longitude: 24.113,
  sports: ['Basketball'],
  image: '/images/arena.webp',
  description: '',
});

export default function SuggestVenue() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState<VenueRequest | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressUnavailable, setAddressUnavailable] = useState(false);
  const lookup = useRef<AbortController | null>(null);
  const [form, setForm] = useState<VenueInput>(emptyForm);
  const field = <K extends keyof VenueInput>(key: K, value: VenueInput[K]) =>
    setForm((current: VenueInput) => ({ ...current, [key]: value }));
  const send = useAction((input: VenueInput) => api<VenueRequest>('/venue-requests', json(input)));
  useEffect(() => () => lookup.current?.abort(), []);

  function cancelLookup() {
    lookup.current?.abort();
    lookup.current = null;
    setAddressLoading(false);
  }

  async function placeMarker([longitude, latitude]: [number, number]) {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setForm((current) => ({ ...current, longitude, latitude, address: '' }));
    setAddressLoading(true);
    setAddressUnavailable(false);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=en`,
        { headers: { Accept: 'application/json' }, signal: controller.signal },
      );
      if (!response.ok) throw new Error('Address lookup unavailable.');
      const data = (await response.json()) as ReverseGeocodeResult;
      if (lookup.current !== controller) return;
      const address = buildAddress(data);
      if (address) field('address', address);
      else setAddressUnavailable(true);
    } catch {
      if (lookup.current === controller) setAddressUnavailable(true);
    } finally {
      window.clearTimeout(timeout);
      if (lookup.current === controller) {
        lookup.current = null;
        setAddressLoading(false);
      }
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (send.isPending || addressLoading) return;
    const result = await send.mutateAsync(form).catch(() => null);
    if (result) {
      cancelLookup();
      setSubmitted(result);
    }
  }
  if (submitted)
    return (
      <div className="page request-page">
        <PageTitle title="VENUE SUGGESTION" back="/" />
        <div className="success-panel">
          <CheckCircle2 size={46} className="orange" />
          <h2>Thanks, your suggestion is pending review</h2>
          <p>The admin team will check {submitted.name} and decide whether to add it to the map.</p>
          <div className="request-summary">
            <span>{submitted.address}</span>
            <span>{submitted.sports.join(' · ')}</span>
          </div>
          <div className="dialog-actions">
            <Button
              variant="outline"
              onClick={() => {
                cancelLookup();
                setForm(emptyForm());
                setAddressUnavailable(false);
                send.reset();
                setSubmitted(null);
              }}
            >
              Add another venue
            </Button>
            <Button onClick={() => navigate('/')}>Back to explore</Button>
          </div>
        </div>
      </div>
    );
  return (
    <div className="page request-page">
      <PageTitle title="SUGGEST A VENUE" back="/" />
      <div className="request-panel">
        <p className="muted">
          If a playground, court, or field is missing, send the details and an admin can approve it.
        </p>
        <form className="form" onSubmit={(e: FormEvent<HTMLFormElement>) => void submit(e)}>
          <div className="suggest-map-card">
            <div className="create-map-heading">
              <div>
                <p className="field-label">MARK THE PLACE</p>
                <strong>Click the map to set the marker</strong>
                <p>Place the pin where the playground or court is located.</p>
              </div>
              <MapPin size={18} />
            </div>
            <PlaceMap
              className="suggest-map"
              center={[form.longitude, form.latitude]}
              value={[form.longitude, form.latitude]}
              onChange={placeMarker}
            />
            <p className="venue-sport-hint" role="status">
              {addressLoading
                ? 'Finding the nearest address…'
                : addressUnavailable
                  ? 'Could not find an address. Please enter the address manually below.'
                  : 'Place a pin to find the address, or enter it below.'}
            </p>
          </div>
          <label>
            Venue name
            <input
              value={form.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => field('name', e.target.value)}
              required
              minLength={3}
              maxLength={100}
              placeholder="Riga Riverside Courts"
            />
          </label>
          <label>
            Address
            <input
              value={form.address}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                cancelLookup();
                setAddressUnavailable(false);
                field('address', e.target.value);
              }}
              required
              minLength={3}
              maxLength={160}
              placeholder="Street, city"
            />
          </label>
          <div>
            <p className="field-label">AVAILABLE SPORTS</p>
            <div className="sport-chips">
              {sports.map((sport) => (
                <button
                  key={sport}
                  type="button"
                  className={`chip ${form.sports.includes(sport) ? 'active' : ''}`}
                  aria-pressed={form.sports.includes(sport)}
                  onClick={() =>
                    field(
                      'sports',
                      form.sports.includes(sport)
                        ? form.sports.filter((current) => current !== sport)
                        : [...form.sports, sport],
                    )
                  }
                >
                  {sport}
                </button>
              ))}
            </div>
          </div>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => field('description', e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Tell the admin team what makes this place useful for players."
            />
          </label>
          <label>
            Venue image
            <select
              value={form.image}
              onChange={(e) => field('image', e.target.value as VenueInput['image'])}
            >
              <option value="/images/arena.webp">Indoor arena</option>
              <option value="/images/football.webp">Football ground</option>
            </select>
          </label>
          {send.error && (
            <p className="form-error" role="alert">
              {send.error.message} Please try again. Your details are still here.
            </p>
          )}
          <Button
            type="submit"
            busy={send.isPending}
            disabled={!form.sports.length || addressLoading}
          >
            Send for review
          </Button>
        </form>
      </div>
    </div>
  );
}
