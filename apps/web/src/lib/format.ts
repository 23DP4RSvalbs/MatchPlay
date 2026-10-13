import type { Sport } from '@matchplay/shared/game';
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : name;
}
export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
export const schedule = (at: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Riga',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(at));
export const timeOnly = (at: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Riga',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(at));
export const day = (at: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Riga', day: 'numeric' }).format(
    new Date(at),
  );
export const month = (at: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Riga', month: 'short' }).format(
    new Date(at),
  );
export function distance(latitude: number, longitude: number, origin: [number, number]): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((latitude - origin[1]) * rad) / 2) ** 2 +
    Math.cos(latitude * rad) *
      Math.cos(origin[1] * rad) *
      Math.sin(((longitude - origin[0]) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export const sportCapacity: Record<Sport, number> = {
  Basketball: 5,
  Football: 5,
  Volleyball: 6,
  Tennis: 1,
};
export const clockText = (milliseconds: number, hours = false) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const m = String(Math.floor(seconds / 60) % (hours ? 60 : 10000)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return hours
    ? `${String(Math.floor(seconds / 3600)).padStart(2, '0')} : ${m} : ${s}`
    : `${m}:${s}`;
};
