import { useState, type FormEvent, type ChangeEvent } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import { sports, type VenueInput, type VenueRequest } from '@matchplay/shared/game';
import { api, json } from '../lib/api';
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
    result.address?.city ?? result.address?.town ?? result.address?.village ?? result.address?.municipality,
    result.address?.county,
    result.address?.state,
    result.address?.country,
  ].filter((part): part is string => Boolean(part));
  return parts.join(', ') || result.display_name || '';
}

export default function SuggestVenue() {
  const [submitted, setSubmitted] = useState<VenueRequest | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [form, setForm] = useState<VenueInput>({
    name: '',
    address: '',
    latitude: 56.957,
    longitude: 24.113,
    sports: ['Basketball'],
    image: '/images/arena.webp',
    description: '',
  });
  const field = <K extends keyof VenueInput>(key: K, value: VenueInput[K]) =>
    setForm((current: VenueInput) => ({ ...current, [key]: value }));
  async function placeMarker([longitude, latitude]: [number, number]) {
    field('longitude', longitude);
    field('latitude', latitude);
    setAddressLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=en`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) return;
      const data = (await response.json()) as ReverseGeocodeResult;
      const address = buildAddress(data);
      if (address) field('address', address);
    } catch {
      // Keep the chosen point even if reverse geocoding is unavailable.
    } finally {
      setAddressLoading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await api<VenueRequest>('/venue-requests', json(form)).catch(() => null);
    if (result) setSubmitted(result);
  }
  if (submitted)
    return (
      <div className="page request-page">
        <PageTitle title="VENUE SUGGESTION" back="/" />
        <div className="success-panel">
          <CheckCircle2 size={46} className="orange" />
          <h2>Thanks, your suggestion is pending review</h2>
          <p>
            The admin team will check {submitted.name} and decide whether to add it to the map.
          </p>
          <div className="request-summary">
            <span>{submitted.address}</span>
            <span>{submitted.sports.join(' · ')}</span>
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setSubmitted(null)}>
              Add another venue
            </Button>
            <Button onClick={() => (window.location.href = '/')}>
              Back to explore
            </Button>
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
              {addressLoading ? 'Finding the nearest address…' : 'The address is filled from the pinned place.'}
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
              onChange={(e: ChangeEvent<HTMLInputElement>) => field('address', e.target.value)}
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
          <Button type="submit" busy={false} disabled={!form.sports.length}>
            Send for review
          </Button>
        </form>
      </div>
    </div>
  );
}
