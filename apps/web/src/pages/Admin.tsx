import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Search, Shield, Archive, MapPin } from 'lucide-react';
import { sports, type Person, type Venue, type VenueInput } from '@matchplay/shared/game';
import { api, json, useAction } from '../lib/api';
import { Avatar, Button, Dialog, Failure, PageTitle, Skeleton } from '../components/ui';

function VenueEditor({ venue, onClose }: { venue: Venue | null; onClose: () => void }) {
  const [form, setForm] = useState<VenueInput>(() => ({
    name: venue?.name ?? '',
    address: venue?.address ?? '',
    latitude: venue?.latitude ?? 56.957,
    longitude: venue?.longitude ?? 24.113,
    sports: venue?.sports ?? ['Basketball'],
    image: (venue?.image as VenueInput['image']) ?? '/images/arena.webp',
    description: venue?.description ?? '',
  }));
  const [active, setActive] = useState(venue?.active ?? true);
  const save = useAction(
    (body: unknown) =>
      api(
        venue ? `/admin/venues/${venue.id}` : '/admin/venues',
        json(body, venue ? 'PATCH' : 'POST'),
      ),
    'Venue saved.',
  );
  const field = <K extends keyof VenueInput>(key: K, value: VenueInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await save
      .mutateAsync({ ...form, ...(venue ? { active } : {}) })
      .catch(() => null);
    if (result) onClose();
  }
  return (
    <Dialog title={venue ? 'Edit venue' : 'Add a venue'} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <label>
          Venue name
          <input
            value={form.name}
            onChange={(e) => field('name', e.target.value)}
            required
            minLength={3}
            maxLength={100}
          />
        </label>
        <label>
          Address
          <input
            value={form.address}
            onChange={(e) => field('address', e.target.value)}
            required
            minLength={3}
            maxLength={160}
          />
        </label>
        <div className="form-row">
          <label>
            Latitude
            <input
              type="number"
              step="0.000001"
              min="55.6"
              max="58.2"
              value={form.latitude}
              onChange={(e) => field('latitude', Number(e.target.value))}
              required
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="0.000001"
              min="20.7"
              max="28.3"
              value={form.longitude}
              onChange={(e) => field('longitude', Number(e.target.value))}
              required
            />
          </label>
        </div>
        <div>
          <p className="field-label">AVAILABLE SPORTS</p>
          <div className="sport-chips">
            {sports.map((s) => (
              <button
                type="button"
                className={`chip ${form.sports.includes(s) ? 'active' : ''}`}
                key={s}
                onClick={() =>
                  field(
                    'sports',
                    form.sports.includes(s)
                      ? form.sports.filter((v) => v !== s)
                      : [...form.sports, s],
                  )
                }
              >
                {s}
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
            rows={3}
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
        {venue && (
          <label className="checkbox-label">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active venue
          </label>
        )}
        <Button busy={save.isPending} type="submit" disabled={!form.sports.length}>
          Save venue
        </Button>
      </form>
    </Dialog>
  );
}
export default function Admin() {
  const [tab, setTab] = useState('venues');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Venue | null | undefined>();
  const [person, setPerson] = useState<Person | null>(null);
  const [name, setName] = useState('');
  const [retiring, setRetiring] = useState<Venue | null>(null);
  const venues = useQuery({
    queryKey: ['admin', 'venues'],
    queryFn: () => api<Venue[]>('/admin/venues'),
    retry: false,
  });
  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api<Person[]>('/admin/users'),
    retry: false,
  });
  const changeUser = useAction(
    ({ id, body }: { id: string; body: unknown }) => api(`/admin/users/${id}`, json(body, 'PATCH')),
    'User updated.',
  );
  const retire = useAction(
    (id: string) => api(`/admin/venues/${id}`, { method: 'DELETE' }),
    'Venue retired. Match history is preserved.',
  );
  if (venues.isPending || users.isPending)
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  if (venues.error || users.error)
    return (
      <div className="page">
        <Failure error={(venues.error ?? users.error)!} />
      </div>
    );
  const filteredVenues = venues.data.filter((v) =>
    `${v.name} ${v.address}`.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredUsers = users.data.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="page admin-page">
      <PageTitle
        title="ADMIN PANEL"
        back="/profile"
        action={<Shield size={21} className="orange" />}
      />
      <div className="admin-toolbar">
        <div className="tabs">
          <button className={tab === 'venues' ? 'active' : ''} onClick={() => setTab('venues')}>
            Venues
          </button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            Users
          </button>
        </div>
        <div className="admin-search">
          <Search size={18} />
          <input
            value={search}
            aria-label="Search admin records"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab}…`}
          />
        </div>
        {tab === 'venues' && (
          <Button className="small" onClick={() => setEditing(null)}>
            <Plus size={17} />
            Add venue
          </Button>
        )}
      </div>
      {tab === 'venues' ? (
        <div className="admin-venue-grid">
          {filteredVenues.map((v) => (
            <article className={`admin-venue ${!v.active ? 'inactive' : ''}`} key={v.id}>
              <img src={v.image} alt="" loading="lazy" />
              <div className="admin-venue-copy">
                <span className={`status ${v.active ? 'lobby' : 'completed'}`}>
                  {v.active ? 'ACTIVE' : 'RETIRED'}
                </span>
                <h2>{v.name}</h2>
                <p>
                  <MapPin size={14} />
                  {v.address}
                </p>
                <div className="admin-sports">{v.sports.join(' · ')}</div>
                <div className="admin-record-actions">
                  <Button variant="outline" className="small" onClick={() => setEditing(v)}>
                    <Pencil size={15} />
                    Edit venue
                  </Button>
                  {v.active && (
                    <button aria-label={`Retire ${v.name}`} onClick={() => setRetiring(v)}>
                      <Archive size={17} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-user-list">
          {filteredUsers.map((u) => (
            <article className="admin-user" key={u.id}>
              <Avatar name={u.name} />
              <div>
                <h2>{u.name}</h2>
                <p>{u.email}</p>
              </div>
              <span className="admin-user-role">{u.role}</span>
              <span className={`status ${u.banned ? 'completed' : 'lobby'}`}>
                {u.banned ? 'INACTIVE' : 'ACTIVE'}
              </span>
              <button
                className="icon-button"
                aria-label={`Edit ${u.name}`}
                onClick={() => {
                  setPerson(u);
                  setName(u.name);
                }}
              >
                <Pencil size={17} />
              </button>
            </article>
          ))}
        </div>
      )}
      {!filteredVenues.length && tab === 'venues' && <p className="muted">No matching venues.</p>}
      {!filteredUsers.length && tab === 'users' && <p className="muted">No matching users.</p>}
      {editing !== undefined && (
        <VenueEditor venue={editing} onClose={() => setEditing(undefined)} />
      )}
      {person && (
        <Dialog title="Manage user" onClose={() => setPerson(null)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await changeUser
                .mutateAsync({ id: person.id, body: { name } })
                .catch(() => null);
              if (result) setPerson(null);
            }}
          >
            <label>
              Display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={60}
              />
            </label>
            <p className="muted">{person.email}</p>
            <Button type="submit" busy={changeUser.isPending}>
              Save name
            </Button>
            <Button
              type="button"
              variant="outline"
              busy={changeUser.isPending}
              onClick={async () => {
                const result = await changeUser
                  .mutateAsync({ id: person.id, body: { banned: !person.banned } })
                  .catch(() => null);
                if (result) setPerson(null);
              }}
            >
              {person.banned ? 'Reactivate account' : 'Deactivate account'}
            </Button>
            <p className="sample-note">Deactivation ends sessions and preserves match history.</p>
          </form>
        </Dialog>
      )}
      {retiring && (
        <Dialog title="Retire this venue?" onClose={() => setRetiring(null)}>
          <p className="muted">
            {retiring.name} will disappear from Explore. Past games remain in history.
          </p>
          <div className="dialog-actions">
            <Button variant="quiet" onClick={() => setRetiring(null)}>
              Keep venue
            </Button>
            <Button
              busy={retire.isPending}
              onClick={async () => {
                const result = await retire.mutateAsync(retiring.id).catch(() => null);
                if (result) setRetiring(null);
              }}
            >
              Retire venue
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
